/**
 * Validador Pós-Construção e Score de Integridade v3.1
 * 
 * Sistema completo de validação de fluxos que verifica:
 * - Estrutura do grafo (trigger, ends, conexões)
 * - Regras de negócio e UX
 * - Completude e consistência
 * - Score final de qualidade
 */

import type { FlowNodeV3, MainNodeType, SubNode } from "@/lib/schemas/nodeTypesV3";

// ========================================
// TIPOS
// ========================================

export type IssueSeverity = "error" | "warning" | "info" | "suggestion";
export type IssueCategory = 
  | "structure"      // Estrutura do grafo
  | "completeness"   // Completude
  | "consistency"    // Consistência
  | "ux"             // UX/Usabilidade
  | "security"       // Segurança
  | "accessibility"  // Acessibilidade
  | "performance";   // Performance

export interface ValidationIssue {
  code: string;
  title: string;
  description: string;
  severity: IssueSeverity;
  category: IssueCategory;
  affected_node_id?: string;
  affected_element?: string;
  suggestion?: string;
  auto_fixable: boolean;
  fix_hint?: string;
}

export interface ValidationResult {
  is_valid: boolean;
  integrity_score: number; // 0-100
  issues: ValidationIssue[];
  stats: FlowStats;
  summary: ValidationSummary;
}

export interface FlowStats {
  total_nodes: number;
  nodes_by_type: Record<string, number>;
  total_connections: number;
  max_depth: number;
  has_error_paths: boolean;
  has_retry_paths: boolean;
  has_fallback_paths: boolean;
  nodes_with_inputs: number;
  total_input_fields: number;
  nodes_with_subnodes: number;
  reused_nodes: number;
}

export interface ValidationSummary {
  errors: number;
  warnings: number;
  info: number;
  suggestions: number;
  auto_fixable: number;
  passed_checks: number;
  total_checks: number;
}

export interface ConnectionInfo {
  source_id: string;
  target_id: string;
  connection_type: string;
  label?: string;
}

// ========================================
// REGRAS DE VALIDAÇÃO
// ========================================

interface ValidationRule {
  id: string;
  title: string;
  category: IssueCategory;
  severity: IssueSeverity;
  check: (nodes: FlowNodeV3[], connections: ConnectionInfo[]) => ValidationIssue | null;
  autoFix?: (nodes: FlowNodeV3[], connections: ConnectionInfo[]) => {
    nodes: FlowNodeV3[];
    connections: ConnectionInfo[];
  };
}

