/**
 * Validador de Estrutura de User Flow
 * 
 * Garante que os fluxos gerados seguem a gramática correta:
 * - Exatamente 1 Trigger
 * - Exatamente 1 End de sucesso
 * - Toda Action tem saída
 * - Toda Condition tem SIM e NÃO
 * - Nenhum nó flutuante
 * - Fluxo navegável do início ao fim
 */

import type { FlowNode, FlowConnection } from "./types";

// ========================================
// TIPOS DE VALIDAÇÃO
// ========================================

export type ValidationSeverity = "error" | "warning" | "info";

export interface ValidationIssue {
  code: string;
  message: string;
  severity: ValidationSeverity;
  nodeId?: string;
  suggestion?: string;
}

export interface ValidationResult {
  isValid: boolean;
  score: number; // 0-100
  issues: ValidationIssue[];
  stats: FlowStats;
}

export interface FlowStats {
  totalNodes: number;
  triggers: number;
  actions: number;
  conditions: number;
  subflows: number;
  fieldGroups: number;
  endSuccess: number;
  endError: number;
  textNodes: number;
  totalConnections: number;
  disconnectedNodes: number;
  orphanNodes: number;
}

// ========================================
// GRAMÁTICA DO USER FLOW
// ========================================

/**
 * Tipos de saída válidos para cada tipo de nó
 */
const VALID_OUTPUTS: Record<string, string[]> = {
  trigger: ["action", "condition", "field_group", "subflow"],
  action: ["action", "condition", "end", "subflow"],
  condition: ["action", "condition", "subflow", "end"], // Ambos SIM e NÃO
  field_group: ["condition", "action", "subflow"],
  subflow: ["action", "condition", "end"],
  end: [], // Terminal
  text: [], // Pode conectar a qualquer nó (conexão visual)
};

/**
 * Tipos de entrada válidos para cada tipo de nó
 */
const VALID_INPUTS: Record<string, string[]> = {
  trigger: [], // Não tem entrada
  action: ["trigger", "action", "condition", "field_group", "subflow"],
  condition: ["trigger", "action", "field_group", "subflow"],
  field_group: ["trigger", "action", "condition", "subflow"],
  subflow: ["trigger", "action", "condition", "field_group"],
  end: ["action", "condition", "subflow"],
  text: [], // Não tem entrada formal
};

// ========================================
// FUNÇÃO PRINCIPAL DE VALIDAÇÃO
// ========================================

export function validateFlow(
  nodes: FlowNode[],
  connections: FlowConnection[]
): ValidationResult {
  const issues: ValidationIssue[] = [];
  
  // Calcular estatísticas
  const stats = calculateStats(nodes, connections);
  
  // 1. Validar Triggers
  validateTriggers(nodes, issues);
  
  // 2. Validar End nodes
  validateEnds(nodes, issues);
  
  // 3. Validar Conditions (2 saídas)
  validateConditions(nodes, connections, issues);
  
  // 4. Validar conexões de Actions
  validateActions(nodes, connections, issues);
  
  // 5. Validar nós flutuantes (sem entrada)
  validateOrphanNodes(nodes, connections, issues);
  
  // 6. Validar nós desconectados (sem saída, exceto End)
  validateDisconnectedNodes(nodes, connections, issues);
  
  // 7. Validar navegabilidade do fluxo
  validateFlowNavigation(nodes, connections, issues);
  
  // 8. Validar Subflows
  validateSubflows(nodes, connections, issues);
  
  // Calcular score
  const score = calculateScore(issues, stats);
  
  // Determinar se é válido (sem erros críticos)
  const hasErrors = issues.some(i => i.severity === "error");
  
  return {
    isValid: !hasErrors,
    score,
    issues,
    stats,
  };
}

// ========================================
// FUNÇÕES DE VALIDAÇÃO ESPECÍFICAS
// ========================================

function validateTriggers(nodes: FlowNode[], issues: ValidationIssue[]): void {
  const triggers = nodes.filter(n => n.type === "trigger");
  
  if (triggers.length === 0) {
    issues.push({
      code: "NO_TRIGGER",
      message: "O fluxo não possui um Trigger (ponto de entrada)",
      severity: "error",
      suggestion: "Adicione um nó do tipo Trigger no início do fluxo",
    });
  } else if (triggers.length > 1) {
    issues.push({
      code: "MULTIPLE_TRIGGERS",
      message: `O fluxo possui ${triggers.length} Triggers. Deve ter apenas 1`,
      severity: "error",
      nodeId: triggers[1].id,
      suggestion: "Remova os Triggers extras ou converta-os em Actions",
    });
  }
}

