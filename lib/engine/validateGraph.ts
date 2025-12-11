/**
 * Validate Graph - Validação final do grafo
 * 
 * Este módulo é 100% determinístico (sem IA).
 * Valida a estrutura final do grafo antes de salvar.
 * 
 * v2.0: Novas validações baseadas na jornada:
 * - Se existirem falhas na jornada mas não existir um nó de erro correspondente → avisar
 * - Se existirem decisões na jornada mas não existir condition no subrules → avisar
 * - Se houver abandono descrito na jornada mas não existir um "end cancel" → avisar
 */

import type { EngineNode, EngineEdge, EngineGraph } from "../schemas/engineGraphSchema";
import type { Journey } from "../schemas/journeySchema";

/**
 * Resultado da validação do grafo
 */
export interface GraphValidationResult {
  isValid: boolean;
  score: number; // 0-100
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  stats: GraphStats;
}

/**
 * Issue de validação
 */
export interface ValidationIssue {
  code: string;
  message: string;
  nodeId?: string;
  suggestion?: string;
}

/**
 * Estatísticas do grafo
 */
export interface GraphStats {
  totalNodes: number;
  totalEdges: number;
  triggers: number;
  actions: number;
  conditions: number;
  subflows: number;
  endsSuccess: number;
  endsError: number;
  maxDepth: number;
  orphanNodes: number;
  disconnectedNodes: number;
}

/**
 * Valida o grafo completo
 * 
 * v2.0: Agora aceita opcionalmente a Journey para validações adicionais
 */
export function validateGraph(
  nodes: EngineNode[],
  edges: EngineEdge[],
  journey?: Journey
): GraphValidationResult {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];
  
  // Calcular estatísticas
  const stats = calculateStats(nodes, edges);
  
  // 1. Validar triggers
  validateTriggers(nodes, errors);
  
  // 2. Validar ends
  validateEnds(nodes, errors, warnings);
  
  // 3. Validar conditions
  validateConditions(nodes, edges, errors);
  
  // 4. Validar conectividade
  validateConnectivity(nodes, edges, errors, warnings);
  
  // 5. Validar navegabilidade
  validateNavigability(nodes, edges, errors);
  
  // 6. v2.0: Validar contra jornada (se disponível)
  if (journey) {
    validateAgainstJourney(nodes, edges, journey, warnings);
  }
  
  // Calcular score
  const score = calculateScore(errors, warnings, stats);
  
  return {
    isValid: errors.length === 0,
    score,
    errors,
    warnings,
    stats,
  };
}

/**
 * v2.0: Valida o grafo contra a jornada do usuário
 * Gera warnings (não erros) para inconsistências
 */
function validateAgainstJourney(
  nodes: EngineNode[],
  edges: EngineEdge[],
  journey: Journey,
  warnings: ValidationIssue[]
): void {
  // Contagens do grafo
  const conditions = nodes.filter((n) => n.type === "condition");
  const errorEnds = nodes.filter((n) => n.type === "end" && n.end_status === "error");
  
  // 1. Se existirem falhas na jornada mas não existir um nó de erro correspondente
  if (journey.failure_points && journey.failure_points.length > 0) {
    if (errorEnds.length === 0) {
      warnings.push({
        code: "JOURNEY_FAILURES_NO_ERROR_END",
        message: `A jornada define ${journey.failure_points.length} ponto(s) de falha, mas não existe nenhum End de erro no fluxo`,
        suggestion: "Adicione nós End com status 'error' para representar as falhas da jornada",
      });
    } else if (errorEnds.length < journey.failure_points.length) {
      warnings.push({
        code: "JOURNEY_FAILURES_FEW_ERROR_ENDS",
        message: `A jornada define ${journey.failure_points.length} ponto(s) de falha, mas só existem ${errorEnds.length} End(s) de erro`,
        suggestion: "Considere adicionar mais nós End de erro para cobrir todas as falhas",
      });
    }
  }
  
  // 2. Se existirem decisões na jornada mas não existir condition no subrules
  if (journey.decisions && journey.decisions.length > 0) {
    if (conditions.length === 0) {
      warnings.push({
        code: "JOURNEY_DECISIONS_NO_CONDITIONS",
        message: `A jornada define ${journey.decisions.length} decisão(ões), mas não existe nenhuma Condition no fluxo`,
        suggestion: "Adicione nós Condition para representar os pontos de decisão da jornada",
      });
    } else if (conditions.length < journey.decisions.length) {
      warnings.push({
        code: "JOURNEY_DECISIONS_FEW_CONDITIONS",
        message: `A jornada define ${journey.decisions.length} decisão(ões), mas só existem ${conditions.length} Condition(s)`,
        suggestion: "Considere adicionar mais nós Condition para cobrir todas as decisões",
      });
    }
  }
  
  // 3. Verificar se há muitos passos na jornada vs. nós no fluxo
  if (journey.steps && journey.steps.length > 0) {
    const actionNodes = nodes.filter((n) => n.type === "action" || n.type === "trigger");
    
    // Se a jornada tem muito mais passos que nós de ação, pode estar faltando granularidade
    if (journey.steps.length > actionNodes.length * 2) {
      warnings.push({
        code: "JOURNEY_STEPS_FEW_ACTIONS",
        message: `A jornada tem ${journey.steps.length} etapas, mas o fluxo só tem ${actionNodes.length} nós de ação`,
        suggestion: "O fluxo pode estar muito simplificado em relação à jornada",
      });
    }
  }
}

