import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import OpenAI from "https://deno.land/x/openai@v4.68.1/mod.ts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * AGENTE 3: Archetype Modeler v3.1
 * 
 * RESPONSABILIDADES:
 * - Receber fluxo sintetizado do Flow Synthesizer
 * - Aplicar arquétipos de UX, Segurança, Compliance
 * - Enriquecer steps com metadados de arquétipo
 * - Mapear padrões para cada passo
 * - Gerar rich nodes com semântica completa
 */

// Schema de entrada - mais leniente para evitar erros de validação
const ArchetypeModelerRequestSchema = z.object({
  project_id: z.union([z.number(), z.string()]).transform(val => 
    typeof val === 'string' ? parseInt(val, 10) : val
  ),
  user_id: z.union([z.number(), z.string()]).transform(val => 
    typeof val === 'string' ? parseInt(val, 10) : val
  ),
  product_context: z.object({
    product_name: z.string().optional().default("Produto"),
    product_type: z.string().optional().default("saas"),
    industry: z.string().optional().nullable(),
    business_model: z.string().optional().nullable(),
  }),
  synthesized_flow: z.object({
    flow_title: z.string().optional().default("Fluxo"),
    flow_description: z.string().optional().default("Descrição do fluxo"),
    steps: z.array(z.any()).optional().default([]),
    decisions: z.array(z.any()).optional().default([]),
    failure_points: z.array(z.any()).optional().default([]),
    reusable_patterns: z.array(z.any()).optional().default([]),
    flow_metrics: z.any().optional().nullable(),
  }),
  user_role: z.object({
    role_id: z.string(),
    role_name: z.string(),
  }).optional().nullable(),
});

// Schema de arquétipo - mais leniente
const ArchetypeSchema = z.object({
  archetype_id: z.string(),
  archetype_name: z.string(),
  category: z.string().optional().default("ux_pattern"),
  description: z.string().optional().default(""),
  recommendations: z.array(z.string()).optional().default([]),
  required_actions: z.array(z.string()).optional().default([]),
  priority: z.string().optional().default("medium"),
});

// Schema de rich node v3 - mais leniente para aceitar respostas do LLM
const RichNodeSchema = z.object({
  node_id: z.string(),
  node_type: z.string().transform(val => {
    // Normalize node types
    const validTypes = [
      "form", "choice", "action", "feedback_success", "feedback_error",
      "condition", "end_success", "end_error", "end_neutral",
      "retry", "fallback", "loopback", "background_action",
      "delayed_action", "configuration_matrix", "insight_branch",
      "trigger", "entry_point", "exit_point"
    ];
    return validTypes.includes(val) ? val : "action";
  }),
  title: z.string().optional().default("Untitled"),
  description: z.string().optional().default(""),
  
  // Atributos v3.1
  impact_level: z.enum(["low", "medium", "high"]).optional().default("medium"),
  role_scope: z.array(z.string()).optional().default([]),
  group_label: z.string().optional().nullable(),
  
  // Arquétipos aplicados
  applied_archetypes: z.array(z.string()).optional().default([]),
  
  // Inputs (para forms)
  inputs: z.array(z.object({
    field_id: z.string(),
    field_type: z.string(),
    label: z.string(),
    required: z.boolean().optional().default(false),
    validation_rules: z.array(z.string()).optional(),
    placeholder: z.string().optional(),
    tooltip: z.string().optional(),
  })).optional().default([]),
  
  // Ações
  actions: z.array(z.object({
    action_id: z.string(),
    action_type: z.string(),
    label: z.string(),
    is_primary: z.boolean().optional().default(false),
  })).optional().default([]),
  
  // Conexões
  connections: z.array(z.object({
    target_node_id: z.string(),
    connection_type: z.string().optional().default("success"),
    label: z.string().optional(),
    condition: z.string().optional(),
  })).optional().default([]),
  
  // Metadados UX
  ux_metadata: z.object({
    estimated_time_seconds: z.number().optional(),
    requires_confirmation: z.boolean().optional(),
    show_progress: z.boolean().optional(),
    animation_type: z.string().optional(),
  }).optional().nullable(),
  
  // Metadados de segurança
  security_metadata: z.object({
    requires_authentication: z.boolean().optional(),
    requires_authorization: z.boolean().optional(),
    required_permissions: z.array(z.string()).optional(),
    audit_log: z.boolean().optional(),
    sensitive_data: z.boolean().optional(),
  }).optional().nullable(),
});

// Schema de resposta do LLM - mais leniente
const LLMResponseSchema = z.object({
  identified_archetypes: z.array(z.any()).optional().default([]),
  rich_nodes: z.array(z.any()).optional().default([]),
  archetype_coverage: z.object({
    ux_patterns: z.number().optional().default(50),
    security: z.number().optional().default(50),
    compliance: z.number().optional().default(50),
    accessibility: z.number().optional().default(50),
  }).optional().default({
    ux_patterns: 50,
    security: 50,
    compliance: 50,
    accessibility: 50,
  }),
  modeling_notes: z.array(z.string()).optional().default([]),
  improvement_suggestions: z.array(z.object({
    category: z.string(),
    suggestion: z.string(),
    priority: z.string().optional().default("medium"),
    affected_nodes: z.array(z.string()).optional().default([]),
  })).optional().default([]),
});

type ArchetypeModelerRequest = z.infer<typeof ArchetypeModelerRequestSchema>;
type LLMResponse = z.infer<typeof LLMResponseSchema>;

