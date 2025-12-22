/**
 * validateGraphV3 + AutoFixV3
 * 
 * Validador e corretor automático para flows v3.1.
 * Baseado em metadata.v3_type (fonte de verdade) e NodeGrammarV3.
 */

import {
  getNodeGrammar,
  isTerminalNode,
  validateOutputCount,
  type ConnectionTypeV3,
} from "./node-grammar-v3";
import {
  enrichBranching,
  type EnricherNode,
  type EnricherConnection,
} from "./branching-enricher-v3";

// ========================================
// TIPOS
// ========================================

export interface ValidatorNode {
  id: string;
  type: string;
  title: string;
  description?: string;
  metadata?: {
    v3_type?: string;
    impact_level?: string;
    [key: string]: unknown;
  };
}

export interface ValidatorConnection {
  id?: string;
  source_node_id: string;
  target_node_id: string;
  connection_type?: string;
  label?: string;
}

export interface ValidationIssue {
  /** ID único do issue */
  issue_id: string;
  /** Severidade */
  severity: "error" | "warning" | "info";
  /** Categoria */
  category: 
    | "structure" 
    | "branching" 
    | "terminal" 
    | "connection" 
    | "dead_end" 
    | "cycle" 
    | "type_mismatch";
  /** ID do elemento afetado */
  affected_element_id: string;
  /** Tipo do elemento */
  affected_element_type: "node" | "connection" | "flow";
  /** Título do issue */
  title: string;
  /** Descrição detalhada */
  description: string;
  /** Pode ser corrigido automaticamente? */
  auto_fixable: boolean;
  /** Correção sugerida */
  suggested_fix?: string;
}

export interface ValidationResult {
  /** Flow é válido? */
  is_valid: boolean;
  /** Score de integridade (0-100) */
  integrity_score: number;
  /** Score de branching (0-100) */
  branching_score: number;
  /** Issues encontrados */
  issues: ValidationIssue[];
  /** Estatísticas */
  stats: {
    total_nodes: number;
    trigger_count: number;
    end_count: number;
    condition_count: number;
    conditions_with_two_branches: number;
    forms_with_error_handling: number;
    actions_with_failure_path: number;
    dead_end_count: number;
    orphan_count: number;
  };
  /** Resumo */
  summary: {
    errors: number;
    warnings: number;
    infos: number;
    auto_fixable: number;
  };
}

export interface AutoFixResult {
  /** Nós adicionados */
  added_nodes: ValidatorNode[];
  /** Nós removidos */
  removed_nodes: string[];
  /** Nós modificados */
  modified_nodes: Array<{
    node_id: string;
    changes: Record<string, { before: unknown; after: unknown }>;
  }>;
  /** Conexões adicionadas */
  added_connections: ValidatorConnection[];
  /** Conexões removidas */
  removed_connections: string[];
  /** Conexões modificadas */
  modified_connections: Array<{
    connection_id: string;
    changes: Record<string, { before: unknown; after: unknown }>;
  }>;
  /** Issues corrigidos */
  fixed_issues: string[];
  /** Issues não corrigidos */
  unfixed_issues: string[];
  /** Novo resultado de validação */
  new_validation: ValidationResult;
}

// ========================================
// VALIDADOR V3
// ========================================

export class ValidateGraphV3 {
  private nodes: Map<string, ValidatorNode>;
  private connections: ValidatorConnection[];
  private issues: ValidationIssue[];
  private issueIdCounter: number;

  constructor() {
    this.nodes = new Map();
    this.connections = [];
    this.issues = [];
    this.issueIdCounter = 0;
  }

