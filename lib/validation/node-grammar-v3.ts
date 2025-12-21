/**
 * NodeGrammarV3 - Regras Semânticas para Tipos de Nós v3.1
 * 
 * Define regras determinísticas para cada tipo de nó baseadas na
 * Tabela de Semânticas v3:
 * - Tipos permitidos de saída
 * - Quantidade mínima/máxima de saídas
 * - Requisitos de branching
 * - Tratamento de erro recomendado
 */

import type { NodeTypeV3, ImpactLevel, SubNodeType } from "@/lib/agents/v3/types";

// ========================================
// TIPOS DE CONEXÃO VÁLIDOS
// ========================================

export type ConnectionTypeV3 = 
  | "success" 
  | "failure" 
  | "default" 
  | "option" 
  | "retry" 
  | "fallback" 
  | "loopback"
  | "condition";

// ========================================
// GRAMÁTICA DE NÓ V3
// ========================================

export interface NodeGrammarRule {
  /** Tipo do nó */
  node_type: string;
  
  /** É um nó terminal (não pode ter saídas)? */
  is_terminal: boolean;
  
  /** Tipos de conexão de saída permitidos */
  allowed_output_types: ConnectionTypeV3[];
  
  /** Quantidade mínima de saídas */
  min_outputs: number;
  
  /** Quantidade máxima de saídas (-1 = ilimitado) */
  max_outputs: number;
  
  /** Precisa de labels nos branches? */
  requires_labels: boolean;
  
  /** Precisa de children (subnós)? */
  requires_children: boolean;
  
  /** Tipos de children permitidos */
  allowed_children_types?: SubNodeType[];
  
  /** Suporta retry por impact_level? */
  supports_retry_by_impact: ImpactLevel[];
  
  /** Tratamento de erro recomendado */
  recommended_error_handling: {
    /** Padrão de tratamento */
    pattern: "feedback_error_loopback" | "feedback_error_retry" | "feedback_error_end" | "none";
    /** Aplicável para quais impact_levels? */
    for_impact_levels: ImpactLevel[];
  };
  
  /** Mensagem de descrição */
  description: string;
}

// ========================================
// REGRAS POR TIPO DE NÓ
// ========================================

