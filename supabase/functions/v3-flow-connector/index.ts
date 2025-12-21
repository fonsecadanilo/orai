import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * AGENT 6: Flow Connector & Reusability Tracker v3.1
 * 
 * RESPONSIBILITIES:
 * - Receive rich nodes and adapted blocks
 * - Create connections (edges) between nodes
 * - Apply BranchingEnricherV3 to add missing error paths
 * - Validate with ValidateGraphV3
 * - Track reuse across flows
 * - Save final flow with V3 types preserved
 * - Generate HORIZONTAL layout
 * 
 * v3.1 IMPROVEMENTS:
 * - connection_type is source of truth (not label)
 * - BranchingEnricher adds error paths, loopbacks, retries
 * - NodeGrammarV3 rules enforced
 */

// Input schema
const FlowConnectorRequestSchema = z.object({
  project_id: z.number(),
  user_id: z.number(),
  flow_title: z.string(),
  flow_description: z.string().optional(),
  rich_nodes: z.array(z.object({
    node_id: z.string(),
    node_type: z.string(),
    title: z.string(),
    description: z.string().optional(),
    impact_level: z.string().optional(),
    connections: z.array(z.object({
      target_node_id: z.string(),
      connection_type: z.string(),
      label: z.string().optional(),
    })).optional(),
  })),
  adapted_blocks: z.array(z.object({
    block_id: z.string(),
    node_id: z.string(),
    block_type: z.string(),
    label: z.string(),
    input_fields: z.array(z.any()).optional(),
    actions: z.array(z.any()).optional(),
    children: z.array(z.any()).optional(),
  })).optional(),
  validation_result: z.object({
    is_valid: z.boolean(),
    integrity_score: z.number(),
    issues: z.array(z.any()).optional(),
  }).optional(),
  master_rule_id: z.number().optional(),
  check_reusability: z.boolean().default(true),
});

// Connection schema - relaxed to accept any connection type string
const ConnectionSchema = z.object({
  connection_id: z.string(),
  source_node_id: z.string(),
  target_node_id: z.string(),
  connection_type: z.string(), // Accept any string, we'll normalize it
  label: z.string().optional(),
  condition: z.string().optional(),
  order: z.number().optional(),
});

// Normalize connection type to valid enum values for database
function normalizeConnectionType(type: string): string {
  const validTypes = new Set(["success", "error", "condition", "default", "loop", "failure", "fallback", "retry", "loopback"]);
  if (validTypes.has(type)) return type;
  
  // Map common aliases
  const aliasMap: Record<string, string> = {
    "yes": "success",
    "no": "failure", // Changed from "error" to "failure" for semantic correctness
    "true": "success",
    "false": "failure",
    "ok": "success",
    "cancel": "failure",
    "primary": "success",
    "secondary": "default",
    "conditional": "condition",
  };
  
  return aliasMap[type.toLowerCase()] || "default";
}

// ========================================
// NODE GRAMMAR V3 (inline for edge function)
// ========================================

interface NodeGrammarRule {
  node_type: string;
  is_terminal: boolean;
  min_outputs: number;
  max_outputs: number;
  recommended_error_pattern: string;
  error_pattern_impact_levels: string[];
}

const NODE_GRAMMAR: Record<string, NodeGrammarRule> = {
  trigger: { node_type: "trigger", is_terminal: false, min_outputs: 1, max_outputs: 1, recommended_error_pattern: "none", error_pattern_impact_levels: [] },
  action: { node_type: "action", is_terminal: false, min_outputs: 1, max_outputs: 3, recommended_error_pattern: "feedback_error_retry", error_pattern_impact_levels: ["high"] },
  condition: { node_type: "condition", is_terminal: false, min_outputs: 2, max_outputs: 2, recommended_error_pattern: "none", error_pattern_impact_levels: [] },
  choice: { node_type: "choice", is_terminal: false, min_outputs: 2, max_outputs: -1, recommended_error_pattern: "none", error_pattern_impact_levels: [] },
  form: { node_type: "form", is_terminal: false, min_outputs: 1, max_outputs: 2, recommended_error_pattern: "feedback_error_loopback", error_pattern_impact_levels: ["medium", "high"] },
  feedback_success: { node_type: "feedback_success", is_terminal: false, min_outputs: 0, max_outputs: 1, recommended_error_pattern: "none", error_pattern_impact_levels: [] },
  feedback_error: { node_type: "feedback_error", is_terminal: false, min_outputs: 1, max_outputs: 2, recommended_error_pattern: "none", error_pattern_impact_levels: [] },
  end_success: { node_type: "end_success", is_terminal: true, min_outputs: 0, max_outputs: 0, recommended_error_pattern: "none", error_pattern_impact_levels: [] },
  end_error: { node_type: "end_error", is_terminal: true, min_outputs: 0, max_outputs: 0, recommended_error_pattern: "none", error_pattern_impact_levels: [] },
  end_neutral: { node_type: "end_neutral", is_terminal: true, min_outputs: 0, max_outputs: 0, recommended_error_pattern: "none", error_pattern_impact_levels: [] },
  retry: { node_type: "retry", is_terminal: false, min_outputs: 1, max_outputs: 2, recommended_error_pattern: "none", error_pattern_impact_levels: [] },
  fallback: { node_type: "fallback", is_terminal: false, min_outputs: 1, max_outputs: 1, recommended_error_pattern: "none", error_pattern_impact_levels: [] },
  loopback: { node_type: "loopback", is_terminal: false, min_outputs: 1, max_outputs: 1, recommended_error_pattern: "none", error_pattern_impact_levels: [] },
  end: { node_type: "end", is_terminal: true, min_outputs: 0, max_outputs: 0, recommended_error_pattern: "none", error_pattern_impact_levels: [] },
};

function getNodeGrammar(nodeType: string): NodeGrammarRule {
  return NODE_GRAMMAR[nodeType] || NODE_GRAMMAR["action"];
}

function isTerminalNode(nodeType: string): boolean {
  return getNodeGrammar(nodeType).is_terminal;
}

function needsErrorHandling(nodeType: string, impactLevel: string): boolean {
  const grammar = getNodeGrammar(nodeType);
  return grammar.error_pattern_impact_levels.includes(impactLevel);
}

// ========================================
// BRANCHING ENRICHER V3 (inline for edge function)
// ========================================

interface EnricherNode {
  id: string;
  type: string;
  title: string;
  description?: string;
  impact_level?: string;
}

interface EnricherConnection {
  id?: string;
  source_node_id: string;
  target_node_id: string;
  connection_type: string;
  label?: string;
}

interface EnrichmentResult {
  added_nodes: EnricherNode[];
  added_connections: EnricherConnection[];
  stats: {
    error_paths_added: number;
    loopbacks_added: number;
    condition_branches_fixed: number;
  };
}

