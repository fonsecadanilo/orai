import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import OpenAI from "https://deno.land/x/openai@v4.68.1/mod.ts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * AGENTE 2: Flow Synthesizer v3.1
 * 
 * RESPONSABILIDADES:
 * - Receber contexto do Product & Role Mapper
 * - Sintetizar fluxo semântico com steps, decisions, failures
 * - Detectar padrões reutilizáveis
 * - Calcular complexidade do fluxo
 * - Gerar estrutura inicial de nós
 */

// Schema de entrada
const FlowSynthesizerRequestSchema = z.object({
  project_id: z.number(),
  user_id: z.number(),
  product_context: z.object({
    product_name: z.string(),
    product_type: z.string(),
    product_description: z.string().optional(),
    industry: z.string().optional(),
    business_model: z.string().optional(),
  }),
  user_role: z.object({
    role_id: z.string(),
    role_name: z.string(),
    display_name: z.string(),
    permissions: z.array(z.string()).optional(),
  }),
  flow_context: z.object({
    main_goal: z.string(),
    user_intent: z.string(),
    expected_outcome: z.string(),
    key_actions: z.array(z.string()).optional(),
  }),
  master_rule_content: z.string().optional(),
});

// Schema de step no fluxo - V3.1 com semantic_type
const FlowStepSchema = z.object({
  step_id: z.string(),
  title: z.string(),
  description: z.string(),
  // V3.1: semantic_type é o vocabulário oficial
  semantic_type: z.enum([
    "trigger",           // Ponto de entrada (OBRIGATÓRIO no início)
    "action",            // Ação simples do usuário (clique, toggle)
    "condition",         // Decisão binária (Sim/Não, Válido/Inválido)
    "form",              // Entrada de dados (login, cadastro, checkout)
    "choice",            // Múltiplas opções (seleção de método, tipo)
    "feedback_success",  // Feedback positivo
    "feedback_error",    // Feedback de erro (OBRIGATÓRIO para forms críticos)
    "end_success",       // Término com sucesso (OBRIGATÓRIO)
    "end_error",         // Término com erro
    "end_neutral",       // Término neutro (cancelamento)
    "background_action", // Processamento async (API calls, loading)
    "delayed_action",    // Ação com delay
    "insight_branch",    // Branch informativo
    "configuration_matrix", // Configuração complexa
    "retry",             // Tentar novamente
    "fallback",          // Caminho alternativo
    "loopback",          // Voltar ao passo anterior
  ]),
  // Manter step_type para compatibilidade (será ignorado se semantic_type existir)
  step_type: z.string().optional(),
  group_label: z.string(), // OBRIGATÓRIO: Etapa do fluxo (ex: "Autenticação", "Pagamento")
  page_key: z.string().optional(),
  user_intent: z.string().optional(), // O que o usuário quer fazer
  system_behavior: z.string().optional(), // Como o sistema responde
  inputs: z.array(z.object({
    field_id: z.string(),
    field_type: z.string(),
    label: z.string(),
    required: z.boolean(),
    validation_rules: z.array(z.string()).optional(),
  })).optional(),
  // V3.1: suggested_edges para hints de conexão
  suggested_edges: z.array(z.object({
    label: z.string(),
    type: z.enum(["success", "failure", "option", "default", "loopback", "retry", "fallback"]),
    target_hint: z.string().optional(), // ID ou descrição do alvo
  })).optional(),
  error_cases: z.array(z.object({
    error_type: z.string(),
    error_message: z.string(),
    handling: z.enum(["retry", "loopback", "fallback", "end_error"]),
  })).optional(),
  // V3.1: Para conditions, descrever os significados dos branches
  branch_success_meaning: z.string().optional(), // "Quando a condição é verdadeira"
  branch_failure_meaning: z.string().optional(), // "Quando a condição é falsa"
  next_steps: z.array(z.string()).optional(),
  conditions: z.array(z.object({
    condition: z.string(),
    target_step: z.string(),
  })).optional(),
  metadata: z.object({
    is_optional: z.boolean().optional(),
    estimated_time_seconds: z.number().optional(),
    requires_authentication: z.boolean().optional(),
    impact_level: z.enum(["low", "medium", "high"]).optional(),
  }).optional(),
});

