import { z } from "zod";

/**
 * Schema das Subrules - NÓS SIMBÓLICOS
 * 
 * O LLM cuida apenas de:
 * - IDs simbólicos (slugs únicos)
 * - Tipos de nó
 * - Títulos e descrições
 * - Conexões via next_on_success/failure
 * 
 * O MOTOR (código) cuida de:
 * - order_index
 * - layout (x, y)
 * - edges reais
 * - labels de edges
 * - validação estrutural
 */

/**
 * Tipos de nós permitidos
 */
export const NodeTypeEnum = z.enum([
  "trigger",    // Gatilho inicial - APENAS 1 por fluxo
  "action",     // Ação executada pelo sistema
  "condition",  // Condição/decisão com bifurcação
  "end",        // Nó de término do fluxo
  "subflow",    // Referência a outro fluxo
]);

export type SubRuleNodeType = z.infer<typeof NodeTypeEnum>;

/**
 * Status de término para nós do tipo "end"
 */
export const EndStatusEnum = z.enum(["success", "error"]);
export type EndStatus = z.infer<typeof EndStatusEnum>;

/**
 * Categoria do fluxo - usado pela engine para posicionamento
 * - main: linha principal (happy path) - y = 0 (base)
 * - error: linha de erros - y = +180 (abaixo)
 * - alternative: linha alternativa - y = -180 (acima)
 */
export const FlowCategoryEnum = z.enum(["main", "error", "alternative"]);
export type FlowCategory = z.infer<typeof FlowCategoryEnum>;

/**
 * Schema de um nó simbólico (SubRule)
 */
export const SubRuleNodeSchema = z.object({
  // Identificador único (slug)
  id: z
    .string()
    .min(1, "ID é obrigatório")
    .regex(/^[a-z0-9_]+$/, "ID deve ser um slug (letras minúsculas, números e _)")
    .describe("Slug único para identificar o nó"),
  
  // Tipo do nó
  type: NodeTypeEnum.describe("Tipo do nó"),
  
  // Título descritivo
  title: z
    .string()
    .min(3, "Título deve ter pelo menos 3 caracteres")
    .describe("Título descritivo do nó"),
  
  // Descrição detalhada
  description: z
    .string()
    .describe("Descrição detalhada do que acontece neste passo"),
  
  // Conexão em caso de sucesso (para todos exceto end)
  next_on_success: z
    .string()
    .nullable()
    .optional()
    .describe("ID do próximo nó em caso de sucesso"),
  
  // Conexão em caso de falha (apenas para condition)
  next_on_failure: z
    .string()
    .nullable()
    .optional()
    .describe("ID do próximo nó em caso de falha (apenas para conditions)"),
  
  // Status de término (apenas para type === 'end')
  end_status: EndStatusEnum
    .optional()
    .describe("Status do término (apenas para nós do tipo end)"),
  
  // Categoria do fluxo - usado pela engine para posicionamento
  // Inferido pelo Subrules Decomposer com base na Journey
  flow_category: FlowCategoryEnum
    .optional()
    .default("main")
    .describe("Categoria do nó para posicionamento: main, error ou alternative"),
});

export type SubRuleNode = z.infer<typeof SubRuleNodeSchema>;

/**
 * Schema da resposta completa do Subrules Decomposer
 */
export const SubrulesResponseSchema = z.object({
  nodes: z
    .array(SubRuleNodeSchema)
    .min(3, "Deve haver pelo menos 3 nós (trigger, ação, end)"),
});

export type SubrulesResponse = z.infer<typeof SubrulesResponseSchema>;

/**
 * Validação estrutural do grafo de subrules
 */
export interface GraphValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Valida as subrules e retorna erros se houver
 */
export function validateSubrules(data: unknown): {
  success: boolean;
  data?: SubrulesResponse;
  errors?: z.ZodError;
} {
  const result = SubrulesResponseSchema.safeParse(data);
  
  if (result.success) {
    return { success: true, data: result.data };
  }
  
  return { success: false, errors: result.error };
}

/**
 * Validador de grafo (regras estruturais)
 */
