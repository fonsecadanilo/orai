/**
 * BranchingEnricherV3 - Enriquecedor de Ramificações
 * 
 * Componente determinístico que completa ramificações ausentes em flows v3.1
 * sem reescrever o flow inteiro. Aplica regras baseadas em:
 * - Tipo do nó (NodeGrammarV3)
 * - Impact level
 * - Padrões de fluxo conhecidos (login, signup, checkout, etc.)
 */

import {
  NODE_GRAMMAR_V3,
  getNodeGrammar,
  isTerminalNode,
  needsErrorHandling,
  getRecommendedErrorPattern,
  getErrorHandlingTemplate,
  type ConnectionTypeV3,
} from "./node-grammar-v3";
import type { ImpactLevel } from "@/lib/agents/v3/types";

// ========================================
// TIPOS
// ========================================

export interface EnricherNode {
  id: string;
  type: string;
  title: string;
  description?: string;
  impact_level?: ImpactLevel;
  metadata?: {
    v3_type?: string;
    inputs?: unknown[];
    validation_rules?: string[];
    [key: string]: unknown;
  };
}

export interface EnricherConnection {
  id?: string;
  source_node_id: string;
  target_node_id: string;
  connection_type: string;
  label?: string;
}

export interface EnrichmentResult {
  /** Nós adicionados */
  added_nodes: EnricherNode[];
  /** Conexões adicionadas */
  added_connections: EnricherConnection[];
  /** Conexões modificadas */
  modified_connections: Array<{
    original: EnricherConnection;
    modified: EnricherConnection;
  }>;
  /** Avisos/recomendações */
  warnings: string[];
  /** Estatísticas de enriquecimento */
  stats: {
    error_paths_added: number;
    loopbacks_added: number;
    retries_added: number;
    fallbacks_added: number;
    condition_branches_fixed: number;
  };
}

// ========================================
// PADRÕES DE FLOW CONHECIDOS
// ========================================

interface FlowPatternRule {
  /** Nome do padrão */
  pattern_name: string;
  /** Keywords que identificam o padrão no título/descrição */
  keywords: string[];
  /** Regras específicas para este padrão */
  rules: PatternRule[];
}

interface PatternRule {
  /** Tipo de nó ou keyword no título */
  match: { type?: string; title_contains?: string };
  /** Error scenarios a adicionar */
  error_scenarios: Array<{
    scenario_name: string;
    error_message: string;
    handling: "loopback" | "retry" | "fallback" | "end_error";
  }>;
}

const FLOW_PATTERNS: FlowPatternRule[] = [
  // ========================================
  // LOGIN PATTERN
  // ========================================
  {
    pattern_name: "login",
    keywords: ["login", "signin", "sign in", "entrar", "autenticar"],
    rules: [
      {
        match: { type: "condition", title_contains: "credenciais" },
        error_scenarios: [
          {
            scenario_name: "invalid_credentials",
            error_message: "Credenciais inválidas. Verifique email e senha.",
            handling: "loopback",
          },
        ],
      },
      {
        match: { type: "form", title_contains: "login" },
        error_scenarios: [
          {
            scenario_name: "validation_error",
            error_message: "Preencha todos os campos corretamente.",
            handling: "loopback",
          },
        ],
      },
      {
        match: { title_contains: "senha" },
        error_scenarios: [
          {
            scenario_name: "forgot_password",
            error_message: "Esqueceu a senha?",
            handling: "fallback",
          },
        ],
      },
    ],
  },
  
  // ========================================
  // SIGNUP/CADASTRO PATTERN
  // ========================================
  {
    pattern_name: "signup",
    keywords: ["signup", "sign up", "cadastro", "cadastrar", "criar conta", "registro", "registrar"],
    rules: [
      {
        match: { title_contains: "email" },
        error_scenarios: [
          {
            scenario_name: "email_already_exists",
            error_message: "Este email já está cadastrado.",
            handling: "loopback",
          },
          {
            scenario_name: "invalid_email",
            error_message: "Email inválido.",
            handling: "loopback",
          },
        ],
      },
      {
        match: { title_contains: "senha" },
        error_scenarios: [
          {
            scenario_name: "weak_password",
            error_message: "Senha muito fraca. Use letras, números e símbolos.",
            handling: "loopback",
          },
        ],
      },
      {
        match: { type: "form" },
        error_scenarios: [
          {
            scenario_name: "validation_error",
            error_message: "Corrija os campos destacados.",
            handling: "loopback",
          },
        ],
      },
    ],
  },
  
  // ========================================
  // ONBOARDING PATTERN
  // ========================================
  {
    pattern_name: "onboarding",
    keywords: ["onboarding", "boas-vindas", "welcome", "início", "primeiro acesso"],
    rules: [
      {
        match: { type: "form" },
        error_scenarios: [
          {
            scenario_name: "skip_option",
            error_message: "Pular esta etapa?",
            handling: "fallback",
          },
        ],
      },
    ],
  },
  
  // ========================================
  // CHECKOUT/PAYMENT PATTERN
  // ========================================
  {
    pattern_name: "checkout",
    keywords: ["checkout", "pagamento", "payment", "compra", "purchase", "finalizar"],
    rules: [
      {
        match: { title_contains: "pagamento" },
        error_scenarios: [
          {
            scenario_name: "payment_failed",
            error_message: "Pagamento não aprovado. Tente outro método.",
            handling: "retry",
          },
          {
            scenario_name: "change_payment_method",
            error_message: "Alterar método de pagamento",
            handling: "fallback",
          },
        ],
      },
      {
        match: { title_contains: "cartão" },
        error_scenarios: [
          {
            scenario_name: "card_declined",
            error_message: "Cartão recusado. Verifique os dados.",
            handling: "loopback",
          },
        ],
      },
      {
        match: { type: "action", title_contains: "processar" },
        error_scenarios: [
          {
            scenario_name: "processing_error",
            error_message: "Erro ao processar. Tente novamente.",
            handling: "retry",
          },
        ],
      },
    ],
  },
];