// Schema de decision
const FlowDecisionSchema = z.object({
  decision_id: z.string(),
  title: z.string(),
  description: z.string(),
  condition_expression: z.string(),
  branches: z.array(z.object({
    branch_id: z.string(),
    label: z.string(),
    condition_value: z.string(),
    target_step: z.string(),
  })),
  default_branch: z.string().optional(),
});

// Schema de failure point
const FlowFailureSchema = z.object({
  failure_id: z.string(),
  title: z.string(),
  description: z.string(),
  trigger_step: z.string(),
  failure_type: z.enum([
    "validation_error",
    "network_error",
    "authentication_error",
    "authorization_error",
    "business_rule_violation",
    "timeout",
    "user_abort",
    "system_error",
  ]),
  recovery_strategy: z.enum([
    "retry",
    "fallback",
    "redirect",
    "notify_and_continue",
    "abort",
    "manual_intervention",
  ]),
  recovery_step: z.string().optional(),
  error_message: z.string(),
});

// Schema de padrão reutilizável
const ReusablePatternSchema = z.object({
  pattern_id: z.string(),
  pattern_name: z.string(),
  pattern_type: z.enum([
    "authentication",
    "form_submission",
    "data_listing",
    "crud_operation",
    "payment",
    "notification",
    "search",
    "filter",
    "pagination",
    "file_upload",
    "multi_step_wizard",
    "confirmation",
    "other",
  ]),
  steps_involved: z.array(z.string()),
  is_complete: z.boolean(),
  can_be_extracted: z.boolean(),
});

// V3.1: Schema de decision_point explícito
const DecisionPointSchema = z.object({
  node_id: z.string(),
  decision_type: z.enum(["condition", "choice"]),
  question: z.string().optional(),
  options: z.array(z.string()),
});

// V3.1: Schema de failure_point explícito
const FailurePointSchema = z.object({
  node_id: z.string(),
  failure_type: z.enum(["validation", "api", "business_rule", "network", "authentication", "authorization"]),
  error_message: z.string(),
  handling: z.array(z.enum(["feedback_error", "retry", "loopback", "fallback", "end_error"])),
});

// Schema de resposta do LLM - V3.1
const LLMResponseSchema = z.object({
  flow_title: z.string(),
  flow_description: z.string(),
  steps: z.array(FlowStepSchema),
  // V3.1: decision_points e failure_points explícitos
  decision_points: z.array(DecisionPointSchema).optional(),
  failure_points_v3: z.array(FailurePointSchema).optional(),
  // Manter estruturas antigas para compatibilidade
  decisions: z.array(FlowDecisionSchema).optional(),
  failure_points: z.array(FlowFailureSchema).optional(),
  reusable_patterns: z.array(ReusablePatternSchema).optional(),
  flow_metrics: z.object({
    total_steps: z.number(),
    decision_points: z.number(),
    failure_points: z.number(),
    estimated_completion_time_seconds: z.number(),
    complexity_score: z.number().min(1).max(10),
    has_loops: z.boolean(),
    max_depth: z.number(),
  }),
  semantic_summary: z.string(),
  // V3.1: Narrativa em markdown
  narrative_md: z.string().optional(),
});

type FlowSynthesizerRequest = z.infer<typeof FlowSynthesizerRequestSchema>;
type LLMResponse = z.infer<typeof LLMResponseSchema>;