const VALIDATION_RULES: ValidationRule[] = [
  // ========================================
  // REGRAS DE ESTRUTURA
  // ========================================
  
  // Regra: Exatamente 1 trigger/entry
  {
    id: "STRUCT_001",
    title: "Ponto de Entrada Único",
    category: "structure",
    severity: "error",
    check: (nodes) => {
      const entryNodes = nodes.filter(n => 
        n.type === "trigger" || 
        n.type === "form" && nodes.indexOf(n) === 0
      );
      
      if (entryNodes.length === 0) {
        return {
          code: "STRUCT_001",
          title: "Sem Ponto de Entrada",
          description: "O fluxo não possui um nó de entrada (trigger ou primeiro form)",
          severity: "error",
          category: "structure",
          suggestion: "Adicione um nó trigger no início do fluxo",
          auto_fixable: true,
          fix_hint: "Adicionar trigger automático",
        };
      }
      
      if (entryNodes.length > 1) {
        return {
          code: "STRUCT_001",
          title: "Múltiplos Pontos de Entrada",
          description: `O fluxo possui ${entryNodes.length} triggers, deveria ter apenas 1`,
          severity: "error",
          category: "structure",
          affected_node_id: entryNodes[1].id,
          suggestion: "Remova os triggers extras ou converta-os em outro tipo de nó",
          auto_fixable: false,
        };
      }
      
      return null;
    },
    autoFix: (nodes, connections) => {
      const hasEntry = nodes.some(n => n.type === "trigger");
      if (!hasEntry && nodes.length > 0) {
        const triggerNode: FlowNodeV3 = {
          id: `trigger_auto_${Date.now()}`,
          flow_id: nodes[0].flow_id,
          type: "trigger",
          title: "Início do Fluxo",
          description: "Ponto de entrada (adicionado automaticamente)",
          position_x: (nodes[0].position_x || 100) - 280,
          position_y: nodes[0].position_y || 300,
          order_index: 0,
          impact_level: "high",
          reused: false,
        };
        
        const newConnection: ConnectionInfo = {
          source_id: triggerNode.id,
          target_id: nodes[0].id,
          connection_type: "success",
        };
        
        return {
          nodes: [triggerNode, ...nodes],
          connections: [newConnection, ...connections],
        };
      }
      return { nodes, connections };
    },
  },
  
  // Regra: Pelo menos 1 end_success
  {
    id: "STRUCT_002",
    title: "Término de Sucesso",
    category: "structure",
    severity: "error",
    check: (nodes) => {
      const successEnds = nodes.filter(n => 
        n.type === "end_success" || 
        (n.type === "end" && (n.content as any)?.status === "success")
      );
      
      if (successEnds.length === 0) {
        return {
          code: "STRUCT_002",
          title: "Sem Término de Sucesso",
          description: "O fluxo não possui um nó de término com sucesso",
          severity: "error",
          category: "structure",
          suggestion: "Adicione um nó end_success no final do happy path",
          auto_fixable: true,
          fix_hint: "Adicionar end_success automático",
        };
      }
      
      return null;
    },
    autoFix: (nodes, connections) => {
      const hasSuccessEnd = nodes.some(n => 
        n.type === "end_success" || 
        (n.type === "end" && (n.content as any)?.status === "success")
      );
      
      if (!hasSuccessEnd && nodes.length > 0) {
        const lastNode = nodes[nodes.length - 1];
        const endNode: FlowNodeV3 = {
          id: `end_success_auto_${Date.now()}`,
          flow_id: nodes[0].flow_id,
          type: "end_success",
          title: "Fluxo Concluído",
          description: "Término bem-sucedido (adicionado automaticamente)",
          position_x: (lastNode.position_x || 100) + 280,
          position_y: lastNode.position_y || 300,
          order_index: nodes.length,
          impact_level: "high",
          reused: false,
        };
        
        return {
          nodes: [...nodes, endNode],
          connections,
        };
      }
      return { nodes, connections };
    },
  },
  
  // Regra: Conditions têm 2 caminhos
  {
    id: "STRUCT_003",
    title: "Condições com Dois Caminhos",
    category: "structure",
    severity: "error",
    check: (nodes, connections) => {
      const conditions = nodes.filter(n => 
        n.type === "condition" || n.type === "choice"
      );
      
      for (const condition of conditions) {
        const outgoing = connections.filter(c => c.source_id === condition.id);
        
        if (outgoing.length < 2) {
          return {
            code: "STRUCT_003",
            title: "Condição Incompleta",
            description: `A condição "${condition.title}" tem apenas ${outgoing.length} saída(s), deveria ter pelo menos 2`,
            severity: "error",
            category: "structure",
            affected_node_id: condition.id,
            suggestion: "Adicione caminhos 'sim' e 'não' para esta condição",
            auto_fixable: false,
          };
        }
      }
      
      return null;
    },
  },
  
  // Regra: End nodes não têm saídas
  {
    id: "STRUCT_004",
    title: "Nós de Término sem Saídas",
    category: "structure",
    severity: "error",
    check: (nodes, connections) => {
      const endNodes = nodes.filter(n => 
        n.type.startsWith("end_") || n.type === "end"
      );
      
      for (const endNode of endNodes) {
        const outgoing = connections.filter(c => c.source_id === endNode.id);
        
        if (outgoing.length > 0) {
          return {
            code: "STRUCT_004",
            title: "Nó de Término com Saída",
            description: `O nó de término "${endNode.title}" tem ${outgoing.length} conexão(ões) de saída`,
            severity: "error",
            category: "structure",
            affected_node_id: endNode.id,
            suggestion: "Remova as conexões de saída do nó de término",
            auto_fixable: true,
          };
        }
      }
      
      return null;
    },
  },
  
  // ========================================
  // REGRAS DE COMPLETUDE
  // ========================================
  
  // Regra: Fallback após ações sensíveis
  {
    id: "COMP_001",
    title: "Fallback para Ações Sensíveis",
    category: "completeness",
    severity: "warning",
    check: (nodes, connections) => {
      const sensitiveActions = nodes.filter(n => 
        n.type === "background_action" ||
        n.type === "delayed_action" ||
        n.page_key?.includes("payment") ||
        n.page_key?.includes("checkout")
      );
      
      for (const action of sensitiveActions) {
        const hasFailurePath = connections.some(c => 
          c.source_id === action.id && 
          (c.connection_type === "failure" || c.connection_type === "fallback")
        );
        
        if (!hasFailurePath) {
          return {
            code: "COMP_001",
            title: "Sem Caminho de Fallback",
            description: `A ação sensível "${action.title}" não tem caminho de fallback/erro`,
            severity: "warning",
            category: "completeness",
            affected_node_id: action.id,
            suggestion: "Adicione um caminho de fallback para tratamento de erros",
            auto_fixable: false,
          };
        }
      }
      
      return null;
    },
  },
  
  // Regra: Feedback após erro
  {
    id: "COMP_002",
    title: "Feedback após Erros",
    category: "completeness",
    severity: "warning",
    check: (nodes, connections) => {
      const errorPaths = connections.filter(c => 
        c.connection_type === "failure" || c.label?.toLowerCase().includes("erro")
      );
      
      for (const errorPath of errorPaths) {
        const targetNode = nodes.find(n => n.id === errorPath.target_id);
        
        if (targetNode && targetNode.type !== "feedback_error" && targetNode.type !== "retry") {
          return {
            code: "COMP_002",
            title: "Erro sem Feedback",
            description: `Caminho de erro não leva a um nó de feedback_error ou retry`,
            severity: "warning",
            category: "completeness",
            affected_node_id: errorPath.target_id,
            suggestion: "Adicione um nó de feedback_error antes de continuar após erro",
            auto_fixable: false,
          };
        }
      }
      
      return null;
    },
  },
  
  // Regra: Retry onde necessário
  {
    id: "COMP_003",
    title: "Opção de Retry",
    category: "completeness",
    severity: "info",
    check: (nodes) => {
      const formsWithValidation = nodes.filter(n => 
        n.type === "form" && n.inputs?.some(i => i.validation_rules?.length)
      );
      
      const nodesWithRetry = nodes.filter(n => n.allows_retry);
      
      if (formsWithValidation.length > 0 && nodesWithRetry.length === 0) {
        return {
          code: "COMP_003",
          title: "Sem Opção de Retry",
          description: "Formulários com validação não têm opção de retry",
          severity: "info",
          category: "completeness",
          suggestion: "Considere adicionar allows_retry: true em formulários com validação",
          auto_fixable: false,
        };
      }
      
      return null;
    },
  },
  
  // ========================================
  // REGRAS DE UX
  // ========================================
  
  // Regra: Formulários longos
  {
    id: "UX_001",
    title: "Formulários Curtos",
    category: "ux",
    severity: "suggestion",
    check: (nodes) => {
      const formsWithManyFields = nodes.filter(n => 
        n.type === "form" && n.inputs && n.inputs.length > 5
      );
      
      if (formsWithManyFields.length > 0) {
        return {
          code: "UX_001",
          title: "Formulários Longos",
          description: `${formsWithManyFields.length} formulário(s) com mais de 5 campos`,
          severity: "suggestion",
          category: "ux",
          affected_node_id: formsWithManyFields[0].id,
          suggestion: "Considere dividir em múltiplos passos ou usar revelação progressiva",
          auto_fixable: false,
        };
      }
      
      return null;
    },
  },
  
  // Regra: Feedback de sucesso
  {
    id: "UX_002",
    title: "Feedback de Sucesso",
    category: "ux",
    severity: "warning",
    check: (nodes) => {
      const hasSuccessFeedback = nodes.some(n => n.type === "feedback_success");
      const hasSuccessEnd = nodes.some(n => n.type === "end_success");
      
      if (hasSuccessEnd && !hasSuccessFeedback) {
        return {
          code: "UX_002",
          title: "Sem Feedback de Sucesso",
          description: "O fluxo termina com sucesso mas não exibe feedback ao usuário",
          severity: "warning",
          category: "ux",
          suggestion: "Adicione um nó feedback_success antes do término",
          auto_fixable: false,
        };
      }
      
      return null;
    },
  },
  
  // Regra: Campos obrigatórios com validação
  {
    id: "UX_003",
    title: "Validação de Campos Obrigatórios",
    category: "ux",
    severity: "warning",
    check: (nodes) => {
      for (const node of nodes) {
        if (node.type === "form" && node.inputs) {
          for (const input of node.inputs) {
            if (input.required && (!input.validation_rules || input.validation_rules.length === 0)) {
              return {
                code: "UX_003",
                title: "Campo Obrigatório sem Validação",
                description: `Campo "${input.label}" é obrigatório mas não tem regras de validação`,
                severity: "warning",
                category: "ux",
                affected_node_id: node.id,
                affected_element: input.field_name,
                suggestion: "Adicione validation_rules: ['required'] ao campo",
                auto_fixable: true,
              };
            }
          }
        }
      }
      
      return null;
    },
  },
  
  // ========================================
  // REGRAS DE SEGURANÇA
  // ========================================
  
  // Regra: Rate limiting em auth
  {
    id: "SEC_001",
    title: "Rate Limiting em Autenticação",
    category: "security",
    severity: "warning",
    check: (nodes) => {
      const authNodes = nodes.filter(n => 
        n.page_key?.includes("login") ||
        n.page_key?.includes("auth") ||
        n.title.toLowerCase().includes("login")
      );
      
      if (authNodes.length > 0) {
        const hasRateLimiting = authNodes.some(n => 
          n.archetypes_applied?.includes("rate_limiting")
        );
        
        if (!hasRateLimiting) {
          return {
            code: "SEC_001",
            title: "Sem Rate Limiting",
            description: "Fluxo de autenticação não tem rate limiting",
            severity: "warning",
            category: "security",
            affected_node_id: authNodes[0].id,
            suggestion: "Aplique o arquétipo rate_limiting aos nós de autenticação",
            auto_fixable: false,
          };
        }
      }
      
      return null;
    },
  },
  
  // ========================================
  // REGRAS DE ACESSIBILIDADE
  // ========================================
  
  // Regra: Descrições em nós críticos
  {
    id: "A11Y_001",
    title: "Descrições em Nós Críticos",
    category: "accessibility",
    severity: "info",
    check: (nodes) => {
      const criticalNodes = nodes.filter(n => 
        n.impact_level === "high" && 
        (!n.description || n.description.length < 10)
      );
      
      if (criticalNodes.length > 0) {
        return {
          code: "A11Y_001",
          title: "Nó Crítico sem Descrição",
          description: `${criticalNodes.length} nó(s) crítico(s) sem descrição adequada`,
          severity: "info",
          category: "accessibility",
          affected_node_id: criticalNodes[0].id,
          suggestion: "Adicione descrições detalhadas para auxiliar leitores de tela",
          auto_fixable: false,
        };
      }
      
      return null;
    },
  },
];

