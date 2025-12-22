/**
 * Brain Router for Edge Functions (Deno)
 * 
 * Roteamento inteligente de modelos LLM.
 * Espelha lib/brain/router.ts para uso em Deno.
 */

import type {
  BrainMode,
  BrainModel,
  RouteResult,
  ContextStats,
  RiskLevel,
  ModelConfig,
} from "./brain-types.ts";
import {
  resolveModelConfig,
  loadEnvConfig,
  DEFAULT_THRESHOLDS,
  requiresHighReasoningEffort,
} from "./brain-configs.ts";

// ========================================
// ROUTING PATTERNS
// ========================================

const PLAN_PATTERNS = {
  architecture: [
    /criar\s*(nova?)?\s*(arquitetura|estrutura|pipeline)/i,
    /alterar\s*(a?)?\s*(arquitetura|estrutura|pipeline)/i,
    /redesenhar\s*(o?)?\s*(fluxo|flow)/i,
    /refatorar/i,
    /refactor/i,
  ],
  rules: [
    /criar\s*(nova?)?\s*regra/i,
    /adicionar\s*(nova?)?\s*regra/i,
    /alterar\s*(a?)?\s*regra/i,
    /modificar\s*(a?)?\s*regra/i,
    /business\s*rule/i,
    /regra\s*de\s*negócio/i,
  ],
  specs: [
    /gerar\s*(novo?)?\s*(flow)?spec/i,
    /criar\s*(novo?)?\s*spec/i,
    /flow\s*spec/i,
  ],
  conflicts: [
    /conflito/i,
    /conflict/i,
    /inconsisten/i,
    /contradiç/i,
    /contradict/i,
    /corrigir\s*(a?)?\s*lógica/i,
    /branch(ing)?\s*(enforcement|issue|problem)/i,
  ],
  actions: [
    /upsert/i,
    /criar\s*(e|ou)?\s*salvar/i,
    /persistir/i,
    /update\s*(the)?\s*(registry|spec|rule)/i,
  ],
};

const CONSULT_PATTERNS = {
  questions: [
    /^(o\s*que|what)\s+(é|is|são|are)/i,
    /^(qual|which|que)\s/i,
    /^(como|how)\s+(funciona|works|faço|do)/i,
    /^(onde|where)\s+(está|is|fica)/i,
    /\?$/,
  ],
  explanations: [
    /explic(ar|a|ação)/i,
    /me\s*(fala|diz|conta)/i,
    /tell\s*me\s*about/i,
  ],
  simple: [
    /resumo\s*(de|do|da)?/i,
    /summary\s*(of)?/i,
    /listar\s*(os|as)?/i,
    /mostrar\s*(os|as)?/i,
  ],
};

const BATCH_PATTERNS = {
  transformations: [
    /reescrever\s*(todos?|todas?)?/i,
    /rewrite\s*(all)?/i,
    /normalizar\s*(os?|as?)?/i,
    /padronizar\s*(os?|as?)?/i,
  ],
  translations: [
    /traduzir\s*(para|to)?/i,
    /translate\s*(to)?/i,
    /converter\s*(para|to)?/i,
  ],
  bulk: [
    /gerar\s*(várias?|múltipl|varia)/i,
    /generate\s*(multiple|several|variations)/i,
    /extrair\s*(lista|todos?|todas?)/i,
  ],
};

// ========================================
// HELPER FUNCTIONS
// ========================================

function matchesPatterns(prompt: string, patterns: Record<string, RegExp[]>): boolean {
  for (const patternGroup of Object.values(patterns)) {
    for (const pattern of patternGroup) {
      if (pattern.test(prompt)) return true;
    }
  }
  return false;
}

function countPatternMatches(prompt: string, patterns: Record<string, RegExp[]>): number {
  let count = 0;
  for (const patternGroup of Object.values(patterns)) {
    for (const pattern of patternGroup) {
      if (pattern.test(prompt)) count++;
    }
  }
  return count;
}

function isShortQuestion(prompt: string): boolean {
  const wordCount = prompt.trim().split(/\s+/).length;
  const hasQuestionMark = prompt.includes("?");
  const startsWithQuestion = /^(o\s*que|como|onde|qual|quais|quando|por\s*que|what|how|where|which|when|why)/i.test(prompt);
  return wordCount <= 15 && (hasQuestionMark || startsWithQuestion);
}

