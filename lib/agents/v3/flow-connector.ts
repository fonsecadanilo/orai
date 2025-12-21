/**
 * Agent 6: Flow Connector & Reusability Tracker v3.1
 * 
 * Responsibilities:
 * - Create connections (edges) between nodes
 * - Track reuse across flows
 * - Detect cross-references
 * - Generate dependency graph
 * - Calculate HORIZONTAL layout
 */

import { supabase } from "@/lib/supabase/client";
import type {
  FlowConnectorRequest,
  FlowConnectorResponse,
  NodeConnection,
  ReusabilityInfo,
  AdaptedUXBlockV3,
  SynthesizedFlow,
  V3FlowNode,
} from "./types";
import type { AgentError } from "../types";

const EDGE_FUNCTION_URL = "v3-flow-connector";

/**
 * Connect a flow and track reusability
 */
export async function connectFlow(
  request: FlowConnectorRequest
): Promise<FlowConnectorResponse> {
  console.log("[Agent 6: Flow Connector] Connecting flow...");

  // Normalize input data
  const synthesizedFlow = request.synthesized_flow || { steps: [], decisions: [], failure_points: [] };
  const composedBlocks = request.composed_blocks || [];
  
  if (composedBlocks.length === 0) {
    console.warn("[Flow Connector] No blocks to connect - returning empty connections");
    return {
      success: true,
      connections: [],
      reusability_info: [],
      cross_references: [],
      message: "No blocks to connect",
    };
  }

  const steps = synthesizedFlow.steps || [];
  
  // CRITICAL: Use node_id from composed blocks if available, otherwise use block_id
  // The UX Block Composer should now preserve node_id from original steps
  const getBlockNodeId = (block: AdaptedUXBlockV3) => {
    return (block as any).node_id || block.block_id;
  };

  // Map step_id to node_id (the actual ID that will be used in connections)
  const stepToNodeIdMap = new Map<string, string>();
  // Also map by index for fallback when step_ids are unreliable
  const indexToNodeIdMap = new Map<number, string>();
  
  // First try to use node_id from composed blocks (preserved from steps)
  composedBlocks.forEach((block, index) => {
    const nodeId = getBlockNodeId(block);
    // Store by index as fallback
    indexToNodeIdMap.set(index, nodeId);
    
    // If block has node_id that matches a step_id pattern, use it directly
    if ((block as any).node_id) {
      stepToNodeIdMap.set((block as any).node_id, nodeId);
    }
    // Also map by step_id if available (SKIP undefined step_ids!)
    if (index < steps.length && steps[index]?.step_id) {
      stepToNodeIdMap.set(steps[index].step_id, nodeId);
    }
  });
  
  console.log("[Flow Connector] Step to NodeId map:", Object.fromEntries(stepToNodeIdMap));
  
  // Helper to get target node ID - use step_id mapping first, fall back to next index
  const getTargetNodeId = (stepId: string | undefined, fallbackIndex: number): string | undefined => {
    if (stepId && stepToNodeIdMap.has(stepId)) {
      return stepToNodeIdMap.get(stepId);
    }
    // Fallback to index-based lookup
    return indexToNodeIdMap.get(fallbackIndex);
  };

  // Generate connections from synthesized flow
  // Index by position in composedBlocks array
  const generatedConnections: Array<{
    target_node_id: string;
    connection_type: string;
    label?: string;
  }>[] = composedBlocks.map(() => []);

  // Connect SEQUENTIAL steps - create a proper left-to-right flow
  // The synthesized flow's decisions/failure_points might have unreliable step_ids
  // So we use a simple sequential connection strategy as the primary approach
  for (let i = 0; i < composedBlocks.length; i++) {
    // Connect current node to the next node in sequence
    if (i < composedBlocks.length - 1) {
      const nextNodeId = indexToNodeIdMap.get(i + 1);
      if (nextNodeId) {
        generatedConnections[i].push({
          target_node_id: nextNodeId,
          connection_type: "success",
          label: "",
        });
      }
    }
    
    // Check for additional decision branches from synthesized flow
    if (i < steps.length) {
      const currentStep = steps[i];
      const decisions = synthesizedFlow.decisions || [];
      const decision = decisions.find(d => d.after_step_id === currentStep?.step_id);

      if (decision) {
        // Add decision branches (in addition to sequential connection)
        for (const option of decision.options || []) {
          if (!option.is_default) { // Skip default - we already have sequential
            const targetNodeId = getTargetNodeId(option.leads_to_step_id, i + 1);
            if (targetNodeId && !generatedConnections[i].some(c => c.target_node_id === targetNodeId)) {
              generatedConnections[i].push({
                target_node_id: targetNodeId,
                connection_type: "condition",
                label: option.label || option.decision_label,
              });
            }
          }
        }
      }

      // Add failure connections
      const failurePoints = synthesizedFlow.failure_points || [];
      const failurePoint = failurePoints.find(f => f.at_step_id === currentStep?.step_id);
      if (failurePoint && failurePoint.recovery_step_id) {
        const recoveryIndex = steps.findIndex(s => s.step_id === failurePoint.recovery_step_id);
        const recoveryNodeId = getTargetNodeId(failurePoint.recovery_step_id, recoveryIndex >= 0 ? recoveryIndex : 0);
        if (recoveryNodeId && !generatedConnections[i].some(c => c.target_node_id === recoveryNodeId)) {
          generatedConnections[i].push({
            target_node_id: recoveryNodeId,
            connection_type: failurePoint.recovery_strategy === "retry" ? "retry" : "fallback",
            label: failurePoint.recovery_strategy === "retry" ? "Retry" : "Fallback",
          });
        }
      }
    }
  }

  console.log("[Flow Connector] Generated connections:", generatedConnections.flat().length);
  console.log("[Flow Connector] Connections by index:", generatedConnections.map((c, i) => `${i}: ${c.length}`));

  // Prepare rich nodes with proper node_id from composedBlocks
  const richNodes = composedBlocks.map((block, index) => {
    const nodeId = getBlockNodeId(block);
    console.log(`[Flow Connector] Node ${index}: id=${nodeId}, type=${block.block_type}, conns=${generatedConnections[index]?.length || 0}`);
    
    return {
      node_id: nodeId,
      node_type: block.block_type || "action",
      title: block.title || "Block",
      description: block.description,
      impact_level: block.impact_level || "medium",
      connections: generatedConnections[index] || [],
    };
  });

  const { data, error } = await supabase.functions.invoke<FlowConnectorResponse>(
    EDGE_FUNCTION_URL,
    {
      body: {
        project_id: request.project_id,
        user_id: request.user_id,
        flow_title: synthesizedFlow.flow_name || synthesizedFlow.flow_title || "Untitled Flow",
        flow_description: synthesizedFlow.flow_description || "",
        rich_nodes: richNodes,
        adapted_blocks: composedBlocks.map(block => {
          const nodeId = getBlockNodeId(block);
          return {
            block_id: nodeId,
            node_id: nodeId,
            block_type: block.block_type || "action",
            label: block.title || "Block",
            input_fields: block.input_fields || [],
            actions: block.actions || [],
            children: block.children,
          };
        }),
        check_reusability: true,
      },
    }
  );

  if (error) {
    console.error("[Flow Connector] Error:", error);
    throw {
      code: "EDGE_FUNCTION_ERROR",
      message: error.message || "Error connecting flow",
      details: error,
    } as AgentError;
  }

  if (!data) {
    throw {
      code: "EMPTY_RESPONSE",
      message: "Empty response from flow connector",
    } as AgentError;
  }

  if (!data.success) {
    throw {
      code: "AGENT_ERROR",
      message: data.message || "Error connecting flow",
    } as AgentError;
  }

  console.log("[Flow Connector] Connection complete:", {
    connections_count: data.connections?.length,
    reusability_count: data.reusability_info?.length,
  });

  return data;
}

