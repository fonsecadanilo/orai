import { supabase } from "@/lib/supabase/client";
import type { AgentError } from "./types";
import type { MasterRule, PageDefinition } from "@/lib/schemas/masterRuleSchema";
import type { Journey, JourneyStructured, PageContext } from "@/lib/schemas/journeySchema";

const EDGE_FUNCTION_URL = "flow-enricher";

/**
 * Agente: Flow Enricher v1.0
 * 
 * NOVA CAMADA NA PIPELINE v3.0:
 * Recebe MasterRule + Journey e ENRIQUECE com padrões de UX/Produto SaaS
 * antes de passar para o Subrules Decomposer.
 * 
 * Pipeline:
 * 1. Master Rule Creator → MasterRule
 * 2. Journey Creator → Journey
 * 3. Flow Enricher → EnrichedFlow (ESTE AGENTE)
 * 4. Page Mapper → PageContext
 * 5. Subrules Decomposer → RichNodes
 * 6. Flow Generator → Visual Graph
 */

/**
 * Passo extra sugerido pelo Flow Enricher
 */
export interface ExtraStep {
  step_id: string;
  description: string;
  page_key?: string;
  after_step?: string;
  reason: string;
  is_optional?: boolean;
  pattern_type?: 
    | "confirmation"
    | "validation"
    | "recovery"
    | "retry"
    | "cancel"
    | "skip"
    | "loading"
    | "success_feedback"
    | "error_feedback"
    | "redirect"
    | "onboarding_step"
    | "other";
}

/**
 * Decisão extra sugerida pelo Flow Enricher
 */
export interface ExtraDecision {
  decision_id: string;
  description: string;
  page_key?: string;
  options: string[];
  reason: string;
  affects_steps?: string[];
}

/**
 * Ponto de falha extra sugerido pelo Flow Enricher
 */
export interface ExtraFailurePoint {
  failure_id: string;
  description: string;
  page_key?: string;
  recovery_action: string;
  reason: string;
  allows_retry?: boolean;
}

/**
 * Recomendação de UX
 */
export interface UxRecommendation {
  target: string;
  recommendation: string;
  priority: "low" | "medium" | "high";
  pattern_name?: string;
}

/**
 * Resultado do Flow Enricher
 */
export interface EnrichedFlow {
  extra_steps: ExtraStep[];
  extra_decisions: ExtraDecision[];
  extra_failure_points: ExtraFailurePoint[];
  ux_recommendations?: UxRecommendation[];
  notes?: string[];
  patterns_applied?: string[];
}

/**
 * Request para o Flow Enricher
 */
export interface FlowEnricherRequest {
  master_rule_id: number;
  master_rule?: MasterRule;
  journey?: Journey;
  journey_structured?: JourneyStructured;
  pages_involved?: PageDefinition[];
  project_id: number;
  user_id: number;
}

/**
 * Response do Flow Enricher
 */
export interface FlowEnricherResponse {
  success: boolean;
  enriched_flow: EnrichedFlow;
  analysis?: {
    extra_steps_count: number;
    extra_decisions_count: number;
    extra_failure_points_count: number;
    ux_recommendations_count: number;
    patterns_applied: string[];
  };
  validation_warnings?: string[];
  message: string;
}

/**
 * Enriquece o fluxo com padrões SaaS
 */
export async function enrichFlow(
  masterRuleId: number,
  projectId: number,
  userId: number,
  options?: {
    masterRule?: MasterRule;
    journey?: Journey;
    journeyStructured?: JourneyStructured;
    pagesInvolved?: PageDefinition[];
  }
): Promise<FlowEnricherResponse> {
  const requestBody: FlowEnricherRequest = {
    master_rule_id: masterRuleId,
    master_rule: options?.masterRule,
    journey: options?.journey,
    journey_structured: options?.journeyStructured,
    pages_involved: options?.pagesInvolved,
    project_id: projectId,
    user_id: userId,
  };

  const { data, error } = await supabase.functions.invoke<FlowEnricherResponse>(
    EDGE_FUNCTION_URL,
    {
      body: requestBody,
    }
  );

  if (error) {
    console.error("Erro ao chamar flow-enricher:", error);
    throw {
      code: "EDGE_FUNCTION_ERROR",
      message: error.message || "Erro ao conectar com o agente de enriquecimento",
      details: error,
    } as AgentError;
  }

  if (!data) {
    throw {
      code: "EMPTY_RESPONSE",
      message: "Resposta vazia do agente de enriquecimento",
    } as AgentError;
  }

  if (!data.success) {
    throw {
      code: "AGENT_ERROR",
      message: data.message || "Erro ao enriquecer fluxo",
    } as AgentError;
  }

  return data;
}