function validateEnds(nodes: FlowNode[], issues: ValidationIssue[]): void {
  const endNodes = nodes.filter(n => n.type === "end");
  const successEnds = endNodes.filter(n => n.status === "success");
  const errorEnds = endNodes.filter(n => n.status === "error");
  
  if (endNodes.length === 0) {
    issues.push({
      code: "NO_END",
      message: "O fluxo não possui nenhum nó End (término)",
      severity: "error",
      suggestion: "Adicione pelo menos um nó End de sucesso ao final do happy path",
    });
  } else if (successEnds.length === 0) {
    issues.push({
      code: "NO_SUCCESS_END",
      message: "O fluxo não possui End de sucesso",
      severity: "error",
      suggestion: "Adicione um nó End com status='success' ao final do happy path",
    });
  } else if (successEnds.length > 1) {
    issues.push({
      code: "MULTIPLE_SUCCESS_ENDS",
      message: `O fluxo possui ${successEnds.length} End de sucesso. Deve ter apenas 1`,
      severity: "error",
      nodeId: successEnds[1].id,
      suggestion: "Unifique os caminhos de sucesso em um único End",
    });
  }
  
  // Info sobre ends de erro (não é erro, é informativo)
  if (errorEnds.length > 0) {
    issues.push({
      code: "ERROR_ENDS_COUNT",
      message: `O fluxo possui ${errorEnds.length} End(s) de erro`,
      severity: "info",
    });
  }
}

function validateConditions(
  nodes: FlowNode[],
  connections: FlowConnection[],
  issues: ValidationIssue[]
): void {
  const conditions = nodes.filter(n => n.type === "condition");
  
  for (const condition of conditions) {
    const outgoing = connections.filter(
      c => String(c.source_node_id) === condition.id || c.source_id === condition.id
    );
    
    const hasYes = outgoing.some(c => 
      c.label?.toLowerCase() === "sim" || 
      c.label?.toLowerCase() === "yes"
    );
    
    const hasNo = outgoing.some(c => 
      c.label?.toLowerCase() === "não" || 
      c.label?.toLowerCase() === "nao" ||
      c.label?.toLowerCase() === "no"
    );
    
    if (!hasYes && !hasNo) {
      issues.push({
        code: "CONDITION_NO_OUTPUTS",
        message: `Condition "${condition.title}" não tem nenhuma saída`,
        severity: "error",
        nodeId: condition.id,
        suggestion: "Adicione conexões 'sim' e 'não' para esta condição",
      });
    } else if (!hasYes) {
      issues.push({
        code: "CONDITION_NO_YES",
        message: `Condition "${condition.title}" não tem saída 'sim'`,
        severity: "error",
        nodeId: condition.id,
        suggestion: "Adicione uma conexão com label='sim' para o caminho positivo",
      });
    } else if (!hasNo) {
      issues.push({
        code: "CONDITION_NO_NO",
        message: `Condition "${condition.title}" não tem saída 'não'`,
        severity: "warning",
        nodeId: condition.id,
        suggestion: "Adicione uma conexão com label='não' para tratamento de erro",
      });
    }
  }
}

function validateActions(
  nodes: FlowNode[],
  connections: FlowConnection[],
  issues: ValidationIssue[]
): void {
  const actions = nodes.filter(n => n.type === "action");
  
  for (const action of actions) {
    const outgoing = connections.filter(
      c => String(c.source_node_id) === action.id || c.source_id === action.id
    );
    
    if (outgoing.length === 0) {
      issues.push({
        code: "ACTION_NO_OUTPUT",
        message: `Action "${action.title}" não tem conexão de saída`,
        severity: "error",
        nodeId: action.id,
        suggestion: "Conecte esta ação ao próximo passo do fluxo ou a um nó End",
      });
    }
  }
}

function validateOrphanNodes(
  nodes: FlowNode[],
  connections: FlowConnection[],
  issues: ValidationIssue[]
): void {
  // Nós que não são Trigger nem Text devem ter entrada
  const nodesNeedingInput = nodes.filter(
    n => n.type !== "trigger" && n.type !== "text"
  );
  
  for (const node of nodesNeedingInput) {
    const incoming = connections.filter(
      c => String(c.target_node_id) === node.id || c.target_id === node.id
    );
    
    if (incoming.length === 0) {
      issues.push({
        code: "ORPHAN_NODE",
        message: `Nó "${node.title}" (${node.type}) não tem conexão de entrada`,
        severity: "error",
        nodeId: node.id,
        suggestion: "Conecte este nó a partir de outro nó do fluxo",
      });
    }
  }
}