// ========================================
// CLASSE PRINCIPAL
// ========================================

export class BranchingEnricherV3 {
  private nodes: Map<string, EnricherNode>;
  private connections: EnricherConnection[];
  private flowTitle: string;
  private result: EnrichmentResult;
  private nodeIdCounter: number;
  private connectionIdCounter: number;

  constructor() {
    this.nodes = new Map();
    this.connections = [];
    this.flowTitle = "";
    this.result = this.createEmptyResult();
    this.nodeIdCounter = 1000; // Start high to avoid conflicts
    this.connectionIdCounter = 1000;
  }

  private createEmptyResult(): EnrichmentResult {
    return {
      added_nodes: [],
      added_connections: [],
      modified_connections: [],
      warnings: [],
      stats: {
        error_paths_added: 0,
        loopbacks_added: 0,
        retries_added: 0,
        fallbacks_added: 0,
        condition_branches_fixed: 0,
      },
    };
  }

  /**
   * Enriquecer um flow com ramificações
   */
  enrich(
    nodes: EnricherNode[],
    connections: EnricherConnection[],
    flowTitle?: string
  ): EnrichmentResult {
    // Reset state
    this.nodes = new Map(nodes.map(n => [n.id, n]));
    this.connections = [...connections];
    this.flowTitle = flowTitle || "";
    this.result = this.createEmptyResult();

    // 1. Detectar padrão de flow (login, signup, etc.)
    const detectedPattern = this.detectFlowPattern();
    console.log(`[BranchingEnricherV3] Detected pattern: ${detectedPattern?.pattern_name || "none"}`);

    // 2. Aplicar regras por tipo de nó (NodeGrammarV3)
    this.applyGrammarRules();

    // 3. Aplicar regras específicas do padrão
    if (detectedPattern) {
      this.applyPatternRules(detectedPattern);
    }

    // 4. Garantir que conditions têm 2 saídas
    this.fixConditionBranches();

    // 5. Garantir que não há nós terminais com saídas
    this.removeTerminalOutputs();

    // 6. Verificar dead-ends e adicionar end_neutral
    this.handleDeadEnds();

    return this.result;
  }

  /**
   * Detectar padrão de flow baseado no título
   */
  private detectFlowPattern(): FlowPatternRule | null {
    const titleLower = this.flowTitle.toLowerCase();
    
    for (const pattern of FLOW_PATTERNS) {
      for (const keyword of pattern.keywords) {
        if (titleLower.includes(keyword)) {
          return pattern;
        }
      }
    }

    // Também verificar nos títulos dos nós
    for (const node of this.nodes.values()) {
      const nodeTitleLower = (node.title || "").toLowerCase();
      for (const pattern of FLOW_PATTERNS) {
        for (const keyword of pattern.keywords) {
          if (nodeTitleLower.includes(keyword)) {
            return pattern;
          }
        }
      }
    }

    return null;
  }