/**
 * Mescla sugestões do Flow Enricher com a Journey existente
 */
export function mergeEnrichedFlowWithJourney(
  journey: Journey,
  enrichedFlow: EnrichedFlow
): Journey {
  const mergedJourney: Journey = { ...journey };
  
  // Adicionar extra_steps ao final dos steps
  if (enrichedFlow.extra_steps.length > 0) {
    const extraStepDescriptions = enrichedFlow.extra_steps.map(s => s.description);
    mergedJourney.steps = [...mergedJourney.steps, ...extraStepDescriptions];
  }
  
  // Adicionar extra_decisions ao final das decisions
  if (enrichedFlow.extra_decisions.length > 0) {
    const extraDecisionDescriptions = enrichedFlow.extra_decisions.map(d => d.description);
    mergedJourney.decisions = [...mergedJourney.decisions, ...extraDecisionDescriptions];
  }
  
  // Adicionar extra_failure_points ao final dos failure_points
  if (enrichedFlow.extra_failure_points.length > 0) {
    const extraFailureDescriptions = enrichedFlow.extra_failure_points.map(f => f.description);
    mergedJourney.failure_points = [...mergedJourney.failure_points, ...extraFailureDescriptions];
  }
  
  return mergedJourney;
}

/**
 * Aplica padrões SaaS automaticamente baseado no tipo de fluxo
 */
export function applySaaSPatterns(
  flowType: "auth" | "signup" | "checkout" | "onboarding" | "crud" | "other",
  currentSteps: string[]
): ExtraStep[] {
  const suggestions: ExtraStep[] = [];
  
  switch (flowType) {
    case "auth":
      // Sempre sugerir recuperação de senha
      if (!currentSteps.some(s => s.toLowerCase().includes("recuperar") || s.toLowerCase().includes("esqueci"))) {
        suggestions.push({
          step_id: "password_recovery_option",
          description: "Usuário pode acessar recuperação de senha",
          page_key: "login",
          reason: "Padrão SaaS: sempre oferecer recuperação de senha em login",
          is_optional: true,
          pattern_type: "recovery",
        });
      }
      break;
      
    case "signup":
      // Sugerir onboarding após cadastro
      if (!currentSteps.some(s => s.toLowerCase().includes("onboarding"))) {
        suggestions.push({
          step_id: "redirect_to_onboarding",
          description: "Sistema redireciona para onboarding após cadastro",
          page_key: "onboarding",
          reason: "Padrão SaaS: direcionar novos usuários para onboarding",
          is_optional: false,
          pattern_type: "redirect",
        });
      }
      
      // Sugerir confirmação de email
      suggestions.push({
        step_id: "email_confirmation",
        description: "Sistema envia email de confirmação",
        page_key: "signup",
        reason: "Padrão SaaS: confirmar email para segurança",
        is_optional: false,
        pattern_type: "confirmation",
      });
      break;
      
    case "checkout":
      // Sugerir confirmação antes de pagamento
      suggestions.push({
        step_id: "payment_confirmation",
        description: "Usuário confirma dados antes de pagar",
        page_key: "checkout",
        reason: "Padrão SaaS: confirmação antes de ações financeiras",
        is_optional: false,
        pattern_type: "confirmation",
      });
      
      // Sugerir retry em falha de pagamento
      suggestions.push({
        step_id: "payment_retry",
        description: "Opção de tentar novamente em caso de falha",
        page_key: "checkout",
        reason: "Padrão SaaS: permitir retry em pagamentos",
        is_optional: true,
        pattern_type: "retry",
      });
      break;
      
    case "onboarding":
      // Sugerir opção de pular
      if (!currentSteps.some(s => s.toLowerCase().includes("pular"))) {
        suggestions.push({
          step_id: "skip_onboarding",
          description: "Opção de pular onboarding e configurar depois",
          page_key: "onboarding",
          reason: "Padrão SaaS: permitir que usuários experientes pulem onboarding",
          is_optional: true,
          pattern_type: "skip",
        });
      }
      break;
  }
  
  return suggestions;
}















