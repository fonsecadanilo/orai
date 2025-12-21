/**
 * Type Repairer V3.1
 * 
 * Micro-agente que corrige semantic_type sem reescrever o flow.
 * Apenas ajusta tipagem e adiciona nós mínimos de suporte.
 * 
 * REGRAS:
 * - Não alterar ids existentes
 * - Não alterar intents/system_behavior
 * - Garantir que conditions tenham 2 branches
 * - Garantir que forms/actions críticas tenham caminho de erro
 * 
 * @module type-repairer-v3
 */

import {
  type SemanticTypeV3,
  type FlowNodeForValidation,
  type FlowConnectionForValidation,
  type TypeDistributionStats,
  ALLOWED_SEMANTIC_TYPES_V3,
  isValidSemanticTypeV3,
  calculateTypeStats,
} from "./type-gates-v3";

// Mapeamento de tipos antigos/step_type para semantic_type v3.1
const LEGACY_TYPE_TO_V3: Record<string, SemanticTypeV3> = {
  // Step types antigos do Flow Synthesizer
  "entry_point": "trigger",
  "exit_point": "end_neutral",
  "success_state": "end_success",
  "error_state": "end_error",
  "form_input": "form",
  "decision_point": "condition",
  "user_action": "action",
  "system_action": "background_action",
  "api_call": "background_action",
  "data_transform": "action",
  "validation": "condition",
  "redirect": "action",
  "notification": "feedback_success",
  
  // Aliases comuns
  "start": "trigger",
  "begin": "trigger",
  "login": "form",
  "register": "form",
  "signup": "form",
  "checkout": "form",
  "payment": "form",
  "confirm": "feedback_success",
  "complete": "end_success",
  "finish": "end_success",
  "cancel": "end_neutral",
  "abort": "end_error",
};

export interface RepairableNode {
  id: string;
  type: string;
  title?: string;
  description?: string;
  user_intent?: string;
  system_behavior?: string;
  impact_level?: "low" | "medium" | "high";
  has_validations?: boolean;
  has_required_fields?: boolean;
  inputs?: Array<{ required?: boolean; validation_rules?: string[] }>;
  error_cases?: Array<{ type: string; handling: string }>;
  suggested_edges?: Array<{ label: string; type: string; target_hint?: string }>;
  group_label?: string;
  page_key?: string;
  children?: unknown[];
  [key: string]: unknown;
}

export interface RepairableConnection {
  id?: string;
  source_id: string;
  target_id: string;
  connection_type?: string;
  label?: string;
  [key: string]: unknown;
}

export interface TypeRepairResult {
  nodes: RepairableNode[];
  connections: RepairableConnection[];
  repairs_made: TypeRepair[];
  nodes_added: RepairableNode[];
  connections_added: RepairableConnection[];
  stats_before: TypeDistributionStats;
  stats_after: TypeDistributionStats;
  still_needs_repair: boolean;
}

export interface TypeRepair {
  node_id: string;
  repair_type: "type_change" | "node_added" | "connection_added";
  old_value?: string;
  new_value: string;
  reason: string;
}

/**
 * Infere o tipo correto baseado no conteúdo do nó
 */