  /**
   * Validar um grafo de flow
   */
  validate(nodes: ValidatorNode[], connections: ValidatorConnection[]): ValidationResult {
    // Reset state
    this.nodes = new Map(nodes.map(n => [n.id, n]));
    this.connections = [...connections];
    this.issues = [];
    this.issueIdCounter = 0;

    // Executar validações
    this.validateTriggerExists();
    this.validateEndExists();
    this.validateTerminalNodes();
    this.validateConditionBranches();
    this.validateConnectionTypes();
    this.validateDeadEnds();
    this.validateOrphans();
    this.validateCycles();
    this.validateNodeOutputCounts();
    this.validatePathToEnd();

    // Calcular scores
    const stats = this.calculateStats();
    const branchingScore = this.calculateBranchingScore(stats);
    const integrityScore = this.calculateIntegrityScore(stats);

    // Resumo
    const summary = {
      errors: this.issues.filter(i => i.severity === "error").length,
      warnings: this.issues.filter(i => i.severity === "warning").length,
      infos: this.issues.filter(i => i.severity === "info").length,
      auto_fixable: this.issues.filter(i => i.auto_fixable).length,
    };

    return {
      is_valid: summary.errors === 0,
      integrity_score: integrityScore,
      branching_score: branchingScore,
      issues: this.issues,
      stats,
      summary,
    };
  }

  // ========================================
  // VALIDAÇÕES ESPECÍFICAS
  // ========================================

  private validateTriggerExists(): void {
    const triggers = Array.from(this.nodes.values()).filter(n => {
      const v3Type = n.metadata?.v3_type || n.type;
      return v3Type === "trigger" || v3Type === "entry_point";
    });

    if (triggers.length === 0) {
      this.addIssue({
        severity: "error",
        category: "structure",
        affected_element_id: "flow",
        affected_element_type: "flow",
        title: "Trigger ausente",
        description: "O fluxo não possui um nó trigger/entry_point. Todo flow deve começar com um trigger.",
        auto_fixable: true,
        suggested_fix: "Adicionar nó trigger conectado ao primeiro nó do flow.",
      });
    } else if (triggers.length > 1) {
      this.addIssue({
        severity: "warning",
        category: "structure",
        affected_element_id: "flow",
        affected_element_type: "flow",
        title: "Múltiplos triggers",
        description: `O fluxo possui ${triggers.length} triggers. Normalmente deve haver apenas 1.`,
        auto_fixable: false,
      });
    }
  }

  private validateEndExists(): void {
    const ends = Array.from(this.nodes.values()).filter(n => {
      const v3Type = n.metadata?.v3_type || n.type;
      return isTerminalNode(v3Type);
    });

    if (ends.length === 0) {
      this.addIssue({
        severity: "warning",
        category: "structure",
        affected_element_id: "flow",
        affected_element_type: "flow",
        title: "End node ausente",
        description: "O fluxo não possui nós terminais (end_success, end_error, end_neutral).",
        auto_fixable: true,
        suggested_fix: "Adicionar end_success ao final do happy path.",
      });
    }

    // Verificar se tem pelo menos um end_success
    const successEnds = ends.filter(n => {
      const v3Type = n.metadata?.v3_type || n.type;
      return v3Type === "end_success" || v3Type === "end";
    });

    if (ends.length > 0 && successEnds.length === 0) {
      this.addIssue({
        severity: "info",
        category: "structure",
        affected_element_id: "flow",
        affected_element_type: "flow",
        title: "end_success ausente",
        description: "O fluxo tem nós terminais mas nenhum end_success. Considere adicionar um final de sucesso.",
        auto_fixable: false,
      });
    }
  }

  private validateTerminalNodes(): void {
    for (const node of this.nodes.values()) {
      const v3Type = node.metadata?.v3_type || node.type;
      
      if (isTerminalNode(v3Type)) {
        const outgoing = this.connections.filter(c => c.source_node_id === node.id);
        
        if (outgoing.length > 0) {
          this.addIssue({
            severity: "error",
            category: "terminal",
            affected_element_id: node.id,
            affected_element_type: "node",
            title: "Terminal com saídas",
            description: `Nó terminal "${node.title}" (${v3Type}) tem ${outgoing.length} saída(s). Nós terminais não podem ter saídas.`,
            auto_fixable: true,
            suggested_fix: "Remover conexões de saída do nó terminal.",
          });
        }
      }
    }
  }

