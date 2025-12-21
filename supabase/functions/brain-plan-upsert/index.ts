import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * BRAIN PLAN UPSERT
 * 
 * Cria ou atualiza um plano de flow.
 * Incrementa versão automaticamente quando atualiza.
 */

const RequestSchema = z.object({
  project_id: z.number(),
  thread_id: z.string().uuid(),
  canvas_block_id: z.string().uuid(),
  plan_md: z.string(),
  plan_json: z.object({
    flow_goal: z.string(),
    actors: z.array(z.string()),
    steps: z.array(z.object({
      order: z.number(),
      group: z.string(),
      title: z.string(),
      description: z.string(),
      node_type: z.string().optional(),
    })),
    decision_points: z.array(z.object({
      step_ref: z.number(),
      condition: z.string(),
      branches: z.array(z.string()),
    })),
    failure_points: z.array(z.object({
      step_ref: z.number(),
      failure_type: z.string(),
      handling: z.string(),
    })),
    inputs: z.array(z.object({
      step_ref: z.number(),
      field_name: z.string(),
      field_type: z.string(),
      required: z.boolean(),
      validation: z.string().optional(),
    })),
    rules_refs: z.array(z.string()),
    assumptions: z.array(z.object({
      assumption: z.string(),
      confidence: z.enum(["low", "medium", "high"]),
    })),
    acceptance_checklist: z.array(z.string()),
    spec: z.unknown().optional(),
  }),
  flow_key: z.string().optional(),
  change_summary: z.string().optional(),
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

    console.log("[brain-plan-upsert] Upserting plan for block:", request.canvas_block_id);

    const now = new Date().toISOString();

    // Verificar se já existe plano para este canvas_block
    const { data: existingPlan } = await supabase
      .from("brain_flow_plans")
      .select("*")
      .eq("canvas_block_id", request.canvas_block_id)
      .single();

    let plan;
    let isNew = false;

    if (existingPlan) {
      // Não permitir atualizar planos approved/building/built
      if (["approved", "building", "built"].includes(existingPlan.status)) {
        return new Response(
          JSON.stringify({
            success: false,
            message: `Não é possível modificar um plano com status '${existingPlan.status}'`,
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Salvar versão anterior no histórico
      await supabase.from("brain_flow_plan_versions").insert({
        id: crypto.randomUUID(),
        plan_id: existingPlan.id,
        version: existingPlan.plan_version,
        plan_md: existingPlan.plan_md,
        plan_json: existingPlan.plan_json,
        created_at: existingPlan.updated_at,
        change_summary: request.change_summary || "Revisão automática",
      });

      // Atualizar plano existente
      const newVersion = existingPlan.plan_version + 1;
      const { data: updatedPlan, error: updateError } = await supabase
        .from("brain_flow_plans")
        .update({
          plan_md: request.plan_md,
          plan_json: request.plan_json,
          plan_version: newVersion,
          status: "revised",
          flow_key: request.flow_key || existingPlan.flow_key,
          updated_at: now,
        })
        .eq("id", existingPlan.id)
        .select()
        .single();

      if (updateError) throw updateError;
      plan = updatedPlan;

      console.log("[brain-plan-upsert] Updated plan to version:", newVersion);
    } else {
      // Criar novo plano
      const planId = crypto.randomUUID();
      const { data: newPlan, error: createError } = await supabase
        .from("brain_flow_plans")
        .insert({
          id: planId,
          project_id: request.project_id,
          thread_id: request.thread_id,
          canvas_block_id: request.canvas_block_id,
          flow_key: request.flow_key,
          status: "draft",
          plan_version: 1,
          plan_md: request.plan_md,
          plan_json: request.plan_json,
          created_at: now,
          updated_at: now,
        })
        .select()
        .single();

      if (createError) throw createError;
      plan = newPlan;
      isNew = true;

      // Atualizar canvas_block com plan_id
      await supabase
        .from("brain_canvas_blocks")
        .update({ plan_id: planId, updated_at: now })
        .eq("id", request.canvas_block_id);

      console.log("[brain-plan-upsert] Created new plan:", planId);
    }

    return new Response(
      JSON.stringify({
        success: true,
        plan,
        is_new: isNew,
        message: isNew 
          ? "Plano criado com sucesso" 
          : `Plano atualizado para versão ${plan.plan_version}`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[brain-plan-upsert] Error:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        message: error instanceof Error ? error.message : String(error) 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

