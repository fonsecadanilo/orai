import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import OpenAI from "https://deno.land/x/openai@v4.68.1/mod.ts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * AGENTE 5: UX Block Composer v3.1 (Adaptativo)
 * 
 * RESPONSABILIDADES:
 * - Receber rich nodes do Archetype Modeler
 * - Consultar biblioteca ux_blocks
 * - ADAPTAR blocos (NUNCA copiar literalmente)
 * - Aplicar regras de adaptação por contexto
 * - Gerar subnós hierárquicos
 * 
 * REGRA PRINCIPAL: O agente NUNCA copia blocos da biblioteca literalmente.
 * Sempre adapta conforme: persona, page_key, intent, stage, inputs
 */

// V3 Node type mapping for database compatibility
const V3_NODE_TYPES = new Set([
  "form", "choice", "action", "condition", "trigger",
  "feedback_success", "feedback_error",
  "end_success", "end_error", "end_neutral",
  "retry", "fallback", "loopback",
  "background_action", "delayed_action",
  "configuration_matrix", "insight_branch"
]);

// Schema de entrada
const UXBlockComposerRequestSchema = z.object({
  project_id: z.number(),
  user_id: z.number(),
  rich_nodes: z.array(z.object({
    node_id: z.string(),
    node_type: z.string(),
    original_step_type: z.string().optional(), // Original Flow Synthesizer step type
    title: z.string(),
    description: z.string().optional(),
    impact_level: z.string().optional(),
    inputs: z.array(z.any()).optional(),
    actions: z.array(z.any()).optional(),
  })),
  product_context: z.object({
    product_name: z.string(),
    product_type: z.string(),
    industry: z.string().optional(),
  }),
  user_role: z.object({
    role_id: z.string(),
    role_name: z.string(),
  }).optional(),
  page_context: z.object({
    page_key: z.string(),
    page_type: z.string().optional(),
  }).optional(),
  adaptation_rules: z.array(z.string()).optional(), // IDs de regras customizadas
});

// Schema de bloco adaptado
const AdaptedBlockSchema = z.object({
  block_id: z.string(),
  source_block_id: z.string().optional(), // ID do bloco original na biblioteca
  node_id: z.string(), // ID do rich node associado
  block_type: z.string(),
  adapted: z.boolean(), // Sempre true
  
  // Conteúdo adaptado
  label: z.string(),
  description: z.string().optional(),
  
  // Campos adaptados
  input_fields: z.array(z.object({
    field_id: z.string(),
    field_type: z.string(),
    label: z.string(),
    placeholder: z.string().optional(),
    tooltip: z.string().optional(),
    required: z.boolean(),
    validation_rules: z.array(z.string()).optional(),
    order: z.number(),
  })).optional(),
  
  // Ações adaptadas
  actions: z.array(z.object({
    action_id: z.string(),
    label: z.string(),
    action_type: z.enum(["primary", "secondary", "danger", "ghost"]),
    icon: z.string().optional(),
  })).optional(),
  
  // Subnós (hierarquia)
  children: z.array(z.object({
    subnode_id: z.string(),
    subnode_type: z.string(),
    title: z.string(),
    content: z.any(),
    order: z.number(),
  })).optional(),
  
  // Metadados de adaptação
  adaptation_metadata: z.object({
    rules_applied: z.array(z.string()),
    confidence: z.number(),
    source_archetype: z.string().optional(),
  }),
});

type UXBlockComposerRequest = z.infer<typeof UXBlockComposerRequestSchema>;
type AdaptedBlock = z.infer<typeof AdaptedBlockSchema>;

