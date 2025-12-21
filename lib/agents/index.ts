/**
 * Agents Index - Centralized exports
 * 
 * ========================================
 * ORIA v3.1 - UNIFIED ARCHITECTURE
 * ========================================
 * 
 * Pipeline of 6 agents for intelligent user flow construction:
 * 1. Product & Role Mapper - Maps product context and roles
 * 2. Flow Synthesizer - Synthesizes flow with steps, decisions, failures
 * 3. Archetype Modeler - Applies UX/Security/Compliance archetypes
 * 4. Flow Critic - Validates and calculates Integrity Score
 * 5. UX Block Composer - Composes adaptive UX blocks
 * 6. Flow Connector - Connects flows and tracks reuse
 * 
 * NOTE: Legacy v3.0 pipeline has been removed. Only v3.1 is supported.
 */

// ========================================
// V3.1 - MAIN ARCHITECTURE (6 AGENTS)
// ========================================
export * from "./v3";

// ========================================
// BUSINESS RULES (Independent functionality)
// ========================================
// These functions are used by useBusinessRules hook for managing rules
// independently of flow creation
export {
  createHierarchicalRules,
  getFlowMasterRules,
  getFlowMasterWithSubRules,
  getSubRules,
  getProjectRules,
  getRuleWithReferences,
  updateRule,
  archiveRule,
  archiveFlowMasterWithSubRules,
  deleteRule,
  getRulesConversations,
  getRuleCategories,
} from "./business-rules";

// ========================================
// TYPES
// ========================================
export type {
  // Common
  AgentError,
  ConversationMessage,
  FlowConversation,
  
  // Flow Generator (for compatibility)
  FlowNode,
  FlowConnection,
  GeneratedFlow,
  
  // Business Rules
  BusinessRulesRequest,
  BusinessRulesResponse,
  RuleListItem,
  RuleWithReferences,
  RuleWithSubRules,
  BusinessRule,
  FlowMasterRule,
  SubRule,
  
  // Progress (used by hooks)
  CreationProgress,
  CreationStep,
} from "./types";