  private validateConditionBranches(): void {
    for (const node of this.nodes.values()) {
      const v3Type = node.metadata?.v3_type || node.type;
      
      if (v3Type === "condition") {
        const outgoing = this.connections.filter(c => c.source_node_id === node.id);
        
        if (outgoing.length < 2) {
          this.addIssue({
            severity: "error",
            category: "branching",
            affected_element_id: node.id,
            affected_element_type: "node",
            title: "Condition com branch único",
            description: `Condition "${node.title}" tem apenas ${outgoing.length} saída(s). Deve ter exatamente 2 (success/failure).`,
            auto_fixable: true,
            suggested_fix: "Adicionar branch faltante com error handling.",
          });
        } else if (outgoing.length > 2) {
          this.addIssue({
            severity: "warning",
            category: "branching",
            affected_element_id: node.id,
            affected_element_type: "node",
            title: "Condition com múltiplos branches",
            description: `Condition "${node.title}" tem ${outgoing.length} saídas. Deveria ter exatamente 2. Considere usar 'choice' para múltiplas opções.`,
            auto_fixable: false,
          });
        }
      }

      // Validar choice/insight_branch tem pelo menos 2
      if (v3Type === "choice" || v3Type === "insight_branch") {
        const outgoing = this.connections.filter(c => c.source_node_id === node.id);
        
        if (outgoing.length < 2) {
          this.addIssue({
            severity: "warning",
            category: "branching",
            affected_element_id: node.id,
            affected_element_type: "node",
            title: "Escolha com opções insuficientes",
            description: `Nó de escolha "${node.title}" tem apenas ${outgoing.length} opção(ões). Deve ter pelo menos 2.`,
            auto_fixable: false,
          });
        }
      }
    }
  }

  private validateConnectionTypes(): void {
    for (const conn of this.connections) {
      const sourceNode = this.nodes.get(conn.source_node_id);
      
      if (!sourceNode) {
        this.addIssue({
          severity: "error",
          category: "connection",
          affected_element_id: conn.id || `${conn.source_node_id}-${conn.target_node_id}`,
          affected_element_type: "connection",
          title: "Conexão órfã (source)",
          description: `Conexão referencia source_node_id "${conn.source_node_id}" que não existe.`,
          auto_fixable: true,
          suggested_fix: "Remover conexão órfã.",
        });
        continue;
      }

      const targetNode = this.nodes.get(conn.target_node_id);
      
      if (!targetNode) {
        this.addIssue({
          severity: "error",
          category: "connection",
          affected_element_id: conn.id || `${conn.source_node_id}-${conn.target_node_id}`,
          affected_element_type: "connection",
          title: "Conexão órfã (target)",
          description: `Conexão referencia target_node_id "${conn.target_node_id}" que não existe.`,
          auto_fixable: true,
          suggested_fix: "Remover conexão órfã.",
        });
        continue;
      }

      // Validar connection_type
      if (!conn.connection_type) {
        this.addIssue({
          severity: "warning",
          category: "connection",
          affected_element_id: conn.id || `${conn.source_node_id}-${conn.target_node_id}`,
          affected_element_type: "connection",
          title: "connection_type ausente",
          description: `Conexão de "${sourceNode.title}" para "${targetNode.title}" não tem connection_type definido.`,
          auto_fixable: true,
          suggested_fix: "Definir connection_type como 'success' ou inferir do label.",
        });
      }
    }
  }

