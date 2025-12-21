/**
 * Validation Module Index
 * 
 * Exports all validation utilities for the v3.1 pipeline
 * 
 * v3.1 Architecture:
 * - NodeGrammarV3: Semantic rules per node type
 * - BranchingEnricherV3: Adds missing error paths, loopbacks, retries
 * - ValidateGraphV3: Validates flow structure based on v3_type
 * - AutoFixV3: Automatically fixes common issues
 * - FlowVersionGuard: Identifies v3.1 vs legacy flows
 * - TypeGatesV3: Blocks action-only flows (NEW)
 * - TypeRepairerV3: Fixes semantic types without rewriting (NEW)
 * - BranchingGatesV3: Ensures proper branching (NEW)
 * - GroupLabelGateV3: Ensures group_label on all nodes (NEW)
 */

// Legacy validator (flow-integrity.ts)
export {
  validateFlow,
  autoFixFlow,
  quickValidate,
  getValidationRules,
  formatIntegrityScore,
  type ValidationIssue as LegacyValidationIssue,
  type ValidationResult as LegacyValidationResult,
  type FlowStats as LegacyFlowStats,
  type ConnectionInfo,
} from "./flow-integrity";

// V3.1 Node Grammar
export {
  NODE_GRAMMAR_V3,
  ERROR_HANDLING_TEMPLATES,
  getNodeGrammar,
  isTerminalNode,
  needsErrorHandling,
  getRecommendedErrorPattern,
  getErrorHandlingTemplate,
  validateOutputCount,
  validateConnectionType,
  type NodeGrammarRule,
  type ConnectionTypeV3,
  type ErrorHandlingTemplate,
} from "./node-grammar-v3";

// V3.1 Branching Enricher
export {
  BranchingEnricherV3,
  enrichBranching,
  type EnricherNode,
  type EnricherConnection,
  type EnrichmentResult,
} from "./branching-enricher-v3";

// V3.1 Graph Validator & AutoFix
export {
  ValidateGraphV3,
  AutoFixV3,
  validateGraphV3,
  autoFixGraphV3,
  type ValidatorNode,
  type ValidatorConnection,
  type ValidationIssue,
  type ValidationResult,
  type AutoFixResult,
} from "./validate-graph-v3";

// V3.1 Flow Version Guard
export {
  isV31Flow,
  isLegacyFlow,
  getLayoutOwner,
  shouldUseLegacyEngine,
  getFlowVersionLabel,
  type FlowMetadata,
} from "./flow-version-guard";

// V3.1 Type Gates (NEW - blocks action-only flows)
export {
  validateTypeDistributionV3,
  calculateTypeStats,
  isValidSemanticTypeV3,
  suggestTypeFromContent,
  formatStatsForMetadata,
  ALLOWED_SEMANTIC_TYPES_V3,
  type SemanticTypeV3,
  type TypeDistributionStats,
  type TypeValidationIssue,
  type TypeValidationResult,
  type FlowNodeForValidation,
  type FlowConnectionForValidation,
} from "./type-gates-v3";

// V3.1 Type Repairer (NEW - fixes semantic types)
export {
  TypeRepairerV3,
  repairTypes,
  type RepairableNode,
  type RepairableConnection,
  type TypeRepairResult,
  type TypeRepair,
} from "./type-repairer-v3";

// V3.1 Branching Gates (NEW - ensures proper branching)
export {
  validateBranchingV3,
  runAllGatesV3,
  type BranchingNode,
  type BranchingConnection,
  type BranchingValidationIssue,
  type BranchingValidationResult,
} from "./branching-gates-v3";

// V3.1 Group Label Gate (NEW - ensures group_label)
export {
  validateAndApplyGroupLabels,
  applyGroupLabels,
  inferGroupLabel,
  groupNodesByLabel,
  type NodeWithGroupLabel,
  type GroupLabelIssue,
  type GroupLabelValidationResult,
} from "./group-label-gate-v3";

// V3.1 Enforce Outputs (MANDATORY - guarantees condition branches)
export {
  enforceRequiredOutputsV3,
  validateEnforcedFlow,
  EnforceOutputsV3,
  type EnforcerNode,
  type EnforcerConnection,
  type EnforcementResult,
  type EnforcementContext,
  type EnforcementValidationResult,
} from "./enforce-outputs-v3";

