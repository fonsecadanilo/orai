/**
 * Type Gates V3.1
 * 
 * Guardrails para bloquear flows "action-only" e garantir diversidade de tipos.
 * 
 * @module type-gates-v3
 */

// Tipos permitidos no vocabulário v3.1 oficial
export const ALLOWED_SEMANTIC_TYPES_V3 = [
  "trigger",
  "action",
  "condition",
  "form",
  "feedback_success",
  "feedback_error",
  "end_success",
  "end_error",
  "end_neutral",
  "background_action",
  "delayed_action",
  "insight_branch",
  "configuration_matrix",
  "retry",
  "fallback",
  "loopback",
  "choice",
  "option_choice",
] as const;

export type SemanticTypeV3 = typeof ALLOWED_SEMANTIC_TYPES_V3[number];

// Tipos que NÃO contam para o ratio de "action" (são estruturais)
const STRUCTURAL_TYPES = new Set(["trigger", "end_success", "end_error", "end_neutral"]);

// Tipos que indicam ramificação
const BRANCHING_TYPES = new Set(["condition", "choice", "option_choice", "insight_branch"]);

// Tipos que exigem error handling
const TYPES_REQUIRING_ERROR_HANDLING = new Set(["form", "action", "background_action"]);

export interface TypeDistributionStats {
  total_nodes: number;
  countable_nodes: number; // excluindo structural types
  type_distribution: Record<string, number>;
  action_count: number;
  action_ratio: number;
  has_condition: boolean;
  has_choice: boolean;
  has_any_branching: boolean;
  form_count: number;
  feedback_error_count: number;
  recovery_count: number; // retry + loopback + fallback + end_error
}

export interface TypeValidationIssue {
  rule_id: string;
  severity: "error" | "warning";
  message: string;
  details?: Record<string, unknown>;
  auto_fixable: boolean;
}

export interface TypeValidationResult {
  is_valid: boolean;
  issues: TypeValidationIssue[];
  stats: TypeDistributionStats;
  needs_repair: boolean;
  repair_hints: string[];
}

export interface FlowNodeForValidation {
  id: string;
  type: string; // semantic_type ou v3_type
  impact_level?: "low" | "medium" | "high";
  has_validations?: boolean;
  has_required_fields?: boolean;
  group_label?: string;
}

export interface FlowConnectionForValidation {
  source_id: string;
  target_id: string;
  connection_type?: string;
}

/**
 * Calcula estatísticas de distribuição de tipos
 */
export function calculateTypeStats(nodes: FlowNodeForValidation[]): TypeDistributionStats {
  const distribution: Record<string, number> = {};
  
  for (const node of nodes) {
    const type = node.type || "unknown";
    distribution[type] = (distribution[type] || 0) + 1;
  }
  
  const countableNodes = nodes.filter(n => !STRUCTURAL_TYPES.has(n.type));
  const actionCount = distribution["action"] || 0;
  
  return {
    total_nodes: nodes.length,
    countable_nodes: countableNodes.length,
    type_distribution: distribution,
    action_count: actionCount,
    action_ratio: countableNodes.length > 0 ? actionCount / countableNodes.length : 0,
    has_condition: (distribution["condition"] || 0) > 0,
    has_choice: (distribution["choice"] || 0) > 0 || (distribution["option_choice"] || 0) > 0,
    has_any_branching: Array.from(BRANCHING_TYPES).some(t => (distribution[t] || 0) > 0),
    form_count: distribution["form"] || 0,
    feedback_error_count: distribution["feedback_error"] || 0,
    recovery_count: (distribution["retry"] || 0) + 
                    (distribution["loopback"] || 0) + 
                    (distribution["fallback"] || 0) + 
                    (distribution["end_error"] || 0),
  };
}

/**
 * REGRA T1: Se action > 60% dos nós (excluindo trigger/end_*), FAIL
 */
function checkActionRatio(stats: TypeDistributionStats): TypeValidationIssue | null {
  const threshold = 0.6;
  
  if (stats.countable_nodes > 0 && stats.action_ratio > threshold) {
    return {
      rule_id: "T1_ACTION_RATIO",
      severity: "error",
      message: `Action ratio muito alto: ${(stats.action_ratio * 100).toFixed(1)}% > ${threshold * 100}%. O flow está "action-only".`,
      details: {
        action_count: stats.action_count,
        countable_nodes: stats.countable_nodes,
        action_ratio: stats.action_ratio,
        threshold,
      },
      auto_fixable: true,
    };
  }
  
  return null;
}

