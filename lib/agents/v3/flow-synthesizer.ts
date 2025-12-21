/**
 * Agent 2: Flow Synthesizer v3.1
 * 
 * Responsabilidades:
 * - Receber contexto do Product & Role Mapper
 * - Sintetizar fluxo semântico com steps, decisions, failures
 * - Detectar padrões reutilizáveis
 * - Calcular complexidade do fluxo
 */

import { supabase } from "@/lib/supabase/client";
import type {
  FlowSynthesizerRequest,
  FlowSynthesizerResponse,
  ProductContext,
  RoleDefinition,
  SynthesizedFlow,
} from "./types";
import type { AgentError } from "../types";

const EDGE_FUNCTION_URL = "v3-flow-synthesizer";

/**
 * Sintetiza um fluxo completo a partir do contexto de produto e roles
 */
export async function synthesizeFlow(
  request: FlowSynthesizerRequest
): Promise<FlowSynthesizerResponse> {
  console.log("[Agent 2: Flow Synthesizer] Sintetizando fluxo...");

  const { data, error } = await supabase.functions.invoke<FlowSynthesizerResponse>(
    EDGE_FUNCTION_URL,
    {
      body: {
        project_id: request.project_id,
        user_id: request.user_id,
        product_context: {
          product_name: request.product_context.product_name,
          product_type: request.product_context.product_type,
          product_description: request.product_context.main_value_proposition,
          industry: request.product_context.target_audience,
          business_model: request.product_context.business_model,
        },
        user_role: {
          role_id: request.primary_role,
          role_name: request.primary_role,
          display_name: request.primary_role,
          permissions: request.roles.find(r => r.role_id === request.primary_role)?.permissions || [],
        },
        flow_context: {
          main_goal: request.user_prompt,
          user_intent: request.user_prompt,
          expected_outcome: "Fluxo completo e funcional",
          key_actions: [],
        },
      },
    }
  );

  if (error) {
    console.error("[Flow Synthesizer] Erro:", error);
    throw {
      code: "EDGE_FUNCTION_ERROR",
      message: error.message || "Erro ao conectar com o sintetizador de fluxo",
      details: error,
    } as AgentError;
  }

  if (!data) {
    throw {
      code: "EMPTY_RESPONSE",
      message: "Resposta vazia do sintetizador de fluxo",
    } as AgentError;
  }

  if (!data.success) {
    throw {
      code: "AGENT_ERROR",
      message: data.message || "Erro ao sintetizar fluxo",
    } as AgentError;
  }

  console.log("[Flow Synthesizer] Fluxo sintetizado:", {
    flow_name: data.synthesized_flow?.flow_name,
    steps_count: data.synthesized_flow?.steps?.length,
    complexity: data.analysis?.complexity_score,
  });
  
  // DEBUG: Log actual step structure
  if (data.synthesized_flow?.steps?.length > 0) {
    const firstStep = data.synthesized_flow.steps[0];
    console.log("[Flow Synthesizer] First step keys:", Object.keys(firstStep || {}));
    console.log("[Flow Synthesizer] First step data:", JSON.stringify(firstStep, null, 2).slice(0, 800));
  }

  return data;
}

/**
 * Busca fluxos existentes no projeto para análise de reuso
 */
export async function getExistingFlows(
  projectId: number
): Promise<{ flow_id: string; flow_name: string }[]> {
  const { data, error } = await supabase
    .from("flows")
    .select("id, title")
    .eq("project_id", projectId)
    .eq("status", "active")
    .limit(50);

  if (error || !data) {
    return [];
  }

  return data.map((flow) => ({
    flow_id: String(flow.id),
    flow_name: flow.title,
  }));
}

/**
 * Analisa complexidade de um fluxo sintetizado
 */
export function analyzeFlowComplexity(flow: SynthesizedFlow): {
  complexity_score: number;
  breakdown: {
    steps_score: number;
    decisions_score: number;
    failures_score: number;
    depth_score: number;
  };
} {
  const stepsScore = Math.min(flow.steps.length / 10, 1) * 30;
  const decisionsScore = Math.min(flow.decisions.length / 5, 1) * 25;
  const failuresScore = Math.min(flow.failure_points.length / 5, 1) * 20;
  
  // Calcular profundidade (simplificado)
  const depthScore = flow.steps.some(s => !s.can_be_skipped) ? 25 : 15;

  const totalScore = stepsScore + decisionsScore + failuresScore + depthScore;

  return {
    complexity_score: Math.min(Math.round(totalScore), 100),
    breakdown: {
      steps_score: Math.round(stepsScore),
      decisions_score: Math.round(decisionsScore),
      failures_score: Math.round(failuresScore),
      depth_score: Math.round(depthScore),
    },
  };
}

/**
 * Detecta padrões conhecidos em um fluxo
 */
export function detectPatterns(flow: SynthesizedFlow): string[] {
  const patterns: string[] = [];

  // Verificar padrões comuns
  const stepTypes = flow.steps.map(s => s.step_type);
  
  if (stepTypes.includes("form") && flow.category === "authentication") {
    patterns.push("authentication_form");
  }
  
  if (flow.steps.some(s => s.title.toLowerCase().includes("password"))) {
    patterns.push("password_handling");
  }
  
  if (flow.steps.some(s => s.title.toLowerCase().includes("email"))) {
    patterns.push("email_verification");
  }
  
  if (flow.failure_points.some(f => f.recovery_strategy === "retry")) {
    patterns.push("retry_pattern");
  }
  
  if (flow.decisions.length > 0) {
    patterns.push("branching_flow");
  }
  
  if (flow.steps.length > 5) {
    patterns.push("multi_step_wizard");
  }

  return patterns;
}
