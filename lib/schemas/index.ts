/**
 * Schemas centralizados para a pipeline de agentes do Oria
 * 
 * Arquitetura v3.0:
 * 1. MasterRule - Semântica de negócio + páginas (LLM)
 * 2. Journey - Jornada do usuário com páginas (LLM)
 * 3. FlowEnricher - Enriquece com padrões SaaS (LLM)
 * 4. PageMapper - Mapeia transições de página (LLM)
 * 5. Subrules - Nós ricos com inputs e UX (LLM)
 * 6. EngineGraph - Estrutura final (CÓDIGO)
 */

// Master Rule Schema v2.0
export {
  PageDefinitionSchema,
  MasterRuleSchema,
  MasterRuleResponseSchema,
  validateMasterRule,
  formatMasterRuleErrors,
  detectPagesFromFlow,
  COMMON_SAAS_PAGES,
  type PageDefinition,
  type MasterRule,
  type MasterRuleResponse,
} from "./masterRuleSchema";

// Journey Schema v2.0
export {
  JourneyStepSchema,
  DecisionPointSchema,
  FailurePointSchema,
  MotivationSchema,
  JourneySchema,
  JourneyStructuredSchema,
  PageTransitionSchema,
  PageContextSchema,
  EnrichedJourneySchema,
  JourneyCreatorResponseSchema,
  validateJourney,
  validateEnrichedJourney,
  formatJourneyErrors,
  journeyToSubrulesContext,
  type JourneyStep,
  type DecisionPoint,
  type FailurePoint,
  type Motivation,
  type Journey,
  type JourneyStructured,
  type PageTransition,
  type PageContext,
  type EnrichedJourney,
  type JourneyCreatorResponse,
} from "./journeySchema";

// Subrules Schema v3.0
export {
  NodeTypeEnum,
  EndStatusEnum,
  FlowCategoryEnum,
  FormInputSchema,
  SubRuleNodeSchema,
  RichNodeSchema,
  SubrulesResponseSchema,
  RichSubrulesResponseSchema,
  validateSubrules,
  validateRichSubrules,
  validateSubrulesGraph,
  validateSaaSFlow,
  formatSubrulesErrors,
  richNodeToSubRuleNode,
  subRuleNodeToRichNode,
  STANDARD_PAGE_INPUTS,
  type SubRuleNodeType,
  type EndStatus,
  type FlowCategory,
  type FormInput,
  type SubRuleNode,
  type RichNode,
  type SubrulesResponse,
  type RichSubrulesResponse,
  type GraphValidationResult,
  type SaaSValidationResult,
  type SaaSValidationError,
  type SaaSValidationWarning,
} from "./subrulesSchema";

// Node Types v3.1 (Semântica Expandida)
export {
  MainNodeTypeSchema,
  SubNodeTypeSchema,
  ImpactLevelSchema,
  RoleScopeSchema,
  NodeVisualCategorySchema,
  InputFieldSchema,
  NodeActionSchema,
  FeedbackMessageSchema,
  SubNodeSchema,
  ReuseInfoSchema,
  FlowNodeV3Schema,
  NODE_VISUAL_CONFIGS,
  getNodeConfig,
  isTerminalNode,
  isBranchingNode,
  supportsInputs,
  getAllowedChildren,
  convertV2ToV3NodeType,
  convertV3ToDBType,
  validateNodeV3,
  type MainNodeType,
  type SubNodeType,
  type ImpactLevel,
  type RoleScope,
  type NodeVisualCategory,
  type NodeVisualConfig,
  type InputField,
  type NodeAction,
  type FeedbackMessage,
  type SubNode,
  type ReuseInfo,
  type FlowNodeV3,
} from "./nodeTypesV3";

// Engine Graph Schema
export {
  EngineNodeTypeEnum,
  LayoutColumnEnum,
  ConnectionTypeEnum,
  EngineNodeSchema,
  EngineEdgeSchema,
  LayoutInfoSchema,
  EngineGraphSchema,
  DEFAULT_LAYOUT_CONFIG,
  validateEngineGraph,
  type EngineNodeType,
  type LayoutColumn,
  type ConnectionType,
  type EngineNode,
  type EngineEdge,
  type LayoutInfo,
  type EngineGraph,
  type LayoutConfig,
} from "./engineGraphSchema";