function validateDisconnectedNodes(
  nodes: FlowNode[],
  connections: FlowConnection[],
  issues: ValidationIssue[]
): void {
  // Nós que não são End nem Text devem ter saída
  const nodesNeedingOutput = nodes.filter(
    n => n.type !== "end" && n.type !== "text"
  );
  
  for (const node of nodesNeedingOutput) {
    const outgoing = connections.filter(
      c => String(c.source_node_id) === node.id || c.source_id === node.id
    );
    
    if (outgoing.length === 0) {
      issues.push({
        code: "DISCONNECTED_NODE",
        message: `Nó "${node.title}" (${node.type}) não tem conexão de saída`,
        severity: "error",
        nodeId: node.id,
        suggestion: "Conecte este nó ao próximo passo do fluxo",
      });
    }
  }
}

function validateFlowNavigation(
  nodes: FlowNode[],
  connections: FlowConnection[],
  issues: ValidationIssue[]
): void {
  const triggers = nodes.filter(n => n.type === "trigger");
  const ends = nodes.filter(n => n.type === "end");
  
  if (triggers.length === 0 || ends.length === 0) {
    return; // Já reportado em outras validações
  }
  
  // Verificar se existe caminho do Trigger ao End
  const trigger = triggers[0];
  const reachableNodes = getReachableNodes(trigger.id, nodes, connections);
  
  const successEnd = ends.find(n => n.status === "success");
  if (successEnd && !reachableNodes.has(successEnd.id)) {
    issues.push({
      code: "UNREACHABLE_SUCCESS_END",
      message: "O End de sucesso não é alcançável a partir do Trigger",
      severity: "error",
      nodeId: successEnd.id,
      suggestion: "Verifique as conexões para garantir um caminho completo",
    });
  }
  
  // Verificar nós não alcançáveis
  const unreachableNodes = nodes.filter(
    n => n.type !== "trigger" && n.type !== "text" && !reachableNodes.has(n.id)
  );
  
  for (const node of unreachableNodes) {
    issues.push({
      code: "UNREACHABLE_NODE",
      message: `Nó "${node.title}" não é alcançável a partir do Trigger`,
      severity: "warning",
      nodeId: node.id,
      suggestion: "Este nó está isolado do fluxo principal",
    });
  }
}

function validateSubflows(
  nodes: FlowNode[],
  connections: FlowConnection[],
  issues: ValidationIssue[]
): void {
  const subflows = nodes.filter(n => n.type === "subflow");
  
  for (const subflow of subflows) {
    // Verificar se tem referência ao fluxo alvo
    if (!subflow.target_flow_id) {
      issues.push({
        code: "SUBFLOW_NO_TARGET",
        message: `Subflow "${subflow.title}" não referencia um fluxo alvo`,
        severity: "warning",
        nodeId: subflow.id,
        suggestion: "Defina o targetFlowId para o fluxo que será chamado",
      });
    }
    
    // Verificar se tem saída (o que acontece após o subflow)
    const outgoing = connections.filter(
      c => String(c.source_node_id) === subflow.id || c.source_id === subflow.id
    );
    
    if (outgoing.length === 0) {
      issues.push({
        code: "SUBFLOW_NO_OUTPUT",
        message: `Subflow "${subflow.title}" não define o que acontece após sua execução`,
        severity: "error",
        nodeId: subflow.id,
        suggestion: "Conecte o subflow ao próximo passo após seu retorno",
      });
    }
  }
}

// ========================================
// FUNÇÕES AUXILIARES
// ========================================

function getReachableNodes(
  startId: string,
  nodes: FlowNode[],
  connections: FlowConnection[]
): Set<string> {
  const reachable = new Set<string>();
  const queue = [startId];
  
  while (queue.length > 0) {
    const current = queue.shift()!;
    if (reachable.has(current)) continue;
    
    reachable.add(current);
    
    // Encontrar conexões de saída
    const outgoing = connections.filter(
      c => String(c.source_node_id) === current || c.source_id === current
    );
    
    for (const conn of outgoing) {
      const targetId = conn.target_id || String(conn.target_node_id);
      if (!reachable.has(targetId)) {
        queue.push(targetId);
      }
    }
  }
  
  return reachable;
}