// ========================================
// FUNÇÕES PRINCIPAIS
// ========================================

/**
 * Valida um fluxo completo
 */
export function validateFlow(
  nodes: FlowNodeV3[],
  connections: ConnectionInfo[]
): ValidationResult {
  const issues: ValidationIssue[] = [];
  let passedChecks = 0;

  // Executar todas as regras
  for (const rule of VALIDATION_RULES) {
    const issue = rule.check(nodes, connections);
    if (issue) {
      issues.push(issue);
    } else {
      passedChecks++;
    }
  }

  // Calcular estatísticas
  const stats = calculateStats(nodes, connections);

  // Calcular score
  const integrityScore = calculateIntegrityScore(issues, stats);

  // Criar resumo
  const summary: ValidationSummary = {
    errors: issues.filter(i => i.severity === "error").length,
    warnings: issues.filter(i => i.severity === "warning").length,
    info: issues.filter(i => i.severity === "info").length,
    suggestions: issues.filter(i => i.severity === "suggestion").length,
    auto_fixable: issues.filter(i => i.auto_fixable).length,
    passed_checks: passedChecks,
    total_checks: VALIDATION_RULES.length,
  };

  return {
    is_valid: summary.errors === 0,
    integrity_score: integrityScore,
    issues,
    stats,
    summary,
  };
}

