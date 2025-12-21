import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import OpenAI from "https://deno.land/x/openai@v4.68.1/mod.ts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * AGENTE: Flow Enricher v1.0
 * 
 * NOVA CAMADA NA PIPELINE:
 * Recebe MasterRule + Journey e ENRIQUECE com padrões de UX/Produto SaaS
 * antes de passar para o Subrules Decomposer.
 * 
 * Responsabilidades:
 * - Aplicar padrões universais de UX de produtos SaaS
 * - Sugerir passos adicionais importantes
 * - Identificar microfluxos padrão (recuperar senha, tentar novamente, etc.)
 * - Adicionar caminhos alternativos ou opcionais
 * - NÃO criar nós - apenas SUGERIR enriquecimentos
 */

// Schema para extra steps
const ExtraStepSchema = z.object({
  step_id: z.string(),
  description: z.string(),
  page_key: z.string().optional(),
  after_step: z.string().optional(), // ID do step após o qual inserir
  reason: z.string(), // Por que adicionar este passo
  is_optional: z.boolean().default(false),
  pattern_type: z.enum([
    "confirmation",      // Confirmação antes de ação
    "validation",        // Validação de dados
    "recovery",          // Recuperação de erro
    "retry",             // Tentar novamente
    "cancel",            // Cancelar operação
    "skip",              // Pular etapa
    "loading",           // Estado de carregamento
    "success_feedback",  // Feedback de sucesso
    "error_feedback",    // Feedback de erro
    "redirect",          // Redirecionamento
    "onboarding_step",   // Passo de onboarding
    "other"              // Outro
  ]).optional(),
});

// Schema para extra decisions
const ExtraDecisionSchema = z.object({
  decision_id: z.string(),
  description: z.string(),
  page_key: z.string().optional(),
  options: z.array(z.string()),
  reason: z.string(),
  affects_steps: z.array(z.string()).optional(), // IDs dos steps afetados
});

// Schema para extra failure points
const ExtraFailurePointSchema = z.object({
  failure_id: z.string(),
  description: z.string(),
  page_key: z.string().optional(),
  recovery_action: z.string(),
  reason: z.string(),
  allows_retry: z.boolean().default(false),
});

// Schema para UX recommendations
const UxRecommendationSchema = z.object({
  target: z.string(), // step_id ou decision_id
  recommendation: z.string(),
  priority: z.enum(["low", "medium", "high"]).default("medium"),
  pattern_name: z.string().optional(),
});

// Schema da resposta do Flow Enricher
const FlowEnricherResponseSchema = z.object({
  extra_steps: z.array(ExtraStepSchema),
  extra_decisions: z.array(ExtraDecisionSchema),
  extra_failure_points: z.array(ExtraFailurePointSchema),
  ux_recommendations: z.array(UxRecommendationSchema).optional(),
  notes: z.array(z.string()).optional(),
  patterns_applied: z.array(z.string()).optional(),
});

type FlowEnricherResponse = z.infer<typeof FlowEnricherResponseSchema>;

