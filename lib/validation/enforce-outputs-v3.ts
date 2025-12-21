/**
 * Enforce Required Outputs V3.1
 * 
 * Camada determinística que GARANTE a cardinalidade mínima de saídas por tipo de nó.
 * Esta é a última linha de defesa - DEVE rodar antes de salvar qualquer flow.
 * 
 * REGRAS OBRIGATÓRIAS:
 * - condition: EXATAMENTE 2 saídas (success + failure)
 * - choice: PELO MENOS 2 opções
 * - form/action críticos: success + failure path
 * - end_*: 0 saídas
 * - trigger: 1 saída
 * 
 * @module enforce-outputs-v3
 */

// ========================================
// TIPOS
// ========================================

export interface EnforcerNode {
  id: string;
  type: string;
  title?: string;
  description?: string;
  impact_level?: "low" | "medium" | "high";
  has_validations?: boolean;
  has_required_fields?: boolean;
  inputs?: Array<{ required?: boolean; validation_rules?: string[] }>;
  children?: Array<{ type?: string; label?: string }>;
  metadata?: {
    v3_type?: string;
    auto_generated?: boolean;
    source?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export interface EnforcerConnection {
  id?: string;
  source_id: string;
  target_id: string;
  connection_type: string;
  label?: string;
  metadata?: {
    auto_generated?: boolean;
    source?: string;
    [key: string]: unknown;
  };
}

export interface EnforcementResult {
  nodes: EnforcerNode[];
  connections: EnforcerConnection[];
  added_nodes: EnforcerNode[];
  added_connections: EnforcerConnection[];
  removed_connections: EnforcerConnection[];
  issues_fixed: string[];
  stats: {
    conditions_fixed: number;
    choices_fixed: number;
    forms_fixed: number;
    actions_fixed: number;
    terminals_fixed: number;
    total_nodes_added: number;
    total_connections_added: number;
    total_connections_removed: number;
  };
}

export interface EnforcementContext {
  flow_title?: string;
  archetype?: string;
  primary_actor?: string;
  product_type?: string;
  page_key?: string;
}

// ========================================
// CONSTANTES
// ========================================

// Tipos terminais (0 saídas)
const TERMINAL_TYPES = new Set(["end_success", "end_error", "end_neutral"]);

// Tipos que DEVEM ter EXATAMENTE 2 saídas
const BINARY_BRANCH_TYPES = new Set(["condition"]);

// Tipos que DEVEM ter pelo menos 2 opções
const MULTI_OPTION_TYPES = new Set(["choice", "option_choice"]);

// Tipos que podem ter failure path (dependendo do impact)
const FAILABLE_TYPES = new Set(["form", "action", "background_action", "configuration_matrix", "insight_branch"]);

// Tipos auxiliares de recovery
const RECOVERY_TYPES = new Set(["retry", "loopback", "fallback", "feedback_error"]);

// ========================================
// HELPERS
// ========================================

let nodeIdCounter = 10000;
let connIdCounter = 10000;

function generateNodeId(prefix: string): string {
  return `${prefix}_auto_${++nodeIdCounter}`;
}

function generateConnId(): string {
  return `conn_auto_${++connIdCounter}`;
}

/**
 * Obtém o tipo efetivo do nó (prioriza v3_type)
 */
function getEffectiveType(node: EnforcerNode): string {
  return node.metadata?.v3_type || node.type || "unknown";
}

/**
 * Verifica se um nó é "falhável" baseado em tipo e contexto
 */
function isNodeFailable(node: EnforcerNode): boolean {
  const type = getEffectiveType(node);
  
  if (!FAILABLE_TYPES.has(type)) return false;
  
  // Impact level alto ou médio
  if (node.impact_level === "high" || node.impact_level === "medium") return true;
  
  // Form com campos obrigatórios ou validações
  if (type === "form") {
    if (node.has_validations || node.has_required_fields) return true;
    if (node.inputs?.some(i => i.required || (i.validation_rules && i.validation_rules.length > 0))) return true;
  }
  
  // insight_branch sempre é falhável (aceitar/adiar)
  if (type === "insight_branch") return true;
  
  return false;
}

/**
 * Cria um nó de feedback_error
 */
function createFeedbackError(sourceNode: EnforcerNode, message?: string): EnforcerNode {
  return {
    id: generateNodeId("feedback_error"),
    type: "feedback_error",
    title: message || `Erro: ${sourceNode.title || "Operação falhou"}`,
    description: `Não foi possível completar "${sourceNode.title || "esta etapa"}". Tente novamente.`,
    impact_level: "low",
    metadata: {
      v3_type: "feedback_error",
      auto_generated: true,
      source: "enforce_outputs_v3",
      related_node_id: sourceNode.id,
    },
  };
}

/**
 * Cria um nó de loopback
 */
function createLoopback(targetNodeTitle?: string): EnforcerNode {
  return {
    id: generateNodeId("loopback"),
    type: "loopback",
    title: "Tentar novamente",
    description: `Voltar para ${targetNodeTitle || "etapa anterior"}`,
    impact_level: "low",
    metadata: {
      v3_type: "loopback",
      auto_generated: true,
      source: "enforce_outputs_v3",
    },
  };
}

/**
 * Cria um nó end_neutral (fallback seguro)
 */
function createEndNeutral(reason?: string): EnforcerNode {
  return {
    id: generateNodeId("end_neutral"),
    type: "end_neutral",
    title: reason || "Fluxo encerrado",
    description: "Fluxo finalizado sem sucesso completo",
    impact_level: "low",
    metadata: {
      v3_type: "end_neutral",
      auto_generated: true,
      source: "enforce_outputs_v3",
    },
  };
}

/**
 * Cria um nó end_success
 */
function createEndSuccess(title?: string): EnforcerNode {
  return {
    id: generateNodeId("end_success"),
    type: "end_success",
    title: title || "Concluído com sucesso",
    description: "Fluxo finalizado com sucesso",
    impact_level: "low",
    metadata: {
      v3_type: "end_success",
      auto_generated: true,
      source: "enforce_outputs_v3",
    },
  };
}

/**
 * Cria um nó feedback_success
 */
function createFeedbackSuccess(title?: string): EnforcerNode {
  return {
    id: generateNodeId("feedback_success"),
    type: "feedback_success",
    title: title || "Sucesso!",
    description: "Operação concluída com sucesso",
    impact_level: "low",
    metadata: {
      v3_type: "feedback_success",
      auto_generated: true,
      source: "enforce_outputs_v3",
    },
  };
}

/**
 * Cria uma conexão
 */
function createConnection(
  sourceId: string,
  targetId: string,
  type: string,
  label?: string
): EnforcerConnection {
  return {
    id: generateConnId(),
    source_id: sourceId,
    target_id: targetId,
    connection_type: type,
    label: label,
    metadata: {
      auto_generated: true,
      source: "enforce_outputs_v3",
    },
  };
}

// ========================================
// ENFORCER FUNCTIONS
// ========================================

/**
 * ENFORCER A: Garante que conditions têm EXATAMENTE 2 saídas
 */
function enforceConditionBranches(
  nodes: EnforcerNode[],
  connections: EnforcerConnection[],
  result: EnforcementResult
): void {
  const conditions = nodes.filter(n => BINARY_BRANCH_TYPES.has(getEffectiveType(n)));
  
  for (const condition of conditions) {
    const outgoing = connections.filter(c => c.source_id === condition.id);
    
    // Identificar o que já existe
    const hasSuccess = outgoing.some(c => 
      c.connection_type === "success" || 
      c.label?.toLowerCase().match(/^(sim|yes|true|valid|success|ok)$/i)
    );
    const hasFailure = outgoing.some(c => 
      c.connection_type === "failure" || 
      c.connection_type === "error" ||
      c.label?.toLowerCase().match(/^(não|no|false|invalid|error|fail)$/i)
    );
    
    // Encontrar nó anterior para loopback
    const incoming = connections.filter(c => c.target_id === condition.id);
    const previousNodeId = incoming.length > 0 ? incoming[0].source_id : null;
    const previousNode = previousNodeId ? nodes.find(n => n.id === previousNodeId) : null;
    
    // Caso 1: Tem apenas success (mais comum)
    if (hasSuccess && !hasFailure) {
      // Criar feedback_error
      const errorNode = createFeedbackError(condition, `Condição não atendida: ${condition.title}`);
      result.added_nodes.push(errorNode);
      result.nodes.push(errorNode);
      
      // Criar conexão failure
      const failureConn = createConnection(condition.id, errorNode.id, "failure", "Não");
      result.added_connections.push(failureConn);
      result.connections.push(failureConn);
      
      // Criar loopback se houver nó anterior
      if (previousNodeId) {
        const loopbackConn = createConnection(errorNode.id, previousNodeId, "loopback", "Voltar");
        result.added_connections.push(loopbackConn);
        result.connections.push(loopbackConn);
      } else {
        // Se não houver anterior, criar end_neutral
        const endNode = createEndNeutral("Condição não atendida");
        result.added_nodes.push(endNode);
        result.nodes.push(endNode);
        
        const endConn = createConnection(errorNode.id, endNode.id, "default", "Encerrar");
        result.added_connections.push(endConn);
        result.connections.push(endConn);
      }
      
      result.stats.conditions_fixed++;
      result.issues_fixed.push(`Condition "${condition.title}" (${condition.id}): adicionado branch failure`);
    }
    
    // Caso 2: Tem apenas failure (raro)
    else if (!hasSuccess && hasFailure) {
      // Criar feedback_success
      const successNode = createFeedbackSuccess(`${condition.title} - OK`);
      result.added_nodes.push(successNode);
      result.nodes.push(successNode);
      
      // Criar conexão success
      const successConn = createConnection(condition.id, successNode.id, "success", "Sim");
      result.added_connections.push(successConn);
      result.connections.push(successConn);
      
      // Criar end_success se não houver continuação
      const endNode = createEndSuccess();
      result.added_nodes.push(endNode);
      result.nodes.push(endNode);
      
      const endConn = createConnection(successNode.id, endNode.id, "default");
      result.added_connections.push(endConn);
      result.connections.push(endConn);
      
      result.stats.conditions_fixed++;
      result.issues_fixed.push(`Condition "${condition.title}" (${condition.id}): adicionado branch success`);
    }
    
    // Caso 3: Não tem nenhum (0 saídas)
    else if (!hasSuccess && !hasFailure) {
      // Criar estrutura completa
      const successNode = createFeedbackSuccess(`${condition.title} - OK`);
      result.added_nodes.push(successNode);
      result.nodes.push(successNode);
      
      const errorNode = createFeedbackError(condition);
      result.added_nodes.push(errorNode);
      result.nodes.push(errorNode);
      
      // Conexões
      result.added_connections.push(createConnection(condition.id, successNode.id, "success", "Sim"));
      result.added_connections.push(createConnection(condition.id, errorNode.id, "failure", "Não"));
      
      // End nodes
      const endSuccess = createEndSuccess();
      result.added_nodes.push(endSuccess);
      result.nodes.push(endSuccess);
      result.added_connections.push(createConnection(successNode.id, endSuccess.id, "default"));
      
      if (previousNodeId) {
        result.added_connections.push(createConnection(errorNode.id, previousNodeId, "loopback", "Voltar"));
      } else {
        const endNeutral = createEndNeutral();
        result.added_nodes.push(endNeutral);
        result.nodes.push(endNeutral);
        result.added_connections.push(createConnection(errorNode.id, endNeutral.id, "default", "Encerrar"));
      }
      
      // Adicionar todas as novas conexões ao array de connections
      result.connections.push(...result.added_connections.slice(-4));
      
      result.stats.conditions_fixed++;
      result.issues_fixed.push(`Condition "${condition.title}" (${condition.id}): criado ambos os branches (success + failure)`);
    }
    
    // Caso 4: Tem mais de 2 saídas (normalizar)
    else if (outgoing.length > 2) {
      // Manter apenas success e failure, remover o resto
      const toRemove = outgoing.filter(c => 
        c.connection_type !== "success" && c.connection_type !== "failure" &&
        !c.label?.toLowerCase().match(/^(sim|yes|não|no)$/i)
      );
      
      for (const conn of toRemove) {
        const idx = result.connections.findIndex(c => c.id === conn.id);
        if (idx !== -1) {
          result.removed_connections.push(result.connections[idx]);
          result.connections.splice(idx, 1);
          result.stats.total_connections_removed++;
        }
      }
      
      if (toRemove.length > 0) {
        result.issues_fixed.push(`Condition "${condition.title}" (${condition.id}): removidas ${toRemove.length} conexões extras`);
      }
    }
  }
}

/**
 * ENFORCER B: Garante que choices têm >= 2 opções
 */
function enforceChoiceOptions(
  nodes: EnforcerNode[],
  connections: EnforcerConnection[],
  result: EnforcementResult,
  context: EnforcementContext
): void {
  const choices = nodes.filter(n => MULTI_OPTION_TYPES.has(getEffectiveType(n)));
  
  for (const choice of choices) {
    const outgoing = connections.filter(c => c.source_id === choice.id);
    
    if (outgoing.length < 2) {
      // Criar opção alternativa
      const alternativeNode = createEndNeutral("Cancelar / Voltar depois");
      result.added_nodes.push(alternativeNode);
      result.nodes.push(alternativeNode);
      
      // Criar conexão de opção
      const optionConn = createConnection(choice.id, alternativeNode.id, "option", "Depois / Cancelar");
      result.added_connections.push(optionConn);
      result.connections.push(optionConn);
      
      result.stats.choices_fixed++;
      result.issues_fixed.push(`Choice "${choice.title}" (${choice.id}): adicionada opção alternativa`);
    }
  }
  
  // Verificar também nodes com children do tipo option_choice
  for (const node of nodes) {
    if (node.children && Array.isArray(node.children)) {
      const options = node.children.filter(c => c.type === "option_choice");
      if (options.length === 1) {
        // Adicionar opção alternativa
        const altOption = { type: "option_choice", label: "Outra opção / Cancelar" };
        node.children.push(altOption);
        result.issues_fixed.push(`Node "${node.title}" (${node.id}): adicionada opção alternativa em children`);
      }
    }
  }
}

/**
 * ENFORCER C: Garante que nós falháveis têm error path
 */
function enforceFailableNodeErrorPaths(
  nodes: EnforcerNode[],
  connections: EnforcerConnection[],
  result: EnforcementResult
): void {
  for (const node of nodes) {
    if (!isNodeFailable(node)) continue;
    
    const outgoing = connections.filter(c => c.source_id === node.id);
    const hasFailurePath = outgoing.some(c => 
      c.connection_type === "failure" || 
      c.connection_type === "error" ||
      c.connection_type === "fallback"
    );
    
    if (!hasFailurePath) {
      const type = getEffectiveType(node);
      
      // Criar feedback_error
      const errorNode = createFeedbackError(node);
      result.added_nodes.push(errorNode);
      result.nodes.push(errorNode);
      
      // Criar conexão failure
      const failureConn = createConnection(node.id, errorNode.id, "failure", "Erro");
      result.added_connections.push(failureConn);
      result.connections.push(failureConn);
      
      // Para forms, criar loopback
      if (type === "form") {
        const loopbackConn = createConnection(errorNode.id, node.id, "loopback", "Corrigir");
        result.added_connections.push(loopbackConn);
        result.connections.push(loopbackConn);
        result.stats.forms_fixed++;
      } 
      // Para actions/insight_branch, criar retry ou end_neutral
      else if (type === "action" || type === "background_action") {
        const loopback = createLoopback(node.title);
        result.added_nodes.push(loopback);
        result.nodes.push(loopback);
        
        const retryConn = createConnection(errorNode.id, loopback.id, "default", "Tentar novamente");
        result.added_connections.push(retryConn);
        result.connections.push(retryConn);
        
        const backConn = createConnection(loopback.id, node.id, "loopback");
        result.added_connections.push(backConn);
        result.connections.push(backConn);
        
        result.stats.actions_fixed++;
      }
      // Para insight_branch, criar opção "depois"
      else if (type === "insight_branch") {
        const endNeutral = createEndNeutral("Ver depois");
        result.added_nodes.push(endNeutral);
        result.nodes.push(endNeutral);
        
        const laterConn = createConnection(errorNode.id, endNeutral.id, "default", "Depois");
        result.added_connections.push(laterConn);
        result.connections.push(laterConn);
      }
      
      result.issues_fixed.push(`Node falhável "${node.title}" (${node.id}): adicionado error path`);
    }
  }
}

/**
 * ENFORCER D: Garante que insight_branch tem 2 caminhos
 */
function enforceInsightBranching(
  nodes: EnforcerNode[],
  connections: EnforcerConnection[],
  result: EnforcementResult
): void {
  const insights = nodes.filter(n => getEffectiveType(n) === "insight_branch");
  
  for (const insight of insights) {
    const outgoing = connections.filter(c => c.source_id === insight.id);
    
    if (outgoing.length < 2) {
      // Criar opção "Depois/Dismiss"
      const endNeutral = createEndNeutral("Ver depois");
      result.added_nodes.push(endNeutral);
      result.nodes.push(endNeutral);
      
      const dismissConn = createConnection(insight.id, endNeutral.id, "option", "Depois");
      result.added_connections.push(dismissConn);
      result.connections.push(dismissConn);
      
      result.issues_fixed.push(`Insight "${insight.title}" (${insight.id}): adicionada opção "Depois"`);
    }
  }
}

/**
 * ENFORCER E: Remove saídas de nós terminais
 */
function enforceTerminalNodes(
  nodes: EnforcerNode[],
  connections: EnforcerConnection[],
  result: EnforcementResult
): void {
  const terminals = nodes.filter(n => TERMINAL_TYPES.has(getEffectiveType(n)));
  
  for (const terminal of terminals) {
    const outgoing = connections.filter(c => c.source_id === terminal.id);
    
    for (const conn of outgoing) {
      const idx = result.connections.findIndex(c => 
        c.source_id === conn.source_id && c.target_id === conn.target_id
      );
      if (idx !== -1) {
        result.removed_connections.push(result.connections[idx]);
        result.connections.splice(idx, 1);
        result.stats.terminals_fixed++;
        result.stats.total_connections_removed++;
        result.issues_fixed.push(`Terminal "${terminal.title}" (${terminal.id}): removida conexão de saída`);
      }
    }
  }
}

/**
 * ENFORCER F: Garante que existe pelo menos 1 end_success ou end_neutral
 */
function enforceFlowTermination(
  nodes: EnforcerNode[],
  connections: EnforcerConnection[],
  result: EnforcementResult
): void {
  const hasEndSuccess = nodes.some(n => getEffectiveType(n) === "end_success");
  const hasEndNeutral = nodes.some(n => getEffectiveType(n) === "end_neutral");
  
  if (!hasEndSuccess && !hasEndNeutral) {
    // Encontrar último nó do happy path (que não tem saída)
    const nodesWithoutOutput = nodes.filter(n => {
      const type = getEffectiveType(n);
      return !TERMINAL_TYPES.has(type) && 
             !connections.some(c => c.source_id === n.id);
    });
    
    if (nodesWithoutOutput.length > 0) {
      const lastNode = nodesWithoutOutput[nodesWithoutOutput.length - 1];
      
      // Criar end_success
      const endSuccess = createEndSuccess();
      result.added_nodes.push(endSuccess);
      result.nodes.push(endSuccess);
      
      // Conectar
      const endConn = createConnection(lastNode.id, endSuccess.id, "default");
      result.added_connections.push(endConn);
      result.connections.push(endConn);
      
      result.issues_fixed.push(`Flow: adicionado end_success conectado a "${lastNode.title}"`);
    }
  }
}

// ========================================
// FUNÇÃO PRINCIPAL
// ========================================

/**
 * Aplica todas as regras de enforcement em um flow
 */
export function enforceRequiredOutputsV3(
  inputNodes: EnforcerNode[],
  inputConnections: EnforcerConnection[],
  context: EnforcementContext = {}
): EnforcementResult {
  // Reset counters
  nodeIdCounter = 10000 + Math.floor(Math.random() * 1000);
  connIdCounter = 10000 + Math.floor(Math.random() * 1000);
  
  // Clone inputs para não mutar originais
  const nodes = inputNodes.map(n => ({ ...n }));
  const connections = inputConnections.map(c => ({ ...c }));
  
  const result: EnforcementResult = {
    nodes,
    connections,
    added_nodes: [],
    added_connections: [],
    removed_connections: [],
    issues_fixed: [],
    stats: {
      conditions_fixed: 0,
      choices_fixed: 0,
      forms_fixed: 0,
      actions_fixed: 0,
      terminals_fixed: 0,
      total_nodes_added: 0,
      total_connections_added: 0,
      total_connections_removed: 0,
    },
  };
  
  console.log(`[enforceRequiredOutputsV3] Starting enforcement for ${nodes.length} nodes, ${connections.length} connections`);
  
  // Aplicar enforcers em ordem
  enforceConditionBranches(nodes, connections, result);
  enforceChoiceOptions(nodes, connections, result, context);
  enforceFailableNodeErrorPaths(nodes, connections, result);
  enforceInsightBranching(nodes, connections, result);
  enforceTerminalNodes(nodes, connections, result);
  enforceFlowTermination(nodes, connections, result);
  
  // Atualizar stats finais
  result.stats.total_nodes_added = result.added_nodes.length;
  result.stats.total_connections_added = result.added_connections.length;
  
  console.log(`[enforceRequiredOutputsV3] Enforcement complete:`, {
    issues_fixed: result.issues_fixed.length,
    nodes_added: result.added_nodes.length,
    connections_added: result.added_connections.length,
    connections_removed: result.removed_connections.length,
    stats: result.stats,
  });
  
  return result;
}

// ========================================
// VALIDATOR (HARD GATE)
// ========================================

export interface EnforcementValidationResult {
  is_valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Valida se o flow atende aos requisitos APÓS enforcement
 * (Este é o HARD GATE - se falhar, NÃO salvar)
 */
export function validateEnforcedFlow(
  nodes: EnforcerNode[],
  connections: EnforcerConnection[]
): EnforcementValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // 1. Verificar conditions
  const conditions = nodes.filter(n => BINARY_BRANCH_TYPES.has(getEffectiveType(n)));
  for (const condition of conditions) {
    const outgoing = connections.filter(c => c.source_id === condition.id);
    if (outgoing.length !== 2) {
      errors.push(`HARD_GATE_FAIL: Condition "${condition.title}" (${condition.id}) tem ${outgoing.length} saídas (deve ter 2)`);
    }
  }
  
  // 2. Verificar choices
  const choices = nodes.filter(n => MULTI_OPTION_TYPES.has(getEffectiveType(n)));
  for (const choice of choices) {
    const outgoing = connections.filter(c => c.source_id === choice.id);
    if (outgoing.length < 2) {
      errors.push(`HARD_GATE_FAIL: Choice "${choice.title}" (${choice.id}) tem ${outgoing.length} opções (deve ter >=2)`);
    }
  }
  
  // 3. Verificar terminais (0 saídas)
  const terminals = nodes.filter(n => TERMINAL_TYPES.has(getEffectiveType(n)));
  for (const terminal of terminals) {
    const outgoing = connections.filter(c => c.source_id === terminal.id);
    if (outgoing.length > 0) {
      errors.push(`HARD_GATE_FAIL: Terminal "${terminal.title}" (${terminal.id}) tem ${outgoing.length} saídas (deve ter 0)`);
    }
  }
  
  // 4. Verificar que existe pelo menos 1 end
  const hasEnd = nodes.some(n => TERMINAL_TYPES.has(getEffectiveType(n)));
  if (!hasEnd) {
    warnings.push(`WARN: Flow não tem nó terminal (end_success/end_error/end_neutral)`);
  }
  
  return {
    is_valid: errors.length === 0,
    errors,
    warnings,
  };
}

// ========================================
// EXPORTAÇÕES
// ========================================

export const EnforceOutputsV3 = {
  enforce: enforceRequiredOutputsV3,
  validate: validateEnforcedFlow,
  isTerminalType: (type: string) => TERMINAL_TYPES.has(type),
  isBinaryBranchType: (type: string) => BINARY_BRANCH_TYPES.has(type),
  isMultiOptionType: (type: string) => MULTI_OPTION_TYPES.has(type),
  isFailableType: (type: string) => FAILABLE_TYPES.has(type),
};



