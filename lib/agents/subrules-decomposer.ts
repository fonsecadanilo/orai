import { supabase } from "@/lib/supabase/client";
import type {
  SubrulesDecomposerRequest,
  SubrulesDecomposerResponse,
  DetailedMasterRule,
  JourneyV2,
  AgentError,
} from "./types";
import type { PageContext, JourneyStructured } from "@/lib/schemas/journeySchema";
import type { EnrichedFlow } from "./flow-enricher";

const EDGE_FUNCTION_URL = "subrules-decomposer";

/**
 * Agente: Subrules Decomposer v3.0
 * 
 * NOVA ARQUITETURA v3.0:
 * Agora recebe ATÉ 4 documentos:
 * 1. Master Rule (Regras de Negócio) - com pages_involved
 * 2. Journey (Jornada do Usuário) - com page_key
 * 3. Enriched Flow (Enriquecimentos SaaS) - NOVO
 * 4. Page Context (Mapeamento de Páginas) - NOVO
 * 
 * E MESCLA todos para criar NÓS RICOS (RichNodes).
 * 
 * Novos campos nos nós:
 * - page_key: página onde o nó acontece
 * - user_intent: o que o usuário quer
 * - system_behavior: o que o sistema faz
 * - ux_recommendation: dica de UX
 * - inputs: campos de formulário
 * - error_cases: erros esperados
 * - allows_retry / allows_cancel
 * 
 * O MOTOR (código) é responsável por:
 * - order_index (via BFS)
 * - layout (x, y) baseado em flow_category
 * - edges reais
 */
