import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * EDITOR ADD BRAIN BLOCK
 * 
 * Cria um Brain Block no canvas com thread associado.
 * Usado pela toolbar do Editor.
 */

const RequestSchema = z.object({
  project_id: z.number(),
  user_id: z.number(),
  position_x: z.number().optional().default(100),
  position_y: z.number().optional().default(100),
  thread_id: z.string().uuid().optional(),
  initial_prompt: z.string().optional(),
});

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const request = RequestSchema.parse(body);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log("[editor-add-brain-block] Adding block for project:", request.project_id);

    const now = new Date().toISOString();
    let threadId = request.thread_id;

    // Criar thread se não existir
    if (!threadId) {
      threadId = crypto.randomUUID();
      const { error: threadError } = await supabase
        .from("brain_threads")
        .insert({
          id: threadId,
          project_id: request.project_id,
          user_id: request.user_id,
          title: request.initial_prompt 
            ? request.initial_prompt.slice(0, 50) + (request.initial_prompt.length > 50 ? "..." : "")
            : `Brain ${new Date().toLocaleDateString("pt-BR")}`,
          status: "active",
          messages_count: 0,
          last_message_at: now,
          created_at: now,
          updated_at: now,
        });

      if (threadError) {
        console.error("[editor-add-brain-block] Error creating thread:", threadError);
        throw threadError;
      }
    }

    // Buscar thread para retornar
    const { data: thread, error: getThreadError } = await supabase
      .from("brain_threads")
      .select("*")
      .eq("id", threadId)
      .single();

    if (getThreadError) throw getThreadError;

    // Buscar posição sem overlap
    const { data: existingBlocks } = await supabase
      .from("brain_canvas_blocks")
      .select("position_x, position_y, width, height")
      .eq("project_id", request.project_id);

    let finalX = request.position_x;
    let finalY = request.position_y;
    const blockWidth = 500;
    const blockHeight = 450;
    const padding = 50;

    // Algoritmo simples para evitar overlap
    if (existingBlocks && existingBlocks.length > 0) {
      let hasOverlap = true;
      let attempts = 0;
      const maxAttempts = 20;

      while (hasOverlap && attempts < maxAttempts) {
        hasOverlap = false;
        for (const block of existingBlocks) {
          const bx = block.position_x || 0;
          const by = block.position_y || 0;
          const bw = block.width || 400;
          const bh = block.height || 300;

          // Check overlap
          if (
            finalX < bx + bw + padding &&
            finalX + blockWidth + padding > bx &&
            finalY < by + bh + padding &&
            finalY + blockHeight + padding > by
          ) {
            hasOverlap = true;
            // Mover para direita
            finalX = bx + bw + padding;
            break;
          }
        }
        attempts++;
      }

      // Se ainda tem overlap, mover para baixo
      if (hasOverlap) {
        finalY = Math.max(...existingBlocks.map(b => (b.position_y || 0) + (b.height || 300))) + padding;
        finalX = request.position_x;
      }
    }

    // Criar canvas block
    const canvasBlockId = crypto.randomUUID();
    const { data: canvasBlock, error: blockError } = await supabase
      .from("brain_canvas_blocks")
      .insert({
        id: canvasBlockId,
        project_id: request.project_id,
        thread_id: threadId,
        block_type: "brain_chat",
        position_x: finalX,
        position_y: finalY,
        width: blockWidth,
        height: blockHeight,
        streaming: false,
        content: "",
        mode: null,
        model: null,
        plan_id: null,
        created_at: now,
        updated_at: now,
      })
      .select()
      .single();

    if (blockError) {
      console.error("[editor-add-brain-block] Error creating block:", blockError);
      throw blockError;
    }

    // Se tem prompt inicial, criar mensagem do usuário
    if (request.initial_prompt) {
      await supabase.from("brain_messages").insert({
        id: crypto.randomUUID(),
        thread_id: threadId,
        project_id: request.project_id,
        role: "user",
        content: request.initial_prompt,
        structured_output: null,
        metadata: {
          mode: "PLAN",
          model: "pending",
          reasoning_effort: "medium",
          text_verbosity: "medium",
          routing_reason: "Initial prompt from toolbar",
          latency_ms: 0,
          input_tokens: 0,
          output_tokens: 0,
          used_classifier: false,
          was_uncertain: false,
        },
        created_at: now,
      });

      // Atualizar thread count
      await supabase
        .from("brain_threads")
        .update({ messages_count: 1, last_message_at: now, updated_at: now })
        .eq("id", threadId);
    }

    console.log("[editor-add-brain-block] Block created:", canvasBlockId);

    return new Response(
      JSON.stringify({
        success: true,
        canvas_block: canvasBlock,
        thread: thread,
        message: "Brain Block criado com sucesso",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[editor-add-brain-block] Error:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        message: error instanceof Error ? error.message : String(error) 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

