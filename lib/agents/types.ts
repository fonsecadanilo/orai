// Tipos para o sistema de agentes de IA - Integração com Supabase Edge Function

export interface FlowNode {
  id: string;
  type: "trigger" | "action" | "condition" | "input" | "wait" | "end" | "note" | "subflow" | "field_group";
  title: string;
  description?: string;
  position_x: number;
  position_y: number;
}

export interface FlowConnection {
  source_node_id: string;
  target_node_id: string;
}

export interface FlowRule {
  title: string;
  description: string;
  scope: "global" | "flow" | "node";
}

export interface FlowTask {
  title: string;
  description?: string;
  status: "todo" | "doing" | "done";
}

export interface GeneratedFlow {
  name: string;
  description: string;
  nodes: FlowNode[];
  connections: FlowConnection[];
  rules: FlowRule[];
  tasks: FlowTask[];
}

// Resposta da Edge Function flow-creator-agent
export interface FlowCreatorResponse {
  success: boolean;
  flow_id?: number;
  conversation_id?: string;
  generated_flow: GeneratedFlow;
  message: string;
}

// Request para a Edge Function
export interface FlowCreatorRequest {
  prompt: string;
  project_id: number;
  user_id: number;
  conversation_id?: string;
}

// Erro da API
export interface AgentError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

// Mensagem de conversa
export interface ConversationMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

// Conversa completa
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
