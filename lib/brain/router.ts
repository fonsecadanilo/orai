/**
 * Brain Router v1.0
 * 
 * Roteamento inteligente de modelos LLM para o Brain Agent.
 * 
 * Pipeline de roteamento:
 * 1. Gate determinístico (sem custo LLM) - baseado em regras
 * 2. Gate classifier (opcional) - usa gpt-5-nano para casos incertos
 * 3. Resolução de modelo e parâmetros
 */

import type {
  BrainMode,
  BrainModel,
  RouteResult,
  ContextStats,
  RiskLevel,
  ModelConfig,
} from "./types";
import {
  resolveModelConfig,
  loadEnvConfig,
  DEFAULT_THRESHOLDS,
  requiresHighReasoningEffort,
} from "./configs";

// ========================================
// ROUTING PATTERNS (DETERMINISTIC)
// ========================================

/**
 * Padrões que indicam modo PLAN
 */
const PLAN_PATTERNS = {
  // Intenções de arquitetura
  architecture: [
    /criar\s*(nova?)?\s*(arquitetura|estrutura|pipeline)/i,
    /alterar\s*(a?)?\s*(arquitetura|estrutura|pipeline)/i,
    /redesenhar\s*(o?)?\s*(fluxo|flow)/i,
    /refatorar/i,
    /refactor/i,
    /restruturar/i,
    /restructure/i,
  ],
  // Intenções de regras
  rules: [
    /criar\s*(nova?)?\s*regra/i,
    /adicionar\s*(nova?)?\s*regra/i,
    /alterar\s*(a?)?\s*regra/i,
    /modificar\s*(a?)?\s*regra/i,
    /definir\s*(nova?)?\s*regra/i,
    /mudar\s*(as?)?\s*regras/i,
    /business\s*rule/i,
    /regra\s*de\s*negócio/i,
  ],
  // Intenções de specs
  specs: [
    /gerar\s*(novo?)?\s*(flow)?spec/i,
    /criar\s*(novo?)?\s*spec/i,
    /flow\s*spec/i,
    /especificação\s*(de|do)?\s*fluxo/i,
  ],
  // Conflitos e correções
  conflicts: [
    /conflito/i,
    /conflict/i,
    /inconsisten/i,
    /contradiç/i,
    /contradict/i,
    /não\s*(está|estão)\s*bifurcando/i,
    /corrigir\s*(a?)?\s*lógica/i,
    /fix\s*(the)?\s*logic/i,
    /branch(ing)?\s*(enforcement|issue|problem)/i,
    /tem\s*(um|uma)?\s*conflito/i,
    /está\s*inconsistente/i,
    /resolver\s*(o?)?\s*conflito/i,
  ],
  // Planejamento de produto
  planning: [
    /planejar\s*(o?)?\s*produto/i,
    /roadmap/i,
    /plano\s*(de)?\s*(migração|migration)/i,
    /estratégia\s*(de)?\s*(implementação|implementation)/i,
    /migração\s*(de|para)?\s*produção/i,
    /migration/i,
  ],
  // Actions estruturadas
  actions: [
    /upsert/i,
    /criar\s*(e|ou)?\s*salvar/i,
    /persistir/i,
    /gravar\s*(no|na)?\s*(banco|database|db)/i,
    /update\s*(the)?\s*(registry|spec|rule)/i,
  ],
  // Operações destrutivas que requerem planejamento
  destructive: [
    /deletar\s*(todas?|todos?)/i,
    /delete\s*all/i,
    /remover\s*(todas?|todos?)/i,
    /remove\s*all/i,
    /apagar\s*(todas?|todos?)/i,
    /migrar\s*(para|de)/i,
  ],
};

/**
 * Padrões que indicam modo CONSULT
 */