  /**
   * Aplicar regras da gramática de nós
   */
  private applyGrammarRules(): void {
    for (const node of this.nodes.values()) {
      const v3Type = node.metadata?.v3_type || node.type;
      const impactLevel = node.impact_level || (node.metadata?.impact_level as ImpactLevel) || "medium";

      // Verificar se precisa de error handling
      if (needsErrorHandling(v3Type, impactLevel)) {
        const hasFailurePath = this.hasConnectionType(node.id, "failure");
        
        if (!hasFailurePath) {
          this.addErrorHandling(node, v3Type, impactLevel);
        }
      }
    }
  }

  /**
   * Adicionar error handling para um nó
   */
  private addErrorHandling(
    node: EnricherNode,
    nodeType: string,
    impactLevel: ImpactLevel
  ): void {
    const pattern = getRecommendedErrorPattern(nodeType, impactLevel);
    const template = getErrorHandlingTemplate(pattern);

    if (!template) return;

    // Criar nós do template
    const newNodes: EnricherNode[] = [];
    const newConnections: EnricherConnection[] = [];
    const idMap = new Map<string, string>();
    
    idMap.set("", node.id); // Original node

    for (const nodeDef of template.nodes_to_insert) {
      const newId = `${node.id}${nodeDef.id_suffix}`;
      idMap.set(nodeDef.id_suffix, newId);

      newNodes.push({
        id: newId,
        type: nodeDef.type,
        title: nodeDef.title_template.replace("{original_title}", node.title),
        description: nodeDef.description_template.replace("{original_title}", node.title),
        impact_level: "low",
        metadata: {
          v3_type: nodeDef.type,
          enriched_by: "BranchingEnricherV3",
          source_node_id: node.id,
        },
      });
    }

    // Criar conexões do template
    for (const connDef of template.connections_to_create) {
      const sourceId = idMap.get(connDef.from_suffix);
      const targetId = idMap.get(connDef.to_suffix);

      if (sourceId && targetId) {
        // Evitar duplicatas
        const exists = this.connections.some(
          c => c.source_node_id === sourceId && c.target_node_id === targetId
        );
        
        if (!exists) {
          newConnections.push({
            id: `conn_enriched_${++this.connectionIdCounter}`,
            source_node_id: sourceId,
            target_node_id: targetId,
            connection_type: connDef.connection_type,
            label: connDef.label,
          });
        }
      }
    }

    // Adicionar ao resultado
    this.result.added_nodes.push(...newNodes);
    this.result.added_connections.push(...newConnections);
    this.result.stats.error_paths_added++;

    // Atualizar contadores específicos
    if (pattern === "feedback_error_loopback") {
      this.result.stats.loopbacks_added++;
    } else if (pattern === "feedback_error_retry") {
      this.result.stats.retries_added++;
    }

    // Adicionar nós ao mapa interno
    for (const n of newNodes) {
      this.nodes.set(n.id, n);
    }
    this.connections.push(...newConnections);
  }

  /**
   * Aplicar regras específicas do padrão detectado
   */
  private applyPatternRules(pattern: FlowPatternRule): void {
    for (const node of this.nodes.values()) {
      const v3Type = node.metadata?.v3_type || node.type;
      const titleLower = (node.title || "").toLowerCase();

      for (const rule of pattern.rules) {
        // Verificar se a regra se aplica
        const typeMatch = !rule.match.type || v3Type === rule.match.type;
        const titleMatch = !rule.match.title_contains || 
          titleLower.includes(rule.match.title_contains.toLowerCase());

        if (typeMatch && titleMatch) {
          // Aplicar error scenarios
          for (const scenario of rule.error_scenarios) {
            this.addErrorScenario(node, scenario);
          }
        }
      }
    }
  }