function inferTypeFromContent(node: RepairableNode): SemanticTypeV3 {
  const content = `${node.title || ""} ${node.description || ""} ${node.user_intent || ""} ${node.system_behavior || ""}`.toLowerCase();
  
  // 1. Verificar se já é um tipo v3.1 válido
  if (isValidSemanticTypeV3(node.type) && node.type !== "action") {
    return node.type;
  }
  
  // 2. Verificar mapeamento direto de tipos legados
  if (LEGACY_TYPE_TO_V3[node.type]) {
    return LEGACY_TYPE_TO_V3[node.type];
  }
  
  // 3. Verificar se tem inputs/form fields
  if (node.inputs && node.inputs.length > 0) {
    return "form";
  }
  
  // 4. Verificar se tem error_cases
  if (node.error_cases && node.error_cases.length > 0) {
    // Nós com error cases provavelmente são forms ou actions críticas
    if (content.includes("form") || content.includes("input") || content.includes("submit")) {
      return "form";
    }
  }
  
  // 5. Verificar se tem suggested_edges com branches
  if (node.suggested_edges && node.suggested_edges.length >= 2) {
    const hasYesNo = node.suggested_edges.some(e => 
      ["yes", "no", "sim", "não", "true", "false"].includes(e.label?.toLowerCase() || "")
    );
    if (hasYesNo) {
      return "condition";
    }
    // Se tem múltiplas opções, provavelmente é choice
    return "choice";
  }
  
  // 6. Patterns por conteúdo
  const patterns: Array<{ pattern: RegExp; type: SemanticTypeV3; priority: number }> = [
    // Alta prioridade - triggers e ends
    { pattern: /^(start|begin|launch|open|access|entry|trigger|initial|landing)/i, type: "trigger", priority: 100 },
    { pattern: /(complete|success|done|finish|confirm).*$/i, type: "end_success", priority: 90 },
    { pattern: /(error|fail|abort|cancel).*$/i, type: "end_error", priority: 90 },
    
    // Forms - alta prioridade
    { pattern: /\b(form|formulário|login|register|signup|sign.?up|checkout|payment|pagar|cadastro|email|password|senha)\b/i, type: "form", priority: 80 },
    { pattern: /\b(preenche|fill|enter|digite|input|dados|informações)\b/i, type: "form", priority: 75 },
    
    // Conditions/Decisions
    { pattern: /\b(se|if|condição|condition|verifica|check|valida|valid|decide|branch|whether)\b/i, type: "condition", priority: 70 },
    { pattern: /\b(escolhe|choose|select|option|pick|método|method|tipo|type)\b/i, type: "choice", priority: 70 },
    
    // Feedback
    { pattern: /\b(sucesso|success|confirmação|confirm|welcome|bem.?vindo|obrigado|thank)\b/i, type: "feedback_success", priority: 60 },
    { pattern: /\b(erro|error|falha|fail|invalid|incorreto|wrong|denied|negado)\b/i, type: "feedback_error", priority: 60 },
    
    // Background/System
    { pattern: /\b(process|processa|load|carrega|fetch|busca|api|backend|async|aguarda|wait)\b/i, type: "background_action", priority: 50 },
    
    // Recovery
    { pattern: /\b(retry|tentar novamente|repeat|re.?attempt|tente)\b/i, type: "retry", priority: 50 },
    { pattern: /\b(voltar|back|return|previous|anterior)\b/i, type: "loopback", priority: 50 },
    { pattern: /\b(fallback|alternativ|outro|different)\b/i, type: "fallback", priority: 50 },
  ];
  
  // Ordenar por prioridade e testar
  const sortedPatterns = patterns.sort((a, b) => b.priority - a.priority);
  for (const { pattern, type } of sortedPatterns) {
    if (pattern.test(content)) {
      return type;
    }
  }
  
  // 7. Se impact_level é high, provavelmente é action importante
  if (node.impact_level === "high") {
    return "action"; // Manter como action mas com impact_level
  }
  
  return "action";
}

/**
 * Gera um ID único para novos nós
 */
function generateNodeId(prefix: string, existingIds: Set<string>): string {
  let counter = 1;
  let id = `${prefix}_${counter}`;
  while (existingIds.has(id)) {
    counter++;
    id = `${prefix}_${counter}`;
  }
  return id;
}

/**
 * Repara os tipos dos nós sem reescrever o flow
 */