// Regras de adaptação pré-definidas
const ADAPTATION_RULES: Record<string, (context: any, block: any) => any> = {
  // Em fintech, emails devem ter validação extra
  fintech_email_validation: (ctx, block) => {
    if (ctx.product_type !== "fintech") return block;
    
    const inputs = block.input_fields?.map((input: any) => {
      if (input.field_type === "email") {
        return {
          ...input,
          validation_rules: [
            ...(input.validation_rules || []),
            "corporate_email_preferred",
            "email_verification_required"
          ],
          tooltip: input.tooltip || "Use seu email corporativo para maior segurança"
        };
      }
      return input;
    });
    
    return { ...block, input_fields: inputs };
  },
  
  // Para admins, mostrar campos adicionais
  admin_extra_fields: (ctx, block) => {
    if (ctx.role_id !== "admin") return block;
    
    // Adicionar campos de auditoria
    const adminFields = [
      {
        field_id: "internal_notes",
        field_type: "textarea",
        label: "Notas Internas (Admin)",
        required: false,
        order: 999,
      }
    ];
    
    return {
      ...block,
      input_fields: [...(block.input_fields || []), ...adminFields]
    };
  },
  
  // Em checkout, validação em tempo real
  checkout_realtime_validation: (ctx, block) => {
    if (!ctx.page_key?.includes("checkout")) return block;
    
    const inputs = block.input_fields?.map((input: any) => ({
      ...input,
      validation_rules: [
        ...(input.validation_rules || []),
        "realtime_validation"
      ]
    }));
    
    return { ...block, input_fields: inputs };
  },
  
  // Healthcare - campos de privacidade
  healthcare_privacy: (ctx, block) => {
    if (ctx.product_type !== "healthcare") return block;
    
    return {
      ...block,
      input_fields: block.input_fields?.map((input: any) => ({
        ...input,
        tooltip: input.tooltip || "Seus dados são protegidos conforme LGPD/HIPAA"
      }))
    };
  },
  
  // Formulários longos - adicionar progresso
  long_form_progress: (ctx, block) => {
    if (!block.input_fields || block.input_fields.length < 5) return block;
    
    return {
      ...block,
      adaptation_metadata: {
        ...block.adaptation_metadata,
        show_progress: true,
        save_draft: true,
      }
    };
  },
};