/**
 * REGRA T2: Se flow tem >6 nós e não tem condition nem choice, FAIL
 */
function checkBranchingRequired(stats: TypeDistributionStats): TypeValidationIssue | null {
  const minNodesForBranching = 6;
  
  if (stats.total_nodes > minNodesForBranching && !stats.has_any_branching) {
    return {
      rule_id: "T2_NO_BRANCHING",
      severity: "error",
      message: `Flow com ${stats.total_nodes} nós não tem ramificação. Flows com >${minNodesForBranching} nós devem ter pelo menos 1 condition ou choice.`,
      details: {
        total_nodes: stats.total_nodes,
        min_nodes_for_branching: minNodesForBranching,
        has_condition: stats.has_condition,
        has_choice: stats.has_choice,
      },
      auto_fixable: true,
    };
  }
  
  return null;
}

/**
 * REGRA T3: Se existe form mas não existe feedback_error + recovery, FAIL
 */
function checkFormErrorHandling(
  stats: TypeDistributionStats, 
  nodes: FlowNodeForValidation[],
  connections: FlowConnectionForValidation[]
): TypeValidationIssue | null {
  if (stats.form_count === 0) return null;
  
  // Verificar se forms críticos têm error handling
  const criticalForms = nodes.filter(n => 
    n.type === "form" && 
    (n.impact_level === "high" || n.impact_level === "medium" || n.has_validations || n.has_required_fields)
  );
  
  if (criticalForms.length > 0 && stats.feedback_error_count === 0) {
    return {
      rule_id: "T3_FORM_NO_ERROR_HANDLING",
      severity: "error",
      message: `Existem ${criticalForms.length} forms críticos mas nenhum feedback_error. Forms com validações devem ter error handling.`,
      details: {
        form_count: stats.form_count,
        critical_forms: criticalForms.length,
        feedback_error_count: stats.feedback_error_count,
        recovery_count: stats.recovery_count,
      },
      auto_fixable: true,
    };
  }
  
  // Verificar se feedback_error tem recovery
  if (stats.feedback_error_count > 0 && stats.recovery_count === 0) {
    return {
      rule_id: "T3_FEEDBACK_NO_RECOVERY",
      severity: "warning",
      message: `Existem ${stats.feedback_error_count} feedback_error mas nenhum recovery (retry/loopback/fallback/end_error).`,
      details: {
        feedback_error_count: stats.feedback_error_count,
        recovery_count: stats.recovery_count,
      },
      auto_fixable: true,
    };
  }
  
  return null;
}

/**
 * REGRA T4: end_* com saída => AUTO FIX (remover)
 */
function checkTerminalOutputs(
  nodes: FlowNodeForValidation[], 
  connections: FlowConnectionForValidation[]
): TypeValidationIssue | null {
  const terminalTypes = new Set(["end_success", "end_error", "end_neutral"]);
  const terminalNodes = nodes.filter(n => terminalTypes.has(n.type));
  
  const terminalsWithOutputs = terminalNodes.filter(terminal => 
    connections.some(c => c.source_id === terminal.id)
  );
  
  if (terminalsWithOutputs.length > 0) {
    return {
      rule_id: "T4_TERMINAL_HAS_OUTPUT",
      severity: "error",
      message: `${terminalsWithOutputs.length} nós terminais têm conexões de saída (devem ser removidas).`,
      details: {
        terminal_ids: terminalsWithOutputs.map(n => n.id),
      },
      auto_fixable: true,
    };
  }
  
  return null;
}

/**
 * Validação principal de distribuição de tipos
 */
