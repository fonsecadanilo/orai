/**
 * Brain Configs for Edge Functions (Deno)
 * 
 * Configurações de modelos por modo.
 * Espelha lib/brain/configs.ts para uso em Deno.
 */

import type {
  BrainMode,
  BrainModel,
  ModelConfig,
  ReasoningEffort,
  TextVerbosity,
} from "./brain-types.ts";

// ========================================
// DEFAULTS
// ========================================

const DEFAULT_MODELS: Record<string, BrainModel> = {
  PLAN: "gpt-4o",
  PLAN_PRO: "o1",
  CONSULT: "gpt-4o-mini",
  BATCH: "gpt-4o-mini",
  LONG_CONTEXT: "gpt-4o",
};

const FALLBACK_CHAINS: Record<string, BrainModel[]> = {
  PLAN: ["gpt-4o", "gpt-4o-mini"],
  PLAN_PRO: ["o1", "gpt-4o", "gpt-4o-mini"],
  CONSULT: ["gpt-4o-mini", "gpt-4o"],
  BATCH: ["gpt-4o-mini", "gpt-4o"],
  LONG_CONTEXT: ["gpt-4o", "gpt-4o-mini"],
};

export const DEFAULT_THRESHOLDS = {
  LONG_CONTEXT_THRESHOLD: 250_000,
  HIGH_COMPLEXITY_THRESHOLD: 0.6,
  CLASSIFIER_ENABLED: true,
};

// ========================================
// ENV CONFIG
// ========================================

export interface BrainEnvConfig {
  BRAIN_MODEL_PLAN: BrainModel;
  BRAIN_MODEL_PLAN_PRO: BrainModel;
  BRAIN_MODEL_CONSULT: BrainModel;
  BRAIN_MODEL_BATCH: BrainModel;
  BRAIN_MODEL_LONG: BrainModel;
  BRAIN_LONG_CONTEXT_THRESHOLD: number;
  BRAIN_CLASSIFIER_ENABLED: boolean;
  BRAIN_HIGH_COMPLEXITY_THRESHOLD: number;
  OPENAI_API_KEY: string;
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
}