const CONSULT_PATTERNS = {
  // Perguntas diretas
  questions: [
    /^(o\s*que|what)\s+(é|is|são|are)/i,
    /^(qual|which|que)\s/i,
    /^(como|how)\s+(funciona|works|faço|do|fazer)/i,
    /^(onde|where)\s+(está|is|fica|find)/i,
    /^(por\s*que|why)\s/i,
    /^(quando|when)\s/i,
    /^\?\s/i,
    /\?$/,
  ],
  // Explicações
  explanations: [
    /explic(ar|a|ação|ation)/i,
    /me\s*(fala|diz|conta)/i,
    /tell\s*me\s*about/i,
    /can\s*you\s*explain/i,
    /o\s*que\s*significa/i,
    /what\s*does.*mean/i,
  ],
  // Consultas simples
  simple: [
    /resumo\s*(de|do|da)?/i,
    /summary\s*(of)?/i,
    /listar\s*(os|as)?/i,
    /list\s*(the|all)?/i,
    /mostrar\s*(os|as)?/i,
    /show\s*(me)?\s*(the)?/i,
    /qual\s*(é|são)\s*(o|a|os|as)?/i,
  ],
  // Sugestões
  suggestions: [
    /sugest(ão|ões|ir|ion)/i,
    /recomend(ar|ação|ation)/i,
    /você\s*acha/i,
    /what\s*do\s*you\s*think/i,
    /alguma\s*ideia/i,
    /any\s*idea/i,
  ],
};

/**
 * Padrões que indicam modo BATCH
 */
const BATCH_PATTERNS = {
  // Transformações
  transformations: [
    /reescrever\s*(todos?|todas?|tudo)?/i,
    /rewrite\s*(all)?/i,
    /normalizar\s*(os?|as?)?/i,
    /normalize\s*(the|all)?/i,
    /padronizar\s*(os?|as?)?/i,
    /standardize\s*(the|all)?/i,
  ],
  // Traduções
  translations: [
    /traduzir\s*(para|to)?/i,
    /translate\s*(to)?/i,
    /converter\s*(para|to)?/i,
    /convert\s*(to)?/i,
  ],
  // Geração em massa
  bulk: [
    /gerar\s*(várias?|múltipl|varia)/i,
    /generate\s*(multiple|several|variations)/i,
    /criar\s*(várias?|múltipl)/i,
    /create\s*(multiple|several)/i,
    /extrair\s*(lista|todos?|todas?)/i,
    /extract\s*(list|all)/i,
    /extrair\s+lista/i,
  ],
  // Formatação
  formatting: [
    /formatar\s*(todos?|todas?)?/i,
    /format\s*(all)?/i,
    /reformatar/i,
    /reformat/i,
    /ajustar\s*(os?|as?)?\s*labels/i,
    /fix\s*(the)?\s*labels/i,
  ],
  // Variações
  variations: [
    /gerar\s*variações/i,
    /generate\s*variations/i,
  ],
};

// ========================================
// DETERMINISTIC ROUTING
// ========================================

/**
 * Verifica se prompt corresponde a padrões
 */