const SYSTEM_PROMPT = `Você é um especialista em UX que adapta blocos de interface para contextos específicos.

## SEU PAPEL

Receber rich nodes e adaptar blocos UX da biblioteca para o contexto do usuário.

## REGRA PRINCIPAL

⚠️ NUNCA copie blocos literalmente. SEMPRE adapte:
- Labels e textos para o contexto
- Placeholders contextuais
- Tooltips úteis
- Ordem dos campos
- Validações específicas

## ADAPTAÇÕES OBRIGATÓRIAS

1. **Fintech/Banking**:
   - Validação rigorosa de emails
   - Campos de CPF/CNPJ com máscara
   - Avisos de segurança

2. **Healthcare**:
   - Avisos de privacidade LGPD/HIPAA
   - Campos sensíveis com proteção extra
   - Consentimentos obrigatórios

3. **E-commerce**:
   - Validação de endereço
   - Cálculo de frete em tempo real
   - Campos de cupom

4. **SaaS Geral**:
   - Onboarding progressivo
   - Tooltips explicativos
   - Campos opcionais bem marcados

## FORMATO DE SAÍDA (JSON OBRIGATÓRIO)

{
  "adapted_blocks": [
    {
      "block_id": "uuid",
      "source_block_id": "original_block_id",
      "node_id": "node_123",
      "block_type": "form",
      "adapted": true,
      "label": "Label contextualizado",
      "input_fields": [
        {
          "field_id": "email",
          "field_type": "email",
          "label": "Email Corporativo",
          "placeholder": "seu@empresa.com",
          "tooltip": "Use seu email de trabalho",
          "required": true,
          "validation_rules": ["email", "corporate_preferred"],
          "order": 1
        }
      ],
      "actions": [
        {
          "action_id": "submit",
          "label": "Continuar",
          "action_type": "primary"
        }
      ],
      "adaptation_metadata": {
        "rules_applied": ["fintech_email_validation"],
        "confidence": 0.9,
        "source_archetype": "form_submission"
      }
    }
  ],
  "total_adapted": 1,
  "adaptation_summary": {
    "rules_applied_count": 3,
    "fields_modified": 5,
    "actions_modified": 2
  }
}

RETORNE APENAS JSON VÁLIDO.`;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const request = UXBlockComposerRequestSchema.parse(body);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const openaiKey = Deno.env.get("OPENAI_API_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseKey);
    const openai = new OpenAI({ apiKey: openaiKey });

    console.log("[v3-ux-block-composer] Compondo blocos para", request.rich_nodes.length, "nós...");
    
    // Log all incoming rich_nodes to see their types
    console.log("[v3-ux-block-composer] Received rich_nodes types:");
    request.rich_nodes.forEach((node, idx) => {
      console.log(`  [${idx}] id=${node.node_id}, type=${node.node_type}, original=${node.original_step_type || 'none'}`);
    });

    // 1. Buscar blocos relevantes da biblioteca
    const nodeTypes = [...new Set(request.rich_nodes.map(n => n.node_type))];
    
    const { data: libraryBlocks } = await supabase
      .from("ux_blocks")
      .select("*")
      .or(`archetype.in.(${nodeTypes.join(",")}),use_cases.cs.{${nodeTypes.join(",")}}`)
      .limit(20);

    console.log("[v3-ux-block-composer] Encontrados", libraryBlocks?.length || 0, "blocos na biblioteca");

    // 2. Preparar contexto para adaptação
    const adaptationContext = {
      product_type: request.product_context.product_type,
      product_name: request.product_context.product_name,
      industry: request.product_context.industry,
      role_id: request.user_role?.role_id,
      role_name: request.user_role?.role_name,
      page_key: request.page_context?.page_key,
      page_type: request.page_context?.page_type,
    };

    // 3. Usar LLM para adaptar blocos
    const userMessage = `Adapte blocos UX para os seguintes rich nodes:

## CONTEXTO

- Produto: ${request.product_context.product_name} (${request.product_context.product_type})
- Indústria: ${request.product_context.industry || "Geral"}
- Role: ${request.user_role?.role_name || "Usuário"}
- Página: ${request.page_context?.page_key || "Geral"}

## RICH NODES PARA ADAPTAR

${JSON.stringify(request.rich_nodes, null, 2)}

## BLOCOS DA BIBLIOTECA (REFERÊNCIA)

${JSON.stringify(libraryBlocks || [], null, 2)}

## INSTRUÇÕES

1. Para cada rich node, crie um bloco UX adaptado
2. ADAPTE labels, placeholders e tooltips para o contexto
3. Adicione validações específicas para o tipo de produto
4. Organize campos em ordem lógica
5. Gere subnós quando apropriado (forms longos, wizards)

⚠️ NÃO copie blocos literalmente - SEMPRE adapte!

RETORNE APENAS JSON VÁLIDO.`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userMessage },
      ],
      temperature: 0.5,
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

    let parsedResponse: any;
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

    // 4. Aplicar regras de adaptação determinísticas
    let adaptedBlocks = parsedResponse.adapted_blocks || [];
    const rulesApplied: string[] = [];
    
    for (const [ruleId, ruleFn] of Object.entries(ADAPTATION_RULES)) {
      adaptedBlocks = adaptedBlocks.map((block: any) => {
        const adapted = ruleFn(adaptationContext, block);
        if (adapted !== block) {
          rulesApplied.push(ruleId);
        }
        return adapted;
      });
    }

    // 5. Garantir que todos os blocos têm adapted: true
    adaptedBlocks = adaptedBlocks.map((block: any) => ({
      ...block,
      adapted: true,
      adaptation_metadata: {
        ...(block.adaptation_metadata || {}),
        rules_applied: [
          ...(block.adaptation_metadata?.rules_applied || []),
          ...rulesApplied,
        ],
      },
    }));

    console.log("[v3-ux-block-composer] Composição completa:", {
      composed_blocks: adaptedBlocks.length,
      rules_applied: rulesApplied.length,
    });

    // Converter adapted_blocks para composed_blocks no formato esperado
    // CRITICAL: Preserve node_id and node_type from original rich_nodes
    console.log("[UX Block Composer] Mapping blocks. rich_nodes count:", request.rich_nodes.length, "adapted_blocks count:", adaptedBlocks.length);
    
    const composedBlocks = adaptedBlocks.map((block: any, index: number) => {
      // Get original rich node to preserve node_id and node_type
      const originalNode = request.rich_nodes[index];
      
      // Log detailed info about the original node
      console.log(`[UX Block Composer] Original rich_node[${index}]:`, JSON.stringify({
        node_id: originalNode?.node_id,
        node_type: originalNode?.node_type,
        original_step_type: originalNode?.original_step_type,
        title: originalNode?.title
      }));
      
      // Determine the final V3 node type - ALWAYS use from original rich_node if available
      const v3NodeType = originalNode?.node_type || block.block_type || "action";
      
      // Validate it's a valid V3 type, otherwise fall back to "action"
      const finalNodeType = V3_NODE_TYPES.has(v3NodeType) ? v3NodeType : "action";
      
      console.log(`[UX Block Composer] Block ${index}: v3NodeType=${v3NodeType}, finalNodeType=${finalNodeType}`);
      
      return {
        // CRITICAL: Use original node_id to maintain connection mapping
        block_id: originalNode?.node_id || block.node_id || block.block_id || `block_${Math.random().toString(36).slice(2, 9)}`,
        node_id: originalNode?.node_id || block.node_id, // Link back to original step
        original_block_id: block.source_block_id,
        adapted: block.adapted ?? true,
        // CRITICAL: Use V3 node type from original rich_node
        block_type: finalNodeType,
        original_step_type: originalNode?.original_step_type, // Preserve for debugging
        title: block.label || block.title || originalNode?.title || "Block",
        description: block.description || originalNode?.description,
        input_fields: (block.input_fields || originalNode?.inputs || []).map((field: any) => ({
          field_name: field.field_id || field.field_name,
          field_type: field.field_type || "text",
          label: field.label,
          placeholder: field.placeholder,
          tooltip: field.tooltip,
          required: field.required ?? false,
          validation_rules: field.validation_rules || [],
        })),
        actions: (block.actions || []).map((action: any) => ({
          action_id: action.action_id || `action_${Math.random().toString(36).slice(2, 9)}`,
          label: action.label || "Action",
          action_type: action.action_type || "primary",
          icon: action.icon,
        })),
        children: (block.children || []).map((child: any) => ({
          subnode_id: child.subnode_id || `sub_${Math.random().toString(36).slice(2, 9)}`,
          subnode_type: child.subnode_type || "field",
          content: child.content || child.title,
          order: child.order || 0,
        })),
        impact_level: block.impact_level || originalNode?.impact_level || "medium",
        role_scope: block.role_scope,
        group_label: block.group_label,
        adapted_for_page_key: block.page_key,
        adapted_for_intent: block.intent,
      };
    });

    return new Response(
      JSON.stringify({
        success: true,
        // Campos esperados pelo cliente (UXBlockComposerV3Response)
        composed_blocks: composedBlocks,
        blocks_from_library: libraryBlocks?.length || 0,
        blocks_generated: composedBlocks.length,
        adaptation_notes: rulesApplied.map(rule => ({
          step_id: "adaptation",
          note: `Regra aplicada: ${rule}`,
        })),
        // Campos extras para debug
        adaptation_summary: {
          total_adaptations: rulesApplied.length,
          by_context: {
            product_type: request.product_context.product_type,
            role: request.user_role?.role_id,
          },
        },
        message: `Compostos ${composedBlocks.length} blocos UX adaptados`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[v3-ux-block-composer] Erro:", error);
    return new Response(
      JSON.stringify({ success: false, message: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

