import { z } from "zod";

/**
 * Schema das Subrules v3.0 - NÓS RICOS
 * 
 * NOVA ARQUITETURA v3.0:
 * - IDs simbólicos (slugs únicos)
 * - Tipos de nó
 * - Títulos e descrições
 * - Conexões via next_on_success/failure
 * - NOVO: page_key (página associada)
 * - NOVO: user_intent / system_behavior
 * - NOVO: ux_recommendation
 * - NOVO: inputs (campos de formulário)
 * - NOVO: error_cases (erros esperados)
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
export const EndStatusEnum = z.enum(["success", "error", "cancel"]);
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
 * Schema de input de formulário v3.0
 */
export const FormInputSchema = z.object({
  name: z
    .string()
    .min(1)
    .describe("Nome do campo (ex: 'email', 'password', 'name')"),
  
  type: z
    .enum([
      "text",
      "email",
      "password",
      "number",
      "tel",
      "date",
      "datetime",
      "select",
      "checkbox",
      "radio",
      "textarea",
      "file",
      "hidden"
    ])
    .default("text")
    .describe("Tipo do campo de entrada"),
  
  label: z
    .string()
    .optional()
    .describe("Rótulo do campo para exibição"),
  
  placeholder: z
    .string()
    .optional()
    .describe("Texto de placeholder"),
  
  required: z
    .boolean()
    .optional()
    .default(false)
    .describe("Se o campo é obrigatório"),
  
  validation: z
    .array(z.string())
    .optional()
    .describe("Regras de validação (ex: ['required', 'valid_email', 'min_length:8'])"),
  
  options: z
    .array(z.object({
      value: z.string(),
      label: z.string(),
    }))
    .optional()
    .describe("Opções para select/radio/checkbox"),
  
  default_value: z
    .string()
    .optional()
    .describe("Valor padrão do campo"),
});

export type FormInput = z.infer<typeof FormInputSchema>;

/**
 * Schema de um nó simbólico básico (SubRule) - compatível com versão anterior
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
  flow_category: FlowCategoryEnum
    .optional()
    .default("main")
    .describe("Categoria do nó para posicionamento: main, error ou alternative"),
});

export type SubRuleNode = z.infer<typeof SubRuleNodeSchema>;

/**
 * Schema de um Nó Rico v3.0 (RichNode)
 * Versão completa com inputs, UX e semântica
 */
export const RichNodeSchema = z.object({
  // === CAMPOS BASE (compatíveis com SubRuleNode) ===
  id: z
    .string()
    .min(1, "ID é obrigatório")
    .regex(/^[a-z0-9_]+$/, "ID deve ser um slug")
    .describe("Slug único para identificar o nó"),
  
  type: NodeTypeEnum.describe("Tipo do nó"),
  
  title: z
    .string()
    .min(3, "Título deve ter pelo menos 3 caracteres")
    .describe("Título descritivo do nó"),
  
  description: z
    .string()
    .describe("Descrição detalhada do que acontece neste passo"),
  
  next_on_success: z
    .string()
    .nullable()
    .optional()
    .describe("ID do próximo nó em caso de sucesso"),
  
  next_on_failure: z
    .string()
    .nullable()
    .optional()
    .describe("ID do próximo nó em caso de falha"),
  
  end_status: EndStatusEnum
    .optional()
    .describe("Status do término (success/error/cancel)"),
  
  flow_category: FlowCategoryEnum
    .optional()
    .default("main")
    .describe("Categoria do nó para posicionamento"),
  
  // === NOVOS CAMPOS v3.0 ===
  
  // Página associada
  page_key: z
    .string()
    .optional()
    .describe("Página onde este nó acontece (ex: 'login', 'signup', 'onboarding')"),
  
  // Intenção do usuário
  user_intent: z
    .string()
    .optional()
    .describe("O que o usuário quer fazer nesta etapa"),
  
  // Comportamento do sistema
  system_behavior: z
    .string()
    .optional()
    .describe("O que o sistema faz nesta etapa"),
  
  // Recomendação de UX
  ux_recommendation: z
    .string()
    .optional()
    .describe("Dica de UX para implementação"),
  
  // Inputs de formulário (quando aplicável)
  inputs: z
    .array(FormInputSchema)
    .optional()
    .describe("Campos de formulário neste nó"),
  
  // Casos de erro esperados
  error_cases: z
    .array(z.string())
    .optional()
    .describe("Erros esperados nesta etapa"),
  
  // Se permite retry
  allows_retry: z
    .boolean()
    .optional()
    .default(false)
    .describe("Se o usuário pode tentar novamente"),
  
  // Se permite cancelar
  allows_cancel: z
    .boolean()
    .optional()
    .default(false)
    .describe("Se o usuário pode cancelar/voltar"),
  
  // ID do nó de retry (se permite retry)
  retry_node_id: z
    .string()
    .optional()
    .describe("ID do nó para onde ir em retry"),
  
  // ID do nó de cancel (se permite cancel)
  cancel_node_id: z
    .string()
    .optional()
    .describe("ID do nó para onde ir em cancel"),
  
  // Metadados adicionais
  metadata: z
    .record(z.unknown())
    .optional()
    .describe("Metadados adicionais do nó"),
});