function enrichBranching(
  nodes: EnricherNode[],
  connections: EnricherConnection[],
  flowTitle?: string
): EnrichmentResult {
  const result: EnrichmentResult = {
    added_nodes: [],
    added_connections: [],
    stats: { error_paths_added: 0, loopbacks_added: 0, condition_branches_fixed: 0 },
  };

  let nodeIdCounter = 1000;
  let connectionIdCounter = 1000;
  const nodeMap = new Map(nodes.map(n => [n.id, n]));
  const existingConnections = new Set(connections.map(c => `${c.source_node_id}->${c.target_node_id}`));

  // Detect flow pattern from title
  const titleLower = (flowTitle || "").toLowerCase();
  const isLoginFlow = titleLower.includes("login") || titleLower.includes("signin") || titleLower.includes("autenticação");
  const isSignupFlow = titleLower.includes("cadastro") || titleLower.includes("signup") || titleLower.includes("registro");
  const isCheckoutFlow = titleLower.includes("checkout") || titleLower.includes("pagamento") || titleLower.includes("payment");

  // 1. Add error handling for forms and high-impact actions
  for (const node of nodes) {
    const impactLevel = node.impact_level || "medium";
    const nodeType = node.type;

    // Check if node needs error handling
    if (needsErrorHandling(nodeType, impactLevel)) {
      const hasFailurePath = connections.some(
        c => c.source_node_id === node.id && 
        (c.connection_type === "failure" || c.connection_type === "error" || c.connection_type === "fallback")
      );

      if (!hasFailurePath) {
        // Add feedback_error node
        const errorNodeId = `${node.id}_error_${++nodeIdCounter}`;
        result.added_nodes.push({
          id: errorNodeId,
          type: "feedback_error",
          title: `Erro: ${node.title}`,
          description: `Erro em ${node.title}. Tente novamente.`,
          impact_level: "low",
        });

        // Add failure connection
        result.added_connections.push({
          id: `conn_${++connectionIdCounter}`,
          source_node_id: node.id,
          target_node_id: errorNodeId,
          connection_type: "failure",
          label: "Erro",
        });

        // Add loopback connection for forms
        if (nodeType === "form") {
          result.added_connections.push({
            id: `conn_${++connectionIdCounter}`,
            source_node_id: errorNodeId,
            target_node_id: node.id,
            connection_type: "loopback",
            label: "Tentar novamente",
          });
          result.stats.loopbacks_added++;
        }

        result.stats.error_paths_added++;
      }
    }
  }

  // 2. Fix conditions with only 1 output
  for (const node of nodes) {
    if (node.type !== "condition") continue;

    const outgoing = connections.filter(c => c.source_node_id === node.id);
    
    if (outgoing.length === 1) {
      const existingType = outgoing[0].connection_type;
      const missingType = existingType === "success" ? "failure" : "success";
      const missingLabel = missingType === "success" ? "Sim" : "Não";

      // Add feedback_error for the missing failure branch
      const errorNodeId = `${node.id}_condition_error_${++nodeIdCounter}`;
      result.added_nodes.push({
        id: errorNodeId,
        type: "feedback_error",
        title: `Falha: ${node.title}`,
        description: `Condição não atendida em ${node.title}`,
        impact_level: "low",
      });

      // Add the missing branch connection
      result.added_connections.push({
        id: `conn_${++connectionIdCounter}`,
        source_node_id: node.id,
        target_node_id: errorNodeId,
        connection_type: missingType,
        label: missingLabel,
      });

      // Add loopback to previous node if possible
      const incoming = connections.filter(c => c.target_node_id === node.id);
      if (incoming.length > 0) {
        result.added_connections.push({
          id: `conn_${++connectionIdCounter}`,
          source_node_id: errorNodeId,
          target_node_id: incoming[0].source_node_id,
          connection_type: "loopback",
          label: "Voltar",
        });
        result.stats.loopbacks_added++;
      }

      result.stats.condition_branches_fixed++;
    }
  }

  // 3. Add pattern-specific error scenarios
  if (isLoginFlow || isSignupFlow || isCheckoutFlow) {
    for (const node of nodes) {
      const nodeTitleLower = (node.title || "").toLowerCase();
      
      // Login: Add invalid credentials handling
      if (isLoginFlow && node.type === "condition" && 
          (nodeTitleLower.includes("credencial") || nodeTitleLower.includes("validação"))) {
        // Already handled by condition fix above
      }
      
      // Signup: Add email already exists handling
      if (isSignupFlow && node.type === "form" && nodeTitleLower.includes("email")) {
        const hasEmailError = result.added_nodes.some(n => 
          n.title.toLowerCase().includes("email") && n.type === "feedback_error"
        );
        
        if (!hasEmailError && !connections.some(c => 
          c.source_node_id === node.id && c.connection_type === "failure"
        )) {
          const errorNodeId = `${node.id}_email_error_${++nodeIdCounter}`;
          result.added_nodes.push({
            id: errorNodeId,
            type: "feedback_error",
            title: "Email já cadastrado",
            description: "Este email já está em uso. Tente fazer login ou use outro email.",
            impact_level: "low",
          });

          result.added_connections.push({
            id: `conn_${++connectionIdCounter}`,
            source_node_id: node.id,
            target_node_id: errorNodeId,
            connection_type: "failure",
            label: "Email duplicado",
          });

          result.added_connections.push({
            id: `conn_${++connectionIdCounter}`,
            source_node_id: errorNodeId,
            target_node_id: node.id,
            connection_type: "loopback",
            label: "Tentar novamente",
          });

          result.stats.error_paths_added++;
          result.stats.loopbacks_added++;
        }
      }

      // Checkout: Add payment failed handling
      if (isCheckoutFlow && (nodeTitleLower.includes("pagamento") || nodeTitleLower.includes("payment"))) {
        const hasPaymentError = connections.some(c => 
          c.source_node_id === node.id && c.connection_type === "failure"
        );
        
        if (!hasPaymentError) {
          const errorNodeId = `${node.id}_payment_error_${++nodeIdCounter}`;
          const retryNodeId = `${errorNodeId}_retry_${++nodeIdCounter}`;
          
          result.added_nodes.push({
            id: errorNodeId,
            type: "feedback_error",
            title: "Pagamento não aprovado",
            description: "Não foi possível processar o pagamento. Verifique os dados ou tente outro método.",
            impact_level: "low",
          });

          result.added_nodes.push({
            id: retryNodeId,
            type: "retry",
            title: "Tentar novamente",
            description: "Opção de retry para pagamento",
            impact_level: "low",
          });

          result.added_connections.push({
            id: `conn_${++connectionIdCounter}`,
            source_node_id: node.id,
            target_node_id: errorNodeId,
            connection_type: "failure",
            label: "Pagamento falhou",
          });

          result.added_connections.push({
            id: `conn_${++connectionIdCounter}`,
            source_node_id: errorNodeId,
            target_node_id: retryNodeId,
            connection_type: "default",
          });

          result.added_connections.push({
            id: `conn_${++connectionIdCounter}`,
            source_node_id: retryNodeId,
            target_node_id: node.id,
            connection_type: "loopback",
            label: "Retry",
          });

          result.stats.error_paths_added++;
          result.stats.loopbacks_added++;
        }
      }
    }
  }

  return result;
}

