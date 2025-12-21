import { supabase } from "./client";
import { MarkerType } from "reactflow";

// V3 node types that should be preserved
const V3_NODE_TYPES = new Set([
  "form", "choice", "action", "feedback_success", "feedback_error",
  "condition", "end_success", "end_error", "end_neutral",
  "retry", "fallback", "loopback",
  "background_action", "delayed_action", "configuration_matrix", "insight_branch",
  "trigger", "end", "subflow", "field_group", "text", "note"
]);

// Legacy + V3 types for database
export interface FlowNode {
  id: number;
  flow_id: number;
  type: string;
  title: string | null;
  description: string | null;
  position_x: number;
  position_y: number;
  subflow_id: number | null;
  metadata?: {
    // CRITICAL: V3 type preservation
    v3_type?: string;
    // Legacy fields
    category?: string;
    verb?: string;
    subtype?: "comment" | "rule";
    level?: number;
    is_error?: boolean;
    status?: "success" | "error";
    // V3 fields
    impact_level?: "low" | "medium" | "high";
    role_scope?: string;
    group_label?: string;
    inputs?: any[];
    actions?: any[];
    feedback_messages?: any[];
    children?: any[];
    column?: "main" | "error" | "alternative";
    reused?: boolean;
    next_on_success?: string;
    next_on_failure?: string;
  };
  created_at: string;
  updated_at: string;
}

export interface FlowConnection {
  id: number;
  flow_id: number;
  source_node_id: number;
  target_node_id: number;
  label?: string;
  connection_type?: string;
  metadata?: {
    connection_type?: string; // v3.1: also stored in metadata
    order?: number;
    condition?: string;
    original_source_id?: string;
    original_target_id?: string;
  };
  created_at: string;
  updated_at: string;
}

// Saved flow type
export interface SavedFlow {
  id: number;
  name: string;
  description: string | null;
  project_id: number;
  journey_id: number | null;
  metadata?: {
    has_journey?: boolean;
    journey_steps?: number;
    features_count?: number;
    version?: string;
    integrity_score?: number;
  };
  created_at: string;
  updated_at: string;
  nodes?: FlowNode[];
  connections?: FlowConnection[];
}

// Simplified type for listing
export interface FlowListItem {
  id: number;
  name: string;
  description: string | null;
  updated_at: string;
}

/**
 * Get all flows for a project
 */
export async function getFlows(projectId: number = 1): Promise<FlowListItem[]> {
  const { data, error } = await supabase
    .from("flows")
    .select("id, name, description, updated_at")
    .eq("project_id", projectId)
    .order("updated_at", { ascending: false });

  if (error) {
    console.error("Error fetching flows:", error);
    return [];
  }

  return data || [];
}

/**
 * Get a specific flow with all details
 */
export async function getFlowById(flowId: number): Promise<SavedFlow | null> {
  const { data: flowData, error: flowError } = await supabase
    .from("flows")
    .select("*")
    .eq("id", flowId)
    .single();

  if (flowError) {
    console.error("Error fetching flow:", flowError);
    return null;
  }

  const { data: nodesData, error: nodesError } = await supabase
    .from("nodes")
    .select("*")
    .eq("flow_id", flowId)
    .order("id", { ascending: true });

  if (nodesError) {
    console.error("Error fetching nodes:", nodesError);
  }

  const { data: connectionsData, error: connectionsError } = await supabase
    .from("connections")
    .select("*")
    .eq("flow_id", flowId)
    .order("id", { ascending: true });

  if (connectionsError) {
    console.error("Error fetching connections:", connectionsError);
  }

  return {
    ...flowData,
    nodes: nodesData || [],
    connections: connectionsData || [],
  };
}

/**
 * Create a new flow
 */
export async function createFlow(
  flow: Omit<SavedFlow, "id" | "created_at" | "updated_at" | "nodes" | "connections">
): Promise<SavedFlow | null> {
  const { data, error } = await supabase
    .from("flows")
    .insert([flow])
    .select()
    .single();

  if (error) {
    console.error("Error creating flow:", error);
    return null;
  }

  return { ...data, nodes: [], connections: [] };
}

/**
 * Update a flow
 */
export async function updateFlow(
  flowId: number,
  updates: Partial<Omit<SavedFlow, "id" | "created_at" | "nodes" | "connections">>
): Promise<SavedFlow | null> {
  const { data, error } = await supabase
    .from("flows")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", flowId)
    .select()
    .single();

  if (error) {
    console.error("Error updating flow:", error);
    return null;
  }

  return data;
}

/**
 * Delete a flow
 */
export async function deleteFlow(flowId: number): Promise<boolean> {
  const { error } = await supabase
    .from("flows")
    .delete()
    .eq("id", flowId);

  if (error) {
    console.error("Error deleting flow:", error);
    return false;
  }

  return true;
}

// Edge colors
const EDGE_COLORS = {
  default: "#e4e4e7",
  success: "#22c55e",
  error: "#ef4444",
  rule: "#3b82f6",
  warning: "#f59e0b",
};

/**
 * Convert SavedFlow to ReactFlow format
 * CRITICAL: Uses v3_type from metadata for proper V3 node rendering
 */