  /**
   * Adicionar um cenário de erro específico
   */
  private addErrorScenario(
    node: EnricherNode,
    scenario: PatternRule["error_scenarios"][0]
  ): void {
    // Verificar se já existe uma conexão de erro similar
    const hasExistingError = this.connections.some(
      c => c.source_node_id === node.id && 
           (c.connection_type === "failure" || c.connection_type === "fallback" || c.connection_type === "retry")
    );

    if (hasExistingError) return;

    // Criar feedback_error node
    const errorNodeId = `${node.id}_${scenario.scenario_name}`;
    const errorNode: EnricherNode = {
      id: errorNodeId,
      type: "feedback_error",
      title: scenario.error_message,
      description: `Cenário: ${scenario.scenario_name}`,
      impact_level: "low",
      metadata: {
        v3_type: "feedback_error",
        enriched_by: "BranchingEnricherV3",
        pattern_scenario: scenario.scenario_name,
      },
    };

    this.nodes.set(errorNodeId, errorNode);
    this.result.added_nodes.push(errorNode);

    // Criar conexão de erro
    const errorConnection: EnricherConnection = {
      id: `conn_${++this.connectionIdCounter}`,
      source_node_id: node.id,
      target_node_id: errorNodeId,
      connection_type: "failure",
      label: "Erro",
    };
    this.connections.push(errorConnection);
    this.result.added_connections.push(errorConnection);
    this.result.stats.error_paths_added++;

    // Criar conexão de recovery baseado no handling
    let recoveryConnection: EnricherConnection | null = null;
    
    switch (scenario.handling) {
      case "loopback":
        recoveryConnection = {
          id: `conn_${++this.connectionIdCounter}`,
          source_node_id: errorNodeId,
          target_node_id: node.id,
          connection_type: "loopback",
          label: "Tentar novamente",
        };
        this.result.stats.loopbacks_added++;
        break;

      case "retry":
        // Criar retry node intermediário
        const retryNodeId = `${errorNodeId}_retry`;
        const retryNode: EnricherNode = {
          id: retryNodeId,
          type: "retry",
          title: "Tentar novamente",
          impact_level: "low",
          metadata: { v3_type: "retry", enriched_by: "BranchingEnricherV3" },
        };
        this.nodes.set(retryNodeId, retryNode);
        this.result.added_nodes.push(retryNode);

        this.connections.push({
          id: `conn_${++this.connectionIdCounter}`,
          source_node_id: errorNodeId,
          target_node_id: retryNodeId,
          connection_type: "default",
        });
        
        recoveryConnection = {
          id: `conn_${++this.connectionIdCounter}`,
          source_node_id: retryNodeId,
          target_node_id: node.id,
          connection_type: "loopback",
          label: "Retry",
        };
        this.result.stats.retries_added++;
        break;

      case "fallback":
        // Criar fallback node
        const fallbackNodeId = `${errorNodeId}_fallback`;
        const fallbackNode: EnricherNode = {
          id: fallbackNodeId,
          type: "fallback",
          title: "Opção alternativa",
          description: scenario.error_message,
          impact_level: "low",
          metadata: { v3_type: "fallback", enriched_by: "BranchingEnricherV3" },
        };
        this.nodes.set(fallbackNodeId, fallbackNode);
        this.result.added_nodes.push(fallbackNode);

        recoveryConnection = {
          id: `conn_${++this.connectionIdCounter}`,
          source_node_id: errorNodeId,
          target_node_id: fallbackNodeId,
          connection_type: "fallback",
          label: "Alternativa",
        };
        this.result.stats.fallbacks_added++;
        break;

      case "end_error":
        // Criar end_error node
        const endErrorNodeId = `${errorNodeId}_end`;
        const endErrorNode: EnricherNode = {
          id: endErrorNodeId,
          type: "end_error",
          title: "Fluxo interrompido",
          impact_level: "low",
          metadata: { v3_type: "end_error", enriched_by: "BranchingEnricherV3" },
        };
        this.nodes.set(endErrorNodeId, endErrorNode);
        this.result.added_nodes.push(endErrorNode);

        recoveryConnection = {
          id: `conn_${++this.connectionIdCounter}`,
          source_node_id: errorNodeId,
          target_node_id: endErrorNodeId,
          connection_type: "default",
        };
        break;
    }

    if (recoveryConnection) {
      this.connections.push(recoveryConnection);
      this.result.added_connections.push(recoveryConnection);
    }
  }

