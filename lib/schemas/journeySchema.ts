import { z } from "zod";

/**
 * Schema da Journey v2.0 - JORNADA DO USUÁRIO COM PÁGINAS
 * 
 * Nova arquitetura v2.0:
 * A Journey agora serve como ENTRADA para o Subrules Decomposer,
 * junto com a Master Rule.
 * 
 * NOVIDADES v2.0:
 * - page_key em steps, decisions e failure_points
 * - user_intent e system_reaction em cada passo
 * - step_id para identificação única
 * 
 * Camadas:
 * 1. steps - Etapas narrativas com página associada
 * 2. decisions - Pontos de decisão com página
 * 3. failure_points - Pontos de falha com página
 * 4. motivations - Por que ele faz cada etapa
 * 
 * NÃO inclui:
 * - UI detalhada (botões, cores, layout)
 * - Estrutura técnica de nós
 */

/**
 * Passo da jornada v2.0 - com página e intenções
 */
export const JourneyStepSchema = z.object({
  // NOVO v2.0: ID único do passo
  step_id: z
    .string()
    .regex(/^[a-z0-9_]+$/, "step_id deve ser slug")
    .optional()
    .describe("Identificador único do passo (ex: 'user_selects_login')"),
  
  // Descrição do passo narrativo
  description: z
    .string()
    .min(10, "Descrição do passo deve ter pelo menos 10 caracteres")
    .describe("O que o usuário faz neste momento"),
  
  // NOVO v2.0: Página associada
  page_key: z
    .string()
    .optional()
    .describe("Página onde este passo acontece (ex: 'login', 'signup')"),
  
  // NOVO v2.0: Intenção do usuário (mais estruturada)
  user_intent: z
    .string()
    .optional()
    .describe("O que o usuário quer fazer nesta etapa"),
  
  // NOVO v2.0: Reação do sistema
  system_reaction: z
    .string()
    .optional()
    .describe("O que o sistema faz em resposta"),
  
  // Intenção do usuário (legado, mantido para compatibilidade)
  intent: z
    .string()
    .optional()
    .describe("A intenção do usuário ao realizar esta ação"),
  
  // Emoção esperada
  emotion: z
    .enum(["neutral", "positive", "negative", "anxious", "excited", "frustrated", "satisfied"])
    .optional()
    .describe("Estado emocional do usuário neste passo"),
  
  // Contexto adicional
  context: z
    .string()
    .optional()
    .describe("Contexto ou motivação para este passo"),
});

export type JourneyStep = z.infer<typeof JourneyStepSchema>;

/**
 * Ponto de decisão v2.0 - com página
 */
export const DecisionPointSchema = z.object({
  // NOVO v2.0: ID único da decisão
  decision_id: z
    .string()
    .regex(/^[a-z0-9_]+$/, "decision_id deve ser slug")
    .optional()
    .describe("Identificador único da decisão"),
  
  // Descrição da decisão
  description: z
    .string()
    .min(5, "Descrição da decisão deve ter pelo menos 5 caracteres")
    .describe("Qual decisão o usuário precisa tomar"),
  
  // NOVO v2.0: Página associada
  page_key: z
    .string()
    .optional()
    .describe("Página onde a decisão acontece"),
  
  // Opções disponíveis
  options: z
    .array(z.string())
    .optional()
    .describe("Opções disponíveis para o usuário"),
  
  // Impacto da decisão
  impact: z
    .string()
    .optional()
    .describe("Impacto desta decisão no fluxo"),
  
  // NOVO v2.0: Página de destino para cada opção
  destination_pages: z
    .record(z.string(), z.string())
    .optional()
    .describe("Mapa de opção -> página de destino"),
});

export type DecisionPoint = z.infer<typeof DecisionPointSchema>;

/**
 * Ponto de falha v2.0 - com página
 */
export const FailurePointSchema = z.object({
  // NOVO v2.0: ID único da falha
  failure_id: z
    .string()
    .regex(/^[a-z0-9_]+$/, "failure_id deve ser slug")
    .optional()
    .describe("Identificador único do ponto de falha"),
  
  // Descrição da falha
  description: z
    .string()
    .min(5, "Descrição da falha deve ter pelo menos 5 caracteres")
    .describe("O que pode dar errado neste ponto"),
  
  // NOVO v2.0: Página associada
  page_key: z
    .string()
    .optional()
    .describe("Página onde a falha pode ocorrer"),
  
  // Tipo de falha
  type: z
    .enum(["abandonment", "error", "confusion", "frustration", "technical", "validation"])
    .default("error")
    .describe("Tipo de falha"),
  
  // Ação de recuperação sugerida
  recovery: z
    .string()
    .optional()
    .describe("Como o usuário pode se recuperar desta falha"),
  
  // NOVO v2.0: Página de recuperação
  recovery_page: z
    .string()
    .optional()
    .describe("Página para onde o usuário vai para recuperar"),
  
  // Severidade
  severity: z
    .enum(["low", "medium", "high", "critical"])
    .default("medium")
    .describe("Severidade da falha"),
});