export function validateTypeDistributionV3(
  nodes: FlowNodeForValidation[],
  connections: FlowConnectionForValidation[]
): TypeValidationResult {
  const stats = calculateTypeStats(nodes);
  const issues: TypeValidationIssue[] = [];
  const repairHints: string[] = [];
  
  // Aplicar todas as regras
  const t1 = checkActionRatio(stats);
  if (t1) {
    issues.push(t1);
    repairHints.push("TypeRepairerV3: Reclassificar actions com base em intent/behavior");
  }
  
  const t2 = checkBranchingRequired(stats);
  if (t2) {
    issues.push(t2);
    repairHints.push("TypeRepairerV3: Identificar pontos de decisão e adicionar conditions");
  }
  
  const t3 = checkFormErrorHandling(stats, nodes, connections);
  if (t3) {
    issues.push(t3);
    repairHints.push("BranchingEnricherV3: Adicionar feedback_error + loopback para forms");
  }
  
  const t4 = checkTerminalOutputs(nodes, connections);
  if (t4) {
    issues.push(t4);
    repairHints.push("AutoFix: Remover conexões de saída de nós terminais");
  }
  
  const hasErrors = issues.some(i => i.severity === "error");
  
  return {
    is_valid: !hasErrors,
    issues,
    stats,
    needs_repair: hasErrors,
    repair_hints: repairHints,
  };
}

/**
 * Verifica se um tipo é válido no vocabulário v3.1
 */
export function isValidSemanticTypeV3(type: string): type is SemanticTypeV3 {
  return (ALLOWED_SEMANTIC_TYPES_V3 as readonly string[]).includes(type);
}

/**
 * Sugere tipo correto baseado em keywords do título/descrição
 */
export function suggestTypeFromContent(
  title: string, 
  description: string,
  currentType: string
): SemanticTypeV3 {
  const content = `${title} ${description}`.toLowerCase();
  
  // Patterns específicos para cada tipo
  const patterns: Array<{ pattern: RegExp; type: SemanticTypeV3 }> = [
    // Triggers
    { pattern: /\b(start|begin|launch|open|access|entry|trigger|initial)\b/i, type: "trigger" },
    
    // Forms
    { pattern: /\b(form|input|fill|enter|type|submit|email|password|login|register|signup|checkout|payment|card|address|profile|settings)\b/i, type: "form" },
    
    // Conditions
    { pattern: /\b(if|condition|check|verify|valid|invalid|decide|branch|whether)\b/i, type: "condition" },
    
    // Choices
    { pattern: /\b(choose|select|option|pick|method|type of|which|prefer)\b/i, type: "choice" },
    
    // Feedback Success
    { pattern: /\b(success|confirm|complete|done|finish|thank|welcome)\b/i, type: "feedback_success" },
    
    // Feedback Error
    { pattern: /\b(error|fail|invalid|incorrect|wrong|denied|reject)\b/i, type: "feedback_error" },
    
    // Background Actions
    { pattern: /\b(process|load|fetch|call|api|background|async|wait)\b/i, type: "background_action" },
    
    // End states
    { pattern: /\b(end|exit|logout|close|cancel|abort)\b.*\b(success|complete|done)\b/i, type: "end_success" },
    { pattern: /\b(end|exit|close).*\b(error|fail)\b/i, type: "end_error" },
    
    // Retry/Recovery
    { pattern: /\b(retry|try again|repeat|re-?attempt)\b/i, type: "retry" },
    { pattern: /\b(back|return|previous|loopback|go back)\b/i, type: "loopback" },
    { pattern: /\b(fallback|alternative|other|different)\b/i, type: "fallback" },
  ];
  
  for (const { pattern, type } of patterns) {
    if (pattern.test(content)) {
      return type;
    }
  }
  
  // Se já é um tipo válido e não é action, manter
  if (isValidSemanticTypeV3(currentType) && currentType !== "action") {
    return currentType;
  }
  
  // Fallback - mas log para debugging
  console.warn(`[TypeGates] Could not infer type for: "${title}" - defaulting to action`);
  return "action";
}

/**
 * Formata stats para log/metadata
 */
export function formatStatsForMetadata(stats: TypeDistributionStats): Record<string, unknown> {
  return {
    total_nodes: stats.total_nodes,
    type_distribution: stats.type_distribution,
    branching_stats: {
      has_condition: stats.has_condition,
      has_choice: stats.has_choice,
      conditions_count: stats.type_distribution["condition"] || 0,
      choice_count: (stats.type_distribution["choice"] || 0) + (stats.type_distribution["option_choice"] || 0),
      error_paths_count: stats.feedback_error_count,
    },
    quality_metrics: {
      action_ratio: stats.action_ratio,
      has_error_handling: stats.feedback_error_count > 0 && stats.recovery_count > 0,
      recovery_count: stats.recovery_count,
    },
  };
}