/**
 * Generate connections from a synthesized flow
 */
export function generateConnections(flow: SynthesizedFlow): NodeConnection[] {
  const connections: NodeConnection[] = [];
  let connectionCounter = 0;

  if (!flow.steps || flow.steps.length === 0) {
    return connections;
  }

  // Connect sequential steps
  for (let i = 0; i < flow.steps.length - 1; i++) {
    const currentStep = flow.steps[i];
    const nextStep = flow.steps[i + 1];

    // Check for decision after this step
    const decision = flow.decisions?.find(d => d.after_step_id === currentStep.step_id);

    if (decision) {
      // Create connections for each decision option
      for (const option of decision.options) {
        connections.push({
          connection_id: `conn_${++connectionCounter}`,
          source_node_id: currentStep.step_id,
          target_node_id: option.leads_to_step_id,
          connection_type: option.is_default ? "default" : "conditional",
          condition_expression: option.is_default ? undefined : option.label,
          label: option.label,
          is_primary_path: option.is_default,
          order_priority: option.is_default ? 0 : 1,
        });
      }
    } else {
      // Simple connection to next step
      connections.push({
        connection_id: `conn_${++connectionCounter}`,
        source_node_id: currentStep.step_id,
        target_node_id: nextStep.step_id,
        connection_type: "success",
        is_primary_path: true,
        order_priority: 0,
      });
    }

    // Add failure connections
    const failurePoint = flow.failure_points?.find(f => f.at_step_id === currentStep.step_id);
    if (failurePoint && failurePoint.recovery_step_id) {
      connections.push({
        connection_id: `conn_${++connectionCounter}`,
        source_node_id: currentStep.step_id,
        target_node_id: failurePoint.recovery_step_id,
        connection_type: failurePoint.recovery_strategy === "retry" ? "retry" : "fallback",
        label: "Error",
        is_primary_path: false,
        order_priority: 2,
      });
    }
  }

  return connections;
}

