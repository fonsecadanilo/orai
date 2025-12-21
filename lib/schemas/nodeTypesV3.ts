/**
 * Schema de Tipos de Nós v3.1 - Semântica Expandida
 * 
 * Define todos os tipos de nós, subnós e atributos adicionais
 * para a nova arquitetura de User Flows da Oria.
 */

import { z } from "zod";

// ========================================
// TIPOS PRINCIPAIS DE NÓS
// ========================================

/**
 * Tipos principais de nós disponíveis
 */
export const MainNodeTypeSchema = z.enum([
  // === Interação com Usuário ===
  "form",                    // Formulário para entrada de dados
  "choice",                  // Escolha entre opções
  "action",                  // Ação executada pelo sistema
  
  // === Feedback ===
  "feedback_success",        // Feedback positivo
  "feedback_error",          // Feedback de erro
  
  // === Condições ===
  "condition",               // Condição/decisão com bifurcação
  
  // === Término ===
  "end_success",             // Término bem-sucedido
  "end_error",               // Término com erro
  "end_neutral",             // Término neutro (cancelamento, timeout)
  
  // === Recuperação ===
  "retry",                   // Tentativa novamente
  "fallback",                // Caminho alternativo de recuperação
  "loopback",                // Retorno a passo anterior
  
  // === Ações Especiais ===
  "background_action",       // Ação em segundo plano (não bloqueia UI)
  "delayed_action",          // Ação com delay (ex: enviar email)
  "configuration_matrix",    // Matriz de configuração (múltiplas opções)
  "insight_branch",          // Ramificação baseada em dados/analytics
  
  // === Legacy (compatibilidade) ===
  "trigger",                 // Gatilho inicial (v2)
  "end",                     // Término genérico (v2)
  "subflow",                 // Referência a outro fluxo
  "field_group",             // Grupo de campos (v2)
  "text",                    // Texto/comentário (v2)
  "note",                    // Alias para text
]);

export type MainNodeType = z.infer<typeof MainNodeTypeSchema>;

// ========================================
// TIPOS DE SUBNÓS
// ========================================

/**
 * Tipos de subnós (filhos de nós principais)
 */
export const SubNodeTypeSchema = z.enum([
  "input_field",             // Campo de entrada individual
  "modal_step",              // Passo dentro de um modal
  "field_group",             // Grupo de campos relacionados
  "validation_rule",         // Regra de validação
  "interactive_component",   // Componente interativo (slider, toggle, etc.)
  "option_choice",           // Opção dentro de um choice
  "button",                  // Botão de ação
  "condition_branch",        // Ramo de uma condição
]);

export type SubNodeType = z.infer<typeof SubNodeTypeSchema>;

// ========================================
// ATRIBUTOS ADICIONAIS
// ========================================

/**
 * Nível de impacto do nó
 */
export const ImpactLevelSchema = z.enum([
  "low",      // Baixo impacto (informativo, opcional)
  "medium",   // Médio impacto (importante mas não crítico)
  "high",     // Alto impacto (crítico para o fluxo)
]);

export type ImpactLevel = z.infer<typeof ImpactLevelSchema>;

/**
 * Escopo de papel/role
 */
export const RoleScopeSchema = z.enum([
  "admin",          // Administrador
  "viewer",         // Visualizador (apenas leitura)
  "team_owner",     // Dono do time/organização
  "member",         // Membro comum
  "guest",          // Convidado (acesso limitado)
  "super_admin",    // Super administrador
  "billing_admin",  // Administrador de cobrança
  "developer",      // Desenvolvedor
  "custom",         // Papel customizado
]);

export type RoleScope = z.infer<typeof RoleScopeSchema>;

/**
 * Categoria visual do nó
 */
export const NodeVisualCategorySchema = z.enum([
  "primary",      // Caminho principal (happy path)
  "error",        // Caminho de erro
  "alternative",  // Caminho alternativo
  "recovery",     // Caminho de recuperação
  "optional",     // Passo opcional
]);

export type NodeVisualCategory = z.infer<typeof NodeVisualCategorySchema>;

// ========================================
// CONFIGURAÇÕES VISUAIS POR TIPO
// ========================================

export interface NodeVisualConfig {
  icon: string;
  color: string;
  bgColor: string;
  borderColor: string;
  label: string;
  description: string;
  allowedChildren: SubNodeType[];
  supportsInputs: boolean;
  supportsOutputs: number; // 0 = terminal, 1 = sequencial, 2 = bifurcação, -1 = múltiplo
}

