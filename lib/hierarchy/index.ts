/**
 * Sistema de Subnós e Hierarquia Estruturada v3.1
 * 
 * Gerencia:
 * - Estrutura hierárquica de nós (pai-filho)
 * - Serialização e deserialização de subnós
 * - Renderização colapsável de hierarquias
 */

import { supabase } from "@/lib/supabase/client";
import type { SubNodeType, SubNode, FlowNodeV3 } from "@/lib/schemas/nodeTypesV3";

// ========================================
// TIPOS
// ========================================

export interface HierarchyNode {
  id: string;
  db_id?: number;
  parent_id: string | null;
  type: string;
  subtype?: SubNodeType;
  title: string;
  order_index: number;
  is_collapsed: boolean;
  depth: number;
  children: HierarchyNode[];
  content?: Record<string, unknown>;
}

export interface FlattenedNode {
  id: string;
  db_id?: number;
  parent_id: string | null;
  type: string;
  subtype?: SubNodeType;
  title: string;
  order_index: number;
  depth: number;
  content?: Record<string, unknown>;
}

export interface HierarchyMetadata {
  total_nodes: number;
  max_depth: number;
  nodes_by_type: Record<string, number>;
  has_children: boolean;
}

// ========================================
// CRIAÇÃO DE HIERARQUIA
// ========================================

/**
 * Cria um subnó filho de um nó existente
 */
export async function createSubNode(
  parentNodeId: number,
  subNodeData: {
    subtype: SubNodeType;
    title: string;
    content?: Record<string, unknown>;
    order_index?: number;
  }
): Promise<number | null> {
  // Buscar nó pai para obter flow_id e calcular order_index
  const { data: parentNode, error: fetchError } = await supabase
    .from("nodes")
    .select("flow_id, metadata")
    .eq("id", parentNodeId)
    .single();

  if (fetchError || !parentNode) {
    console.error("[hierarchy] Erro ao buscar nó pai:", fetchError);
    return null;
  }

  const parentMetadata = (parentNode.metadata || {}) as Record<string, unknown>;
  const existingChildren = (parentMetadata.children as SubNode[]) || [];
  
  // Calcular order_index se não fornecido
  const orderIndex = subNodeData.order_index ?? existingChildren.length;

  // Criar novo subnó
  const newSubNode: SubNode = {
    subnode_id: `${parentNodeId}_sub_${Date.now()}`,
    subnode_type: subNodeData.subtype,
    parent_node_id: String(parentNodeId),
    order_index: orderIndex,
    title: subNodeData.title,
    content: subNodeData.content || {},
    is_collapsed: false,
  };

  // Atualizar metadados do nó pai com o novo subnó
  const updatedChildren = [...existingChildren, newSubNode].sort(
    (a, b) => a.order_index - b.order_index
  );

  const { error: updateError } = await supabase
    .from("nodes")
    .update({
      metadata: {
        ...parentMetadata,
        children: updatedChildren,
        has_children: true,
      },
    })
    .eq("id", parentNodeId);

  if (updateError) {
    console.error("[hierarchy] Erro ao criar subnó:", updateError);
    return null;
  }

  return parentNodeId; // Retorna ID do pai pois subnós são serializados
}

/**
 * Remove um subnó
 */
export async function removeSubNode(
  parentNodeId: number,
  subNodeId: string
): Promise<boolean> {
  const { data: parentNode, error: fetchError } = await supabase
    .from("nodes")
    .select("metadata")
    .eq("id", parentNodeId)
    .single();

  if (fetchError || !parentNode) return false;

  const parentMetadata = (parentNode.metadata || {}) as Record<string, unknown>;
  const existingChildren = (parentMetadata.children as SubNode[]) || [];

  // Filtrar o subnó a ser removido
  const updatedChildren = existingChildren
    .filter(child => child.subnode_id !== subNodeId)
    .map((child, index) => ({ ...child, order_index: index }));

  const { error: updateError } = await supabase
    .from("nodes")
    .update({
      metadata: {
        ...parentMetadata,
        children: updatedChildren,
        has_children: updatedChildren.length > 0,
      },
    })
    .eq("id", parentNodeId);

  return !updateError;
}

/**
 * Atualiza um subnó existente
 */
export async function updateSubNode(
  parentNodeId: number,
  subNodeId: string,
  updates: Partial<Omit<SubNode, "subnode_id" | "parent_node_id">>
): Promise<boolean> {
  const { data: parentNode, error: fetchError } = await supabase
    .from("nodes")
    .select("metadata")
    .eq("id", parentNodeId)
    .single();

  if (fetchError || !parentNode) return false;

  const parentMetadata = (parentNode.metadata || {}) as Record<string, unknown>;
  const existingChildren = (parentMetadata.children as SubNode[]) || [];

  // Atualizar o subnó específico
  const updatedChildren = existingChildren.map(child => {
    if (child.subnode_id === subNodeId) {
      return { ...child, ...updates };
    }
    return child;
  });

  const { error: updateError } = await supabase
    .from("nodes")
    .update({
      metadata: {
        ...parentMetadata,
        children: updatedChildren,
      },
    })
    .eq("id", parentNodeId);

  return !updateError;
}