function matchesPatterns(prompt: string, patterns: Record<string, RegExp[]>): boolean {
  for (const patternGroup of Object.values(patterns)) {
    for (const pattern of patternGroup) {
      if (pattern.test(prompt)) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Conta quantos padrões correspondem
 */
function countPatternMatches(prompt: string, patterns: Record<string, RegExp[]>): number {
  let count = 0;
  for (const patternGroup of Object.values(patterns)) {
    for (const pattern of patternGroup) {
      if (pattern.test(prompt)) {
        count++;
      }
    }
  }
  return count;
}

/**
 * Determina se é pergunta curta
 */
function isShortQuestion(prompt: string): boolean {
  const wordCount = prompt.trim().split(/\s+/).length;
  const hasQuestionMark = prompt.includes("?");
  const startsWithQuestion = /^(o\s*que|como|onde|qual|quais|quando|por\s*que|what|how|where|which|when|why)/i.test(prompt);
  
  return wordCount <= 15 && (hasQuestionMark || startsWithQuestion);
}

/**
 * Determina complexidade baseada no prompt
 */
function estimateComplexity(
  prompt: string,
  planMatches: number,
  consultMatches: number,
  batchMatches: number
): number {
  // Fatores de complexidade
  let complexity = 0.5; // Base
  
  // Palavras que indicam complexidade alta
  const highComplexityWords = [
    /múltipl(os?|as?)/i,
    /multiple/i,
    /complex(o?|a?)/i,
    /todos?\s*(os|as)/i,
    /all\s*(the)?/i,
    /integra(r|ção)/i,
    /integration/i,
    /migra(r|ção)/i,
    /migration/i,
    /refatorar/i,
    /refactor/i,
  ];
  
  for (const word of highComplexityWords) {
    if (word.test(prompt)) {
      complexity += 0.1;
    }
  }
  
  // Prompt longo = mais complexo
  const wordCount = prompt.split(/\s+/).length;
  if (wordCount > 50) complexity += 0.15;
  if (wordCount > 100) complexity += 0.15;
  
  // Muitos matches de PLAN = mais complexo
  if (planMatches >= 3) complexity += 0.2;
  
  // Normalize
  return Math.min(1, Math.max(0, complexity));
}

/**
 * Determina nível de risco baseado no prompt
 */
function estimateRiskLevel(prompt: string): RiskLevel {
  // Palavras de alto risco
  const highRiskPatterns = [
    /delet(ar|e)/i,
    /remov(er|e)/i,
    /apagar/i,
    /migra(r|ção)/i,
    /migration/i,
    /produção/i,
    /production/i,
    /breaking\s*change/i,
    /irreversível/i,
    /irreversible/i,
    /todos?\s*(os|as)/i,
    /all\s*(records|data|rules)/i,
  ];
  
  // Palavras de risco médio
  const mediumRiskPatterns = [
    /alterar/i,
    /change/i,
    /modificar/i,
    /modify/i,
    /atualizar/i,
    /update/i,
    /substituir/i,
    /replace/i,
  ];
  
  for (const pattern of highRiskPatterns) {
    if (pattern.test(prompt)) {
      return "high";
    }
  }
  
  for (const pattern of mediumRiskPatterns) {
    if (pattern.test(prompt)) {
      return "medium";
    }
  }
  
  return "low";
}

/**
 * Detecta se precisa de output estruturado
 */
function requiresStructuredOutput(prompt: string, mode: BrainMode): boolean {
  // PLAN sempre precisa de output estruturado
  if (mode === "PLAN") return true;
  
  // BATCH geralmente precisa
  if (mode === "BATCH") return true;
  
  // Padrões que indicam necessidade de estrutura
  const structuredPatterns = [
    /json/i,
    /estruturad(o|a)/i,
    /structured/i,
    /lista\s*(de|com)/i,
    /list\s*(of|with)/i,
    /tabela/i,
    /table/i,
    /gerar\s*(o?)?\s*(arquivo|file)/i,
  ];
  
  return structuredPatterns.some(p => p.test(prompt));
}

/**
 * Detecta se precisa usar ferramentas (DB, etc.)
 */
function needsToolUse(prompt: string): boolean {
  const toolPatterns = [
    /buscar\s*(no|na|do|da)?\s*(banco|database|db)/i,
    /search\s*(the)?\s*(database|db)/i,
    /consultar\s*(o?)?\s*(registry|spec|rule)/i,
    /query/i,
    /fetch/i,
    /verificar\s*(se)?\s*(existe|exists)/i,
    /check\s*(if)?\s*(exists)/i,
  ];
  
  return toolPatterns.some(p => p.test(prompt));
}

/**
 * Roteamento determinístico (primeiro gate)
 */
export function routeDeterministic(
  prompt: string,
  contextStats: ContextStats
): RouteResult & { uncertain: boolean } {
  const env = loadEnvConfig();
  const threshold = env.BRAIN_LONG_CONTEXT_THRESHOLD || DEFAULT_THRESHOLDS.LONG_CONTEXT_THRESHOLD;
  
  // Verificar LONG_CONTEXT primeiro (contexto muito grande)
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
      routing_reason: `Contexto muito grande (${contextStats.total_tokens_estimate.toLocaleString()} tokens > ${threshold.toLocaleString()})`,
      uncertain: false,
    };
  }
  
  // Contar matches por categoria
  const planMatches = countPatternMatches(prompt, PLAN_PATTERNS);
  const consultMatches = countPatternMatches(prompt, CONSULT_PATTERNS);
  const batchMatches = countPatternMatches(prompt, BATCH_PATTERNS);
  
  // Estimar métricas
  const complexity = estimateComplexity(prompt, planMatches, consultMatches, batchMatches);
  const riskLevel = estimateRiskLevel(prompt);
  const isShort = isShortQuestion(prompt);
  
  // Regras aplicadas
  const rulesApplied: string[] = [];
  
  // BATCH: padrões claros de transformação em lote
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
  
  // PLAN: padrões claros de arquitetura/regras/specs
  if (planMatches >= 2 || (planMatches >= 1 && consultMatches === 0)) {
    rulesApplied.push("plan_patterns_matched");
    
    // Decidir entre PLAN normal e PLAN_PRO
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
  
  // CONSULT: pergunta curta ou padrões claros de consulta
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
      routing_reason: isShort 
        ? "Pergunta curta detectada" 
        : "Detectado padrão de consulta/explicação",
      uncertain: false,
    };
  }
  
  // INCERTO: matches ambíguos ou nenhum match claro
  rulesApplied.push("no_clear_pattern");
  
  return {
    mode: "CONSULT", // Default para CONSULT quando incerto
    model: env.BRAIN_MODEL_CONSULT || "gpt-4o-mini",
    was_uncertain: true,
    used_classifier: false,
    complexity,
    risk_level: riskLevel,
    requires_structured_output: requiresStructuredOutput(prompt, "CONSULT"),
    needs_tool_use: needsToolUse(prompt),
    routing_rules_applied: rulesApplied,
    routing_reason: "Nenhum padrão claro detectado - usando classifier",
    uncertain: true,
  };
}

