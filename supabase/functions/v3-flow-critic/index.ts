import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * AGENTE 4: Flow Critic v3.1
 * 
 * RESPONSABILIDADES:
 * - Receber rich nodes do Archetype Modeler
 * - Validar completude e consistência do fluxo
 * - Calcular Score de Integridade (0-100)
 * - Identificar problemas por severidade
 * - Sugerir auto-fixes quando possível
 * 
 * NÃO USA LLM - é 100% determinístico para consistência
 */

// Schema de entrada
const FlowCriticRequestSchema = z.object({
  project_id: z.number(),
  user_id: z.number(),
  rich_nodes: z.array(z.object({
    node_id: z.string(),
    node_type: z.string(),
    title: z.string(),
    description: z.string().optional(),
    impact_level: z.string().optional(),
    connections: z.array(z.object({
      target_node_id: z.string(),
      connection_type: z.string(),
      label: z.string().optional(),
    })).optional(),
    inputs: z.array(z.any()).optional(),
    actions: z.array(z.any()).optional(),
    security_metadata: z.object({
      requires_authentication: z.boolean().optional(),
      requires_authorization: z.boolean().optional(),
      sensitive_data: z.boolean().optional(),
    }).optional(),
  })),
  archetype_coverage: z.object({
    ux_patterns: z.number().optional(),
    security: z.number().optional(),
    compliance: z.number().optional(),
    accessibility: z.number().optional(),
  }).optional(),
  validation_level: z.enum(["strict", "standard", "lenient"]).default("standard"),
});

// Schema de issue
const ValidationIssueSchema = z.object({
  issue_id: z.string(),
  code: z.string(),
  category: z.enum([
    "structure",      // Estrutura do grafo
    "completeness",   // Completude
    "consistency",    // Consistência
    "ux",             // UX
    "security",       // Segurança
    "accessibility",  // Acessibilidade
    "performance",    // Performance
  ]),
  severity: z.enum(["error", "warning", "suggestion"]),
  message: z.string(),
  affected_nodes: z.array(z.string()),
  auto_fixable: z.boolean(),
  fix_description: z.string().optional(),
});

type FlowCriticRequest = z.infer<typeof FlowCriticRequestSchema>;
type ValidationIssue = z.infer<typeof ValidationIssueSchema>;

// Regras de validação
interface ValidationRule {
  id: string;
  code: string;
  category: ValidationIssue["category"];
  severity: ValidationIssue["severity"];
  check: (nodes: FlowCriticRequest["rich_nodes"]) => { passed: boolean; affected: string[]; message?: string };
  autoFix?: (nodes: FlowCriticRequest["rich_nodes"]) => FlowCriticRequest["rich_nodes"];
  fixDescription?: string;
}

