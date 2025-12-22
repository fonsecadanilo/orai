import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

import type {
  BrainThread,
  BrainMessage,
  BrainThreadGetRequest,
  BrainThreadGetResponse,
} from "../_shared/brain-types.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * BRAIN THREAD GET
 * 
 * Busca um thread e suas mensagens.
 */

// Schema de entrada
const RequestSchema = z.object({
  thread_id: z.string().uuid(),
  include_messages: z.boolean().optional().default(true),
  messages_limit: z.number().positive().optional().default(50),
});

Deno.serve(async (req: Request) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const request = RequestSchema.parse(body) as BrainThreadGetRequest;

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log("[brain-thread-get] Fetching thread:", request.thread_id);

    // Buscar thread
    const { data: thread, error: threadError } = await supabase
      .from("brain_threads")
      .select("*")
      .eq("id", request.thread_id)
      .single();

    if (threadError) {
      if (threadError.code === "PGRST116") {
        return new Response(
          JSON.stringify({
            success: false,
            message: `Thread não encontrado: ${request.thread_id}`,
          }),
          { 
            status: 404, 
            headers: { ...corsHeaders, "Content-Type": "application/json" } 
          }
        );
      }
      throw threadError;
    }

    let messages: BrainMessage[] | undefined;

    // Buscar mensagens se solicitado
    if (request.include_messages) {
      const { data: messagesData, error: messagesError } = await supabase
        .from("brain_messages")
        .select("*")
        .eq("thread_id", request.thread_id)
        .order("created_at", { ascending: true })
        .limit(request.messages_limit || 50);

      if (messagesError) {
        console.error("[brain-thread-get] Error fetching messages:", messagesError);
        // Não falhar se as mensagens não puderem ser buscadas
      } else {
        messages = messagesData as BrainMessage[];
      }
    }

    const response: BrainThreadGetResponse = {
      success: true,
      thread: thread as BrainThread,
      messages,
      message: `Thread carregado com ${messages?.length || 0} mensagens`,
    };

    console.log("[brain-thread-get] Thread fetched:", request.thread_id);

    return new Response(
      JSON.stringify(response),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[brain-thread-get] Error:", error);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        message: error instanceof Error ? error.message : String(error) 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
});




