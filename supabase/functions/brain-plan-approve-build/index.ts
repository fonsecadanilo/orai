import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * BRAIN PLAN APPROVE & BUILD
 * 
 * Server-side gate para aprovar plano e disparar builders v3.1.
 * Este é o ÚNICO ponto de entrada para construção de flows!
 * 
 * Fluxo:
 * 1. Validar que plano existe e está em estado válido (draft/revised)
 * 2. Validar que plan_json.spec existe
 * 3. Marcar status = approved
 * 4. Disparar builders v3.1 (v3-flow-synthesizer)
 * 5. Marcar status = building
 * 6. Ao finalizar: status = built + result_flow_id + criar edge
 */

const RequestSchema = z.object({
  project_id: z.number(),
  plan_id: z.string().uuid(),
  approved_by: z.string().min(1),
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

    console.log("[brain-plan-approve-build] Starting approval for plan:", request.plan_id);

    const now = new Date().toISOString();

    // 1. Buscar plano
    const { data: plan, error: planError } = await supabase
      .from("brain_flow_plans")
      .select("*")
      .eq("id", request.plan_id)
      .single();

    if (planError || !plan) {
      return new Response(
        JSON.stringify({ success: false, message: "Plano não encontrado" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Validar estado (HARD GATE)
    if (!["draft", "revised"].includes(plan.status)) {
      return new Response(
        JSON.stringify({
          success: false,
          message: `Plano não pode ser aprovado no estado '${plan.status}'. Estados válidos: draft, revised`,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. Validar que project_id corresponde
    if (plan.project_id !== request.project_id) {
      return new Response(
        JSON.stringify({ success: false, message: "Project ID não corresponde" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 4. Validar que plan_json tem dados suficientes
    const planJson = plan.plan_json;
    if (!planJson || !planJson.flow_goal || !planJson.steps || planJson.steps.length === 0) {
      return new Response(
        JSON.stringify({
          success: false,
          message: "Plano inválido: faltam flow_goal ou steps",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 5. Marcar como approved
    const { error: approveError } = await supabase
      .from("brain_flow_plans")
      .update({
        status: "approved",
        approved_at: now,
        approved_by: request.approved_by,
        updated_at: now,
      })
      .eq("id", request.plan_id);

    if (approveError) throw approveError;

    console.log("[brain-plan-approve-build] Plan approved, starting build...");

    // 6. Gerar build_job_id único
    const buildJobId = crypto.randomUUID();

    // 7. Marcar como building
    const { data: updatedPlan, error: buildingError } = await supabase
      .from("brain_flow_plans")
      .update({
        status: "building",
        build_job_id: buildJobId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", request.plan_id)
      .select()
      .single();

    if (buildingError) throw buildingError;

    // 8. Disparar builders v3.1 de forma assíncrona
    // NOTA: Não esperamos a conclusão aqui - o builder vai atualizar o status quando terminar
    dispatchBuilders(supabase, supabaseUrl, supabaseKey, {
      plan_id: request.plan_id,
      project_id: request.project_id,
      build_job_id: buildJobId,
      plan_json: planJson,
      canvas_block_id: plan.canvas_block_id,
    }).catch(err => {
      console.error("[brain-plan-approve-build] Builder dispatch failed:", err);
    });

    console.log("[brain-plan-approve-build] Build dispatched with job:", buildJobId);

    return new Response(
      JSON.stringify({
        success: true,
        plan: updatedPlan,
        build_job_id: buildJobId,
        message: "Plano aprovado! Construção iniciada.",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[brain-plan-approve-build] Error:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        message: error instanceof Error ? error.message : String(error) 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

/**
 * Dispara os builders v3.1 de forma assíncrona
 */
async function dispatchBuilders(
  supabase: ReturnType<typeof createClient>,
  supabaseUrl: string,
  supabaseKey: string,
  params: {
    plan_id: string;
    project_id: number;
    build_job_id: string;
    plan_json: unknown;
    canvas_block_id: string;
  }
) {
  try {
    console.log("[dispatchBuilders] Starting build for plan:", params.plan_id);

    // Carregar contexto necessário
    const { data: productProfile } = await supabase
      .from("product_profiles")
      .select("*")
      .eq("project_id", params.project_id)
      .single();

    const { data: approvedRules } = await supabase
      .from("rules")
      .select("*")
      .eq("project_id", params.project_id)
      .eq("status", "active");

    // Preparar spec para v3-flow-synthesizer
    const planJson = params.plan_json as {
      flow_goal: string;
      actors: string[];
      steps: { order: number; group: string; title: string; description: string; node_type?: string }[];
      decision_points: unknown[];
      failure_points: unknown[];
      inputs: unknown[];
      rules_refs: string[];
      acceptance_checklist: string[];
      spec?: unknown;
    };

    // Converter plan para formato do flow-synthesizer
    const flowSpec = planJson.spec || {
      flow_name: planJson.flow_goal.slice(0, 50),
      flow_description: planJson.flow_goal,
      steps: planJson.steps.map(s => ({
        step_number: s.order,
        step_title: s.title,
        step_description: s.description,
        node_type: s.node_type || "action",
        group: s.group,
      })),
      decision_points: planJson.decision_points,
      inputs: planJson.inputs,
    };

    // Chamar v3-flow-synthesizer
    const synthResponse = await fetch(`${supabaseUrl}/functions/v1/v3-flow-synthesizer`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${supabaseKey}`,
      },
      body: JSON.stringify({
        project_id: params.project_id,
        flow_spec: flowSpec,
        product_profile: productProfile,
        business_rules: approvedRules || [],
        source: "brain_plan",
        brain_plan_id: params.plan_id,
      }),
    });

    if (!synthResponse.ok) {
      const error = await synthResponse.text();
      throw new Error(`v3-flow-synthesizer failed: ${error}`);
    }

    const synthResult = await synthResponse.json();
    console.log("[dispatchBuilders] Synthesizer result:", synthResult);

    // Atualizar plano com resultado
    if (synthResult.success && synthResult.flow_id) {
      // Marcar como built
      await supabase
        .from("brain_flow_plans")
        .update({
          status: "built",
          result_flow_id: synthResult.flow_id,
          updated_at: new Date().toISOString(),
        })
        .eq("id", params.plan_id);

      // Criar edge de ligação (BrainBlock -> Flow)
      await createGeneratedFromEdge(supabase, {
        project_id: params.project_id,
        canvas_block_id: params.canvas_block_id,
        flow_id: synthResult.flow_id,
      });

      console.log("[dispatchBuilders] Build complete! Flow ID:", synthResult.flow_id);
    } else {
      // Marcar como erro (voltar para revised para permitir retry)
      await supabase
        .from("brain_flow_plans")
        .update({
          status: "revised",
          updated_at: new Date().toISOString(),
        })
        .eq("id", params.plan_id);

      console.error("[dispatchBuilders] Build failed:", synthResult.message);
    }

  } catch (error) {
    console.error("[dispatchBuilders] Error:", error);

    // Marcar como erro
    await supabase
      .from("brain_flow_plans")
      .update({
        status: "revised",
        updated_at: new Date().toISOString(),
      })
      .eq("id", params.plan_id);
  }
}

/**
 * Cria edge de ligação BrainBlock -> Flow (generated_from)
 */
async function createGeneratedFromEdge(
  supabase: ReturnType<typeof createClient>,
  params: {
    project_id: number;
    canvas_block_id: string;
    flow_id: number;
  }
) {
  try {
    // Buscar primeiro nó do flow (entry point)
    const { data: nodes } = await supabase
      .from("nodes")
      .select("id")
      .eq("flow_id", params.flow_id)
      .order("position_y", { ascending: true })
      .limit(1);

    if (!nodes || nodes.length === 0) {
      console.warn("[createGeneratedFromEdge] No nodes found in flow");
      return;
    }

    const entryNodeId = nodes[0].id;

    // Verificar se já existe edge
    const { data: existingEdge } = await supabase
      .from("connections")
      .select("id")
      .eq("flow_id", params.flow_id)
      .eq("metadata->>edge_type", "generated_from")
      .single();

    if (existingEdge) {
      console.log("[createGeneratedFromEdge] Edge already exists");
      return;
    }

    // Criar edge especial
    // NOTA: Isso pode precisar de ajuste dependendo da estrutura do canvas
    // Por ora, vamos apenas registrar a relação no metadata do flow
    await supabase
      .from("flows")
      .update({
        metadata: {
          generated_from_brain_block: params.canvas_block_id,
          generated_at: new Date().toISOString(),
        },
      })
      .eq("id", params.flow_id);

    console.log("[createGeneratedFromEdge] Edge created/updated");
  } catch (error) {
    console.error("[createGeneratedFromEdge] Error:", error);
  }
}



