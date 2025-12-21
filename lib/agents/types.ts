// Tipos para o sistema de agentes de IA - Integração com Supabase Edge Functions
// Versão 3.0 - Arquitetura de 3 Agentes Especializados
// 1. Master Rule Creator - Cria regras master detalhadas
// 2. Subrules Decomposer - Decompõe em subregras atômicas
// 3. Flow Generator - Cria fluxos visuais completos

// ========================================
// TIPOS COMUNS
// ========================================

export interface AgentError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface ConversationMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface FlowConversation {
  id: string;
  project_id: number;
  user_id: number;
  agent_type: string;
  messages: ConversationMessage[];
  context?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

// ========================================
// TIPOS PARA PERSONAS E CONTEXTO
// ========================================

export interface InferredPersona {
  name: string;
  type: "primary" | "secondary";
  description: string;
  goals: string[];
  pain_points: string[];
  technical_level: "beginner" | "intermediate" | "advanced";
}

export interface InferredContext {
  business_type: string;
  industry: string;
  target_market: string;
  competitive_landscape?: string;
  assumptions: string[];
}

// ========================================
// TIPOS DE REGRAS DE NEGÓCIO (HIERÁRQUICO)
// ========================================

export type RuleScope = "global" | "flow" | "node";
export type RuleType = "global" | "flow_master" | "node_rule";
export type RulePriority = "low" | "medium" | "high" | "critical";
export type RuleStatus = "draft" | "active" | "deprecated" | "archived";
export type ReferenceType = "depends_on" | "related_to" | "overrides" | "extends" | "mentions";
/**
 * Tipos de nós sugeridos para o fluxo
 * Atualizado para refletir os novos tipos do schema Zod
 */
export type SuggestedNodeType = 
  | "trigger"      // Gatilho inicial do fluxo
  | "action"       // Ação executada pelo sistema
  | "condition"    // Condição/decisão com bifurcação
  | "subflow"      // Referência a outro fluxo
  | "field_group"  // Grupo de campos de formulário
  | "end"          // Nó de término do fluxo
  | "text"         // Nó de texto (comentário ou regra)
  | "note";        // Alias para text (compatibilidade com banco)

/**
 * Categorias de ações disponíveis
 */
export type ActionCategory = "form" | "ui" | "api" | "crud" | "file";

/**
 * Estados de saída para nós de ação
 */
export type OutputState = "success" | "error" | "loading";

/**
 * Subtipos do nó de texto
 */
export type TextSubtype = "comment" | "rule";

export interface CodeSnippet {
  language: string;
  code: string;
  description: string;
}

export interface RuleReference {
  type: ReferenceType;
  target_type: "rule" | "flow" | "node";
  target_id: number;
  context: string;
}

// Blueprint do fluxo (metadados para flow_master)
export interface FlowBlueprint {
  estimated_nodes: number;
  has_branches: boolean;
  complexity: "simple" | "medium" | "complex";
  main_path_length: number;
  branch_count?: number;
}

// Regra de Negócio com estrutura hierárquica
export interface BusinessRule {
  id?: number;
  project_id?: number;
  flow_id?: number;
  node_id?: number;
  
  // Campos básicos
  title: string;
  description: string;
  content: string; // Markdown formatado
  scope: RuleScope;
  category: string;
  priority: RulePriority;
  status?: RuleStatus;
  version?: number;
  tags: string[];
  code_snippets: CodeSnippet[];
  references?: RuleReference[];
  
  // NOVOS CAMPOS - Hierarquia
  rule_type: RuleType;
  parent_rule_id?: number | null;
  order_index?: number;
  suggested_node_type?: SuggestedNodeType;
  acceptance_criteria?: string[];
  edge_cases?: string[];
  dependencies?: number[]; // Array de order_index das regras que dependem
  flow_blueprint?: FlowBlueprint | null; // Só para flow_master
  
