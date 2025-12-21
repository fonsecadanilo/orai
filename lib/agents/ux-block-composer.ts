import { supabase } from "@/lib/supabase/client";
import type { AgentError } from "./types";

const EDGE_FUNCTION_URL = "v3-ux-block-composer";

/**
 * Agente 5: UX Block Composer v3.0
 * 
 * Este agente consulta a biblioteca de blocos UX e copia/adapta blocos relevantes
 * para o contexto do usuário.
 * 
 * FLUXO:
 * 1. Recebe contexto (master rule, journey, use cases, etc.)
 * 2. Busca blocos relevantes na biblioteca ux_blocks
 * 3. Usa IA para selecionar e adaptar blocos
 * 4. Retorna blocos adaptados prontos para uso
 */

export interface UXBlockComposerRequest {
  project_id: number;
  user_id: number;
  context: {
    master_rule_id?: number;
    master_rule_content?: any;
    journey?: any;
    use_cases?: string[];
    business_type?: string;
    target_features?: string[];
  };
  search_query?: string;
  max_blocks?: number;
  conversation_id?: string;
}

export interface AdaptedUXBlock {
  block_id: string;
  block_label: string;
  relevance_score?: number;
  adapted_semantic_flow: any;
  adaptation_notes?: string;
}

export interface UXBlockComposerResponse {
  success: boolean;
  message: string;
  selected_blocks: AdaptedUXBlock[];
  total_blocks_found: number;
}

/**
 * Consulta a biblioteca de blocos UX e retorna blocos adaptados
 */
export async function composeUXBlocks(
  projectId: number,
  userId: number,
  options: {
    context?: UXBlockComposerRequest["context"];
    searchQuery?: string;
    maxBlocks?: number;
    conversationId?: string;
  }
): Promise<UXBlockComposerResponse> {
  const requestBody: UXBlockComposerRequest = {
    project_id: projectId,
    user_id: userId,
    context: options.context || {},
    search_query: options.searchQuery,
    max_blocks: options.maxBlocks || 10,
    conversation_id: options.conversationId,
  };

  const { data, error } = await supabase.functions.invoke<UXBlockComposerResponse>(
    EDGE_FUNCTION_URL,
    {
      body: requestBody,
    }
  );

  if (error) {
    console.error("Erro ao chamar ux-block-composer:", error);
    throw {
      code: "EDGE_FUNCTION_ERROR",
      message: error.message || "Erro ao conectar com o agente de blocos UX",
      details: error,
    } as AgentError;
  }

  if (!data) {
    throw {
      code: "EMPTY_RESPONSE",
      message: "Resposta vazia do agente de blocos UX",
    } as AgentError;
  }

  if (!data.success) {
    throw {
      code: "AGENT_ERROR",
      message: data.message || "Erro ao compor blocos UX",
    } as AgentError;
  }

  return data;
}

/**
 * Busca blocos UX diretamente na biblioteca (sem IA)
 */
export async function searchUXBlocks(options: {
  useCases?: string[];
  archetype?: string;
  searchQuery?: string;
  limit?: number;
}): Promise<any[]> {
  let query = supabase
    .from("ux_blocks")
    .select("*");

  if (options.useCases && options.useCases.length > 0) {
    query = query.overlaps("use_cases", options.useCases);
  }

  if (options.archetype) {
    query = query.eq("archetype", options.archetype);
  }

  if (options.searchQuery) {
    query = query.or(
      `label.ilike.%${options.searchQuery}%,description.ilike.%${options.searchQuery}%`
    );
  }

  const { data, error } = await query.limit(options.limit || 50);

  if (error) {
    console.error("Erro ao buscar blocos UX:", error);
    throw {
      code: "DATABASE_ERROR",
      message: error.message || "Erro ao buscar blocos na biblioteca",
      details: error,
    } as AgentError;
  }

  return data || [];
}

/**
 * Busca um bloco específico por ID
 */
export async function getUXBlockById(blockId: string): Promise<any | null> {
  const { data, error } = await supabase
    .from("ux_blocks")
    .select("*")
    .eq("id", blockId)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return null; // Não encontrado
    }
    console.error("Erro ao buscar bloco UX:", error);
    throw {
      code: "DATABASE_ERROR",
      message: error.message || "Erro ao buscar bloco na biblioteca",
      details: error,
    } as AgentError;
  }

  return data;
}







