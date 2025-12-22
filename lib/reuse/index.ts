/**
 * Sistema de Reuso e Referência Cruzada v3.1
 * 
 * Gerencia:
 * - Rastreamento de nós reutilizados
 * - Referências cruzadas entre fluxos
 * - Painel de dependências
 * - Sincronização de atualizações
 */

import { supabase } from "@/lib/supabase/client";

// ========================================
// TIPOS
// ========================================

export interface ReuseMetadata {
  reused: boolean;
  reuse_type: "reference" | "clone";
  source_flow_id: number | null;
  primary_flow_id: number;
  referenced_in: number[];
  subpages: string[];
  last_synced_at: string | null;
}

export interface NodeReference {
  node_id: number;
  node_title: string;
  flow_id: number;
  flow_name: string;
  reference_type: "source" | "reference" | "clone";
}

export interface DependencyInfo {
  node_id: number;
  node_title: string;
  depends_on: NodeReference[];
  depended_by: NodeReference[];
  subpages: string[];
  last_updated: string;
}

export interface FlowDependencyGraph {
  flow_id: number;
  flow_name: string;
  nodes_with_reuse: number;
  total_nodes: number;
  incoming_references: { flow_id: number; flow_name: string; count: number }[];
  outgoing_references: { flow_id: number; flow_name: string; count: number }[];
}

// ========================================
// FUNÇÕES DE REUSO
// ========================================

/**
 * Marca um nó como reutilizado de outro fluxo
 */
export async function markNodeAsReused(
  nodeId: number,
  sourceFlowId: number,
  reuseType: "reference" | "clone"
): Promise<boolean> {
  const { data: node, error: fetchError } = await supabase
    .from("nodes")
    .select("metadata, flow_id")
    .eq("id", nodeId)
    .single();

  if (fetchError || !node) {
    console.error("[reuse] Erro ao buscar nó:", fetchError);
    return false;
  }

  const currentMetadata = (node.metadata || {}) as Record<string, unknown>;
  const newMetadata: ReuseMetadata = {
    reused: true,
    reuse_type: reuseType,
    source_flow_id: sourceFlowId,
    primary_flow_id: node.flow_id,
    referenced_in: [node.flow_id],
    subpages: [],
    last_synced_at: new Date().toISOString(),
  };

  const { error: updateError } = await supabase
    .from("nodes")
    .update({
      metadata: { ...currentMetadata, ...newMetadata },
      updated_at: new Date().toISOString(),
    })
    .eq("id", nodeId);

  if (updateError) {
    console.error("[reuse] Erro ao marcar nó como reutilizado:", updateError);
    return false;
  }

  // Atualizar o nó fonte com a referência
  await addReferenceToSourceNode(sourceFlowId, nodeId, node.flow_id);

  return true;
}

/**
 * Adiciona referência ao nó fonte
 */
async function addReferenceToSourceNode(
  sourceFlowId: number,
  referencingNodeId: number,
  referencingFlowId: number
): Promise<void> {
  // Buscar nós do fluxo fonte que podem ser a fonte
  const { data: sourceNodes } = await supabase
    .from("nodes")
    .select("id, metadata")
    .eq("flow_id", sourceFlowId);

  if (!sourceNodes?.length) return;

  // Para simplificar, atualizar o primeiro nó com a referência
  // Em produção, seria necessário identificar o nó específico
  for (const sourceNode of sourceNodes) {
    const metadata = (sourceNode.metadata || {}) as Record<string, unknown>;
    const referencedIn = (metadata.referenced_in as number[]) || [];
    
    if (!referencedIn.includes(referencingFlowId)) {
      await supabase
        .from("nodes")
        .update({
          metadata: {
            ...metadata,
            referenced_in: [...referencedIn, referencingFlowId],
          },
        })
        .eq("id", sourceNode.id);
    }
  }
}

/**
 * Clona um nó de outro fluxo
 */
