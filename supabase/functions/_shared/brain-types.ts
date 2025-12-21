/**
 * Brain Types for Edge Functions (Deno)
 * 
 * Tipos compartilhados entre todas as Edge Functions do Brain.
 * Espelha lib/brain/types.ts para uso em Deno.
 */

// ========================================
// ENUMS E CONSTANTES
// ========================================

export type BrainMode = "PLAN" | "CONSULT" | "BATCH" | "LONG_CONTEXT";

export type BrainModel = 
  | "gpt-5.2"
  | "gpt-5.2-pro"
  | "gpt-5-mini"
  | "gpt-5-nano"
  | "gpt-4.1"
  | "gpt-4.1-mini"
  | "gpt-4.1-nano"
  | "gpt-4o"
  | "gpt-4o-mini"
  | "o3"
  | "o3-mini"
  | "o1"
  | "o1-mini";

export type ReasoningEffort = "minimal" | "low" | "medium" | "high";
export type TextVerbosity = "low" | "medium" | "high";
export type RiskLevel = "low" | "medium" | "high";

export type BrainActionType = 
  | "upsert_rule"
  | "upsert_spec"
  | "upsert_flow"
  | "update_registry"
  | "create_persona"
  | "update_product_profile"
  | "create_migration"
  | "execute_sql"
  | "notify_user"
  // Plan actions
  | "upsert_brain_flow_plan"
  | "set_plan_status";

// ========================================
// CONTEXTO
// ========================================

export interface ContextStats {
  total_tokens_estimate: number;
  business_rules_count: number;
  flow_specs_count: number;
  flow_registry_count: number;
  personas_count: number;
  thread_messages_count: number;
  is_large_context: boolean;
  largest_item_tokens: number;
}

export interface EditorContext {
  selected_node_ids?: string[];
  viewport?: { x: number; y: number; zoom: number };
  current_flow_id?: string;
  editor_mode?: "view" | "edit" | "comment";
}

export interface ProjectContext {
  project_id: number;
  product_profile: ProductProfile | null;
  personas: Persona[];
  business_rules: BusinessRule[];
  flow_registry: FlowRegistryItem[];
  flow_specs: FlowSpec[];
}

export interface ProductProfile {
  id: number;
  project_id: number;
  product_name: string;
  product_type: string;
  industry?: string;
  business_model?: string;
  main_value_proposition?: string;
  key_features?: string[];
  target_audience?: string;
  maturity_stage?: string;
  created_at: string;
  updated_at: string;
}

export interface Persona {
  id: number;
  project_id: number;
  role_id: string;
  role_name: string;
  role_scope: string;
  permissions: string[];
  restrictions: string[];
  typical_goals: string[];
  pain_points: string[];
  created_at: string;
}

export interface BusinessRule {
  id: number;
  project_id: number;
  rule_name: string;
  rule_type: string;
  description: string;
  conditions: unknown;
  actions: unknown;
  status: "draft" | "approved" | "deprecated";
  version: number;
  created_at: string;
  updated_at: string;
}

export interface FlowRegistryItem {
  id: number;
  project_id: number;
  flow_id: string;
  flow_name: string;
  flow_type: string;
  entry_node_id: string;
  exit_node_ids: string[];
  node_count: number;
  created_at: string;
  updated_at: string;
}

export interface FlowSpec {
  id: number;
  project_id: number;
  flow_id: string;
  spec_name: string;
  spec_content: unknown;
  version: number;
  is_latest: boolean;
  created_at: string;
}

// ========================================
// ROTEAMENTO
// ========================================

export interface RouteResult {
  mode: BrainMode;
  model: BrainModel;
  was_uncertain: boolean;
  used_classifier: boolean;
  complexity: number;
  risk_level: RiskLevel;
  requires_structured_output: boolean;
  needs_tool_use: boolean;
  routing_rules_applied: string[];
  routing_reason: string;
}

export interface ClassifierResult {
  mode: BrainMode;
  complexity: number;
  requires_structured_output: boolean;
  needs_tool_use: boolean;
  risk_level: RiskLevel;
  confidence: number;
}

export interface ModelConfig {
  model: BrainModel;
  reasoning_effort: ReasoningEffort;
  text_verbosity: TextVerbosity;
  max_output_tokens: number;
  json_schema_name?: string;
  temperature: number;
  fallback_chain: BrainModel[];
}