export const NODE_VISUAL_CONFIGS: Record<MainNodeType, NodeVisualConfig> = {
  // User Interaction
  form: {
    icon: "FileInput",
    color: "#3b82f6",
    bgColor: "#eff6ff",
    borderColor: "#3b82f6",
    label: "Form",
    description: "Collects user data through input fields",
    allowedChildren: ["input_field", "field_group", "validation_rule", "button"],
    supportsInputs: true,
    supportsOutputs: 1,
  },
  choice: {
    icon: "ListChecks",
    color: "#8b5cf6",
    bgColor: "#f5f3ff",
    borderColor: "#8b5cf6",
    label: "Choice",
    description: "Presents options for user selection",
    allowedChildren: ["option_choice", "button"],
    supportsInputs: false,
    supportsOutputs: -1,
  },
  action: {
    icon: "Zap",
    color: "#f59e0b",
    bgColor: "#fffbeb",
    borderColor: "#f59e0b",
    label: "Action",
    description: "Executes a system action",
    allowedChildren: [],
    supportsInputs: false,
    supportsOutputs: 1,
  },

  // Feedback
  feedback_success: {
    icon: "CheckCircle",
    color: "#22c55e",
    bgColor: "#f0fdf4",
    borderColor: "#22c55e",
    label: "Success Feedback",
    description: "Displays success message to user",
    allowedChildren: ["button"],
    supportsInputs: false,
    supportsOutputs: 1,
  },
  feedback_error: {
    icon: "XCircle",
    color: "#ef4444",
    bgColor: "#fef2f2",
    borderColor: "#ef4444",
    label: "Error Feedback",
    description: "Displays error message to user",
    allowedChildren: ["button"],
    supportsInputs: false,
    supportsOutputs: 1,
  },

  // Conditions
  condition: {
    icon: "GitBranch",
    color: "#6366f1",
    bgColor: "#eef2ff",
    borderColor: "#6366f1",
    label: "Condition",
    description: "Branching based on a condition",
    allowedChildren: ["condition_branch"],
    supportsInputs: false,
    supportsOutputs: 2,
  },

  // Termination
  end_success: {
    icon: "CheckCircle2",
    color: "#22c55e",
    bgColor: "#dcfce7",
    borderColor: "#22c55e",
    label: "End (Success)",
    description: "Successful flow completion",
    allowedChildren: [],
    supportsInputs: false,
    supportsOutputs: 0,
  },
  end_error: {
    icon: "XOctagon",
    color: "#ef4444",
    bgColor: "#fee2e2",
    borderColor: "#ef4444",
    label: "End (Error)",
    description: "Flow termination with error",
    allowedChildren: [],
    supportsInputs: false,
    supportsOutputs: 0,
  },
  end_neutral: {
    icon: "Circle",
    color: "#6b7280",
    bgColor: "#f3f4f6",
    borderColor: "#6b7280",
    label: "End (Neutral)",
    description: "Neutral termination (cancel, timeout)",
    allowedChildren: [],
    supportsInputs: false,
    supportsOutputs: 0,
  },

  // Recovery
  retry: {
    icon: "RotateCcw",
    color: "#f97316",
    bgColor: "#fff7ed",
    borderColor: "#f97316",
    label: "Retry",
    description: "Allows user to retry the action",
    allowedChildren: [],
    supportsInputs: false,
    supportsOutputs: 1,
  },
  fallback: {
    icon: "ArrowLeftRight",
    color: "#eab308",
    bgColor: "#fefce8",
    borderColor: "#eab308",
    label: "Fallback",
    description: "Alternative recovery path",
    allowedChildren: [],
    supportsInputs: false,
    supportsOutputs: 1,
  },
  loopback: {
    icon: "Undo2",
    color: "#14b8a6",
    bgColor: "#f0fdfa",
    borderColor: "#14b8a6",
    label: "Loopback",
    description: "Returns to a previous step",
    allowedChildren: [],
    supportsInputs: false,
    supportsOutputs: 1,
  },

  // Special Actions
  background_action: {
    icon: "Server",
    color: "#64748b",
    bgColor: "#f1f5f9",
    borderColor: "#64748b",
    label: "Background Action",
    description: "Action that runs in background",
    allowedChildren: [],
    supportsInputs: false,
    supportsOutputs: 1,
  },
  delayed_action: {
    icon: "Clock",
    color: "#06b6d4",
    bgColor: "#ecfeff",
    borderColor: "#06b6d4",
    label: "Delayed Action",
    description: "Action executed with delay",
    allowedChildren: [],
    supportsInputs: false,
    supportsOutputs: 1,
  },
  configuration_matrix: {
    icon: "Table2",
    color: "#a855f7",
    bgColor: "#faf5ff",
    borderColor: "#a855f7",
    label: "Configuration Matrix",
    description: "Multiple configuration options",
    allowedChildren: ["option_choice", "input_field"],
    supportsInputs: true,
    supportsOutputs: 1,
  },
  insight_branch: {
    icon: "Lightbulb",
    color: "#ec4899",
    bgColor: "#fdf2f8",
    borderColor: "#ec4899",
    label: "Insight Branch",
    description: "Branching based on analytics/data",
    allowedChildren: ["condition_branch"],
    supportsInputs: false,
    supportsOutputs: -1,
  },

  // Legacy
  trigger: {
    icon: "Play",
    color: "#10b981",
    bgColor: "#d1fae5",
    borderColor: "#10b981",
    label: "Trigger",
    description: "Flow entry point",
    allowedChildren: [],
    supportsInputs: false,
    supportsOutputs: 1,
  },
  end: {
    icon: "Square",
    color: "#6b7280",
    bgColor: "#f3f4f6",
    borderColor: "#6b7280",
    label: "End",
    description: "Flow termination",
    allowedChildren: [],
    supportsInputs: false,
    supportsOutputs: 0,
  },
  subflow: {
    icon: "Workflow",
    color: "#0ea5e9",
    bgColor: "#e0f2fe",
    borderColor: "#0ea5e9",
    label: "Subflow",
    description: "Reference to another flow",
    allowedChildren: [],
    supportsInputs: false,
    supportsOutputs: 1,
  },
  field_group: {
    icon: "FormInput",
    color: "#3b82f6",
    bgColor: "#dbeafe",
    borderColor: "#3b82f6",
    label: "Field Group",
    description: "Set of related fields",
    allowedChildren: ["input_field"],
    supportsInputs: true,
    supportsOutputs: 1,
  },
  text: {
    icon: "Type",
    color: "#9ca3af",
    bgColor: "#f9fafb",
    borderColor: "#9ca3af",
    label: "Text",
    description: "Comment or note",
    allowedChildren: [],
    supportsInputs: false,
    supportsOutputs: 0,
  },
  note: {
    icon: "StickyNote",
    color: "#fbbf24",
    bgColor: "#fef3c7",
    borderColor: "#fbbf24",
    label: "Note",
    description: "Post-it with observations",
    allowedChildren: [],
    supportsInputs: false,
    supportsOutputs: 0,
  },
};

