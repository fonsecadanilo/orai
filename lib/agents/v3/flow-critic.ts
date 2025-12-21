/**
 * Agent 4: Flow Critic v3.1
 * 
 * Responsabilidades:
 * - Validar completude e consistência do fluxo
 * - Calcular Score de Integridade (0-100)
 * - Identificar problemas por severidade
 * - Aplicar auto-fixes quando possível
 */

import { supabase } from "@/lib/supabase/client";
import type {
  FlowCriticRequest,
  FlowCriticResponse,
  CritiqueFinding,
  SynthesizedFlow,
  NodeArchetypeMapping,
} from "./types";
import type { AgentError } from "../types";

const EDGE_FUNCTION_URL = "v3-flow-critic";

/**
 * Critica e valida um fluxo
 */
export async function criticizeFlow(
  request: FlowCriticRequest
): Promise<FlowCriticResponse> {
  console.log("[Agent 4: Flow Critic] Validando fluxo...");

  // Verificar se o fluxo tem steps
  const steps = request.synthesized_flow?.steps || [];
  const decisions = request.synthesized_flow?.decisions || [];
  
  if (steps.length === 0) {
    console.warn("[Flow Critic] Fluxo sem steps - retornando validação básica");
    return {
      success: true,
      is_valid: false,
      integrity_score: 30,
      findings: [{
        finding_id: "finding_1",
        severity: "critical",
        category: "structure",
        affected_element_id: "flow",
        affected_element_type: "flow",
        title: "Fluxo vazio",
        description: "O fluxo não possui nenhum step definido",
        recommendation: "Adicione pelo menos um step ao fluxo",
        auto_fixable: false,
      }],
      summary: {
        total_findings: 1,
        critical: 1,
        major: 0,
        minor: 0,
        suggestions: 0,
      },
      message: "Fluxo vazio - sem steps para validar",
    };
  }

  // Converter para o formato esperado pela Edge Function
  const richNodes = steps.map(step => ({
    node_id: step.step_id || `step_${Math.random().toString(36).slice(2, 9)}`,
    node_type: step.step_type || "action",
    title: step.title || "Step sem título",
    description: step.description,
    impact_level: step.is_critical ? "high" : "medium",
    connections: [] as { target_node_id: string; connection_type: string; label?: string }[],
    security_metadata: {
      requires_authentication: step.role_required !== undefined,
      sensitive_data: step.is_critical,
    },
  }));

  // Adicionar conexões baseadas nas decisões
  for (const decision of decisions) {
    const sourceNode = richNodes.find(n => n.node_id === decision.after_step_id);
    if (sourceNode && decision.options) {
      sourceNode.connections = decision.options.map(opt => ({
        target_node_id: opt.leads_to_step_id,
        connection_type: opt.is_default ? "default" : "condition",
        label: opt.label,
      }));
    }
  }

  const { data, error } = await supabase.functions.invoke<FlowCriticResponse>(
    EDGE_FUNCTION_URL,
    {
      body: {
        project_id: request.project_id,
        user_id: request.user_id,
        rich_nodes: richNodes,
        archetype_coverage: {
          ux_patterns: 70,
          security: 60,
          compliance: 50,
          accessibility: 40,
        },
        validation_level: request.validation_level || "standard",
      },
    }
  );

  if (error) {
    console.error("[Flow Critic] Erro:", error);
    throw {
      code: "EDGE_FUNCTION_ERROR",
      message: error.message || "Erro ao conectar com o crítico de fluxo",
      details: error,
    } as AgentError;
  }

  if (!data) {
    throw {
      code: "EMPTY_RESPONSE",
      message: "Resposta vazia do crítico de fluxo",
    } as AgentError;
  }

  if (!data.success) {
    throw {
      code: "AGENT_ERROR",
      message: data.message || "Erro ao criticar fluxo",
    } as AgentError;
  }

  console.log("[Flow Critic] Validação completa:", {
    integrity_score: data.integrity_score,
    is_valid: data.is_valid,
    findings_count: data.findings?.length,
  });

  return data;
}

/**
 * Valida fluxo localmente (sem chamada de API)
 * Útil para validação rápida no frontend
 */