/**
 * Valida triggers
 */
function validateTriggers(nodes: EngineNode[], errors: ValidationIssue[]): void {
  const triggers = nodes.filter((n) => n.type === "trigger");
  
  if (triggers.length === 0) {
    errors.push({
      code: "NO_TRIGGER",
      message: "O fluxo não possui um Trigger (ponto de entrada)",
      suggestion: "Adicione um nó do tipo Trigger no início do fluxo",
    });
  } else if (triggers.length > 1) {
    errors.push({
      code: "MULTIPLE_TRIGGERS",
      message: `O fluxo possui ${triggers.length} Triggers. Deve ter apenas 1`,
      nodeId: triggers[1].id,
      suggestion: "Remova os Triggers extras",
    });
  }
}

/**
 * Valida ends
 */
function validateEnds(
  nodes: EngineNode[],
  errors: ValidationIssue[],
  warnings: ValidationIssue[]
): void {
  const endNodes = nodes.filter((n) => n.type === "end");
  const successEnds = endNodes.filter((n) => n.end_status === "success");
  const errorEnds = endNodes.filter((n) => n.end_status === "error");
  
  if (endNodes.length === 0) {
    errors.push({
      code: "NO_END",
      message: "O fluxo não possui nenhum nó End (término)",
      suggestion: "Adicione pelo menos um nó End de sucesso",
    });
  } else if (successEnds.length === 0) {
    errors.push({
      code: "NO_SUCCESS_END",
      message: "O fluxo não possui End de sucesso",
      suggestion: "Adicione um nó End com status='success'",
    });
  } else if (successEnds.length > 1) {
    warnings.push({
      code: "MULTIPLE_SUCCESS_ENDS",
      message: `O fluxo possui ${successEnds.length} End de sucesso`,
      nodeId: successEnds[1].id,
      suggestion: "Considere unificar os caminhos de sucesso",
    });
  }
  
  if (errorEnds.length > 0) {
    // Info sobre ends de erro (não é erro, apenas info)
    warnings.push({
      code: "ERROR_ENDS_COUNT",
      message: `O fluxo possui ${errorEnds.length} End(s) de erro`,
    });
  }
}

/**
 * Valida conditions
 */
function validateConditions(
  nodes: EngineNode[],
  edges: EngineEdge[],
  errors: ValidationIssue[]
): void {
  const conditions = nodes.filter((n) => n.type === "condition");
  
  for (const condition of conditions) {
    const outgoing = edges.filter((e) => e.source === condition.id);
    
    const hasSuccess = outgoing.some((e) => e.type === "success" || e.label === "Sim");
    const hasFailure = outgoing.some((e) => e.type === "failure" || e.label === "Não");
    
    if (outgoing.length === 0) {
      errors.push({
        code: "CONDITION_NO_OUTPUTS",
        message: `Condition "${condition.title}" não tem nenhuma saída`,
        nodeId: condition.id,
        suggestion: "Adicione conexões 'Sim' e 'Não' para esta condição",
      });
    } else if (!hasSuccess) {
      errors.push({
        code: "CONDITION_NO_SUCCESS",
        message: `Condition "${condition.title}" não tem saída 'Sim'`,
        nodeId: condition.id,
        suggestion: "Adicione uma conexão de sucesso",
      });
    } else if (!hasFailure) {
      errors.push({
        code: "CONDITION_NO_FAILURE",
        message: `Condition "${condition.title}" não tem saída 'Não'`,
        nodeId: condition.id,
        suggestion: "Adicione uma conexão de falha",
      });
    }
  }
}