export const NODE_GRAMMAR_V3: Record<string, NodeGrammarRule> = {
  // ========================================
  // TRIGGER - Ponto de entrada
  // ========================================
  trigger: {
    node_type: "trigger",
    is_terminal: false,
    allowed_output_types: ["default", "success"],
    min_outputs: 1,
    max_outputs: 1,
    requires_labels: false,
    requires_children: false,
    supports_retry_by_impact: [],
    recommended_error_handling: {
      pattern: "none",
      for_impact_levels: [],
    },
    description: "Ponto de entrada do fluxo. Deve ter exatamente 1 saída default.",
  },

  // ========================================
  // ACTION - Ação do sistema
  // ========================================
  action: {
    node_type: "action",
    is_terminal: false,
    allowed_output_types: ["success", "failure", "retry", "fallback"],
    min_outputs: 1,
    max_outputs: 3,
    requires_labels: false,
    requires_children: false,
    supports_retry_by_impact: ["medium", "high"],
    recommended_error_handling: {
      pattern: "feedback_error_retry",
      for_impact_levels: ["high"],
    },
    description: "Ação do sistema. Para impact=high, deve ter failure path com retry.",
  },

  // ========================================
  // CONDITION - Decisão binária
  // ========================================
  condition: {
    node_type: "condition",
    is_terminal: false,
    allowed_output_types: ["success", "failure"],
    min_outputs: 2,
    max_outputs: 2,
    requires_labels: true,
    requires_children: false,
    supports_retry_by_impact: [],
    recommended_error_handling: {
      pattern: "none",
      for_impact_levels: [],
    },
    description: "Decisão binária. DEVE ter exatamente 2 saídas: success (Sim) e failure (Não).",
  },

  // ========================================
  // CHOICE - Múltiplas opções
  // ========================================
  choice: {
    node_type: "choice",
    is_terminal: false,
    allowed_output_types: ["option", "default"],
    min_outputs: 2,
    max_outputs: -1,
    requires_labels: true,
    requires_children: false,
    allowed_children_types: ["option_choice"],
    supports_retry_by_impact: [],
    recommended_error_handling: {
      pattern: "none",
      for_impact_levels: [],
    },
    description: "Múltiplas opções. Deve ter ao menos 2 saídas com labels.",
  },

  // ========================================
  // FORM - Formulário com inputs
  // ========================================
  form: {
    node_type: "form",
    is_terminal: false,
    allowed_output_types: ["success", "failure", "loopback"],
    min_outputs: 1,
    max_outputs: 2,
    requires_labels: false,
    requires_children: false, // Usa metadata.inputs em vez de children
    allowed_children_types: ["input_field", "field_group", "validation_rule"],
    supports_retry_by_impact: ["medium", "high"],
    recommended_error_handling: {
      pattern: "feedback_error_loopback",
      for_impact_levels: ["medium", "high"],
    },
    description: "Formulário. Para impact=medium/high, deve ter error path com loopback.",
  },

  // ========================================
  // FEEDBACK SUCCESS
  // ========================================
  feedback_success: {
    node_type: "feedback_success",
    is_terminal: false,
    allowed_output_types: ["default", "success"],
    min_outputs: 0,
    max_outputs: 1,
    requires_labels: false,
    requires_children: false,
    supports_retry_by_impact: [],
    recommended_error_handling: {
      pattern: "none",
      for_impact_levels: [],
    },
    description: "Feedback de sucesso. Pode ser terminal ou ter 1 saída.",
  },

  // ========================================
  // FEEDBACK ERROR
  // ========================================
  feedback_error: {
    node_type: "feedback_error",
    is_terminal: false,
    allowed_output_types: ["retry", "loopback", "fallback", "default"],
    min_outputs: 1,
    max_outputs: 2,
    requires_labels: false,
    requires_children: false,
    supports_retry_by_impact: [],
    recommended_error_handling: {
      pattern: "none",
      for_impact_levels: [],
    },
    description: "Feedback de erro. Deve levar a retry, loopback ou fallback.",
  },

  // ========================================
  // END SUCCESS - Terminal
  // ========================================
  end_success: {
    node_type: "end_success",
    is_terminal: true,
    allowed_output_types: [],
    min_outputs: 0,
    max_outputs: 0,
    requires_labels: false,
    requires_children: false,
    supports_retry_by_impact: [],
    recommended_error_handling: {
      pattern: "none",
      for_impact_levels: [],
    },
    description: "Fim com sucesso. NÃO pode ter saídas.",
  },

  // ========================================
  // END ERROR - Terminal
  // ========================================
  end_error: {
    node_type: "end_error",
    is_terminal: true,
    allowed_output_types: [],
    min_outputs: 0,
    max_outputs: 0,
    requires_labels: false,
    requires_children: false,
    supports_retry_by_impact: [],
    recommended_error_handling: {
      pattern: "none",
      for_impact_levels: [],
    },
    description: "Fim com erro. NÃO pode ter saídas.",
  },

  // ========================================
  // END NEUTRAL - Terminal
  // ========================================
  end_neutral: {
    node_type: "end_neutral",
    is_terminal: true,
    allowed_output_types: [],
    min_outputs: 0,
    max_outputs: 0,
    requires_labels: false,
    requires_children: false,
    supports_retry_by_impact: [],
    recommended_error_handling: {
      pattern: "none",
      for_impact_levels: [],
    },
    description: "Fim neutro (cancelamento, skip). NÃO pode ter saídas.",
  },

  // ========================================
  // RETRY - Nó de retry
  // ========================================
  retry: {
    node_type: "retry",
    is_terminal: false,
    allowed_output_types: ["loopback", "fallback", "default"],
    min_outputs: 1,
    max_outputs: 2,
    requires_labels: false,
    requires_children: false,
    supports_retry_by_impact: [],
    recommended_error_handling: {
      pattern: "none",
      for_impact_levels: [],
    },
    description: "Retry. Deve voltar ao nó original (loopback) ou ter fallback.",
  },

  // ========================================
  // FALLBACK - Caminho alternativo
  // ========================================
  fallback: {
    node_type: "fallback",
    is_terminal: false,
    allowed_output_types: ["default", "success"],
    min_outputs: 1,
    max_outputs: 1,
    requires_labels: false,
    requires_children: false,
    supports_retry_by_impact: [],
    recommended_error_handling: {
      pattern: "none",
      for_impact_levels: [],
    },
    description: "Fallback. Deve levar a um caminho alternativo seguro.",
  },

  // ========================================
  // LOOPBACK - Voltar a um nó anterior
  // ========================================
  loopback: {
    node_type: "loopback",
    is_terminal: false,
    allowed_output_types: ["loopback", "default"],
    min_outputs: 1,
    max_outputs: 1,
    requires_labels: false,
    requires_children: false,
    supports_retry_by_impact: [],
    recommended_error_handling: {
      pattern: "none",
      for_impact_levels: [],
    },
    description: "Loopback. Deve voltar a um nó anterior no fluxo.",
  },

  // ========================================
  // BACKGROUND ACTION
  // ========================================
  background_action: {
    node_type: "background_action",
    is_terminal: false,
    allowed_output_types: ["success", "default"],
    min_outputs: 1,
    max_outputs: 1,
    requires_labels: false,
    requires_children: false,
    supports_retry_by_impact: ["high"],
    recommended_error_handling: {
      pattern: "none",
      for_impact_levels: [],
    },
    description: "Ação em background. Executa sem bloquear o fluxo.",
  },

  // ========================================
  // DELAYED ACTION
  // ========================================
  delayed_action: {
    node_type: "delayed_action",
    is_terminal: false,
    allowed_output_types: ["success", "default"],
    min_outputs: 1,
    max_outputs: 1,
    requires_labels: false,
    requires_children: false,
    supports_retry_by_impact: [],
    recommended_error_handling: {
      pattern: "none",
      for_impact_levels: [],
    },
    description: "Ação com delay. Aguarda um tempo antes de continuar.",
  },

  // ========================================
  // INSIGHT BRANCH - Decisão informada
  // ========================================
  insight_branch: {
    node_type: "insight_branch",
    is_terminal: false,
    allowed_output_types: ["option", "default"],
    min_outputs: 2,
    max_outputs: -1,
    requires_labels: true,
    requires_children: false,
    supports_retry_by_impact: [],
    recommended_error_handling: {
      pattern: "none",
      for_impact_levels: [],
    },
    description: "Decisão informada. Deve ter ao menos 2 opções com labels.",
  },

  // ========================================
  // CONFIGURATION MATRIX
  // ========================================
  configuration_matrix: {
    node_type: "configuration_matrix",
    is_terminal: false,
    allowed_output_types: ["success", "failure"],
    min_outputs: 1,
    max_outputs: 2,
    requires_labels: false,
    requires_children: false,
    allowed_children_types: ["input_field", "field_group", "validation_rule"],
    supports_retry_by_impact: ["medium", "high"],
    recommended_error_handling: {
      pattern: "feedback_error_loopback",
      for_impact_levels: ["medium", "high"],
    },
    description: "Matriz de configuração. Similar a form, deve ter error handling.",
  },

  // ========================================
  // LEGACY: END (genérico)
  // ========================================
  end: {
    node_type: "end",
    is_terminal: true,
    allowed_output_types: [],
    min_outputs: 0,
    max_outputs: 0,
    requires_labels: false,
    requires_children: false,
    supports_retry_by_impact: [],
    recommended_error_handling: {
      pattern: "none",
      for_impact_levels: [],
    },
    description: "Fim genérico (legacy). NÃO pode ter saídas.",
  },

  // ========================================
  // LEGACY: SUBFLOW
  // ========================================
  subflow: {
    node_type: "subflow",
    is_terminal: false,
    allowed_output_types: ["success", "failure", "default"],
    min_outputs: 1,
    max_outputs: 2,
    requires_labels: false,
    requires_children: false,
    supports_retry_by_impact: [],
    recommended_error_handling: {
      pattern: "none",
      for_impact_levels: [],
    },
    description: "Subfluxo. Pode ter 1-2 saídas (success/failure).",
  },
};

