"use client";

import { useState, useCallback } from "react";
// Pipeline v3.1 (6 agentes) - ÚNICO PIPELINE SUPORTADO
import {
  executeV3Pipeline,
  type V3PipelineRequest,
  type V3PipelineResponse,
  type ProgressCallback as V3ProgressCallback,
} from "@/lib/agents/v3";
import type { 
  AgentError, 
  GeneratedFlow,
  CreationProgress,
  CreationStep,
} from "@/lib/agents/types";
import type { NodeTypeV3 } from "@/lib/agents/v3/types";

/**
 * Helper: Get node category based on V3 type
 */
function getNodeCategory(type: NodeTypeV3 | string): string {
  const categoryMap: Record<string, string> = {
    form: "ui",
    choice: "ui", 
    action: "api",
    feedback_success: "ui",
    feedback_error: "ui",
    condition: "logic",
    end_success: "terminal",
    end_error: "terminal",
    end_neutral: "terminal",
    retry: "recovery",
    fallback: "recovery",
    loopback: "recovery",
    background_action: "api",
    delayed_action: "api",
    configuration_matrix: "ui",
    insight_branch: "logic",
    trigger: "entry",
  };
  return categoryMap[type] || "v3";
}

/**
 * Helper: Get node outputs based on V3 type
 */
function getNodeOutputs(type: NodeTypeV3 | string): string[] {
  const outputsMap: Record<string, string[]> = {
    condition: ["yes", "no"],
    choice: ["selected"],
    end_success: [],
    end_error: [],
    end_neutral: [],
    form: ["submit", "cancel"],
    action: ["success", "error"],
    feedback_success: ["continue"],
    feedback_error: ["retry", "cancel"],
  };
  return outputsMap[type] || ["success", "error"];
}

/**
 * Helper: Get connection label based on type
 */
function getConnectionLabel(connectionType: string): string {
  const labelMap: Record<string, string> = {
    success: "Yes",
    failure: "No",
    fallback: "Fallback",
    retry: "Retry",
    conditional: "",
    default: "",
  };
  return labelMap[connectionType] || "";
}

interface UseFlowCreatorOptions {
  projectId: number;
  userId: number;
  // Callbacks
  onV3FlowCreated?: (response: V3PipelineResponse) => void;
  onSuccess?: (response: V3PipelineResponse) => void;
  onError?: (error: AgentError) => void;
  onProgressChange?: (progress: CreationProgress) => void;
}

interface UseFlowCreatorReturn {
  /**
   * Create complete flow using Oria v3.1 pipeline with 6 agents:
   * 1. Product & Role Mapper
   * 2. Flow Synthesizer
   * 3. Archetype Modeler
   * 4. Flow Critic
   * 5. UX Block Composer
   * 6. Flow Connector
   */
  createCompleteFlow: (prompt: string) => Promise<V3PipelineResponse | null>;
  
  // State
  isLoading: boolean;
  progress: CreationProgress;
  error: AgentError | null;
  
  // Response v3.1
  v3Response: V3PipelineResponse | null;
  
  // Generated flow for ReactFlow
  generatedFlow: GeneratedFlow | null;
  
  // IDs
  flowMasterRuleId: number | null;
  subRuleIds: number[];
  flowId: number | null;
  
  // Reset
  reset: () => void;
}