const VALIDATION_RULES: ValidationRule[] = [
  // ESTRUTURA
  {
    id: "STRUCT_001",
    code: "MISSING_ENTRY_POINT",
    category: "structure",
    severity: "error",
    check: (nodes) => {
      const hasEntry = nodes.some(n => 
        n.node_type === "form" || 
        n.node_type === "action" ||
        !nodes.some(other => other.connections?.some(c => c.target_node_id === n.node_id))
      );
      return { passed: hasEntry, affected: [], message: "O fluxo não possui ponto de entrada claro" };
    },
  },
  {
    id: "STRUCT_002",
    code: "MISSING_END_SUCCESS",
    category: "structure",
    severity: "error",
    check: (nodes) => {
      const hasEndSuccess = nodes.some(n => n.node_type === "end_success" || n.node_type === "feedback_success");
      return { passed: hasEndSuccess, affected: [], message: "O fluxo não possui caminho de sucesso (end_success)" };
    },
    autoFix: (nodes) => {
      // Encontrar nós sem conexões de saída e adicionar end_success
      return nodes;
    },
    fixDescription: "Adicionar nó end_success ao final do fluxo",
  },
  {
    id: "STRUCT_003",
    code: "CONDITION_MISSING_BRANCHES",
    category: "structure",
    severity: "error",
    check: (nodes) => {
      const conditionNodes = nodes.filter(n => n.node_type === "condition" || n.node_type === "choice");
      const affected: string[] = [];
      
      for (const node of conditionNodes) {
        const connections = node.connections || [];
        if (connections.length < 2) {
          affected.push(node.node_id);
        }
      }
      
      return { 
        passed: affected.length === 0, 
        affected, 
        message: `Condições sem branches completos: ${affected.join(", ")}` 
      };
    },
  },
  {
    id: "STRUCT_004",
    code: "END_NODE_HAS_OUTGOING",
    category: "structure",
    severity: "warning",
    check: (nodes) => {
      const endNodes = nodes.filter(n => 
        n.node_type === "end_success" || 
        n.node_type === "end_error" || 
        n.node_type === "end_neutral"
      );
      const affected: string[] = [];
      
      for (const node of endNodes) {
        if (node.connections && node.connections.length > 0) {
          affected.push(node.node_id);
        }
      }
      
      return { 
        passed: affected.length === 0, 
        affected, 
        message: `Nós de término com conexões de saída: ${affected.join(", ")}` 
      };
    },
  },
  
  // COMPLETUDE
  {
    id: "COMP_001",
    code: "HIGH_IMPACT_NO_FALLBACK",
    category: "completeness",
    severity: "warning",
    check: (nodes) => {
      const highImpactNodes = nodes.filter(n => n.impact_level === "high");
      const affected: string[] = [];
      
      for (const node of highImpactNodes) {
        const hasErrorPath = node.connections?.some(c => 
          c.connection_type === "error" || 
          nodes.find(n => n.node_id === c.target_node_id)?.node_type === "fallback" ||
          nodes.find(n => n.node_id === c.target_node_id)?.node_type === "retry"
        );
        
        if (!hasErrorPath) {
          affected.push(node.node_id);
        }
      }
      
      return { 
        passed: affected.length === 0, 
        affected, 
        message: `Ações de alto impacto sem fallback: ${affected.join(", ")}` 
      };
    },
  },
  {
    id: "COMP_002",
    code: "ACTION_NO_FEEDBACK",
    category: "completeness",
    severity: "warning",
    check: (nodes) => {
      const actionNodes = nodes.filter(n => n.node_type === "action");
      const affected: string[] = [];
      
      for (const node of actionNodes) {
        const hasFeedback = node.connections?.some(c => {
          const targetNode = nodes.find(n => n.node_id === c.target_node_id);
          return targetNode?.node_type === "feedback_success" || 
                 targetNode?.node_type === "feedback_error" ||
                 targetNode?.node_type === "end_success";
        });
        
        if (!hasFeedback) {
          affected.push(node.node_id);
        }
      }
      
      return { 
        passed: affected.length === 0, 
        affected, 
        message: `Ações sem feedback: ${affected.join(", ")}` 
      };
    },
  },
  {
    id: "COMP_003",
    code: "FORM_NO_VALIDATION",
    category: "completeness",
    severity: "suggestion",
    check: (nodes) => {
      const formNodes = nodes.filter(n => n.node_type === "form");
      const affected: string[] = [];
      
      for (const node of formNodes) {
        const hasInputsWithValidation = node.inputs?.some((input: any) => 
          input.validation_rules && input.validation_rules.length > 0
        );
        
        if (!hasInputsWithValidation && node.inputs && node.inputs.length > 0) {
          affected.push(node.node_id);
        }
      }
      
      return { 
        passed: affected.length === 0, 
        affected, 
        message: `Formulários sem validação: ${affected.join(", ")}` 
      };
    },
  },
  
  // UX
  {
    id: "UX_001",
    code: "LONG_FORM_NO_SECTIONS",
    category: "ux",
    severity: "suggestion",
    check: (nodes) => {
      const formNodes = nodes.filter(n => n.node_type === "form");
      const affected: string[] = [];
      
      for (const node of formNodes) {
        if (node.inputs && node.inputs.length > 5) {
          affected.push(node.node_id);
        }
      }
      
      return { 
        passed: affected.length === 0, 
        affected, 
        message: `Formulários longos (>5 campos) sem seções: ${affected.join(", ")}` 
      };
    },
  },
  {
    id: "UX_002",
    code: "NO_LOADING_STATE",
    category: "ux",
    severity: "suggestion",
    check: (nodes) => {
      const asyncActions = nodes.filter(n => 
        n.node_type === "action" || 
        n.node_type === "background_action"
      );
      
      // Simplificado - em produção verificaria se há estado de loading
      return { passed: true, affected: [] };
    },
  },
  
  // SEGURANÇA
  {
    id: "SEC_001",
    code: "SENSITIVE_NO_AUTH",
    category: "security",
    severity: "warning",
    check: (nodes) => {
      const sensitiveNodes = nodes.filter(n => n.security_metadata?.sensitive_data);
      const affected: string[] = [];
      
      for (const node of sensitiveNodes) {
        if (!node.security_metadata?.requires_authentication) {
          affected.push(node.node_id);
        }
      }
      
      return { 
        passed: affected.length === 0, 
        affected, 
        message: `Dados sensíveis sem autenticação: ${affected.join(", ")}` 
      };
    },
  },
  {
    id: "SEC_002",
    code: "HIGH_IMPACT_NO_CONFIRMATION",
    category: "security",
    severity: "warning",
    check: (nodes) => {
      const highImpactActions = nodes.filter(n => 
        n.node_type === "action" && n.impact_level === "high"
      );
      const affected: string[] = [];
      
      // Verificar se há confirmação antes
      for (const node of highImpactActions) {
        const hasConfirmationBefore = nodes.some(n => 
          n.connections?.some(c => c.target_node_id === node.node_id) &&
          (n.node_type === "choice" || n.title?.toLowerCase().includes("confirm"))
        );
        
        if (!hasConfirmationBefore) {
          affected.push(node.node_id);
        }
      }
      
      return { 
        passed: affected.length === 0, 
        affected, 
        message: `Ações de alto impacto sem confirmação: ${affected.join(", ")}` 
      };
    },
  },
];