/**
 * Aplica auto-fixes disponíveis
 */
export function autoFixFlow(
  nodes: FlowNodeV3[],
  connections: ConnectionInfo[]
): {
  nodes: FlowNodeV3[];
  connections: ConnectionInfo[];
  fixes_applied: string[];
} {
  let currentNodes = [...nodes];
  let currentConnections = [...connections];
  const fixesApplied: string[] = [];

  for (const rule of VALIDATION_RULES) {
    if (rule.autoFix) {
      const issue = rule.check(currentNodes, currentConnections);
      if (issue?.auto_fixable) {
        const fixed = rule.autoFix(currentNodes, currentConnections);
        
        // Verificar se o fix resolveu
        const stillHasIssue = rule.check(fixed.nodes, fixed.connections);
        if (!stillHasIssue) {
          currentNodes = fixed.nodes;
          currentConnections = fixed.connections;
          fixesApplied.push(rule.title);
        }
      }
    }
  }

  return {
    nodes: currentNodes,
    connections: currentConnections,
    fixes_applied: fixesApplied,
  };
}

// ========================================
// FUNÇÕES AUXILIARES
// ========================================

function calculateStats(
  nodes: FlowNodeV3[],
  connections: ConnectionInfo[]
): FlowStats {
  const nodesByType: Record<string, number> = {};
  let nodesWithInputs = 0;
  let totalInputFields = 0;
  let nodesWithSubnodes = 0;
  let reusedNodes = 0;
  let maxDepth = 0;

  for (const node of nodes) {
    nodesByType[node.type] = (nodesByType[node.type] || 0) + 1;

    if (node.inputs?.length) {
      nodesWithInputs++;
      totalInputFields += node.inputs.length;
    }

    if (node.children?.length) {
      nodesWithSubnodes++;
    }

    if (node.reuse_info?.is_reused) {
      reusedNodes++;
    }

    // Calcular profundidade máxima
    const depth = node.children?.reduce((max, child) => 
      Math.max(max, 1), 0) || 0;
    maxDepth = Math.max(maxDepth, depth);
  }

  return {
    total_nodes: nodes.length,
    nodes_by_type: nodesByType,
    total_connections: connections.length,
    max_depth: maxDepth,
    has_error_paths: connections.some(c => c.connection_type === "failure"),
    has_retry_paths: nodes.some(n => n.type === "retry"),
    has_fallback_paths: nodes.some(n => n.type === "fallback"),
    nodes_with_inputs: nodesWithInputs,
    total_input_fields: totalInputFields,
    nodes_with_subnodes: nodesWithSubnodes,
    reused_nodes: reusedNodes,
  };
}