// ========================================
// SCHEMA DO NÓ COMPLETO v3
// ========================================

/**
 * Schema de input de formulário
 */
export const InputFieldSchema = z.object({
  field_id: z.string(),
  field_name: z.string(),
  field_type: z.enum([
    "text", "email", "password", "number", "tel", "date", "datetime",
    "select", "checkbox", "radio", "textarea", "file", "hidden"
  ]),
  label: z.string(),
  placeholder: z.string().optional(),
  required: z.boolean().default(false),
  validation_rules: z.array(z.string()).optional(),
  tooltip: z.string().optional(),
  default_value: z.string().optional(),
  options: z.array(z.object({
    value: z.string(),
    label: z.string(),
  })).optional(),
});

export type InputField = z.infer<typeof InputFieldSchema>;

/**
 * Schema de ação/botão
 */
export const NodeActionSchema = z.object({
  action_id: z.string(),
  label: z.string(),
  action_type: z.enum(["primary", "secondary", "danger", "link", "ghost"]),
  leads_to: z.string().optional(),
  icon: z.string().optional(),
  disabled_condition: z.string().optional(),
});

export type NodeAction = z.infer<typeof NodeActionSchema>;

/**
 * Schema de mensagem de feedback
 */
export const FeedbackMessageSchema = z.object({
  trigger: z.enum(["success", "error", "validation", "info", "warning"]),
  message: z.string(),
  duration_ms: z.number().optional(),
  action: NodeActionSchema.optional(),
});

export type FeedbackMessage = z.infer<typeof FeedbackMessageSchema>;

/**
 * Schema de subnó
 */
export const SubNodeSchema = z.object({
  subnode_id: z.string(),
  subnode_type: SubNodeTypeSchema,
  parent_node_id: z.string(),
  order_index: z.number(),
  title: z.string().optional(),
  content: z.record(z.unknown()),
  is_collapsed: z.boolean().default(false),
});

export type SubNode = z.infer<typeof SubNodeSchema>;

/**
 * Schema de informação de reuso
 */
export const ReuseInfoSchema = z.object({
  is_reused: z.boolean(),
  reuse_type: z.enum(["reference", "clone"]).optional(),
  source_flow_id: z.string().optional(),
  primary_flow_id: z.string(),
  referenced_in_flows: z.array(z.string()),
  subpages: z.array(z.string()).optional(),
  last_synced_at: z.string().optional(),
});

export type ReuseInfo = z.infer<typeof ReuseInfoSchema>;