  private validateDeadEnds(): void {
    for (const node of this.nodes.values()) {
      const v3Type = node.metadata?.v3_type || node.type;
      
      // Skip terminais
      if (isTerminalNode(v3Type)) continue;

      const outgoing = this.connections.filter(c => c.source_node_id === node.id);
      
      if (outgoing.length === 0) {
        const grammar = getNodeGrammar(v3Type);
        
        if (grammar.min_outputs > 0) {
          this.addIssue({
            severity: "warning",
            category: "dead_end",
            affected_element_id: node.id,
            affected_element_type: "node",
            title: "Dead-end",
            description: `Nó "${node.title}" (${v3Type}) não tem saídas mas não é terminal.`,
            auto_fixable: true,
            suggested_fix: "Adicionar conexão ou converter para nó terminal.",
          });
        }
      }
    }
  }

  private validateOrphans(): void {
    // Encontrar nós sem entrada (exceto triggers)
    const targetsSet = new Set(this.connections.map(c => c.target_node_id));
    
    for (const node of this.nodes.values()) {
      const v3Type = node.metadata?.v3_type || node.type;
      
      // Triggers não precisam de entrada
      if (v3Type === "trigger" || v3Type === "entry_point") continue;

      if (!targetsSet.has(node.id)) {
        this.addIssue({
          severity: "warning",
          category: "structure",
          affected_element_id: node.id,
          affected_element_type: "node",
          title: "Nó órfão",
          description: `Nó "${node.title}" (${v3Type}) não tem entradas. Não é alcançável no flow.`,
          auto_fixable: false,
          suggested_fix: "Conectar o nó ao flow ou removê-lo.",
        });
      }
    }
  }

  private validateCycles(): void {
    // Detectar ciclos não-intencionais (exceto loopbacks explícitos)
    const visited = new Set<string>();
    const recStack = new Set<string>();
    const cycles: string[][] = [];

    const dfs = (nodeId: string, path: string[]): void => {
      if (recStack.has(nodeId)) {
        // Ciclo detectado
        const cycleStart = path.indexOf(nodeId);
        const cycle = path.slice(cycleStart);
        cycles.push([...cycle, nodeId]);
        return;
      }

      if (visited.has(nodeId)) return;

      visited.add(nodeId);
      recStack.add(nodeId);

      const outgoing = this.connections.filter(c => c.source_node_id === nodeId);
      
      for (const conn of outgoing) {
        // Ignorar loopbacks explícitos
        if (conn.connection_type === "loopback" || conn.connection_type === "retry") {
          continue;
        }
        dfs(conn.target_node_id, [...path, nodeId]);
      }

      recStack.delete(nodeId);
    };

    // Começar DFS de todos os triggers
    const triggers = Array.from(this.nodes.values()).filter(n => {
      const v3Type = n.metadata?.v3_type || n.type;
      return v3Type === "trigger" || v3Type === "entry_point";
    });

    for (const trigger of triggers) {
      dfs(trigger.id, []);
    }

    // Se houver ciclos não-intencionais
    for (const cycle of cycles) {
      const nodeNames = cycle.map(id => this.nodes.get(id)?.title || id).join(" → ");
      this.addIssue({
        severity: "warning",
        category: "cycle",
        affected_element_id: cycle[0],
        affected_element_type: "node",
        title: "Ciclo detectado",
        description: `Ciclo não-intencional detectado: ${nodeNames}. Considere usar loopback explícito.`,
        auto_fixable: false,
        suggested_fix: "Converter uma das conexões para loopback ou adicionar end_neutral para sair do ciclo.",
      });
    }
  }

  private validateNodeOutputCounts(): void {
    for (const node of this.nodes.values()) {
      const v3Type = node.metadata?.v3_type || node.type;
      const outgoing = this.connections.filter(c => c.source_node_id === node.id);
      
      const validation = validateOutputCount(v3Type, outgoing.length);
      
      if (!validation.valid) {
        this.addIssue({
          severity: "error",
          category: "structure",
          affected_element_id: node.id,
          affected_element_type: "node",
          title: "Quantidade de saídas inválida",
          description: validation.message || `Nó "${node.title}" tem número inválido de saídas.`,
          auto_fixable: true,
        });
      }
    }
  }