/**
 * Reordena subnós
 */
export async function reorderSubNodes(
  parentNodeId: number,
  newOrder: string[] // Array de subnode_ids na nova ordem
): Promise<boolean> {
  const { data: parentNode, error: fetchError } = await supabase
    .from("nodes")
    .select("metadata")
    .eq("id", parentNodeId)
    .single();

  if (fetchError || !parentNode) return false;

  const parentMetadata = (parentNode.metadata || {}) as Record<string, unknown>;
  const existingChildren = (parentMetadata.children as SubNode[]) || [];

  // Mapear por ID para reordenar
  const childrenMap = new Map(existingChildren.map(c => [c.subnode_id, c]));
  
  const reorderedChildren = newOrder
    .map((id, index) => {
      const child = childrenMap.get(id);
      if (child) {
        return { ...child, order_index: index };
      }
      return null;
    })
    .filter(Boolean) as SubNode[];

  const { error: updateError } = await supabase
    .from("nodes")
    .update({
      metadata: {
        ...parentMetadata,
        children: reorderedChildren,
      },
    })
    .eq("id", parentNodeId);

  return !updateError;
}

// ========================================
// LEITURA DE HIERARQUIA
// ========================================

/**
 * Obtém a hierarquia completa de um nó
 */
export function getNodeHierarchy(node: FlowNodeV3): HierarchyNode {
  const buildHierarchy = (
    children: SubNode[] | undefined,
    depth: number
  ): HierarchyNode[] => {
    if (!children?.length) return [];

    return children.map(child => ({
      id: child.subnode_id,
      parent_id: child.parent_node_id,
      type: "subnode",
      subtype: child.subnode_type,
      title: child.title || child.subnode_type,
      order_index: child.order_index,
      is_collapsed: child.is_collapsed,
      depth,
      content: child.content,
      children: [], // Subnós não têm filhos neste modelo
    }));
  };

  return {
    id: node.id,
    db_id: node.db_id,
    parent_id: null,
    type: node.type,
    title: node.title,
    order_index: node.order_index || 0,
    is_collapsed: false,
    depth: 0,
    children: buildHierarchy(node.children, 1),
    content: node.content,
  };
}

/**
 * Achata a hierarquia para exibição em lista
 */
export function flattenHierarchy(root: HierarchyNode): FlattenedNode[] {
  const result: FlattenedNode[] = [];

  const traverse = (node: HierarchyNode) => {
    result.push({
      id: node.id,
      db_id: node.db_id,
      parent_id: node.parent_id,
      type: node.type,
      subtype: node.subtype,
      title: node.title,
      order_index: node.order_index,
      depth: node.depth,
      content: node.content,
    });

    for (const child of node.children) {
      traverse(child);
    }
  };

  traverse(root);
  return result;
}

/**
 * Calcula metadados da hierarquia
 */
export function getHierarchyMetadata(root: HierarchyNode): HierarchyMetadata {
  const nodesByType: Record<string, number> = {};
  let maxDepth = 0;
  let totalNodes = 0;

  const traverse = (node: HierarchyNode) => {
    totalNodes++;
    maxDepth = Math.max(maxDepth, node.depth);
    
    const type = node.subtype || node.type;
    nodesByType[type] = (nodesByType[type] || 0) + 1;

    for (const child of node.children) {
      traverse(child);
    }
  };

  traverse(root);

  return {
    total_nodes: totalNodes,
    max_depth: maxDepth,
    nodes_by_type: nodesByType,
    has_children: root.children.length > 0,
  };
}

// ========================================
// SERIALIZAÇÃO PARA BANCO
// ========================================

/**
 * Serializa a hierarquia para armazenamento em metadata
 */
export function serializeHierarchy(root: HierarchyNode): Record<string, unknown> {
  return {
    children: root.children.map(child => ({
      subnode_id: child.id,
      subnode_type: child.subtype || child.type,
      parent_node_id: child.parent_id,
      order_index: child.order_index,
      title: child.title,
      content: child.content || {},
      is_collapsed: child.is_collapsed,
    })),
    has_children: root.children.length > 0,
    hierarchy_metadata: getHierarchyMetadata(root),
  };
}

/**
 * Deserializa a hierarquia do banco
 */