  // Timestamps
  created_at?: string;
  updated_at?: string;
}

// Subregra específica (derivada de flow_master)
export interface SubRule extends Omit<BusinessRule, 'rule_type' | 'flow_blueprint'> {
  rule_type: "node_rule";
  parent_rule_id: number;
  order_index: number;
  suggested_node_type: SuggestedNodeType;
  acceptance_criteria: string[];
}

// Regra Master do Fluxo
export interface FlowMasterRule extends Omit<BusinessRule, 'rule_type' | 'parent_rule_id' | 'order_index' | 'suggested_node_type'> {
  rule_type: "flow_master";
  flow_blueprint: FlowBlueprint;
  sub_rules?: SubRule[]; // Subregras carregadas junto
}

// ========================================
// RESPOSTAS DO AGENTE DE REGRAS (3 ETAPAS)
// ========================================

// Etapa 1: Criação da Regra Master
export interface FlowMasterCreationResponse {
  flow_master_rule: FlowMasterRule;
  analysis: {
    detected_steps: number;
    detected_branches: number;
    detected_conditions: number;
    suggestions: string[];
  };
}

// Etapa 2: Decomposição em Subregras
export interface SubRulesDecompositionResponse {
  sub_rules: SubRule[];
  flow_sequence: {
    order_index: number;
    title: string;
    node_type: SuggestedNodeType;
    depends_on: number[];
  }[];
  summary: string;
}

// Resposta completa do agente de regras (2 em 1)
export interface GeneratedRulesResponse {
  flow_master_rule: FlowMasterRule;
  sub_rules: SubRule[];
  flow_blueprint: FlowBlueprint;
  summary: string;
  suggestions: string[];
}

// Request para o agente de regras de negócio
export interface BusinessRulesRequest {
  prompt: string;
  project_id: number;
  user_id: number;
  flow_id?: number;
  node_id?: number;
  action?: "create" | "edit" | "delete" | "decompose";
  rule_ids?: number[];
  conversation_id?: string;
}

// Resposta do agente de regras de negócio
export interface BusinessRulesResponse {
  success: boolean;
  flow_master_rule_id?: number;
  sub_rule_ids: number[];
  conversation_id?: string;
  generated_rules: GeneratedRulesResponse;
  message: string;
}

// ========================================
// TIPOS DO MODELO DE NEGÓCIO
// ========================================

export interface Persona {
  name: string;
  description: string;
  goals: string[];
  pain_points: string[];
}

export interface KeyFeature {
  name: string;
  description: string;
  priority: "low" | "medium" | "high";
}

export interface GlossaryTerm {
  term: string;
  definition: string;
  context?: string;
}

export interface BusinessModel {
  id?: number;
  project_id: number;
  vision?: string;
  mission?: string;
  target_audience?: string;
  value_proposition?: string;
  business_type?: string;
  revenue_model?: string;
  key_features: KeyFeature[];
  general_rules?: string;
  glossary: GlossaryTerm[];
  personas: Persona[];
  integrations: string[];
  status?: "draft" | "active" | "archived";
  version?: number;
  created_at?: string;
  updated_at?: string;
}

// ========================================
// TIPOS DE FLUXOS
// ========================================

/**
 * Interface do nó de fluxo
 * Atualizada para suportar os novos tipos de nós
 */
export interface FlowNode {
  id: string;
  db_id?: number; // ID no banco de dados
  type: SuggestedNodeType;
  title: string;
  description?: string;
  position_x: number;
  position_y: number;
  column?: "center" | "error" | "alternative"; // Coluna no layout
  linked_rule_id?: number; // ID da subregra vinculada
  rule_order_index?: number; // Ordem da subregra
  
  // Campos específicos para ActionNode
  category?: ActionCategory;
  verb?: string;
  outputs?: OutputState[];
  
  // Campos específicos para ConditionNode
  expression?: string;
  paths?: {
    yes: string;
    no: string;
  };
  
  // Campos específicos para SubflowNode
  target_flow_id?: string;
  
  // Campos específicos para FieldGroupNode
  mode?: "all_in_one" | "step_by_step";
  fields?: {
    id: string;
    label: string;
    type: "text" | "email" | "number" | "date" | "select" | "boolean" | "textarea";
    required?: boolean;
    options?: string[];
  }[];
  
  // Campos específicos para EndNode
  status?: "success" | "error";
  
