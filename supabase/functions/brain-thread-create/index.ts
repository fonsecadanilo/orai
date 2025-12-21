import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

import type {
  BrainThread,
  BrainThreadCreateRequest,
  BrainThreadCreateResponse,
} from "../_shared/brain-types.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * BRAIN THREAD CREATE
 * 
 * Cria um novo thread de conversa do Brain.
 */

// Schema de entrada
const RequestSchema = z.object({
  project_id: z.number(),
  user_id: z.number(),
  title: z.string().optional(),
  initial_message: z.string().optional(),
});

Deno.serve(async (req: Request) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const request = RequestSchema.parse(body) as BrainThreadCreateRequest;

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log("[brain-thread-create] Creating thread for project:", request.project_id);

    // Gerar ID único para o thread
    const threadId = crypto.randomUUID();
    const now = new Date().toISOString();

    // Criar thread no banco
    const threadData = {
      id: threadId,
      project_id: request.project_id,
      user_id: request.user_id,
      title: request.title || `Thread ${new Date().toLocaleDateString("pt-BR")}`,
      status: "active",
      messages_count: request.initial_message ? 1 : 0,
      last_message_at: now,
      created_at: now,
      updated_at: now,
    };

    const { data: thread, error: threadError } = await supabase
      .from("brain_threads")
      .insert(threadData)
      .select()
      .single();

    if (threadError) {
      console.error("[brain-thread-create] Error creating thread:", threadError);
      
      // Se tabela não existe, criar estrutura sugerida
      if (threadError.code === "42P01") {
        return new Response(
          JSON.stringify({
            success: false,
            message: "Tabela brain_threads não existe. Execute a migration SQL primeiro.",
            migration_sql: `
-- Migration: Create Brain tables
CREATE TABLE IF NOT EXISTS brain_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  title TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  messages_count INTEGER DEFAULT 0,
  last_message_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS brain_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID REFERENCES brain_threads(id) ON DELETE CASCADE,
  project_id INTEGER NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  structured_output JSONB,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS brain_canvas_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id INTEGER NOT NULL,
  thread_id UUID REFERENCES brain_threads(id) ON DELETE CASCADE,
  block_type TEXT DEFAULT 'brain_chat',
  position_x REAL DEFAULT 0,
  position_y REAL DEFAULT 0,
  width REAL DEFAULT 400,
  height REAL DEFAULT 300,
  streaming BOOLEAN DEFAULT FALSE,
  content TEXT DEFAULT '',
  mode TEXT,
  model TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_brain_threads_project ON brain_threads(project_id);
CREATE INDEX IF NOT EXISTS idx_brain_messages_thread ON brain_messages(thread_id);
CREATE INDEX IF NOT EXISTS idx_brain_canvas_blocks_thread ON brain_canvas_blocks(thread_id);
            `,
          }),
          { 
            status: 400, 
            headers: { ...corsHeaders, "Content-Type": "application/json" } 
          }
        );
      }
      
      throw threadError;
    }

    // Se tem mensagem inicial, criar a mensagem do usuário
    if (request.initial_message) {
      const messageId = crypto.randomUUID();
      const messageData = {
        id: messageId,
        thread_id: threadId,
        project_id: request.project_id,
        role: "user",
        content: request.initial_message,
        structured_output: null,
        metadata: {
          mode: "CONSULT",
          model: "pending",
          reasoning_effort: "low",
          text_verbosity: "low",
          routing_reason: "Initial message",
          latency_ms: 0,
          input_tokens: 0,
          output_tokens: 0,
          used_classifier: false,
          was_uncertain: false,
        },
        created_at: now,
      };

      const { error: messageError } = await supabase
        .from("brain_messages")
        .insert(messageData);

      if (messageError) {
        console.error("[brain-thread-create] Error creating initial message:", messageError);
        // Não falhar se a mensagem inicial não puder ser criada
      }
    }

    const response: BrainThreadCreateResponse = {
      success: true,
      thread: thread as BrainThread,
      message: `Thread criado com sucesso${request.initial_message ? " com mensagem inicial" : ""}`,
    };

    console.log("[brain-thread-create] Thread created:", threadId);

    return new Response(
      JSON.stringify(response),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[brain-thread-create] Error:", error);
    
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