// ========================================
// ROUTE WITH CLASSIFIER FALLBACK
// ========================================

/**
 * Roteamento completo com classifier opcional
 */
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
  // Primeiro gate: determinístico
  const deterministicResult = routeDeterministic(prompt, contextStats);
  
  // Se não incerto ou classifier não habilitado, retorna resultado determinístico
  const env = loadEnvConfig();
  const classifierEnabled = env.BRAIN_CLASSIFIER_ENABLED ?? DEFAULT_THRESHOLDS.CLASSIFIER_ENABLED;
  
  if (!deterministicResult.uncertain || !classifierEnabled || !classifierFn) {
    // Remove a propriedade uncertain antes de retornar
    const { uncertain: _, ...result } = deterministicResult;
    return result;
  }
  
  // Segundo gate: classifier
  try {
    const classifierResult = await classifierFn(prompt, contextStats);
    
    // Resolve modelo baseado no resultado do classifier
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
      routing_reason: `Classifier determinou modo ${classifierResult.mode} (confiança: ${(classifierResult.confidence * 100).toFixed(0)}%)`,
    };
  } catch (error) {
    // Se classifier falhar, usa resultado determinístico
    console.error("[Brain Router] Classifier falhou, usando fallback determinístico:", error);
    const { uncertain: _, ...result } = deterministicResult;
    return {
      ...result,
      routing_rules_applied: [...result.routing_rules_applied, "classifier_failed_fallback"],
      routing_reason: `${result.routing_reason} (classifier falhou)`,
    };
  }
}

// ========================================
// MODEL RESOLUTION
// ========================================

/**
 * Resolve configuração completa do modelo
 */
export function getModelConfig(routeResult: RouteResult): ModelConfig {
  return resolveModelConfig(
    routeResult.mode,
    routeResult.complexity,
    routeResult.risk_level
  );
}

// ========================================
// UTILITIES
// ========================================

/**
 * Formata resultado do roteamento para logging
 */
export function formatRouteResult(result: RouteResult): string {
  return [
    `Mode: ${result.mode}`,
    `Model: ${result.model}`,
    `Complexity: ${(result.complexity * 100).toFixed(0)}%`,
    `Risk: ${result.risk_level}`,
    `Rules: ${result.routing_rules_applied.join(", ")}`,
    `Reason: ${result.routing_reason}`,
  ].join(" | ");
}

/**
 * Verifica se deve usar RAG ao invés de LONG_CONTEXT direto
 */
export function shouldUseRAG(contextStats: ContextStats): boolean {
  const env = loadEnvConfig();
  const threshold = env.BRAIN_LONG_CONTEXT_THRESHOLD || DEFAULT_THRESHOLDS.LONG_CONTEXT_THRESHOLD;
  
  // Se contexto é moderadamente grande (entre 50% e 100% do threshold), preferir RAG
  const usageRatio = contextStats.total_tokens_estimate / threshold;
  return usageRatio >= 0.5 && usageRatio <= 1.5;
}

