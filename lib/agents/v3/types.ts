/**
 * Tipos para a Nova Arquitetura v3.1 - Cadeia de 6 Agentes
 * 
 * Pipeline:
 * 1. Product & Role Mapper → Contexto de produto e papéis
 * 2. Flow Synthesizer → Síntese do fluxo principal
 * 3. Archetype Modeler → Modelagem de arquétipos e padrões
 * 4. Flow Critic → Crítica e validação do fluxo
 * 5. UX Block Composer → Composição de blocos UX adaptativos
 * 6. Flow Connector & Reusability Tracker → Conexões e rastreamento de reuso
 */

import { z } from "zod";

// ========================================
// TIPOS DE NÓS EXPANDIDOS v3.1
// ========================================

/**
 * Tipos principais de nós
 */
export const NodeTypeV3Schema = z.enum([
  // Tipos básicos
  "form",
  "choice",
  "action",
  "feedback_success",
  "feedback_error",
  "condition",
  // Tipos de término
  "end_success",
  "end_error",
  "end_neutral",
  // Tipos de recuperação
  "retry",
  "fallback",
  "loopback",
  // Tipos avançados
  "background_action",
  "delayed_action",
  "configuration_matrix",
  "insight_branch",
  // Legacy (compatibilidade)
  "trigger",
  "end",
  "subflow",
]);

export type NodeTypeV3 = z.infer<typeof NodeTypeV3Schema>;

/**
 * Tipos de subnós
 */
export const SubNodeTypeSchema = z.enum([
  "input_field",
  "modal_step",
  "field_group",
  "validation_rule",
  "interactive_component",
  "option_choice",
  "button",
  "condition_branch",
]);

export type SubNodeType = z.infer<typeof SubNodeTypeSchema>;

/**
 * Nível de impacto do nó
 */
export const ImpactLevelSchema = z.enum(["low", "medium", "high"]);
export type ImpactLevel = z.infer<typeof ImpactLevelSchema>;

/**
 * Escopo de papel/role
 */
export const RoleScopeSchema = z.enum([
  "admin",
  "viewer",
  "team_owner",
  "member",
  "guest",
  "super_admin",
  "billing_admin",
  "developer",
  "custom",
]);
export type RoleScope = z.infer<typeof RoleScopeSchema>;

// ========================================
// AGENT 1: PRODUCT & ROLE MAPPER
// ========================================

export interface ProductContext {
  product_name: string;
  product_type: "saas" | "marketplace" | "e-commerce" | "fintech" | "healthtech" | "edtech" | "other";
  business_model: "b2b" | "b2c" | "b2b2c" | "marketplace";
  main_value_proposition: string;
  key_features: string[];
  competitors?: string[];
  target_audience: string;
  maturity_stage: "mvp" | "growth" | "scale" | "mature";
}

export interface RoleDefinition {
  role_id: string;
  role_name: string;
  role_scope: RoleScope;
  permissions: string[];
  restrictions: string[];
  typical_goals: string[];
  pain_points: string[];
  journey_context?: string;
}

export interface ProductRoleMapperRequest {
  prompt: string;
  project_id: number;
  user_id: number;
  existing_context?: Partial<ProductContext>;
  existing_roles?: RoleDefinition[];
}

export interface ProductRoleMapperResponse {
  success: boolean;
  product_context: ProductContext;
  roles: RoleDefinition[];
  primary_role: string; // role_id do papel principal para este fluxo
  analysis: {
    detected_product_type: string;
    detected_roles_count: number;
    confidence_score: number;
    suggestions: string[];
  };
  message: string;
}

// ========================================
// AGENT 2: FLOW SYNTHESIZER
// ========================================

export interface FlowStep {
  step_id: string;
  step_order: number;
  title: string;
  description: string;
  step_type: NodeTypeV3;
  page_key?: string;
  role_required?: RoleScope;
  preconditions?: string[];
  postconditions?: string[];
  expected_duration_seconds?: number;
  is_critical: boolean;
  can_be_skipped: boolean;
}

export interface FlowDecision {
  decision_id: string;
  after_step_id: string;
  question: string;
  options: {
    option_id: string;
    label: string;
    leads_to_step_id: string;
    is_default: boolean;
  }[];
}

