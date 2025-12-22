import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import OpenAI from "https://deno.land/x/openai@v4.68.1/mod.ts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * AGENTE: UX Block Composer v3.0
 * 
 * Este agente consulta a biblioteca de blocos UX e copia/adapta blocos relevantes
 * para o contexto do usuário.
 * 
 * FLUXO:
 * 1. Recebe contexto (master rule, journey, use cases, etc.)
 * 2. Busca blocos relevantes na biblioteca ux_blocks
 * 3. Usa IA para selecionar e adaptar blocos
 * 4. Retorna blocos adaptados prontos para uso
 */

// Schema de entrada
const UXBlockComposerRequestSchema = z.object({
  project_id: z.number(),
  user_id: z.number(),
  context: z.object({
    master_rule_id: z.number().optional(),
    master_rule_content: z.any().optional(),
    journey: z.any().optional(),
    use_cases: z.array(z.string()).optional(),
    business_type: z.string().optional(),
    target_features: z.array(z.string()).optional(),
  }),
  search_query: z.string().optional(),
  max_blocks: z.number().default(10),
  conversation_id: z.string().optional(),
});

// Schema de bloco UX da biblioteca
const UXBlockSchema = z.object({
  id: z.string(),
  label: z.string(),
  description: z.string(),
  use_cases: z.array(z.string()),
  archetype: z.string(),
  semantic_flow: z.any(),
  block_references: z.array(z.string()).optional(),
});

// Schema de resposta
const UXBlockComposerResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  selected_blocks: z.array(z.object({
    block_id: z.string(),
    block_label: z.string(),
    relevance_score: z.number().optional(),
    adapted_semantic_flow: z.any(),
    adaptation_notes: z.string().optional(),
  })),
  total_blocks_found: z.number(),
});

type UXBlockComposerRequest = z.infer<typeof UXBlockComposerRequestSchema>;
type UXBlockComposerResponse = z.infer<typeof UXBlockComposerResponseSchema>;
type UXBlock = z.infer<typeof UXBlockSchema>;

const SYSTEM_PROMPT = `Você é um especialista em UX que consulta uma biblioteca de blocos UX e adapta blocos para o contexto do usuário.

## SUA TAREFA

1. Analisar o contexto fornecido (regra de negócio, jornada, casos de uso)
2. Selecionar blocos UX relevantes da biblioteca
3. Adaptar os blocos selecionados para o contexto específico
4. Retornar os blocos adaptados prontos para uso

## REGRAS DE SELEÇÃO

- Priorize blocos que se alinham com os casos de uso mencionados
- Considere o tipo de negócio e arquétipo do fluxo
- Selecione blocos que complementem a jornada do usuário
- Evite blocos redundantes ou muito similares

## REGRAS DE ADAPTAÇÃO

- Mantenha a estrutura semântica do bloco original
- Adapte labels, mensagens e textos para o contexto
- Preserve a lógica de fluxo e decisões
- Adicione campos específicos quando necessário
- Mantenha boas práticas de UX

## FORMATO DE RESPOSTA

Retorne um JSON com:
- selected_blocks: array de blocos selecionados e adaptados
- Para cada bloco:
  - block_id: ID do bloco original
  - block_label: Label do bloco
  - relevance_score: Score de 0-1 indicando relevância
  - adapted_semantic_flow: Fluxo semântico adaptado
  - adaptation_notes: Notas sobre as adaptações feitas`;

Deno.serve(async (req: Request) => {
  // CORS
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validar request
    const body = await req.json();
    const request = UXBlockComposerRequestSchema.parse(body);

    // Criar cliente Supabase
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Criar cliente OpenAI
    const openaiApiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openaiApiKey) {
      throw new Error("OPENAI_API_KEY não configurada");
    }
    const openai = new OpenAI({ apiKey: openaiApiKey });

    console.log("[ux-block-composer] Buscando blocos na biblioteca...");

    // 1. Buscar blocos na biblioteca
    let query = supabase
      .from("ux_blocks")
      .select("*");

    // Filtrar por casos de uso se fornecidos
    if (request.context.use_cases && request.context.use_cases.length > 0) {
      query = query.overlaps("use_cases", request.context.use_cases);
    }

    // Busca por texto se fornecida
    if (request.search_query) {
      query = query.or(
        `label.ilike.%${request.search_query}%,description.ilike.%${request.search_query}%`
      );
    }

    const { data: blocks, error: blocksError } = await query.limit(50);

    if (blocksError) {
      throw new Error(`Erro ao buscar blocos: ${blocksError.message}`);
    }

    if (!blocks || blocks.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: "Nenhum bloco encontrado na biblioteca",
          selected_blocks: [],
          total_blocks_found: 0,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[ux-block-composer] Encontrados ${blocks.length} blocos na biblioteca`);

    // 2. Preparar contexto para IA
    const contextDescription = `
CONTEXTO DO PROJETO:
- Tipo de negócio: ${request.context.business_type || "Não especificado"}
- Casos de uso: ${request.context.use_cases?.join(", ") || "Não especificados"}
- Features alvo: ${request.context.target_features?.join(", ") || "Não especificadas"}

${request.context.master_rule_content 
  ? `REGRA DE NEGÓCIO:\n${JSON.stringify(request.context.master_rule_content, null, 2)}`
  : ""
}

${request.context.journey
  ? `JORNADA DO USUÁRIO:\n${JSON.stringify(request.context.journey, null, 2)}`
  : ""
}
`;

    // 3. Usar IA para selecionar e adaptar blocos
    const blocksDescription = blocks.map((block: any) => ({
      id: block.id,
      label: block.label,
      description: block.description,
      use_cases: block.use_cases,
      archetype: block.archetype,
      semantic_flow: block.semantic_flow,
    }));

    const userMessage = `${contextDescription}

BIBLIOTECA DE BLOCOS UX DISPONÍVEIS:
${JSON.stringify(blocksDescription, null, 2)}

${request.search_query ? `\nQUERY DE BUSCA: ${request.search_query}` : ""}

Selecione até ${request.max_blocks} blocos mais relevantes e adapte-os para o contexto fornecido.
Retorne APENAS um JSON válido no formato especificado, sem markdown ou explicações adicionais.`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userMessage },
      ],
      temperature: 0.7,
      response_format: { type: "json_object" },
    });

    const aiResponse = JSON.parse(completion.choices[0].message.content || "{}");

    // 4. Processar resposta da IA
    const selectedBlocks = aiResponse.selected_blocks || [];
    
    // Validar e enriquecer blocos selecionados
    const enrichedBlocks = selectedBlocks.map((block: any) => {
      // Buscar bloco original para garantir integridade
      const originalBlock = blocks.find((b: any) => b.id === block.block_id);
      
      return {
        block_id: block.block_id || originalBlock?.id,
        block_label: block.block_label || originalBlock?.label,
        relevance_score: block.relevance_score || 0.5,
        adapted_semantic_flow: block.adapted_semantic_flow || originalBlock?.semantic_flow,
        adaptation_notes: block.adaptation_notes || "",
      };
    });

    // 5. Retornar resposta
    const response: UXBlockComposerResponse = {
      success: true,
      message: `Selecionados ${enrichedBlocks.length} blocos UX relevantes`,
      selected_blocks: enrichedBlocks,
      total_blocks_found: blocks.length,
    };

    return new Response(
      JSON.stringify(response),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("[ux-block-composer] Erro:", error);
    
    return new Response(
      JSON.stringify({
        success: false,
        message: error.message || "Erro ao processar requisição",
        selected_blocks: [],
        total_blocks_found: 0,
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
});