  // Campos específicos para TextNode
  subtype?: TextSubtype;
  content?: string;
}

export interface FlowConnection {
  id?: number; // ID no banco de dados
  source_id?: string; // ID original string
  target_id?: string; // ID original string
  source_node_id: string | number; // Pode ser string ou número
  target_node_id: string | number; // Pode ser string ou número
  label?: string; // "sucesso", "erro", "sim", "não", etc.
}

export interface FlowTask {
  title: string;
  description?: string;
  status: "todo" | "doing" | "done";
  linked_rule_id?: number;
}

export interface GeneratedFlow {
  name: string;
  description: string;
  flow_master_rule_id?: number; // ID da regra master
  nodes: FlowNode[];
  connections: FlowConnection[];
  tasks: FlowTask[];
}

// Request para a Edge Function flow-creator-agent
export interface FlowCreatorRequest {
  prompt: string;
  project_id: number;
  user_id: number;
  conversation_id?: string;
  flow_master_rule_id?: number; // ID da regra master já criada
  sub_rule_ids?: number[]; // IDs das subregras a usar
}

// Resposta da Edge Function flow-creator-agent
export interface FlowCreatorResponse {
  success: boolean;
  flow_id?: number;
  conversation_id?: string;
  generated_flow: GeneratedFlow;
  linked_rules: {
    flow_master_rule_id: number;
    sub_rule_ids: number[];
  };
  message: string;
}

// ========================================
// TIPOS PARA LISTAGEM DE REGRAS (HIERÁRQUICO)
// ========================================

export interface RuleListItem {
  id: number;
  title: string;
  description: string;
  scope: RuleScope;
  rule_type: RuleType;
  category: string;
  priority: RulePriority;
  status: RuleStatus;
  parent_rule_id?: number | null;
  order_index?: number;
  suggested_node_type?: SuggestedNodeType;
  flow_id?: number;
  flow_name?: string;
  node_id?: number;
  sub_rules_count?: number; // Quantidade de subregras (para flow_master)
  created_at: string;
  updated_at: string;
}

// Regra com suas subregras carregadas (árvore)
export interface RuleWithSubRules extends RuleListItem {
  sub_rules: RuleListItem[];
}

// Regra com todas as referências
export interface RuleWithReferences extends BusinessRule {
  referenced_flows?: { id: number; name: string }[];
  referenced_nodes?: { id: number; title: string; flow_id: number }[];
  referenced_rules?: { id: number; title: string }[];
  parent_rule?: { id: number; title: string } | null;
  sub_rules?: RuleListItem[];
}

// ========================================
// TIPOS PARA PROGRESSO DA CRIAÇÃO (v3)
// ========================================

export type CreationStep = 
  | "idle"
  | "analyzing"           // Analisando o prompt
  | "creating_master"     // Agente 1: Criando regra master detalhada
  | "master_review"       // Usuário pode revisar regra master
  | "decomposing"         // Agente 2: Decompondo em subregras
  | "decompose_review"    // Usuário pode revisar subregras
  | "creating_flow"       // Agente 3: Criando fluxo visual
  | "linking"             // Vinculando nós às regras
  | "completed"
  | "error";

export interface CreationProgress {
  step: CreationStep;
  message: string;
  percentage?: number;
  details?: {
    master_rule_created?: boolean;
    master_rule_id?: number;
    sub_rules_count?: number;
    nodes_created?: number;
    connections_created?: number;
    error_paths_count?: number;
  };
}

// ========================================
// AGENTE 1: MASTER RULE CREATOR
// ========================================

export interface MasterRuleCreatorRequest {
  prompt: string;
  project_id: number;
  user_id: number;
  business_model_context?: string;
  existing_rules_context?: string[];
  conversation_id?: string;
}

export interface DetailedMasterRule {
  title: string;
  description: string;
  
  // Conteúdo estruturado (Markdown rico)
  content: {
    objective: string;           // ## Objetivo Geral
    business_context: string;    // ## Contexto de Negócio
    personas: InferredPersona[]; // ## Personas Envolvidas
    prerequisites: string[];     // ## Pré-requisitos
    happy_path: string;          // ## Fluxo Principal
    alternative_flows: string[]; // ## Fluxos Alternativos
    error_cases: ErrorCase[];    // ## Casos de Erro
    acceptance_criteria: string[];// ## Critérios de Aceitação
    edge_cases: string[];        // ## Edge Cases
    success_metrics: string[];   // ## Métricas de Sucesso
    integrations: string[];      // ## Integrações Necessárias
    security_considerations: string[]; // ## Considerações de Segurança
  };
  