// ========================================
// MENSAGENS E THREADS
// ========================================

export interface BrainMessage {
  id: string;
  thread_id: string;
  project_id: number;
  role: "user" | "assistant" | "system";
  content: string;
  structured_output?: BrainOutput | null;
  metadata: BrainMessageMetadata;
  created_at: string;
}

export interface BrainMessageMetadata {
  mode: BrainMode;
  model: BrainModel;
  reasoning_effort: ReasoningEffort;
  text_verbosity: TextVerbosity;
  routing_reason: string;
  model_fallback_chain?: BrainModel[];
  latency_ms: number;
  time_to_first_token_ms?: number;
  input_tokens: number;
  output_tokens: number;
  reasoning_tokens?: number;
  used_classifier: boolean;
  was_uncertain: boolean;
}

export interface BrainThread {
  id: string;
  project_id: number;
  user_id: number;
  title?: string;
  status: "active" | "archived";
  messages_count: number;
  last_message_at: string;
  created_at: string;
  updated_at: string;
}

// ========================================
// OUTPUT
// ========================================

export interface BrainOutput {
  assistant_response_md: string;
  actions: BrainAction[];
  reasoning_summary?: string;
  warnings?: string[];
  follow_up_suggestions?: string[];
}

export interface BrainAction {
  action_id: string;
  action_type: BrainActionType;
  payload: unknown;
  description: string;
  reversible: boolean;
  priority: number;
}

export interface BrainActionResult {
  action_id: string;
  success: boolean;
  result?: unknown;
  error?: string;
}

// ========================================
// CANVAS
// ========================================

export interface BrainCanvasBlock {
  id: string;
  project_id: number;
  thread_id: string;
  block_type: "brain_chat";
  position_x: number;
  position_y: number;
  width: number;
  height: number;
  streaming: boolean;
  content: string;
  mode?: BrainMode;
  model?: BrainModel;
  created_at: string;
  updated_at: string;
}

// ========================================
// REQUESTS/RESPONSES
// ========================================

export interface BrainThreadCreateRequest {
  project_id: number;
  user_id: number;
  title?: string;
  initial_message?: string;
}

export interface BrainThreadCreateResponse {
  success: boolean;
  thread: BrainThread;
  message: string;
}

export interface BrainMessageSendRequest {
  project_id: number;
  thread_id?: string;
  user_prompt: string;
  editor_context?: EditorContext;
  force_mode?: BrainMode;
  force_model?: BrainModel;
}

export interface BrainMessageSendResponse {
  success: boolean;
  thread_id: string;
  message: BrainMessage;
  output?: BrainOutput;
  actions_applied?: BrainActionResult[];
  canvas_block_id?: string;
  error?: string;
}

export interface BrainThreadGetRequest {
  thread_id: string;
  include_messages?: boolean;
  messages_limit?: number;
}

export interface BrainThreadGetResponse {
  success: boolean;
  thread: BrainThread;
  messages?: BrainMessage[];
  message: string;
}

export interface BrainActionsApplyRequest {
  project_id: number;
  thread_id: string;
  message_id: string;
  action_ids?: string[];
}

export interface BrainActionsApplyResponse {
  success: boolean;
  results: BrainActionResult[];
  message: string;
}

// ========================================
// STREAMING
// ========================================

export type BrainStreamEvent = 
  | BrainStreamStartEvent
  | BrainStreamDeltaEvent
  | BrainStreamMetadataEvent
  | BrainStreamCompleteEvent
  | BrainStreamActionsEvent
  | BrainStreamErrorEvent;

export interface BrainStreamStartEvent {
  type: "start";
  thread_id: string;
  message_id: string;
  mode: BrainMode;
  model: BrainModel;
  canvas_block_id?: string;
}

export interface BrainStreamDeltaEvent {
  type: "delta";
  content: string;
  index: number;
}

export interface BrainStreamMetadataEvent {
  type: "metadata";
  metadata: Partial<BrainMessageMetadata>;
}

export interface BrainStreamCompleteEvent {
  type: "complete";
  message: BrainMessage;
  output?: BrainOutput;
}

export interface BrainStreamActionsEvent {
  type: "actions";
  actions: BrainAction[];
  results: BrainActionResult[];
}

export interface BrainStreamErrorEvent {
  type: "error";
  error: string;
  failed_model?: BrainModel;
  fallback_model?: BrainModel;
}