export interface FlowFailurePoint {
  failure_id: string;
  at_step_id: string;
  failure_type: "validation" | "system" | "user_abort" | "timeout" | "external";
  description: string;
  recovery_strategy: "retry" | "fallback" | "abort" | "escalate";
  recovery_step_id?: string;
}

export interface SynthesizedFlow {
  flow_id: string;
  flow_name: string;
  flow_description: string;
  flow_category: "authentication" | "onboarding" | "checkout" | "crud" | "settings" | "notification" | "integration" | "other";
  primary_role: string;
  steps: FlowStep[];
  decisions: FlowDecision[];
  failure_points: FlowFailurePoint[];
  entry_step_id: string;
  exit_step_ids: string[];
  estimated_completion_time_seconds: number;
}

export interface FlowSynthesizerRequest {
  product_context: ProductContext;
  roles: RoleDefinition[];
  primary_role: string;
  user_prompt: string;
  project_id: number;
  user_id: number;
  existing_flows?: { flow_id: string; flow_name: string }[];
}

export interface FlowSynthesizerResponse {
  success: boolean;
  synthesized_flow: SynthesizedFlow;
  detected_patterns: string[];
  reuse_opportunities: {
    step_id: string;
    existing_flow_id?: string;
    similarity_score: number;
  }[];
  analysis: {
    total_steps: number;
    critical_steps: number;
    decision_points: number;
    failure_points: number;
    complexity_score: number;
  };
  message: string;
}

// ========================================
// AGENT 3: ARCHETYPE MODELER
// ========================================

export interface Archetype {
  archetype_id: string;
  archetype_name: string;
  archetype_category: "ux_pattern" | "business_rule" | "security" | "compliance" | "performance";
  description: string;
  applicable_contexts: string[];
  implementation_hints: string[];
}

export interface NodeArchetypeMapping {
  step_id: string;
  archetypes_applied: string[];
  archetype_parameters: Record<string, unknown>;
  confidence_score: number;
}

export interface ArchetypeModelRequest {
  synthesized_flow: SynthesizedFlow;
  product_context: ProductContext;
  available_archetypes?: Archetype[];
  project_id: number;
  user_id: number;
}

export interface ArchetypeModelResponse {
  success: boolean;
  archetype_mappings: NodeArchetypeMapping[];
  suggested_archetypes: Archetype[];
  patterns_detected: {
    pattern_name: string;
    pattern_type: string;
    affected_steps: string[];
    recommendation: string;
  }[];
  enriched_flow: SynthesizedFlow;
  analysis: {
    archetypes_applied: number;
    coverage_percentage: number;
    uncovered_steps: string[];
  };
  message: string;
}

// ========================================
// AGENT 4: FLOW CRITIC
// ========================================

export interface CritiqueFinding {
  finding_id: string;
  severity: "critical" | "major" | "minor" | "suggestion";
  category: "completeness" | "consistency" | "ux" | "security" | "performance" | "accessibility";
  affected_element_id: string;
  affected_element_type: "step" | "decision" | "failure_point" | "flow";
  title: string;
  description: string;
  recommendation: string;
  auto_fixable: boolean;
}

export interface FlowCriticRequest {
  synthesized_flow: SynthesizedFlow;
  archetype_mappings: NodeArchetypeMapping[];
  product_context: ProductContext;
  roles: RoleDefinition[];
  project_id: number;
  user_id: number;
  validation_level?: "basic" | "standard" | "strict";
}

export interface FlowCriticResponse {
  success: boolean;
  is_valid: boolean;
  integrity_score: number; // 0-100
  findings: CritiqueFinding[];
  auto_fixes_applied: {
    finding_id: string;
    fix_description: string;
  }[];
  improved_flow?: SynthesizedFlow;
  summary: {
    critical_count: number;
    major_count: number;
    minor_count: number;
    suggestion_count: number;
    auto_fixed_count: number;
  };
  message: string;
}

// ========================================
// AGENT 5: UX BLOCK COMPOSER (ADAPTATIVO)
// ========================================