// ========================================
// FUNÇÕES UTILITÁRIAS
// ========================================

/**
 * Obter regra de gramática para um tipo de nó
 */
export function getNodeGrammar(nodeType: string): NodeGrammarRule {
  return NODE_GRAMMAR_V3[nodeType] || NODE_GRAMMAR_V3["action"];
}

/**
 * Verificar se um tipo de nó é terminal
 */
export function isTerminalNode(nodeType: string): boolean {
  const grammar = getNodeGrammar(nodeType);
  return grammar.is_terminal;
}

/**
 * Verificar se um nó precisa de error handling baseado no tipo e impact
 */
export function needsErrorHandling(nodeType: string, impactLevel: ImpactLevel): boolean {
  const grammar = getNodeGrammar(nodeType);
  return grammar.recommended_error_handling.for_impact_levels.includes(impactLevel);
}

/**
 * Obter padrão de error handling recomendado
 */
export function getRecommendedErrorPattern(
  nodeType: string, 
  impactLevel: ImpactLevel
): NodeGrammarRule["recommended_error_handling"]["pattern"] {
  const grammar = getNodeGrammar(nodeType);
  if (grammar.recommended_error_handling.for_impact_levels.includes(impactLevel)) {
    return grammar.recommended_error_handling.pattern;
  }
  return "none";
}

