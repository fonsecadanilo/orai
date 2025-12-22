/**
 * useCanvasEdges Hook
 * 
 * Gerencia conexões entre Brain Blocks e Flow Nodes no canvas.
 * Essas conexões são separadas das connections do flow e são usadas
 * para relacionamentos de referência, explicação, dependência, etc.
 */

import { useState, useCallback, useEffect } from "react";
import { supabase } from "@/lib/supabase/client";
import type { Edge, Connection } from "reactflow";

// ========================================
// TYPES
// ========================================

export type CanvasEdgeType = 
  | "reference"        // Referência genérica
  | "explains"         // Brain explica um node
  | "depends_on"       // Dependência lógica
  | "continuation"     // Brain -> Brain (continua conversa)
  | "generated_from"   // Flow gerado pelo Brain
  | "rule_applies_to"; // Regra aplicada a node/flow

export type SourceTargetType = "flow_node" | "canvas_block";

export interface CanvasEdge {
  id: string;
  project_id: number;
  source_type: SourceTargetType;
  source_id: string;
  source_handle?: string;
  target_type: SourceTargetType;
  target_id: string;
  target_handle?: string;
  edge_type: CanvasEdgeType;
  label?: string;
  style?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  created_by?: string;
}

// ========================================
// HELPERS
// ========================================

/** Determina o tipo do source/target baseado no ID */
function getNodeType(nodeId: string): SourceTargetType {
  // Brain blocks têm IDs que começam com "brain-" ou são UUIDs
  if (nodeId.startsWith("brain-") || nodeId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
    return "canvas_block";
  }
  return "flow_node";
}

/** Determina o edge_type default baseado nos tipos de source e target */
function getDefaultEdgeType(
  sourceType: SourceTargetType,
  targetType: SourceTargetType
): CanvasEdgeType {
  if (sourceType === "canvas_block" && targetType === "canvas_block") {
    return "continuation";
  }
  if (sourceType === "canvas_block" && targetType === "flow_node") {
    return "explains";
  }
  if (sourceType === "flow_node" && targetType === "canvas_block") {
    return "reference";
  }
  return "reference";
}

/** Converte CanvasEdge para ReactFlow Edge */
function toReactFlowEdge(canvasEdge: CanvasEdge): Edge {
  const colors: Record<CanvasEdgeType, string> = {
    reference: "#6366f1",     // indigo
    explains: "#8b5cf6",      // violet
    depends_on: "#f59e0b",    // amber
    continuation: "#3b82f6",  // blue
    generated_from: "#10b981", // emerald
    rule_applies_to: "#ec4899", // pink
  };

  return {
    id: canvasEdge.id,
    source: canvasEdge.source_id,
    target: canvasEdge.target_id,
    sourceHandle: canvasEdge.source_handle || "out_ref",
    targetHandle: canvasEdge.target_handle || "in_ref",
    label: canvasEdge.label || canvasEdge.edge_type,
    type: "smoothstep",
    animated: canvasEdge.edge_type === "generated_from",
    style: { 
      stroke: colors[canvasEdge.edge_type] || colors.reference,
      strokeWidth: 2,
      strokeDasharray: canvasEdge.edge_type === "depends_on" ? "5,5" : undefined,
    },
    data: {
      edgeType: canvasEdge.edge_type,
      canvasEdgeId: canvasEdge.id,
      sourceType: canvasEdge.source_type,
      targetType: canvasEdge.target_type,
    },
  };
}

// ========================================
// HOOK
// ========================================

