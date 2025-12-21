/**
 * Brain Router Schemas v1.0
 * 
 * Schemas Zod para validação de tipos do Brain Router.
 */

import { z } from "zod";

// ========================================
// ENUMS
// ========================================

export const BrainModeSchema = z.enum(["PLAN", "CONSULT", "BATCH", "LONG_CONTEXT"]);

export const BrainModelSchema = z.enum([
  "gpt-5.2",
  "gpt-5.2-pro",
  "gpt-5-mini",
  "gpt-5-nano",
  "gpt-4.1",
  "gpt-4.1-mini",
  "gpt-4.1-nano",
  // Fallbacks atuais
  "gpt-4o",
  "gpt-4o-mini",
  "o3",
  "o3-mini",
  "o1",
  "o1-mini",
]);

export const ReasoningEffortSchema = z.enum(["minimal", "low", "medium", "high"]);

export const TextVerbositySchema = z.enum(["low", "medium", "high"]);

export const RiskLevelSchema = z.enum(["low", "medium", "high"]);

export const BrainActionTypeSchema = z.enum([
  "upsert_rule",
  "upsert_spec",
  "upsert_flow",
  "update_registry",
  "create_persona",
  "update_product_profile",
  "create_migration",
  "execute_sql",
  "notify_user",
]);

// ========================================
// CONTEXTO
// ========================================

export const ContextStatsSchema = z.object({
  total_tokens_estimate: z.number(),
  business_rules_count: z.number(),
  flow_specs_count: z.number(),
  flow_registry_count: z.number(),
  personas_count: z.number(),
  thread_messages_count: z.number(),
  is_large_context: z.boolean(),
  largest_item_tokens: z.number(),
});

export const EditorContextSchema = z.object({
  selected_node_ids: z.array(z.string()).optional(),
  viewport: z.object({
    x: z.number(),
    y: z.number(),
    zoom: z.number(),
  }).optional(),
  current_flow_id: z.string().optional(),
  editor_mode: z.enum(["view", "edit", "comment"]).optional(),
});

// ========================================
// ROTEAMENTO
// ========================================

export const RouteResultSchema = z.object({
  mode: BrainModeSchema,
  model: BrainModelSchema,
  was_uncertain: z.boolean(),
  used_classifier: z.boolean(),
  complexity: z.number().min(0).max(1),
  risk_level: RiskLevelSchema,
  requires_structured_output: z.boolean(),
  needs_tool_use: z.boolean(),
  routing_rules_applied: z.array(z.string()),
  routing_reason: z.string(),
});

export const ClassifierResultSchema = z.object({
  mode: BrainModeSchema,
  complexity: z.number().min(0).max(1),
  requires_structured_output: z.boolean(),
  needs_tool_use: z.boolean(),
  risk_level: RiskLevelSchema,
  confidence: z.number().min(0).max(1),
});

// ========================================
// MODEL CONFIG
// ========================================

export const ModelConfigSchema = z.object({
  model: BrainModelSchema,
  reasoning_effort: ReasoningEffortSchema,
  text_verbosity: TextVerbositySchema,
  max_output_tokens: z.number().positive(),
  json_schema_name: z.string().optional(),
  temperature: z.number().min(0).max(2),
  fallback_chain: z.array(BrainModelSchema),
});

// ========================================
// OUTPUT DO BRAIN
// ========================================

export const BrainActionSchema = z.object({
  action_id: z.string().min(1),
  action_type: BrainActionTypeSchema,
  payload: z.unknown(),
  description: z.string(),
  reversible: z.boolean(),
  priority: z.number(),
});

export const BrainOutputSchema = z.object({
  assistant_response_md: z.string(),
  actions: z.array(BrainActionSchema),
  reasoning_summary: z.string().optional(),
  warnings: z.array(z.string()).optional(),
  follow_up_suggestions: z.array(z.string()).optional(),
});

// ========================================
// MENSAGENS E THREADS
// ========================================

export const BrainMessageMetadataSchema = z.object({
  mode: BrainModeSchema,
  model: BrainModelSchema,
  reasoning_effort: ReasoningEffortSchema,
  text_verbosity: TextVerbositySchema,
  routing_reason: z.string(),
  model_fallback_chain: z.array(BrainModelSchema).optional(),
  latency_ms: z.number(),
  time_to_first_token_ms: z.number().optional(),
  input_tokens: z.number(),
  output_tokens: z.number(),
  reasoning_tokens: z.number().optional(),
  used_classifier: z.boolean(),
  was_uncertain: z.boolean(),
});

export const BrainMessageSchema = z.object({
  id: z.string().min(1),
  thread_id: z.string().min(1),
  project_id: z.number(),
  role: z.enum(["user", "assistant", "system"]),
  content: z.string(),
  structured_output: BrainOutputSchema.nullable().optional(),
  metadata: BrainMessageMetadataSchema,
  created_at: z.string(),
});