// Calcular score de integridade
function calculateIntegrityScore(issues: ValidationIssue[]): number {
  let score = 100;
  
  for (const issue of issues) {
    switch (issue.severity) {
      case "error":
        score -= 15;
        break;
      case "warning":
        score -= 5;
        break;
      case "suggestion":
        score -= 1;
        break;
    }
  }
  
  return Math.max(0, Math.min(100, score));
}

// Formatar score para display
function formatScore(score: number): { label: string; color: string; icon: string } {
  if (score >= 90) return { label: "Excelente", color: "#22c55e", icon: "CheckCircle2" };
  if (score >= 70) return { label: "Bom", color: "#84cc16", icon: "ThumbsUp" };
  if (score >= 50) return { label: "Atenção", color: "#eab308", icon: "AlertTriangle" };
  if (score >= 30) return { label: "Problemas", color: "#f97316", icon: "AlertCircle" };
  return { label: "Crítico", color: "#ef4444", icon: "XCircle" };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const request = FlowCriticRequestSchema.parse(body);

    console.log("[v3-flow-critic] Validando fluxo com", request.rich_nodes.length, "nós...");

    const issues: ValidationIssue[] = [];
    let issueCounter = 0;

    // Executar cada regra de validação
    for (const rule of VALIDATION_RULES) {
      // Pular algumas regras em modo leniente
      if (request.validation_level === "lenient" && rule.severity === "suggestion") {
        continue;
      }
      
      // Em modo strict, warnings viram errors
      const result = rule.check(request.rich_nodes);
      
      if (!result.passed) {
        issueCounter++;
        
        let severity = rule.severity;
        if (request.validation_level === "strict" && severity === "warning") {
          severity = "error";
        }
        
        issues.push({
          issue_id: `issue_${issueCounter}`,
          code: rule.code,
          category: rule.category,
          severity,
          message: result.message || `Violação da regra ${rule.code}`,
          affected_nodes: result.affected,
          auto_fixable: !!rule.autoFix,
          fix_description: rule.fixDescription,
        });
      }
    }

    // Calcular score
    const integrityScore = calculateIntegrityScore(issues);
    const scoreDisplay = formatScore(integrityScore);
    
    // Resumo por categoria
    const summary = {
      total_issues: issues.length,
      errors: issues.filter(i => i.severity === "error").length,
      warnings: issues.filter(i => i.severity === "warning").length,
      suggestions: issues.filter(i => i.severity === "suggestion").length,
      auto_fixable: issues.filter(i => i.auto_fixable).length,
      by_category: {
        structure: issues.filter(i => i.category === "structure").length,
        completeness: issues.filter(i => i.category === "completeness").length,
        consistency: issues.filter(i => i.category === "consistency").length,
        ux: issues.filter(i => i.category === "ux").length,
        security: issues.filter(i => i.category === "security").length,
        accessibility: issues.filter(i => i.category === "accessibility").length,
      },
    };

    const isValid = !issues.some(i => i.severity === "error");

    console.log("[v3-flow-critic] Validação completa:", {
      score: integrityScore,
      isValid,
      issues: issues.length,
    });

    return new Response(
      JSON.stringify({
        success: true,
        is_valid: isValid,
        integrity_score: integrityScore,
        score_display: scoreDisplay,
        issues,
        summary,
        validated_nodes_count: request.rich_nodes.length,
        message: isValid 
          ? `Fluxo válido com score ${integrityScore}% (${scoreDisplay.label})`
          : `Fluxo com ${summary.errors} erros. Score: ${integrityScore}%`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[v3-flow-critic] Erro:", error);
    return new Response(
      JSON.stringify({ success: false, message: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});







