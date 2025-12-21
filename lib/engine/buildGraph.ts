/**
 * Build Graph - Constrói o grafo a partir das SubRules
 * 
 * Este módulo é 100% determinístico (sem IA).
 * Transforma nós simbólicos em uma estrutura de grafo real.
 * 
 * v2.0: Agora usa flow_category para classificação de caminhos:
 * - main: linha principal (happy path) - y = base
 * - error: linha de erros - y = base + offset (abaixo)
 * - alternative: linha alternativa - y = base - offset (acima)
 */

import type { SubRuleNode, FlowCategory } from "../schemas/subrulesSchema";
import type { EngineNode, EngineEdge, EngineGraph, LayoutConfig } from "../schemas/engineGraphSchema";
import { DEFAULT_LAYOUT_CONFIG } from "../schemas/engineGraphSchema";

/**
 * Estrutura intermediária do grafo
 */
interface GraphBuilder {
  nodes: Map<string, EngineNode>;
  edges: EngineEdge[];
  nodeOrder: string[]; // Ordem BFS
}

/**
 * Constrói o grafo a partir das SubRules
 */
export function buildGraph(
  subrules: SubRuleNode[],
  config: Partial<LayoutConfig> = {}
): {
  nodes: EngineNode[];
  edges: EngineEdge[];
  nodeIdMap: Map<string, string>; // symbolic_id -> id
} {
  const layoutConfig = { ...DEFAULT_LAYOUT_CONFIG, ...config };
  const nodeIdMap = new Map<string, string>();
  
  // Criar mapa de nós para referência rápida
  const subruleMap = new Map(subrules.map((s) => [s.id, s]));
  
  // Encontrar o trigger (ponto de entrada)
  const trigger = subrules.find((s) => s.type === "trigger");
  if (!trigger) {
    throw new Error("GRAPH_BUILD_ERROR: Nenhum trigger encontrado nas subrules");
  }
  
  // Realizar BFS para determinar ordem e profundidade
  const bfsResult = performBFS(trigger.id, subruleMap);
  
  // Classificar nós por tipo de caminho (main, error, alternative)
  const classifiedNodes = classifyNodes(subrules, bfsResult);
  
  // Criar nós da engine com IDs únicos
  const engineNodes: EngineNode[] = [];
  let orderIndex = 1;
  
  for (const symbolicId of bfsResult.order) {
    const subrule = subruleMap.get(symbolicId);
    if (!subrule) continue;
    
    const nodeId = `node_${orderIndex}`;
    nodeIdMap.set(symbolicId, nodeId);
    
    const classification = classifiedNodes.get(symbolicId);
    const depth = bfsResult.depths.get(symbolicId) || 0;
    
    engineNodes.push({
      id: nodeId,
      symbolic_id: symbolicId,
      type: subrule.type,
      title: subrule.title,
      description: subrule.description,
      order_index: orderIndex,
      position_x: 0, // Será calculado depois
      position_y: 0, // Será calculado depois
      column: classification?.column || "main",
      depth,
      end_status: subrule.type === "end" ? subrule.end_status : undefined,
    });
    
    orderIndex++;
  }
  
  // Criar edges
  const edges = buildEdges(subrules, nodeIdMap);
  
  return {
    nodes: engineNodes,
    edges,
    nodeIdMap,
  };
}

/**
 * Realiza BFS a partir do trigger para determinar ordem e profundidade
 */
function performBFS(
  startId: string,
  subruleMap: Map<string, SubRuleNode>
): {
  order: string[];
  depths: Map<string, number>;
  parents: Map<string, string | null>;
} {
  const order: string[] = [];
  const depths = new Map<string, number>();
  const parents = new Map<string, string | null>();
  const visited = new Set<string>();
  
  const queue: { id: string; depth: number; parent: string | null }[] = [
    { id: startId, depth: 0, parent: null },
  ];
  
  while (queue.length > 0) {
    const { id, depth, parent } = queue.shift()!;
    
    if (visited.has(id)) continue;
    visited.add(id);
    
    order.push(id);
    depths.set(id, depth);
    parents.set(id, parent);
    
    const node = subruleMap.get(id);
    if (!node) continue;
    
    // Adicionar próximos nós à fila
    // Priorizar success path primeiro para manter happy path na linha principal
    if (node.next_on_success && !visited.has(node.next_on_success)) {
      queue.push({ id: node.next_on_success, depth: depth + 1, parent: id });
    }
    
    if (node.next_on_failure && !visited.has(node.next_on_failure)) {
      queue.push({ id: node.next_on_failure, depth: depth + 1, parent: id });
    }
  }
  
  // Adicionar nós não visitados (órfãos) ao final
  for (const [id] of subruleMap) {
    if (!visited.has(id)) {
      order.push(id);
      depths.set(id, depths.size); // Colocar no final
      parents.set(id, null);
    }
  }
  
  return { order, depths, parents };
}