const SYSTEM_PROMPT = `Você é um especialista em construção de User Flows para SaaS (nível senior).
Gere um fluxo rico e bem estruturado com bifurcações claras e paths de erro.

## REGRAS OBRIGATÓRIAS

1. Retorne APENAS JSON válido.

2. Cada node DEVE ter "semantic_type" usando APENAS esta lista permitida:
   - "trigger" - Ponto de entrada (PRIMEIRO step obrigatório)
   - "action" - Ação simples (clique, toggle, navegação)
   - "condition" - Decisão binária Sim/Não (OBRIGATÓRIO se flow > 6 nodes)
   - "form" - Entrada de dados (login, cadastro, checkout, pagamento)
   - "choice" - Múltiplas opções (seleção de método, tipo)
   - "feedback_success" - Feedback positivo
   - "feedback_error" - Feedback de erro (OBRIGATÓRIO para forms críticos)
   - "end_success" - Término com sucesso (OBRIGATÓRIO)
   - "end_error" - Término com erro (para falhas críticas)
   - "end_neutral" - Término neutro (cancelamento)
   - "background_action" - Processamento async (API calls, loading)
   - "retry" - Tentar novamente
   - "fallback" - Caminho alternativo
   - "loopback" - Voltar ao passo anterior

3. O fluxo NÃO PODE ser linear se tiver mais de 6 nodes. DEVE existir pelo menos:
   - 1 "condition" (decisão Sim/Não) OU
   - 1 "choice" (seleção de opções)

4. Para QUALQUER passo que possa falhar (form submit, validação, action crítica):
   - Descreva a falha em "error_cases"
   - Crie handling explícito: feedback_error + (retry OU loopback OU fallback OU end_error)

5. Se existir "form", DEVE incluir:
   - "inputs" com campos e validações
   - "error_cases" para erros de validação
   - Na resposta: um "failure_points_v3" correspondente

6. Todo node DEVE ter "group_label" (etapa do fluxo):
   - Exemplos: "Autenticação", "Verificação", "Configuração", "Pagamento", "Confirmação"

7. Sempre terminar com "end_success" ou "end_neutral" (e "end_error" quando existir falha crítica).

## TIPOS DE FAILURE

- validation: Erro de validação de campo
- api: Falha de API/backend
- business_rule: Violação de regra de negócio
- network: Erro de rede
- authentication: Credenciais inválidas
- authorization: Sem permissão

## EXEMPLOS DE FLOWS CORRETOS

### Login Flow (8 nodes, TEM branching):
1. trigger: "Acessar página de login" (group: "Início")
2. form: "Preencher credenciais" (group: "Autenticação") - inputs: [email, password]
3. background_action: "Validar credenciais" (group: "Verificação")
4. condition: "Credenciais válidas?" (group: "Verificação") - branches: Sim/Não
5. feedback_error: "Exibir erro de login" (group: "Tratamento de Erro")
6. loopback: "Tentar novamente" (group: "Tratamento de Erro") - volta para step 2
7. feedback_success: "Login realizado" (group: "Confirmação")
8. end_success: "Redirecionar para dashboard" (group: "Conclusão")

### Checkout Flow (10 nodes, TEM choice E condition):
1. trigger: "Iniciar checkout" (group: "Início")
2. form: "Endereço de entrega" (group: "Entrega")
3. choice: "Método de pagamento" (group: "Pagamento") - options: [Cartão, Pix, Boleto]
4. form: "Dados do cartão" (group: "Pagamento") - se cartão
5. background_action: "Processar pagamento" (group: "Processamento")
6. condition: "Pagamento aprovado?" (group: "Verificação")
7. feedback_error: "Pagamento recusado" (group: "Tratamento de Erro")
8. retry: "Tentar outro método" (group: "Tratamento de Erro")
9. feedback_success: "Pedido confirmado" (group: "Confirmação")
10. end_success: "Exibir resumo do pedido" (group: "Conclusão")

## FORMATO DE SAÍDA

{
  "flow_title": "string",
  "flow_description": "string",
  "steps": [
    {
      "step_id": "string",
      "semantic_type": "trigger|action|condition|form|choice|feedback_success|feedback_error|end_success|end_error|end_neutral|background_action|retry|fallback|loopback",
      "title": "string",
      "description": "string",
      "group_label": "string (OBRIGATÓRIO)",
      "user_intent": "string",
      "system_behavior": "string",
      "inputs": [{ "field_id": "string", "field_type": "string", "label": "string", "required": true, "validation_rules": ["string"] }],
      "suggested_edges": [
        { "label": "Sim|Não|Sucesso|Erro|Opção X", "type": "success|failure|option|default|loopback", "target_hint": "step_id ou descrição" }
      ],
      "error_cases": [
        { "error_type": "validation|api|business_rule", "error_message": "string", "handling": "retry|loopback|fallback|end_error" }
      ],
      "metadata": { "impact_level": "low|medium|high" }
    }
  ],
  "decision_points": [
    { "node_id": "string", "decision_type": "condition|choice", "question": "string", "options": ["Sim", "Não"] }
  ],
  "failure_points_v3": [
    { "node_id": "string", "failure_type": "validation|api|business_rule|network|authentication", "error_message": "string", "handling": ["feedback_error", "loopback"] }
  ],
  "flow_metrics": {
    "total_steps": 8,
    "decision_points": 2,
    "failure_points": 3,
    "estimated_completion_time_seconds": 120,
    "complexity_score": 5,
    "has_loops": true,
    "max_depth": 3
  },
  "semantic_summary": "string",
  "narrative_md": "# Fluxo de Login\\n\\n## Regras\\n- Usuário deve ter conta cadastrada\\n..."
}

## REGRAS CRÍTICAS PARA CONDITIONS (BIFURCAÇÕES)

⚠️ TODA "condition" DEVE ter EXATAMENTE 2 caminhos claramente definidos:
1. **success** (Sim/True/Valid) - quando a condição é ATENDIDA
2. **failure** (Não/False/Invalid) - quando a condição NÃO é atendida

Para CADA condition, você DEVE incluir:
- "branch_success_meaning": "O que acontece quando é verdadeiro"
- "branch_failure_meaning": "O que acontece quando é falso"
- Em "suggested_edges": AMBOS os edges (success E failure)

Exemplo para condition "Credenciais válidas?":
{
  "semantic_type": "condition",
  "title": "Credenciais válidas?",
  "branch_success_meaning": "Login autorizado - redirecionar para dashboard",
  "branch_failure_meaning": "Credenciais incorretas - mostrar erro e permitir retry",
  "suggested_edges": [
    { "label": "Sim", "type": "success", "target_hint": "feedback_success" },
    { "label": "Não", "type": "failure", "target_hint": "feedback_error" }
  ]
}

## REGRAS PARA ERROR HANDLING (OBRIGATÓRIO)

Para QUALQUER step que pode falhar (form, condition, action crítica):
1. Inclua "error_cases[]" descrevendo os possíveis erros
2. Em "failure_points_v3[]", mapeie o handling

Mesmo com POUCA INFORMAÇÃO sobre o negócio, SEMPRE crie:
- "feedback_error" genérico: "Não foi possível completar. Tente novamente."
- "loopback" para voltar: "Corrigir informações"

## VALIDAÇÃO ANTES DE RETORNAR

Antes de retornar o JSON, verifique:
✓ Primeiro step é "trigger"
✓ Último step é "end_success" ou "end_neutral"
✓ Se > 6 steps: existe pelo menos 1 "condition" ou "choice"
✓ Se existe "form": existe "feedback_error" com handling
✓ Todos os steps têm "group_label"
✓ Não há steps consecutivos todos com semantic_type="action"
✓ TODA "condition" tem AMBOS branch_success_meaning E branch_failure_meaning
✓ TODA "condition" tem suggested_edges com success E failure

RETORNE APENAS JSON VÁLIDO, sem markdown ou comentários.`;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const request = FlowSynthesizerRequestSchema.parse(body);

    const openaiKey = Deno.env.get("OPENAI_API_KEY")!;
    const openai = new OpenAI({ apiKey: openaiKey });

    // Construir contexto para o LLM
    const userMessage = `Sintetize um fluxo de usuário completo baseado no seguinte contexto:

## CONTEXTO DO PRODUTO

- Nome: ${request.product_context.product_name}
- Tipo: ${request.product_context.product_type}
- Descrição: ${request.product_context.product_description || "Não especificada"}
- Indústria: ${request.product_context.industry || "Não especificada"}
- Modelo de Negócio: ${request.product_context.business_model || "Não especificado"}

## ROLE DO USUÁRIO

- ID: ${request.user_role.role_id}
- Nome: ${request.user_role.display_name}
- Permissões: ${request.user_role.permissions?.join(", ") || "Padrão"}

## CONTEXTO DO FLUXO

- Objetivo Principal: ${request.flow_context.main_goal}
- Intenção do Usuário: ${request.flow_context.user_intent}
- Resultado Esperado: ${request.flow_context.expected_outcome}
- Ações-Chave: ${request.flow_context.key_actions?.join(", ") || "Não especificadas"}

${request.master_rule_content ? `
## REGRA DE NEGÓCIO ADICIONAL