export type RichNode = z.infer<typeof RichNodeSchema>;

/**
 * Converte RichNode para SubRuleNode (compatibilidade)
 */
export function richNodeToSubRuleNode(richNode: RichNode): SubRuleNode {
  return {
    id: richNode.id,
    type: richNode.type,
    title: richNode.title,
    description: richNode.description,
    next_on_success: richNode.next_on_success,
    next_on_failure: richNode.next_on_failure,
    end_status: richNode.end_status === "cancel" ? "error" : richNode.end_status,
    flow_category: richNode.flow_category,
  };
}

/**
 * Converte SubRuleNode para RichNode (upgrade)
 */
export function subRuleNodeToRichNode(node: SubRuleNode, extras?: Partial<RichNode>): RichNode {
  return {
    ...node,
    ...extras,
  };
}

/**
 * Schema da resposta completa do Subrules Decomposer (básico)
 */
export const SubrulesResponseSchema = z.object({
  nodes: z
    .array(SubRuleNodeSchema)
    .min(3, "Deve haver pelo menos 3 nós (trigger, ação, end)"),
});

export type SubrulesResponse = z.infer<typeof SubrulesResponseSchema>;

/**
 * Schema da resposta do Subrules Decomposer v3.0 (RichNodes)
 */
export const RichSubrulesResponseSchema = z.object({
  nodes: z
    .array(RichNodeSchema)
    .min(3, "Deve haver pelo menos 3 nós (trigger, ação, end)"),
  
  // Metadados da resposta
  metadata: z.object({
    total_inputs: z.number().optional(),
    pages_used: z.array(z.string()).optional(),
    has_recovery_flow: z.boolean().optional(),
    has_retry_options: z.boolean().optional(),
    ux_patterns_applied: z.array(z.string()).optional(),
  }).optional(),
});

export type RichSubrulesResponse = z.infer<typeof RichSubrulesResponseSchema>;

/**
 * Validação estrutural do grafo de subrules
 */
export interface GraphValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Valida as subrules (básicas) e retorna erros se houver
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
 * Valida RichNodes e retorna erros se houver
 */