const SYSTEM_PROMPT = `Você é um especialista em arquitetura de UX e modelagem de fluxos.

## SEU PAPEL

Receber um fluxo sintetizado e enriquecê-lo com:
1. **Arquétipos** - Padrões de UX, segurança, compliance
2. **Rich Nodes** - Nós com semântica completa v3.1
3. **Recomendações** - Melhorias baseadas em arquétipos

## TIPOS DE NÓS v3.1

- form: Formulário para entrada de dados
- choice: Escolha entre opções
- action: Ação executada pelo sistema
- feedback_success: Feedback positivo
- feedback_error: Feedback de erro
- condition: Condição/decisão
- end_success: Término bem-sucedido
- end_error: Término com erro
- end_neutral: Término neutro
- retry: Tentativa novamente
- fallback: Caminho alternativo
- loopback: Retorno a passo anterior
- background_action: Ação em background
- delayed_action: Ação com delay
- configuration_matrix: Matriz de configuração
- insight_branch: Ramificação por dados

## CATEGORIAS DE ARQUÉTIPO

1. **ux_pattern**: Padrões de experiência do usuário
   - Progressive disclosure
   - Feedback imediato
   - Validação inline
   - Loading states

2. **security**: Segurança
   - Rate limiting
   - CSRF protection
   - Input sanitization
   - Session management

3. **compliance**: Conformidade
   - LGPD/GDPR
   - Termos de uso
   - Audit trail
   - Data retention

4. **accessibility**: Acessibilidade
   - Screen reader
   - Keyboard navigation
   - Color contrast
   - Focus management

5. **performance**: Performance
   - Lazy loading
   - Caching
   - Debouncing
   - Optimistic updates

6. **error_handling**: Tratamento de erros
   - Graceful degradation
   - Retry logic
   - Error boundaries
   - Fallback UI

7. **data_privacy**: Privacidade
   - Data masking
   - Encryption
   - Consent management
   - Right to deletion

8. **user_onboarding**: Onboarding
   - Tooltips
   - Walkthroughs
   - Progress indicators
   - Skip options

## REGRAS

1. Todo form deve ter validação inline (ux_pattern)
2. Ações sensíveis devem ter impact_level: "high"
3. Forms com dados pessoais devem ter compliance LGPD
4. Sempre incluir feedback após ações
5. Calcule archetype_coverage como percentual de cobertura

## FORMATO DE SAÍDA (JSON OBRIGATÓRIO)

{
  "identified_archetypes": [...],
  "rich_nodes": [...],
  "archetype_coverage": {
    "ux_patterns": 85,
    "security": 70,
    "compliance": 60,
    "accessibility": 50
  },
  "modeling_notes": [...],
  "improvement_suggestions": [...]
}

RETORNE APENAS JSON VÁLIDO.`;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    
    console.log("[v3-archetype-modeler] Request received:", {
      project_id: body.project_id,
      user_id: body.user_id,
      has_product_context: !!body.product_context,
      has_synthesized_flow: !!body.synthesized_flow,
      steps_count: body.synthesized_flow?.steps?.length,
    });
    
    // Parse with validation
    const parseResult = ArchetypeModelerRequestSchema.safeParse(body);
    
    if (!parseResult.success) {
      console.error("[v3-archetype-modeler] Validation errors:", parseResult.error.errors);
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: "Validation error",
          errors: parseResult.error.errors.map(e => `${e.path.join(".")}: ${e.message}`),
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    const request = parseResult.data;

    const openaiKey = Deno.env.get("OPENAI_API_KEY")!;
    const openai = new OpenAI({ apiKey: openaiKey });

    const userMessage = `Modele arquétipos e gere rich nodes v3.1 para o seguinte fluxo:

## CONTEXTO DO PRODUTO

- Nome: ${request.product_context.product_name}
- Tipo: ${request.product_context.product_type}
- Indústria: ${request.product_context.industry || "Não especificada"}

## FLUXO SINTETIZADO

Título: ${request.synthesized_flow.flow_title}
Descrição: ${request.synthesized_flow.flow_description}

### Steps:
${JSON.stringify(request.synthesized_flow.steps, null, 2)}

### Decisions:
${JSON.stringify(request.synthesized_flow.decisions, null, 2)}

### Failure Points:
${JSON.stringify(request.synthesized_flow.failure_points, null, 2)}

${request.user_role ? `
## ROLE DO USUÁRIO
- ID: ${request.user_role.role_id}
- Nome: ${request.user_role.role_name}
` : ""}

## INSTRUÇÕES

1. Identifique arquétipos aplicáveis
2. Converta steps em rich nodes v3.1
3. Adicione metadados de segurança e UX
4. Calcule cobertura de arquétipos
5. Sugira melhorias

RETORNE APENAS JSON VÁLIDO.`;

    console.log("[v3-archetype-modeler] Modelando arquétipos...");

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userMessage },
      ],
      temperature: 0.4,
      max_tokens: 5000,
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

    const validationResult = LLMResponseSchema.safeParse(parsedResponse);
    
    if (!validationResult.success) {
      console.warn("[v3-archetype-modeler] Validação parcial:", validationResult.error.errors);
      
      const partialData = parsedResponse as any;
      
      return new Response(
        JSON.stringify({
          success: true,
          ...partialData,
          validation_warnings: validationResult.error.errors.map(e => `${e.path.join(".")}: ${e.message}`),
          message: "Arquétipos modelados com validação parcial",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const result: LLMResponse = validationResult.data;

    console.log("[v3-archetype-modeler] Modelagem completa:", {
      archetypes: result.identified_archetypes.length,
      rich_nodes: result.rich_nodes.length,
      coverage: result.archetype_coverage,
    });

    return new Response(
      JSON.stringify({
        success: true,
        ...result,
        message: `Modelados ${result.identified_archetypes.length} arquétipos e ${result.rich_nodes.length} rich nodes`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[v3-archetype-modeler] Erro:", error);
    return new Response(
      JSON.stringify({ success: false, message: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});