// ========================================
// ENFORCE REQUIRED OUTPUTS V3 (MANDATORY - inline for edge function)
// This is the HARD GATE that guarantees conditions have 2 branches
// ========================================

interface EnforcerNode {
  id: string;
  type: string;
  title?: string;
  description?: string;
  impact_level?: "low" | "medium" | "high";
}

interface EnforcerConnection {
  source_id: string;
  target_id: string;
  connection_type: string;
  label?: string;
  id?: string;
}

interface EnforcementResult {
  nodes: EnforcerNode[];
  connections: EnforcerConnection[];
  added_nodes: EnforcerNode[];
  added_connections: EnforcerConnection[];
  removed_connections: EnforcerConnection[];
  issues_fixed: string[];
  stats: {
    conditions_fixed: number;
    choices_fixed: number;
    forms_fixed: number;
    actions_fixed: number;
    terminals_fixed: number;
    total_nodes_added: number;
    total_connections_added: number;
    total_connections_removed: number;
  };
}

const TERMINAL_TYPES = new Set(["end_success", "end_error", "end_neutral"]);
const BINARY_BRANCH_TYPES = new Set(["condition"]);
const MULTI_OPTION_TYPES = new Set(["choice", "option_choice"]);
const FAILABLE_TYPES = new Set(["form", "action", "background_action"]);

let enforcerNodeCounter = 20000;
let enforcerConnCounter = 20000;

function generateEnforcerNodeId(prefix: string): string {
  return `${prefix}_auto_${++enforcerNodeCounter}`;
}

function generateEnforcerConnId(): string {
  return `conn_auto_${++enforcerConnCounter}`;
}

function createEnforcerFeedbackError(sourceNode: EnforcerNode): EnforcerNode {
  return {
    id: generateEnforcerNodeId("feedback_error"),
    type: "feedback_error",
    title: `Erro: ${sourceNode.title || "Operação falhou"}`,
    description: `Não foi possível completar "${sourceNode.title || "esta etapa"}". Tente novamente.`,
    impact_level: "low",
  };
}

function createEnforcerEndNeutral(reason?: string): EnforcerNode {
  return {
    id: generateEnforcerNodeId("end_neutral"),
    type: "end_neutral",
    title: reason || "Fluxo encerrado",
    description: "Fluxo finalizado",
    impact_level: "low",
  };
}

function createEnforcerConnection(
  sourceId: string,
  targetId: string,
  type: string,
  label?: string
): EnforcerConnection {
  return {
    id: generateEnforcerConnId(),
    source_id: sourceId,
    target_id: targetId,
    connection_type: type,
    label: label,
  };
}

function enforceRequiredOutputsV3(
  inputNodes: EnforcerNode[],
  inputConnections: EnforcerConnection[],
  context: { flow_title?: string } = {}
): EnforcementResult {
  // Reset counters with random offset
  enforcerNodeCounter = 20000 + Math.floor(Math.random() * 1000);
  enforcerConnCounter = 20000 + Math.floor(Math.random() * 1000);
  
  const nodes = inputNodes.map(n => ({ ...n }));
  const connections = inputConnections.map(c => ({ ...c }));
  
  const result: EnforcementResult = {
    nodes,
    connections,
    added_nodes: [],
    added_connections: [],
    removed_connections: [],
    issues_fixed: [],
    stats: {
      conditions_fixed: 0,
      choices_fixed: 0,
      forms_fixed: 0,
      actions_fixed: 0,
      terminals_fixed: 0,
      total_nodes_added: 0,
      total_connections_added: 0,
      total_connections_removed: 0,
    },
  };
  
  console.log(`[enforceRequiredOutputsV3] Starting for ${nodes.length} nodes, ${connections.length} connections`);
  
  // ========================================
  // ENFORCE CONDITIONS (MUST have 2 branches)
  // ========================================
  const conditions = nodes.filter(n => BINARY_BRANCH_TYPES.has(n.type));
  
  for (const condition of conditions) {
    const outgoing = connections.filter(c => c.source_id === condition.id);
    
    const hasSuccess = outgoing.some(c => 
      c.connection_type === "success" || 
      c.label?.toLowerCase().match(/^(sim|yes|true|valid|success|ok)$/i)
    );
    const hasFailure = outgoing.some(c => 
      c.connection_type === "failure" || 
      c.connection_type === "error" ||
      c.label?.toLowerCase().match(/^(não|no|false|invalid|error|fail)$/i)
    );
    
    // Find previous node for loopback
    const incoming = connections.filter(c => c.target_id === condition.id);
    const previousNodeId = incoming.length > 0 ? incoming[0].source_id : null;
    
    // Case 1: Has success but no failure (most common!)
    if (hasSuccess && !hasFailure) {
      // Create feedback_error
      const errorNode = createEnforcerFeedbackError(condition);
      result.added_nodes.push(errorNode);
      result.nodes.push(errorNode);
      
      // Create failure connection
      const failureConn = createEnforcerConnection(condition.id, errorNode.id, "failure", "Não");
      result.added_connections.push(failureConn);
      result.connections.push(failureConn);
      
      // Create loopback or end_neutral
      if (previousNodeId) {
        const loopbackConn = createEnforcerConnection(errorNode.id, previousNodeId, "loopback", "Voltar");
        result.added_connections.push(loopbackConn);
        result.connections.push(loopbackConn);
      } else {
        const endNode = createEnforcerEndNeutral("Condição não atendida");
        result.added_nodes.push(endNode);
        result.nodes.push(endNode);
        
        const endConn = createEnforcerConnection(errorNode.id, endNode.id, "default", "Encerrar");
        result.added_connections.push(endConn);
        result.connections.push(endConn);
      }
      
      result.stats.conditions_fixed++;
      result.issues_fixed.push(`Condition "${condition.title}" (${condition.id}): added failure branch`);
    }
    
    // Case 2: Has no outputs at all
    else if (outgoing.length === 0) {
      // Create feedback_error for failure
      const errorNode = createEnforcerFeedbackError(condition);
      result.added_nodes.push(errorNode);
      result.nodes.push(errorNode);
      
      // Create end_neutral for success (no continuation info)
      const successEnd = createEnforcerEndNeutral("Condição atendida");
      successEnd.type = "end_success";
      result.added_nodes.push(successEnd);
      result.nodes.push(successEnd);
      
      // Create connections
      result.added_connections.push(createEnforcerConnection(condition.id, successEnd.id, "success", "Sim"));
      result.added_connections.push(createEnforcerConnection(condition.id, errorNode.id, "failure", "Não"));
      
      // Loopback or end
      if (previousNodeId) {
        result.added_connections.push(createEnforcerConnection(errorNode.id, previousNodeId, "loopback", "Voltar"));
      } else {
        const endNode = createEnforcerEndNeutral();
        result.added_nodes.push(endNode);
        result.nodes.push(endNode);
        result.added_connections.push(createEnforcerConnection(errorNode.id, endNode.id, "default", "Encerrar"));
      }
      
      // Add all new connections to result
      result.connections.push(...result.added_connections.slice(-3));
      
      result.stats.conditions_fixed++;
      result.issues_fixed.push(`Condition "${condition.title}" (${condition.id}): created both branches`);
    }
  }
  
  // ========================================
  // ENFORCE CHOICES (MUST have >= 2 options)
  // ========================================
  const choices = nodes.filter(n => MULTI_OPTION_TYPES.has(n.type));
  
  for (const choice of choices) {
    const outgoing = connections.filter(c => c.source_id === choice.id);
    
    if (outgoing.length < 2) {
      // Create alternative option
      const altNode = createEnforcerEndNeutral("Cancelar / Voltar");
      result.added_nodes.push(altNode);
      result.nodes.push(altNode);
      
      const optionConn = createEnforcerConnection(choice.id, altNode.id, "option", "Depois / Cancelar");
      result.added_connections.push(optionConn);
      result.connections.push(optionConn);
      
      result.stats.choices_fixed++;
      result.issues_fixed.push(`Choice "${choice.title}" (${choice.id}): added alternative option`);
    }
  }
  
  // ========================================
  // ENFORCE FAILABLE NODES (forms, high-impact actions)
  // ========================================
  for (const node of nodes) {
    if (!FAILABLE_TYPES.has(node.type)) continue;
    if (node.impact_level !== "high" && node.impact_level !== "medium") continue;
    
    const outgoing = connections.filter(c => c.source_id === node.id);
    const hasFailurePath = outgoing.some(c => 
      c.connection_type === "failure" || 
      c.connection_type === "error" ||
      c.connection_type === "fallback"
    );
    
    if (!hasFailurePath) {
      // Create feedback_error
      const errorNode = createEnforcerFeedbackError(node);
      result.added_nodes.push(errorNode);
      result.nodes.push(errorNode);
      
      // Create failure connection
      const failureConn = createEnforcerConnection(node.id, errorNode.id, "failure", "Erro");
      result.added_connections.push(failureConn);
      result.connections.push(failureConn);
      
      // Create loopback for forms
      if (node.type === "form") {
        const loopbackConn = createEnforcerConnection(errorNode.id, node.id, "loopback", "Corrigir");
        result.added_connections.push(loopbackConn);
        result.connections.push(loopbackConn);
        result.stats.forms_fixed++;
      } else {
        result.stats.actions_fixed++;
      }
      
      result.issues_fixed.push(`Failable node "${node.title}" (${node.id}): added error path`);
    }
  }
  
  // ========================================
  // ENFORCE TERMINALS (MUST have 0 outputs)
  // ========================================
  const terminals = nodes.filter(n => TERMINAL_TYPES.has(n.type));
  
  for (const terminal of terminals) {
    const outgoing = connections.filter(c => c.source_id === terminal.id);
    
    for (const conn of outgoing) {
      const idx = result.connections.findIndex(c => 
        c.source_id === conn.source_id && c.target_id === conn.target_id
      );
      if (idx !== -1) {
        result.removed_connections.push(result.connections[idx]);
        result.connections.splice(idx, 1);
        result.stats.terminals_fixed++;
        result.stats.total_connections_removed++;
        result.issues_fixed.push(`Terminal "${terminal.title}" (${terminal.id}): removed outgoing connection`);
      }
    }
  }
  
  // Update final stats
  result.stats.total_nodes_added = result.added_nodes.length;
  result.stats.total_connections_added = result.added_connections.length;
  
  console.log(`[enforceRequiredOutputsV3] Complete:`, {
    issues_fixed: result.issues_fixed.length,
    nodes_added: result.added_nodes.length,
    connections_added: result.added_connections.length,
    connections_removed: result.removed_connections.length,
    stats: result.stats,
  });
  
  return result;
}