/**
 * Detect reusable nodes from other flows
 */
export async function detectReusableNodes(
  projectId: number,
  blocks: AdaptedUXBlockV3[]
): Promise<ReusabilityInfo[]> {
  const reusabilityInfo: ReusabilityInfo[] = [];

  const { data: existingNodes, error } = await supabase
    .from("nodes")
    .select("id, title, type, flow_id, metadata")
    .limit(500);

  if (error || !existingNodes) {
    return blocks.map(b => ({
      node_id: b.block_id,
      is_reused: false,
      primary_flow_id: "",
      referenced_in_flows: [],
    }));
  }

  for (const block of blocks) {
    const similar = existingNodes.find(
      n => n.title?.toLowerCase() === block.title?.toLowerCase() &&
           ((n.metadata as any)?.v3_type === block.block_type || n.type === block.block_type)
    );

    if (similar) {
      reusabilityInfo.push({
        node_id: block.block_id,
        is_reused: true,
        reuse_type: "reference",
        source_flow_id: String(similar.flow_id),
        primary_flow_id: String(similar.flow_id),
        referenced_in_flows: [String(similar.flow_id)],
      });
    } else {
      reusabilityInfo.push({
        node_id: block.block_id,
        is_reused: false,
        primary_flow_id: "",
        referenced_in_flows: [],
      });
    }
  }

  return reusabilityInfo;
}

/**
 * Generate dependency graph between flows
 */
export async function generateDependencyGraph(
  projectId: number
): Promise<{
  nodes: string[];
  edges: { from: string; to: string }[];
}> {
  const { data: flows, error: flowsError } = await supabase
    .from("flows")
    .select("id, title")
    .eq("project_id", projectId);

  if (flowsError || !flows) {
    return { nodes: [], edges: [] };
  }

  return {
    nodes: flows.map(f => String(f.id)),
    edges: [],
  };
}

/**
 * Convert adapted blocks to final flow nodes with HORIZONTAL layout
 * 
 * Layout Strategy:
 * - Main path flows left-to-right (X axis)
 * - Branches spread vertically (Y axis)
 * - Error paths go below, alternative paths go above
 */