export async function cloneNodeFromFlow(
  sourceNodeId: number,
  targetFlowId: number,
  positionX: number = 100,
  positionY: number = 100
): Promise<number | null> {
  // Buscar nó fonte
  const { data: sourceNode, error: fetchError } = await supabase
    .from("nodes")
    .select("*")
    .eq("id", sourceNodeId)
    .single();

  if (fetchError || !sourceNode) {
    console.error("[reuse] Erro ao buscar nó fonte:", fetchError);
    return null;
  }

  // Criar clone com metadados de reuso
  const cloneMetadata: ReuseMetadata = {
    reused: true,
    reuse_type: "clone",
    source_flow_id: sourceNode.flow_id,
    primary_flow_id: targetFlowId,
    referenced_in: [targetFlowId],
    subpages: [],
    last_synced_at: new Date().toISOString(),
  };

  const { data: clonedNode, error: insertError } = await supabase
    .from("nodes")
    .insert({
      flow_id: targetFlowId,
      type: sourceNode.type,
      title: `${sourceNode.title} (clone)`,
      description: sourceNode.description,
      position_x: positionX,
      position_y: positionY,
      metadata: {
        ...((sourceNode.metadata || {}) as Record<string, unknown>),
        ...cloneMetadata,
        cloned_from_node_id: sourceNodeId,
      },
    })
    .select()
    .single();

  if (insertError || !clonedNode) {
    console.error("[reuse] Erro ao clonar nó:", insertError);
    return null;
  }

  // Atualizar nó fonte com referência
  await addReferenceToSourceNode(sourceNode.flow_id, clonedNode.id, targetFlowId);

  return clonedNode.id;
}

/**
 * Remove reuso de um nó (desvincula)
 */
export async function unlinkNode(nodeId: number): Promise<boolean> {
  const { data: node, error: fetchError } = await supabase
    .from("nodes")
    .select("metadata, flow_id")
    .eq("id", nodeId)
    .single();

  if (fetchError || !node) return false;

  const metadata = (node.metadata || {}) as Record<string, unknown>;
  
  // Remover metadados de reuso
  const { source_flow_id, ...restMetadata } = metadata;
  
  const { error: updateError } = await supabase
    .from("nodes")
    .update({
      metadata: {
        ...restMetadata,
        reused: false,
        source_flow_id: null,
        unlinked_at: new Date().toISOString(),
      },
    })
    .eq("id", nodeId);

  return !updateError;
}

// ========================================
// FUNÇÕES DE REFERÊNCIA CRUZADA
// ========================================

/**
 * Obtém todas as referências de um nó
 */
export async function getNodeReferences(nodeId: number): Promise<{
  sources: NodeReference[];
  references: NodeReference[];
}> {
  const { data: node, error } = await supabase
    .from("nodes")
    .select(`
      id,
      title,
      metadata,
      flow_id,
      flows!inner(name)
    `)
    .eq("id", nodeId)
    .single();

  if (error || !node) {
    return { sources: [], references: [] };
  }

  const metadata = (node.metadata || {}) as ReuseMetadata;
  const sources: NodeReference[] = [];
  const references: NodeReference[] = [];

  // Buscar fonte se for um nó reutilizado
  if (metadata.source_flow_id) {
    const { data: sourceFlow } = await supabase
      .from("flows")
      .select("id, name")
      .eq("id", metadata.source_flow_id)
      .single();

    if (sourceFlow) {
      sources.push({
        node_id: nodeId,
        node_title: node.title,
        flow_id: sourceFlow.id,
        flow_name: sourceFlow.name,
        reference_type: "source",
      });
    }
  }

  // Buscar referências
  if (metadata.referenced_in?.length) {
    const { data: refFlows } = await supabase
      .from("flows")
      .select("id, name")
      .in("id", metadata.referenced_in);

    for (const flow of refFlows || []) {
      if (flow.id !== node.flow_id) {
        references.push({
          node_id: nodeId,
          node_title: node.title,
          flow_id: flow.id,
          flow_name: flow.name,
          reference_type: metadata.reuse_type === "clone" ? "clone" : "reference",
        });
      }
    }
  }

  return { sources, references };
}

/**
 * Obtém o grafo de dependências de um fluxo
 */