export async function decomposeIntoSubrules(
  masterRuleId: number,
  masterRuleContent: DetailedMasterRule | null,
  projectId: number,
  userId: number,
  options?: {
    journey?: JourneyV2;
    journeyStructured?: JourneyStructured; // NOVO v3.0
    enrichedFlow?: EnrichedFlow; // NOVO v3.0
    pageContext?: PageContext; // NOVO v3.0
    decompositionDepth?: "shallow" | "normal" | "deep";
    includeErrorPaths?: boolean;
    includeValidationNodes?: boolean;
    conversationId?: string;
  }
): Promise<SubrulesDecomposerResponse> {
  const requestBody: SubrulesDecomposerRequest & { 
    journey?: JourneyV2;
    journey_structured?: JourneyStructured;
    enriched_flow?: EnrichedFlow;
    page_context?: PageContext;
  } = {
    master_rule_id: masterRuleId,
    // Só incluir master_rule_content se não for null (edge function busca do banco se não fornecido)
    ...(masterRuleContent && { master_rule_content: masterRuleContent }),
    journey: options?.journey,
    journey_structured: options?.journeyStructured, // NOVO v3.0
    enriched_flow: options?.enrichedFlow, // NOVO v3.0
    page_context: options?.pageContext, // NOVO v3.0
    project_id: projectId,
    user_id: userId,
    decomposition_depth: options?.decompositionDepth || "normal",
    include_error_paths: options?.includeErrorPaths !== false,
    include_validation_nodes: options?.includeValidationNodes !== false,
    conversation_id: options?.conversationId,
  };

  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/8b2f26b3-5b12-48cf-bd31-b28e89327ed7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'subrules-decomposer.ts:75',message:'Request body antes de enviar',data:{master_rule_id:masterRuleId,has_master_rule_content:!!masterRuleContent,master_rule_content_type:masterRuleContent?typeof masterRuleContent:'null',project_id:projectId,user_id:userId,has_journey:!!options?.journey,has_journey_structured:!!options?.journeyStructured,has_enriched_flow:!!options?.enrichedFlow,has_page_context:!!options?.pageContext},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
  // #endregion

  // Validar se o request body pode ser serializado
  let serializedBody: string;
  try {
    serializedBody = JSON.stringify(requestBody);
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/8b2f26b3-5b12-48cf-bd31-b28e89327ed7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'subrules-decomposer.ts:82',message:'Request body serializado com sucesso',data:{body_length:serializedBody.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
  } catch (serializeError) {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/8b2f26b3-5b12-48cf-bd31-b28e89327ed7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'subrules-decomposer.ts:86',message:'Erro ao serializar request body',data:{error:String(serializeError)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    throw {
      code: "SERIALIZATION_ERROR",
      message: "Erro ao serializar request body: " + String(serializeError),
      details: serializeError,
    } as AgentError;
  }

  const { data, error } = await supabase.functions.invoke<SubrulesDecomposerResponse>(
    EDGE_FUNCTION_URL,
    {
      body: requestBody,
    }
  );

  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/8b2f26b3-5b12-48cf-bd31-b28e89327ed7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'subrules-decomposer.ts:83',message:'Resposta da edge function',data:{has_error:!!error,error_message:error?.message,error_status:error?.status,error_context:error?.context,error_name:error?.name,has_data:!!data,data_success:data?.success,data_message:data?.message,error_stringified:error?JSON.stringify(error):null},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
  // #endregion

  if (error) {
    console.error("Erro ao chamar subrules-decomposer:", error);
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/8b2f26b3-5b12-48cf-bd31-b28e89327ed7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'subrules-decomposer.ts:92',message:'Erro detalhado antes de throw',data:{error_type:typeof error,error_keys:error?Object.keys(error):[],error_message:error?.message,error_status:error?.status,error_context:error?.context,full_error:error?JSON.stringify(error,Object.getOwnPropertyNames(error)):null},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    throw {
      code: "EDGE_FUNCTION_ERROR",
      message: error.message || "Erro ao conectar com o agente de decomposição",
      details: error,
    } as AgentError;
  }

  if (!data) {
    throw {
      code: "EMPTY_RESPONSE",
      message: "Resposta vazia do agente de decomposição",
    } as AgentError;
  }

  if (!data.success) {
    // Verificar se há erros de grafo
    const graphErrors = (data as any).graph_errors || [];
    if (graphErrors.length > 0) {
      throw {
        code: "GRAPH_VALIDATION_ERROR",
        message: "Validação de grafo falhou",
        details: { errors: graphErrors, nodes: (data as any).nodes },
      } as AgentError;
    }
    
    throw {
      code: "AGENT_ERROR",
      message: data.message || "Erro ao decompor regra em subregras",
    } as AgentError;
  }

  return data;
}

/**
 * Busca subregras já decompostas de uma regra master
 */
export async function getDecomposedSubrules(
  masterRuleId: number
): Promise<SubrulesDecomposerResponse["sub_rules"]> {
  const { data, error } = await supabase
    .from("rules")
    .select("*")
    .eq("parent_rule_id", masterRuleId)
    .eq("rule_type", "node_rule")
    .order("order_index", { ascending: true });

  if (error) {
    console.error("Erro ao buscar subregras:", error);
    return [];
  }

  return (data || []).map((rule: any) => ({
    order_index: rule.order_index,
    title: rule.title,
    description: rule.description,
    suggested_node_type: rule.suggested_node_type || "action",
    path_type: "happy_path" as const,
    expected_outcome: rule.description,
    acceptance_criteria: rule.acceptance_criteria || [],
    dependencies: rule.dependencies || [],
    is_terminal: false,
    priority: rule.priority || "medium",
    tags: rule.tags || [],
    // Novos campos simbólicos
    id: rule.metadata?.symbolic_id,
    next_on_success: rule.metadata?.next_on_success,
    next_on_failure: rule.metadata?.next_on_failure,
    metadata: rule.metadata,
  }));
}

/**
 * Verifica se uma regra master já foi decomposta
 */
export async function isMasterRuleDecomposed(masterRuleId: number): Promise<boolean> {
  const { count, error } = await supabase
    .from("rules")
    .select("id", { count: "exact", head: true })
    .eq("parent_rule_id", masterRuleId)
    .eq("rule_type", "node_rule");

  if (error) {
    console.error("Erro ao verificar decomposição:", error);
    return false;
  }

  return (count || 0) > 0;
}

/**
 * Extrai nós simbólicos das subregras para uso na engine
 */
export function extractSymbolicNodes(
  subRules: SubrulesDecomposerResponse["sub_rules"]
): Array<{
  id: string;
  type: "trigger" | "action" | "condition" | "end" | "subflow";
  title: string;
  description: string;
  next_on_success?: string | null;
  next_on_failure?: string | null;
  end_status?: "success" | "error";
}> {
  return subRules.map((sr: any) => ({
    id: sr.metadata?.symbolic_id || sr.id || `node_${sr.order_index}`,
    type: sr.suggested_node_type || "action",
    title: sr.title,
    description: sr.description,
    next_on_success: sr.next_on_success || sr.metadata?.next_on_success || null,
    next_on_failure: sr.next_on_failure || sr.metadata?.next_on_failure || null,
    end_status: sr.metadata?.status || sr.metadata?.end_status || undefined,
  }));
}
