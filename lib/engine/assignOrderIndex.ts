/**
 * Assign Order Index - Atribui índices de ordem via BFS
 * 
 * Este módulo é 100% determinístico (sem IA).
 * Atribui order_index a cada nó baseado em BFS a partir do trigger.
 */

import type { EngineNode, EngineEdge } from "../schemas/engineGraphSchema";

/**
 * Atribui order_index a todos os nós usando BFS
 * 
 * Regras:
 * - Trigger sempre recebe índice 1
 * - BFS a partir do trigger
 * - Caminhos de sucesso são processados antes de caminhos de falha
 */
export function assignOrderIndex(
  nodes: EngineNode[],
  edges: EngineEdge[]
): EngineNode[] {
  // Criar mapa de adjacência
  const adjacency = buildAdjacencyMap(edges);
  
  // Encontrar o trigger
  const trigger = nodes.find((n) => n.type === "trigger");
  if (!trigger) {
    // Se não há trigger, apenas retornar com índices sequenciais
    return nodes.map((node, idx) => ({
      ...node,
      order_index: idx + 1,
    }));
  }
  
  // BFS para determinar ordem
  const order = performBFSOrder(trigger.id, adjacency, edges);
  
  // Criar mapa de índices
  const orderMap = new Map<string, number>();
  order.forEach((id, idx) => orderMap.set(id, idx + 1));
  
  // Adicionar nós não visitados ao final
  let nextIndex = order.length + 1;
  for (const node of nodes) {
    if (!orderMap.has(node.id)) {
      orderMap.set(node.id, nextIndex++);
    }
  }
  
  // Atribuir índices
  return nodes.map((node) => ({
    ...node,
    order_index: orderMap.get(node.id) || node.order_index,
  }));
}

/**
 * Constrói mapa de adjacência a partir das edges
 */
function buildAdjacencyMap(edges: EngineEdge[]): Map<string, { success?: string; failure?: string }> {
  const adjacency = new Map<string, { success?: string; failure?: string }>();
  
  for (const edge of edges) {
    const current = adjacency.get(edge.source) || {};
    
    if (edge.type === "failure") {
      current.failure = edge.target;
    } else {
      current.success = edge.target;
    }
    
    adjacency.set(edge.source, current);
  }
  
  return adjacency;
}

/**
 * Realiza BFS priorizando caminhos de sucesso
 */
function performBFSOrder(
  startId: string,
  adjacency: Map<string, { success?: string; failure?: string }>,
  edges: EngineEdge[]
): string[] {
  const order: string[] = [];
  const visited = new Set<string>();
  const queue: string[] = [startId];
  
  while (queue.length > 0) {
    const currentId = queue.shift()!;
    
    if (visited.has(currentId)) continue;
    visited.add(currentId);
    order.push(currentId);
    
    const neighbors = adjacency.get(currentId);
    if (!neighbors) continue;
    
    // Priorizar caminho de sucesso
    if (neighbors.success && !visited.has(neighbors.success)) {
      queue.push(neighbors.success);
    }
    
    // Depois caminho de falha
    if (neighbors.failure && !visited.has(neighbors.failure)) {
      queue.push(neighbors.failure);
    }
  }
  
  return order;
}

/**
 * Reordena nós por order_index
 */
export function sortNodesByOrderIndex(nodes: EngineNode[]): EngineNode[] {
  return [...nodes].sort((a, b) => a.order_index - b.order_index);
}

/**
 * Valida que todos os nós têm order_index único
 */
export function validateOrderIndices(nodes: EngineNode[]): {
  isValid: boolean;
  duplicates: number[];
  missing: number[];
} {
  const indices = new Set<number>();
  const duplicates: number[] = [];
  
  for (const node of nodes) {
    if (indices.has(node.order_index)) {
      duplicates.push(node.order_index);
    }
    indices.add(node.order_index);
  }
  
  // Verificar se há lacunas
  const missing: number[] = [];
  const maxIndex = Math.max(...Array.from(indices));
  for (let i = 1; i <= maxIndex; i++) {
    if (!indices.has(i)) {
      missing.push(i);
    }
  }
  
  return {
    isValid: duplicates.length === 0,
    duplicates,
    missing,
  };
}