function calculateStats(
  nodes: FlowNode[],
  connections: FlowConnection[]
): FlowStats {
  const nodeIds = new Set(nodes.map(n => n.id));
  
  // Encontrar nós sem entrada
  const nodesWithInput = new Set<string>();
  connections.forEach(c => {
    const targetId = c.target_id || String(c.target_node_id);
    nodesWithInput.add(targetId);
  });
  
  // Encontrar nós sem saída
  const nodesWithOutput = new Set<string>();
  connections.forEach(c => {
    const sourceId = c.source_id || String(c.source_node_id);
    nodesWithOutput.add(sourceId);
  });
  
  const orphanNodes = nodes.filter(
    n => n.type !== "trigger" && n.type !== "text" && !nodesWithInput.has(n.id)
  ).length;
  
  const disconnectedNodes = nodes.filter(
    n => n.type !== "end" && n.type !== "text" && !nodesWithOutput.has(n.id)
  ).length;
  
  return {
    totalNodes: nodes.length,
    triggers: nodes.filter(n => n.type === "trigger").length,
    actions: nodes.filter(n => n.type === "action").length,
    conditions: nodes.filter(n => n.type === "condition").length,
    subflows: nodes.filter(n => n.type === "subflow").length,
    fieldGroups: nodes.filter(n => n.type === "field_group").length,
    endSuccess: nodes.filter(n => n.type === "end" && n.status === "success").length,
    endError: nodes.filter(n => n.type === "end" && n.status === "error").length,
    textNodes: nodes.filter(n => n.type === "text").length,
    totalConnections: connections.length,
    disconnectedNodes,
    orphanNodes,
  };
}

function calculateScore(issues: ValidationIssue[], stats: FlowStats): number {
  let score = 100;
  
  // Penalidades por tipo de problema
  for (const issue of issues) {
    switch (issue.severity) {
      case "error":
        score -= 15;
        break;
      case "warning":
        score -= 5;
        break;
      case "info":
        // Não penaliza
        break;
    }
  }
  
  // Bônus por boas práticas
  if (stats.triggers === 1) score += 5;
  if (stats.endSuccess === 1) score += 5;
  if (stats.conditions > 0) score += 3; // Tem decisões
  if (stats.disconnectedNodes === 0) score += 5;
  if (stats.orphanNodes === 0) score += 5;
  
  // Limitar entre 0 e 100
  return Math.max(0, Math.min(100, score));
}

// ========================================
// FUNÇÃO DE AUTO-CORREÇÃO
// ========================================

export interface AutoFixResult {
  fixed: boolean;
  nodes: FlowNode[];
  connections: FlowConnection[];
  fixesApplied: string[];
}

export function autoFixFlow(
  nodes: FlowNode[],
  connections: FlowConnection[]
): AutoFixResult {
  const fixesApplied: string[] = [];
  let fixedNodes = [...nodes];
  let fixedConnections = [...connections];
  
  // 1. Adicionar Trigger se não existir
  const triggers = fixedNodes.filter(n => n.type === "trigger");
  if (triggers.length === 0) {
    const minX = Math.min(...fixedNodes.map(n => n.position_x), 400);
    fixedNodes.unshift({
      id: `trigger_auto_${Date.now()}`,
      type: "trigger",
      title: "Início do Fluxo",
      description: "Ponto de entrada do fluxo (adicionado automaticamente)",
      position_x: minX - 280,
      position_y: 300,
    });
    fixesApplied.push("Adicionado Trigger no início");
  }
  
  // 2. Adicionar End de sucesso se não existir
  const successEnds = fixedNodes.filter(n => n.type === "end" && n.status === "success");
  if (successEnds.length === 0) {
    const maxX = Math.max(...fixedNodes.map(n => n.position_x), 400);
    fixedNodes.push({
      id: `end_success_auto_${Date.now()}`,
      type: "end",
      title: "Fluxo Concluído",
      description: "Término bem-sucedido do fluxo (adicionado automaticamente)",
      position_x: maxX + 280,
      position_y: 300,
      status: "success",
    });
    fixesApplied.push("Adicionado End de sucesso no final");
  }
  
  // 3. Converter múltiplos End de sucesso em erro
  const allSuccessEnds = fixedNodes.filter(n => n.type === "end" && n.status === "success");
  if (allSuccessEnds.length > 1) {
    // Manter o último, converter os outros em erro
    for (let i = 0; i < allSuccessEnds.length - 1; i++) {
      const node = fixedNodes.find(n => n.id === allSuccessEnds[i].id);
      if (node) {
        node.status = "error";
        node.title = `[Erro] ${node.title}`;
      }
    }
    fixesApplied.push(`Convertidos ${allSuccessEnds.length - 1} End extras para erro`);
  }
  
  return {
    fixed: fixesApplied.length > 0,
    nodes: fixedNodes,
    connections: fixedConnections,
    fixesApplied,
  };
}

// ========================================
// EXPORTAR FUNÇÃO DE VALIDAÇÃO RÁPIDA
// ========================================

export function quickValidate(
  nodes: FlowNode[],
  connections: FlowConnection[]
): { isValid: boolean; errorCount: number; warningCount: number } {
  const result = validateFlow(nodes, connections);
  return {
    isValid: result.isValid,
    errorCount: result.issues.filter(i => i.severity === "error").length,
    warningCount: result.issues.filter(i => i.severity === "warning").length,
  };
}
