  private validatePathToEnd(): void {
    // Verificar se existe caminho do trigger ao end
    const triggers = Array.from(this.nodes.values()).filter(n => {
      const v3Type = n.metadata?.v3_type || n.type;
      return v3Type === "trigger" || v3Type === "entry_point";
    });

    const ends = Array.from(this.nodes.values()).filter(n => {
      const v3Type = n.metadata?.v3_type || n.type;
      return isTerminalNode(v3Type);
    });

    if (triggers.length === 0 || ends.length === 0) return;

    // BFS para verificar alcançabilidade
    const reachable = new Set<string>();
    const queue = triggers.map(t => t.id);

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (reachable.has(current)) continue;
      reachable.add(current);

      const outgoing = this.connections.filter(c => c.source_node_id === current);
      for (const conn of outgoing) {
        queue.push(conn.target_node_id);
      }
    }

    // Verificar se algum end é alcançável
    const reachableEnds = ends.filter(e => reachable.has(e.id));

    if (reachableEnds.length === 0) {
      this.addIssue({
        severity: "error",
        category: "structure",
        affected_element_id: "flow",
        affected_element_type: "flow",
        title: "Sem caminho para fim",
        description: "Não existe caminho navegável do trigger para nenhum nó terminal.",
        auto_fixable: false,
        suggested_fix: "Conectar o flow de forma que haja caminho do trigger até pelo menos um end.",
      });
    }
  }

  // ========================================
  // CÁLCULOS DE SCORE
  // ========================================

  private calculateStats(): ValidationResult["stats"] {
    const nodeArray = Array.from(this.nodes.values());
    
    const triggers = nodeArray.filter(n => {
      const v3Type = n.metadata?.v3_type || n.type;
      return v3Type === "trigger" || v3Type === "entry_point";
    });

    const ends = nodeArray.filter(n => {
      const v3Type = n.metadata?.v3_type || n.type;
      return isTerminalNode(v3Type);
    });

    const conditions = nodeArray.filter(n => {
      const v3Type = n.metadata?.v3_type || n.type;
      return v3Type === "condition";
    });

    const forms = nodeArray.filter(n => {
      const v3Type = n.metadata?.v3_type || n.type;
      return v3Type === "form" || v3Type === "configuration_matrix";
    });

    const actions = nodeArray.filter(n => {
      const v3Type = n.metadata?.v3_type || n.type;
      return v3Type === "action" || v3Type === "background_action";
    });

    // Conditions com 2 branches
    const conditionsWithTwoBranches = conditions.filter(c => {
      const outgoing = this.connections.filter(conn => conn.source_node_id === c.id);
      return outgoing.length === 2;
    });

    // Forms com error handling
    const formsWithErrorHandling = forms.filter(f => {
      const outgoing = this.connections.filter(conn => conn.source_node_id === f.id);
      return outgoing.some(c => c.connection_type === "failure" || c.connection_type === "error");
    });

    // Actions com failure path
    const actionsWithFailurePath = actions.filter(a => {
      const outgoing = this.connections.filter(conn => conn.source_node_id === a.id);
      return outgoing.some(c => c.connection_type === "failure" || c.connection_type === "error");
    });

    // Dead-ends (não-terminais sem saída)
    const deadEnds = nodeArray.filter(n => {
      const v3Type = n.metadata?.v3_type || n.type;
      if (isTerminalNode(v3Type)) return false;
      const outgoing = this.connections.filter(conn => conn.source_node_id === n.id);
      return outgoing.length === 0;
    });

    // Órfãos
    const targets = new Set(this.connections.map(c => c.target_node_id));
    const orphans = nodeArray.filter(n => {
      const v3Type = n.metadata?.v3_type || n.type;
      if (v3Type === "trigger" || v3Type === "entry_point") return false;
      return !targets.has(n.id);
    });

    return {
      total_nodes: nodeArray.length,
      trigger_count: triggers.length,
      end_count: ends.length,
      condition_count: conditions.length,
      conditions_with_two_branches: conditionsWithTwoBranches.length,
      forms_with_error_handling: formsWithErrorHandling.length,
      actions_with_failure_path: actionsWithFailurePath.length,
      dead_end_count: deadEnds.length,
      orphan_count: orphans.length,
    };
  }

  private calculateBranchingScore(stats: ValidationResult["stats"]): number {
    let score = 50; // Base score

    // Bonus por conditions corretas
    if (stats.condition_count > 0) {
      const conditionRatio = stats.conditions_with_two_branches / stats.condition_count;
      score += conditionRatio * 20;
    }

    // Bonus por forms com error handling
    const formsArray = Array.from(this.nodes.values()).filter(n => {
      const v3Type = n.metadata?.v3_type || n.type;
      return v3Type === "form" || v3Type === "configuration_matrix";
    });
    if (formsArray.length > 0) {
      const formRatio = stats.forms_with_error_handling / formsArray.length;
      score += formRatio * 15;
    }

    // Bonus por actions com failure path
    const actionsArray = Array.from(this.nodes.values()).filter(n => {
      const v3Type = n.metadata?.v3_type || n.type;
      return v3Type === "action" || v3Type === "background_action";
    });
    if (actionsArray.length > 0) {
      const actionRatio = stats.actions_with_failure_path / actionsArray.length;
      score += actionRatio * 15;
    }

    // Penalidade por dead-ends
    score -= stats.dead_end_count * 5;

    // Penalidade por órfãos
    score -= stats.orphan_count * 5;

    return Math.max(0, Math.min(100, Math.round(score)));
  }

  private calculateIntegrityScore(stats: ValidationResult["stats"]): number {
    let score = 100;

    // Penalidades por erros
    const errors = this.issues.filter(i => i.severity === "error").length;
    const warnings = this.issues.filter(i => i.severity === "warning").length;

    score -= errors * 15;
    score -= warnings * 5;

    // Bonus por estrutura básica
    if (stats.trigger_count === 1) score += 5;
    if (stats.end_count >= 1) score += 5;

    // Penalidade por estrutura ausente
    if (stats.trigger_count === 0) score -= 20;
    if (stats.end_count === 0) score -= 10;

    return Math.max(0, Math.min(100, Math.round(score)));
  }

  // ========================================
  // UTILITÁRIOS
  // ========================================

  private addIssue(issue: Omit<ValidationIssue, "issue_id">): void {
    this.issues.push({
      ...issue,
      issue_id: `issue_${++this.issueIdCounter}`,
    });
  }
}