export function useFlowCreator({
  projectId,
  userId,
  onV3FlowCreated,
  onSuccess,
  onError,
  onProgressChange,
}: UseFlowCreatorOptions): UseFlowCreatorReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState<CreationProgress>({
    step: "idle",
    message: "",
  });
  const [error, setError] = useState<AgentError | null>(null);
  
  // Response v3.1 (6 agentes)
  const [v3Response, setV3Response] = useState<V3PipelineResponse | null>(null);
  
  // Generated flow for ReactFlow
  const [generatedFlow, setGeneratedFlow] = useState<GeneratedFlow | null>(null);
  
  // IDs
  const [flowMasterRuleId, setFlowMasterRuleId] = useState<number | null>(null);
  const [subRuleIds, setSubRuleIds] = useState<number[]>([]);
  const [flowId, setFlowId] = useState<number | null>(null);

  // Helper para atualizar progresso
  const updateProgress = useCallback((newProgress: CreationProgress) => {
    setProgress(newProgress);
    onProgressChange?.(newProgress);
  }, [onProgressChange]);

  /**
   * Create complete flow using v3.1 pipeline (6 agents)
   */
  const createCompleteFlow = useCallback(
    async (prompt: string): Promise<V3PipelineResponse | null> => {
      if (!prompt.trim()) {
        const err: AgentError = {
          code: "EMPTY_PROMPT",
          message: "Prompt cannot be empty",
        };
        setError(err);
        onError?.(err);
        return null;
      }

      setIsLoading(true);
      setError(null);

      try {
        updateProgress({
          step: "creating_master",
          message: "🚀 Starting v3.1 pipeline with 6 agents...",
          percentage: 5,
        });

        const response = await executeV3Pipeline(
          {
            prompt,
            project_id: projectId,
            user_id: userId,
            options: {
              validation_level: "standard",
              include_archetype_modeling: true,
              auto_fix_issues: true,
            },
          },
          (v3Progress) => {
            // Convert v3 progress to CreationProgress
            const step: CreationStep = 
              v3Progress.agent <= 2 ? "creating_master" :
              v3Progress.agent <= 4 ? "decomposing" :
              "creating_flow";
            
            updateProgress({
              step,
              message: `[${v3Progress.agent}/6] ${v3Progress.agent_name}: ${v3Progress.message}`,
              percentage: v3Progress.percentage,
              details: {
                master_rule_created: v3Progress.agent >= 2,
                agent_name: v3Progress.agent_name,
                agent_status: v3Progress.status,
              },
            });
          }
        );

        if (!response.success) {
          throw {
            code: "V3_PIPELINE_ERROR",
            message: response.message || "Error in v3.1 pipeline",
          } as AgentError;
        }

        // Update states
        setV3Response(response);
        setFlowId(response.flow_id);
        setFlowMasterRuleId(response.master_rule_id);
        setSubRuleIds(response.sub_rule_ids);

        // Convert V3FlowNode to GeneratedFlow for FlowEditor compatibility
        const finalNodes = response.final_nodes || [];
        const finalConnections = response.final_connections || [];
        
        console.log("[useFlowCreator] Processing V3 response:", {
          nodes: finalNodes.length,
          connections: finalConnections.length,
          flow_id: response.flow_id,
        });
        
        const generatedFlowFromV3: GeneratedFlow & { 
          integrity_score?: number;
          findings?: any[];
        } = {
          name: response.flow_synthesis_result?.synthesized_flow?.flow_name || 
                response.flow_synthesis_result?.synthesized_flow?.flow_title || 
                "Flow v3",
          description: response.flow_synthesis_result?.synthesized_flow?.flow_description || "",
          nodes: finalNodes.map((node, idx) => {
            console.log(`  [Node ${idx}] id="${node.id}", type="${node.type}", pos=(${node.position_x}, ${node.position_y})`);
            
            return {
              id: node.id,
              db_id: node.db_id,
              // CRITICAL: Preserve the exact V3 type for correct component rendering
              type: node.type,
              title: node.title,
              description: node.description || "",
              // Use positions from layout engine (HORIZONTAL flow)
              position_x: node.position_x ?? (100 + idx * 400),
              position_y: node.position_y ?? 300,
              order_index: node.order_index ?? idx,
              column: node.column || "main",
              // Category based on node type for legacy compatibility
              category: getNodeCategory(node.type),
              verb: node.title,
              outputs: getNodeOutputs(node.type),
              // V3 specific fields
              impact_level: node.impact_level || "medium",
              role_scope: node.role_scope,
              group_label: node.group_label,
              inputs: node.inputs,
              actions: node.actions,
              feedback_messages: node.feedback_messages,
              archetypes_applied: node.archetypes_applied,
              // Reuse information
              reuse_info: {
                is_reused: node.reused || false,
                reuse_type: node.reused ? "reference" : undefined,
                referenced_in_flows: response.flow_connector_result?.cross_references
                  ?.filter(ref => ref.from_node_id === node.id)
                  .map(ref => ({ flow_id: ref.to_flow_id, flow_name: "" })),
              },
              // Subnodes for FormNode
              subnodes: node.children,
              children: node.children,
              // Connection info for edge creation
              next_on_success: node.next_on_success,
              next_on_failure: node.next_on_failure,
            };
          }),
          connections: finalConnections.map((conn, idx) => {
            console.log(`  [Conn ${idx}] source="${conn.source_node_id}" → target="${conn.target_node_id}" (${conn.connection_type})`);
            
            return {
              source_id: conn.source_node_id,
              source_node_id: conn.source_node_id,
              target_id: conn.target_node_id,
              target_node_id: conn.target_node_id,
              label: conn.label || getConnectionLabel(conn.connection_type),
              connection_type: conn.connection_type,
              type: conn.connection_type,
            };
          }),
          // v3 data for IntegrityScorePanel
          integrity_score: response.summary.integrity_score,
          findings: response.flow_critic_result?.findings,
        };

        setGeneratedFlow(generatedFlowFromV3);

        updateProgress({
          step: "completed",
          message: `✅ Pipeline v3.1 completed! Score: ${response.summary.integrity_score}%`,
          percentage: 100,
          details: {
            master_rule_created: true,
            nodes_created: response.summary.total_nodes,
            integrity_score: response.summary.integrity_score,
          },
        });

        // Callbacks
        onV3FlowCreated?.(response);
        onSuccess?.(response);

        return response;

      } catch (err) {
        const agentError = err as AgentError;
        setError(agentError);
        updateProgress({
          step: "error",
          message: agentError.message,
        });
        onError?.(agentError);
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [projectId, userId, onV3FlowCreated, onSuccess, onError, updateProgress]
  );

  /**
   * Reset hook state
   */
  const reset = useCallback(() => {
    setError(null);
    setV3Response(null);
    setGeneratedFlow(null);
    setFlowMasterRuleId(null);
    setSubRuleIds([]);
    setFlowId(null);
    setProgress({ step: "idle", message: "" });
  }, []);

  return {
    // Main function
    createCompleteFlow,
    // State
    isLoading,
    progress,
    error,
    // v3.1 response
    v3Response,
    // Generated flow
    generatedFlow,
    // IDs
    flowMasterRuleId,
    subRuleIds,
    flowId,
    // Reset
    reset,
  };
}
