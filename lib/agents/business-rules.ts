import { supabase } from "@/lib/supabase/client";
import type {
  BusinessRulesResponse,
  BusinessRulesRequest,
  FlowConversation,
  AgentError,
  RuleListItem,
  BusinessRule,
  RuleWithReferences,
  RuleWithSubRules,
  FlowMasterRule,
  SubRule,
} from "./types";

const EDGE_FUNCTION_URL = "business-rules-agent";

// =====================================================
// CRIAR REGRAS (MASTER + SUBREGRAS)
// =====================================================

/**
 * Cria uma estrutura hierárquica de regras de negócio
 * - 1 Regra Master (flow_master) com visão geral do fluxo
 * - N Subregras (node_rule) para cada passo do fluxo
 */
export async function createHierarchicalRules(
  prompt: string,
  projectId: number,
  userId: number,
  options?: {
    flowId?: number;
    conversationId?: string;
  }
): Promise<BusinessRulesResponse> {
  const requestBody: BusinessRulesRequest = {
    prompt,
    project_id: projectId,
    user_id: userId,
    flow_id: options?.flowId,
    action: "create",
    conversation_id: options?.conversationId,
  };

  const { data, error } = await supabase.functions.invoke<BusinessRulesResponse>(
    EDGE_FUNCTION_URL,
    {
      body: requestBody,
    }
  );

  if (error) {
    console.error("Erro ao chamar Edge Function de regras:", error);
    throw {
      code: "EDGE_FUNCTION_ERROR",
      message: error.message || "Erro ao conectar com o agente de regras",
      details: error,
    } as AgentError;
  }

  if (!data) {
    throw {
      code: "EMPTY_RESPONSE",
      message: "Resposta vazia do agente de regras",
    } as AgentError;
  }

  if (!data.success) {
    throw {
      code: "AGENT_ERROR",
      message: data.message || "Erro ao gerar regras de negócio",
    } as AgentError;
  }

  return data;
}

// =====================================================
// BUSCAR REGRAS (HIERÁRQUICO)
// =====================================================

/**
 * Busca regras master (flow_master) do projeto com contagem de subregras
 */
export async function getFlowMasterRules(
  projectId: number,
  options?: {
    status?: "draft" | "active" | "deprecated" | "archived";
    limit?: number;
  }
): Promise<RuleWithSubRules[]> {
  try {
    let query = supabase
      .from("rules")
      .select("*")
      .eq("project_id", projectId)
      .eq("rule_type", "flow_master");

    if (options?.status) {
      query = query.eq("status", options.status);
    } else {
      query = query.neq("status", "archived");
    }

    query = query
      .order("updated_at", { ascending: false })
      .limit(options?.limit || 50);

    const { data, error } = await query;

    if (error) {
      console.error("Erro ao buscar regras master:", error);
      return [];
    }

    if (!data || data.length === 0) {
      return [];
    }

    // Para cada regra master, buscar subregras
    const rulesWithSubRules: RuleWithSubRules[] = [];

    for (const rule of data) {
      const { data: subRules } = await supabase
        .from("rules")
        .select("*")
        .eq("parent_rule_id", rule.id)
        .eq("rule_type", "node_rule")
        .order("order_index", { ascending: true });

      rulesWithSubRules.push({
        id: rule.id,
        title: rule.title,
        description: rule.description,
        scope: rule.scope,
        rule_type: rule.rule_type,
        category: rule.category,
        priority: rule.priority,
        status: rule.status,
        flow_id: rule.flow_id,
        flow_name: undefined,
        sub_rules_count: subRules?.length || 0,
        created_at: rule.created_at,
        updated_at: rule.updated_at,
        sub_rules: (subRules || []).map((sr: any) => ({
          id: sr.id,
          title: sr.title,
          description: sr.description,
          scope: "node" as const,
          rule_type: "node_rule" as const,
          category: sr.category || rule.category,
          priority: sr.priority,
          status: sr.status,
          order_index: sr.order_index,
          suggested_node_type: sr.suggested_node_type,
          parent_rule_id: rule.id,
          created_at: sr.created_at || rule.created_at,
          updated_at: sr.updated_at || rule.updated_at,
        })),
      });
    }

    return rulesWithSubRules;
  } catch (err) {
    console.error("Erro ao buscar regras:", err);
    return [];
  }
}

/**
 * Busca uma regra master específica com todas as subregras
 */
