/**
 * Brain Router Types v1.0
 * 
 * Tipos para roteamento inteligente de modelos LLM no Brain Agent.
 * 
 * Modos:
 * - PLAN: arquitetura, regras, specs, refactor, conflitos
 * - CONSULT: Q&A, explicações, sugestões rápidas
 * - BATCH: tarefas repetitivas, transformações
 * - LONG_CONTEXT: contexto muito grande (preferir RAG)
 */

// ========================================
// ENUMS E CONSTANTES
// ========================================

/**
 * Modos de operação do Brain
 */
export type BrainMode = "PLAN" | "CONSULT" | "BATCH" | "LONG_CONTEXT";

/**
 * Modelos disponíveis para cada modo
 */
export type BrainModel = 
  | "gpt-5.2"
  | "gpt-5.2-pro"
  | "gpt-5-mini"
  | "gpt-5-nano"
  | "gpt-4.1"
  | "gpt-4.1-mini"
  | "gpt-4.1-nano"
  // Fallbacks atuais (enquanto modelos futuros não estão disponíveis)
  | "gpt-4o"
  | "gpt-4o-mini"
  | "o3"
  | "o3-mini"
  | "o1"
  | "o1-mini";

/**
 * Níveis de esforço de reasoning (Responses API)
 */
export type ReasoningEffort = "minimal" | "low" | "medium" | "high";

/**
 * Níveis de verbosidade do texto
 */
export type TextVerbosity = "low" | "medium" | "high";

/**
 * Níveis de risco
 */
export type RiskLevel = "low" | "medium" | "high";

/**
 * Tipos de ação do Brain
 */
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

/**
 * Status do plano de flow
 */
export type BrainFlowPlanStatus = 
  | "draft"
  | "revised"
  | "approved"
  | "building"
  | "built"
  | "cancelled";

/**
 * Plano de construção de flow
 */
export interface BrainFlowPlan {
  id: string;
  project_id: number;
  thread_id: string;
  canvas_block_id?: string;
  flow_key?: string;
  status: BrainFlowPlanStatus;
  plan_version: number;
  plan_md: string;
  plan_json: BrainFlowPlanJson;
  approved_at?: string;
  approved_by?: string;
  build_job_id?: string;
  result_flow_id?: number;
  created_at: string;
  updated_at: string;
}

/**
 * Estrutura JSON do plano (FlowSpec + metadata)
 */
export interface BrainFlowPlanJson {
  /** Goal do flow */
  flow_goal: string;
  /** Atores/roles envolvidos */
  actors: string[];
  /** Passos agrupados */
  steps: BrainFlowPlanStep[];
  /** Pontos de decisão */
  decision_points: BrainFlowPlanDecision[];
  /** Pontos de falha */
  failure_points: BrainFlowPlanFailure[];
  /** Inputs/forms necessários */
  inputs: BrainFlowPlanInput[];
  /** Referências a regras */
  rules_refs: string[];
  /** Suposições e nível de confiança */
  assumptions: BrainFlowPlanAssumption[];
  /** Checklist de aceite para builders */
  acceptance_checklist: string[];
  /** FlowSpec para builders v3.1 */
  spec?: unknown;
}

export interface BrainFlowPlanStep {
  order: number;
  group: string;
  title: string;
  description: string;
  node_type?: string;
}

export interface BrainFlowPlanDecision {
  step_ref: number;
  condition: string;
  branches: string[];
}

export interface BrainFlowPlanFailure {
  step_ref: number;
  failure_type: string;
  handling: string;
}

export interface BrainFlowPlanInput {
  step_ref: number;
  field_name: string;
  field_type: string;
  required: boolean;
  validation?: string;
}

export interface BrainFlowPlanAssumption {
  assumption: string;
  confidence: "low" | "medium" | "high";
}

// ========================================
// CONTEXTO E ESTATÍSTICAS
// ========================================

/**
 * Estatísticas do contexto carregado
 */
export interface ContextStats {
  /** Total de tokens estimados no contexto */
  total_tokens_estimate: number;
  /** Contagem de regras de negócio */
  business_rules_count: number;
  /** Contagem de specs de fluxo */
  flow_specs_count: number;
  /** Contagem de itens no registry */
  flow_registry_count: number;
  /** Contagem de personas */
  personas_count: number;
  /** Número de mensagens no thread */
  thread_messages_count: number;
  /** Indica se contexto é muito grande */
  is_large_context: boolean;
  /** Tamanho do maior item (para decisão de chunking) */
  largest_item_tokens: number;
}

/**
 * Contexto do editor (opcional)
 */
export interface EditorContext {
  /** IDs dos nós selecionados */
  selected_node_ids?: string[];
  /** Viewport atual */
  viewport?: {
    x: number;
    y: number;
    zoom: number;
  };
  /** ID do fluxo atual */
  current_flow_id?: string;
  /** Modo do editor */
  editor_mode?: "view" | "edit" | "comment";
}

