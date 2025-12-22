import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * BRAIN MESSAGE SEND - Versão simplificada para teste
 */
Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const { project_id, thread_id, user_prompt, force_mode } = await req.json();

    console.log("📨 Brain message received:", { project_id, thread_id, user_prompt, force_mode });

    // Criar cliente Supabase
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Gerar IDs
    const now = new Date().toISOString();
    const actualThreadId = thread_id || crypto.randomUUID();
    const userMessageId = crypto.randomUUID();
    const assistantMessageId = crypto.randomUUID();

    // Criar thread se não existir
    if (!thread_id) {
      const { error: threadError } = await supabase
        .from("brain_threads")
        .insert({
          id: actualThreadId,
          project_id,
          title: `Brain ${new Date().toLocaleDateString("pt-BR")}`,
          status: "active",
          messages_count: 0,
          last_message_at: now,
          created_at: now,
          updated_at: now,
        });
      if (threadError) console.warn("Thread insert warning:", threadError);
    }

    // Salvar mensagem do usuário
    const { error: userMsgError } = await supabase
      .from("brain_messages")
      .insert({
        id: userMessageId,
        thread_id: actualThreadId,
        project_id,
        role: "user",
        content: user_prompt,
        metadata: {
          mode: force_mode || "CONSULT",
          model: "test-model",
        },
        created_at: now,
      });
    if (userMsgError) console.warn("User message insert warning:", userMsgError);

    // Simular resposta do assistente
    const assistantResponse = `Olá! Recebi sua mensagem: "${user_prompt}"

Esta é uma resposta de teste do Brain. O sistema de roteamento inteligente de modelos LLM está configurado e funcionando.

Para criar fluxos completos, o Brain utilizará:
- **Modo PLAN**: Para arquitetura e planejamento complexo
- **Modo CONSULT**: Para consultas rápidas e explicações  
- **Modo BATCH**: Para tarefas repetitivas

O que você gostaria de fazer? Posso ajudar a criar flows, regras de negócio ou esclarecer dúvidas sobre o sistema.`;

    // Salvar resposta do assistente
    const { error: assistantMsgError } = await supabase
      .from("brain_messages")
      .insert({
        id: assistantMessageId,
        thread_id: actualThreadId,
        project_id,
        role: "assistant",
        content: assistantResponse,
        metadata: {
          mode: force_mode || "CONSULT",
          model: "test-model",
          routing_reason: "Test mode",
          latency_ms: 100,
        },
        created_at: new Date().toISOString(),
      });
    if (assistantMsgError) console.warn("Assistant message insert warning:", assistantMsgError);

    // Atualizar contador do thread
    await supabase
      .from("brain_threads")
      .update({ 
        messages_count: 2, 
        last_message_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", actualThreadId);

    console.log("✅ Brain response saved successfully");

    return new Response(
      JSON.stringify({
        success: true,
        thread_id: actualThreadId,
        user_message_id: userMessageId,
        assistant_message_id: assistantMessageId,
        mode: force_mode || "CONSULT",
        model: "test-model",
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  } catch (error) {
    console.error("❌ Brain message send error:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        message: error instanceof Error ? error.message : "Unknown error",
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
});