export const BrainThreadSchema = z.object({
  id: z.string().min(1),
  project_id: z.number(),
  user_id: z.number(),
  title: z.string().optional(),
  status: z.enum(["active", "archived"]),
  messages_count: z.number(),
  last_message_at: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
});

// ========================================
// REQUESTS
// ========================================

export const BrainThreadCreateRequestSchema = z.object({
  project_id: z.number(),
  user_id: z.number(),
  title: z.string().optional(),
  initial_message: z.string().optional(),
});

export const BrainMessageSendRequestSchema = z.object({
  project_id: z.number(),
  thread_id: z.string().optional(),
  user_prompt: z.string().min(1),
  editor_context: EditorContextSchema.optional(),
  force_mode: BrainModeSchema.optional(),
  force_model: BrainModelSchema.optional(),
});

export const BrainThreadGetRequestSchema = z.object({
  thread_id: z.string().min(1),
  include_messages: z.boolean().optional(),
  messages_limit: z.number().positive().optional(),
});

export const BrainActionsApplyRequestSchema = z.object({
  project_id: z.number(),
  thread_id: z.string().min(1),
  message_id: z.string().min(1),
  action_ids: z.array(z.string()).optional(),
});

// ========================================
// RESPONSES
// ========================================

export const BrainActionResultSchema = z.object({
  action_id: z.string(),
  success: z.boolean(),
  result: z.unknown().optional(),
  error: z.string().optional(),
});

export const BrainThreadCreateResponseSchema = z.object({
  success: z.boolean(),
  thread: BrainThreadSchema,
  message: z.string(),
});

export const BrainMessageSendResponseSchema = z.object({
  success: z.boolean(),
  thread_id: z.string(),
  message: BrainMessageSchema,
  output: BrainOutputSchema.optional(),
  actions_applied: z.array(BrainActionResultSchema).optional(),
  canvas_block_id: z.string().optional(),
  error: z.string().optional(),
});

export const BrainThreadGetResponseSchema = z.object({
  success: z.boolean(),
  thread: BrainThreadSchema,
  messages: z.array(BrainMessageSchema).optional(),
  message: z.string(),
});

export const BrainActionsApplyResponseSchema = z.object({
  success: z.boolean(),
  results: z.array(BrainActionResultSchema),
  message: z.string(),
});

// ========================================
// STREAMING EVENTS
// ========================================

export const BrainStreamStartEventSchema = z.object({
  type: z.literal("start"),
  thread_id: z.string(),
  message_id: z.string(),
  mode: BrainModeSchema,
  model: BrainModelSchema,
  canvas_block_id: z.string().optional(),
});

export const BrainStreamDeltaEventSchema = z.object({
  type: z.literal("delta"),
  content: z.string(),
  index: z.number(),
});

export const BrainStreamMetadataEventSchema = z.object({
  type: z.literal("metadata"),
  metadata: BrainMessageMetadataSchema.partial(),
});

export const BrainStreamCompleteEventSchema = z.object({
  type: z.literal("complete"),
  message: BrainMessageSchema,
  output: BrainOutputSchema.optional(),
});

export const BrainStreamErrorEventSchema = z.object({
  type: z.literal("error"),
  error: z.string(),
  failed_model: BrainModelSchema.optional(),
  fallback_model: BrainModelSchema.optional(),
});

export const BrainStreamEventSchema = z.discriminatedUnion("type", [
  BrainStreamStartEventSchema,
  BrainStreamDeltaEventSchema,
  BrainStreamMetadataEventSchema,
  BrainStreamCompleteEventSchema,
  BrainStreamErrorEventSchema,
]);

// ========================================
// CANVAS BLOCK
// ========================================

export const BrainCanvasBlockSchema = z.object({
  id: z.string().min(1),
  project_id: z.number(),
  thread_id: z.string().min(1),
  block_type: z.literal("brain_chat"),
  position_x: z.number(),
  position_y: z.number(),
  width: z.number().positive(),
  height: z.number().positive(),
  streaming: z.boolean(),
  content: z.string(),
  mode: BrainModeSchema.optional(),
  model: BrainModelSchema.optional(),
  created_at: z.string(),
  updated_at: z.string(),
});

// ========================================
// EXPORT TYPE INFERENCES
// ========================================

export type BrainModeZ = z.infer<typeof BrainModeSchema>;
export type BrainModelZ = z.infer<typeof BrainModelSchema>;
export type BrainOutputZ = z.infer<typeof BrainOutputSchema>;
export type BrainMessageZ = z.infer<typeof BrainMessageSchema>;
export type ClassifierResultZ = z.infer<typeof ClassifierResultSchema>;