// ========================================
// AUTO-FIX V3
// ========================================

export class AutoFixV3 {
  private nodes: ValidatorNode[];
  private connections: ValidatorConnection[];
  private nodeIdCounter: number;
  private connectionIdCounter: number;

  constructor() {
    this.nodes = [];
    this.connections = [];
    this.nodeIdCounter = 2000;
    this.connectionIdCounter = 2000;
  }

  /**
   * Aplicar correções automáticas
   */
  fix(
    nodes: ValidatorNode[],
    connections: ValidatorConnection[],
    validation: ValidationResult,
    flowTitle?: string
  ): AutoFixResult {
    this.nodes = [...nodes];
    this.connections = [...connections];

    const result: AutoFixResult = {
      added_nodes: [],
      removed_nodes: [],
      modified_nodes: [],
      added_connections: [],
      removed_connections: [],
      modified_connections: [],
      fixed_issues: [],
      unfixed_issues: [],
      new_validation: validation,
    };

    // Corrigir issues auto_fixable
    for (const issue of validation.issues) {
      if (!issue.auto_fixable) {
        result.unfixed_issues.push(issue.issue_id);
        continue;
      }

      const fixed = this.fixIssue(issue, result);
      
      if (fixed) {
        result.fixed_issues.push(issue.issue_id);
      } else {
        result.unfixed_issues.push(issue.issue_id);
      }
    }

    // Aplicar BranchingEnricher para melhorar ramificações
    const enricherNodes: EnricherNode[] = this.nodes.map(n => ({
      id: n.id,
      type: n.type,
      title: n.title,
      description: n.description,
      impact_level: (n.metadata?.impact_level as "low" | "medium" | "high") || "medium",
      metadata: n.metadata,
    }));

    const enricherConnections: EnricherConnection[] = this.connections.map(c => ({
      id: c.id,
      source_node_id: c.source_node_id,
      target_node_id: c.target_node_id,
      connection_type: c.connection_type || "success",
      label: c.label,
    }));

    const enrichment = enrichBranching(enricherNodes, enricherConnections, flowTitle);

    // Merge resultados do enricher
    for (const node of enrichment.added_nodes) {
      result.added_nodes.push({
        id: node.id,
        type: node.type,
        title: node.title,
        description: node.description,
        metadata: node.metadata as ValidatorNode["metadata"],
      });
      this.nodes.push({
        id: node.id,
        type: node.type,
        title: node.title,
        description: node.description,
        metadata: node.metadata as ValidatorNode["metadata"],
      });
    }

    for (const conn of enrichment.added_connections) {
      result.added_connections.push({
        id: conn.id,
        source_node_id: conn.source_node_id,
        target_node_id: conn.target_node_id,
        connection_type: conn.connection_type,
        label: conn.label,
      });
      this.connections.push({
        id: conn.id,
        source_node_id: conn.source_node_id,
        target_node_id: conn.target_node_id,
        connection_type: conn.connection_type,
        label: conn.label,
      });
    }

    // Re-validar
    const validator = new ValidateGraphV3();
    result.new_validation = validator.validate(this.nodes, this.connections);

    return result;
  }