export function useCanvasEdges(projectId: number) {
  const [canvasEdges, setCanvasEdges] = useState<CanvasEdge[]>([]);
  const [reactFlowEdges, setReactFlowEdges] = useState<Edge[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showBrainLinks, setShowBrainLinks] = useState(true);

  // Load canvas edges
  const loadEdges = useCallback(async () => {
    if (!projectId) return;
    
    setIsLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from("canvas_edges")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: true });

      if (fetchError) throw fetchError;

      setCanvasEdges(data || []);
      setReactFlowEdges((data || []).map(toReactFlowEdge));
    } catch (err) {
      console.error("[useCanvasEdges] Load error:", err);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  // Create edge
  const createEdge = useCallback(async (
    connection: Connection,
    edgeType?: CanvasEdgeType,
    label?: string
  ): Promise<CanvasEdge | null> => {
    if (!connection.source || !connection.target || !projectId) {
      console.warn("[useCanvasEdges] Invalid connection:", connection);
      return null;
    }

    const sourceType = getNodeType(connection.source);
    const targetType = getNodeType(connection.target);
    const finalEdgeType = edgeType || getDefaultEdgeType(sourceType, targetType);

    const newEdge: Omit<CanvasEdge, "id" | "created_at" | "updated_at"> = {
      project_id: projectId,
      source_type: sourceType,
      source_id: connection.source,
      source_handle: connection.sourceHandle || "out_ref",
      target_type: targetType,
      target_id: connection.target,
      target_handle: connection.targetHandle || "in_ref",
      edge_type: finalEdgeType,
      label: label,
    };

    try {
      const { data, error: insertError } = await supabase
        .from("canvas_edges")
        .insert(newEdge)
        .select()
        .single();

      if (insertError) throw insertError;

      const createdEdge = data as CanvasEdge;
      setCanvasEdges((prev) => [...prev, createdEdge]);
      setReactFlowEdges((prev) => [...prev, toReactFlowEdge(createdEdge)]);

      console.log("[useCanvasEdges] Edge created:", createdEdge);
      return createdEdge;
    } catch (err) {
      console.error("[useCanvasEdges] Create error:", err);
      setError(err instanceof Error ? err.message : String(err));
      return null;
    }
  }, [projectId]);

  // Update edge type
  const updateEdgeType = useCallback(async (
    edgeId: string,
    newEdgeType: CanvasEdgeType,
    newLabel?: string
  ): Promise<boolean> => {
    try {
      const { error: updateError } = await supabase
        .from("canvas_edges")
        .update({ 
          edge_type: newEdgeType, 
          label: newLabel,
          updated_at: new Date().toISOString(),
        })
        .eq("id", edgeId);

      if (updateError) throw updateError;

      setCanvasEdges((prev) =>
        prev.map((e) =>
          e.id === edgeId ? { ...e, edge_type: newEdgeType, label: newLabel } : e
        )
      );
      setReactFlowEdges((prev) =>
        prev.map((e) =>
          e.id === edgeId
            ? toReactFlowEdge({
                ...(canvasEdges.find((ce) => ce.id === edgeId) as CanvasEdge),
                edge_type: newEdgeType,
                label: newLabel,
              })
            : e
        )
      );

      console.log("[useCanvasEdges] Edge updated:", edgeId);
      return true;
    } catch (err) {
      console.error("[useCanvasEdges] Update error:", err);
      setError(err instanceof Error ? err.message : String(err));
      return false;
    }
  }, [canvasEdges]);

  // Delete edge
  const deleteEdge = useCallback(async (edgeId: string): Promise<boolean> => {
    try {
      const { error: deleteError } = await supabase
        .from("canvas_edges")
        .delete()
        .eq("id", edgeId);

      if (deleteError) throw deleteError;

      setCanvasEdges((prev) => prev.filter((e) => e.id !== edgeId));
      setReactFlowEdges((prev) => prev.filter((e) => e.id !== edgeId));

      console.log("[useCanvasEdges] Edge deleted:", edgeId);
      return true;
    } catch (err) {
      console.error("[useCanvasEdges] Delete error:", err);
      setError(err instanceof Error ? err.message : String(err));
      return false;
    }
  }, []);

  // Create generated_from edge after build
  const createGeneratedFromEdge = useCallback(async (
    canvasBlockId: string,
    flowRootNodeId: string
  ): Promise<CanvasEdge | null> => {
    return createEdge(
      {
        source: canvasBlockId,
        target: flowRootNodeId,
        sourceHandle: "out_ref",
        targetHandle: "in_ref",
      },
      "generated_from",
      "Gerado"
    );
  }, [createEdge]);

  // Load on mount and when projectId changes
  useEffect(() => {
    loadEdges();
  }, [loadEdges]);

  // Realtime subscription
  useEffect(() => {
    if (!projectId) return;

    const channel = supabase
      .channel(`canvas-edges-${projectId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "canvas_edges",
          filter: `project_id=eq.${projectId}`,
        },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const newEdge = payload.new as CanvasEdge;
            setCanvasEdges((prev) => {
              if (prev.some((e) => e.id === newEdge.id)) return prev;
              return [...prev, newEdge];
            });
            setReactFlowEdges((prev) => {
              if (prev.some((e) => e.id === newEdge.id)) return prev;
              return [...prev, toReactFlowEdge(newEdge)];
            });
          } else if (payload.eventType === "UPDATE") {
            const updatedEdge = payload.new as CanvasEdge;
            setCanvasEdges((prev) =>
              prev.map((e) => (e.id === updatedEdge.id ? updatedEdge : e))
            );
            setReactFlowEdges((prev) =>
              prev.map((e) =>
                e.id === updatedEdge.id ? toReactFlowEdge(updatedEdge) : e
              )
            );
          } else if (payload.eventType === "DELETE") {
            const deletedId = payload.old.id;
            setCanvasEdges((prev) => prev.filter((e) => e.id !== deletedId));
            setReactFlowEdges((prev) => prev.filter((e) => e.id !== deletedId));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [projectId]);

  return {
    canvasEdges,
    reactFlowEdges: showBrainLinks ? reactFlowEdges : [],
    isLoading,
    error,
    showBrainLinks,
    setShowBrainLinks,
    loadEdges,
    createEdge,
    updateEdgeType,
    deleteEdge,
    createGeneratedFromEdge,
  };
}

