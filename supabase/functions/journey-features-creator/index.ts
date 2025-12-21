import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import OpenAI from "https://deno.land/x/openai@v4.68.1/mod.ts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * AGENTE: Journey Creator v2.0
 * 
 * NOVA ARQUITETURA:
 * A Journey agora serve como ENTRADA para o Subrules Decomposer,
 * junto com a Master Rule.
 * 
 * Três camadas:
 * 1. Intenções do Usuário (o que ele quer fazer e em que ordem)
 * 2. Microjornadas (caminhos felizes e de erro)
 * 3. Pontos de decisão, dúvidas ou oportunidades
 * 
 * PROIBIDO:
 * - Descrever telas, botões, cores, layout, UI
 * 
 * PERMITIDO:
 * - Narrativas que ajudam o Subrules:
 *   - Confirmações
 *   - Momentos críticos
 *   - Loops naturais do usuário
 *   - Alternativas reais
 *   - Abandono
 *   - Necessidades de validação
 *   - Intenções emocionais ("tenta de novo", "desiste", etc.)
 */

// Schema Zod para validação da Journey v2.0 com page_key

// Step estruturado com page_key
const JourneyStepStructuredSchema = z.object({
  step_id: z.string().optional(),
  description: z.string().min(5),
  page_key: z.string().optional(),
  user_intent: z.string().optional(),
  system_reaction: z.string().optional(),
});

// Decision estruturada com page_key
const DecisionStructuredSchema = z.object({
  decision_id: z.string().optional(),
  description: z.string().min(5),
  page_key: z.string().optional(),
  options: z.array(z.string()).optional(),
});

// Failure point estruturado com page_key
const FailurePointStructuredSchema = z.object({
  failure_id: z.string().optional(),
  description: z.string().min(5),
  page_key: z.string().optional(),
  recovery: z.string().optional(),
});

// Schema simplificado (strings) - compatível com versão anterior
const JourneySchema = z.object({
  steps: z.array(z.string().min(5)).min(3),
  decisions: z.array(z.string()),
  failure_points: z.array(z.string()),
  motivations: z.array(z.string()),
});

// Schema estruturado v2.0 com page_key
const JourneyStructuredSchema = z.object({
  steps: z.array(JourneyStepStructuredSchema).min(3),
  decisions: z.array(DecisionStructuredSchema),
  failure_points: z.array(FailurePointStructuredSchema),
  motivations: z.array(z.string()),
});

// Schema para Features (mantido para compatibilidade)
const FeatureSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  type: z.enum(["essential", "enhancement", "nice_to_have"]),
  related_journey_steps: z.array(z.number()).optional(),
  complexity: z.enum(["simple", "medium", "complex"]).optional(),
  priority: z.enum(["low", "medium", "high", "critical"]).optional(),
});

type Journey = z.infer<typeof JourneySchema>;
type JourneyStructured = z.infer<typeof JourneyStructuredSchema>;
type JourneyStep = z.infer<typeof JourneyStepStructuredSchema>;
type DecisionPoint = z.infer<typeof DecisionStructuredSchema>;
type FailurePointItem = z.infer<typeof FailurePointStructuredSchema>;