export function validateFlowLocally(
  flow: SynthesizedFlow
): {
  is_valid: boolean;
  integrity_score: number;
  findings: CritiqueFinding[];
} {
  const findings: CritiqueFinding[] = [];
  let findingCounter = 0;

  // Regra 1: Deve ter ponto de entrada
  if (!flow.entry_step_id) {
    findings.push({
      finding_id: `finding_${++findingCounter}`,
      severity: "critical",
      category: "completeness",
      affected_element_id: "flow",
      affected_element_type: "flow",
      title: "Ponto de entrada ausente",
      description: "O fluxo não possui um ponto de entrada definido",
      recommendation: "Defina um step como entry_step_id",
      auto_fixable: false,
    });
  }

  // Regra 2: Deve ter pelo menos um ponto de saída
  if (!flow.exit_step_ids || flow.exit_step_ids.length === 0) {
    findings.push({
      finding_id: `finding_${++findingCounter}`,
      severity: "critical",
      category: "completeness",
      affected_element_id: "flow",
      affected_element_type: "flow",
      title: "Ponto de saída ausente",
      description: "O fluxo não possui pontos de saída definidos",
      recommendation: "Defina pelo menos um step como exit_step_id",
      auto_fixable: true,
    });
  }

  // Regra 3: Decisões devem ter pelo menos 2 opções
  for (const decision of flow.decisions) {
    if (decision.options.length < 2) {
      findings.push({
        finding_id: `finding_${++findingCounter}`,
        severity: "major",
        category: "consistency",
        affected_element_id: decision.decision_id,
        affected_element_type: "decision",
        title: "Decisão com opções insuficientes",
        description: `A decisão "${decision.question}" tem menos de 2 opções`,
        recommendation: "Adicione pelo menos 2 opções à decisão",
        auto_fixable: false,
      });
    }
  }

  // Regra 4: Steps críticos devem ter tratamento de falha
  for (const step of flow.steps.filter(s => s.is_critical)) {
    const hasFailurePoint = flow.failure_points.some(f => f.at_step_id === step.step_id);
    if (!hasFailurePoint) {
      findings.push({
        finding_id: `finding_${++findingCounter}`,
        severity: "major",
        category: "ux",
        affected_element_id: step.step_id,
        affected_element_type: "step",
        title: "Step crítico sem tratamento de falha",
        description: `O step crítico "${step.title}" não possui tratamento de falha`,
        recommendation: "Adicione um failure_point para este step",
        auto_fixable: true,
      });
    }
  }

  // Regra 5: Failure points com retry devem ter recovery_step_id
  for (const failure of flow.failure_points.filter(f => f.recovery_strategy === "retry")) {
    if (!failure.recovery_step_id) {
      findings.push({
        finding_id: `finding_${++findingCounter}`,
        severity: "minor",
        category: "completeness",
        affected_element_id: failure.failure_id,
        affected_element_type: "failure_point",
        title: "Retry sem step de recuperação",
        description: `O failure point "${failure.description}" usa retry mas não define recovery_step_id`,
        recommendation: "Defina o step para onde retornar após retry",
        auto_fixable: true,
      });
    }
  }

  // Calcular score
  const criticalCount = findings.filter(f => f.severity === "critical").length;
  const majorCount = findings.filter(f => f.severity === "major").length;
  const minorCount = findings.filter(f => f.severity === "minor").length;
  
  let score = 100;
  score -= criticalCount * 25;
  score -= majorCount * 10;
  score -= minorCount * 3;
  score = Math.max(0, Math.min(100, score));

  return {
    is_valid: criticalCount === 0,
    integrity_score: score,
    findings,
  };
}

/**
 * Aplica auto-fixes em findings que suportam
 */
export function applyAutoFixes(
  flow: SynthesizedFlow,
  findings: CritiqueFinding[]
): {
  fixed_flow: SynthesizedFlow;
  fixes_applied: string[];
} {
  const fixedFlow = { ...flow };
  const fixesApplied: string[] = [];

  for (const finding of findings.filter(f => f.auto_fixable)) {
    switch (finding.title) {
      case "Ponto de saída ausente":
        // Encontrar último step e marcar como saída
        if (fixedFlow.steps.length > 0) {
          const lastStep = fixedFlow.steps[fixedFlow.steps.length - 1];
          fixedFlow.exit_step_ids = [lastStep.step_id];
          fixesApplied.push(`Adicionado ${lastStep.title} como ponto de saída`);
        }
        break;

      case "Step crítico sem tratamento de falha":
        // Adicionar failure point genérico
        fixedFlow.failure_points.push({
          failure_id: `auto_failure_${finding.affected_element_id}`,
          at_step_id: finding.affected_element_id,
          failure_type: "system",
          description: "Erro automático adicionado",
          recovery_strategy: "retry",
          recovery_step_id: finding.affected_element_id,
        });
        fixesApplied.push(`Adicionado tratamento de falha para step ${finding.affected_element_id}`);
        break;

      case "Retry sem step de recuperação":
        // Definir recovery para o próprio step
        const failurePoint = fixedFlow.failure_points.find(f => f.failure_id === finding.affected_element_id);
        if (failurePoint) {
          failurePoint.recovery_step_id = failurePoint.at_step_id;
          fixesApplied.push(`Definido recovery step para ${failurePoint.failure_id}`);
        }
        break;
    }
  }

  return {
    fixed_flow: fixedFlow,
    fixes_applied: fixesApplied,
  };
}

/**
 * Formata o score de integridade para exibição
 */
export function formatIntegrityScore(score: number): {
  value: number;
  label: string;
  color: string;
  icon: string;
} {
  if (score >= 90) {
    return { value: score, label: "Excelente", color: "#22c55e", icon: "CheckCircle2" };
  }
  if (score >= 70) {
    return { value: score, label: "Bom", color: "#84cc16", icon: "ThumbsUp" };
  }
  if (score >= 50) {
    return { value: score, label: "Atenção", color: "#eab308", icon: "AlertTriangle" };
  }
  if (score >= 30) {
    return { value: score, label: "Problemas", color: "#f97316", icon: "AlertCircle" };
  }
  return { value: score, label: "Crítico", color: "#ef4444", icon: "XCircle" };
}
