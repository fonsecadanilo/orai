import { supabase } from "@/lib/supabase/client";
import type {
  FlowCreatorResponse,
  FlowCreatorRequest,
  FlowConversation,
  AgentError,
} from "./types";

const EDGE_FUNCTION_URL = "flow-creator-agent";

/**
 * Cria um fluxo visual baseado em subregras estruturadas
 * As subregras devem ser criadas primeiro pelo agente de regras
 */
export async function createFlowFromRules(
  projectId: number,
  userId: number,
  flowMasterRuleId: number,
  options?: {
    prompt?: string;
    subRuleIds?: number[];
    conversationId?: string;
  }
): Promise<FlowCreatorResponse> {
  const requestBody: FlowCreatorRequest = {
    prompt: options?.prompt || "",
    project_id: projectId,
    user_id: userId,
    flow_master_rule_id: flowMasterRuleId,
    sub_rule_ids: options?.subRuleIds,
    conversation_id: options?.conversationId,
  };

  const { data, error } = await supabase.functions.invoke<FlowCreatorResponse>(
    EDGE_FUNCTION_URL,
    {
      body: requestBody,
    }
  );

  if (error) {
    console.error("Erro ao chamar Edge Function:", error);
    throw {
      code: "EDGE_FUNCTION_ERROR",
      message: error.message || "Erro ao conectar com o agente de fluxo",
      details: error,
    } as AgentError;
  }

  if (!data) {
    throw {
      code: "EMPTY_RESPONSE",
      message: "Resposta vazia do agente de fluxo",
    } as AgentError;
  }

  if (!data.success) {
    throw {
      code: "AGENT_ERROR",
      message: data.message || "Erro ao gerar o fluxo",
    } as AgentError;
  }

  return data;
}

/**
 * Cria um fluxo diretamente (sem regras pré-existentes)
 * Este método é para compatibilidade - prefira usar createFlowFromRules
 * @deprecated Use createFlowFromRules após criar as regras
 */
export async function createFlow(
  prompt: string,
  projectId: number,
  userId: number,
  conversationId?: string,
  ruleIds?: number[]
): Promise<FlowCreatorResponse> {
  const requestBody: FlowCreatorRequest = {
    prompt,
    project_id: projectId,
    user_id: userId,
    conversation_id: conversationId,
    sub_rule_ids: ruleIds,
  };

  const { data, error } = await supabase.functions.invoke<FlowCreatorResponse>(
    EDGE_FUNCTION_URL,
    {
      body: requestBody,
    }
  );

  if (error) {
    console.error("Erro ao chamar Edge Function:", error);
    throw {
      code: "EDGE_FUNCTION_ERROR",
      message: error.message || "Erro ao conectar com o agente de IA",
      details: error,
    } as AgentError;
  }

  if (!data) {
    throw {
      code: "EMPTY_RESPONSE",
      message: "Resposta vazia do agente",
    } as AgentError;
  }

  if (!data.success) {
    throw {
      code: "AGENT_ERROR",
      message: data.message || "Erro ao gerar o fluxo",
    } as AgentError;
  }

  return data;
}

/**
 * Continua uma conversa existente para refinar o fluxo
 */
export async function continueFlowConversation(
  conversationId: string,
  prompt: string,
  projectId: number,
  userId: number,
  ruleIds?: number[]
): Promise<FlowCreatorResponse> {
  return createFlow(prompt, projectId, userId, conversationId, ruleIds);
}

/**
 * Obtém o histórico de conversas do projeto
 */
export async function getFlowConversations(
  projectId: number
): Promise<FlowConversation[]> {
  const { data, error } = await supabase
    .from("agent_conversations")
    .select("*")
    .eq("project_id", projectId)
    .in("agent_type", ["flow_creator", "flow_creator_v2"])
    .order("updated_at", { ascending: false });

  if (error) {
    console.error("Erro ao buscar conversas:", error);
    return [];
  }

  return data || [];
}

/**
 * Arquiva uma conversa
 */
export async function archiveConversation(
  conversationId: string
): Promise<boolean> {
  const { error } = await supabase
    .from("agent_conversations")
    .update({ archived: true, updated_at: new Date().toISOString() })
    .eq("id", conversationId);

  if (error) {
    console.error("Erro ao arquivar conversa:", error);
    return false;
  }

  return true;
}