  // Metadados
  inferred_context: InferredContext;
  flow_blueprint: FlowBlueprint;
  category: string;
  priority: RulePriority;
  tags: string[];
  estimated_complexity: "simple" | "medium" | "complex" | "very_complex";
  estimated_development_hours?: number;
}

export interface ErrorCase {
  error_type: string;
  description: string;
  user_message: string;
  recovery_action: string;
  severity: "low" | "medium" | "high" | "critical";
}

export interface MasterRuleCreatorResponse {
  success: boolean;
  master_rule_id?: number;
  master_rule: DetailedMasterRule;
  analysis: {
    detected_steps: number;
    detected_decision_points: number;
    detected_integrations: number;
    detected_error_scenarios: number;
    suggestions: string[];
    warnings: string[];
  };
  conversation_id?: string;
  message: string;
}

// ========================================
// AGENTE 2: SUBRULES DECOMPOSER
// ========================================

export interface SubrulesDecomposerRequest {
  master_rule_id: number;
  master_rule_content?: DetailedMasterRule | null; // Opcional - edge function busca do banco se não fornecido
  project_id: number;
  user_id: number;
  decomposition_depth?: "shallow" | "normal" | "deep"; // Granularidade
  include_error_paths?: boolean;
  include_validation_nodes?: boolean;
  conversation_id?: string;
}

export interface AtomicSubRule {
  order_index: number;
  title: string;
  description: string;
  
  // Tipo de nó sugerido
  suggested_node_type: SuggestedNodeType;
  
  // Categorização
  path_type: "happy_path" | "error_path" | "alternative_path" | "validation" | "recovery";
  
  // Conteúdo detalhado
  user_action?: string;        // O que o usuário faz
  system_action?: string;      // O que o sistema faz
  expected_outcome: string;    // Resultado esperado
  
  // Validações (se aplicável)
  validations?: {
    field: string;
    rules: string[];
    error_message: string;
  }[];
  
  // Critérios
  acceptance_criteria: string[];
  
  // Dependências e fluxo
  dependencies: number[];      // order_index das subregras predecessoras
  next_on_success?: number;    // Próxima subregra em sucesso
  next_on_failure?: number;    // Próxima subregra em falha
  is_terminal: boolean;        // É um nó final?
  
  // Dados
  input_data?: string[];       // Dados recebidos
  output_data?: string[];      // Dados produzidos
  
  // Estimativas
  estimated_duration_seconds?: number;
  
  // Metadados
  priority: RulePriority;
  tags: string[];
}

export interface FlowPath {
  path_id: string;
  path_type: "happy_path" | "error_path" | "alternative_path";
  name: string;
  description: string;
  subrule_sequence: number[]; // order_index em sequência
}

/**
 * Nó simbólico puro - gerado pelo LLM
 * Usado para passar diretamente para a Engine (flow-generator)
 */
export interface SymbolicNode {
  id: string;
  type: "trigger" | "action" | "condition" | "end" | "subflow";
  title: string;
  description: string;
  next_on_success?: string | null;
  next_on_failure?: string | null;
  end_status?: "success" | "error";
  db_id?: number; // ID do banco se já salvo
}

export interface SubrulesDecomposerResponse {
  success: boolean;
  master_rule_id: number;
  sub_rule_ids: number[];
  sub_rules: AtomicSubRule[];
  
  // Nós simbólicos puros - para passar direto para flow-generator
  symbolic_nodes?: SymbolicNode[];
  
  // Estrutura do fluxo
  flow_structure: {
    total_nodes: number;
    happy_path_nodes: number;
    error_path_nodes: number;
    validation_nodes: number;
    decision_points: number;
    paths: FlowPath[];
  };
  
  // Mapa de dependências
  dependency_graph: {
    [order_index: number]: {
      depends_on: number[];
      leads_to: number[];
    };
  };
  
  // Validação de grafo
  graph_validation?: {
    isValid: boolean;
    errors: string[];
    warnings: string[];
  };
  
  stats?: {
    total: number;
    triggers: number;
    actions: number;
    conditions: number;
    subflows: number;
    ends_success: number;
    ends_error: number;
  };
  
  summary?: string;
  conversation_id?: string;
  message: string;
}

// ========================================
// AGENTE 3: FLOW GENERATOR (MELHORADO)
// ========================================

export interface FlowGeneratorRequest {
  master_rule_id: number;
  sub_rules: AtomicSubRule[];
  flow_structure: SubrulesDecomposerResponse["flow_structure"];
  dependency_graph: SubrulesDecomposerResponse["dependency_graph"];
  project_id: number;
  user_id: number;
  
  // Opções de layout
  layout_options?: {
    orientation: "vertical" | "horizontal";
    spacing: "compact" | "normal" | "spacious";
    show_error_paths: boolean;
    show_validation_nodes: boolean;
    group_related_nodes: boolean;
  };
  