  private fixIssue(issue: ValidationIssue, result: AutoFixResult): boolean {
    switch (issue.category) {
      case "structure":
        return this.fixStructureIssue(issue, result);
      case "terminal":
        return this.fixTerminalIssue(issue, result);
      case "connection":
        return this.fixConnectionIssue(issue, result);
      case "dead_end":
        return this.fixDeadEndIssue(issue, result);
      default:
        return false;
    }
  }

  private fixStructureIssue(issue: ValidationIssue, result: AutoFixResult): boolean {
    if (issue.title === "Trigger ausente") {
      // Encontrar primeiro nó sem entrada
      const targetIds = new Set(this.connections.map(c => c.target_node_id));
      const firstNode = this.nodes.find(n => !targetIds.has(n.id));

      if (firstNode) {
        const triggerId = `trigger_autofix_${++this.nodeIdCounter}`;
        const triggerNode: ValidatorNode = {
          id: triggerId,
          type: "trigger",
          title: "Início do Fluxo",
          metadata: { v3_type: "trigger", auto_fixed: true },
        };
        
        this.nodes.unshift(triggerNode);
        result.added_nodes.push(triggerNode);

        const conn: ValidatorConnection = {
          id: `conn_autofix_${++this.connectionIdCounter}`,
          source_node_id: triggerId,
          target_node_id: firstNode.id,
          connection_type: "default",
        };
        this.connections.push(conn);
        result.added_connections.push(conn);

        return true;
      }
    }

    if (issue.title === "End node ausente") {
      // Encontrar último nó sem saída
      const sourceIds = new Set(this.connections.map(c => c.source_node_id));
      const lastNode = this.nodes.find(n => {
        const v3Type = n.metadata?.v3_type || n.type;
        return !sourceIds.has(n.id) && !isTerminalNode(v3Type);
      });

      if (lastNode) {
        const endId = `end_success_autofix_${++this.nodeIdCounter}`;
        const endNode: ValidatorNode = {
          id: endId,
          type: "end_success",
          title: "Fluxo Concluído",
          metadata: { v3_type: "end_success", auto_fixed: true },
        };
        
        this.nodes.push(endNode);
        result.added_nodes.push(endNode);

        const conn: ValidatorConnection = {
          id: `conn_autofix_${++this.connectionIdCounter}`,
          source_node_id: lastNode.id,
          target_node_id: endId,
          connection_type: "success",
        };
        this.connections.push(conn);
        result.added_connections.push(conn);

        return true;
      }
    }

    return false;
  }

