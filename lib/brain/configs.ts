/**
 * Brain Router Configs v1.0
 * 
 * Configurações por modo de operação do Brain.
 * Todos os parâmetros são configuráveis via variáveis de ambiente.
 */

import type {
  BrainMode,
  BrainModel,
  ModelConfig,
  ModeConfigs,
  BrainEnvConfig,
  ReasoningEffort,
  TextVerbosity,
} from "./types";

// ========================================
// DEFAULT VALUES
// ========================================

/**
 * Valores padrão para modelos por modo
 * Nota: Usando modelos atuais como fallback enquanto gpt-5.x não estão disponíveis
 */
const DEFAULT_MODELS: Record<string, BrainModel> = {
  PLAN: "gpt-4o",           // Substituir por gpt-5.2 quando disponível
  PLAN_PRO: "o1",           // Substituir por gpt-5.2-pro quando disponível
  CONSULT: "gpt-4o-mini",   // Substituir por gpt-5-mini quando disponível
  BATCH: "gpt-4o-mini",     // Substituir por gpt-5-nano quando disponível
  LONG_CONTEXT: "gpt-4o",   // Substituir por gpt-4.1 quando disponível
};

/**
 * Cadeias de fallback por modo
 */
const FALLBACK_CHAINS: Record<string, BrainModel[]> = {
  PLAN: ["gpt-4o", "gpt-4o-mini"],
  PLAN_PRO: ["o1", "gpt-4o", "gpt-4o-mini"],
  CONSULT: ["gpt-4o-mini", "gpt-4o"],
  BATCH: ["gpt-4o-mini", "gpt-4o"],
  LONG_CONTEXT: ["gpt-4o", "gpt-4o-mini"],
};

/**
 * Limiares padrão
 */
export const DEFAULT_THRESHOLDS = {
  /** Limiar de tokens para considerar contexto grande */
  LONG_CONTEXT_THRESHOLD: 250_000,
  /** Limiar de complexidade para usar modelo PRO */
  HIGH_COMPLEXITY_THRESHOLD: 0.6,
  /** Habilitar classifier por padrão */
  CLASSIFIER_ENABLED: true,
};

// ========================================
// ENVIRONMENT LOADING
// ========================================

/**
 * Carrega configuração do ambiente
 */