export function convertSavedFlowToReactFlow(savedFlow: SavedFlow) {
  console.log("[convertSavedFlowToReactFlow] Converting flow:", savedFlow.id, "with", savedFlow.nodes?.length, "nodes");

  const nodes = (savedFlow.nodes || []).map((node) => {
    const metadata = node.metadata || {};
    
    // CRITICAL: Use v3_type from metadata if available, otherwise fall back to node.type
    const originalType = metadata.v3_type || node.type;
    const isV3Type = V3_NODE_TYPES.has(originalType);
    
    // Use the original V3 type directly for ReactFlow
    const reactFlowType = isV3Type ? originalType : mapLegacyType(node.type);
    
    console.log(`  Node ${node.id}: db_type="${node.type}", v3_type="${metadata.v3_type}", reactFlowType="${reactFlowType}"`);
    
    // Build node data with all V3 fields
    const nodeData: Record<string, unknown> = {
      label: node.title || "Untitled",
      title: node.title || "Untitled",
      description: node.description,
      // V3 fields from metadata
      impact_level: metadata.impact_level || "medium",
      role_scope: metadata.role_scope,
      group_label: metadata.group_label,
      inputs: metadata.inputs,
      actions: metadata.actions,
      feedback_messages: metadata.feedback_messages,
      subnodes: metadata.children,
      children: metadata.children,
      column: metadata.column,
      reuse_info: metadata.reused ? { is_reused: true } : undefined,
    };
    
    // Add type-specific fields based on the ORIGINAL type
    addTypeSpecificData(nodeData, originalType, node, metadata);

    return {
      id: String(node.id),
      type: reactFlowType,
      position: { x: node.position_x, y: node.position_y },
      data: nodeData,
    };
  });

  // Convert connections to edges
  const edges = (savedFlow.connections || []).map((conn) => {
    const label = (conn.label || "").toLowerCase();
    // Use connection_type from direct field OR from metadata (v3.1 stores both)
    const connType = (conn.connection_type || conn.metadata?.connection_type || "").toLowerCase();
    
    // Determine color based on connection_type first, then label
    let strokeColor = EDGE_COLORS.default;
    
    if (connType === "error" || connType === "failure" || connType === "fallback" ||
        label === "error" || label === "erro" || label === "no" || label === "não" || label === "nao") {
      strokeColor = EDGE_COLORS.error;
    } else if (connType === "success" || connType === "default" ||
               label === "success" || label === "sucesso" || label === "yes" || label === "sim" || label === "next") {
      strokeColor = EDGE_COLORS.success;
    } else if (connType === "retry") {
      strokeColor = EDGE_COLORS.warning;
    } else if (connType === "condition" || label === "rule" || label === "regra") {
      strokeColor = EDGE_COLORS.rule;
    }

    return {
      id: `edge-${conn.source_node_id}-${conn.target_node_id}`,
      source: String(conn.source_node_id),
      target: String(conn.target_node_id),
      label: conn.label || undefined,
      style: { stroke: strokeColor, strokeWidth: 2 },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: strokeColor,
      },
      // Store connection_type in edge data for reference
      data: {
        connection_type: connType,
      },
    };
  });

  console.log(`[convertSavedFlowToReactFlow] Converted: ${nodes.length} nodes, ${edges.length} edges`);

  return { nodes, edges };
}

/**
 * Map legacy database types to ReactFlow types
 */
function mapLegacyType(dbType: string): string {
  const mapping: Record<string, string> = {
    trigger: "trigger",
    action: "action",
    condition: "condition",
    input: "form", // Map input back to form for V3
    wait: "delayed_action",
    end: "end",
    note: "text",
    subflow: "subflow",
    field_group: "fieldGroup",
  };
  return mapping[dbType] || "action";
}

/**
 * Add type-specific fields to node data
 */
function addTypeSpecificData(
  nodeData: Record<string, unknown>,
  nodeType: string,
  node: FlowNode,
  metadata: FlowNode["metadata"]
) {
  switch (nodeType) {
    case "condition":
    case "choice":
    case "insight_branch":
    case "configuration_matrix":
      nodeData.expression = node.title || "Condition?";
      nodeData.paths = { yes: "", no: "" };
      nodeData.tag = "Condition";
      break;
      
    case "action":
    case "background_action":
    case "delayed_action":
    case "retry":
    case "fallback":
    case "loopback":
      nodeData.category = metadata?.category || "api";
      nodeData.action_category = metadata?.category || "process";
      nodeData.verb = metadata?.verb || node.title;
      nodeData.outputs = metadata?.is_error ? ["error"] : ["success", "error"];
      break;
      
    case "end":
    case "end_success":
      nodeData.status = "success";
      nodeData.end_status = "success";
      break;
      
    case "end_error":
      nodeData.status = "error";
      nodeData.end_status = "error";
      break;
      
    case "end_neutral":
      nodeData.status = "neutral";
      nodeData.end_status = "neutral";
      break;
      
    case "feedback_success":
      nodeData.status = "success";
      nodeData.feedbackType = "success";
      break;
      
    case "feedback_error":
      nodeData.status = "error";
      nodeData.feedbackType = "error";
      break;
      
    case "text":
    case "note":
      nodeData.subtype = metadata?.subtype || "comment";
      nodeData.content = node.description || "";
      break;
      
    case "form":
    case "field_group":
      nodeData.mode = "all_in_one";
      nodeData.fields = metadata?.inputs || [];
      break;
      
    case "subflow":
      nodeData.targetFlowId = String(node.subflow_id || "");
      break;
      
    case "trigger":
      nodeData.triggerType = "user_action";
      break;
  }
}