export function convertBlocksToNodes(
  blocks: AdaptedUXBlockV3[],
  connections: NodeConnection[],
  flowId: string
): V3FlowNode[] {
  const NODE_WIDTH = 280;
  const NODE_HEIGHT = 160;
  const HORIZONTAL_GAP = 120;
  const VERTICAL_GAP = 80;
  const SPACING_X = NODE_WIDTH + HORIZONTAL_GAP;
  const SPACING_Y = NODE_HEIGHT + VERTICAL_GAP;
  const START_X = 100;
  const CENTER_Y = 300;
  
  // Build adjacency maps
  const adjacency = new Map<string, Array<{ target: string; type: string }>>();
  const reverseAdjacency = new Map<string, string[]>();
  
  for (const conn of connections) {
    // Forward
    const neighbors = adjacency.get(conn.source_node_id) || [];
    neighbors.push({ target: conn.target_node_id, type: conn.connection_type });
    adjacency.set(conn.source_node_id, neighbors);
    
    // Reverse
    const parents = reverseAdjacency.get(conn.target_node_id) || [];
    parents.push(conn.source_node_id);
    reverseAdjacency.set(conn.target_node_id, parents);
  }
  
  // Find root nodes
  const targetIds = new Set(connections.map(c => c.target_node_id));
  const rootNodes = blocks.filter(b => !targetIds.has(b.block_id));
  
  // BFS for layout
  const positions = new Map<string, { x: number; y: number; column: "main" | "error" | "alternative" }>();
  const visited = new Set<string>();
  const queue: Array<{
    nodeId: string;
    level: number;
    row: number;
    column: "main" | "error" | "alternative";
  }> = [];
  
  // Start with roots
  rootNodes.forEach((node) => {
    queue.push({ nodeId: node.block_id, level: 0, row: 0, column: "main" });
  });
  
  // If no roots, start with first
  if (queue.length === 0 && blocks.length > 0) {
    queue.push({ nodeId: blocks[0].block_id, level: 0, row: 0, column: "main" });
  }
  
  const levelRows = new Map<number, number>();
  
  while (queue.length > 0) {
    const { nodeId, level, row, column } = queue.shift()!;
    
    if (visited.has(nodeId)) continue;
    visited.add(nodeId);
    
    const currentRow = levelRows.get(level) || 0;
    levelRows.set(level, currentRow + 1);
    
    let y = CENTER_Y;
    if (column === "error") {
      y = CENTER_Y + SPACING_Y * (1 + currentRow);
    } else if (column === "alternative") {
      y = CENTER_Y - SPACING_Y * (1 + currentRow);
    }
    
    positions.set(nodeId, {
      x: START_X + level * SPACING_X,
      y,
      column,
    });
    
    const outgoing = adjacency.get(nodeId) || [];
    
    outgoing.forEach((conn, idx) => {
      if (visited.has(conn.target)) return;
      
      let targetColumn: "main" | "error" | "alternative" = "main";
      let targetRow = 0;
      
      if (conn.type === "failure" || conn.type === "fallback" || conn.type === "error" || conn.type === "retry") {
        targetColumn = "error";
        targetRow = idx;
      } else if (conn.type === "conditional" && idx > 0) {
        targetColumn = idx % 2 === 1 ? "alternative" : "error";
        targetRow = Math.floor(idx / 2);
      } else if (outgoing.length > 1 && idx > 0) {
        targetRow = idx;
      }
      
      queue.push({
        nodeId: conn.target,
        level: level + 1,
        row: targetRow,
        column: targetColumn,
      });
    });
  }
  
  // Handle disconnected
  let orphanIndex = 0;
  blocks.forEach((block) => {
    if (!visited.has(block.block_id)) {
      positions.set(block.block_id, {
        x: START_X,
        y: CENTER_Y + 500 + orphanIndex * SPACING_Y,
        column: "main",
      });
      orphanIndex++;
    }
  });

  return blocks.map((block, idx) => {
    const position = positions.get(block.block_id) || { x: START_X + idx * SPACING_X, y: CENTER_Y, column: "main" as const };
    const outConns = connections.filter(c => c.source_node_id === block.block_id);
    const successConn = outConns.find(c => c.connection_type === "success" || c.is_primary_path);
    const failConn = outConns.find(c => c.connection_type === "failure" || c.connection_type === "fallback" || c.connection_type === "error");

    return {
      id: block.block_id,
      flow_id: flowId,
      type: block.block_type,
      title: block.title,
      description: block.description,
      position_x: position.x,
      position_y: position.y,
      order_index: idx,
      column: position.column,
      impact_level: block.impact_level,
      role_scope: block.role_scope,
      group_label: block.group_label,
      next_on_success: successConn?.target_node_id,
      next_on_failure: failConn?.target_node_id,
      reused: !!block.original_block_id,
      inputs: block.input_fields,
      actions: block.actions,
      feedback_messages: block.feedback_messages,
      children: block.children?.map(c => ({
        id: c.subnode_id,
        flow_id: flowId,
        type: c.subnode_type as any,
        title: c.subnode_type,
        impact_level: "low" as const,
        reused: false,
        parent_node_id: block.block_id,
        content: c.content,
      })),
      page_key: block.adapted_for_page_key,
      user_intent: block.adapted_for_intent,
    };
  });
}