/**
 * Classifica nós em main path, error path ou alternative path
 * 
 * v2.0: Agora respeita o flow_category definido pelo Subrules Decomposer
 * quando disponível. Caso contrário, infere a classificação.
 */
function classifyNodes(
  subrules: SubRuleNode[],
  bfsResult: { order: string[]; depths: Map<string, number>; parents: Map<string, string | null> }
): Map<string, { column: "main" | "error" | "alternative"; isErrorPath: boolean }> {
  const classifications = new Map<string, { column: "main" | "error" | "alternative"; isErrorPath: boolean }>();
  const subruleMap = new Map(subrules.map((s) => [s.id, s]));
  
  // Encontrar todos os nós que são destinos de failure
  const failureTargets = new Set<string>();
  for (const subrule of subrules) {
    if (subrule.next_on_failure) {
      failureTargets.add(subrule.next_on_failure);
    }
  }
  
  // Propagar classificação de erro
  const errorNodes = new Set<string>();
  
  // Primeiro, marcar nós que são diretamente targets de failure
  for (const target of failureTargets) {
    markErrorPath(target, subruleMap, errorNodes);
  }
  
  // Marcar ends de erro
  for (const subrule of subrules) {
    if (subrule.type === "end" && subrule.end_status === "error") {
      errorNodes.add(subrule.id);
    }
  }
  
  // Classificar todos os nós
  for (const subrule of subrules) {
    // v2.0: Priorizar flow_category do subrule se disponível
    const flowCategory = (subrule as SubRuleNode & { flow_category?: "main" | "error" | "alternative" }).flow_category;
    
    if (flowCategory) {
      // Usar classificação do Subrules Decomposer
      classifications.set(subrule.id, {
        column: flowCategory,
        isErrorPath: flowCategory === "error",
      });
    } else {
      // Inferir classificação (comportamento anterior)
      const isError = errorNodes.has(subrule.id);
      classifications.set(subrule.id, {
        column: isError ? "error" : "main",
        isErrorPath: isError,
      });
    }
  }
  
  return classifications;
}

/**
 * Marca recursivamente nós como parte do error path
 */
function markErrorPath(
  nodeId: string,
  subruleMap: Map<string, SubRuleNode>,
  errorNodes: Set<string>
): void {
  if (errorNodes.has(nodeId)) return;
  
  const node = subruleMap.get(nodeId);
  if (!node) return;
  
  // Marcar como error path apenas se termina em end error
  // ou se todos os caminhos levam a error
  if (node.type === "end" && node.end_status === "error") {
    errorNodes.add(nodeId);
    return;
  }
  
  // Se for um nó intermediário que só leva a error, marcar
  if (node.next_on_success) {
    const nextNode = subruleMap.get(node.next_on_success);
    if (nextNode?.type === "end" && nextNode.end_status === "error") {
      errorNodes.add(nodeId);
    }
  }
}

/**
 * Constrói as edges do grafo
 */
function buildEdges(
  subrules: SubRuleNode[],
  nodeIdMap: Map<string, string>
): EngineEdge[] {
  const edges: EngineEdge[] = [];
  let edgeIndex = 1;
  
  for (const subrule of subrules) {
    const sourceId = nodeIdMap.get(subrule.id);
    if (!sourceId) continue;
    
    // Edge de sucesso
    if (subrule.next_on_success) {
      const targetId = nodeIdMap.get(subrule.next_on_success);
      if (targetId) {
        edges.push({
          id: `edge_${edgeIndex++}`,
          source: sourceId,
          target: targetId,
          type: "success",
          label: subrule.type === "condition" ? "Sim" : undefined,
          animated: false,
        });
      }
    }
    
    // Edge de falha (apenas para conditions)
    if (subrule.next_on_failure) {
      const targetId = nodeIdMap.get(subrule.next_on_failure);
      if (targetId) {
        edges.push({
          id: `edge_${edgeIndex++}`,
          source: sourceId,
          target: targetId,
          type: "failure",
          label: "Não",
          animated: false,
          style: {
            stroke: "#ef4444", // Vermelho para error path
            strokeDasharray: "5,5",
          },
        });
      }
    }
  }
  
  return edges;
}

/**
 * Encontra nós não conectados (órfãos)
 */
export function findOrphanNodes(
  nodes: EngineNode[],
  edges: EngineEdge[]
): string[] {
  const connectedNodes = new Set<string>();
  
  // Trigger é sempre conectado (é o início)
  const trigger = nodes.find((n) => n.type === "trigger");
  if (trigger) {
    connectedNodes.add(trigger.id);
  }
  
  // Adicionar todos os nós que aparecem em edges
  for (const edge of edges) {
    connectedNodes.add(edge.source);
    connectedNodes.add(edge.target);
  }
  
  // Encontrar nós não conectados
  return nodes
    .filter((n) => !connectedNodes.has(n.id))
    .map((n) => n.id);
}