export interface UXBlockInput {
  field_name: string;
  field_type: "text" | "email" | "password" | "number" | "tel" | "date" | "select" | "checkbox" | "radio" | "textarea" | "file";
  label: string;
  placeholder?: string;
  required: boolean;
  validation_rules: string[];
  tooltip?: string;
  default_value?: string;
  options?: { value: string; label: string }[];
}

export interface AdaptedUXBlockV3 {
  block_id: string;
  original_block_id?: string; // Se foi adaptado de um bloco da biblioteca
  adapted: boolean;
  block_type: NodeTypeV3;
  title: string;
  description?: string;
  // Contexto de adaptação
  adapted_for_persona?: string;
  adapted_for_page_key?: string;
  adapted_for_intent?: string;
  adapted_for_stage?: string;
  // Conteúdo do bloco
  input_fields: UXBlockInput[];
  actions: {
    action_id: string;
    label: string;
    action_type: "primary" | "secondary" | "danger" | "link";
    leads_to?: string;
  }[];
  feedback_messages?: {
    trigger: "success" | "error" | "validation" | "info";
    message: string;
    duration_ms?: number;
  }[];
  // Metadados
  impact_level: ImpactLevel;
  role_scope?: RoleScope;
  group_label?: string;
  // Subnós
  children?: SubNodeDefinition[];
}

export interface SubNodeDefinition {
  subnode_id: string;
  subnode_type: SubNodeType;
  parent_node_id: string;
  order_index: number;
  content: Record<string, unknown>;
}

export interface UXBlockComposerV3Request {
  synthesized_flow: SynthesizedFlow;
  archetype_mappings: NodeArchetypeMapping[];
  product_context: ProductContext;
  roles: RoleDefinition[];
  primary_role: string;
  project_id: number;
  user_id: number;
  library_blocks?: { id: string; semantic_type: string; intent: string }[];
}

export interface UXBlockComposerV3Response {
  success: boolean;
  composed_blocks: AdaptedUXBlockV3[];
  blocks_from_library: number;
  blocks_generated: number;
  adaptation_notes: {
    step_id: string;
    note: string;
  }[];
  message: string;
}

// ========================================
// AGENT 6: FLOW CONNECTOR & REUSABILITY TRACKER
// ========================================

export interface NodeConnection {
  connection_id: string;
  source_node_id: string;
  target_node_id: string;
  connection_type: "success" | "failure" | "conditional" | "default" | "fallback" | "retry";
  condition_expression?: string;
  label?: string;
  is_primary_path: boolean;
  order_priority: number;
}

export interface ReusabilityInfo {
  node_id: string;
  is_reused: boolean;
  reuse_type?: "reference" | "clone";
  source_flow_id?: string;
  primary_flow_id: string;
  referenced_in_flows: string[];
  subpages?: string[];
  last_synced_at?: string;
}

export interface FlowConnectorRequest {
  composed_blocks: AdaptedUXBlockV3[];
  synthesized_flow: SynthesizedFlow;
  existing_flows?: {
    flow_id: string;
    flow_name: string;
    nodes: { node_id: string; title: string; type: string }[];
  }[];
  project_id: number;
  user_id: number;
}

export interface FlowConnectorResponse {
  success: boolean;
  connections: NodeConnection[];
  reusability_info: ReusabilityInfo[];
  cross_references: {
    from_node_id: string;
    to_flow_id: string;
    to_node_id: string;
    reference_type: "calls" | "continues_from" | "shares_with";
  }[];
  dependency_graph: {
    nodes: string[];
    edges: { from: string; to: string }[];
  };
  message: string;
}

// ========================================
// TIPOS DE NÓ FINAL PARA PERSISTÊNCIA
// ========================================