const SYSTEM_PROMPT = `Você é um especialista em Product Design e UX em SaaS.

## SEU PAPEL
Receber uma Regra de Negócio (MasterRule) + Jornada do Usuário (Journey) e ENRIQUECER com padrões universais de UX e produto SaaS.

Você NÃO cria nós ou estrutura de grafo.
Você SUGERE enriquecimentos que serão usados pelo próximo agente (Subrules Decomposer).

## O QUE VOCÊ FAZ
✅ Identificar passos importantes que estão faltando
✅ Sugerir microfluxos padrão (recuperar senha, tentar novamente, etc.)
✅ Adicionar validações e confirmações importantes
✅ Identificar pontos onde o usuário pode desistir e como recuperá-lo
✅ Aplicar padrões de UX de SaaS modernos
✅ Fornecer recomendações de UX específicas

## PADRÕES SaaS COMUNS (APLIQUE QUANDO RELEVANTE)

### 1. Autenticação
- Após cadastro bem-sucedido → direcionar para onboarding
- Após login bem-sucedido → direcionar para dashboard (ou onboarding se primeiro acesso)
- Em login → prever "Esqueci minha senha"
- Em cadastro → mostrar requisitos de senha em tempo real
- Oferecer login social (Google, GitHub, etc.) como alternativa

### 2. Formulários
- Validação de campos em tempo real (não apenas no submit)
- Feedback visual claro de erros
- Possibilidade de tentar novamente em caso de erro
- Confirmação antes de ações destrutivas
- Salvar rascunho/progresso em formulários longos

### 3. Onboarding
- Permitir pular e continuar depois
- Mostrar progresso (ex: "Passo 2 de 4")
- Oferecer ajuda contextual
- Celebrar conclusão de etapas

### 4. Estados de Loading
- Feedback visual durante processamento
- Possibilidade de cancelar operações longas
- Mensagens claras sobre o que está acontecendo

### 5. Tratamento de Erros
- Mensagens de erro claras e acionáveis
- Oferecer solução (não apenas descrever o problema)
- Permitir retry automático para erros de rede
- Log de erros para suporte

### 6. Sucesso
- Confirmar que a ação foi realizada
- Indicar próximos passos
- Oferecer ações relacionadas

## FORMATO DE SAÍDA (JSON OBRIGATÓRIO)

{
  "extra_steps": [
    {
      "step_id": "confirm_before_submit",
      "description": "Confirmar dados antes de enviar",
      "page_key": "signup",
      "after_step": "user_fills_form",
      "reason": "Evita erros e dá segurança ao usuário",
      "is_optional": false,
      "pattern_type": "confirmation"
    },
    {
      "step_id": "show_password_recovery",
      "description": "Usuário acessa recuperação de senha",
      "page_key": "recovery",
      "after_step": "user_enters_credentials",
      "reason": "Padrão SaaS: sempre oferecer recuperação de senha em login",
      "is_optional": true,
      "pattern_type": "recovery"
    }
  ],
  
  "extra_decisions": [
    {
      "decision_id": "skip_onboarding_choice",
      "description": "Usuário decide se quer pular o onboarding",
      "page_key": "onboarding",
      "options": ["continuar", "pular_e_configurar_depois"],
      "reason": "Permitir que usuários experientes pulem onboarding",
      "affects_steps": ["onboarding_step_1", "onboarding_step_2"]
    }
  ],
  
  "extra_failure_points": [
    {
      "failure_id": "network_error_retry",
      "description": "Falha de conexão durante envio",
      "page_key": "signup",
      "recovery_action": "Exibir mensagem e botão para tentar novamente",
      "reason": "Erros de rede são comuns e recuperáveis",
      "allows_retry": true
    }
  ],
  
  "ux_recommendations": [
    {
      "target": "user_fills_login",
      "recommendation": "Mostrar indicador de força da senha em tempo real",
      "priority": "high",
      "pattern_name": "password_strength_indicator"
    }
  ],
  
  "notes": [
    "O fluxo atual não tem tratamento para primeiro acesso - considerar redirecionar para onboarding",
    "Falta opção de login social que é esperada em SaaS modernos"
  ],
  
  "patterns_applied": [
    "password_recovery_flow",
    "form_validation_realtime",
    "onboarding_skip_option",
    "error_retry_pattern"
  ]
}

## REGRAS

1. SEMPRE sugerir recuperação de senha em fluxos de login
2. SEMPRE sugerir confirmação antes de ações destrutivas
3. SEMPRE permitir retry em operações que podem falhar
4. Em onboarding, SEMPRE permitir pular
5. Em formulários longos, sugerir salvar progresso
6. Sugerir feedback de loading para operações > 1 segundo

RETORNE APENAS JSON VÁLIDO, sem markdown ou explicações.`;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { 
      master_rule_id,
      master_rule,
      journey,
      journey_structured,
      pages_involved,
      project_id,
      user_id,
    } = await req.json();

    if (!master_rule_id || !project_id || !user_id) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: "Campos obrigatórios faltando: master_rule_id, project_id, user_id" 
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const openaiKey = Deno.env.get("OPENAI_API_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseKey);
    const openai = new OpenAI({ apiKey: openaiKey });

    // Buscar regra master se não foi passada
    let masterRuleData = master_rule;
    let pagesData = pages_involved;
    
    if (!masterRuleData) {
      const { data: masterRuleRecord } = await supabase
        .from("rules")
        .select("*")
        .eq("id", master_rule_id)
        .single();

      if (!masterRuleRecord) {
        return new Response(
          JSON.stringify({ success: false, message: "Regra master não encontrada" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      masterRuleData = masterRuleRecord.metadata?.semantic_data || {
        business_goal: masterRuleRecord.description,
        main_flow: [],
        alternative_flows: [],
        error_flows: [],
      };
      
      pagesData = masterRuleData.pages_involved || [];
    }

    // Buscar journey se não foi passada
    let journeyData = journey;
    let journeyStructuredData = journey_structured;
    
    if (!journeyData) {
      const { data: journeyRecord } = await supabase
        .from("user_journeys")
        .select("metadata")
        .eq("master_rule_id", master_rule_id)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();
      
      if (journeyRecord?.metadata) {
        journeyData = journeyRecord.metadata.journey_v2;
        journeyStructuredData = journeyRecord.metadata.journey_structured;
      }
    }

    // Construir contexto para o LLM
    let context = `## REGRA DE NEGÓCIO\n\n`;
    context += `**Objetivo:** ${masterRuleData.business_goal || "Não especificado"}\n\n`;
    
    if (masterRuleData.main_flow?.length > 0) {
      context += "**Fluxo Principal:**\n";
      masterRuleData.main_flow.forEach((step: string, i: number) => {
        context += `${i + 1}. ${step}\n`;
      });
      context += "\n";
    }
    
    if (masterRuleData.alternative_flows?.length > 0) {
      context += "**Fluxos Alternativos:**\n";
      masterRuleData.alternative_flows.forEach((flow: string) => {
        context += `- ${flow}\n`;
      });
      context += "\n";
    }
    
    if (masterRuleData.error_flows?.length > 0) {
      context += "**Fluxos de Erro:**\n";
      masterRuleData.error_flows.forEach((flow: string) => {
        context += `- ${flow}\n`;
      });
      context += "\n";
    }

    // Adicionar páginas
    if (pagesData?.length > 0) {
      context += "**Páginas Envolvidas:**\n";
      pagesData.forEach((page: any) => {
        context += `- ${page.page_key}: ${page.label} (${page.page_type || 'other'})\n`;
      });
      context += "\n";
    }

    // Adicionar journey
    if (journeyData) {
      context += "## JORNADA DO USUÁRIO\n\n";
      
      if (journeyStructuredData?.steps) {
        context += "**Etapas (com página):**\n";
        journeyStructuredData.steps.forEach((step: any, i: number) => {
          context += `${i + 1}. [${step.page_key || '?'}] ${step.description}\n`;
          if (step.step_id) context += `   ID: ${step.step_id}\n`;
        });
      } else if (journeyData.steps) {
        context += "**Etapas:**\n";
        journeyData.steps.forEach((step: string, i: number) => {
          context += `${i + 1}. ${step}\n`;
        });
      }
      context += "\n";
      
      if (journeyData.decisions?.length > 0) {
        context += "**Pontos de Decisão:**\n";
        journeyData.decisions.forEach((decision: string | any) => {
          const desc = typeof decision === 'string' ? decision : decision.description;
          const pageKey = typeof decision === 'object' ? decision.page_key : null;
          context += `- ${pageKey ? `[${pageKey}] ` : ''}${desc}\n`;
        });
        context += "\n";
      }
      
      if (journeyData.failure_points?.length > 0) {
        context += "**Pontos de Falha:**\n";
        journeyData.failure_points.forEach((failure: string | any) => {
          const desc = typeof failure === 'string' ? failure : failure.description;
          context += `- ${desc}\n`;
        });
        context += "\n";
      }
    }

    const userMessage = `Analise o fluxo abaixo e ENRIQUEÇA com padrões de UX de SaaS.

${context}

## INSTRUÇÕES

1. Identifique passos importantes que estão faltando
2. Sugira microfluxos padrão (recuperar senha, retry, etc.)
3. Adicione validações e confirmações onde necessário
4. Identifique pontos de abandono e como recuperar o usuário
5. Aplique padrões de UX modernos de SaaS

⚠️ NÃO crie nós ou estrutura de grafo.
✅ APENAS sugira enriquecimentos em formato estruturado.

RETORNE APENAS JSON VÁLIDO.`;

    // Usar GPT-4o-mini para velocidade
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userMessage },
      ],
      temperature: 0.4,
      max_tokens: 3000,
      response_format: { type: "json_object" },
    });

    const assistantMessage = completion.choices[0]?.message?.content;
    if (!assistantMessage) {
      return new Response(
        JSON.stringify({ success: false, message: "Resposta vazia do modelo" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let parsedResponse: unknown;
    try {
      parsedResponse = JSON.parse(assistantMessage);
    } catch {
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: "Erro ao parsear JSON",
          raw_response: assistantMessage 
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validar com Zod
    const validationResult = FlowEnricherResponseSchema.safeParse(parsedResponse);
    
    if (!validationResult.success) {
      // Tentar extrair o que for possível
      const enrichedFlow: FlowEnricherResponse = {
        extra_steps: (parsedResponse as any).extra_steps || [],
        extra_decisions: (parsedResponse as any).extra_decisions || [],
        extra_failure_points: (parsedResponse as any).extra_failure_points || [],
        ux_recommendations: (parsedResponse as any).ux_recommendations || [],
        notes: (parsedResponse as any).notes || [],
        patterns_applied: (parsedResponse as any).patterns_applied || [],
      };
      
      console.warn("[flow-enricher] Validação parcial:", validationResult.error.errors);
      
      return new Response(
        JSON.stringify({
          success: true,
          enriched_flow: enrichedFlow,
          validation_warnings: validationResult.error.errors.map(e => `${e.path.join(".")}: ${e.message}`),
          message: `Fluxo enriquecido com ${enrichedFlow.extra_steps.length} passos extras, ${enrichedFlow.extra_decisions.length} decisões extras e ${enrichedFlow.extra_failure_points.length} pontos de falha extras (com warnings)`,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const enrichedFlow: FlowEnricherResponse = validationResult.data;

    // Análise
    const analysis = {
      extra_steps_count: enrichedFlow.extra_steps.length,
      extra_decisions_count: enrichedFlow.extra_decisions.length,
      extra_failure_points_count: enrichedFlow.extra_failure_points.length,
      ux_recommendations_count: enrichedFlow.ux_recommendations?.length || 0,
      patterns_applied: enrichedFlow.patterns_applied || [],
    };

    return new Response(
      JSON.stringify({
        success: true,
        enriched_flow: enrichedFlow,
        analysis,
        message: `Fluxo enriquecido com ${analysis.extra_steps_count} passos extras, ${analysis.extra_decisions_count} decisões extras e ${analysis.extra_failure_points_count} pontos de falha extras`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Erro:", error);
    return new Response(
      JSON.stringify({ success: false, message: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});













