/**
 * Oria v3.1 - Nova Arquitetura de Agentes
 * 
 * Pipeline de 6 agentes para construção inteligente de user flows:
 * 1. Product & Role Mapper - Mapeia contexto de produto e roles
 * 2. Flow Synthesizer - Sintetiza fluxo com steps, decisions, failures
 * 3. Archetype Modeler - Aplica arquétipos de UX/Segurança/Compliance
 * 4. Flow Critic - Valida e calcula Score de Integridade
 * 5. UX Block Composer - Compõe blocos UX adaptativos
 * 6. Flow Connector - Conecta fluxos e rastreia reuso
 */

// Types
export * from "./types";

// Agent 1: Product & Role Mapper
export {
  mapProductAndRole,
  getProductContextFromProject,
  saveProductContext,
  getProjectRoles,
} from "./product-role-mapper";

// Agent 2: Flow Synthesizer
export {
  synthesizeFlow,
  getExistingFlows,
  analyzeFlowComplexity,
  detectPatterns,
} from "./flow-synthesizer";

// Agent 3: Archetype Modeler
export {
  modelArchetype,
  mapArchetypesLocally,
  getArchetypeRecommendations,
  BUILTIN_ARCHETYPES,
} from "./archetype-modeler";

// Agent 4: Flow Critic
export {
  criticizeFlow,
  validateFlowLocally,
  applyAutoFixes,
  formatIntegrityScore,
} from "./flow-critic";

// Agent 5: UX Block Composer
export {
  composeUXBlocksV3,
  searchLibraryBlocks,
  adaptBlockForContext,
  generateDefaultInputs,
  composeBlocksLocally,
} from "./ux-block-composer-v3";

// Agent 6: Flow Connector
export {
  connectFlow,
  generateConnections,
  detectReusableNodes,
  generateDependencyGraph,
  convertBlocksToNodes,
  saveConnectedFlow,
} from "./flow-connector";

// Orchestrator
export {
  executeV3Pipeline,
  continueV3Pipeline,
  retryV3Agent,
  validatePipelineResults,
  type ProgressCallback,
} from "./orchestrator-v3";