const SYSTEM_PROMPT = `Você é um especialista em criação de JORNADAS DO USUÁRIO narrativas.

## SEU PAPEL
Criar uma jornada do usuário que será COMBINADA com uma Regra de Negócio para gerar um fluxo.
Sua saída ajuda o próximo agente (Subrules Decomposer) a entender COMO o usuário passa pelas etapas.

## ⚠️ O QUE VOCÊ NÃO DEVE FAZER (PROIBIDO)
❌ Descrever detalhes visuais (botões, cores, layout)
❌ Definir posições de elementos
❌ Especificar componentes visuais
❌ Descrever design detalhado

## ✅ O QUE VOCÊ DEVE FAZER (OBRIGATÓRIO)
Criar uma jornada com 3 CAMADAS + PÁGINAS ASSOCIADAS:

### CAMADA 1: INTENÇÕES DO USUÁRIO (steps)
O que o usuário QUER FAZER, em que ORDEM e EM QUAL PÁGINA:

Para cada step, informe:
- step_id: identificador único (ex: "user_arrives_auth")
- description: o que o usuário faz
- page_key: em qual página (ex: "auth", "login", "signup", "onboarding", "dashboard")
- user_intent: o que o usuário quer
- system_reaction: o que o sistema faz

### CAMADA 2: PONTOS DE DECISÃO (decisions)
Momentos onde o usuário ESCOLHE algo e EM QUAL PÁGINA:

Para cada decision, informe:
- decision_id: identificador único
- description: qual decisão o usuário toma
- page_key: em qual página acontece
- options: opções disponíveis

### CAMADA 3: PONTOS DE FALHA (failure_points)
Onde o usuário pode DESISTIR ou ERRAR e EM QUAL PÁGINA:

Para cada failure_point, informe:
- failure_id: identificador único
- description: o que pode dar errado
- page_key: em qual página ocorre
- recovery: como se recuperar

### BÔNUS: MOTIVAÇÕES (motivations)
Por que o usuário faz cada etapa (strings simples)

## PÁGINAS COMUNS (page_key)
Use estes identificadores de página:
- auth: Tela de escolha (login ou cadastro)
- login: Tela de login
- signup: Tela de cadastro
- recovery: Recuperação de senha
- onboarding: Primeiro acesso
- dashboard: Tela principal
- settings: Configurações
- checkout: Pagamento
- profile: Perfil
- confirmation: Confirmação
- error: Página de erro
- success: Página de sucesso

## FORMATO DE SAÍDA (JSON OBRIGATÓRIO)

{
  "journey": {
    "steps": [
      {
        "step_id": "user_arrives_auth",
        "description": "O usuário acessa a tela de autenticação",
        "page_key": "auth",
        "user_intent": "Começar o processo de login ou cadastro",
        "system_reaction": "Mostrar opções de login e cadastro"
      },
      {
        "step_id": "user_fills_login",
        "description": "O usuário preenche dados de login",
        "page_key": "login",
        "user_intent": "Entrar na conta existente",
        "system_reaction": "Validar credenciais"
      }
    ],
    "decisions": [
      {
        "decision_id": "choose_login_or_signup",
        "description": "O usuário decide se quer entrar ou criar conta",
        "page_key": "auth",
        "options": ["login", "signup"]
      }
    ],
    "failure_points": [
      {
        "failure_id": "wrong_password",
        "description": "O usuário digita senha incorreta",
        "page_key": "login",
        "recovery": "Mostrar mensagem de erro e oferecer recuperação de senha"
      }
    ],
    "motivations": [
      "Quer acessar o sistema para usar os serviços",
      "Precisa autenticar para ter acesso personalizado"
    ]
  },
  "suggested_features": [
    {
      "id": "feat_1",
      "name": "Nome da Feature",
      "description": "Descrição do que faz",
      "type": "essential|enhancement|nice_to_have",
      "complexity": "simple|medium|complex",
      "priority": "low|medium|high|critical"
    }
  ],
  "analysis": {
    "total_steps": 5,
    "decision_points": 3,
    "failure_points": 3,
    "complexity": "simple|medium|complex"
  }
}

## NARRATIVAS ÚTEIS PARA O SUBRULES (INCLUA QUANDO APLICÁVEL)
- Confirmações necessárias ("O usuário precisa confirmar antes de prosseguir")
- Momentos críticos ("Este é o passo mais importante do fluxo")
- Loops naturais ("O usuário pode repetir esta etapa se necessário")
- Alternativas reais ("O usuário pode escolher caminho A ou B")
- Abandonos ("O usuário pode desistir neste ponto")
- Validações ("O sistema precisa validar antes de continuar")
- Intenções emocionais ("O usuário pode ficar frustrado se...")

## REGRAS DE QUALIDADE
1. Mínimo 5 steps com page_key definido
2. Mínimo 2 decisions com page_key definido
3. Mínimo 2 failure_points com page_key definido
4. Mínimo 3 motivations
5. Mínimo 3 features sugeridas
6. TODOS os steps/decisions/failure_points devem ter page_key quando aplicável

RETORNE APENAS JSON VÁLIDO, sem markdown ou explicações.`;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { 
      master_rule_id, 
      master_rule_content,
      master_rule_title,
      business_rules,
      project_id, 
      user_id,
      conversation_id 
    } = await req.json();

    if (!master_rule_id || !project_id || !user_id) {
      return new Response(
        JSON.stringify({ success: false, message: "Campos obrigatórios faltando" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const openaiKey = Deno.env.get("OPENAI_API_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseKey);
    const openai = new OpenAI({ apiKey: openaiKey });

    // Se não tiver o conteúdo, buscar do banco
    let ruleContent = master_rule_content;
    let ruleTitle = master_rule_title;
    let semanticData = null;
    
    if (!ruleContent || !ruleTitle) {
      const { data: masterRule } = await supabase
        .from("rules")
        .select("title, content, description, metadata")
        .eq("id", master_rule_id)
        .single();

      if (!masterRule) {
        return new Response(
          JSON.stringify({ success: false, message: "Regra master não encontrada" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      ruleContent = masterRule.content || masterRule.description;
      ruleTitle = masterRule.title;
      semanticData = masterRule.metadata?.semantic_data;
    }

    // Construir contexto da regra de negócio
    let businessContext = `## REGRA DE NEGÓCIO\n**Título:** ${ruleTitle}\n\n`;
    
    if (semanticData) {
      businessContext += `**Objetivo:** ${semanticData.business_goal || "Não especificado"}\n\n`;
      businessContext += `**Contexto:** ${semanticData.context || "Não especificado"}\n\n`;
      
      if (semanticData.main_flow?.length > 0) {
        businessContext += "**Fluxo Principal:**\n";
        semanticData.main_flow.forEach((step: string, i: number) => {
          businessContext += `${i + 1}. ${step}\n`;
        });
      }
      
      if (semanticData.alternative_flows?.length > 0) {
        businessContext += "\n**Fluxos Alternativos:**\n";
        semanticData.alternative_flows.forEach((flow: string) => {
          businessContext += `- ${flow}\n`;
        });
      }
      
      if (semanticData.error_flows?.length > 0) {
        businessContext += "\n**Fluxos de Erro:**\n";
        semanticData.error_flows.forEach((flow: string) => {
          businessContext += `- ${flow}\n`;
        });
      }
    } else {
      businessContext += `**Conteúdo:**\n${ruleContent?.substring(0, 3000) || "Não especificado"}\n`;
    }

    const businessRulesText = business_rules?.length 
      ? business_rules.map((r: string, i: number) => `${i + 1}. ${r}`).join("\n")
      : "Não especificadas";

    const userMessage = `Crie a JORNADA DO USUÁRIO narrativa para o seguinte contexto:

${businessContext}

**Regras de Negócio Identificadas:**
${businessRulesText}

## INSTRUÇÕES
1. Crie uma jornada NARRATIVA do ponto de vista do USUÁRIO
2. Foque em INTENÇÕES, DECISÕES e PONTOS DE FALHA
3. NÃO descreva UI, telas ou botões
4. Inclua narrativas que ajudem a entender o fluxo humano
5. Identifique features que suportam a jornada

A jornada será combinada com a Regra de Negócio para criar um fluxo.
Seja descritivo sobre os MOMENTOS e EMOÇÕES do usuário.

RETORNE APENAS JSON VÁLIDO.`;

    // Usar GPT-4o-mini para bom equilíbrio entre qualidade e velocidade
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userMessage },
      ],
      temperature: 0.4, // Balanceado entre criatividade e consistência
      max_tokens: 4000,
      response_format: { type: "json_object" },
    });

    const assistantMessage = completion.choices[0]?.message?.content;
    if (!assistantMessage) {
      return new Response(
        JSON.stringify({ success: false, message: "Resposta vazia da IA" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let responseData;
    try {
      responseData = JSON.parse(assistantMessage);
    } catch {
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: "Erro ao parsear resposta JSON",
          raw_response: assistantMessage 
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Extrair journey (pode vir como responseData.journey ou diretamente)
    const journeyData = responseData.journey || responseData;
    
    // Tentar validar como estruturado primeiro (v2.0 com page_key)
    let journey: Journey;
    let journeyStructured: JourneyStructured | null = null;
    
    const structuredResult = JourneyStructuredSchema.safeParse(journeyData);
    
    if (structuredResult.success) {
      // Formato estruturado v2.0
      journeyStructured = structuredResult.data;
      
      // Converter para formato simples para compatibilidade
      journey = {
        steps: journeyStructured.steps.map(s => s.description),
        decisions: journeyStructured.decisions.map(d => d.description),
        failure_points: journeyStructured.failure_points.map(f => f.description),
        motivations: journeyStructured.motivations,
      };
      
      console.log("[journey-creator] Formato estruturado v2.0 detectado");
    } else {
      // Tentar formato simples (strings)
      const simpleResult = JourneySchema.safeParse(journeyData);
      
      if (!simpleResult.success) {
        const errors = simpleResult.error.errors.map(
          (e) => `${e.path.join(".")}: ${e.message}`
        );
        
        return new Response(
          JSON.stringify({ 
            success: false, 
            message: "Validação da Journey falhou",
            validation_errors: errors,
            raw_response: responseData
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      journey = simpleResult.data;
      console.log("[journey-creator] Formato simples detectado");
    }
    const suggestedFeatures = responseData.suggested_features || [];
    const analysis = responseData.analysis || {
      total_steps: journey.steps.length,
      decision_points: journey.decisions.length,
      failure_points: journey.failure_points.length,
      complexity: journey.steps.length > 7 ? "complex" : journey.steps.length > 4 ? "medium" : "simple",
    };

    // Construir user_journey para compatibilidade com estrutura anterior
    // NOVO v2.0: Incluir page_key quando disponível
    const userJourney = {
      name: ruleTitle,
      description: `Jornada do usuário para: ${ruleTitle}`,
      persona: "Usuário",
      goal: semanticData?.business_goal || "Completar o processo",
      starting_point: "Início da jornada",
      ending_point: "Conclusão da jornada",
      steps: journey.steps.map((step, i) => {
        const structuredStep = journeyStructured?.steps[i];
        return {
          order: i + 1,
          action: step,
          context: journey.motivations[i] || "",
          expected_outcome: i < journey.steps.length - 1 ? journey.steps[i + 1] : "Conclusão",
          touchpoint: "process",
          pain_points: journey.failure_points.filter(fp => fp.toLowerCase().includes(step.toLowerCase().split(" ")[0])),
          // NOVO v2.0: Campos adicionais do formato estruturado
          page_key: structuredStep?.page_key,
          step_id: structuredStep?.step_id,
          user_intent: structuredStep?.user_intent,
          system_reaction: structuredStep?.system_reaction,
        };
      }),
      success_metrics: [],
      narrative: journey.steps.join(". ") + ".",
    };
    
    // NOVO v2.0: Construir page_context se tivermos dados estruturados
    let pageContext = null;
    if (journeyStructured) {
      const pagesUsed = new Set<string>();
      const transitions: Array<{from_page: string; to_page: string; reason: string}> = [];
      
      // Extrair páginas usadas
      journeyStructured.steps.forEach(s => s.page_key && pagesUsed.add(s.page_key));
      journeyStructured.decisions.forEach(d => d.page_key && pagesUsed.add(d.page_key));
      journeyStructured.failure_points.forEach(f => f.page_key && pagesUsed.add(f.page_key));
      
      // Inferir transições entre páginas
      for (let i = 0; i < journeyStructured.steps.length - 1; i++) {
        const current = journeyStructured.steps[i];
        const next = journeyStructured.steps[i + 1];
        
        if (current.page_key && next.page_key && current.page_key !== next.page_key) {
          transitions.push({
            from_page: current.page_key,
            to_page: next.page_key,
            reason: current.step_id || `step_${i + 1}_to_${i + 2}`,
          });
        }
      }
      
      // Adicionar transições de decisões
      for (const decision of journeyStructured.decisions) {
        if (decision.page_key && decision.options) {
          for (const option of decision.options) {
            transitions.push({
              from_page: decision.page_key,
              to_page: option, // Assumir que opção é uma page_key
              reason: `user_chose_${option}`,
            });
          }
        }
      }
      
      pageContext = {
        pages: Array.from(pagesUsed).map(key => ({
          page_key: key,
          label: key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' '),
        })),
        transitions,
        entry_page: journeyStructured.steps[0]?.page_key || undefined,
        exit_pages_success: journeyStructured.steps
          .filter(s => s.page_key?.includes("success") || s.page_key?.includes("dashboard"))
          .map(s => s.page_key!),
        exit_pages_error: journeyStructured.failure_points
          .filter(f => f.page_key?.includes("error"))
          .map(f => f.page_key!),
      };
    }

    // Salvar jornada no banco
    const { data: savedJourney, error: journeyError } = await supabase
      .from("user_journeys")
      .insert({
        project_id,
        master_rule_id,
        name: userJourney.name,
        description: userJourney.description,
        persona: userJourney.persona,
        goal: userJourney.goal,
        starting_point: userJourney.starting_point,
        ending_point: userJourney.ending_point,
        steps: userJourney.steps,
        success_metrics: userJourney.success_metrics,
        narrative: userJourney.narrative,
        metadata: {
          source: "journey-creator-v2.1",
          version: "2.1",
          journey_v2: journey, // Formato simples
          journey_structured: journeyStructured, // NOVO: Formato estruturado com page_key
          page_context: pageContext, // NOVO: Contexto de páginas e transições
          feature_count: suggestedFeatures.length,
          analysis,
        },
      })
      .select("id")
      .single();

    const journeyId = savedJourney?.id || null;

    // Salvar features no banco
    const savedFeatures = [];
    for (const feature of suggestedFeatures) {
      const { data: savedFeature } = await supabase
        .from("suggested_features")
        .insert({
          project_id,
          journey_id: journeyId,
          master_rule_id,
          feature_id: feature.id,
          name: feature.name,
          description: feature.description,
          type: feature.type,
          related_journey_steps: feature.related_journey_steps || [],
          complexity: feature.complexity || "medium",
          priority: feature.priority || "medium",
          user_value: feature.description,
          acceptance_criteria: [],
        })
        .select("id")
        .single();

      if (savedFeature) {
        savedFeatures.push({ ...feature, db_id: savedFeature.id });
      } else {
        savedFeatures.push(feature);
      }
    }

    // Salvar conversa
    const newConversationId = conversation_id || crypto.randomUUID();
    await supabase.from("agent_conversations").upsert({
      id: newConversationId,
      project_id,
      user_id,
      agent_type: "journey_creator_v2",
      messages: [
        { role: "user", content: userMessage },
        { role: "assistant", content: assistantMessage },
      ],
      context: { 
        master_rule_id, 
        journey_id: journeyId,
        features_count: suggestedFeatures.length,
        version: "2.0",
      },
      updated_at: new Date().toISOString(),
    });

    return new Response(
      JSON.stringify({
        success: true,
        journey_id: journeyId,
        
        // Formato simples v2.0
        journey,
        
        // NOVO v2.1: Formato estruturado com page_key
        journey_structured: journeyStructured,
        
        // NOVO v2.1: Contexto de páginas e transições
        page_context: pageContext,
        
        // Formato anterior (compatibilidade)
        user_journey: userJourney,
        
        suggested_features: savedFeatures,
        analysis: {
          ...analysis,
          // NOVO v2.1: Indicadores adicionais
          has_page_mapping: !!journeyStructured,
          pages_count: pageContext?.pages?.length || 0,
          transitions_count: pageContext?.transitions?.length || 0,
        },
        
        // Mapeamento para features (compatibilidade)
        feature_step_mapping: suggestedFeatures.map((f: any) => ({
          feature_id: f.id,
          step_orders: f.related_journey_steps || [],
          rationale: f.description,
        })),
        
        conversation_id: newConversationId,
        message: `Jornada criada com ${journey.steps.length} etapas, ${journey.decisions.length} decisões e ${journey.failure_points.length} pontos de falha${pageContext ? ` (${pageContext.pages?.length || 0} páginas mapeadas)` : ''}`,
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