function estimateComplexity(prompt: string, planMatches: number): number {
  let complexity = 0.5;
  const highComplexityWords = [
    /múltipl(os?|as?)/i, /complex(o?|a?)/i, /todos?\s*(os|as)/i,
    /integra(r|ção)/i, /migra(r|ção)/i, /refatorar/i,
  ];
  for (const word of highComplexityWords) {
    if (word.test(prompt)) complexity += 0.1;
  }
  const wordCount = prompt.split(/\s+/).length;
  if (wordCount > 50) complexity += 0.15;
  if (wordCount > 100) complexity += 0.15;
  if (planMatches >= 3) complexity += 0.2;
  return Math.min(1, Math.max(0, complexity));
}

function estimateRiskLevel(prompt: string): RiskLevel {
  const highRiskPatterns = [
    /delet(ar|e)/i, /remov(er|e)/i, /apagar/i, /migra(r|ção)/i,
    /produção/i, /production/i, /breaking\s*change/i, /todos?\s*(os|as)/i,
  ];
  const mediumRiskPatterns = [
    /alterar/i, /change/i, /modificar/i, /atualizar/i, /update/i,
  ];
  for (const pattern of highRiskPatterns) {
    if (pattern.test(prompt)) return "high";
  }
  for (const pattern of mediumRiskPatterns) {
    if (pattern.test(prompt)) return "medium";
  }
  return "low";
}

function requiresStructuredOutput(prompt: string, mode: BrainMode): boolean {
  if (mode === "PLAN" || mode === "BATCH") return true;
  const structuredPatterns = [/json/i, /estruturad/i, /lista\s*(de|com)/i, /tabela/i];
  return structuredPatterns.some(p => p.test(prompt));
}

function needsToolUse(prompt: string): boolean {
  const toolPatterns = [
    /buscar\s*(no|na|do|da)?\s*(banco|database|db)/i,
    /consultar\s*(o?)?\s*(registry|spec|rule)/i, /query/i, /fetch/i,
  ];
  return toolPatterns.some(p => p.test(prompt));
}

// ========================================
// ROUTING FUNCTIONS
// ========================================

export function routeDeterministic(
  prompt: string,
  contextStats: ContextStats
): RouteResult & { uncertain: boolean } {
  const env = loadEnvConfig();
  const threshold = env.BRAIN_LONG_CONTEXT_THRESHOLD || DEFAULT_THRESHOLDS.LONG_CONTEXT_THRESHOLD;

  // Check LONG_CONTEXT first
  if (contextStats.is_large_context || contextStats.total_tokens_estimate > threshold) {
    const riskLevel = estimateRiskLevel(prompt);
    return {
      mode: "LONG_CONTEXT",
      model: env.BRAIN_MODEL_LONG || "gpt-4o",
      was_uncertain: false,
      used_classifier: false,
      complexity: 0.7,
      risk_level: riskLevel,
      requires_structured_output: true,
      needs_tool_use: false,
      routing_rules_applied: ["context_tokens_exceeded_threshold"],
      routing_reason: `Contexto muito grande (${contextStats.total_tokens_estimate.toLocaleString()} tokens)`,
      uncertain: false,
    };
  }

  const planMatches = countPatternMatches(prompt, PLAN_PATTERNS);
  const consultMatches = countPatternMatches(prompt, CONSULT_PATTERNS);
  const batchMatches = countPatternMatches(prompt, BATCH_PATTERNS);
  const complexity = estimateComplexity(prompt, planMatches);
  const riskLevel = estimateRiskLevel(prompt);
  const isShort = isShortQuestion(prompt);
  const rulesApplied: string[] = [];

  // BATCH
  if (batchMatches >= 2 || (batchMatches >= 1 && planMatches === 0 && consultMatches === 0)) {
    rulesApplied.push("batch_patterns_matched");
    return {
      mode: "BATCH",
      model: env.BRAIN_MODEL_BATCH || "gpt-4o-mini",
      was_uncertain: false,
      used_classifier: false,
      complexity,
      risk_level: riskLevel,
      requires_structured_output: true,
      needs_tool_use: needsToolUse(prompt),
      routing_rules_applied: rulesApplied,
      routing_reason: "Detectado padrão de transformação em lote",
      uncertain: false,
    };
  }

  // PLAN
  if (planMatches >= 2 || (planMatches >= 1 && consultMatches === 0)) {
    rulesApplied.push("plan_patterns_matched");
    const usePro = riskLevel === "high" || requiresHighReasoningEffort(prompt);
    const model = usePro 
      ? (env.BRAIN_MODEL_PLAN_PRO || "o1")
      : (env.BRAIN_MODEL_PLAN || "gpt-4o");
    if (usePro) rulesApplied.push("high_risk_use_pro");
    return {
      mode: "PLAN",
      model,
      was_uncertain: false,
      used_classifier: false,
      complexity,
      risk_level: riskLevel,
      requires_structured_output: true,
      needs_tool_use: needsToolUse(prompt),
      routing_rules_applied: rulesApplied,
      routing_reason: usePro 
        ? "Detectado padrão de planejamento de alto risco" 
        : "Detectado padrão de planejamento/arquitetura",
      uncertain: false,
    };
  }

  // CONSULT
  if (isShort || consultMatches >= 2 || (consultMatches >= 1 && planMatches === 0)) {
    rulesApplied.push(isShort ? "short_question" : "consult_patterns_matched");
    return {
      mode: "CONSULT",
      model: env.BRAIN_MODEL_CONSULT || "gpt-4o-mini",
      was_uncertain: false,
      used_classifier: false,
      complexity,
      risk_level: riskLevel,
      requires_structured_output: requiresStructuredOutput(prompt, "CONSULT"),
      needs_tool_use: needsToolUse(prompt),
      routing_rules_applied: rulesApplied,
      routing_reason: isShort ? "Pergunta curta detectada" : "Detectado padrão de consulta",
      uncertain: false,
    };
  }

  // UNCERTAIN
  rulesApplied.push("no_clear_pattern");
  return {
    mode: "CONSULT",
    model: env.BRAIN_MODEL_CONSULT || "gpt-4o-mini",
    was_uncertain: true,
    used_classifier: false,
    complexity,
    risk_level: riskLevel,
    requires_structured_output: requiresStructuredOutput(prompt, "CONSULT"),
    needs_tool_use: needsToolUse(prompt),
    routing_rules_applied: rulesApplied,
    routing_reason: "Nenhum padrão claro detectado",
    uncertain: true,
  };
}