export async function getFlowDependencyGraph(flowId: number): Promise<FlowDependencyGraph | null> {
  const { data: flow, error: flowError } = await supabase
    .from("flows")
    .select("id, name")
    .eq("id", flowId)
    .single();

  if (flowError || !flow) return null;

  // Buscar todos os nós do fluxo
  const { data: nodes, error: nodesError } = await supabase
    .from("nodes")
    .select("id, metadata")
    .eq("flow_id", flowId);

  if (nodesError || !nodes) return null;

  const nodesWithReuse = nodes.filter(n => 
    (n.metadata as any)?.reused === true
  ).length;

  // Coletar referências
  const incomingFlows = new Map<number, { name: string; count: number }>();
  const outgoingFlows = new Map<number, { name: string; count: number }>();

  for (const node of nodes) {
    const metadata = (node.metadata || {}) as ReuseMetadata;
    
    // Incoming: este nó é referenciado por outros fluxos
    if (metadata.referenced_in) {
      for (const refFlowId of metadata.referenced_in) {
        if (refFlowId !== flowId) {
          const existing = incomingFlows.get(refFlowId) || { name: `Flow ${refFlowId}`, count: 0 };
          incomingFlows.set(refFlowId, { ...existing, count: existing.count + 1 });
        }
      }
    }
    
    // Outgoing: este nó referencia outros fluxos
    if (metadata.source_flow_id && metadata.source_flow_id !== flowId) {
      const existing = outgoingFlows.get(metadata.source_flow_id) || { name: `Flow ${metadata.source_flow_id}`, count: 0 };
      outgoingFlows.set(metadata.source_flow_id, { ...existing, count: existing.count + 1 });
    }
  }

  // Buscar nomes dos fluxos
  const allFlowIds = [...incomingFlows.keys(), ...outgoingFlows.keys()];
  if (allFlowIds.length > 0) {
    const { data: flows } = await supabase
      .from("flows")
      .select("id, name")
      .in("id", allFlowIds);

    for (const f of flows || []) {
      if (incomingFlows.has(f.id)) {
        incomingFlows.set(f.id, { ...incomingFlows.get(f.id)!, name: f.name });
      }
      if (outgoingFlows.has(f.id)) {
        outgoingFlows.set(f.id, { ...outgoingFlows.get(f.id)!, name: f.name });
      }
    }
  }

  return {
    flow_id: flow.id,
    flow_name: flow.name,
    nodes_with_reuse: nodesWithReuse,
    total_nodes: nodes.length,
    incoming_references: Array.from(incomingFlows.entries()).map(([id, data]) => ({
      flow_id: id,
      flow_name: data.name,
      count: data.count,
    })),
    outgoing_references: Array.from(outgoingFlows.entries()).map(([id, data]) => ({
      flow_id: id,
      flow_name: data.name,
      count: data.count,
    })),
  };
}

// ========================================
// FUNÇÕES DE SINCRONIZAÇÃO
// ========================================

/**
 * Sincroniza um nó clonado com sua fonte
 */
export async function syncClonedNode(nodeId: number): Promise<boolean> {
  const { data: node, error: fetchError } = await supabase
    .from("nodes")
    .select("metadata")
    .eq("id", nodeId)
    .single();

  if (fetchError || !node) return false;

  const metadata = (node.metadata || {}) as ReuseMetadata & { cloned_from_node_id?: number };
  
  if (!metadata.cloned_from_node_id) {
    console.warn("[reuse] Nó não é um clone");
    return false;
  }

  // Buscar nó fonte
  const { data: sourceNode, error: sourceError } = await supabase
    .from("nodes")
    .select("title, description, type, metadata")
    .eq("id", metadata.cloned_from_node_id)
    .single();

  if (sourceError || !sourceNode) return false;

  // Atualizar clone com dados da fonte
  const { error: updateError } = await supabase
    .from("nodes")
    .update({
      title: sourceNode.title,
      description: sourceNode.description,
      type: sourceNode.type,
      metadata: {
        ...metadata,
        last_synced_at: new Date().toISOString(),
      },
    })
    .eq("id", nodeId);

  return !updateError;
}