  conversation_id?: string;
}

export interface EnhancedFlowNode extends FlowNode {
  // Campos adicionais
  node_category: "start" | "process" | "decision" | "end" | "error" | "validation";
  path_type: "happy_path" | "error_path" | "alternative_path" | "validation";
  
  // Estilo visual
  style?: {
    color?: string;
    icon?: string;
    size?: "small" | "medium" | "large";
  };
  
  // Dados do nó
  input_data?: string[];
  output_data?: string[];
  
  // Métricas
  estimated_duration?: number;
}

export interface EnhancedFlowConnection extends FlowConnection {
  // Tipo de conexão
  connection_type: "success" | "failure" | "conditional" | "default";
  
  // Condição (se aplicável)
  condition?: string;
  
  // Estilo
  style?: {
    color?: string;
    stroke_style?: "solid" | "dashed" | "dotted";
    animated?: boolean;
  };
}

export interface FlowGeneratorResponse {
  success: boolean;
  flow_id?: number;
  
  generated_flow: {
    name: string;
    description: string;
    flow_master_rule_id: number;
    
    // Nós melhorados
    nodes: EnhancedFlowNode[];
    
    // Conexões melhoradas
    connections: EnhancedFlowConnection[];
    
    // Tarefas de implementação
    tasks: FlowTask[];
    
    // Estatísticas
    stats: {
      total_nodes: number;
      total_connections: number;
      happy_path_length: number;
      error_paths_count: number;
      decision_points: number;
      estimated_total_duration?: number;
    };
  };
  
  linked_rules: {
    flow_master_rule_id: number;
    sub_rule_ids: number[];
  };
  
  layout_info: {
    width: number;
    height: number;
    center_x: number;
    center_y: number;
  };
  
  conversation_id?: string;
  message: string;
}

// ========================================
// AGENTE 4: JOURNEY & FEATURES CREATOR
// Roda em PARALELO com Subrules Decomposer
// ========================================

/**
 * Journey v2.0 - Formato simplificado para Subrules
 * 
 * Este é o formato que será passado para o Subrules Decomposer
 * junto com a Master Rule.
 */
export interface JourneyV2 {
  steps: string[];           // Etapas narrativas
  decisions: string[];       // Momentos onde o usuário escolhe algo
  failure_points: string[];  // Lugares onde ele pode desistir/errar
  motivations: string[];     // Por que ele faz cada etapa
}

/**
 * Passo da jornada do usuário (formato legado, mantido para compatibilidade)
 */
export interface JourneyStep {
  order: number;
  action: string; // O que o usuário faz (ex: "Clica em cadastrar")
  context: string; // Contexto/motivação (ex: "Para criar sua conta")
  expected_outcome: string; // O que espera acontecer
  emotional_state?: "neutral" | "positive" | "negative" | "anxious" | "excited";
  touchpoint: "page" | "modal" | "form" | "button" | "notification" | "email" | "external" | "process";
  pain_points?: string[]; // Possíveis frustrações
  opportunities?: string[]; // Oportunidades de melhoria
}

/**
 * Feature sugerida baseada na jornada
 */
export interface SuggestedFeature {
  id: string;
  name: string;
  description: string;
  type: "essential" | "enhancement" | "nice_to_have";
  related_journey_steps: number[]; // Order dos passos relacionados
  complexity: "simple" | "medium" | "complex";
  priority: "low" | "medium" | "high" | "critical";
  user_value: string; // Valor para o usuário
  business_value?: string; // Valor para o negócio
  acceptance_criteria?: string[];
}

/**
 * Jornada do usuário completa
 */
export interface UserJourney {
  name: string;
  description: string;
  persona: string; // Quem está realizando a jornada
  goal: string; // Objetivo principal do usuário
  starting_point: string; // De onde o usuário vem
  ending_point: string; // Para onde o usuário vai após concluir
  
  // Passos da jornada
  steps: JourneyStep[];
  
  // Métricas sugeridas
  success_metrics?: string[];
  
  // Resumo narrativo
  narrative: string; // Descrição em texto corrido da jornada
}

/**
 * Request para o agente de jornada e features
 */
export interface JourneyFeaturesCreatorRequest {
  master_rule_id: number;
  master_rule_content: string; // Conteúdo da regra master (markdown)
  master_rule_title: string;
  business_rules: string[]; // Regras de negócio identificadas
  project_id: number;
  user_id: number;
  conversation_id?: string;
}

/**
 * Response do agente de jornada e features
 */
export interface JourneyFeaturesCreatorResponse {
  success: boolean;
  journey_id?: number;
  