export function validateSubrulesGraph(nodes: SubRuleNode[]): GraphValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const nodeIds = new Set(nodes.map((n) => n.id));
  
  // 1. Verificar se existe exatamente 1 trigger
  const triggers = nodes.filter((n) => n.type === "trigger");
  if (triggers.length === 0) {
    errors.push("GRAPH_NO_TRIGGER: O grafo deve ter exatamente 1 trigger");
  } else if (triggers.length > 1) {
    errors.push(`GRAPH_MULTIPLE_TRIGGERS: O grafo tem ${triggers.length} triggers, deve ter apenas 1`);
  }
  
  // 2. Verificar se existe pelo menos 1 end com status success
  const successEnds = nodes.filter((n) => n.type === "end" && n.end_status === "success");
  if (successEnds.length === 0) {
    errors.push("GRAPH_NO_SUCCESS_END: O grafo deve ter pelo menos 1 end com status 'success'");
  } else if (successEnds.length > 1) {
    warnings.push(`GRAPH_MULTIPLE_SUCCESS_ENDS: O grafo tem ${successEnds.length} ends de sucesso`);
  }
  
  // 3. Verificar referências de IDs (next_on_success, next_on_failure)
  for (const node of nodes) {
    // Verificar next_on_success
    if (node.next_on_success && !nodeIds.has(node.next_on_success)) {
      errors.push(
        `GRAPH_INVALID_REF: Nó "${node.id}" referencia "${node.next_on_success}" que não existe`
      );
    }
    
    // Verificar next_on_failure
    if (node.next_on_failure && !nodeIds.has(node.next_on_failure)) {
      errors.push(
        `GRAPH_INVALID_REF: Nó "${node.id}" referencia "${node.next_on_failure}" que não existe`
      );
    }
  }
  
  // 4. Conditions devem ter 2 caminhos
  const conditions = nodes.filter((n) => n.type === "condition");
  for (const condition of conditions) {
    if (!condition.next_on_success) {
      errors.push(
        `GRAPH_CONDITION_NO_SUCCESS: Condition "${condition.id}" não tem caminho de sucesso`
      );
    }
    if (!condition.next_on_failure) {
      errors.push(
        `GRAPH_CONDITION_NO_FAILURE: Condition "${condition.id}" não tem caminho de falha`
      );
    }
  }
  
  // 5. End nodes não podem ter next_* definido
  const endNodes = nodes.filter((n) => n.type === "end");
  for (const end of endNodes) {
    if (end.next_on_success || end.next_on_failure) {
      errors.push(
        `GRAPH_END_HAS_NEXT: End "${end.id}" não pode ter conexões de saída`
      );
    }
    if (!end.end_status) {
      errors.push(
        `GRAPH_END_NO_STATUS: End "${end.id}" deve ter end_status definido (success/error)`
      );
    }
  }
  
  // 6. Nós não-end devem ter pelo menos uma saída
  const nonEndNodes = nodes.filter((n) => n.type !== "end");
  for (const node of nonEndNodes) {
    if (!node.next_on_success) {
      if (node.type === "trigger") {
        // Trigger DEVE ter saída
        errors.push(
          `GRAPH_TRIGGER_NO_OUTPUT: Trigger "${node.id}" não tem next_on_success`
        );
      } else {
        warnings.push(
          `GRAPH_NO_OUTPUT: Nó "${node.id}" não tem conexão de saída`
        );
      }
    }
  }
  
  // 7. Verificar referências numéricas (não devem existir)
  for (const node of nodes) {
    if (node.next_on_success && /^\d+$/.test(node.next_on_success)) {
      errors.push(
        `GRAPH_NUMERIC_REF: Nó "${node.id}" tem next_on_success numérico "${node.next_on_success}". Use IDs simbólicos.`
      );
    }
    if (node.next_on_failure && /^\d+$/.test(node.next_on_failure)) {
      errors.push(
        `GRAPH_NUMERIC_REF: Nó "${node.id}" tem next_on_failure numérico "${node.next_on_failure}". Use IDs simbólicos.`
      );
    }
  }
  
  // 7. Detectar ciclos (DFS)
  const cycleErrors = detectCycles(nodes);
  errors.push(...cycleErrors);
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Detecta ciclos no grafo usando DFS
 */
function detectCycles(nodes: SubRuleNode[]): string[] {
  const errors: string[] = [];
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const visited = new Set<string>();
  const recStack = new Set<string>();
  
  function dfs(nodeId: string, path: string[]): boolean {
    if (recStack.has(nodeId)) {
      const cycleStart = path.indexOf(nodeId);
      const cycle = [...path.slice(cycleStart), nodeId].join(" -> ");
      errors.push(`GRAPH_CYCLE: Ciclo detectado: ${cycle}`);
      return true;
    }
    
    if (visited.has(nodeId)) {
      return false;
    }
    
    visited.add(nodeId);
    recStack.add(nodeId);
    
    const node = nodeMap.get(nodeId);
    if (node) {
      const nextNodes = [node.next_on_success, node.next_on_failure].filter(Boolean) as string[];
      for (const next of nextNodes) {
        if (dfs(next, [...path, nodeId])) {
          return true;
        }
      }
    }
    
    recStack.delete(nodeId);
    return false;
  }
  
  // Iniciar DFS de cada nó não visitado
  for (const node of nodes) {
    if (!visited.has(node.id)) {
      dfs(node.id, []);
    }
  }
  
  return errors;
}

/**
 * Formata erros de validação de subrules para exibição
 */
export function formatSubrulesErrors(errors: z.ZodError): string[] {
  return errors.issues.map((err) => {
    const path = err.path.join(".");
    return `${path}: ${err.message}`;
  });
}