/**
 * Contexto completo do projeto (carregado do Supabase)
 */
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

/**
 * Resultado do roteamento
 */
export interface RouteResult {
  /** Modo determinado */
  mode: BrainMode;
  /** Modelo a ser usado */
  model: BrainModel;
  /** Indica se houve incerteza no roteamento determinístico */
  was_uncertain: boolean;
  /** Indica se classifier foi usado */
  used_classifier: boolean;
  /** Complexidade estimada (0-1) */
  complexity: number;
  /** Nível de risco */
  risk_level: RiskLevel;
  /** Indica se precisa de output estruturado */
  requires_structured_output: boolean;
  /** Indica se precisa usar ferramentas (db read, etc.) */
  needs_tool_use: boolean;
  /** Regras que levaram à decisão */
  routing_rules_applied: string[];
  /** Razão legível para o usuário */
  routing_reason: string;
}

/**
 * Resultado do classifier (segundo gate)
 */
export interface ClassifierResult {
  mode: BrainMode;
  complexity: number;
  requires_structured_output: boolean;
  needs_tool_use: boolean;
  risk_level: RiskLevel;
  confidence: number;
}

// ========================================
// CONFIGURAÇÃO DO MODELO
// ========================================

/**
 * Configuração do modelo por modo
 */
export interface ModelConfig {
  /** Modelo a usar */
  model: BrainModel;
  /** Esforço de reasoning (Responses API) */
  reasoning_effort: ReasoningEffort;
  /** Verbosidade do texto */
  text_verbosity: TextVerbosity;
  /** Max tokens de output */
  max_output_tokens: number;
  /** Nome do schema JSON (se aplicável) */
  json_schema_name?: string;
  /** Temperatura (0-2) */
  temperature: number;
  /** Cadeia de fallback em caso de erro */
  fallback_chain: BrainModel[];
}

/**
 * Configurações completas por modo
 */
export interface ModeConfigs {
  PLAN: ModelConfig;
  PLAN_PRO: ModelConfig;
  CONSULT: ModelConfig;
  BATCH: ModelConfig;
  LONG_CONTEXT: ModelConfig;
}

// ========================================
// MENSAGENS E THREADS
// ========================================

/**
 * Mensagem do Brain
 */
export interface BrainMessage {
  id: string;
  thread_id: string;
  project_id: number;
  role: "user" | "assistant" | "system";
  content: string;
  /** Output estruturado (se JSON) */
  structured_output?: BrainOutput | null;
  /** Metadados de execução */
  metadata: BrainMessageMetadata;
  created_at: string;
}

/**
 * Metadados da mensagem
 */
export interface BrainMessageMetadata {
  mode: BrainMode;
  model: BrainModel;
  reasoning_effort: ReasoningEffort;
  text_verbosity: TextVerbosity;
  routing_reason: string;
  /** Cadeia de fallback usada (se houve erro) */
  model_fallback_chain?: BrainModel[];
  /** Timings */
  latency_ms: number;
  time_to_first_token_ms?: number;
  /** Tokens */
  input_tokens: number;
  output_tokens: number;
  reasoning_tokens?: number;
  /** Flags */
  used_classifier: boolean;
  was_uncertain: boolean;
}

/**
 * Thread do Brain
 */
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
// OUTPUT DO BRAIN
// ========================================

/**
 * Output estruturado do Brain
 */
export interface BrainOutput {
  /** Resposta em markdown para o usuário */
  assistant_response_md: string;
  /** Ações a executar */
  actions: BrainAction[];
  /** Sumário do raciocínio */
  reasoning_summary?: string;
  /** Avisos e notas */
  warnings?: string[];
  /** Sugestões de follow-up */
  follow_up_suggestions?: string[];
}

/**
 * Ação do Brain
 */
export interface BrainAction {
  action_id: string;
  action_type: BrainActionType;
  /** Dados da ação (schema varia por tipo) */
  payload: unknown;
  /** Descrição legível */
  description: string;
  /** Indica se é reversível */
  reversible: boolean;
  /** Prioridade de execução */
  priority: number;
}

// ========================================
// CANVAS INTEGRATION
// ========================================

/**
 * Bloco do Brain no canvas
 */
export interface BrainCanvasBlock {
  id: string;
  project_id: number;
  thread_id: string;
  block_type: "brain_chat";
  /** Posição no canvas */
  position_x: number;
  position_y: number;
  /** Dimensões */
  width: number;
  height: number;
  /** Indica se está em streaming */
  streaming: boolean;
  /** Conteúdo atual (pode ser parcial durante streaming) */
  content: string;
  /** Metadados do modo */
  mode?: BrainMode;
  model?: BrainModel;
  /** Timestamps */
  created_at: string;
  updated_at: string;
}

// ========================================
// REQUESTS E RESPONSES
// ========================================

/**
 * Request para criar thread
 */
export interface BrainThreadCreateRequest {
  project_id: number;
  user_id: number;
  title?: string;
  initial_message?: string;
}