${request.master_rule_content}
` : ""}

## INSTRUÇÕES

1. Crie steps sequenciais cobrindo todo o fluxo
2. Identifique pontos de decisão
3. Preveja pontos de falha e estratégias de recovery
4. Identifique padrões reutilizáveis
5. Calcule métricas do fluxo

RETORNE APENAS JSON VÁLIDO.`;

    console.log("[v3-flow-synthesizer] Sintetizando fluxo...");

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userMessage },
      ],
      temperature: 0.4,
      max_tokens: 4000,
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

    // Helper function to normalize steps - handles strings or objects
    // V3.1: Prioriza semantic_type sobre step_type
    function normalizeStep(step: any, idx: number): any {
      // If step is a string (just the type), convert to proper object
      if (typeof step === "string") {
        console.log(`[v3-flow-synthesizer] Normalizing string step: ${step}`);
        return {
          step_id: `step_${idx + 1}`,
          title: step.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase()),
          description: `Step ${idx + 1}: ${step}`,
          semantic_type: mapLegacyType(step),
          step_type: step, // Manter para compatibilidade
          group_label: "Etapa Principal",
          order_index: idx,
          can_be_skipped: false,
        };
      }
      
      // V3.1: Priorizar semantic_type, fallback para step_type mapeado
      const rawType = step.semantic_type || step.step_type || "action";
      const semanticType = mapLegacyType(rawType);
      
      // Se ainda é "action" após mapeamento, tentar inferir do título/descrição
      const finalType = semanticType === "action" 
        ? inferTypeFromContent(step.title || "", step.description || "", rawType)
        : semanticType;
      
      return {
        step_id: step.step_id || `step_${idx + 1}`,
        title: step.title || "Untitled Step",
        description: step.description || "",
        semantic_type: finalType,
        step_type: step.step_type || rawType, // Manter para compatibilidade
        group_label: step.group_label || inferGroupLabel(idx, finalType),
        user_intent: step.user_intent,
        system_behavior: step.system_behavior,
        order_index: idx,
        can_be_skipped: step.metadata?.is_optional || step.can_be_skipped || false,
        page_key: step.page_key,
        inputs: step.inputs,
        suggested_edges: step.suggested_edges,
        error_cases: step.error_cases,
        next_steps: step.next_steps,
        conditions: step.conditions,
        metadata: {
          ...step.metadata,
          impact_level: step.metadata?.impact_level || "medium",
        },
      };
    }
    
    // V3.1: Mapeamento de tipos legados para semantic_type
    function mapLegacyType(type: string): string {
      const mapping: Record<string, string> = {
        "entry_point": "trigger",
        "exit_point": "end_neutral",
        "success_state": "end_success",
        "error_state": "end_error",
        "form_input": "form",
        "decision_point": "condition",
        "user_action": "action",
        "system_action": "background_action",
        "api_call": "background_action",
        "validation": "condition",
        "notification": "feedback_success",
        "redirect": "action",
        "data_transform": "action",
      };
      return mapping[type] || type;
    }
    
    // V3.1: Inferir tipo do conteúdo se ainda for action
    function inferTypeFromContent(title: string, description: string, currentType: string): string {
      const content = `${title} ${description}`.toLowerCase();
      
      if (/\b(login|cadastro|register|signup|email|password|form|preenche|fill|dados|payment|checkout|card)\b/.test(content)) {
        return "form";
      }
      if (/\b(se|if|condição|check|verifica|valid|whether|approved|sucesso\?|válido\?)\b/.test(content)) {
        return "condition";
      }
      if (/\b(escolhe|choose|select|método|method|opção|option|tipo|type)\b/.test(content)) {
        return "choice";
      }
      if (/\b(sucesso|success|confirm|complete|done|bem.?vindo|welcome)\b/.test(content)) {
        return "feedback_success";
      }
      if (/\b(erro|error|fail|invalid|incorreto|negado|denied)\b/.test(content)) {
        return "feedback_error";
      }
      if (/\b(process|load|fetch|api|aguarda|wait|async)\b/.test(content)) {
        return "background_action";
      }
      if (/\b(final|end|conclusão|término).*\b(sucesso|success|ok)\b/.test(content)) {
        return "end_success";
      }
      
      return currentType;
    }
    
    // V3.1: Inferir group_label baseado na posição e tipo
    function inferGroupLabel(idx: number, type: string): string {
      if (type === "trigger") return "Início";
      if (type === "end_success" || type === "end_neutral" || type === "end_error") return "Conclusão";
      if (type === "feedback_error" || type === "retry" || type === "loopback" || type === "fallback") return "Tratamento de Erro";
      if (type === "feedback_success") return "Confirmação";
      if (type === "condition") return "Verificação";
      if (idx <= 2) return "Início";
      return "Etapa Principal";
    }

    // Validar com Zod
    const validationResult = LLMResponseSchema.safeParse(parsedResponse);
    
    if (!validationResult.success) {
      console.warn("[v3-flow-synthesizer] Validação parcial:", validationResult.error.errors);
      
      // Extrair dados parciais
      const partialData = parsedResponse as any;
      
      // Log what we got for debugging
      console.log("[v3-flow-synthesizer] Raw steps type:", typeof partialData.steps);
      console.log("[v3-flow-synthesizer] Raw steps sample:", JSON.stringify(partialData.steps?.[0]).slice(0, 200));
      
      // V3.1: Normalizar steps parciais
      const partialNormalizedSteps = (partialData.steps || []).map((step: any, idx: number) => normalizeStep(step, idx));
      const partialTypeDistribution: Record<string, number> = {};
      for (const step of partialNormalizedSteps) {
        const type = step.semantic_type || "unknown";
        partialTypeDistribution[type] = (partialTypeDistribution[type] || 0) + 1;
      }
      
      // Construir resposta com dados parciais no formato esperado
      return new Response(
        JSON.stringify({
          success: true,
          synthesized_flow: {
            flow_id: `flow_${Date.now()}`,
            flow_name: partialData.flow_title || "Fluxo sem título",
            flow_title: partialData.flow_title || "Fluxo sem título",
            flow_description: partialData.flow_description || "",
            category: "general",
            steps: partialNormalizedSteps,
            // V3.1: Incluir novos campos
            decision_points: partialData.decision_points || [],
            failure_points_v3: partialData.failure_points_v3 || [],
            decisions: (partialData.decisions || []).map((d: any) => ({
              decision_id: d.decision_id,
              after_step_id: d.branches?.[0]?.target_step || "",
              condition_expression: d.condition_expression,
              options: (d.branches || []).map((b: any) => ({
                label: b.label,
                leads_to_step_id: b.target_step,
                is_default: b.branch_id === d.default_branch,
              })),
            })),
            failure_points: (partialData.failure_points || []).map((f: any) => ({
              failure_id: f.failure_id,
              at_step_id: f.trigger_step,
              failure_type: f.failure_type,
              error_message: f.error_message,
              recovery_strategy: f.recovery_strategy,
              recovery_step_id: f.recovery_step,
            })),
            semantic_summary: partialData.semantic_summary || "",
            narrative_md: partialData.narrative_md,
          },
          detected_patterns: (partialData.reusable_patterns || []).map((p: any) => p.pattern_type),
          reuse_opportunities: [],
          analysis: {
            total_steps: partialData.flow_metrics?.total_steps || (partialData.steps?.length || 0),
            critical_steps: 0,
            decision_points: partialData.flow_metrics?.decision_points || 0,
            failure_points: partialData.flow_metrics?.failure_points || 0,
            complexity_score: partialData.flow_metrics?.complexity_score || 3,
          },
          // V3.1: Estatísticas de tipo
          type_stats: {
            total_nodes: partialNormalizedSteps.length,
            type_distribution: partialTypeDistribution,
            action_count: partialTypeDistribution["action"] || 0,
            action_ratio: partialNormalizedSteps.length > 0 
              ? (partialTypeDistribution["action"] || 0) / partialNormalizedSteps.length 
              : 0,
            has_branching: (partialTypeDistribution["condition"] || 0) > 0 || (partialTypeDistribution["choice"] || 0) > 0,
            has_error_handling: (partialTypeDistribution["feedback_error"] || 0) > 0,
          },
          validation_warnings: validationResult.error.errors.map(e => `${e.path.join(".")}: ${e.message}`),
          message: "Fluxo sintetizado com validação parcial",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const result: LLMResponse = validationResult.data;

    console.log("[v3-flow-synthesizer] Fluxo sintetizado:", {
      title: result.flow_title,
      steps: result.steps.length,
      decisions: result.decisions?.length || 0,
      failures: result.failure_points?.length || 0,
      patterns: result.reusable_patterns?.length || 0,
      complexity: result.flow_metrics.complexity_score,
    });
    
    // V3.1: Log semantic types for debugging
    console.log("[v3-flow-synthesizer] Semantic types from LLM:", result.steps.map(s => s.semantic_type));
    console.log("[v3-flow-synthesizer] Group labels:", result.steps.map(s => s.group_label));
    console.log("[v3-flow-synthesizer] Decision points:", result.decision_points?.length || 0);
    console.log("[v3-flow-synthesizer] Failure points v3:", result.failure_points_v3?.length || 0);

    // V3.1: Calcular estatísticas de tipo para validação
    const normalizedSteps = result.steps.map((step, idx) => normalizeStep(step, idx));
    const typeDistribution: Record<string, number> = {};
    for (const step of normalizedSteps) {
      const type = step.semantic_type || "unknown";
      typeDistribution[type] = (typeDistribution[type] || 0) + 1;
    }
    
    // Formatar resposta no formato esperado pelo cliente
    return new Response(
      JSON.stringify({
        success: true,
        synthesized_flow: {
          flow_id: `flow_${Date.now()}`,
          flow_name: result.flow_title,
          flow_title: result.flow_title,
          flow_description: result.flow_description,
          category: "general",
          steps: normalizedSteps,
          // V3.1: Decision points explícitos
          decision_points: result.decision_points || [],
          // V3.1: Failure points v3
          failure_points_v3: result.failure_points_v3 || [],
          // Manter formato antigo para compatibilidade
          decisions: (result.decisions || []).map(d => ({
            decision_id: d.decision_id,
            after_step_id: d.branches[0]?.target_step || "",
            condition_expression: d.condition_expression,
            options: d.branches.map(b => ({
              label: b.label,
              leads_to_step_id: b.target_step,
              is_default: b.branch_id === d.default_branch,
            })),
          })),
          failure_points: (result.failure_points || []).map(f => ({
            failure_id: f.failure_id,
            at_step_id: f.trigger_step,
            failure_type: f.failure_type,
            error_message: f.error_message,
            recovery_strategy: f.recovery_strategy,
            recovery_step_id: f.recovery_step,
          })),
          semantic_summary: result.semantic_summary,
          narrative_md: result.narrative_md,
        },
        detected_patterns: (result.reusable_patterns || []).map(p => p.pattern_type),
        reuse_opportunities: (result.reusable_patterns || [])
          .filter(p => p.can_be_extracted)
          .map(p => ({
            step_id: p.steps_involved[0] || "",
            similarity_score: p.is_complete ? 1.0 : 0.5,
          })),
        analysis: {
          total_steps: result.flow_metrics.total_steps,
          critical_steps: result.steps.filter(s => s.metadata?.impact_level === "high").length,
          decision_points: result.flow_metrics.decision_points,
          failure_points: result.flow_metrics.failure_points,
          complexity_score: result.flow_metrics.complexity_score,
        },
        // V3.1: Estatísticas de tipo para validação
        type_stats: {
          total_nodes: normalizedSteps.length,
          type_distribution: typeDistribution,
          action_count: typeDistribution["action"] || 0,
          action_ratio: normalizedSteps.length > 0 
            ? (typeDistribution["action"] || 0) / normalizedSteps.length 
            : 0,
          has_branching: (typeDistribution["condition"] || 0) > 0 || (typeDistribution["choice"] || 0) > 0,
          has_error_handling: (typeDistribution["feedback_error"] || 0) > 0,
        },
        message: `Fluxo "${result.flow_title}" sintetizado com ${result.steps.length} steps`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[v3-flow-synthesizer] Erro:", error);
    return new Response(
      JSON.stringify({ success: false, message: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