/**
 * Validar quantidade de saídas para um tipo de nó
 */
export function validateOutputCount(nodeType: string, outputCount: number): {
  valid: boolean;
  message?: string;
} {
  const grammar = getNodeGrammar(nodeType);
  
  if (grammar.is_terminal && outputCount > 0) {
    return {
      valid: false,
      message: `Node type "${nodeType}" is terminal and cannot have outputs`,
    };
  }
  
  if (outputCount < grammar.min_outputs) {
    return {
      valid: false,
      message: `Node type "${nodeType}" requires at least ${grammar.min_outputs} output(s), got ${outputCount}`,
    };
  }
  
  if (grammar.max_outputs !== -1 && outputCount > grammar.max_outputs) {
    return {
      valid: false,
      message: `Node type "${nodeType}" allows at most ${grammar.max_outputs} output(s), got ${outputCount}`,
    };
  }
  
  return { valid: true };
}

/**
 * Validar tipo de conexão para um tipo de nó
 */
export function validateConnectionType(
  nodeType: string, 
  connectionType: ConnectionTypeV3
): boolean {
  const grammar = getNodeGrammar(nodeType);
  return grammar.allowed_output_types.includes(connectionType);
}

// ========================================
// TEMPLATES DE ERROR HANDLING
// ========================================

export interface ErrorHandlingTemplate {
  /** ID do template */
  template_id: string;
  /** Padrão */
  pattern: NodeGrammarRule["recommended_error_handling"]["pattern"];
  /** Nós a serem inseridos */
  nodes_to_insert: Array<{
    id_suffix: string;
    type: string;
    title_template: string;
    description_template: string;
  }>;
  /** Conexões a serem criadas */
  connections_to_create: Array<{
    from_suffix: string;
    to_suffix: string;
    connection_type: ConnectionTypeV3;
    label?: string;
  }>;
}

export const ERROR_HANDLING_TEMPLATES: Record<string, ErrorHandlingTemplate> = {
  feedback_error_loopback: {
    template_id: "feedback_error_loopback",
    pattern: "feedback_error_loopback",
    nodes_to_insert: [
      {
        id_suffix: "_error",
        type: "feedback_error",
        title_template: "Erro: {original_title}",
        description_template: "Ocorreu um erro em {original_title}. Tente novamente.",
      },
    ],
    connections_to_create: [
      { from_suffix: "", to_suffix: "_error", connection_type: "failure", label: "Erro" },
      { from_suffix: "_error", to_suffix: "", connection_type: "loopback", label: "Tentar novamente" },
    ],
  },
  
  feedback_error_retry: {
    template_id: "feedback_error_retry",
    pattern: "feedback_error_retry",
    nodes_to_insert: [
      {
        id_suffix: "_error",
        type: "feedback_error",
        title_template: "Erro: {original_title}",
        description_template: "Ocorreu um erro em {original_title}.",
      },
      {
        id_suffix: "_retry",
        type: "retry",
        title_template: "Tentar novamente",
        description_template: "Retry para {original_title}",
      },
    ],
    connections_to_create: [
      { from_suffix: "", to_suffix: "_error", connection_type: "failure", label: "Erro" },
      { from_suffix: "_error", to_suffix: "_retry", connection_type: "default" },
      { from_suffix: "_retry", to_suffix: "", connection_type: "loopback", label: "Retry" },
    ],
  },
  
  feedback_error_end: {
    template_id: "feedback_error_end",
    pattern: "feedback_error_end",
    nodes_to_insert: [
      {
        id_suffix: "_error",
        type: "feedback_error",
        title_template: "Erro: {original_title}",
        description_template: "Ocorreu um erro fatal em {original_title}.",
      },
      {
        id_suffix: "_end_error",
        type: "end_error",
        title_template: "Fluxo interrompido",
        description_template: "O fluxo foi interrompido devido a um erro.",
      },
    ],
    connections_to_create: [
      { from_suffix: "", to_suffix: "_error", connection_type: "failure", label: "Erro" },
      { from_suffix: "_error", to_suffix: "_end_error", connection_type: "default" },
    ],
  },
};

/**
 * Obter template de error handling
 */
export function getErrorHandlingTemplate(
  pattern: NodeGrammarRule["recommended_error_handling"]["pattern"]
): ErrorHandlingTemplate | undefined {
  return ERROR_HANDLING_TEMPLATES[pattern];
}