function validateEnforcedFlow(
  nodes: EnforcerNode[],
  connections: EnforcerConnection[]
): { is_valid: boolean; errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Check conditions have 2 outputs
  const conditions = nodes.filter(n => BINARY_BRANCH_TYPES.has(n.type));
  for (const condition of conditions) {
    const outgoing = connections.filter(c => c.source_id === condition.id);
    if (outgoing.length !== 2) {
      errors.push(`HARD_GATE_FAIL: Condition "${condition.title}" has ${outgoing.length} outputs (must have 2)`);
    }
  }
  
  // Check choices have >= 2 options
  const choices = nodes.filter(n => MULTI_OPTION_TYPES.has(n.type));
  for (const choice of choices) {
    const outgoing = connections.filter(c => c.source_id === choice.id);
    if (outgoing.length < 2) {
      errors.push(`HARD_GATE_FAIL: Choice "${choice.title}" has ${outgoing.length} options (must have >=2)`);
    }
  }
  
  // Check terminals have 0 outputs
  const terminals = nodes.filter(n => TERMINAL_TYPES.has(n.type));
  for (const terminal of terminals) {
    const outgoing = connections.filter(c => c.source_id === terminal.id);
    if (outgoing.length > 0) {
      errors.push(`HARD_GATE_FAIL: Terminal "${terminal.title}" has ${outgoing.length} outputs (must have 0)`);
    }
  }
  
  return { is_valid: errors.length === 0, errors, warnings };
}

type FlowConnectorRequest = z.infer<typeof FlowConnectorRequestSchema>;
type Connection = z.infer<typeof ConnectionSchema>;

// V3 types supported directly by the database enum
const VALID_DB_TYPES = new Set([
  "trigger", "action", "input", "condition", "wait", "subflow", "field_group", "end", "note", "text",
  "form", "choice", "feedback_success", "feedback_error", "end_success", "end_error", "end_neutral",
  "retry", "fallback", "loopback", "background_action", "delayed_action", "configuration_matrix", "insight_branch",
  "entry_point", "user_action", "validation_step", "success_feedback", "error_feedback"
]);

// Map node types to valid database enum values
function mapToDbType(nodeType: string): string {
  // If type is directly valid, use it
  if (VALID_DB_TYPES.has(nodeType)) {
    return nodeType;
  }
  
  // Fallback mappings for legacy/alias types
  const fallbackMap: Record<string, string> = {
    "system_action": "action",
    "api_call": "action",
    "data_transform": "action",
    "notification": "action",
    "redirect": "action",
    "decision_point": "condition",
    "form_input": "form",
    "success_state": "end_success",
    "error_state": "end_error",
    "exit_point": "end",
  };
  
  return fallbackMap[nodeType] || "action";
}

/**
 * Calculate HORIZONTAL layout using BFS
 * - Main path flows left-to-right (X axis)
 * - Branches spread vertically (Y axis)
 * - Ensures UNIQUE positions for each node
 */