  private fixTerminalIssue(issue: ValidationIssue, result: AutoFixResult): boolean {
    if (issue.title === "Terminal com saídas") {
      // Remover conexões de saída
      const toRemove = this.connections.filter(
        c => c.source_node_id === issue.affected_element_id
      );

      for (const conn of toRemove) {
        const idx = this.connections.indexOf(conn);
        if (idx !== -1) {
          this.connections.splice(idx, 1);
          result.removed_connections.push(conn.id || `${conn.source_node_id}-${conn.target_node_id}`);
        }
      }

      return toRemove.length > 0;
    }

    return false;
  }

  private fixConnectionIssue(issue: ValidationIssue, result: AutoFixResult): boolean {
    if (issue.title === "Conexão órfã (source)" || issue.title === "Conexão órfã (target)") {
      const connIdx = this.connections.findIndex(
        c => (c.id || `${c.source_node_id}-${c.target_node_id}`) === issue.affected_element_id
      );

      if (connIdx !== -1) {
        const conn = this.connections.splice(connIdx, 1)[0];
        result.removed_connections.push(conn.id || `${conn.source_node_id}-${conn.target_node_id}`);
        return true;
      }
    }

    if (issue.title === "connection_type ausente") {
      const conn = this.connections.find(
        c => (c.id || `${c.source_node_id}-${c.target_node_id}`) === issue.affected_element_id
      );

      if (conn) {
        const oldType = conn.connection_type;
        conn.connection_type = conn.label?.toLowerCase().includes("não") || 
                               conn.label?.toLowerCase().includes("no") ? "failure" : "success";
        
        result.modified_connections.push({
          connection_id: conn.id || `${conn.source_node_id}-${conn.target_node_id}`,
          changes: { connection_type: { before: oldType, after: conn.connection_type } },
        });
        return true;
      }
    }

    return false;
  }

  private fixDeadEndIssue(issue: ValidationIssue, result: AutoFixResult): boolean {
    // Adicionar end_neutral para dead-ends
    const endId = `end_neutral_autofix_${++this.nodeIdCounter}`;
    const endNode: ValidatorNode = {
      id: endId,
      type: "end_neutral",
      title: "Saída do Fluxo",
      metadata: { v3_type: "end_neutral", auto_fixed: true },
    };
    
    this.nodes.push(endNode);
    result.added_nodes.push(endNode);

    const conn: ValidatorConnection = {
      id: `conn_autofix_${++this.connectionIdCounter}`,
      source_node_id: issue.affected_element_id,
      target_node_id: endId,
      connection_type: "default",
    };
    this.connections.push(conn);
    result.added_connections.push(conn);

    return true;
  }
}

// ========================================
// FUNÇÕES CONVENIENTES
// ========================================

/**
 * Validar um grafo de flow
 */
export function validateGraphV3(
  nodes: ValidatorNode[],
  connections: ValidatorConnection[]
): ValidationResult {
  const validator = new ValidateGraphV3();
  return validator.validate(nodes, connections);
}

/**
 * Corrigir automaticamente issues em um flow
 */
export function autoFixGraphV3(
  nodes: ValidatorNode[],
  connections: ValidatorConnection[],
  validation: ValidationResult,
  flowTitle?: string
): AutoFixResult {
  const fixer = new AutoFixV3();
  return fixer.fix(nodes, connections, validation, flowTitle);
}