export function deserializeHierarchy(
  nodeId: string,
  nodeType: string,
  nodeTitle: string,
  metadata: Record<string, unknown>
): HierarchyNode {
  const children = (metadata.children as SubNode[]) || [];

  return {
    id: nodeId,
    parent_id: null,
    type: nodeType,
    title: nodeTitle,
    order_index: 0,
    is_collapsed: false,
    depth: 0,
    children: children.map(child => ({
      id: child.subnode_id,
      parent_id: child.parent_node_id,
      type: "subnode",
      subtype: child.subnode_type,
      title: child.title || child.subnode_type,
      order_index: child.order_index,
      is_collapsed: child.is_collapsed,
      depth: 1,
      content: child.content,
      children: [],
    })),
    content: metadata.content as Record<string, unknown> | undefined,
  };
}

// ========================================
// HELPERS PARA UI
// ========================================

/**
 * Alterna estado de colapso de um nó
 */
export function toggleCollapse(
  hierarchy: HierarchyNode,
  nodeId: string
): HierarchyNode {
  if (hierarchy.id === nodeId) {
    return { ...hierarchy, is_collapsed: !hierarchy.is_collapsed };
  }

  return {
    ...hierarchy,
    children: hierarchy.children.map(child => toggleCollapse(child, nodeId)),
  };
}

/**
 * Expande todos os nós
 */
export function expandAll(hierarchy: HierarchyNode): HierarchyNode {
  return {
    ...hierarchy,
    is_collapsed: false,
    children: hierarchy.children.map(expandAll),
  };
}

/**
 * Colapsa todos os nós
 */
export function collapseAll(hierarchy: HierarchyNode): HierarchyNode {
  return {
    ...hierarchy,
    is_collapsed: hierarchy.children.length > 0,
    children: hierarchy.children.map(collapseAll),
  };
}

/**
 * Encontra um nó na hierarquia pelo ID
 */
export function findNodeInHierarchy(
  hierarchy: HierarchyNode,
  nodeId: string
): HierarchyNode | null {
  if (hierarchy.id === nodeId) return hierarchy;

  for (const child of hierarchy.children) {
    const found = findNodeInHierarchy(child, nodeId);
    if (found) return found;
  }

  return null;
}

/**
 * Obtém o caminho até um nó (breadcrumb)
 */
export function getPathToNode(
  hierarchy: HierarchyNode,
  nodeId: string
): string[] {
  const path: string[] = [];

  const traverse = (node: HierarchyNode): boolean => {
    if (node.id === nodeId) {
      path.push(node.title);
      return true;
    }

    for (const child of node.children) {
      if (traverse(child)) {
        path.unshift(node.title);
        return true;
      }
    }

    return false;
  };

  traverse(hierarchy);
  return path;
}

// ========================================
// CONVERSÃO PARA EXIBIÇÃO
// ========================================

/**
 * Converte hierarquia para exibição no editor de fluxo
 */
export function hierarchyToFlowNodes(
  hierarchy: HierarchyNode,
  baseX: number = 0,
  baseY: number = 0
): Array<{
  id: string;
  type: string;
  position: { x: number; y: number };
  data: Record<string, unknown>;
  parentNode?: string;
  extent?: "parent";
}> {
  const nodes: Array<{
    id: string;
    type: string;
    position: { x: number; y: number };
    data: Record<string, unknown>;
    parentNode?: string;
    extent?: "parent";
  }> = [];

  // Nó raiz
  nodes.push({
    id: hierarchy.id,
    type: hierarchy.type,
    position: { x: baseX, y: baseY },
    data: {
      label: hierarchy.title,
      hasChildren: hierarchy.children.length > 0,
      isCollapsed: hierarchy.is_collapsed,
      ...hierarchy.content,
    },
  });

  // Subnós (se não colapsados)
  if (!hierarchy.is_collapsed) {
    hierarchy.children.forEach((child, index) => {
      nodes.push({
        id: child.id,
        type: child.subtype || "subnode",
        position: { x: 20, y: 60 + index * 40 },
        data: {
          label: child.title,
          depth: child.depth,
          ...child.content,
        },
        parentNode: hierarchy.id,
        extent: "parent",
      });
    });
  }

  return nodes;
}

/**
 * Ícones para tipos de subnós
 */
export const SUBNODE_ICONS: Record<SubNodeType, string> = {
  input_field: "FormInput",
  modal_step: "Layers",
  field_group: "Group",
  validation_rule: "ShieldCheck",
  interactive_component: "MousePointer",
  option_choice: "ListChecks",
  button: "MousePointerClick",
  condition_branch: "GitBranch",
};

/**
 * Labels para tipos de subnós
 */
export const SUBNODE_LABELS: Record<SubNodeType, string> = {
  input_field: "Campo de Entrada",
  modal_step: "Passo de Modal",
  field_group: "Grupo de Campos",
  validation_rule: "Regra de Validação",
  interactive_component: "Componente Interativo",
  option_choice: "Opção de Escolha",
  button: "Botão",
  condition_branch: "Ramo de Condição",
};







