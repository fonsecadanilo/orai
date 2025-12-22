/**
 * Branching Gates V3.1
 * 
 * Guardrails para garantir que flows tenham ramificações adequadas.
 * 
 * REGRAS:
 * - B1: Conditions devem ter 2 saídas (success/failure)
 * - B2: Forms com validações devem ter feedback_error + loopback
 * - B3: Actions com impact_level=high devem ter failure path
 * - B4: Flows > 6 nós devem ter pelo menos 1 branch
 * 
 * @module branching-gates-v3
 */

export interface BranchingNode {
  id: string;
  type: string;
  title?: string;
  impact_level?: "low" | "medium" | "high";
  has_validations?: boolean;
  has_required_fields?: boolean;
  inputs?: Array<{ required?: boolean; validation_rules?: string[] }>;
  error_cases?: Array<{ error_type: string; handling: string }>;
  group_label?: string;
}

export interface BranchingConnection {
  id?: string;
  source_id: string;
  target_id: string;
  connection_type?: string;
  label?: string;
}

export interface BranchingValidationIssue {
  rule_id: string;
  severity: "error" | "warning";
  message: string;
  node_id?: string;
  details?: Record<string, unknown>;
  auto_fixable: boolean;
}

export interface BranchingValidationResult {
  is_valid: boolean;
  issues: BranchingValidationIssue[];
  needs_enrichment: boolean;
  enrichment_hints: string[];
}

// Tipos que indicam ramificação
const BRANCHING_TYPES = new Set(["condition", "choice", "option_choice", "insight_branch"]);

// Tipos de recovery
const RECOVERY_TYPES = new Set(["retry", "loopback", "fallback", "end_error"]);

/**
 * REGRA B1: Conditions devem ter exatamente 2 saídas
 */
function checkConditionBranches(
  nodes: BranchingNode[],
  connections: BranchingConnection[]
): BranchingValidationIssue[] {
  const issues: BranchingValidationIssue[] = [];
  
  const conditions = nodes.filter(n => n.type === "condition");
  
  for (const condition of conditions) {
    const outgoing = connections.filter(c => c.source_id === condition.id);
    
    if (outgoing.length < 2) {
      issues.push({
        rule_id: "B1_CONDITION_NEEDS_2_BRANCHES",
        severity: "error",
        message: `Condition "${condition.title || condition.id}" tem apenas ${outgoing.length} saída(s). Deve ter 2 (success/failure).`,
        node_id: condition.id,
        details: {
          current_outputs: outgoing.length,
          expected_outputs: 2,
          existing_connections: outgoing.map(c => c.connection_type),
        },
        auto_fixable: true,
      });
    } else if (outgoing.length === 2) {
      // Verificar se tem success E failure
      const hasSuccess = outgoing.some(c => 
        c.connection_type === "success" || c.label?.toLowerCase() === "sim" || c.label?.toLowerCase() === "yes"
      );
      const hasFailure = outgoing.some(c => 
        c.connection_type === "failure" || c.label?.toLowerCase() === "não" || c.label?.toLowerCase() === "no"
      );
      
      if (!hasSuccess || !hasFailure) {
        issues.push({
          rule_id: "B1_CONDITION_MISSING_LABELS",
          severity: "warning",
          message: `Condition "${condition.title || condition.id}" não tem labels claros (Sim/Não).`,
          node_id: condition.id,
          details: {
            has_success: hasSuccess,
            has_failure: hasFailure,
            labels: outgoing.map(c => c.label),
          },
          auto_fixable: true,
        });
      }
    }
  }
  
  return issues;
}

/**
 * REGRA B2: Forms com validações devem ter feedback_error + loopback
 */
