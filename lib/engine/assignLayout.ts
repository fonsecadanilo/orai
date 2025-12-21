/**
 * Assign Layout - Calcula posições X/Y para cada nó
 * 
 * Este módulo é 100% determinístico (sem IA).
 * Posiciona os nós em um layout horizontal da esquerda para a direita.
 * 
 * v2.0: Agora usa flow_category para posicionamento Y:
 * - main (happy path): y = startY (linha central)
 * - error: y = startY + errorPathYOffset (abaixo)
 * - alternative: y = startY + alternativePathYOffset (acima, valor negativo)
 * 
 * Convenções de posição X:
 * - Trigger: x = startX
 * - BFS depth * nodeSpacingX = x adicional
 */

import type { EngineNode, EngineEdge, LayoutConfig, LayoutInfo } from "../schemas/engineGraphSchema";
import { DEFAULT_LAYOUT_CONFIG } from "../schemas/engineGraphSchema";

/**
 * Atribui posições X e Y a todos os nós
 */
export function assignLayout(
  nodes: EngineNode[],
  edges: EngineEdge[],
  config: Partial<LayoutConfig> = {}
): {
  nodes: EngineNode[];
  layout: LayoutInfo;
} {
  const layoutConfig: LayoutConfig = { ...DEFAULT_LAYOUT_CONFIG, ...config };
  
  // Calcular profundidade de cada nó via BFS
  const depths = calculateDepths(nodes, edges);
  
  // Calcular posições Y baseado no tipo de caminho
  const yPositions = calculateYPositions(nodes, edges, layoutConfig);
  
  // Atribuir posições
  const positionedNodes = nodes.map((node) => {
    const depth = depths.get(node.id) || 0;
    const yPos = yPositions.get(node.id) || layoutConfig.startY;
    
    return {
      ...node,
      position_x: layoutConfig.startX + depth * layoutConfig.nodeSpacingX,
      position_y: yPos,
      depth,
    };
  });
  
  // Calcular informações de layout
  const layoutInfo = calculateLayoutInfo(positionedNodes, layoutConfig);
  
  return {
    nodes: positionedNodes,
    layout: layoutInfo,
  };
}

/**
 * Calcula a profundidade de cada nó usando BFS
 */
function calculateDepths(
  nodes: EngineNode[],
  edges: EngineEdge[]
): Map<string, number> {
  const depths = new Map<string, number>();
  
  // Encontrar trigger
  const trigger = nodes.find((n) => n.type === "trigger");
  if (!trigger) {
    // Fallback: usar order_index como profundidade
    nodes.forEach((node, idx) => depths.set(node.id, idx));
    return depths;
  }
  
  // Criar mapa de adjacência
  const adjacency = new Map<string, string[]>();
  for (const edge of edges) {
    const neighbors = adjacency.get(edge.source) || [];
    neighbors.push(edge.target);
    adjacency.set(edge.source, neighbors);
  }
  
  // BFS para calcular profundidades
  const queue: { id: string; depth: number }[] = [{ id: trigger.id, depth: 0 }];
  const visited = new Set<string>();
  
  while (queue.length > 0) {
    const { id, depth } = queue.shift()!;
    
    if (visited.has(id)) continue;
    visited.add(id);
    depths.set(id, depth);
    
    const neighbors = adjacency.get(id) || [];
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        queue.push({ id: neighbor, depth: depth + 1 });
      }
    }
  }
  
  // Nós não visitados recebem profundidade baseada no order_index
  for (const node of nodes) {
    if (!depths.has(node.id)) {
      depths.set(node.id, node.order_index);
    }
  }
  
  return depths;
}

/**
 * Calcula posições Y baseado no tipo de caminho (flow_category/column)
 * 
 * v2.0: Agora usa o campo column do EngineNode que reflete o flow_category
 * definido pelo Subrules Decomposer.
 */
function calculateYPositions(
  nodes: EngineNode[],
  edges: EngineEdge[],
  config: LayoutConfig
): Map<string, number> {
  const yPositions = new Map<string, number>();
  
  // Identificar nós que são destino de failure edges (fallback se column não definido)
  const failureTargets = new Set<string>();
  for (const edge of edges) {
    if (edge.type === "failure") {
      failureTargets.add(edge.target);
    }
  }
  
  // Identificar caminhos de erro (fallback)
  const errorPathNodes = identifyErrorPathNodes(nodes, edges, failureTargets);
  
  // Agrupar nós por profundidade para evitar sobreposição
  const nodesByDepth = new Map<number, EngineNode[]>();
  for (const node of nodes) {
    const depth = node.depth;
    const nodesAtDepth = nodesByDepth.get(depth) || [];
    nodesAtDepth.push(node);
    nodesByDepth.set(depth, nodesAtDepth);
  }
  
  // Calcular posições Y baseado em flow_category/column
  for (const [depth, nodesAtDepth] of nodesByDepth) {
    // Separar nós por column (flow_category)
    const mainNodes = nodesAtDepth.filter((n) => n.column === "main" || (!n.column && !errorPathNodes.has(n.id)));
    const errorNodes = nodesAtDepth.filter((n) => n.column === "error" || (!n.column && errorPathNodes.has(n.id)));
    const alternativeNodes = nodesAtDepth.filter((n) => n.column === "alternative");
    
    // Posicionar nós main na linha central (y = startY)
    let mainY = config.startY;
    for (let i = 0; i < mainNodes.length; i++) {
      yPositions.set(mainNodes[i].id, mainY);
      if (i < mainNodes.length - 1) {
        mainY += config.nodeSpacingY / 2; // Menor espaçamento dentro do mesmo nível
      }
    }
    
    // Posicionar nós error abaixo (y = startY + errorPathYOffset)
    let errorY = config.startY + config.errorPathYOffset;
    for (let i = 0; i < errorNodes.length; i++) {
      yPositions.set(errorNodes[i].id, errorY);
      if (i < errorNodes.length - 1) {
        errorY += config.nodeSpacingY / 2;
      }
    }
    
    // Posicionar nós alternative acima (y = startY + alternativePathYOffset, que é negativo)
    let alternativeY = config.startY + config.alternativePathYOffset;
    for (let i = 0; i < alternativeNodes.length; i++) {
      yPositions.set(alternativeNodes[i].id, alternativeY);
      if (i < alternativeNodes.length - 1) {
        alternativeY -= config.nodeSpacingY / 2; // Subir mais para cima
      }
    }
  }
  
  return yPositions;
}