export function loadEnvConfig(): Partial<BrainEnvConfig> {
  // Em runtime Deno (Edge Functions)
  if (typeof Deno !== "undefined") {
    return {
      BRAIN_MODEL_PLAN: (Deno.env.get("BRAIN_MODEL_PLAN") as BrainModel) || DEFAULT_MODELS.PLAN,
      BRAIN_MODEL_PLAN_PRO: (Deno.env.get("BRAIN_MODEL_PLAN_PRO") as BrainModel) || DEFAULT_MODELS.PLAN_PRO,
      BRAIN_MODEL_CONSULT: (Deno.env.get("BRAIN_MODEL_CONSULT") as BrainModel) || DEFAULT_MODELS.CONSULT,
      BRAIN_MODEL_BATCH: (Deno.env.get("BRAIN_MODEL_BATCH") as BrainModel) || DEFAULT_MODELS.BATCH,
      BRAIN_MODEL_LONG: (Deno.env.get("BRAIN_MODEL_LONG") as BrainModel) || DEFAULT_MODELS.LONG_CONTEXT,
      BRAIN_LONG_CONTEXT_THRESHOLD: parseInt(Deno.env.get("BRAIN_LONG_CONTEXT_THRESHOLD") || String(DEFAULT_THRESHOLDS.LONG_CONTEXT_THRESHOLD)),
      BRAIN_CLASSIFIER_ENABLED: Deno.env.get("BRAIN_CLASSIFIER_ENABLED") !== "false",
      BRAIN_HIGH_COMPLEXITY_THRESHOLD: parseFloat(Deno.env.get("BRAIN_HIGH_COMPLEXITY_THRESHOLD") || String(DEFAULT_THRESHOLDS.HIGH_COMPLEXITY_THRESHOLD)),
      OPENAI_API_KEY: Deno.env.get("OPENAI_API_KEY") || "",
      SUPABASE_URL: Deno.env.get("SUPABASE_URL") || "",
      SUPABASE_SERVICE_ROLE_KEY: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "",
    };
  }

  // Em runtime Node.js (Next.js)
  return {
    BRAIN_MODEL_PLAN: (process.env.BRAIN_MODEL_PLAN as BrainModel) || DEFAULT_MODELS.PLAN,
    BRAIN_MODEL_PLAN_PRO: (process.env.BRAIN_MODEL_PLAN_PRO as BrainModel) || DEFAULT_MODELS.PLAN_PRO,
    BRAIN_MODEL_CONSULT: (process.env.BRAIN_MODEL_CONSULT as BrainModel) || DEFAULT_MODELS.CONSULT,
    BRAIN_MODEL_BATCH: (process.env.BRAIN_MODEL_BATCH as BrainModel) || DEFAULT_MODELS.BATCH,
    BRAIN_MODEL_LONG: (process.env.BRAIN_MODEL_LONG as BrainModel) || DEFAULT_MODELS.LONG_CONTEXT,
    BRAIN_LONG_CONTEXT_THRESHOLD: parseInt(process.env.BRAIN_LONG_CONTEXT_THRESHOLD || String(DEFAULT_THRESHOLDS.LONG_CONTEXT_THRESHOLD)),
    BRAIN_CLASSIFIER_ENABLED: process.env.BRAIN_CLASSIFIER_ENABLED !== "false",
    BRAIN_HIGH_COMPLEXITY_THRESHOLD: parseFloat(process.env.BRAIN_HIGH_COMPLEXITY_THRESHOLD || String(DEFAULT_THRESHOLDS.HIGH_COMPLEXITY_THRESHOLD)),
    OPENAI_API_KEY: process.env.OPENAI_API_KEY || "",
    SUPABASE_URL: process.env.SUPABASE_URL || "",
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || "",
  };
}

// ========================================
// MODE CONFIGS
// ========================================

/**
 * Configuração para modo PLAN
 */
export function getPlanConfig(highEffort: boolean = false): ModelConfig {
  const env = loadEnvConfig();
  
  return {
    model: env.BRAIN_MODEL_PLAN || DEFAULT_MODELS.PLAN,
    reasoning_effort: highEffort ? "high" : "medium",
    text_verbosity: "medium",
    max_output_tokens: 16_000,
    json_schema_name: "BrainOutput",
    temperature: 0.3,
    fallback_chain: FALLBACK_CHAINS.PLAN,
  };
}

/**
 * Configuração para modo PLAN_PRO (conflitos severos, alto risco)
 */
export function getPlanProConfig(): ModelConfig {
  const env = loadEnvConfig();
  
  return {
    model: env.BRAIN_MODEL_PLAN_PRO || DEFAULT_MODELS.PLAN_PRO,
    reasoning_effort: "high",
    text_verbosity: "medium",
    max_output_tokens: 32_000,
    json_schema_name: "BrainOutput",
    temperature: 0.2,
    fallback_chain: FALLBACK_CHAINS.PLAN_PRO,
  };
}

/**
 * Configuração para modo CONSULT
 */
export function getConsultConfig(): ModelConfig {
  const env = loadEnvConfig();
  
  return {
    model: env.BRAIN_MODEL_CONSULT || DEFAULT_MODELS.CONSULT,
    reasoning_effort: "low",
    text_verbosity: "low",
    max_output_tokens: 4_000,
    json_schema_name: undefined, // Opcional para CONSULT
    temperature: 0.5,
    fallback_chain: FALLBACK_CHAINS.CONSULT,
  };
}

/**
 * Configuração para modo BATCH
 */