/**
 * Valida conectividade
 * 
 * 🔧 CORREÇÃO: Validação mais rigorosa para garantir que edges existem
 */
function validateConnectivity(
  nodes: EngineNode[],
  edges: EngineEdge[],
  errors: ValidationIssue[],
  warnings: ValidationIssue[]
): void {
  // 🔧 CRÍTICO: Se há múltiplos nós mas nenhuma edge, é um erro grave
  if (nodes.length > 1 && edges.length === 0) {
    errors.push({
      code: "NO_CONNECTIONS",
      message: "O fluxo tem múltiplos nós mas nenhuma conexão",
      suggestion: "Verifique se as referências next_on_success/next_on_failure estão corretas",
    });
    return; // Não precisa verificar mais nada
  }
  
  const nodeIds = new Set(nodes.map((n) => n.id));
  const nodesWithInput = new Set<string>();
  const nodesWithOutput = new Set<string>();
  
  for (const edge of edges) {
    nodesWithOutput.add(edge.source);
    nodesWithInput.add(edge.target);
  }
  
  // Verificar nós sem entrada (exceto trigger)
  for (const node of nodes) {
    if (node.type === "trigger") continue;
    
    if (!nodesWithInput.has(node.id)) {
      errors.push({
        code: "ORPHAN_NODE",
        message: `Nó "${node.title}" não tem conexão de entrada`,
        nodeId: node.id,
        suggestion: "Conecte este nó a partir de outro nó",
      });
    }
  }
  
  // Verificar nós sem saída (exceto end)
  for (const node of nodes) {
    if (node.type === "end") continue;
    
    if (!nodesWithOutput.has(node.id)) {
      errors.push({
        code: "DISCONNECTED_NODE",
        message: `Nó "${node.title}" não tem conexão de saída`,
        nodeId: node.id,
        suggestion: "Conecte este nó ao próximo passo",
      });
    }
  }
}

/**
 * Valida navegabilidade (caminho do trigger ao end)
 */
function validateNavigability(
  nodes: EngineNode[],
  edges: EngineEdge[],
  errors: ValidationIssue[]
): void {
  const triggers = nodes.filter((n) => n.type === "trigger");
  const successEnds = nodes.filter((n) => n.type === "end" && n.end_status === "success");
  
  if (triggers.length === 0 || successEnds.length === 0) {
    return; // Já reportado em outras validações
  }
  
  const trigger = triggers[0];
  const reachable = getReachableNodes(trigger.id, edges);
  
  // Verificar se algum end de sucesso é alcançável
  const reachableSuccessEnd = successEnds.find((end) => reachable.has(end.id));
  
  if (!reachableSuccessEnd) {
    errors.push({
      code: "UNREACHABLE_SUCCESS_END",
      message: "Nenhum End de sucesso é alcançável a partir do Trigger",
      suggestion: "Verifique as conexões para garantir um caminho completo",
    });
  }
  
  // Verificar nós não alcançáveis
  const unreachableNodes = nodes.filter(
    (n) => n.type !== "trigger" && !reachable.has(n.id)
  );
  
  for (const node of unreachableNodes) {
    errors.push({
      code: "UNREACHABLE_NODE",
      message: `Nó "${node.title}" não é alcançável a partir do Trigger`,
      nodeId: node.id,
      suggestion: "Este nó está isolado do fluxo principal",
    });
  }
}

/**
 * Encontra todos os nós alcançáveis a partir de um nó inicial
 */
function getReachableNodes(startId: string, edges: EngineEdge[]): Set<string> {
  const reachable = new Set<string>();
  const queue = [startId];
  
  // Construir mapa de adjacência
  const adjacency = new Map<string, string[]>();
  for (const edge of edges) {
    const neighbors = adjacency.get(edge.source) || [];
    neighbors.push(edge.target);
    adjacency.set(edge.source, neighbors);
  }
  
  while (queue.length > 0) {
    const current = queue.shift()!;
    if (reachable.has(current)) continue;
    
    reachable.add(current);
    
    const neighbors = adjacency.get(current) || [];
    for (const neighbor of neighbors) {
      if (!reachable.has(neighbor)) {
        queue.push(neighbor);
      }
    }
  }
  
  return reachable;
}

/**
 * Calcula estatísticas do grafo
 */
