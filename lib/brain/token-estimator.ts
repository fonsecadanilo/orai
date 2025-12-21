/**
 * Brain Token Estimator v1.0
 * 
 * Estimativa de tokens para decisões de roteamento.
 * Usa heurísticas simples - não precisa ser perfeito,
 * apenas suficiente para decisões de roteamento.
 */

import type {
  ContextStats,
  ProjectContext,
  BusinessRule,
  FlowSpec,
  FlowRegistryItem,
  Persona,
  ProductProfile,
  BrainMessage,
} from "./types";
import { DEFAULT_THRESHOLDS } from "./configs";

// ========================================
// CONSTANTS
// ========================================

/**
 * Média de caracteres por token (aproximação GPT-4)
 * - Inglês: ~4 chars/token
 * - Português: ~3.5 chars/token (mais verbose)
 * - JSON: ~3 chars/token (muita pontuação)
 */
const CHARS_PER_TOKEN = 3.5;

/**
 * Overhead de formatação JSON (chaves, colchetes, etc.)
 */
const JSON_OVERHEAD_MULTIPLIER = 1.15;

/**
 * Overhead do system prompt (aproximado)
 */
const SYSTEM_PROMPT_TOKENS = 1500;

// ========================================
// ESTIMATION FUNCTIONS
// ========================================

/**
 * Estima tokens de uma string
 */
export function estimateStringTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

/**
 * Estima tokens de um objeto JSON
 */
export function estimateJsonTokens(obj: unknown): number {
  if (obj === null || obj === undefined) return 0;
  
  try {
    const json = JSON.stringify(obj);
    return Math.ceil((json.length / CHARS_PER_TOKEN) * JSON_OVERHEAD_MULTIPLIER);
  } catch {
    return 0;
  }
}

/**
 * Estima tokens de uma regra de negócio
 */
export function estimateBusinessRuleTokens(rule: BusinessRule): number {
  return (
    estimateStringTokens(rule.rule_name) +
    estimateStringTokens(rule.description) +
    estimateJsonTokens(rule.conditions) +
    estimateJsonTokens(rule.actions) +
    50 // Overhead de metadados
  );
}

/**
 * Estima tokens de um FlowSpec
 */
export function estimateFlowSpecTokens(spec: FlowSpec): number {
  return (
    estimateStringTokens(spec.spec_name) +
    estimateJsonTokens(spec.spec_content) +
    30 // Overhead de metadados
  );
}

/**
 * Estima tokens de um item do registry
 */
export function estimateRegistryItemTokens(item: FlowRegistryItem): number {
  return (
    estimateStringTokens(item.flow_name) +
    estimateStringTokens(item.flow_type) +
    estimateJsonTokens(item.exit_node_ids) +
    40 // Overhead de metadados
  );
}

/**
 * Estima tokens de uma persona
 */
export function estimatePersonaTokens(persona: Persona): number {
  return (
    estimateStringTokens(persona.role_name) +
    estimateJsonTokens(persona.permissions) +
    estimateJsonTokens(persona.restrictions) +
    estimateJsonTokens(persona.typical_goals) +
    estimateJsonTokens(persona.pain_points) +
    50 // Overhead de metadados
  );
}

/**
 * Estima tokens do perfil do produto
 */
export function estimateProductProfileTokens(profile: ProductProfile | null): number {
  if (!profile) return 0;
  
  return (
    estimateStringTokens(profile.product_name) +
    estimateStringTokens(profile.product_type) +
    estimateStringTokens(profile.main_value_proposition || "") +
    estimateStringTokens(profile.target_audience || "") +
    estimateJsonTokens(profile.key_features) +
    80 // Overhead de metadados
  );
}

/**
 * Estima tokens de uma mensagem do Brain
 */
export function estimateMessageTokens(message: BrainMessage): number {
  return (
    estimateStringTokens(message.content) +
    estimateJsonTokens(message.structured_output) +
    30 // Overhead de metadados
  );
}

// ========================================
// CONTEXT STATS
// ========================================

/**
 * Calcula estatísticas completas do contexto
 */
export function calculateContextStats(
  context: ProjectContext,
  threadMessages: BrainMessage[] = [],
  threshold: number = DEFAULT_THRESHOLDS.LONG_CONTEXT_THRESHOLD
): ContextStats {
  // Calcular tokens por categoria
  const productTokens = estimateProductProfileTokens(context.product_profile);
  
  const personasTokens = context.personas.reduce(
    (sum, p) => sum + estimatePersonaTokens(p), 
    0
  );
  
  const rulesTokens = context.business_rules.reduce(
    (sum, r) => sum + estimateBusinessRuleTokens(r), 
    0
  );
  
  const registryTokens = context.flow_registry.reduce(
    (sum, r) => sum + estimateRegistryItemTokens(r), 
    0
  );
  
  const specsTokens = context.flow_specs.reduce(
    (sum, s) => sum + estimateFlowSpecTokens(s), 
    0
  );
  
  const messagesTokens = threadMessages.reduce(
    (sum, m) => sum + estimateMessageTokens(m), 
    0
  );

  // Total incluindo system prompt
  const totalTokens = 
    SYSTEM_PROMPT_TOKENS +
    productTokens +
    personasTokens +
    rulesTokens +
    registryTokens +
    specsTokens +
    messagesTokens;

  // Encontrar maior item (para decisão de chunking)
  const largestItem = Math.max(
    productTokens,
    ...context.personas.map(p => estimatePersonaTokens(p)),
    ...context.business_rules.map(r => estimateBusinessRuleTokens(r)),
    ...context.flow_specs.map(s => estimateFlowSpecTokens(s)),
    0
  );

  return {
    total_tokens_estimate: totalTokens,
    business_rules_count: context.business_rules.length,
    flow_specs_count: context.flow_specs.length,
    flow_registry_count: context.flow_registry.length,
    personas_count: context.personas.length,
    thread_messages_count: threadMessages.length,
    is_large_context: totalTokens > threshold,
    largest_item_tokens: largestItem,
  };
}