export async function getFlowMasterWithSubRules(
  masterRuleId: number
): Promise<RuleWithSubRules | null> {
  const { data: master, error: masterError } = await supabase
    .from("rules")
    .select(`
      *,
      flows:flow_id (name)
    `)
    .eq("id", masterRuleId)
    .eq("rule_type", "flow_master")
    .single();

  if (masterError || !master) {
    console.error("Erro ao buscar regra master:", masterError);
    return null;
  }

  const { data: subRules } = await supabase
    .from("rules")
    .select("*")
    .eq("parent_rule_id", masterRuleId)
    .eq("rule_type", "node_rule")
    .order("order_index", { ascending: true });

  return {
    id: master.id,
    title: master.title,
    description: master.description,
    scope: master.scope,
    rule_type: master.rule_type,
    category: master.category,
    priority: master.priority,
    status: master.status,
    flow_id: master.flow_id,
    flow_name: (master.flows as any)?.name,
    sub_rules_count: subRules?.length || 0,
    created_at: master.created_at,
    updated_at: master.updated_at,
    sub_rules: (subRules || []).map((sr: any) => ({
      id: sr.id,
      title: sr.title,
      description: sr.description,
      scope: "node" as const,
      rule_type: "node_rule" as const,
      category: sr.category,
      priority: sr.priority,
      status: sr.status,
      order_index: sr.order_index,
      suggested_node_type: sr.suggested_node_type,
      parent_rule_id: master.id,
      created_at: sr.created_at,
      updated_at: sr.updated_at,
    })),
  };
}

/**
 * Busca subregras de uma regra master específica
 */
export async function getSubRules(
  parentRuleId: number
): Promise<RuleListItem[]> {
  const { data, error } = await supabase
    .from("rules")
    .select("*")
    .eq("parent_rule_id", parentRuleId)
    .eq("rule_type", "node_rule")
    .order("order_index", { ascending: true });

  if (error) {
    console.error("Erro ao buscar subregras:", error);
    return [];
  }

  return (data || []).map((rule: any) => ({
    id: rule.id,
    title: rule.title,
    description: rule.description,
    scope: rule.scope,
    rule_type: rule.rule_type,
    category: rule.category,
    priority: rule.priority,
    status: rule.status,
    parent_rule_id: rule.parent_rule_id,
    order_index: rule.order_index,
    suggested_node_type: rule.suggested_node_type,
    flow_id: rule.flow_id,
    node_id: rule.node_id,
    created_at: rule.created_at,
    updated_at: rule.updated_at,
  }));
}

// =====================================================
// LISTAGEM GERAL DE REGRAS
// =====================================================

/**
 * Lista todas as regras de um projeto (para compatibilidade)
 */
export async function getProjectRules(
  projectId: number,
  options?: {
    scope?: "global" | "flow" | "node";
    ruleType?: "global" | "flow_master" | "node_rule";
    flowId?: number;
    status?: "draft" | "active" | "deprecated" | "archived";
    category?: string;
    limit?: number;
  }
): Promise<RuleListItem[]> {
  let query = supabase
    .from("rules")
    .select(`
      id,
      title,
      description,
      scope,
      rule_type,
      category,
      priority,
      status,
      parent_rule_id,
      order_index,
      suggested_node_type,
      flow_id,
      node_id,
      created_at,
      updated_at,
      flows:flow_id (name)
    `)
    .or(`project_id.eq.${projectId},scope.eq.global`);

  if (options?.scope) {
    query = query.eq("scope", options.scope);
  }

  if (options?.ruleType) {
    query = query.eq("rule_type", options.ruleType);
  }

  if (options?.flowId) {
    query = query.eq("flow_id", options.flowId);
  }

  if (options?.status) {
    query = query.eq("status", options.status);
  } else {
    query = query.neq("status", "archived");
  }

  if (options?.category) {
    query = query.eq("category", options.category);
  }

  query = query
    .order("rule_type", { ascending: true })
    .order("order_index", { ascending: true, nullsFirst: true })
    .order("updated_at", { ascending: false })
    .limit(options?.limit || 100);

  const { data, error } = await query;

  if (error) {
    console.error("Erro ao buscar regras:", error);
    return [];
  }

  return (data || []).map((rule: any) => ({
    id: rule.id,
    title: rule.title,
    description: rule.description,
    scope: rule.scope,
    rule_type: rule.rule_type || "global",
    category: rule.category,
    priority: rule.priority,
    status: rule.status,
    parent_rule_id: rule.parent_rule_id,
    order_index: rule.order_index,
    suggested_node_type: rule.suggested_node_type,
    flow_id: rule.flow_id,
    flow_name: rule.flows?.name,
    node_id: rule.node_id,
    created_at: rule.created_at,
    updated_at: rule.updated_at,
  }));
}

// =====================================================
// OBTER DETALHES DE UMA REGRA
// =====================================================

/**
 * Obtém uma regra específica com todas as referências
 */