export async function route(
  prompt: string,
  contextStats: ContextStats,
  classifierFn?: (prompt: string, stats: ContextStats) => Promise<{
    mode: BrainMode;
    complexity: number;
    risk_level: RiskLevel;
    requires_structured_output: boolean;
    needs_tool_use: boolean;
    confidence: number;
  }>
): Promise<RouteResult> {
  const deterministicResult = routeDeterministic(prompt, contextStats);
  const env = loadEnvConfig();
  const classifierEnabled = env.BRAIN_CLASSIFIER_ENABLED ?? DEFAULT_THRESHOLDS.CLASSIFIER_ENABLED;

  if (!deterministicResult.uncertain || !classifierEnabled || !classifierFn) {
    const { uncertain: _, ...result } = deterministicResult;
    return result;
  }

  try {
    const classifierResult = await classifierFn(prompt, contextStats);
    const config = resolveModelConfig(
      classifierResult.mode,
      classifierResult.complexity,
      classifierResult.risk_level
    );
    return {
      mode: classifierResult.mode,
      model: config.model,
      was_uncertain: true,
      used_classifier: true,
      complexity: classifierResult.complexity,
      risk_level: classifierResult.risk_level,
      requires_structured_output: classifierResult.requires_structured_output,
      needs_tool_use: classifierResult.needs_tool_use,
      routing_rules_applied: [...deterministicResult.routing_rules_applied, "classifier_used"],
      routing_reason: `Classifier: ${classifierResult.mode} (${(classifierResult.confidence * 100).toFixed(0)}%)`,
    };
  } catch (error) {
    console.error("[Brain Router] Classifier failed:", error);
    const { uncertain: _, ...result } = deterministicResult;
    return {
      ...result,
      routing_rules_applied: [...result.routing_rules_applied, "classifier_failed_fallback"],
    };
  }
}

export function getModelConfig(routeResult: RouteResult): ModelConfig {
  return resolveModelConfig(routeResult.mode, routeResult.complexity, routeResult.risk_level);
}

export function formatRouteResult(result: RouteResult): string {
  return `Mode: ${result.mode} | Model: ${result.model} | Risk: ${result.risk_level} | Reason: ${result.routing_reason}`;
}




