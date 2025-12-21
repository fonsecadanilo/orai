import { supabase } from "@/lib/supabase/client";
import type {
  MasterRuleCreatorRequest,
  MasterRuleCreatorResponse,
  AgentError,
} from "./types";

const EDGE_FUNCTION_URL = "master-rule-creator";

/**
 * Agente 1: Master Rule Creator v3.1
 * 
 * NOVA ARQUITETURA v2.0:
 * - Usa modelo forte (GPT-4 Turbo ou Claude Sonnet)
 * - Gera APENAS semântica de negócio
 * - NÃO gera blueprint de nós, índices ou estrutura
 * - NÃO descreve UI ou UX (isso fica com a Journey)
 * - Validação rígida via Zod no servidor
 * - A saída será COMBINADA com uma Journey para criar Subrules
 * 
 * O LLM cuida apenas de:
 * - business_goal: Objetivo do fluxo (mensurável)
 * - context: Cenário em uma frase (sem UI)
 * - actors: Quem participa
 * - assumptions: O que assumimos como verdade
 * - main_flow: Passos de NEGÓCIO (não telas)
 * - alternative_flows: Variantes de negócio
 * - error_flows: Erros e exceções de negócio
 */
export async function createMasterRule(
  prompt: string,
  projectId: number,
  userId: number,
  options?: {
    businessModelContext?: string;
    existingRulesContext?: string[];
    conversationId?: string;
  }
): Promise<MasterRuleCreatorResponse> {
  const requestBody: MasterRuleCreatorRequest = {
    prompt,
    project_id: projectId,
    user_id: userId,
    business_model_context: options?.businessModelContext,
    existing_rules_context: options?.existingRulesContext,
    conversation_id: options?.conversationId,
  };

  const { data, error } = await supabase.functions.invoke<MasterRuleCreatorResponse>(
    EDGE_FUNCTION_URL,
    {
      body: requestBody,
    }
  );

  if (error) {
    console.error("Erro ao chamar master-rule-creator:", error);
    throw {
      code: "EDGE_FUNCTION_ERROR",
      message: error.message || "Erro ao conectar com o agente de regras master",
      details: error,
    } as AgentError;
  }

  if (!data) {
    throw {
      code: "EMPTY_RESPONSE",
      message: "Resposta vazia do agente de regras master",
    } as AgentError;
  }

  if (!data.success) {
    // Verificar se há erros de validação
    const validationErrors = (data as any).validation_errors || [];
    if (validationErrors.length > 0) {
      throw {
        code: "VALIDATION_ERROR",
        message: "Validação da regra master falhou",
        details: { errors: validationErrors },
      } as AgentError;
    }
    
    throw {
      code: "AGENT_ERROR",
      message: data.message || "Erro ao gerar regra master",
    } as AgentError;
  }

  return data;
}

/**
 * Busca uma regra master pelo ID com conteúdo completo
 */
export async function getMasterRuleById(
  masterRuleId: number
): Promise<MasterRuleCreatorResponse["master_rule"] | null> {
  const { data, error } = await supabase
    .from("rules")
    .select("*")
    .eq("id", masterRuleId)
    .eq("rule_type", "flow_master")
    .single();

  if (error || !data) {
    console.error("Erro ao buscar regra master:", error);
    return null;
  }

  // Extrair dados semânticos dos metadados (nova arquitetura)
  const semanticData = data.metadata?.semantic_data;

  return {
    title: data.title,
    description: data.description,
    content: semanticData || {
      objective: "",
      business_context: "",
      personas: [],
      prerequisites: [],
      happy_path: data.content || "",
      alternative_flows: [],
      error_cases: [],
      acceptance_criteria: data.acceptance_criteria || [],
      edge_cases: data.edge_cases || [],
      success_metrics: [],
      integrations: [],
      security_considerations: [],
    },
    inferred_context: {
      business_type: "",
      industry: "",
      target_market: "",
      assumptions: semanticData?.assumptions || [],
    },
    // NÃO incluir flow_blueprint - isso é responsabilidade da engine
    flow_blueprint: {
      estimated_nodes: 0,
      has_branches: false,
      complexity: "medium" as const,
      main_path_length: 0,
      branch_count: 0,
    },
    category: data.category,
    priority: data.priority,
    tags: data.tags || [],
    estimated_complexity: "medium" as const,
  };
}

/**
 * Extrai dados semânticos de uma regra master
 * Útil para passar para o Subrules Decomposer
 */
export async function extractSemanticData(
  masterRuleId: number
): Promise<{
  business_goal: string;
  context: string;
  actors: string[];
  assumptions: string[];
  main_flow: string[];
  alternative_flows: string[];
  error_flows: string[];
} | null> {
  const { data, error } = await supabase
    .from("rules")
    .select("metadata")
    .eq("id", masterRuleId)
    .eq("rule_type", "flow_master")
    .single();

  if (error || !data) {
    console.error("Erro ao buscar dados semânticos:", error);
    return null;
  }

  return data.metadata?.semantic_data || null;
}