export function getBatchConfig(): ModelConfig {
  const env = loadEnvConfig();
  
  return {
    model: env.BRAIN_MODEL_BATCH || DEFAULT_MODELS.BATCH,
    reasoning_effort: "minimal",
    text_verbosity: "low",
    max_output_tokens: 8_000,
    json_schema_name: "BrainOutput",
    temperature: 0.2,
    fallback_chain: FALLBACK_CHAINS.BATCH,
  };
}

/**
 * Configuração para modo LONG_CONTEXT
 */
export function getLongContextConfig(): ModelConfig {
  const env = loadEnvConfig();
  
  return {
    model: env.BRAIN_MODEL_LONG || DEFAULT_MODELS.LONG_CONTEXT,
    reasoning_effort: "medium",
    text_verbosity: "medium",
    max_output_tokens: 16_000,
    json_schema_name: "BrainOutput",
    temperature: 0.3,
    fallback_chain: FALLBACK_CHAINS.LONG_CONTEXT,
  };
}

/**
 * Retorna todas as configurações por modo
 */
export function getAllModeConfigs(): ModeConfigs {
  return {
    PLAN: getPlanConfig(false),
    PLAN_PRO: getPlanProConfig(),
    CONSULT: getConsultConfig(),
    BATCH: getBatchConfig(),
    LONG_CONTEXT: getLongContextConfig(),
  };
}

/**
 * Resolve configuração baseado em mode, complexity e risk
 */
export function resolveModelConfig(
  mode: BrainMode,
  complexity: number,
  riskLevel: "low" | "medium" | "high"
): ModelConfig {
  const env = loadEnvConfig();
  const highComplexityThreshold = env.BRAIN_HIGH_COMPLEXITY_THRESHOLD || DEFAULT_THRESHOLDS.HIGH_COMPLEXITY_THRESHOLD;

  switch (mode) {
    case "PLAN":
      // Se alto risco, usar PLAN_PRO
      if (riskLevel === "high") {
        return getPlanProConfig();
      }
      // Se complexidade alta, usar high effort
      return getPlanConfig(complexity >= highComplexityThreshold);

    case "CONSULT":
      return getConsultConfig();

    case "BATCH":
      return getBatchConfig();

    case "LONG_CONTEXT":
      return getLongContextConfig();

    default:
      // Fallback para CONSULT
      return getConsultConfig();
  }
}

// ========================================
// REASONING EFFORT RULES
// ========================================

/**
 * Regras para determinar reasoning effort no modo PLAN
 */
export const PLAN_HIGH_EFFORT_TRIGGERS = [
  // Palavras-chave que indicam complexidade alta
  "conflito",
  "conflict",
  "refatorar",
  "refactor",
  "migração",
  "migration",
  "branching",
  "bifurcação",
  "inconsistente",
  "inconsistent",
  "corrigir lógica",
  "fix logic",
  "contradiz",
  "contradicts",
  // Contextos que exigem mais raciocínio
  "múltiplos fluxos",
  "cross-flow",
  "integração complexa",
  "complex integration",
];

/**
 * Verifica se o prompt requer high reasoning effort
 */
export function requiresHighReasoningEffort(prompt: string): boolean {
  const lowerPrompt = prompt.toLowerCase();
  return PLAN_HIGH_EFFORT_TRIGGERS.some(trigger => 
    lowerPrompt.includes(trigger.toLowerCase())
  );
}

// ========================================
// VERBOSITY RULES
// ========================================

/**
 * Determina verbosidade baseado no contexto
 */
export function determineVerbosity(
  mode: BrainMode,
  isHandoff: boolean = false
): TextVerbosity {
  // Handoff sempre usa verbosidade alta
  if (isHandoff) return "high";
  
  switch (mode) {
    case "PLAN":
      return "medium";
    case "CONSULT":
      return "low";
    case "BATCH":
      return "low";
    case "LONG_CONTEXT":
      return "medium";
    default:
      return "medium";
  }
}

// ========================================
// SYSTEM PROMPTS
// ========================================