export type FailurePoint = z.infer<typeof FailurePointSchema>;

/**
 * Motivação - por que o usuário faz cada etapa
 */
export const MotivationSchema = z.object({
  // Descrição da motivação
  description: z
    .string()
    .min(5, "Descrição da motivação deve ter pelo menos 5 caracteres")
    .describe("Por que o usuário está fazendo isso"),
  
  // Relacionado a qual etapa
  related_step: z
    .number()
    .optional()
    .describe("Índice do passo relacionado (0-based)"),
  
  // NOVO v2.0: ID do step relacionado
  related_step_id: z
    .string()
    .optional()
    .describe("ID do passo relacionado"),
  
  // Tipo de motivação
  type: z
    .enum(["goal", "necessity", "curiosity", "obligation", "desire"])
    .optional()
    .describe("Tipo de motivação"),
});

export type Motivation = z.infer<typeof MotivationSchema>;

/**
 * Schema principal da Journey v2.0 (formato simplificado para LLM)
 * Compatível com formato anterior mas aceita novos campos
 */
export const JourneySchema = z.object({
  // Etapas narrativas - o que o usuário faz e em que ordem
  steps: z
    .array(z.string().min(5))
    .min(3, "A jornada deve ter pelo menos 3 etapas")
    .describe("Etapas narrativas da jornada do usuário"),
  
  // Momentos de decisão - onde o usuário escolhe algo
  decisions: z
    .array(z.string())
    .describe("Momentos onde o usuário precisa fazer uma escolha"),
  
  // Pontos de falha - onde ele pode desistir/errar
  failure_points: z
    .array(z.string())
    .describe("Pontos onde o usuário pode abandonar ou errar"),
  
  // Motivações - por que ele faz cada etapa
  motivations: z
    .array(z.string())
    .describe("Motivações do usuário em cada etapa"),
});

export type Journey = z.infer<typeof JourneySchema>;

/**
 * Schema da Journey v2.0 Estruturada
 * Versão com objetos completos em vez de strings simples
 */
export const JourneyStructuredSchema = z.object({
  // Etapas narrativas estruturadas
  steps: z
    .array(JourneyStepSchema)
    .min(3, "A jornada deve ter pelo menos 3 etapas")
    .describe("Etapas narrativas com metadados"),
  
  // Decisões estruturadas
  decisions: z
    .array(DecisionPointSchema)
    .describe("Pontos de decisão com opções"),
  
  // Pontos de falha estruturados
  failure_points: z
    .array(FailurePointSchema)
    .describe("Pontos de falha com recuperação"),
  
  // Motivações estruturadas
  motivations: z
    .array(MotivationSchema)
    .optional()
    .describe("Motivações detalhadas"),
});

export type JourneyStructured = z.infer<typeof JourneyStructuredSchema>;

/**
 * Transição de página
 */
export const PageTransitionSchema = z.object({
  from_page: z
    .string()
    .describe("Página de origem (page_key)"),
  
  to_page: z
    .string()
    .describe("Página de destino (page_key)"),
  
  reason: z
    .string()
    .describe("Motivo da transição (ex: 'login_success', 'user_chose_signup')"),
  
  condition: z
    .string()
    .optional()
    .describe("Condição para a transição ocorrer"),
  
  is_error_path: z
    .boolean()
    .optional()
    .default(false)
    .describe("Se é um caminho de erro"),
});

export type PageTransition = z.infer<typeof PageTransitionSchema>;

/**
 * PageContext - Usado pelo Page Mapper Agent
 */
export const PageContextSchema = z.object({
  // Páginas envolvidas (herdadas da MasterRule)
  pages: z
    .array(z.object({
      page_key: z.string(),
      label: z.string(),
      path: z.string().optional(),
      description: z.string().optional(),
      page_type: z.string().optional(),
    }))
    .describe("Páginas identificadas no fluxo"),
  
  // Transições entre páginas
  transitions: z
    .array(PageTransitionSchema)
    .describe("Transições de página no fluxo"),
  
  // Página inicial
  entry_page: z
    .string()
    .optional()
    .describe("Página de entrada do fluxo"),
  
  // Páginas de saída (sucesso)
  exit_pages_success: z
    .array(z.string())
    .optional()
    .describe("Páginas de término com sucesso"),
  
  // Páginas de saída (erro)
  exit_pages_error: z
    .array(z.string())
    .optional()
    .describe("Páginas de término com erro"),
});