/**
 * Identifica nós que fazem parte de caminhos de erro
 */
function identifyErrorPathNodes(
  nodes: EngineNode[],
  edges: EngineEdge[],
  failureTargets: Set<string>
): Set<string> {
  const errorPathNodes = new Set<string>();
  
  // Criar mapa de adjacência
  const adjacency = new Map<string, string[]>();
  for (const edge of edges) {
    const neighbors = adjacency.get(edge.source) || [];
    neighbors.push(edge.target);
    adjacency.set(edge.source, neighbors);
  }
  
  // DFS a partir de cada failure target
  function markErrorPath(nodeId: string): void {
    if (errorPathNodes.has(nodeId)) return;
    
    errorPathNodes.add(nodeId);
    
    const neighbors = adjacency.get(nodeId) || [];
    for (const neighbor of neighbors) {
      // Apenas marcar como error se não for um nó que faz parte do main path
      const neighborNode = nodes.find((n) => n.id === neighbor);
      if (neighborNode && neighborNode.type === "end" && neighborNode.end_status === "error") {
        markErrorPath(neighbor);
      } else if (neighborNode && !neighborNode.column?.includes("main")) {
        markErrorPath(neighbor);
      }
    }
  }
  
  for (const target of failureTargets) {
    markErrorPath(target);
  }
  
  // Também marcar ends de erro
  for (const node of nodes) {
    if (node.type === "end" && node.end_status === "error") {
      errorPathNodes.add(node.id);
    }
  }
  
  return errorPathNodes;
}

/**
 * Calcula informações gerais do layout
 */
function calculateLayoutInfo(
  nodes: EngineNode[],
  config: LayoutConfig
): LayoutInfo {
  if (nodes.length === 0) {
    return {
      width: 800,
      height: 600,
      center_x: 400,
      center_y: 300,
      config: {
        node_spacing_x: config.nodeSpacingX,
        node_spacing_y: config.nodeSpacingY,
        start_x: config.startX,
        start_y: config.startY,
        orientation: config.orientation,
      },
    };
  }
  
  const minX = Math.min(...nodes.map((n) => n.position_x));
  const maxX = Math.max(...nodes.map((n) => n.position_x));
  const minY = Math.min(...nodes.map((n) => n.position_y));
  const maxY = Math.max(...nodes.map((n) => n.position_y));
  
  const width = maxX - minX + 400; // Padding
  const height = maxY - minY + 300; // Padding
  
  return {
    width,
    height,
    center_x: (minX + maxX) / 2,
    center_y: (minY + maxY) / 2,
    config: {
      node_spacing_x: config.nodeSpacingX,
      node_spacing_y: config.nodeSpacingY,
      start_x: config.startX,
      start_y: config.startY,
      orientation: config.orientation,
    },
  };
}

/**
 * Ajusta layout para evitar sobreposição
 */
export function adjustLayoutForOverlap(
  nodes: EngineNode[],
  minDistance: number = 150
): EngineNode[] {
  const adjusted = [...nodes];
  
  // Agrupar por posição X aproximada
  const groups = new Map<number, EngineNode[]>();
  for (const node of adjusted) {
    const xGroup = Math.round(node.position_x / 50) * 50;
    const group = groups.get(xGroup) || [];
    group.push(node);
    groups.set(xGroup, group);
  }
  
  // Ajustar Y dentro de cada grupo
  for (const [, group] of groups) {
    if (group.length <= 1) continue;
    
    // Ordenar por Y atual
    group.sort((a, b) => a.position_y - b.position_y);
    
    // Verificar sobreposição e ajustar
    for (let i = 1; i < group.length; i++) {
      const prev = group[i - 1];
      const curr = group[i];
      
      if (curr.position_y - prev.position_y < minDistance) {
        curr.position_y = prev.position_y + minDistance;
      }
    }
  }
  
  return adjusted;
}