/**
 * Response de criar thread
 */
export interface BrainThreadCreateResponse {
  success: boolean;
  thread: BrainThread;
  message: string;
}

/**
 * Request para enviar mensagem
 */
export interface BrainMessageSendRequest {
  project_id: number;
  thread_id?: string; // Se não existir, cria novo thread
  user_prompt: string;
  editor_context?: EditorContext;
  /** Forçar modo específico (bypass roteamento) */
  force_mode?: BrainMode;
  /** Forçar modelo específico */
  force_model?: BrainModel;
}

/**
 * Response de enviar mensagem (não streaming)
 */
export interface BrainMessageSendResponse {
  success: boolean;
  thread_id: string;
  message: BrainMessage;
  output?: BrainOutput;
  actions_applied?: BrainActionResult[];
  canvas_block_id?: string;
  error?: string;
}

/**
 * Resultado da aplicação de ação
 */
export interface BrainActionResult {
  action_id: string;
  success: boolean;
  result?: unknown;
  error?: string;
}

/**
 * Request para buscar thread
 */
export interface BrainThreadGetRequest {
  thread_id: string;
  include_messages?: boolean;
  messages_limit?: number;
}

/**
 * Response de buscar thread
 */
export interface BrainThreadGetResponse {
  success: boolean;
  thread: BrainThread;
  messages?: BrainMessage[];
  message: string;
}

/**
 * Request para aplicar ações
 */
export interface BrainActionsApplyRequest {
  project_id: number;
  thread_id: string;
  message_id: string;
  action_ids?: string[]; // Se vazio, aplica todas
}

/**
 * Response de aplicar ações
 */
export interface BrainActionsApplyResponse {
  success: boolean;
  results: BrainActionResult[];
  message: string;
}

// ========================================
// BRAIN FLOW PLAN REQUESTS/RESPONSES
// ========================================

/**
 * Request para adicionar Brain Block
 */
export interface AddBrainBlockRequest {
  project_id: number;
  user_id: number;
  position_x?: number;
  position_y?: number;
  thread_id?: string;
  initial_prompt?: string;
}

/**
 * Response de adicionar Brain Block
 */
export interface AddBrainBlockResponse {
  success: boolean;
  canvas_block: BrainCanvasBlock;
  thread: BrainThread;
  message: string;
}

/**
 * Request para criar/atualizar plano
 */
export interface UpsertBrainFlowPlanRequest {
  project_id: number;
  thread_id: string;
  canvas_block_id: string;
  plan_md: string;
  plan_json: BrainFlowPlanJson;
  flow_key?: string;
  change_summary?: string;
}

/**
 * Response de criar/atualizar plano
 */
export interface UpsertBrainFlowPlanResponse {
  success: boolean;
  plan: BrainFlowPlan;
  is_new: boolean;
  message: string;
}

/**
 * Request para aprovar e buildar
 */
export interface ApproveAndBuildRequest {
  project_id: number;
  plan_id: string;
  approved_by: string;
}

/**
 * Response de aprovar e buildar
 */
export interface ApproveAndBuildResponse {
  success: boolean;
  plan: BrainFlowPlan;
  build_job_id?: string;
  message: string;
}

/**
 * Request para buscar plano por block
 */
export interface GetPlanByBlockRequest {
  canvas_block_id: string;
}

/**
 * Response de buscar plano por block
 */
export interface GetPlanByBlockResponse {
  success: boolean;
  plan?: BrainFlowPlan;
  versions?: { version: number; created_at: string; change_summary?: string }[];
  message: string;
}

// ========================================
// STREAMING EVENTS
// ========================================

/**
 * Evento de streaming do Brain
 */
export type BrainStreamEvent = 
  | BrainStreamStartEvent
  | BrainStreamDeltaEvent
  | BrainStreamMetadataEvent
  | BrainStreamCompleteEvent
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
  /** Índice acumulado */
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

export interface BrainStreamErrorEvent {
  type: "error";
  error: string;
  /** Modelo que falhou */
  failed_model?: BrainModel;
  /** Próximo modelo na cadeia de fallback */
  fallback_model?: BrainModel;
}

// ========================================
// ENVIRONMENT CONFIG
// ========================================

/**
 * Variáveis de ambiente do Brain Router
 */
export interface BrainEnvConfig {
  // Modelos por modo
  BRAIN_MODEL_PLAN: BrainModel;
  BRAIN_MODEL_PLAN_PRO: BrainModel;
  BRAIN_MODEL_CONSULT: BrainModel;
  BRAIN_MODEL_BATCH: BrainModel;
  BRAIN_MODEL_LONG: BrainModel;
  // Limiares
  BRAIN_LONG_CONTEXT_THRESHOLD: number;
  BRAIN_CLASSIFIER_ENABLED: boolean;
  BRAIN_HIGH_COMPLEXITY_THRESHOLD: number;
  // API Keys
  OPENAI_API_KEY: string;
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
}