function calculateStats(nodes: EngineNode[], edges: EngineEdge[]): GraphStats {
  const nodeIds = new Set(nodes.map((n) => n.id));
  
  // Encontrar nós sem entrada/saída
  const nodesWithInput = new Set<string>();
  const nodesWithOutput = new Set<string>();
  
  for (const edge of edges) {
    nodesWithOutput.add(edge.source);
    nodesWithInput.add(edge.target);
  }
  
  const orphanNodes = nodes.filter(
    (n) => n.type !== "trigger" && !nodesWithInput.has(n.id)
  ).length;
  
  const disconnectedNodes = nodes.filter(
    (n) => n.type !== "end" && !nodesWithOutput.has(n.id)
  ).length;
  
  // Calcular profundidade máxima
  const maxDepth = nodes.length > 0
    ? Math.max(...nodes.map((n) => n.depth))
    : 0;
  
  return {
    totalNodes: nodes.length,
    totalEdges: edges.length,
    triggers: nodes.filter((n) => n.type === "trigger").length,
    actions: nodes.filter((n) => n.type === "action").length,
    conditions: nodes.filter((n) => n.type === "condition").length,
    subflows: nodes.filter((n) => n.type === "subflow").length,
    endsSuccess: nodes.filter((n) => n.type === "end" && n.end_status === "success").length,
    endsError: nodes.filter((n) => n.type === "end" && n.end_status === "error").length,
    maxDepth,
    orphanNodes,
    disconnectedNodes,
  };
}

/**
 * Calcula score de validação
 * 
 * 🔧 CORREÇÃO: Score mais rigoroso para problemas de conectividade
 */
function calculateScore(
  errors: ValidationIssue[],
  warnings: ValidationIssue[],
  stats: GraphStats
): number {
  let score = 100;
  
  // 🔧 CRÍTICO: Se não há edges mas há múltiplos nós, score é 0
  if (stats.totalEdges === 0 && stats.totalNodes > 1) {
    return 0;
  }
  
  // Penalidades por erros (mais severo)
  score -= errors.length * 20;
  
  // Penalidades por warnings
  score -= warnings.length * 5;
  
  // Penalidade por nós órfãos ou desconectados (mais severo)
  score -= stats.orphanNodes * 15;
  score -= stats.disconnectedNodes * 15;
  
  // Bônus por boas práticas
  if (stats.triggers === 1) score += 5;
  if (stats.endsSuccess === 1) score += 5;
  if (stats.conditions > 0) score += 3;
  if (stats.orphanNodes === 0) score += 5;
  if (stats.disconnectedNodes === 0) score += 5;
  
  return Math.max(0, Math.min(100, score));
}

/**
 * Auto-correção básica do grafo
 */
export function autoFixGraph(
  nodes: EngineNode[],
  edges: EngineEdge[]
): {
  nodes: EngineNode[];
  edges: EngineEdge[];
  fixesApplied: string[];
} {
  const fixedNodes = [...nodes];
  const fixedEdges = [...edges];
  const fixesApplied: string[] = [];
  
  // 1. Adicionar trigger se não existir
  const triggers = fixedNodes.filter((n) => n.type === "trigger");
  if (triggers.length === 0 && fixedNodes.length > 0) {
    const minX = Math.min(...fixedNodes.map((n) => n.position_x));
    fixedNodes.unshift({
      id: `trigger_auto_${Date.now()}`,
      symbolic_id: "trigger_auto",
      type: "trigger",
      title: "Início do Fluxo",
      description: "Ponto de entrada (adicionado automaticamente)",
      order_index: 0,
      position_x: minX - 280,
      position_y: 300,
      column: "main",
      depth: 0,
    });
    fixesApplied.push("Adicionado Trigger no início");
  }
  
  // 2. Adicionar end de sucesso se não existir
  const successEnds = fixedNodes.filter((n) => n.type === "end" && n.end_status === "success");
  if (successEnds.length === 0) {
    const maxX = Math.max(...fixedNodes.map((n) => n.position_x), 400);
    const maxOrder = Math.max(...fixedNodes.map((n) => n.order_index), 0);
    fixedNodes.push({
      id: `end_success_auto_${Date.now()}`,
      symbolic_id: "end_success_auto",
      type: "end",
      title: "Fluxo Concluído",
      description: "Término bem-sucedido (adicionado automaticamente)",
      order_index: maxOrder + 1,
      position_x: maxX + 280,
      position_y: 300,
      column: "main",
      depth: Math.max(...fixedNodes.map((n) => n.depth), 0) + 1,
      end_status: "success",
    });
    fixesApplied.push("Adicionado End de sucesso no final");
  }
  
  // Reindexar order_index
  fixedNodes.forEach((node, idx) => {
    node.order_index = idx + 1;
  });
  
  return {
    nodes: fixedNodes,
    edges: fixedEdges,
    fixesApplied,
  };
}

