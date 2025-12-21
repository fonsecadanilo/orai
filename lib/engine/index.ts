/**
 * Engine do Flow - 100% Código Determinístico
 * 
 * Este módulo transforma SubRules simbólicas em um grafo visual completo.
 * 
 * v2.0: Agora suporta flow_category para posicionamento e validação contra Journey
 * 
 * IMPORTANTE v3.1:
 * - Esta engine é para flows LEGADOS (criados pelo pipeline antigo)
 * - Flows v3.1 (source === "v3.1-pipeline") devem usar Flow Connector como dono do layout
 * - NÃO use esta engine para flows v3.1 - o Flow Connector já calcula layout e enriquece branches
 * 
 * Pipeline:
 * 1. buildGraph - Constrói estrutura de nós e edges (usa flow_category)
 * 2. assignOrderIndex - Atribui índices via BFS
 * 3. assignLayout - Calcula posições X/Y (baseado em flow_category)
 * 4. validateGraph - Valida estrutura final (com warnings da Journey)
 */

export { buildGraph, findOrphanNodes } from "./buildGraph";
export { assignOrderIndex, sortNodesByOrderIndex, validateOrderIndices } from "./assignOrderIndex";
export { assignLayout, adjustLayoutForOverlap } from "./assignLayout";
export { validateGraph, autoFixGraph, type GraphValidationResult, type ValidationIssue, type GraphStats } from "./validateGraph";

import type { SubRuleNode } from "../schemas/subrulesSchema";
import type { Journey } from "../schemas/journeySchema";
import type { EngineGraph, LayoutConfig } from "../schemas/engineGraphSchema";
import { DEFAULT_LAYOUT_CONFIG } from "../schemas/engineGraphSchema";
import { buildGraph } from "./buildGraph";
import { assignOrderIndex } from "./assignOrderIndex";
import { assignLayout, adjustLayoutForOverlap } from "./assignLayout";
import { validateGraph, autoFixGraph } from "./validateGraph";

/**
 * Pipeline completa: SubRules → EngineGraph
 * 
 * v2.0: Agora aceita Journey opcional para validação e warnings
 * 
 * Executa toda a transformação de forma determinística:
 * 1. Build graph structure (usa flow_category)
 * 2. Assign order indices
 * 3. Calculate layout (baseado em flow_category)
 * 4. Validate final structure (com warnings da Journey)
 */
export function processSubrulesToGraph(
  subrules: SubRuleNode[],
  options: {
    layoutConfig?: Partial<LayoutConfig>;
    autoFix?: boolean;
    journey?: Journey; // v2.0: Journey opcional para validação
  } = {}
): EngineGraph {
  const layoutConfig = { ...DEFAULT_LAYOUT_CONFIG, ...options.layoutConfig };
  
  // 1. Build graph from subrules (agora usa flow_category)
  const { nodes: builtNodes, edges, nodeIdMap } = buildGraph(subrules, layoutConfig);
  
  // 2. Assign order indices
  const orderedNodes = assignOrderIndex(builtNodes, edges);
  
  // 3. Calculate layout (agora posiciona baseado em flow_category)
  const { nodes: layoutNodes, layout } = assignLayout(orderedNodes, edges, layoutConfig);
  
  // 4. Adjust for overlap
  const finalNodes = adjustLayoutForOverlap(layoutNodes);
  
  // 5. Validate (agora com warnings da Journey se disponível)
  let validationResult = validateGraph(finalNodes, edges, options.journey);
  
  // 6. Auto-fix if enabled and there are errors
  let processedNodes = finalNodes;
  let processedEdges = edges;
  
  if (options.autoFix && !validationResult.isValid) {
    const fixed = autoFixGraph(finalNodes, edges);
    processedNodes = fixed.nodes;
    processedEdges = fixed.edges;
    
    // Re-validate after fix
    validationResult = validateGraph(processedNodes, processedEdges, options.journey);
    
    // Add fix info to warnings
    for (const fix of fixed.fixesApplied) {
      validationResult.warnings.push({
        code: "AUTO_FIX_APPLIED",
        message: fix,
      });
    }
  }
  
  // 7. Build final EngineGraph
  return {
    nodes: processedNodes,
    edges: processedEdges,
    layout,
    stats: {
      total_nodes: validationResult.stats.totalNodes,
      total_edges: validationResult.stats.totalEdges,
      triggers: validationResult.stats.triggers,
      actions: validationResult.stats.actions,
      conditions: validationResult.stats.conditions,
      ends_success: validationResult.stats.endsSuccess,
      ends_error: validationResult.stats.endsError,
      subflows: validationResult.stats.subflows,
      max_depth: validationResult.stats.maxDepth,
    },
    validation: {
      is_valid: validationResult.isValid,
      errors: validationResult.errors.map((e) => `${e.code}: ${e.message}`),
      warnings: validationResult.warnings.map((w) => `${w.code}: ${w.message}`),
      score: validationResult.score,
    },
  };
}

/**
 * Converte EngineGraph para formato do React Flow
 */
export function engineGraphToReactFlow(graph: EngineGraph): {
  nodes: Array<{
    id: string;
    type: string;
    position: { x: number; y: number };
    data: Record<string, unknown>;
  }>;
  edges: Array<{
    id: string;
    source: string;
    target: string;
    label?: string;
    animated?: boolean;
    style?: Record<string, unknown>;
  }>;
} {
  const nodes = graph.nodes.map((node) => ({
    id: node.id,
    type: node.type,
    position: {
      x: node.position_x,
      y: node.position_y,
    },
    data: {
      label: node.title,
      title: node.title,
      description: node.description,
      order_index: node.order_index,
      column: node.column,
      status: node.end_status,
    },
  }));
  
  const edges = graph.edges.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    label: edge.label,
    animated: edge.animated,
    style: edge.style,
  }));
  
  return { nodes, edges };
}