/**
 * Verifica se um nó clonado está desatualizado
 */
export async function checkCloneStatus(nodeId: number): Promise<{
  is_outdated: boolean;
  source_updated_at: string | null;
  clone_synced_at: string | null;
}> {
  const { data: node } = await supabase
    .from("nodes")
    .select("metadata")
    .eq("id", nodeId)
    .single();

  if (!node) {
    return { is_outdated: false, source_updated_at: null, clone_synced_at: null };
  }

  const metadata = (node.metadata || {}) as ReuseMetadata & { cloned_from_node_id?: number };
  
  if (!metadata.cloned_from_node_id) {
    return { is_outdated: false, source_updated_at: null, clone_synced_at: metadata.last_synced_at };
  }

  const { data: sourceNode } = await supabase
    .from("nodes")
    .select("updated_at")
    .eq("id", metadata.cloned_from_node_id)
    .single();

  if (!sourceNode) {
    return { is_outdated: false, source_updated_at: null, clone_synced_at: metadata.last_synced_at };
  }

  const sourceUpdated = new Date(sourceNode.updated_at);
  const cloneSynced = metadata.last_synced_at ? new Date(metadata.last_synced_at) : new Date(0);

  return {
    is_outdated: sourceUpdated > cloneSynced,
    source_updated_at: sourceNode.updated_at,
    clone_synced_at: metadata.last_synced_at,
  };
}

// ========================================
// FUNÇÕES DE BUSCA
// ========================================

/**
 * Busca nós reutilizáveis em um projeto
 */
export async function findReusableNodes(
  projectId: number,
  options?: {
    nodeType?: string;
    searchTerm?: string;
    limit?: number;
  }
): Promise<Array<{
  node_id: number;
  node_title: string;
  node_type: string;
  flow_id: number;
  flow_name: string;
  reuse_count: number;
}>> {
  let query = supabase
    .from("nodes")
    .select(`
      id,
      title,
      type,
      metadata,
      flow_id,
      flows!inner(name, project_id)
    `)
    .eq("flows.project_id", projectId);

  if (options?.nodeType) {
    query = query.eq("type", options.nodeType);
  }

  if (options?.searchTerm) {
    query = query.ilike("title", `%${options.searchTerm}%`);
  }

  const { data, error } = await query.limit(options?.limit || 50);

  if (error || !data) return [];

  return data.map((node: any) => ({
    node_id: node.id,
    node_title: node.title,
    node_type: node.type,
    flow_id: node.flow_id,
    flow_name: node.flows.name,
    reuse_count: (node.metadata?.referenced_in as number[])?.length || 0,
  }));
}

/**
 * Calcula similaridade entre nós para sugerir reuso
 */
export async function suggestSimilarNodes(
  nodeTitle: string,
  nodeType: string,
  projectId: number,
  excludeFlowId?: number
): Promise<Array<{
  node_id: number;
  node_title: string;
  flow_id: number;
  flow_name: string;
  similarity_score: number;
}>> {
  const reusableNodes = await findReusableNodes(projectId, {
    nodeType,
    limit: 100,
  });

  // Filtrar e calcular similaridade
  const suggestions = reusableNodes
    .filter(n => excludeFlowId ? n.flow_id !== excludeFlowId : true)
    .map(n => ({
      ...n,
      similarity_score: calculateSimilarity(nodeTitle, n.node_title),
    }))
    .filter(n => n.similarity_score > 0.3)
    .sort((a, b) => b.similarity_score - a.similarity_score)
    .slice(0, 10);

  return suggestions;
}

function calculateSimilarity(str1: string, str2: string): number {
  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();

  if (s1 === s2) return 1;
  if (s1.includes(s2) || s2.includes(s1)) return 0.8;

  // Jaccard similarity
  const words1 = new Set(s1.split(/\s+/));
  const words2 = new Set(s2.split(/\s+/));
  const intersection = new Set([...words1].filter(x => words2.has(x)));
  const union = new Set([...words1, ...words2]);

  return union.size > 0 ? intersection.size / union.size : 0;
}