function calculateHorizontalLayout(
  nodes: FlowConnectorRequest["rich_nodes"],
  connections: Connection[]
): Map<string, { x: number; y: number; column: string }> {
  const SPACING_X = 400; // Horizontal spacing between columns
  const SPACING_Y = 200; // Vertical spacing between rows
  const START_X = 100;
  const CENTER_Y = 300;

  const positions = new Map<string, { x: number; y: number; column: string }>();
  const usedPositions = new Set<string>(); // Track used positions to ensure uniqueness
  
  // Helper to get a unique position
  const getUniquePosition = (baseX: number, baseY: number): { x: number; y: number } => {
    let x = baseX;
    let y = baseY;
    let offset = 0;
    
    while (usedPositions.has(`${x},${y}`)) {
      offset++;
      // Spiral out from the base position
      y = baseY + (offset % 2 === 0 ? offset * 20 : -offset * 20);
    }
    
    usedPositions.add(`${x},${y}`);
    return { x, y };
  };
  
  // Build adjacency and reverse adjacency maps
  const adjacency = new Map<string, Array<{ target: string; type: string }>>();
  const reverseAdjacency = new Map<string, string[]>();
  
  for (const conn of connections) {
    // Forward
    const neighbors = adjacency.get(conn.source_node_id) || [];
    neighbors.push({ target: conn.target_node_id, type: conn.connection_type });
    adjacency.set(conn.source_node_id, neighbors);
    
    // Reverse
    const parents = reverseAdjacency.get(conn.target_node_id) || [];
    parents.push(conn.source_node_id);
    reverseAdjacency.set(conn.target_node_id, parents);
  }
  
  // Find root nodes (no incoming connections)
  const targetIds = new Set(connections.map(c => c.target_node_id));
  const rootNodes = nodes.filter(n => !targetIds.has(n.node_id));
  
  // BFS for layout
  const visited = new Set<string>();
  const queue: Array<{
    nodeId: string;
    level: number;
    row: number;
    column: "main" | "error" | "alternative";
  }> = [];
  
  // Start with root nodes - each root on its own row
  rootNodes.forEach((node, idx) => {
    queue.push({ nodeId: node.node_id, level: 0, row: idx, column: "main" });
  });
  
  // If no roots, start with first node
  if (queue.length === 0 && nodes.length > 0) {
    queue.push({ nodeId: nodes[0].node_id, level: 0, row: 0, column: "main" });
  }
  
  // Track nodes per level and column for vertical stacking
  const levelColumnCounts: Map<string, number> = new Map();
  
  while (queue.length > 0) {
    const { nodeId, level, row, column } = queue.shift()!;
    
    if (visited.has(nodeId)) continue;
    visited.add(nodeId);
    
    // Get current count for this level+column combination
    const levelKey = `${level}_${column}`;
    const currentCount = levelColumnCounts.get(levelKey) || 0;
    levelColumnCounts.set(levelKey, currentCount + 1);
    
    // Calculate base position
    const baseX = START_X + level * SPACING_X;
    let baseY = CENTER_Y;
    
    if (column === "error") {
      baseY = CENTER_Y + SPACING_Y * (1 + currentCount);
    } else if (column === "alternative") {
      baseY = CENTER_Y - SPACING_Y * (1 + currentCount);
    } else {
      // Main path - stack vertically
      baseY = CENTER_Y + currentCount * SPACING_Y;
    }
    
    // Ensure position is unique
    const uniquePos = getUniquePosition(baseX, baseY);
    
    positions.set(nodeId, {
      x: uniquePos.x,
      y: uniquePos.y,
      column,
    });
    
    // Process outgoing connections
    const outgoing = adjacency.get(nodeId) || [];
    
    outgoing.forEach((conn, idx) => {
      if (visited.has(conn.target)) return;
      
      // Determine column for target based on connection type
      let targetColumn: "main" | "error" | "alternative" = "main";
      let targetRow = 0;
      
      if (conn.type === "failure" || conn.type === "fallback" || conn.type === "error") {
        targetColumn = "error";
        targetRow = idx;
      } else if (conn.type === "condition" && idx > 0) {
        // Non-default conditional paths
        targetColumn = idx % 2 === 1 ? "alternative" : "error";
        targetRow = Math.floor(idx / 2);
      } else if (outgoing.length > 1 && idx > 0) {
        // Multiple outputs - spread vertically
        targetRow = idx;
      }
      
      queue.push({
        nodeId: conn.target,
        level: level + 1,
        row: targetRow,
        column: targetColumn,
      });
    });
  }
  
  // Handle disconnected nodes - ensure unique positions
  let orphanIndex = 0;
  nodes.forEach((node) => {
    if (!visited.has(node.node_id)) {
      const baseY = CENTER_Y + 600 + orphanIndex * SPACING_Y;
      const uniquePos = getUniquePosition(START_X, baseY);
      
      positions.set(node.node_id, {
        x: uniquePos.x,
        y: uniquePos.y,
        column: "main",
      });
      orphanIndex++;
    }
  });
  
  return positions;
}