/**
 * Schema completo do nó v3
 */
export const FlowNodeV3Schema = z.object({
  // Identificação
  id: z.string(),
  db_id: z.number().optional(),
  flow_id: z.string(),
  
  // Tipo e classificação
  type: MainNodeTypeSchema,
  subtype: SubNodeTypeSchema.optional(),
  
  // Conteúdo
  title: z.string(),
  description: z.string().optional(),
  content: z.record(z.unknown()).optional(),
  
  // Posicionamento
  position_x: z.number().default(0),
  position_y: z.number().default(0),
  order_index: z.number().default(0),
  column: NodeVisualCategorySchema.default("primary"),
  
  // Atributos v3
  impact_level: ImpactLevelSchema.default("medium"),
  role_scope: RoleScopeSchema.optional(),
  group_label: z.string().optional(),
  
  // Conexões
  next_on_success: z.string().nullable().optional(),
  next_on_failure: z.string().nullable().optional(),
  fallback_node_id: z.string().optional(),
  retry_node_id: z.string().optional(),
  
  // UX
  inputs: z.array(InputFieldSchema).optional(),
  actions: z.array(NodeActionSchema).optional(),
  feedback_messages: z.array(FeedbackMessageSchema).optional(),
  
  // Hierarquia
  parent_node_id: z.string().optional(),
  children: z.array(SubNodeSchema).optional(),
  
  // Reuso
  reuse_info: ReuseInfoSchema.optional(),
  
  // Contexto
  page_key: z.string().optional(),
  user_intent: z.string().optional(),
  system_behavior: z.string().optional(),
  ux_recommendation: z.string().optional(),
  error_cases: z.array(z.string()).optional(),
  allows_retry: z.boolean().optional(),
  allows_cancel: z.boolean().optional(),
  
  // Arquétipos
  archetypes_applied: z.array(z.string()).optional(),
  
  // Timestamps
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});

export type FlowNodeV3 = z.infer<typeof FlowNodeV3Schema>;

// ========================================
// FUNÇÕES UTILITÁRIAS
// ========================================

/**
 * Retorna a configuração visual de um tipo de nó
 */
export function getNodeConfig(type: MainNodeType): NodeVisualConfig {
  return NODE_VISUAL_CONFIGS[type];
}

/**
 * Verifica se um tipo de nó é terminal (sem saídas)
 */
export function isTerminalNode(type: MainNodeType): boolean {
  return NODE_VISUAL_CONFIGS[type].supportsOutputs === 0;
}

/**
 * Verifica se um tipo de nó suporta bifurcação
 */
export function isBranchingNode(type: MainNodeType): boolean {
  return NODE_VISUAL_CONFIGS[type].supportsOutputs >= 2 || 
         NODE_VISUAL_CONFIGS[type].supportsOutputs === -1;
}

/**
 * Verifica se um tipo de nó suporta inputs
 */
export function supportsInputs(type: MainNodeType): boolean {
  return NODE_VISUAL_CONFIGS[type].supportsInputs;
}

/**
 * Retorna os tipos de subnós permitidos para um tipo de nó
 */
export function getAllowedChildren(type: MainNodeType): SubNodeType[] {
  return NODE_VISUAL_CONFIGS[type].allowedChildren;
}

/**
 * Converte tipo v2 para v3
 */
export function convertV2ToV3NodeType(v2Type: string): MainNodeType {
  const mapping: Record<string, MainNodeType> = {
    trigger: "trigger",
    action: "action",
    condition: "condition",
    end: "end",
    subflow: "subflow",
    field_group: "form",
    text: "text",
    note: "note",
  };
  return mapping[v2Type] || "action";
}

/**
 * Converte tipo v3 para tipo do banco de dados
 */
export function convertV3ToDBType(v3Type: MainNodeType): string {
  const mapping: Record<MainNodeType, string> = {
    form: "action",
    choice: "condition",
    action: "action",
    feedback_success: "action",
    feedback_error: "action",
    condition: "condition",
    end_success: "end",
    end_error: "end",
    end_neutral: "end",
    retry: "action",
    fallback: "action",
    loopback: "action",
    background_action: "action",
    delayed_action: "action",
    configuration_matrix: "action",
    insight_branch: "condition",
    trigger: "trigger",
    end: "end",
    subflow: "subflow",
    field_group: "field_group",
    text: "note",
    note: "note",
  };
  return mapping[v3Type] || "action";
}

/**
 * Valida um nó v3
 */
export function validateNodeV3(node: unknown): {
  success: boolean;
  data?: FlowNodeV3;
  errors?: z.ZodError;
} {
  const result = FlowNodeV3Schema.safeParse(node);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, errors: result.error };
}