  // Journey v2.0 - formato novo para Subrules
  journey?: JourneyV2;
  
  // Jornada criada (formato legado, mantido para compatibilidade)
  user_journey: UserJourney;
  
  // Features identificadas
  suggested_features: SuggestedFeature[];
  
  // Análise
  analysis: {
    total_steps: number;
    critical_touchpoints?: number;
    identified_pain_points?: number;
    decision_points?: number;
    failure_points?: number;
    complexity?: "simple" | "medium" | "complex";
    feature_count?: {
      essential: number;
      enhancement: number;
      nice_to_have: number;
    };
  };
  
  // Mapeamento de features para passos da jornada
  feature_step_mapping: {
    feature_id: string;
    step_orders: number[];
    rationale: string;
  }[];
  
  conversation_id?: string;
  message: string;
}

// ========================================
// ORQUESTRAÇÃO DOS 4 AGENTES
// ========================================

export interface FullFlowCreationRequest {
  prompt: string;
  project_id: number;
  user_id: number;
  
  // Opções
  options?: {
    decomposition_depth?: "shallow" | "normal" | "deep";
    include_error_paths?: boolean;
    auto_proceed?: boolean; // Se true, não para para revisão
    layout_orientation?: "vertical" | "horizontal";
    include_journey?: boolean; // Se true, cria jornada do usuário (default: true)
  };
}

/**
 * Resultado do Flow Enricher (NOVO v3.0)
 */
export interface FlowEnricherResult {
  enriched_flow: {
    extra_steps: Array<{
      step_id: string;
      description: string;
      page_key?: string;
      after_step?: string;
      reason: string;
      is_optional?: boolean;
      pattern_type?: string;
    }>;
    extra_decisions: Array<{
      decision_id: string;
      description: string;
      page_key?: string;
      options: string[];
      reason: string;
    }>;
    extra_failure_points: Array<{
      failure_id: string;
      description: string;
      page_key?: string;
      recovery_action: string;
      allows_retry?: boolean;
    }>;
    ux_recommendations?: Array<{
      target: string;
      recommendation: string;
      priority: "low" | "medium" | "high";
      pattern_name?: string;
    }>;
    notes?: string[];
    patterns_applied?: string[];
  };
  analysis?: {
    extra_steps_count: number;
    extra_decisions_count: number;
    extra_failure_points_count: number;
    patterns_applied: string[];
  };
}

/**
 * Contexto de Páginas (NOVO v3.0)
 */
export interface PageContextResult {
  pages: Array<{
    page_key: string;
    label: string;
    path?: string;
    description?: string;
    page_type?: string;
  }>;
  transitions: Array<{
    from_page: string;
    to_page: string;
    reason: string;
    is_error_path?: boolean;
  }>;
  entry_page?: string;
  exit_pages_success?: string[];
  exit_pages_error?: string[];
}

/**
 * Resultado da Validação SaaS (NOVO v3.0)
 */
export interface SaaSValidationResult {
  isValid: boolean;
  score: number;
  errors: Array<{
    code: string;
    message: string;
    nodeId?: string;
    severity: "error" | "critical";
  }>;
  warnings: Array<{
    code: string;
    message: string;
    nodeId?: string;
    suggestion?: string;
  }>;
  suggestions: string[];
}

export interface FullFlowCreationResponse {
  success: boolean;

  // Resultados de cada agente
  master_rule_result: MasterRuleCreatorResponse;
  decomposition_result: SubrulesDecomposerResponse;
  journey_result?: JourneyFeaturesCreatorResponse;
  flow_result: FlowGeneratorResponse;
  
  // NOVO v3.0: Resultados adicionais
  enricher_result?: FlowEnricherResult;
  page_context?: PageContextResult;
  saas_validation?: SaaSValidationResult;

  // IDs finais
  master_rule_id: number;
  sub_rule_ids: number[];
  journey_id?: number;
  flow_id: number;

  // Resumo
  summary: {
    total_rules_created: number;
    total_nodes_created: number;
    total_connections_created: number;
    total_features_identified?: number;
    // NOVO v3.0
    total_pages_mapped?: number;
    total_transitions?: number;
    saas_score?: number;
    enrichments_applied?: number;
    execution_time_ms: number;
    warnings?: string[];
  };

  message: string;
}