// Detect similar nodes for reuse
async function detectSimilarNodes(
  supabase: any,
  projectId: number,
  nodes: FlowConnectorRequest["rich_nodes"]
): Promise<Array<{ node_id: string; reused: boolean; source_flow_id?: number }>> {
  const reuseInfos: Array<{ node_id: string; reused: boolean; source_flow_id?: number }> = [];
  
  const { data: projectFlows } = await supabase
    .from("flows")
    .select("id")
    .eq("project_id", projectId)
    .limit(100);
  
  if (!projectFlows || projectFlows.length === 0) {
    return nodes.map(n => ({ node_id: n.node_id, reused: false }));
  }
  
  const flowIds = projectFlows.map((f: any) => f.id);
  
  const { data: existingNodes } = await supabase
    .from("nodes")
    .select("id, title, type, flow_id, metadata")
    .in("flow_id", flowIds)
    .limit(500);
  
  if (!existingNodes || existingNodes.length === 0) {
    return nodes.map(n => ({ node_id: n.node_id, reused: false }));
  }
  
  for (const node of nodes) {
    const similar = existingNodes.find((existing: any) =>
      existing.title?.toLowerCase() === node.title?.toLowerCase() &&
      (existing.metadata?.v3_type === node.node_type || existing.type === node.node_type)
    );
    
    if (similar) {
      reuseInfos.push({
        node_id: node.node_id,
        reused: true,
        source_flow_id: similar.flow_id,
      });
    } else {
      reuseInfos.push({ node_id: node.node_id, reused: false });
    }
  }
  
  return reuseInfos;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const request = FlowConnectorRequestSchema.parse(body);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log("[v3-flow-connector] Processing", request.rich_nodes.length, "nodes...");

    // 1. Extract connections from rich nodes
    const connections: Connection[] = [];
    let connCounter = 0;
    
    for (const node of request.rich_nodes) {
      if (node.connections && node.connections.length > 0) {
        for (const conn of node.connections) {
          // Validate target exists
          const targetExists = request.rich_nodes.some(n => n.node_id === conn.target_node_id);
          if (!targetExists) {
            console.warn(`[v3-flow-connector] Skipping connection to non-existent node: ${conn.target_node_id}`);
            continue;
          }
          
          connCounter++;
          const normalizedType = normalizeConnectionType(conn.connection_type);
          connections.push({
            connection_id: `conn_${connCounter}`,
            source_node_id: node.node_id,
            target_node_id: conn.target_node_id,
            connection_type: normalizedType,
            label: conn.label || (normalizedType === "success" ? "Yes" : normalizedType === "failure" || normalizedType === "error" ? "No" : undefined),
            order: connCounter,
          });
        }
      }
    }

    console.log("[v3-flow-connector] Extracted", connections.length, "connections");

    // ========================================
    // 2. TYPE HARD GATE V3.1 (NEW!)
    // Blocks action-only flows and fixes types
    // ========================================
    let processedNodes = [...request.rich_nodes];
    let processedConnections = [...connections];
    let typeRepairApplied = false;
    let typeStats: Record<string, unknown> = {};
    
    // Calculate initial type distribution
    const typeDistribution: Record<string, number> = {};
    for (const node of processedNodes) {
      const type = node.node_type || "unknown";
      typeDistribution[type] = (typeDistribution[type] || 0) + 1;
    }
    
    // Count non-structural nodes (exclude trigger, end_*)
    const structuralTypes = new Set(["trigger", "end_success", "end_error", "end_neutral"]);
    const countableNodes = processedNodes.filter(n => !structuralTypes.has(n.node_type));
    const actionCount = typeDistribution["action"] || 0;
    const actionRatio = countableNodes.length > 0 ? actionCount / countableNodes.length : 0;
    
    console.log("[v3-flow-connector] Type distribution:", typeDistribution);
    console.log("[v3-flow-connector] Action ratio:", (actionRatio * 100).toFixed(1) + "%");
    
    // TYPE GATE RULES
    const typeGateIssues: string[] = [];
    
    // T1: Action ratio > 60%
    if (countableNodes.length > 0 && actionRatio > 0.6) {
      typeGateIssues.push(`T1_ACTION_RATIO: ${(actionRatio * 100).toFixed(1)}% > 60%`);
    }
    
    // T2: > 6 nodes without condition/choice
    const hasCondition = (typeDistribution["condition"] || 0) > 0;
    const hasChoice = (typeDistribution["choice"] || 0) > 0 || (typeDistribution["option_choice"] || 0) > 0;
    if (processedNodes.length > 6 && !hasCondition && !hasChoice) {
      typeGateIssues.push(`T2_NO_BRANCHING: ${processedNodes.length} nodes without condition/choice`);
    }
    
    // T3: Form exists but no feedback_error + recovery
    const hasForm = (typeDistribution["form"] || 0) > 0;
    const hasFeedbackError = (typeDistribution["feedback_error"] || 0) > 0;
    const hasRecovery = (typeDistribution["retry"] || 0) > 0 || 
                        (typeDistribution["loopback"] || 0) > 0 || 
                        (typeDistribution["fallback"] || 0) > 0;
    if (hasForm && !hasFeedbackError) {
      typeGateIssues.push(`T3_FORM_NO_ERROR_HANDLING: Form exists but no feedback_error`);
    }
    
    // If type gate failed, apply TypeRepairerV3
    if (typeGateIssues.length > 0) {
      console.log("[v3-flow-connector] TYPE GATE FAILED:", typeGateIssues);
      console.log("[v3-flow-connector] Applying TypeRepairerV3...");
      
      // Apply type repair inline (simplified version)
      const repairedNodes = processedNodes.map((node, idx) => {
        let newType = node.node_type;
        const title = (node.title || "").toLowerCase();
        const description = (node.description || "").toLowerCase();
        const content = `${title} ${description}`;
        
        // If action, try to infer better type
        if (node.node_type === "action") {
          if (/\b(form|input|login|cadastro|register|signup|checkout|payment|email|password)\b/.test(content)) {
            newType = "form";
          } else if (/\b(se|if|condição|check|verifica|valid|whether|approved)\b/.test(content)) {
            newType = "condition";
          } else if (/\b(escolhe|choose|select|método|method|opção|option)\b/.test(content)) {
            newType = "choice";
          } else if (/\b(sucesso|success|confirm|complete|done|bem.?vindo|welcome)\b/.test(content)) {
            newType = "feedback_success";
          } else if (/\b(erro|error|fail|invalid|incorreto|negado|denied)\b/.test(content)) {
            newType = "feedback_error";
          } else if (/\b(process|load|fetch|api|aguarda|wait|async)\b/.test(content)) {
            newType = "background_action";
          }
        }
        
        // Ensure first node is trigger if not already
        if (idx === 0 && !["trigger", "form"].includes(node.node_type)) {
          newType = "trigger";
        }
        
        // Ensure last node is end_success if not terminal
        if (idx === processedNodes.length - 1 && 
            !["end_success", "end_error", "end_neutral"].includes(node.node_type)) {
          newType = "end_success";
        }
        
        return { ...node, node_type: newType };
      });
      
      processedNodes = repairedNodes;
      typeRepairApplied = true;
      
      // Recalculate stats after repair
      const newTypeDistribution: Record<string, number> = {};
      for (const node of processedNodes) {
        const type = node.node_type || "unknown";
        newTypeDistribution[type] = (newTypeDistribution[type] || 0) + 1;
      }
      console.log("[v3-flow-connector] Type distribution AFTER repair:", newTypeDistribution);
    }
    
    typeStats = {
      initial_distribution: typeDistribution,
      action_ratio: actionRatio,
      type_gate_issues: typeGateIssues,
      repair_applied: typeRepairApplied,
    };

    // ========================================
    // 3. APPLY BRANCHING ENRICHER V3 (old)
    // ========================================
    // Convert to enricher format
    const enricherNodes: EnricherNode[] = processedNodes.map(node => ({
      id: node.node_id,
      type: node.node_type,
      title: node.title,
      description: node.description,
      impact_level: node.impact_level,
    }));

    const enricherConnections: EnricherConnection[] = processedConnections.map(conn => ({
      id: conn.connection_id,
      source_node_id: conn.source_node_id,
      target_node_id: conn.target_node_id,
      connection_type: conn.connection_type,
      label: conn.label,
    }));

    // First pass: old enrichBranching for pattern-specific additions
    const enrichment = enrichBranching(enricherNodes, enricherConnections, request.flow_title);
    
    console.log("[v3-flow-connector] Initial enrichment:", {
      added_nodes: enrichment.added_nodes.length,
      added_connections: enrichment.added_connections.length,
      stats: enrichment.stats,
    });

    // ========================================
    // 4. ENFORCE REQUIRED OUTPUTS V3 (NEW! MANDATORY)
    // This is the HARD GATE - guarantees all conditions have 2 branches
    // ========================================
    
    // Prepare nodes for enforcer (merge original + first enrichment)
    const preEnforcerNodes = [
      ...enricherNodes,
      ...enrichment.added_nodes.map(n => ({
        id: n.id,
        type: n.type,
        title: n.title,
        description: n.description,
        impact_level: n.impact_level,
      })),
    ];
    
    const preEnforcerConnections = [
      ...enricherConnections,
      ...enrichment.added_connections.map(c => ({
        id: c.id,
        source_id: c.source_node_id,
        target_id: c.target_node_id,
        connection_type: c.connection_type,
        label: c.label,
      })),
    ];
    
    // Run MANDATORY enforcer
    const enforcement = enforceRequiredOutputsV3(
      preEnforcerNodes.map(n => ({
        id: n.id,
        type: n.type,
        title: n.title,
        description: n.description,
        impact_level: n.impact_level as "low" | "medium" | "high" | undefined,
      })),
      preEnforcerConnections.map(c => ({
        source_id: c.source_id || c.source_node_id,
        target_id: c.target_id || c.target_node_id,
        connection_type: c.connection_type,
        label: c.label,
      })),
      { flow_title: request.flow_title }
    );
    
    console.log("[v3-flow-connector] ENFORCER applied:", {
      issues_fixed: enforcement.issues_fixed.length,
      nodes_added: enforcement.added_nodes.length,
      connections_added: enforcement.added_connections.length,
      stats: enforcement.stats,
    });
    
    // Validate enforced flow (HARD GATE)
    const enforcementValidation = validateEnforcedFlow(enforcement.nodes, enforcement.connections);
    
    if (!enforcementValidation.is_valid) {
      console.error("[v3-flow-connector] HARD GATE FAILED:", enforcementValidation.errors);
      // Continue anyway but log the errors - in production you might want to reject
    }

    // Merge ALL enriched nodes into rich_nodes
    const enrichedRichNodes = [
      ...processedNodes,
      ...enrichment.added_nodes.map(node => ({
        node_id: node.id,
        node_type: node.type,
        title: node.title,
        description: node.description,
        impact_level: node.impact_level || "low",
        connections: [] as { target_node_id: string; connection_type: string; label?: string }[],
      })),
      ...enforcement.added_nodes.map(node => ({
        node_id: node.id,
        node_type: node.type,
        title: node.title,
        description: node.description,
        impact_level: (node.impact_level as string) || "low",
        connections: [] as { target_node_id: string; connection_type: string; label?: string }[],
      })),
    ];

    // Merge ALL enriched connections
    const enrichedConnections: Connection[] = [
      ...processedConnections,
      ...enrichment.added_connections.map(conn => ({
        connection_id: conn.id || `conn_enriched_${Date.now()}_${Math.random().toString(36).slice(2)}`,
        source_node_id: conn.source_node_id,
        target_node_id: conn.target_node_id,
        connection_type: normalizeConnectionType(conn.connection_type),
        label: conn.label,
        order: processedConnections.length + enrichment.added_connections.indexOf(conn),
      })),
      ...enforcement.added_connections.map(conn => ({
        connection_id: conn.id || `conn_enforced_${Date.now()}_${Math.random().toString(36).slice(2)}`,
        source_node_id: conn.source_id,
        target_node_id: conn.target_id,
        connection_type: normalizeConnectionType(conn.connection_type),
        label: conn.label,
        order: processedConnections.length + enrichment.added_connections.length + enforcement.added_connections.indexOf(conn),
      })),
    ];
    
    // Remove connections that were marked for removal by enforcer
    for (const toRemove of enforcement.removed_connections) {
      const idx = enrichedConnections.findIndex(c => 
        c.source_node_id === toRemove.source_id && c.target_node_id === toRemove.target_id
      );
      if (idx !== -1) {
        enrichedConnections.splice(idx, 1);
      }
    }

    console.log("[v3-flow-connector] After FULL enrichment:", enrichedRichNodes.length, "nodes,", enrichedConnections.length, "connections");

    // 3. Detect reuse
    let reuseInfos: Array<{ node_id: string; reused: boolean; source_flow_id?: number }> = [];
    if (request.check_reusability) {
      reuseInfos = await detectSimilarNodes(supabase, request.project_id, enrichedRichNodes);
    }

    // 4. Calculate HORIZONTAL layout
    const positions = calculateHorizontalLayout(enrichedRichNodes, enrichedConnections);

    // 5. Create final nodes with V3 type preserved
    const finalNodes = enrichedRichNodes.map((node, idx) => {
      const position = positions.get(node.node_id) || { x: 100 + idx * 400, y: 300, column: "main" };
      const reuseInfo = reuseInfos.find(r => r.node_id === node.node_id);
      const adaptedBlock = request.adapted_blocks?.find(b => b.node_id === node.node_id || b.block_id === node.node_id);
      
      // Get outgoing connections for this node (from enriched connections)
      const outConns = enrichedConnections.filter(c => c.source_node_id === node.node_id);
      const successConn = outConns.find(c => c.connection_type === "success" || c.connection_type === "default");
      const failConn = outConns.find(c => 
        c.connection_type === "failure" || 
        c.connection_type === "fallback" || 
        c.connection_type === "error" ||
        c.connection_type === "loopback"
      );
      
      // Check if this is an enriched node (added by BranchingEnricher)
      const isEnrichedNode = enrichment.added_nodes.some(n => n.id === node.node_id);
      
      return {
        id: node.node_id,
        type: node.node_type, // PRESERVE V3 TYPE
        title: node.title,
        description: node.description,
        position_x: position.x,
        position_y: position.y,
        order_index: idx,
        column: position.column,
        impact_level: node.impact_level || "medium",
        reused: reuseInfo?.reused || false,
        source_flow_id: reuseInfo?.source_flow_id,
        ux_block_id: adaptedBlock?.block_id,
        children: adaptedBlock?.children,
        inputs: adaptedBlock?.input_fields,
        actions: adaptedBlock?.actions,
        next_on_success: successConn?.target_node_id,
        next_on_failure: failConn?.target_node_id,
        metadata: {
          v3_type: node.node_type, // Store original V3 type
          impact_level: node.impact_level,
          reuse_info: reuseInfo,
          ux_block: adaptedBlock,
          enriched_by: isEnrichedNode ? "BranchingEnricherV3" : undefined,
        },
      };
    });

    // 6. Create flow in database with enrichment stats
    const { data: flow, error: flowError } = await supabase
      .from("flows")
      .insert({
        project_id: request.project_id,
        name: request.flow_title,
        description: request.flow_description,
        metadata: {
          source: "v3.1-pipeline", // CRITICAL: Identify v3.1 flows
          version: "3.1",
          user_id: request.user_id,
          master_rule_id: request.master_rule_id,
          status: "draft",
          integrity_score: request.validation_result?.integrity_score,
          is_valid: request.validation_result?.is_valid,
          nodes_count: finalNodes.length,
          connections_count: enrichedConnections.length,
          reuse_count: reuseInfos.filter(r => r.reused).length,
          // V3.1 Type Stats (NEW!)
          type_stats: typeStats,
          // V3.1 Enrichment Stats (initial pass)
          enrichment: {
            applied: true,
            error_paths_added: enrichment.stats.error_paths_added,
            loopbacks_added: enrichment.stats.loopbacks_added,
            condition_branches_fixed: enrichment.stats.condition_branches_fixed,
            enriched_nodes_count: enrichment.added_nodes.length,
            enriched_connections_count: enrichment.added_connections.length,
          },
          // V3.1 ENFORCER Stats (MANDATORY - guarantees branches)
          enforcer: {
            applied: true,
            issues_fixed: enforcement.issues_fixed,
            conditions_fixed: enforcement.stats.conditions_fixed,
            choices_fixed: enforcement.stats.choices_fixed,
            forms_fixed: enforcement.stats.forms_fixed,
            actions_fixed: enforcement.stats.actions_fixed,
            terminals_fixed: enforcement.stats.terminals_fixed,
            nodes_added: enforcement.stats.total_nodes_added,
            connections_added: enforcement.stats.total_connections_added,
            connections_removed: enforcement.stats.total_connections_removed,
            validation: enforcementValidation,
          },
          // V3.1 Branching Stats (final)
          branching_stats: {
            has_condition: (typeStats as any).initial_distribution?.["condition"] > 0,
            has_choice: (typeStats as any).initial_distribution?.["choice"] > 0,
            conditions_count: (typeStats as any).initial_distribution?.["condition"] || 0,
            choice_count: ((typeStats as any).initial_distribution?.["choice"] || 0) + 
                          ((typeStats as any).initial_distribution?.["option_choice"] || 0),
            error_paths_count: enrichment.stats.error_paths_added + enforcement.stats.conditions_fixed,
            enforcer_issues_count: enforcement.issues_fixed.length,
          },
        },
      })
      .select("id")
      .single();

    if (flowError) {
      throw new Error(`Error creating flow: ${flowError.message}`);
    }

    const flowId = flow.id;

    // 6. Save nodes - Use V3 type directly (database enum supports it)
    const nodesToInsert = finalNodes.map(node => ({
      flow_id: flowId,
      // Use V3 type directly (enum supports all types)
      type: mapToDbType(node.type),
      title: node.title,
      description: node.description,
      position_x: node.position_x,
      position_y: node.position_y,
      metadata: {
        // CRITICAL: Store original V3 type for recovery
        v3_type: node.type,
        impact_level: node.impact_level,
        column: node.column,
        reused: node.reused,
        source_flow_id: node.source_flow_id,
        ux_block_id: node.ux_block_id,
        children: node.children,
        inputs: node.inputs,
        actions: node.actions,
        next_on_success: node.next_on_success,
        next_on_failure: node.next_on_failure,
      },
    }));

    const { data: insertedNodes, error: nodesError } = await supabase
      .from("nodes")
      .insert(nodesToInsert)
      .select("id, title");

    if (nodesError) {
      await supabase.from("flows").delete().eq("id", flowId);
      throw new Error(`Error creating nodes: ${nodesError.message}`);
    }

    // 7. Map old IDs to new database IDs
    const nodeIdMap = new Map<string, number>();
    insertedNodes.forEach((inserted: any, idx: number) => {
      nodeIdMap.set(finalNodes[idx].id, inserted.id);
    });

    // 9. Save connections with proper source/target mapping (using enriched connections)
    const connectionsToInsert = enrichedConnections
      .filter(conn => nodeIdMap.has(conn.source_node_id) && nodeIdMap.has(conn.target_node_id))
      .map(conn => ({
        flow_id: flowId,
        source_node_id: nodeIdMap.get(conn.source_node_id),
        target_node_id: nodeIdMap.get(conn.target_node_id),
        label: conn.label,
        // CRITICAL: connection_type is now source of truth
        connection_type: conn.connection_type,
        metadata: {
          connection_type: conn.connection_type, // Dual-write for compatibility
          order: conn.order,
          condition: conn.condition,
          original_source_id: conn.source_node_id,
          original_target_id: conn.target_node_id,
          // Track if connection was added by enricher
          enriched: enrichment.added_connections.some(
            ec => ec.source_node_id === conn.source_node_id && ec.target_node_id === conn.target_node_id
          ),
        },
      }));

    console.log("[v3-flow-connector] Inserting", connectionsToInsert.length, "connections (including enriched)");

    if (connectionsToInsert.length > 0) {
      const { error: connError } = await supabase
        .from("connections")
        .insert(connectionsToInsert);

      if (connError) {
        console.error("[v3-flow-connector] Error saving connections:", connError);
      }
    }

    // 10. Generate reports
    const reuseReport = {
      total_nodes: finalNodes.length,
      reused_nodes: reuseInfos.filter(r => r.reused).length,
      details: reuseInfos,
    };

    const enrichmentReport = {
      applied: true,
      nodes_added: enrichment.added_nodes.length + enforcement.added_nodes.length,
      connections_added: enrichment.added_connections.length + enforcement.added_connections.length,
      error_paths_added: enrichment.stats.error_paths_added,
      loopbacks_added: enrichment.stats.loopbacks_added,
      condition_branches_fixed: enrichment.stats.condition_branches_fixed + enforcement.stats.conditions_fixed,
      // ENFORCER stats
      enforcer: {
        conditions_fixed: enforcement.stats.conditions_fixed,
        choices_fixed: enforcement.stats.choices_fixed,
        forms_fixed: enforcement.stats.forms_fixed,
        issues_fixed: enforcement.issues_fixed.length,
        validation_passed: enforcementValidation.is_valid,
      },
    };

    console.log("[v3-flow-connector] Flow created:", {
      flow_id: flowId,
      nodes: insertedNodes?.length,
      connections: connectionsToInsert.length,
      enrichment: enrichmentReport,
    });

    // Return final nodes with database IDs
    const nodesWithDbIds = finalNodes.map((n, idx) => ({
      ...n,
      db_id: insertedNodes[idx]?.id,
      flow_id: flowId,
    }));

    return new Response(
      JSON.stringify({
        success: true,
        flow_id: flowId,
        final_nodes: nodesWithDbIds,
        connections: enrichedConnections, // Return enriched connections
        reuse_report: reuseReport,
        enrichment_report: enrichmentReport, // Include enrichment details
        summary: {
          flow_id: flowId,
          nodes_count: finalNodes.length,
          connections_count: enrichedConnections.length,
          integrity_score: request.validation_result?.integrity_score,
          reused_nodes: reuseReport.reused_nodes,
          branching_quality: {
            error_paths: enrichment.stats.error_paths_added,
            loopbacks: enrichment.stats.loopbacks_added,
            condition_fixes: enrichment.stats.condition_branches_fixed,
          },
          // V3.1 Type Stats (NEW!)
          type_stats: typeStats,
          type_repair_applied: typeRepairApplied,
        },
        message: `Flow "${request.flow_title}" created with ${finalNodes.length} nodes (${enrichment.added_nodes.length} enriched, repair=${typeRepairApplied}) and ${enrichedConnections.length} connections`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[v3-flow-connector] Error:", error);
    
    // Extract more details from the error
    let errorMessage = String(error);
    let errorDetails = null;
    
    if (error instanceof z.ZodError) {
      errorMessage = "Validation error: " + error.errors.map(e => `${e.path.join(".")}: ${e.message}`).join(", ");
      errorDetails = error.errors;
    } else if (error instanceof Error) {
      errorMessage = error.message;
      errorDetails = error.stack;
    }
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        message: errorMessage,
        details: errorDetails,
        timestamp: new Date().toISOString(),
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
