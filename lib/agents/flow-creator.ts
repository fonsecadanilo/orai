import { supabase } from "@/lib/supabase/client";
import type {
  FlowCreatorResponse,
  FlowCreatorRequest,
  FlowConversation,
  AgentError,
} from "./types";

const EDGE_FUNCTION_URL = "flow-creator-agent";

/**
 * Cria um novo fluxo baseado no prompt do usuário
 * Chama a Edge Function flow-creator-agent no Supabase
 */
export async function createFlow(
  prompt: string,
  projectId: number,
  userId: number,
  conversationId?: string
): Promise<FlowCreatorResponse> {
  const requestBody: FlowCreatorRequest = {
    prompt,
    project_id: projectId,
    user_id: userId,
    conversation_id: conversationId,
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
  userId: number
): Promise<FlowCreatorResponse> {
  return createFlow(prompt, projectId, userId, conversationId);
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
    .eq("agent_type", "flow_creator")
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
