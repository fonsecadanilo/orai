/**
 * Group Label Gate V3.1
 * 
 * Garante que flows com > 5 nós tenham group_label em todos os nodes.
 * 
 * @module group-label-gate-v3
 */

export interface NodeWithGroupLabel {
  id: string;
  type: string;
  title?: string;
  group_label?: string;
  [key: string]: unknown;
}

export interface GroupLabelIssue {
  rule_id: string;
  severity: "error" | "warning";
  message: string;
  node_id?: string;
  details?: Record<string, unknown>;
  auto_fixable: boolean;
}

export interface GroupLabelValidationResult {
  is_valid: boolean;
  issues: GroupLabelIssue[];
  nodes_without_label: string[];
  suggested_labels: Record<string, string>;
}

// Inferência de group_label baseada no tipo e posição
const TYPE_TO_DEFAULT_GROUP: Record<string, string> = {
  "trigger": "Início",
  "end_success": "Conclusão",
  "end_error": "Conclusão",
  "end_neutral": "Conclusão",
  "feedback_success": "Confirmação",
  "feedback_error": "Tratamento de Erro",
  "retry": "Tratamento de Erro",
  "loopback": "Tratamento de Erro",
  "fallback": "Tratamento de Erro",
  "condition": "Verificação",
  "choice": "Seleção",
  "option_choice": "Seleção",
  "form": "Entrada de Dados",
  "action": "Ação",
  "background_action": "Processamento",
};

// Keywords para inferir group_label do título
const TITLE_KEYWORDS_TO_GROUP: Array<{ pattern: RegExp; group: string }> = [
  { pattern: /\b(login|entrar|acessar|autenticar)\b/i, group: "Autenticação" },
  { pattern: /\b(cadastro|register|signup|criar conta)\b/i, group: "Cadastro" },
  { pattern: /\b(pagamento|payment|pagar|cartão|card)\b/i, group: "Pagamento" },
  { pattern: /\b(checkout|compra|pedido|order)\b/i, group: "Checkout" },
  { pattern: /\b(endereço|address|entrega|delivery)\b/i, group: "Entrega" },
  { pattern: /\b(confirma|confirm|resumo|summary|review)\b/i, group: "Confirmação" },
  { pattern: /\b(perfil|profile|conta|account|settings)\b/i, group: "Perfil" },
  { pattern: /\b(busca|search|pesquisa|filtro|filter)\b/i, group: "Busca" },
  { pattern: /\b(notifica|notify|email|sms|mensagem)\b/i, group: "Notificação" },
  { pattern: /\b(dashboard|painel|home|início)\b/i, group: "Dashboard" },
];

/**
 * Infere o group_label para um nó
 */
export function inferGroupLabel(
  node: NodeWithGroupLabel,
  position: number,
  totalNodes: number
): string {
  // 1. Se já tem group_label, usar
  if (node.group_label) return node.group_label;
  
  // 2. Verificar keywords no título
  if (node.title) {
    for (const { pattern, group } of TITLE_KEYWORDS_TO_GROUP) {
      if (pattern.test(node.title)) {
        return group;
      }
    }
  }
  
  // 3. Inferir do tipo
  if (TYPE_TO_DEFAULT_GROUP[node.type]) {
    return TYPE_TO_DEFAULT_GROUP[node.type];
  }
  
  // 4. Inferir da posição
  if (position === 0) return "Início";
  if (position === totalNodes - 1) return "Conclusão";
  if (position < totalNodes * 0.3) return "Etapa Inicial";
  if (position > totalNodes * 0.7) return "Etapa Final";
  
  return "Etapa Principal";
}

/**
 * Valida e aplica group_labels
 */
export function validateAndApplyGroupLabels(
  nodes: NodeWithGroupLabel[]
): GroupLabelValidationResult {
  const MIN_NODES_FOR_GROUP_LABEL = 5;
  const issues: GroupLabelIssue[] = [];
  const nodesWithoutLabel: string[] = [];
  const suggestedLabels: Record<string, string> = {};
  
  // Se poucos nós, não é obrigatório
  if (nodes.length <= MIN_NODES_FOR_GROUP_LABEL) {
    // Ainda assim, sugerir labels
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      if (!node.group_label) {
        suggestedLabels[node.id] = inferGroupLabel(node, i, nodes.length);
      }
    }
    
    return {
      is_valid: true,
      issues: [],
      nodes_without_label: [],
      suggested_labels: suggestedLabels,
    };
  }
  
  // Verificar cada nó
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    
    if (!node.group_label) {
      nodesWithoutLabel.push(node.id);
      suggestedLabels[node.id] = inferGroupLabel(node, i, nodes.length);
    }
  }
  
  if (nodesWithoutLabel.length > 0) {
    issues.push({
      rule_id: "G1_MISSING_GROUP_LABELS",
      severity: "warning", // Warning, não error - auto-fix é fácil
      message: `${nodesWithoutLabel.length} de ${nodes.length} nós não têm group_label. Serão aplicados automaticamente.`,
      details: {
        nodes_without_label: nodesWithoutLabel,
        suggested_labels: suggestedLabels,
      },
      auto_fixable: true,
    });
  }
  
  return {
    is_valid: issues.length === 0 || issues.every(i => i.severity === "warning"),
    issues,
    nodes_without_label: nodesWithoutLabel,
    suggested_labels: suggestedLabels,
  };
}

/**
 * Aplica group_labels automaticamente nos nós
 */
export function applyGroupLabels<T extends NodeWithGroupLabel>(nodes: T[]): T[] {
  const validation = validateAndApplyGroupLabels(nodes);
  
  return nodes.map((node, i) => {
    if (!node.group_label) {
      return {
        ...node,
        group_label: validation.suggested_labels[node.id] || inferGroupLabel(node, i, nodes.length),
      };
    }
    return node;
  });
}

/**
 * Agrupa nós por group_label para visualização
 */
export function groupNodesByLabel<T extends NodeWithGroupLabel>(nodes: T[]): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  
  for (const node of nodes) {
    const label = node.group_label || "Sem Etapa";
    if (!groups.has(label)) {
      groups.set(label, []);
    }
    groups.get(label)!.push(node);
  }
  
  return groups;
}