export function repairTypes(
  nodes: RepairableNode[],
  connections: RepairableConnection[]
): TypeRepairResult {
  const statsBefore = calculateTypeStats(
    nodes.map(n => ({
      id: n.id,
      type: n.type,
      impact_level: n.impact_level,
      has_validations: n.has_validations,
      has_required_fields: n.has_required_fields,
    }))
  );
  
  const repairs: TypeRepair[] = [];
  const nodesAdded: RepairableNode[] = [];
  const connectionsAdded: RepairableConnection[] = [];
  const existingIds = new Set(nodes.map(n => n.id));
  
  // Copiar nós para não mutar o original
  const repairedNodes = nodes.map(node => ({ ...node }));
  const repairedConnections = [...connections];
  
  // PASSO 1: Corrigir tipos dos nós existentes
  for (const node of repairedNodes) {
    const inferredType = inferTypeFromContent(node);
    
    if (inferredType !== node.type) {
      repairs.push({
        node_id: node.id,
        repair_type: "type_change",
        old_value: node.type,
        new_value: inferredType,
        reason: `Tipo "${node.type}" inferido como "${inferredType}" baseado no conteúdo`,
      });
      node.type = inferredType;
    }
  }
  
  // PASSO 2: Garantir que existe pelo menos 1 trigger
  const hasTrigger = repairedNodes.some(n => n.type === "trigger");
  if (!hasTrigger && repairedNodes.length > 0) {
    // Verificar se o primeiro nó pode ser promovido a trigger
    const firstNode = repairedNodes[0];
    if (firstNode.type === "action" || firstNode.type === "form") {
      repairs.push({
        node_id: firstNode.id,
        repair_type: "type_change",
        old_value: firstNode.type,
        new_value: "trigger",
        reason: "Primeiro nó promovido a trigger (flow precisa de ponto de entrada)",
      });
      firstNode.type = "trigger";
    }
  }
  
  // PASSO 3: Garantir que existe pelo menos 1 end_success
  const hasEndSuccess = repairedNodes.some(n => 
    n.type === "end_success" || n.type === "end_neutral"
  );
  if (!hasEndSuccess && repairedNodes.length > 0) {
    // Verificar se o último nó pode ser promovido a end_success
    const lastNode = repairedNodes[repairedNodes.length - 1];
    if (lastNode.type === "action" || lastNode.type === "feedback_success") {
      repairs.push({
        node_id: lastNode.id,
        repair_type: "type_change",
        old_value: lastNode.type,
        new_value: "end_success",
        reason: "Último nó promovido a end_success (flow precisa de término)",
      });
      lastNode.type = "end_success";
    }
  }
  
  // PASSO 4: Adicionar feedback_error + loopback para forms críticos sem error handling
  const criticalForms = repairedNodes.filter(n => 
    n.type === "form" && 
    (n.impact_level === "high" || n.impact_level === "medium" || 
     (n.inputs && n.inputs.some(i => i.required || (i.validation_rules && i.validation_rules.length > 0))))
  );
  
  const hasFeedbackError = repairedNodes.some(n => n.type === "feedback_error");
  const hasLoopback = repairedNodes.some(n => n.type === "loopback");
  
  if (criticalForms.length > 0 && !hasFeedbackError) {
    // Adicionar feedback_error
    const feedbackErrorId = generateNodeId("feedback_error", existingIds);
    existingIds.add(feedbackErrorId);
    
    const feedbackErrorNode: RepairableNode = {
      id: feedbackErrorId,
      type: "feedback_error",
      title: "Erro de Validação",
      description: "Exibe mensagem de erro ao usuário",
      user_intent: "Entender o que deu errado",
      system_behavior: "Mostrar feedback de erro claro",
      impact_level: "medium",
      group_label: criticalForms[0].group_label || "Tratamento de Erro",
    };
    
    nodesAdded.push(feedbackErrorNode);
    repairedNodes.push(feedbackErrorNode);
    
    repairs.push({
      node_id: feedbackErrorId,
      repair_type: "node_added",
      new_value: "feedback_error",
      reason: `Adicionado feedback_error para forms críticos (${criticalForms.map(f => f.id).join(", ")})`,
    });
    
    // Conectar primeiro form crítico ao feedback_error
    const formToErrorConn: RepairableConnection = {
      id: `conn_${feedbackErrorId}`,
      source_id: criticalForms[0].id,
      target_id: feedbackErrorId,
      connection_type: "failure",
      label: "Erro",
    };
    connectionsAdded.push(formToErrorConn);
    repairedConnections.push(formToErrorConn);
    
    // Adicionar loopback se não existir
    if (!hasLoopback) {
      const loopbackId = generateNodeId("loopback", existingIds);
      existingIds.add(loopbackId);
      
      const loopbackNode: RepairableNode = {
        id: loopbackId,
        type: "loopback",
        title: "Tentar Novamente",
        description: "Permite ao usuário corrigir os dados",
        user_intent: "Corrigir informações",
        system_behavior: "Retornar ao formulário",
        impact_level: "low",
        group_label: criticalForms[0].group_label || "Tratamento de Erro",
      };
      
      nodesAdded.push(loopbackNode);
      repairedNodes.push(loopbackNode);
      
      repairs.push({
        node_id: loopbackId,
        repair_type: "node_added",
        new_value: "loopback",
        reason: "Adicionado loopback para permitir correção de erros",
      });
      
      // Conectar feedback_error ao loopback
      const errorToLoopbackConn: RepairableConnection = {
        id: `conn_${loopbackId}`,
        source_id: feedbackErrorId,
        target_id: loopbackId,
        connection_type: "default",
        label: "Corrigir",
      };
      connectionsAdded.push(errorToLoopbackConn);
      repairedConnections.push(errorToLoopbackConn);
      
      // Conectar loopback de volta ao form
      const loopbackToFormConn: RepairableConnection = {
        id: `conn_${loopbackId}_back`,
        source_id: loopbackId,
        target_id: criticalForms[0].id,
        connection_type: "loopback",
        label: "Voltar",
      };
      connectionsAdded.push(loopbackToFormConn);
      repairedConnections.push(loopbackToFormConn);
    }
  }
  
  // PASSO 5: Garantir que conditions têm 2 branches
  const conditions = repairedNodes.filter(n => n.type === "condition");
  for (const condition of conditions) {
    const outgoingConns = repairedConnections.filter(c => c.source_id === condition.id);
    
    if (outgoingConns.length < 2) {
      // Adicionar branch faltante
      // Encontrar próximo nó após a condition
      const existingTargets = outgoingConns.map(c => c.target_id);
      
      // Se tem 1 saída, adicionar a segunda apontando para feedback_error ou end_error
      let targetId = repairedNodes.find(n => n.type === "feedback_error")?.id 
                   || repairedNodes.find(n => n.type === "end_error")?.id;
      
      // Se não existe feedback_error ou end_error, criar end_error
      if (!targetId) {
        const endErrorId = generateNodeId("end_error", existingIds);
        existingIds.add(endErrorId);
        
        const endErrorNode: RepairableNode = {
          id: endErrorId,
          type: "end_error",
          title: "Fluxo Interrompido",
          description: "Condição não atendida",
          impact_level: "high",
          group_label: condition.group_label || "Término",
        };
        
        nodesAdded.push(endErrorNode);
        repairedNodes.push(endErrorNode);
        targetId = endErrorId;
        
        repairs.push({
          node_id: endErrorId,
          repair_type: "node_added",
          new_value: "end_error",
          reason: `Adicionado end_error como branch failure para condition ${condition.id}`,
        });
      }
      
      // Adicionar conexão de failure
      const failureConn: RepairableConnection = {
        id: `conn_${condition.id}_failure`,
        source_id: condition.id,
        target_id: targetId,
        connection_type: "failure",
        label: "Não",
      };
      connectionsAdded.push(failureConn);
      repairedConnections.push(failureConn);
      
      repairs.push({
        node_id: condition.id,
        repair_type: "connection_added",
        new_value: `failure -> ${targetId}`,
        reason: `Adicionado branch failure para condition ${condition.id}`,
      });
    }
  }
  
  // Calcular stats depois
  const statsAfter = calculateTypeStats(
    repairedNodes.map(n => ({
      id: n.id,
      type: n.type,
      impact_level: n.impact_level,
      has_validations: n.has_validations,
      has_required_fields: n.has_required_fields,
    }))
  );
  
  // Verificar se ainda precisa de reparo (action ratio ainda alto?)
  const stillNeedsRepair = statsAfter.action_ratio > 0.6 || 
    (statsAfter.total_nodes > 6 && !statsAfter.has_any_branching);
  
  return {
    nodes: repairedNodes,
    connections: repairedConnections,
    repairs_made: repairs,
    nodes_added: nodesAdded,
    connections_added: connectionsAdded,
    stats_before: statsBefore,
    stats_after: statsAfter,
    still_needs_repair: stillNeedsRepair,
  };
}

/**
 * Exportação principal
 */
export const TypeRepairerV3 = {
  repair: repairTypes,
  inferType: inferTypeFromContent,
  isValidType: isValidSemanticTypeV3,
  ALLOWED_TYPES: ALLOWED_SEMANTIC_TYPES_V3,
  LEGACY_TYPE_MAP: LEGACY_TYPE_TO_V3,
};