function calculateIntegrityScore(
  issues: ValidationIssue[],
  stats: FlowStats
): number {
  let score = 100;

  // Penalidades por severidade
  for (const issue of issues) {
    switch (issue.severity) {
      case "error":
        score -= 20;
        break;
      case "warning":
        score -= 8;
        break;
      case "info":
        score -= 2;
        break;
      case "suggestion":
        score -= 1;
        break;
    }
  }

  // Bônus por boas práticas
  if (stats.has_error_paths) score += 5;
  if (stats.has_retry_paths) score += 3;
  if (stats.has_fallback_paths) score += 3;
  if (stats.nodes_with_inputs > 0 && stats.total_input_fields > 0) score += 2;
  if (stats.nodes_with_subnodes > 0) score += 2;

  return Math.max(0, Math.min(100, score));
}

/**
 * Validação rápida (apenas estrutura)
 */
export function quickValidate(
  nodes: FlowNodeV3[],
  connections: ConnectionInfo[]
): { is_valid: boolean; critical_issues: string[] } {
  const structureRules = VALIDATION_RULES.filter(r => 
    r.category === "structure" && r.severity === "error"
  );
  
  const criticalIssues: string[] = [];
  
  for (const rule of structureRules) {
    const issue = rule.check(nodes, connections);
    if (issue) {
      criticalIssues.push(issue.title);
    }
  }
  
  return {
    is_valid: criticalIssues.length === 0,
    critical_issues: criticalIssues,
  };
}

/**
 * Exporta regras de validação (para exibição na UI)
 */
export function getValidationRules(): Array<{
  id: string;
  title: string;
  category: IssueCategory;
  severity: IssueSeverity;
}> {
  return VALIDATION_RULES.map(r => ({
    id: r.id,
    title: r.title,
    category: r.category,
    severity: r.severity,
  }));
}

/**
 * Formata o score para exibição
 */
export function formatIntegrityScore(score: number): {
  value: number;
  label: string;
  color: string;
  icon: string;
} {
  if (score >= 90) {
    return { value: score, label: "Excelente", color: "#22c55e", icon: "CheckCircle" };
  }
  if (score >= 70) {
    return { value: score, label: "Bom", color: "#84cc16", icon: "ThumbsUp" };
  }
  if (score >= 50) {
    return { value: score, label: "Atenção", color: "#eab308", icon: "AlertTriangle" };
  }
  if (score >= 30) {
    return { value: score, label: "Problemas", color: "#f97316", icon: "AlertCircle" };
  }
  return { value: score, label: "Crítico", color: "#ef4444", icon: "XCircle" };
}