export type PageContext = z.infer<typeof PageContextSchema>;

/**
 * Schema enriquecido da Journey v2.0 (versão completa)
 * Usado quando precisamos de mais detalhes
 */
export const EnrichedJourneySchema = z.object({
  // Metadados
  name: z.string().min(3).describe("Nome da jornada"),
  description: z.string().describe("Descrição geral da jornada"),
  persona: z.string().describe("Quem está realizando a jornada"),
  goal: z.string().describe("Objetivo principal do usuário"),
  
  // Etapas detalhadas
  steps: z
    .array(JourneyStepSchema)
    .min(3, "A jornada deve ter pelo menos 3 etapas"),
  
  // Decisões detalhadas
  decisions: z
    .array(DecisionPointSchema)
    .describe("Pontos de decisão detalhados"),
  
  // Falhas detalhadas
  failure_points: z
    .array(FailurePointSchema)
    .describe("Pontos de falha detalhados"),
  
  // Motivações detalhadas
  motivations: z
    .array(MotivationSchema)
    .describe("Motivações detalhadas"),
  
  // Narrativa completa
  narrative: z
    .string()
    .optional()
    .describe("Descrição em texto corrido da jornada"),
  
  // Métricas de sucesso
  success_metrics: z
    .array(z.string())
    .optional()
    .describe("Métricas para medir sucesso da jornada"),
  
  // NOVO v2.0: Contexto de páginas
  page_context: PageContextSchema
    .optional()
    .describe("Contexto de páginas e transições"),
});

export type EnrichedJourney = z.infer<typeof EnrichedJourneySchema>;

/**
 * Schema da resposta do Journey Creator
 */
export const JourneyCreatorResponseSchema = z.object({
  journey: JourneySchema,
  
  // Versão enriquecida (opcional)
  enriched_journey: EnrichedJourneySchema.optional(),
  
  // Análise da jornada
  analysis: z.object({
    total_steps: z.number(),
    decision_points: z.number(),
    failure_points: z.number(),
    complexity: z.enum(["simple", "medium", "complex"]),
    estimated_duration_minutes: z.number().optional(),
  }).optional(),
});

export type JourneyCreatorResponse = z.infer<typeof JourneyCreatorResponseSchema>;

/**
 * Valida uma Journey e retorna erros se houver
 */
export function validateJourney(data: unknown): {
  success: boolean;
  data?: Journey;
  errors?: z.ZodError;
} {
  const result = JourneySchema.safeParse(data);
  
  if (result.success) {
    return { success: true, data: result.data };
  }
  
  return { success: false, errors: result.error };
}

/**
 * Valida uma Journey enriquecida e retorna erros se houver
 */
export function validateEnrichedJourney(data: unknown): {
  success: boolean;
  data?: EnrichedJourney;
  errors?: z.ZodError;
} {
  const result = EnrichedJourneySchema.safeParse(data);
  
  if (result.success) {
    return { success: true, data: result.data };
  }
  
  return { success: false, errors: result.error };
}

/**
 * Formata erros de validação de journey para exibição
 */
export function formatJourneyErrors(errors: z.ZodError): string[] {
  return errors.issues.map((err) => {
    const path = err.path.join(".");
    return `${path}: ${err.message}`;
  });
}

/**
 * Converte Journey simples para formato que o Subrules Decomposer entende
 */
export function journeyToSubrulesContext(journey: Journey): string {
  let context = "## JORNADA DO USUÁRIO\n\n";
  
  context += "### Etapas da Jornada\n";
  journey.steps.forEach((step, i) => {
    context += `${i + 1}. ${step}\n`;
  });
  
  if (journey.decisions.length > 0) {
    context += "\n### Pontos de Decisão\n";
    journey.decisions.forEach((decision, i) => {
      context += `- Decisão ${i + 1}: ${decision}\n`;
    });
  }
  
  if (journey.failure_points.length > 0) {
    context += "\n### Pontos de Falha/Abandono\n";
    journey.failure_points.forEach((failure, i) => {
      context += `- Falha ${i + 1}: ${failure}\n`;
    });
  }
  
  if (journey.motivations.length > 0) {
    context += "\n### Motivações do Usuário\n";
    journey.motivations.forEach((motivation, i) => {
      context += `- ${motivation}\n`;
    });
  }
  
  return context;
}