/**
 * System prompt base do Brain
 */
export const BRAIN_SYSTEM_PROMPT_BASE = `Você é o Brain, o agente de inteligência do Oria - uma plataforma de design e desenvolvimento de fluxos de usuário.

## SEU PAPEL

Você ajuda product managers, designers e desenvolvedores a:
- Criar e otimizar fluxos de usuário
- Definir regras de negócio
- Arquitetar specs e registries
- Responder perguntas sobre o produto
- Sugerir melhorias de UX

## FORMATO DE RESPOSTA

Sempre responda em JSON válido seguindo o BrainOutputSchema:

{
  "assistant_response_md": "Resposta em markdown para o usuário",
  "actions": [
    {
      "action_id": "uuid",
      "action_type": "upsert_rule|upsert_spec|...",
      "payload": { ... },
      "description": "Descrição da ação",
      "reversible": true,
      "priority": 1
    }
  ],
  "reasoning_summary": "Resumo do raciocínio (opcional)",
  "warnings": ["Avisos importantes"],
  "follow_up_suggestions": ["Sugestões de próximos passos"]
}

## REGRAS CRÍTICAS

1. NUNCA altere regras ou specs sem ações explícitas
2. SEMPRE valide consistência antes de propor mudanças
3. Se detectar conflito, ALERTE o usuário antes de agir
4. Mantenha rastreabilidade: toda mudança deve ter action_id único
5. Seja conciso no modo CONSULT, detalhado no modo PLAN`;

/**
 * System prompt por modo
 */
export const BRAIN_SYSTEM_PROMPTS: Record<BrainMode, string> = {
  PLAN: `${BRAIN_SYSTEM_PROMPT_BASE}

## MODO: PLAN (Planejamento)

Você está no modo de planejamento. Este modo é usado para:
- Criar/alterar arquitetura de fluxos
- Definir ou modificar regras de negócio
- Gerar FlowSpecs
- Refatorar pipelines
- Resolver conflitos

### Comportamento esperado:
- Analise profundamente antes de propor
- Gere ações estruturadas para cada mudança
- Inclua reasoning_summary
- Avise sobre riscos e impactos
- Proponha rollback plan quando apropriado`,

  CONSULT: `${BRAIN_SYSTEM_PROMPT_BASE}

## MODO: CONSULT (Consulta)

Você está no modo de consulta. Este modo é usado para:
- Responder perguntas rápidas
- Explicar como algo funciona
- Sugerir abordagens
- Esclarecer regras existentes

### Comportamento esperado:
- Seja direto e conciso
- Não gere ações complexas
- Cite fontes quando relevante
- Use exemplos curtos
- Evite "paredes de texto"`,

  BATCH: `${BRAIN_SYSTEM_PROMPT_BASE}

## MODO: BATCH (Processamento em Lote)

Você está no modo de batch. Este modo é usado para:
- Normalizar textos
- Gerar variações
- Traduzir conteúdo
- Extrair listas
- Padronizar labels

### Comportamento esperado:
- Foque na transformação solicitada
- Seja sistemático e consistente
- Mantenha formato uniforme
- Não adicione explicações desnecessárias`,

  LONG_CONTEXT: `${BRAIN_SYSTEM_PROMPT_BASE}

## MODO: LONG_CONTEXT (Contexto Extenso)

Você está processando um contexto muito grande. Este modo é usado quando:
- O contexto excede limites normais
- Precisa analisar "tudo" do projeto
- RAG/chunking não foi suficiente

### Comportamento esperado:
- Priorize informações mais relevantes
- Resuma quando necessário
- Indique se algo ficou de fora
- Sugira análises mais focadas`,
};

/**
 * Retorna system prompt para o modo
 */
export function getSystemPromptForMode(mode: BrainMode): string {
  return BRAIN_SYSTEM_PROMPTS[mode] || BRAIN_SYSTEM_PROMPTS.CONSULT;
}