export function validateRichSubrules(data: unknown): {
  success: boolean;
  data?: RichSubrulesResponse;
  errors?: z.ZodError;
} {
  const result = RichSubrulesResponseSchema.safeParse(data);
  
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

// ========================================
// VALIDAÇÕES ESPECÍFICAS PARA FLUXOS SAAS
// ========================================

/**
 * Resultado de validação SaaS
 */
export interface SaaSValidationResult {
  isValid: boolean;
  errors: SaaSValidationError[];
  warnings: SaaSValidationWarning[];
  score: number; // 0-100
  suggestions: string[];
}

export interface SaaSValidationError {
  code: string;
  message: string;
  nodeId?: string;
  severity: "error" | "critical";
}

export interface SaaSValidationWarning {
  code: string;
  message: string;
  nodeId?: string;
  suggestion?: string;
}

/**
 * Valida fluxo com padrões SaaS
 */
export function validateSaaSFlow(nodes: RichNode[]): SaaSValidationResult {
  const errors: SaaSValidationError[] = [];
  const warnings: SaaSValidationWarning[] = [];
  const suggestions: string[] = [];
  
  // Detectar tipo de fluxo
  const isAuthFlow = nodes.some(n => 
    n.page_key?.includes("login") || 
    n.page_key?.includes("signup") || 
    n.page_key?.includes("auth") ||
    n.title.toLowerCase().includes("login") ||
    n.title.toLowerCase().includes("cadastro")
  );
  
  const hasOnboarding = nodes.some(n => 
    n.page_key?.includes("onboarding") ||
    n.title.toLowerCase().includes("onboarding")
  );
  
  const hasSignup = nodes.some(n => 
    n.page_key?.includes("signup") ||
    n.title.toLowerCase().includes("cadastro") ||
    n.title.toLowerCase().includes("registro")
  );
  
  const hasLogin = nodes.some(n => 
    n.page_key?.includes("login") ||
    n.title.toLowerCase().includes("login") ||
    n.title.toLowerCase().includes("entrar")
  );
  
  const hasDashboard = nodes.some(n => 
    n.page_key?.includes("dashboard") ||
    n.title.toLowerCase().includes("dashboard") ||
    n.title.toLowerCase().includes("painel")
  );
  
  // === VALIDAÇÕES PARA FLUXOS DE AUTENTICAÇÃO ===
  if (isAuthFlow) {
    // 1. Fluxo de login/cadastro deve ter destino pós-sucesso
    if (!hasDashboard && !hasOnboarding) {
      warnings.push({
        code: "AUTH_NO_DESTINATION",
        message: "Fluxo de autenticação não tem destino pós-sucesso definido (dashboard ou onboarding)",
        suggestion: "Adicione um nó de dashboard ou onboarding como destino após login/cadastro bem-sucedido",
      });
      suggestions.push("Considere adicionar uma página de dashboard ou onboarding como destino do fluxo");
    }
    
    // 2. Fluxo de login deve ter tratamento de erro claro
    const loginNodes = nodes.filter(n => 
      n.page_key?.includes("login") || n.title.toLowerCase().includes("login")
    );
    
    for (const loginNode of loginNodes) {
      if (!loginNode.error_cases || loginNode.error_cases.length === 0) {
        warnings.push({
          code: "LOGIN_NO_ERROR_CASES",
          message: `Nó de login "${loginNode.title}" não tem casos de erro definidos`,
          nodeId: loginNode.id,
          suggestion: "Adicione casos de erro como 'Senha incorreta', 'Usuário não encontrado'",
        });
      }
    }
    
    // 3. Fluxo de login deve ter opção de recuperar senha
    const hasRecovery = nodes.some(n => 
      n.page_key?.includes("recovery") ||
      n.title.toLowerCase().includes("recuperar") ||
      n.title.toLowerCase().includes("esqueci")
    );
    
    if (hasLogin && !hasRecovery) {
      warnings.push({
        code: "AUTH_NO_RECOVERY",
        message: "Fluxo de login não tem opção de recuperação de senha",
        suggestion: "Adicione um nó para recuperação de senha",
      });
      suggestions.push("Adicione um fluxo de 'Esqueci minha senha' para melhor UX");
    }
  }
  
  // === VALIDAÇÕES PARA SIGNUP ===
  if (hasSignup) {
    const signupNodes = nodes.filter(n => 
      n.page_key?.includes("signup") || 
      n.title.toLowerCase().includes("cadastro") ||
      n.title.toLowerCase().includes("registro")
    );
    
    for (const signupNode of signupNodes) {
      // Signup deve ter inputs mínimos: email + password
      if (signupNode.inputs) {
        const hasEmail = signupNode.inputs.some(i => 
          i.name === "email" || i.type === "email"
        );
        const hasPassword = signupNode.inputs.some(i => 
          i.name === "password" || i.type === "password"
        );
        
        if (!hasEmail) {
          warnings.push({
            code: "SIGNUP_NO_EMAIL",
            message: `Nó de cadastro "${signupNode.title}" não tem campo de email`,
            nodeId: signupNode.id,
            suggestion: "Adicione um campo de email para cadastro",
          });
        }
        
        if (!hasPassword) {
          warnings.push({
            code: "SIGNUP_NO_PASSWORD",
            message: `Nó de cadastro "${signupNode.title}" não tem campo de senha`,
            nodeId: signupNode.id,
            suggestion: "Adicione um campo de senha para cadastro",
          });
        }
      } else {
        warnings.push({
          code: "SIGNUP_NO_INPUTS",
          message: `Nó de cadastro "${signupNode.title}" não tem inputs definidos`,
          nodeId: signupNode.id,
          suggestion: "Defina os campos do formulário de cadastro (email, senha, nome, etc.)",
        });
      }
    }
    
    // Se tem signup, deve ir para onboarding ou dashboard
    if (!hasOnboarding && !hasDashboard) {
      warnings.push({
        code: "SIGNUP_NO_NEXT_STEP",
        message: "Fluxo de cadastro não direciona para onboarding ou dashboard",
        suggestion: "Após cadastro bem-sucedido, direcione para onboarding (primeiro acesso) ou dashboard",
      });
    }
  }
  
  // === VALIDAÇÕES PARA ONBOARDING ===
  if (hasOnboarding) {
    const onboardingNodes = nodes.filter(n => 
      n.page_key?.includes("onboarding") ||
      n.title.toLowerCase().includes("onboarding")
    );
    
    // Onboarding deve ter pelo menos 2 steps
    if (onboardingNodes.length < 2) {
      warnings.push({
        code: "ONBOARDING_TOO_SHORT",
        message: "Onboarding tem poucos passos",
        suggestion: "Considere adicionar mais passos de onboarding para melhor experiência do usuário",
      });
    }
    
    // Onboarding deve ter opção de pular
    const hasSkip = onboardingNodes.some(n => 
      n.allows_cancel ||
      n.title.toLowerCase().includes("pular") ||
      n.description.toLowerCase().includes("pular")
    );
    
    if (!hasSkip) {
      warnings.push({
        code: "ONBOARDING_NO_SKIP",
        message: "Onboarding não permite pular",
        suggestion: "Considere permitir que o usuário pule o onboarding e complete depois",
      });
    }
  }
  
  // === VALIDAÇÕES PARA FORMULÁRIOS ===
  const formNodes = nodes.filter(n => n.inputs && n.inputs.length > 0);
  
  for (const formNode of formNodes) {
    // Verificar se campos obrigatórios têm validação
    const requiredInputs = formNode.inputs!.filter(i => i.required);
    const inputsWithoutValidation = requiredInputs.filter(i => 
      !i.validation || i.validation.length === 0
    );
    
    if (inputsWithoutValidation.length > 0) {
      warnings.push({
        code: "FORM_NO_VALIDATION",
        message: `Nó "${formNode.title}" tem ${inputsWithoutValidation.length} campo(s) obrigatório(s) sem validação`,
        nodeId: formNode.id,
        suggestion: "Adicione regras de validação para campos obrigatórios",
      });
    }
  }
  
  // === VALIDAÇÕES GERAIS ===
  
  // Verificar se conditions têm opção de retry
  const conditions = nodes.filter(n => n.type === "condition");
  for (const condition of conditions) {
    if (!condition.allows_retry && condition.flow_category === "main") {
      suggestions.push(`Considere permitir retry no nó "${condition.title}" para melhor UX`);
    }
  }
  
  // Verificar se há nós sem UX recommendation
  const nodesWithoutUX = nodes.filter(n => !n.ux_recommendation && n.type !== "end");
  if (nodesWithoutUX.length > 3) {
    suggestions.push("Considere adicionar recomendações de UX para os nós principais do fluxo");
  }
  
  // Calcular score
  let score = 100;
  score -= errors.filter(e => e.severity === "critical").length * 20;
  score -= errors.filter(e => e.severity === "error").length * 10;
  score -= warnings.length * 5;
  
  // Bonus por boas práticas
  if (isAuthFlow && hasRecovery) score += 5;
  if (hasSignup && hasOnboarding) score += 5;
  if (formNodes.every(n => n.inputs!.every(i => i.validation?.length))) score += 5;
  
  return {
    isValid: errors.filter(e => e.severity === "critical").length === 0,
    errors,
    warnings,
    score: Math.max(0, Math.min(100, score)),
    suggestions,
  };
}

/**
 * Inputs padrão para páginas SaaS comuns
 */
export const STANDARD_PAGE_INPUTS: Record<string, FormInput[]> = {
  login: [
    { name: "email", type: "email", label: "E-mail", required: true, validation: ["required", "valid_email"] },
    { name: "password", type: "password", label: "Senha", required: true, validation: ["required", "min_length:6"] },
  ],
  signup: [
    { name: "name", type: "text", label: "Nome completo", required: true, validation: ["required", "min_length:3"] },
    { name: "email", type: "email", label: "E-mail", required: true, validation: ["required", "valid_email"] },
    { name: "password", type: "password", label: "Senha", required: true, validation: ["required", "min_length:8", "has_uppercase", "has_number"] },
    { name: "password_confirm", type: "password", label: "Confirmar senha", required: true, validation: ["required", "matches:password"] },
  ],
  recovery: [
    { name: "email", type: "email", label: "E-mail cadastrado", required: true, validation: ["required", "valid_email"] },
  ],
  reset_password: [
    { name: "password", type: "password", label: "Nova senha", required: true, validation: ["required", "min_length:8", "has_uppercase", "has_number"] },
    { name: "password_confirm", type: "password", label: "Confirmar nova senha", required: true, validation: ["required", "matches:password"] },
  ],
  checkout: [
    { name: "card_number", type: "text", label: "Número do cartão", required: true, validation: ["required", "card_number"] },
    { name: "card_expiry", type: "text", label: "Validade (MM/AA)", required: true, validation: ["required", "card_expiry"] },
    { name: "card_cvv", type: "text", label: "CVV", required: true, validation: ["required", "cvv"] },
    { name: "card_holder", type: "text", label: "Nome no cartão", required: true, validation: ["required"] },
  ],
  profile: [
    { name: "name", type: "text", label: "Nome", required: true, validation: ["required", "min_length:3"] },
    { name: "email", type: "email", label: "E-mail", required: true, validation: ["required", "valid_email"] },
    { name: "phone", type: "tel", label: "Telefone", required: false, validation: ["phone"] },
    { name: "avatar", type: "file", label: "Foto de perfil", required: false },
  ],
};

