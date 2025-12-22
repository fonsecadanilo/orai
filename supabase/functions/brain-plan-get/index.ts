import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * BRAIN PLAN GET
 * 
 * Busca plano por canvas_block_id ou plan_id.
 * Retorna também histórico de versões.
 */

const RequestSchema = z.object({
  canvas_block_id: z.string().uuid().optional(),
  plan_id: z.string().uuid().optional(),
  include_versions: z.boolean().optional().default(true),
});

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const request = RequestSchema.parse(body);

    if (!request.canvas_block_id && !request.plan_id) {
      return new Response(
        JSON.stringify({ success: false, message: "canvas_block_id ou plan_id é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Buscar plano
    let query = supabase.from("brain_flow_plans").select("*");
    
    if (request.plan_id) {
      query = query.eq("id", request.plan_id);
    } else if (request.canvas_block_id) {
      query = query.eq("canvas_block_id", request.canvas_block_id);
    }

    const { data: plan, error: planError } = await query.single();

    if (planError) {
      if (planError.code === "PGRST116") {
        // Não encontrado
        return new Response(
          JSON.stringify({ success: true, plan: null, versions: [], message: "Nenhum plano encontrado" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      throw planError;
    }

    // Buscar histórico de versões se solicitado
    let versions: { version: number; created_at: string; change_summary?: string }[] = [];
    
    if (request.include_versions && plan) {
      const { data: versionsData } = await supabase
        .from("brain_flow_plan_versions")
        .select("version, created_at, change_summary")
        .eq("plan_id", plan.id)
        .order("version", { ascending: false });

      versions = versionsData || [];
    }

    return new Response(
      JSON.stringify({
        success: true,
        plan,
        versions,
        message: "Plano carregado",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[brain-plan-get] Error:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        message: error instanceof Error ? error.message : String(error) 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});