export function loadEnvConfig(): Partial<BrainEnvConfig> {
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

// ========================================
// MODE CONFIGS
// ========================================

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

export function getConsultConfig(): ModelConfig {
  const env = loadEnvConfig();
  return {
    model: env.BRAIN_MODEL_CONSULT || DEFAULT_MODELS.CONSULT,
    reasoning_effort: "low",
    text_verbosity: "low",
    max_output_tokens: 4_000,
    json_schema_name: undefined,
    temperature: 0.5,
    fallback_chain: FALLBACK_CHAINS.CONSULT,
  };
}

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

export function resolveModelConfig(
  mode: BrainMode,
  complexity: number,
  riskLevel: "low" | "medium" | "high"
): ModelConfig {
  const env = loadEnvConfig();
  const threshold = env.BRAIN_HIGH_COMPLEXITY_THRESHOLD || DEFAULT_THRESHOLDS.HIGH_COMPLEXITY_THRESHOLD;

  switch (mode) {
    case "PLAN":
      if (riskLevel === "high") return getPlanProConfig();
      return getPlanConfig(complexity >= threshold);
    case "CONSULT":
      return getConsultConfig();
    case "BATCH":
      return getBatchConfig();
    case "LONG_CONTEXT":
      return getLongContextConfig();
    default:
      return getConsultConfig();
  }
}

// ========================================
// HIGH EFFORT TRIGGERS
// ========================================

export const PLAN_HIGH_EFFORT_TRIGGERS = [
  "conflito", "conflict", "refatorar", "refactor",
  "migração", "migration", "branching", "bifurcação",
  "inconsistente", "contradict",
];

export function requiresHighReasoningEffort(prompt: string): boolean {
  const lowerPrompt = prompt.toLowerCase();
  return PLAN_HIGH_EFFORT_TRIGGERS.some(t => lowerPrompt.includes(t.toLowerCase()));
}

// ========================================
// SYSTEM PROMPTS
// ========================================

export const BRAIN_SYSTEM_PROMPT_BASE = `Você é o Brain, o agente de inteligência do Oria - uma plataforma de design de fluxos de usuário.

## FORMATO DE RESPOSTA (JSON)

{
  "assistant_response_md": "Resposta em markdown",
  "actions": [{ "action_id": "...", "action_type": "...", "payload": {...}, "description": "...", "reversible": true, "priority": 1 }],
  "reasoning_summary": "Resumo do raciocínio",
  "warnings": ["Avisos"],
  "follow_up_suggestions": ["Sugestões"]
}

## REGRAS

1. NUNCA altere regras/specs sem ações explícitas
2. SEMPRE valide consistência
3. Se detectar conflito, ALERTE antes de agir
4. Mantenha rastreabilidade`;

export const BRAIN_SYSTEM_PROMPTS: Record<BrainMode, string> = {
  PLAN: `${BRAIN_SYSTEM_PROMPT_BASE}

## MODO: PLAN
- Criar/alterar arquitetura, regras, specs
- Resolver conflitos
- Analise profundamente, gere ações estruturadas

## CRIAÇÃO DE FLOW PLANS

Quando o usuário pedir para criar um flow, gere um PLANO DETALHADO antes da construção.
Use a action "upsert_brain_flow_plan" com o payload:

{
  "plan_md": "## Flow Goal\\n...\\n## Atores\\n...\\n## Passos\\n...\\n## Decisões\\n...\\n## Falhas\\n...\\n## Inputs\\n...\\n## Regras\\n...\\n## Suposições\\n...\\n## Checklist\\n...",
  "plan_json": {
    "flow_goal": "Objetivo do flow",
    "actors": ["admin", "user"],
    "steps": [{"order": 1, "group": "Início", "title": "...", "description": "..."}],
    "decision_points": [{"step_ref": 1, "condition": "...", "branches": ["sim", "não"]}],
    "failure_points": [{"step_ref": 1, "failure_type": "...", "handling": "..."}],
    "inputs": [{"step_ref": 1, "field_name": "...", "field_type": "text", "required": true}],
    "rules_refs": ["regra_x", "regra_y"],
    "assumptions": [{"assumption": "...", "confidence": "high"}],
    "acceptance_checklist": ["Critério 1", "Critério 2"]
  }
}

O plano NÃO dispara a construção automaticamente. O usuário deve aprovar via botão "Approve & Build".

### Estrutura do plan_md (OBRIGATÓRIA):
1. **Flow Goal** - Objetivo claro
2. **Atores/Roles** - Quem participa
3. **Passos (agrupados)** - Sequência de ações
4. **Pontos de Decisão** - Condições e branches
5. **Pontos de Falha** - Erros e tratamentos
6. **Inputs/Forms** - Campos necessários
7. **Referências a Regras** - Rules aplicáveis
8. **Suposições + Confiança** - O que foi assumido
9. **Checklist de Aceite** - Critérios para builders`,

  CONSULT: `${BRAIN_SYSTEM_PROMPT_BASE}

## MODO: CONSULT
- Perguntas rápidas, explicações
- Seja direto e conciso
- Evite "paredes de texto"`,

  BATCH: `${BRAIN_SYSTEM_PROMPT_BASE}

## MODO: BATCH
- Transformações repetitivas
- Normalizar, traduzir, extrair
- Seja sistemático e consistente`,

  LONG_CONTEXT: `${BRAIN_SYSTEM_PROMPT_BASE}

## MODO: LONG_CONTEXT
- Contexto muito grande
- Priorize informações relevantes
- Indique se algo ficou de fora`,
};

export function getSystemPromptForMode(mode: BrainMode): string {
  return BRAIN_SYSTEM_PROMPTS[mode] || BRAIN_SYSTEM_PROMPTS.CONSULT;
}

export function determineVerbosity(mode: BrainMode, isHandoff: boolean = false): TextVerbosity {
  if (isHandoff) return "high";
  switch (mode) {
    case "PLAN": return "medium";
    case "CONSULT": return "low";
    case "BATCH": return "low";
    case "LONG_CONTEXT": return "medium";
    default: return "medium";
  }
}