export interface V3FlowNode {
  // Identificação
  id: string;
  db_id?: number;
  flow_id: string;
  // Tipo e classificação
  type: NodeTypeV3;
  subtype?: SubNodeType;
  // Conteúdo
  title: string;
  description?: string;
  content?: Record<string, unknown>;
  // Posicionamento (calculado pela engine)
  position_x?: number;
  position_y?: number;
  order_index?: number;
  column?: "main" | "error" | "alternative";
  // Atributos v3.1
  impact_level: ImpactLevel;
  role_scope?: RoleScope;
  group_label?: string;
  // Conexões
  next_on_success?: string;
  next_on_failure?: string;
  fallback_node_id?: string;
  retry_node_id?: string;
  // Reuso
  reused: boolean;
  source_flow_id?: string;
  primary_flow_id?: string;
  referenced_in?: string[];
  subpages?: string[];
  // UX
  inputs?: UXBlockInput[];
  actions?: AdaptedUXBlockV3["actions"];
  feedback_messages?: AdaptedUXBlockV3["feedback_messages"];
  // Hierarquia
  parent_node_id?: string;
  children?: V3FlowNode[];
  // Metadados
  page_key?: string;
  user_intent?: string;
  system_behavior?: string;
  ux_recommendation?: string;
  error_cases?: string[];
  allows_retry?: boolean;
  allows_cancel?: boolean;
  // Arquétipos
  archetypes_applied?: string[];
  // Timestamps
  created_at?: string;
  updated_at?: string;
}

// ========================================
// PIPELINE COMPLETA v3.1
// ========================================

export interface V3PipelineRequest {
  prompt: string;
  project_id: number;
  user_id: number;
  options?: {
    validation_level?: "basic" | "standard" | "strict";
    include_reuse_analysis?: boolean;
    include_archetype_modeling?: boolean;
    auto_fix_issues?: boolean;
  };
}

export interface V3PipelineResponse {
  success: boolean;
  // Resultados de cada agente
  product_role_result: ProductRoleMapperResponse;
  flow_synthesis_result: FlowSynthesizerResponse;
  archetype_model_result: ArchetypeModelResponse;
  flow_critic_result: FlowCriticResponse;
  ux_composer_result: UXBlockComposerV3Response;
  flow_connector_result: FlowConnectorResponse;
  // IDs finais
  flow_id: number;
  master_rule_id: number;
  sub_rule_ids: number[];
  // Nós finais
  final_nodes: V3FlowNode[];
  final_connections: NodeConnection[];
  // Resumo
  summary: {
    total_nodes: number;
    total_connections: number;
    integrity_score: number;
    reused_nodes_count: number;
    execution_time_ms: number;
    warnings: string[];
  };
  message: string;
}

// ========================================
// SCHEMAS ZOD PARA VALIDAÇÃO
// ========================================

export const V3FlowNodeSchema = z.object({
  id: z.string().min(1),
  db_id: z.number().optional(),
  flow_id: z.string(),
  type: NodeTypeV3Schema,
  subtype: SubNodeTypeSchema.optional(),
  title: z.string().min(1),
  description: z.string().optional(),
  content: z.record(z.unknown()).optional(),
  position_x: z.number().optional(),
  position_y: z.number().optional(),
  order_index: z.number().optional(),
  column: z.enum(["main", "error", "alternative"]).optional(),
  impact_level: ImpactLevelSchema,
  role_scope: RoleScopeSchema.optional(),
  group_label: z.string().optional(),
  next_on_success: z.string().optional(),
  next_on_failure: z.string().optional(),
  fallback_node_id: z.string().optional(),
  retry_node_id: z.string().optional(),
  reused: z.boolean(),
  source_flow_id: z.string().optional(),
  primary_flow_id: z.string().optional(),
  referenced_in: z.array(z.string()).optional(),
  subpages: z.array(z.string()).optional(),
  inputs: z.array(z.any()).optional(),
  actions: z.array(z.any()).optional(),
  feedback_messages: z.array(z.any()).optional(),
  parent_node_id: z.string().optional(),
  children: z.array(z.lazy(() => V3FlowNodeSchema)).optional(),
  page_key: z.string().optional(),
  user_intent: z.string().optional(),
  system_behavior: z.string().optional(),
  ux_recommendation: z.string().optional(),
  error_cases: z.array(z.string()).optional(),
  allows_retry: z.boolean().optional(),
  allows_cancel: z.boolean().optional(),
  archetypes_applied: z.array(z.string()).optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
}) as z.ZodType<V3FlowNode>;