function checkFormErrorHandling(
  nodes: BranchingNode[],
  connections: BranchingConnection[]
): BranchingValidationIssue[] {
  const issues: BranchingValidationIssue[] = [];
  
  // Forms que precisam de error handling
  const criticalForms = nodes.filter(n => {
    if (n.type !== "form") return false;
    
    // Impact level medium ou high
    if (n.impact_level === "medium" || n.impact_level === "high") return true;
    
    // Tem campos required ou validações
    if (n.has_validations || n.has_required_fields) return true;
    
    // Tem inputs com required ou validation_rules
    if (n.inputs && n.inputs.some(i => i.required || (i.validation_rules && i.validation_rules.length > 0))) {
      return true;
    }
    
    return false;
  });
  
  if (criticalForms.length === 0) return issues;
  
  // Verificar se existe feedback_error
  const hasFeedbackError = nodes.some(n => n.type === "feedback_error");
  
  // Verificar se existe recovery (loopback, retry, etc.)
  const hasRecovery = nodes.some(n => RECOVERY_TYPES.has(n.type));
  
  if (!hasFeedbackError) {
    issues.push({
      rule_id: "B2_FORM_NO_FEEDBACK_ERROR",
      severity: "error",
      message: `Existem ${criticalForms.length} forms críticos sem feedback_error no flow.`,
      details: {
        critical_forms: criticalForms.map(f => ({ id: f.id, title: f.title })),
      },
      auto_fixable: true,
    });
  }
  
  if (hasFeedbackError && !hasRecovery) {
    issues.push({
      rule_id: "B2_FORM_NO_RECOVERY",
      severity: "error",
      message: `O flow tem feedback_error mas não tem recovery (loopback/retry/fallback).`,
      details: {
        has_feedback_error: hasFeedbackError,
        has_recovery: hasRecovery,
      },
      auto_fixable: true,
    });
  }
  
  // Verificar se forms críticos estão conectados ao feedback_error
  if (hasFeedbackError) {
    const feedbackErrorNodes = nodes.filter(n => n.type === "feedback_error");
    
    for (const form of criticalForms) {
      const formOutgoing = connections.filter(c => c.source_id === form.id);
      const hasFailurePath = formOutgoing.some(c => 
        c.connection_type === "failure" || 
        c.connection_type === "error" ||
        feedbackErrorNodes.some(fe => c.target_id === fe.id)
      );
      
      if (!hasFailurePath) {
        issues.push({
          rule_id: "B2_FORM_NOT_CONNECTED_TO_ERROR",
          severity: "warning",
          message: `Form "${form.title || form.id}" não está conectado ao feedback_error.`,
          node_id: form.id,
          details: {
            outgoing_connections: formOutgoing.map(c => c.connection_type),
          },
          auto_fixable: true,
        });
      }
    }
  }
  
  return issues;
}

/**
 * REGRA B3: Actions com impact_level=high devem ter failure path
 */
function checkCriticalActionErrorHandling(
  nodes: BranchingNode[],
  connections: BranchingConnection[]
): BranchingValidationIssue[] {
  const issues: BranchingValidationIssue[] = [];
  
  const criticalActions = nodes.filter(n => 
    (n.type === "action" || n.type === "background_action") && 
    n.impact_level === "high"
  );
  
  if (criticalActions.length === 0) return issues;
  
  // Verificar se existe algum error handling
  const hasErrorHandling = nodes.some(n => 
    n.type === "feedback_error" || n.type === "end_error" || RECOVERY_TYPES.has(n.type)
  );
  
  if (!hasErrorHandling) {
    issues.push({
      rule_id: "B3_CRITICAL_ACTION_NO_ERROR_HANDLING",
      severity: "warning",
      message: `Existem ${criticalActions.length} actions críticas sem error handling no flow.`,
      details: {
        critical_actions: criticalActions.map(a => ({ id: a.id, title: a.title })),
      },
      auto_fixable: true,
    });
  }
  
  return issues;
}

/**
 * REGRA B4: Flows > 6 nós devem ter pelo menos 1 branch
 */
