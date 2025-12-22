/**
 * Brain Classifier v1.0
 * 
 * Classifier LLM barato para casos incertos no roteamento determinístico.
 * Usa gpt-5-nano (ou gpt-4o-mini como fallback) para classificação rápida.
 */

import type {
  BrainMode,
  RiskLevel,
  ContextStats,
  ClassifierResult,
} from "./types";
import { ClassifierResultSchema } from "./schemas";
import { loadEnvConfig } from "./configs";

// ========================================
// CLASSIFIER PROMPT
// ========================================

const CLASSIFIER_SYSTEM_PROMPT = `Você é um classificador de intenções para um assistente de IA focado em design de fluxos de usuário.

Analise o prompt do usuário e classifique em uma das categorias:

## MODOS

1. **PLAN**: O usuário quer criar, alterar ou planejar algo estruturado
   - Criar/modificar arquitetura, regras, specs
   - Refatorar pipelines
   - Resolver conflitos
   - Planejamento de produto
   
2. **CONSULT**: O usuário quer informação ou explicação
   - Perguntas sobre como algo funciona
   - Consultas rápidas
   - Sugestões sem mudanças estruturadas
   
3. **BATCH**: O usuário quer transformações repetitivas
   - Normalizar, traduzir, reformatar
   - Gerar variações em massa
   - Extrair listas
   
4. **LONG_CONTEXT**: O contexto é muito grande
   - Análise de todo o projeto
   - Contexto que não cabe normalmente

## RESPOSTA

Responda APENAS com JSON válido:

{
  "mode": "PLAN|CONSULT|BATCH|LONG_CONTEXT",
  "complexity": 0.0 a 1.0,
  "requires_structured_output": true|false,
  "needs_tool_use": true|false,
  "risk_level": "low|medium|high",
  "confidence": 0.0 a 1.0
}

## GUIDELINES

- complexity: 0.0 = trivial, 1.0 = muito complexo
- risk_level: 
  - high = deletar, migrar, produção, breaking changes
  - medium = alterar, modificar, atualizar
  - low = consultar, explicar, sugerir
- confidence: quão certo você está da classificação
- requires_structured_output: true se precisa retornar JSON/lista/tabela
- needs_tool_use: true se precisa consultar banco/API

RETORNE APENAS O JSON, sem explicações.`;

// ========================================
// CLASSIFIER FUNCTION
// ========================================

/**
 * Chama o classifier LLM
 */
export async function classifyPrompt(
  prompt: string,
  contextStats: ContextStats,
  openaiApiKey?: string
): Promise<ClassifierResult> {
  const env = loadEnvConfig();
  const apiKey = openaiApiKey || env.OPENAI_API_KEY;
  
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY não configurada");
  }

  // Preparar contexto resumido para o classifier
  const contextSummary = [
    `Tokens estimados: ${contextStats.total_tokens_estimate.toLocaleString()}`,
    `Regras de negócio: ${contextStats.business_rules_count}`,
    `Flow Specs: ${contextStats.flow_specs_count}`,
    `Personas: ${contextStats.personas_count}`,
    `Mensagens no thread: ${contextStats.thread_messages_count}`,
    contextStats.is_large_context ? "⚠️ Contexto grande" : "",
  ].filter(Boolean).join("\n");

  const userMessage = `## PROMPT DO USUÁRIO
${prompt}

## CONTEXTO
${contextSummary}

Classifique o prompt acima.`;

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: env.BRAIN_MODEL_BATCH || "gpt-4o-mini", // Usa modelo barato
        messages: [
          { role: "system", content: CLASSIFIER_SYSTEM_PROMPT },
          { role: "user", content: userMessage },
        ],
        temperature: 0.1, // Baixa temperatura para consistência
        max_tokens: 200,
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error("Resposta vazia do classifier");
    }

    // Parsear e validar resposta
    const parsed = JSON.parse(content);
    const validated = ClassifierResultSchema.parse(parsed);

    return validated;
  } catch (error) {
    console.error("[Brain Classifier] Erro:", error);
    
    // Retornar resultado default em caso de erro
    return getDefaultClassifierResult(prompt, contextStats);
  }
}

/**
 * Resultado default quando classifier falha
 */
function getDefaultClassifierResult(
  prompt: string,
  contextStats: ContextStats
): ClassifierResult {
  // Heurísticas simples como fallback
  const wordCount = prompt.trim().split(/\s+/).length;
  const hasQuestionMark = prompt.includes("?");
  
  // Se contexto grande, LONG_CONTEXT
  if (contextStats.is_large_context) {
    return {
      mode: "LONG_CONTEXT",
      complexity: 0.7,
      requires_structured_output: true,
      needs_tool_use: false,
      risk_level: "medium",
      confidence: 0.5,
    };
  }
  
  // Se pergunta curta, CONSULT
  if (wordCount <= 10 && hasQuestionMark) {
    return {
      mode: "CONSULT",
      complexity: 0.3,
      requires_structured_output: false,
      needs_tool_use: false,
      risk_level: "low",
      confidence: 0.6,
    };
  }
  
  // Default para CONSULT com incerteza
  return {
    mode: "CONSULT",
    complexity: 0.5,
    requires_structured_output: false,
    needs_tool_use: false,
    risk_level: "low",
    confidence: 0.4,
  };
}

// ========================================
// CLASSIFIER WITH CACHING
// ========================================

/**
 * Cache simples para classificações recentes
 */
const classificationCache = new Map<string, { result: ClassifierResult; timestamp: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutos

/**
 * Gera chave de cache
 */
function getCacheKey(prompt: string, contextStats: ContextStats): string {
  // Usa hash simples do prompt + stats principais
  const statsKey = `${contextStats.total_tokens_estimate}-${contextStats.business_rules_count}-${contextStats.flow_specs_count}`;
  return `${prompt.slice(0, 100)}-${statsKey}`;
}

/**
 * Classifier com cache
 */
export async function classifyPromptCached(
  prompt: string,
  contextStats: ContextStats,
  openaiApiKey?: string
): Promise<ClassifierResult> {
  const cacheKey = getCacheKey(prompt, contextStats);
  
  // Verificar cache
  const cached = classificationCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.result;
  }
  
  // Classificar
  const result = await classifyPrompt(prompt, contextStats, openaiApiKey);
  
  // Cachear
  classificationCache.set(cacheKey, { result, timestamp: Date.now() });
  
  // Limpar cache antigo (máximo 100 entradas)
  if (classificationCache.size > 100) {
    const oldestKey = classificationCache.keys().next().value;
    if (oldestKey) classificationCache.delete(oldestKey);
  }
  
  return result;
}

// ========================================
// EXPORTS
// ========================================

/**
 * Função de classificação para usar com o router
 */
export async function createClassifierFunction(openaiApiKey?: string) {
  return async (prompt: string, stats: ContextStats) => {
    return classifyPromptCached(prompt, stats, openaiApiKey);
  };
}