/**
 * Save connected flow to database
 */
export async function saveConnectedFlow(
  projectId: number,
  userId: number,
  nodes: V3FlowNode[],
  connections: NodeConnection[],
  metadata: {
    flow_title: string;
    flow_description?: string;
    integrity_score?: number;
    master_rule_id?: number;
  }
): Promise<{ flow_id: number; node_ids: number[] }> {
  // Create flow
  const { data: flow, error: flowError } = await supabase
    .from("flows")
    .insert({
      project_id: projectId,
      user_id: userId,
      name: metadata.flow_title,
      description: metadata.flow_description,
      status: "draft",
      master_rule_id: metadata.master_rule_id,
      metadata: {
        version: "3.1",
        integrity_score: metadata.integrity_score,
        nodes_count: nodes.length,
        connections_count: connections.length,
      },
    })
    .select("id")
    .single();

  if (flowError || !flow) {
    throw new Error(`Error creating flow: ${flowError?.message}`);
  }

  // DB type mapping
  const dbTypeMapping: Record<string, string> = {
    "form": "input",
    "choice": "condition",
    "feedback_success": "end",
    "feedback_error": "end",
    "end_success": "end",
    "end_error": "end",
    "end_neutral": "end",
    "retry": "action",
    "fallback": "action",
    "loopback": "action",
    "background_action": "action",
    "delayed_action": "wait",
    "configuration_matrix": "condition",
    "insight_branch": "condition",
  };

  // Save nodes with V3 type in metadata
  const nodesToInsert = nodes.map(node => ({
    flow_id: flow.id,
    project_id: projectId,
    type: dbTypeMapping[node.type] || node.type,
    title: node.title,
    description: node.description,
    position_x: node.position_x,
    position_y: node.position_y,
    metadata: {
      v3_type: node.type, // CRITICAL: Store original V3 type
      impact_level: node.impact_level,
      role_scope: node.role_scope,
      group_label: node.group_label,
      column: node.column,
      reused: node.reused,
      inputs: node.inputs,
      actions: node.actions,
      children: node.children,
    },
  }));

  const { data: insertedNodes, error: nodesError } = await supabase
    .from("nodes")
    .insert(nodesToInsert)
    .select("id");

  if (nodesError) {
    await supabase.from("flows").delete().eq("id", flow.id);
    throw new Error(`Error creating nodes: ${nodesError.message}`);
  }

  // Map IDs
  const nodeIdMap = new Map<string, number>();
  insertedNodes.forEach((inserted, idx) => {
    nodeIdMap.set(nodes[idx].id, inserted.id);
  });

  // Save connections
  const connectionsToInsert = connections
    .filter(c => nodeIdMap.has(c.source_node_id) && nodeIdMap.has(c.target_node_id))
    .map(conn => ({
      flow_id: flow.id,
      source_node_id: nodeIdMap.get(conn.source_node_id),
      target_node_id: nodeIdMap.get(conn.target_node_id),
      label: conn.label,
      connection_type: conn.connection_type,
      metadata: {
        order_priority: conn.order_priority,
        condition_expression: conn.condition_expression,
      },
    }));

  if (connectionsToInsert.length > 0) {
    await supabase.from("connections").insert(connectionsToInsert);
  }

  return {
    flow_id: flow.id,
    node_ids: insertedNodes.map(n => n.id),
  };
}