export async function getRuleWithReferences(ruleId: number): Promise<RuleWithReferences | null> {
  const { data: rule, error: ruleError } = await supabase
    .from("rules")
    .select("*")
    .eq("id", ruleId)
    .single();

  if (ruleError || !rule) {
    console.error("Erro ao buscar regra:", ruleError);
    return null;
  }

  // Buscar regra pai se for subregra
  let parentRule = null;
  if (rule.parent_rule_id) {
    const { data: parent } = await supabase
      .from("rules")
      .select("id, title")
      .eq("id", rule.parent_rule_id)
      .single();
    parentRule = parent;
  }

  // Buscar subregras se for flow_master
  let subRules: RuleListItem[] = [];
  if (rule.rule_type === "flow_master") {
    const { data: subs } = await supabase
      .from("rules")
      .select("id, title, description, order_index, suggested_node_type, priority, status")
      .eq("parent_rule_id", ruleId)
      .eq("rule_type", "node_rule")
      .order("order_index", { ascending: true });

    subRules = (subs || []).map((sr: any) => ({
      id: sr.id,
      title: sr.title,
      description: sr.description,
      scope: "node" as const,
      rule_type: "node_rule" as const,
      category: rule.category,
      priority: sr.priority,
      status: sr.status,
      order_index: sr.order_index,
      suggested_node_type: sr.suggested_node_type,
      created_at: sr.created_at || rule.created_at,
      updated_at: sr.updated_at || rule.updated_at,
    }));
  }

  // Buscar referências
  const { data: references } = await supabase
    .from("rule_references")
    .select(`
      id,
      reference_type,
      context,
      target_rule_id,
      target_flow_id,
      target_node_id,
      target_rules:target_rule_id (id, title),
      target_flows:target_flow_id (id, name),
      target_nodes:target_node_id (id, title, flow_id)
    `)
    .eq("source_rule_id", ruleId);

  const result: RuleWithReferences = {
    ...rule,
    referenced_flows: [],
    referenced_nodes: [],
    referenced_rules: [],
    parent_rule: parentRule,
    sub_rules: subRules,
  };

  if (references) {
    references.forEach((ref: any) => {
      if (ref.target_flows) {
        result.referenced_flows?.push(ref.target_flows);
      }
      if (ref.target_nodes) {
        result.referenced_nodes?.push(ref.target_nodes);
      }
      if (ref.target_rules) {
        result.referenced_rules?.push(ref.target_rules);
      }
    });
  }

  return result;
}

// =====================================================
// ATUALIZAR E DELETAR REGRAS
// =====================================================

/**
 * Atualiza uma regra manualmente
 */
export async function updateRule(
  ruleId: number,
  updates: Partial<BusinessRule>
): Promise<boolean> {
  const { error } = await supabase
    .from("rules")
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq("id", ruleId);

  if (error) {
    console.error("Erro ao atualizar regra:", error);
    return false;
  }

  return true;
}

/**
 * Arquiva uma regra (soft delete)
 */
export async function archiveRule(ruleId: number): Promise<boolean> {
  const { error } = await supabase
    .from("rules")
    .update({
      status: "archived",
      updated_at: new Date().toISOString(),
    })
    .eq("id", ruleId);

  if (error) {
    console.error("Erro ao arquivar regra:", error);
    return false;
  }

  return true;
}

/**
 * Arquiva uma regra master e todas as suas subregras
 */
export async function archiveFlowMasterWithSubRules(masterRuleId: number): Promise<boolean> {
  // Arquivar subregras primeiro
  await supabase
    .from("rules")
    .update({
      status: "archived",
      updated_at: new Date().toISOString(),
    })
    .eq("parent_rule_id", masterRuleId);

  // Arquivar regra master
  const { error } = await supabase
    .from("rules")
    .update({
      status: "archived",
      updated_at: new Date().toISOString(),
    })
    .eq("id", masterRuleId);

  if (error) {
    console.error("Erro ao arquivar regra master:", error);
    return false;
  }

  return true;
}

/**
 * Deleta uma regra permanentemente
 */
export async function deleteRule(ruleId: number): Promise<boolean> {
  // Primeiro deletar referências
  await supabase
    .from("rule_references")
    .delete()
    .or(`source_rule_id.eq.${ruleId},target_rule_id.eq.${ruleId}`);

  // Deletar subregras se for flow_master
  await supabase
    .from("rules")
    .delete()
    .eq("parent_rule_id", ruleId);

  // Deletar a regra
  const { error } = await supabase
    .from("rules")
    .delete()
    .eq("id", ruleId);

  if (error) {
    console.error("Erro ao deletar regra:", error);
    return false;
  }

  return true;
}

// =====================================================
// UTILITÁRIOS
// =====================================================

/**
 * Obtém o histórico de conversas do agente de regras
 */
export async function getRulesConversations(
  projectId: number
): Promise<FlowConversation[]> {
  const { data, error } = await supabase
    .from("agent_conversations")
    .select("*")
    .eq("project_id", projectId)
    .in("agent_type", ["business_rules", "business_rules_v2"])
    .order("updated_at", { ascending: false });

  if (error) {
    console.error("Erro ao buscar conversas de regras:", error);
    return [];
  }

  return data || [];
}

/**
 * Obtém categorias únicas de regras do projeto
 */
export async function getRuleCategories(projectId: number): Promise<string[]> {
  const { data, error } = await supabase
    .from("rules")
    .select("category")
    .or(`project_id.eq.${projectId},scope.eq.global`)
    .neq("status", "archived")
    .not("category", "is", null);

  if (error) {
    console.error("Erro ao buscar categorias:", error);
    return [];
  }

  const categories = new Set<string>();
  data?.forEach((item: any) => {
    if (item.category) {
      categories.add(item.category);
    }
  });

  return Array.from(categories).sort();
}

