  /**
   * Corrigir conditions com apenas 1 saída
   */
  private fixConditionBranches(): void {
    for (const node of this.nodes.values()) {
      const v3Type = node.metadata?.v3_type || node.type;
      
      if (v3Type !== "condition" && v3Type !== "choice" && v3Type !== "insight_branch") {
        continue;
      }

      const outgoingConnections = this.connections.filter(
        c => c.source_node_id === node.id
      );

      // Se condition tem apenas 1 saída, adicionar a segunda
      if (v3Type === "condition" && outgoingConnections.length === 1) {
        const existingType = outgoingConnections[0].connection_type;
        const missingType = existingType === "success" ? "failure" : "success";
        const missingLabel = missingType === "success" ? "Sim" : "Não";

        // Criar feedback_error para o caso de falha
        const errorNodeId = `${node.id}_condition_error`;
        const errorNode: EnricherNode = {
          id: errorNodeId,
          type: "feedback_error",
          title: `Falha: ${node.title}`,
          impact_level: "low",
          metadata: {
            v3_type: "feedback_error",
            enriched_by: "BranchingEnricherV3",
            reason: "condition_branch_fix",
          },
        };
        this.nodes.set(errorNodeId, errorNode);
        this.result.added_nodes.push(errorNode);

        // Conexão para o erro
        const errorConn: EnricherConnection = {
          id: `conn_${++this.connectionIdCounter}`,
          source_node_id: node.id,
          target_node_id: errorNodeId,
          connection_type: missingType,
          label: missingLabel,
        };
        this.connections.push(errorConn);
        this.result.added_connections.push(errorConn);

        // Loopback do erro para o nó anterior (se houver)
        const incomingConnections = this.connections.filter(
          c => c.target_node_id === node.id
        );
        if (incomingConnections.length > 0) {
          const sourceNode = incomingConnections[0].source_node_id;
          const loopbackConn: EnricherConnection = {
            id: `conn_${++this.connectionIdCounter}`,
            source_node_id: errorNodeId,
            target_node_id: sourceNode,
            connection_type: "loopback",
            label: "Voltar",
          };
          this.connections.push(loopbackConn);
          this.result.added_connections.push(loopbackConn);
          this.result.stats.loopbacks_added++;
        }

        this.result.stats.condition_branches_fixed++;
        this.result.warnings.push(
          `Condition "${node.title}" had only 1 branch. Added ${missingType} branch with error handling.`
        );
      }
    }
  }

  /**
   * Remover saídas de nós terminais
   */
  private removeTerminalOutputs(): void {
    for (const node of this.nodes.values()) {
      const v3Type = node.metadata?.v3_type || node.type;
      
      if (isTerminalNode(v3Type)) {
        const outgoingConnections = this.connections.filter(
          c => c.source_node_id === node.id
        );

        if (outgoingConnections.length > 0) {
          // Remover conexões de saída
          this.connections = this.connections.filter(
            c => c.source_node_id !== node.id
          );

          this.result.warnings.push(
            `Terminal node "${node.title}" (${v3Type}) had ${outgoingConnections.length} outputs that were removed.`
          );
        }
      }
    }
  }

  /**
   * Tratar dead-ends (nós sem saída que não são terminais)
   */
  private handleDeadEnds(): void {
    for (const node of this.nodes.values()) {
      const v3Type = node.metadata?.v3_type || node.type;
      
      // Skip terminais
      if (isTerminalNode(v3Type)) continue;

      const outgoingConnections = this.connections.filter(
        c => c.source_node_id === node.id
      );

      // Se não tem saída e não é terminal, é um dead-end
      if (outgoingConnections.length === 0) {
        const grammar = getNodeGrammar(v3Type);
        
        if (grammar.min_outputs > 0) {
          this.result.warnings.push(
            `Node "${node.title}" (${v3Type}) is a dead-end with no outputs. ` +
            `Consider adding a connection or converting to a terminal node.`
          );

          // Para feedback_success sem saída, pode ser intencional (terminal implícito)
          if (v3Type !== "feedback_success" && v3Type !== "feedback_error") {
            // Sugerir adicionar end_neutral
            this.result.warnings.push(
              `  → Suggestion: Add end_neutral after "${node.title}" to make the flow explicit.`
            );
          }
        }
      }
    }
  }

  /**
   * Verificar se um nó tem uma conexão de determinado tipo
   */
  private hasConnectionType(nodeId: string, connectionType: string): boolean {
    return this.connections.some(
      c => c.source_node_id === nodeId && c.connection_type === connectionType
    );
  }
}

// ========================================
// FUNÇÃO CONVENIENTE
// ========================================

/**
 * Enriquecer um flow com ramificações
 */
export function enrichBranching(
  nodes: EnricherNode[],
  connections: EnricherConnection[],
  flowTitle?: string
): EnrichmentResult {
  const enricher = new BranchingEnricherV3();
  return enricher.enrich(nodes, connections, flowTitle);
}