/**
 * Estima tokens de um prompt do usuário
 */
export function estimatePromptTokens(userPrompt: string): number {
  return estimateStringTokens(userPrompt);
}

/**
 * Estima tokens totais de uma requisição
 */
export function estimateTotalRequestTokens(
  contextStats: ContextStats,
  userPrompt: string
): number {
  return (
    contextStats.total_tokens_estimate +
    estimatePromptTokens(userPrompt)
  );
}

// ========================================
// CONTEXT REDUCTION STRATEGIES
// ========================================

/**
 * Estratégias de redução de contexto
 */
export interface ContextReductionStrategy {
  name: string;
  description: string;
  /** Redução estimada de tokens (%) */
  estimated_reduction: number;
  /** Função para aplicar a estratégia */
  apply: (context: ProjectContext) => ProjectContext;
}

/**
 * Estratégia: Incluir apenas regras aprovadas
 */
export const STRATEGY_APPROVED_RULES_ONLY: ContextReductionStrategy = {
  name: "approved_rules_only",
  description: "Incluir apenas regras com status 'approved'",
  estimated_reduction: 30,
  apply: (context) => ({
    ...context,
    business_rules: context.business_rules.filter(r => r.status === "approved"),
  }),
};

/**
 * Estratégia: Incluir apenas specs mais recentes
 */
export const STRATEGY_LATEST_SPECS_ONLY: ContextReductionStrategy = {
  name: "latest_specs_only",
  description: "Incluir apenas a versão mais recente de cada spec",
  estimated_reduction: 40,
  apply: (context) => ({
    ...context,
    flow_specs: context.flow_specs.filter(s => s.is_latest),
  }),
};

/**
 * Estratégia: Limitar número de mensagens do thread
 */
export function createMessageLimitStrategy(maxMessages: number): ContextReductionStrategy {
  return {
    name: `message_limit_${maxMessages}`,
    description: `Limitar a ${maxMessages} mensagens mais recentes`,
    estimated_reduction: 20,
    apply: (context) => context, // Aplicado separadamente nas mensagens
  };
}

/**
 * Aplica estratégias de redução até atingir threshold
 */
export function reduceContextToFit(
  context: ProjectContext,
  threadMessages: BrainMessage[],
  targetTokens: number,
  strategies: ContextReductionStrategy[] = [
    STRATEGY_APPROVED_RULES_ONLY,
    STRATEGY_LATEST_SPECS_ONLY,
  ]
): {
  reducedContext: ProjectContext;
  reducedMessages: BrainMessage[];
  strategiesApplied: string[];
  finalTokens: number;
} {
  let currentContext = { ...context };
  let currentMessages = [...threadMessages];
  const appliedStrategies: string[] = [];

  // Calcular tokens iniciais
  let currentStats = calculateContextStats(currentContext, currentMessages, targetTokens);

  // Se já está dentro do limite, retornar
  if (currentStats.total_tokens_estimate <= targetTokens) {
    return {
      reducedContext: currentContext,
      reducedMessages: currentMessages,
      strategiesApplied: [],
      finalTokens: currentStats.total_tokens_estimate,
    };
  }

  // Aplicar estratégias em ordem
  for (const strategy of strategies) {
    if (currentStats.total_tokens_estimate <= targetTokens) break;

    currentContext = strategy.apply(currentContext);
    appliedStrategies.push(strategy.name);
    currentStats = calculateContextStats(currentContext, currentMessages, targetTokens);
  }

  // Se ainda não couber, limitar mensagens
  if (currentStats.total_tokens_estimate > targetTokens) {
    const messageLimits = [20, 10, 5];
    for (const limit of messageLimits) {
      if (currentStats.total_tokens_estimate <= targetTokens) break;
      
      currentMessages = currentMessages.slice(-limit);
      appliedStrategies.push(`message_limit_${limit}`);
      currentStats = calculateContextStats(currentContext, currentMessages, targetTokens);
    }
  }

  return {
    reducedContext: currentContext,
    reducedMessages: currentMessages,
    strategiesApplied: appliedStrategies,
    finalTokens: currentStats.total_tokens_estimate,
  };
}

// ========================================
// UTILITIES
// ========================================

/**
 * Formata contagem de tokens para exibição
 */
export function formatTokenCount(tokens: number): string {
  if (tokens >= 1_000_000) {
    return `${(tokens / 1_000_000).toFixed(1)}M tokens`;
  }
  if (tokens >= 1_000) {
    return `${(tokens / 1_000).toFixed(1)}k tokens`;
  }
  return `${tokens} tokens`;
}

/**
 * Calcula porcentagem de uso do limite
 */
export function calculateUsagePercentage(
  tokens: number,
  limit: number = DEFAULT_THRESHOLDS.LONG_CONTEXT_THRESHOLD
): number {
  return Math.min(100, Math.round((tokens / limit) * 100));
}

/**
 * Determina se precisa de estratégia RAG
 */
export function needsRAGStrategy(stats: ContextStats): boolean {
  return stats.is_large_context || stats.largest_item_tokens > 50_000;
}