function checkMinimumBranching(nodes: BranchingNode[]): BranchingValidationIssue[] {
  const issues: BranchingValidationIssue[] = [];
  
  const MIN_NODES_FOR_BRANCHING = 6;
  
  if (nodes.length <= MIN_NODES_FOR_BRANCHING) return issues;
  
  const hasBranching = nodes.some(n => BRANCHING_TYPES.has(n.type));
  
  if (!hasBranching) {
    issues.push({
      rule_id: "B4_NO_BRANCHING_IN_LARGE_FLOW",
      severity: "error",
      message: `Flow com ${nodes.length} nós não tem ramificação. Flows com >${MIN_NODES_FOR_BRANCHING} nós devem ter pelo menos 1 condition ou choice.`,
      details: {
        total_nodes: nodes.length,
        min_nodes_for_branching: MIN_NODES_FOR_BRANCHING,
        branching_types_found: nodes.filter(n => BRANCHING_TYPES.has(n.type)).map(n => n.type),
      },
      auto_fixable: true,
    });
  }
  
  return issues;
}

/**
 * Validação principal de branching
 */
export function validateBranchingV3(
  nodes: BranchingNode[],
  connections: BranchingConnection[]
): BranchingValidationResult {
  const issues: BranchingValidationIssue[] = [];
  const enrichmentHints: string[] = [];
  
  // Aplicar todas as regras
  const b1Issues = checkConditionBranches(nodes, connections);
  issues.push(...b1Issues);
  if (b1Issues.some(i => i.severity === "error")) {
    enrichmentHints.push("BranchingEnricherV3: Adicionar branch failure para conditions");
  }
  
  const b2Issues = checkFormErrorHandling(nodes, connections);
  issues.push(...b2Issues);
  if (b2Issues.some(i => i.severity === "error")) {
    enrichmentHints.push("BranchingEnricherV3: Adicionar feedback_error + loopback para forms");
  }
  
  const b3Issues = checkCriticalActionErrorHandling(nodes, connections);
  issues.push(...b3Issues);
  if (b3Issues.some(i => i.severity === "error" || i.severity === "warning")) {
    enrichmentHints.push("BranchingEnricherV3: Adicionar error handling para actions críticas");
  }
  
  const b4Issues = checkMinimumBranching(nodes);
  issues.push(...b4Issues);
  if (b4Issues.some(i => i.severity === "error")) {
    enrichmentHints.push("TypeRepairerV3: Identificar pontos de decisão e adicionar conditions");
  }
  
  const hasErrors = issues.some(i => i.severity === "error");
  
  return {
    is_valid: !hasErrors,
    issues,
    needs_enrichment: hasErrors,
    enrichment_hints: enrichmentHints,
  };
}

/**
 * Combina validação de tipos e branching
 */
export function runAllGatesV3(
  nodes: BranchingNode[],
  connections: BranchingConnection[]
): {
  type_validation: import("./type-gates-v3").TypeValidationResult;
  branching_validation: BranchingValidationResult;
  is_valid: boolean;
  needs_repair: boolean;
  all_issues: Array<{ source: string; issue: BranchingValidationIssue | import("./type-gates-v3").TypeValidationIssue }>;
} {
  // Import dinâmico para evitar circular dependency
  const { validateTypeDistributionV3 } = require("./type-gates-v3");
  
  const typeValidation = validateTypeDistributionV3(
    nodes.map(n => ({
      id: n.id,
      type: n.type,
      impact_level: n.impact_level,
      has_validations: n.has_validations,
      has_required_fields: n.has_required_fields,
    })),
    connections.map(c => ({
      source_id: c.source_id,
      target_id: c.target_id,
      connection_type: c.connection_type,
    }))
  );
  
  const branchingValidation = validateBranchingV3(nodes, connections);
  
  const allIssues: Array<{ source: string; issue: BranchingValidationIssue | import("./type-gates-v3").TypeValidationIssue }> = [
    ...typeValidation.issues.map(i => ({ source: "type", issue: i })),
    ...branchingValidation.issues.map(i => ({ source: "branching", issue: i })),
  ];
  
  return {
    type_validation: typeValidation,
    branching_validation: branchingValidation,
    is_valid: typeValidation.is_valid && branchingValidation.is_valid,
    needs_repair: typeValidation.needs_repair || branchingValidation.needs_enrichment,
    all_issues: allIssues,
  };
}





