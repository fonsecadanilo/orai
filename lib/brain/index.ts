/**
 * Brain Router Module v1.0
 * 
 * Roteamento inteligente de modelos LLM para o Brain Agent.
 * 
 * @example
 * ```typescript
 * import { route, getModelConfig, calculateContextStats } from "@/lib/brain";
 * 
 * const stats = calculateContextStats(projectContext, messages);
 * const routeResult = await route(prompt, stats);
 * const config = getModelConfig(routeResult);
 * ```
 */

// Types
export type {
  // Core types
  BrainMode,
  BrainModel,
  ReasoningEffort,
  TextVerbosity,
  RiskLevel,
  BrainActionType,
  // Context
  ContextStats,
  EditorContext,
  ProjectContext,
  ProductProfile,
  Persona,
  BusinessRule,
  FlowRegistryItem,
  FlowSpec,
  // Routing
  RouteResult,
  ClassifierResult,
  ModelConfig,
  ModeConfigs,
  // Messages
  BrainMessage,
  BrainMessageMetadata,
  BrainThread,
  // Output
  BrainOutput,
  BrainAction,
  BrainActionResult,
  // Canvas
  BrainCanvasBlock,
  // Requests/Responses
  BrainThreadCreateRequest,
  BrainThreadCreateResponse,
  BrainMessageSendRequest,
  BrainMessageSendResponse,
  BrainThreadGetRequest,
  BrainThreadGetResponse,
  BrainActionsApplyRequest,
  BrainActionsApplyResponse,
  // Streaming
  BrainStreamEvent,
  BrainStreamStartEvent,
  BrainStreamDeltaEvent,
  BrainStreamMetadataEvent,
  BrainStreamCompleteEvent,
  BrainStreamErrorEvent,
  // Env
  BrainEnvConfig,
} from "./types";

// Schemas
export {
  // Enums
  BrainModeSchema,
  BrainModelSchema,
  ReasoningEffortSchema,
  TextVerbositySchema,
  RiskLevelSchema,
  BrainActionTypeSchema,
  // Context
  ContextStatsSchema,
  EditorContextSchema,
  // Routing
  RouteResultSchema,
  ClassifierResultSchema,
  ModelConfigSchema,
  // Output
  BrainOutputSchema,
  BrainActionSchema,
  // Messages
  BrainMessageSchema,
  BrainMessageMetadataSchema,
  BrainThreadSchema,
  // Requests
  BrainThreadCreateRequestSchema,
  BrainMessageSendRequestSchema,
  BrainThreadGetRequestSchema,
  BrainActionsApplyRequestSchema,
  // Responses
  BrainActionResultSchema,
  BrainThreadCreateResponseSchema,
  BrainMessageSendResponseSchema,
  BrainThreadGetResponseSchema,
  BrainActionsApplyResponseSchema,
  // Streaming
  BrainStreamEventSchema,
  // Canvas
  BrainCanvasBlockSchema,
} from "./schemas";

// Router
export {
  routeDeterministic,
  route,
  getModelConfig,
  formatRouteResult,
  shouldUseRAG,
} from "./router";

// Configs
export {
  loadEnvConfig,
  DEFAULT_THRESHOLDS,
  getPlanConfig,
  getPlanProConfig,
  getConsultConfig,
  getBatchConfig,
  getLongContextConfig,
  getAllModeConfigs,
  resolveModelConfig,
  requiresHighReasoningEffort,
  determineVerbosity,
  getSystemPromptForMode,
  BRAIN_SYSTEM_PROMPT_BASE,
  BRAIN_SYSTEM_PROMPTS,
  PLAN_HIGH_EFFORT_TRIGGERS,
} from "./configs";

// Token Estimator
export {
  estimateStringTokens,
  estimateJsonTokens,
  estimateBusinessRuleTokens,
  estimateFlowSpecTokens,
  estimateRegistryItemTokens,
  estimatePersonaTokens,
  estimateProductProfileTokens,
  estimateMessageTokens,
  estimatePromptTokens,
  estimateTotalRequestTokens,
  calculateContextStats,
  formatTokenCount,
  calculateUsagePercentage,
  needsRAGStrategy,
  reduceContextToFit,
  STRATEGY_APPROVED_RULES_ONLY,
  STRATEGY_LATEST_SPECS_ONLY,
  createMessageLimitStrategy,
} from "./token-estimator";

// Classifier
export {
  classifyPrompt,
  classifyPromptCached,
  createClassifierFunction,
} from "./classifier";

// Client
export {
  createThread,
  getThread,
  sendMessage,
  sendMessageStreaming,
  applyActions,
  sendMessageWithCallbacks,
  askBrain,
  type BrainClientOptions,
  type StreamCallbacks,
} from "./client";


