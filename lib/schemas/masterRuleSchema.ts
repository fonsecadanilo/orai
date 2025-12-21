import { z } from "zod";

/**
 * Schema da Master Rule v2.0 - SEMÂNTICA + PÁGINAS ENVOLVIDAS
 * 
 * O LLM cuida de:
 * - Objetivo de negócio
 * - Contexto
 * - Atores
 * - Premissas
 * - Fluxos (principal, alternativos, erros)
 * - NOVO: Páginas envolvidas no fluxo (pages_involved)
 * 
 * NÃO inclui:
 * - Blueprint de nós
 * - Índices
 * - Estrutura de grafo
 * - Layout
 */

/**
 * Definição de uma página envolvida no fluxo
 * Identifica as telas/páginas que participam do processo
 */
export const PageDefinitionSchema = z.object({
  page_key: z
    .string()
    .min(1)
    .regex(/^[a-z0-9_]+$/, "page_key deve ser slug (letras minúsculas, números e _)")
    .describe("Identificador único da página (ex: 'auth', 'login', 'signup', 'dashboard')"),
  
  label: z
    .string()
    .min(3)
    .describe("Nome amigável da página (ex: 'Página de Login')"),
  
  path: z
    .string()
    .optional()
    .describe("Sugestão de rota/URL (ex: '/login')"),
  
  description: z
    .string()
    .optional()
    .describe("Papel da página no fluxo"),
  
  page_type: z
    .enum([
      "auth",           // Autenticação (login/signup choice)
      "login",          // Login específico
      "signup",         // Cadastro
      "recovery",       // Recuperação de senha
      "onboarding",     // Primeiro acesso
      "dashboard",      // Tela principal
      "settings",       // Configurações
      "checkout",       // Pagamento
      "profile",        // Perfil do usuário
      "list",           // Listagem de items
      "detail",         // Detalhe de item
      "form",           // Formulário genérico
      "confirmation",   // Confirmação
      "error",          // Página de erro
      "success",        // Página de sucesso
      "other"           // Outro tipo
    ])
    .optional()
    .default("other")
    .describe("Tipo/categoria da página"),
});

export type PageDefinition = z.infer<typeof PageDefinitionSchema>;

/**
 * Schema principal da Master Rule v2.0
 */
export const MasterRuleSchema = z.object({
  business_goal: z
    .string()
    .min(10, "O objetivo de negócio deve ter pelo menos 10 caracteres")
    .describe("Objetivo principal do fluxo de negócio"),
  
  context: z
    .string()
    .min(10, "O contexto deve ter pelo menos 10 caracteres")
    .describe("Cenário ou contexto em uma frase"),
  
  actors: z
    .array(z.string().min(1))
    .min(1, "Deve haver pelo menos 1 ator")
    .describe("Quem participa do fluxo (usuário, sistema, etc)"),
  
  assumptions: z
    .array(z.string().min(1))
    .describe("O que assumimos como verdade para este fluxo"),
  
  main_flow: z
    .array(z.string().min(5))
    .min(3, "O fluxo principal deve ter pelo menos 3 passos")
    .describe("Passos básicos do fluxo principal (happy path)"),
  
  alternative_flows: z
    .array(z.string())
    .describe("Variantes e caminhos alternativos"),
  
  error_flows: z
    .array(z.string())
    .describe("Erros, exceções e tratamentos"),
  
  // NOVO v2.0: Páginas envolvidas no fluxo
  pages_involved: z
    .array(PageDefinitionSchema)
    .optional()
    .default([])
    .describe("Páginas/telas que participam do fluxo"),
});

export type MasterRule = z.infer<typeof MasterRuleSchema>;

/**
 * Páginas padrão comuns em fluxos SaaS
 * Usado como referência pelo Master Rule Creator
 */
export const COMMON_SAAS_PAGES: PageDefinition[] = [
  { page_key: "auth", label: "Página de Autenticação", path: "/auth", page_type: "auth", description: "Tela inicial onde o usuário escolhe entre login e cadastro" },
  { page_key: "login", label: "Página de Login", path: "/login", page_type: "login", description: "Tela com formulário para usuários que já possuem conta" },
  { page_key: "signup", label: "Página de Cadastro", path: "/signup", page_type: "signup", description: "Tela com formulário para novos usuários" },
  { page_key: "recovery", label: "Recuperação de Senha", path: "/forgot-password", page_type: "recovery", description: "Tela para recuperar senha esquecida" },
  { page_key: "onboarding", label: "Onboarding", path: "/onboarding", page_type: "onboarding", description: "Fluxo de primeiro acesso após cadastro" },
  { page_key: "dashboard", label: "Dashboard", path: "/dashboard", page_type: "dashboard", description: "Tela principal após login bem-sucedido" },
  { page_key: "settings", label: "Configurações", path: "/settings", page_type: "settings", description: "Tela de configurações do usuário/conta" },
  { page_key: "checkout", label: "Checkout", path: "/checkout", page_type: "checkout", description: "Tela de pagamento/finalização de compra" },
  { page_key: "profile", label: "Perfil", path: "/profile", page_type: "profile", description: "Tela de perfil do usuário" },
];

/**
 * Schema completo para a resposta do Master Rule Creator v2.0
 */
export const MasterRuleResponseSchema = z.object({
  master_rule: MasterRuleSchema,
  
  // Metadados inferidos pelo modelo
  inferred_metadata: z.object({
    category: z.enum([
      "autenticacao",
      "pagamento",
      "cadastro",
      "checkout",
      "onboarding",
      "configuracao",
      "relatorio",
      "comunicacao",
      "crud",
      "outro"
    ]).default("outro"),
    
    complexity: z.enum(["simple", "medium", "complex"]).default("medium"),
    
    estimated_steps: z.number().min(3).default(5),
    
    tags: z.array(z.string()).default([]),
    
    // NOVO v2.0: Páginas detectadas automaticamente
    detected_pages: z.array(z.string()).optional().default([]),
    
    // NOVO v2.0: Se o fluxo envolve autenticação
    involves_auth: z.boolean().optional().default(false),
    
    // NOVO v2.0: Se requer onboarding
    requires_onboarding: z.boolean().optional().default(false),
  }).optional(),
});

export type MasterRuleResponse = z.infer<typeof MasterRuleResponseSchema>;

/**
 * Helper para detectar páginas com base no conteúdo do fluxo
 */
export function detectPagesFromFlow(
  mainFlow: string[],
  alternativeFlows: string[],
  errorFlows: string[]
): PageDefinition[] {
  const allText = [...mainFlow, ...alternativeFlows, ...errorFlows].join(" ").toLowerCase();
  const detectedPages: PageDefinition[] = [];
  
  // Detectar páginas comuns
  if (allText.includes("login") || allText.includes("entrar") || allText.includes("autenticar")) {
    detectedPages.push({ page_key: "login", label: "Página de Login", path: "/login", page_type: "login" });
  }
  if (allText.includes("cadastro") || allText.includes("registr") || allText.includes("criar conta") || allText.includes("signup")) {
    detectedPages.push({ page_key: "signup", label: "Página de Cadastro", path: "/signup", page_type: "signup" });
  }
  if (allText.includes("recuperar senha") || allText.includes("esqueci") || allText.includes("resetar senha")) {
    detectedPages.push({ page_key: "recovery", label: "Recuperação de Senha", path: "/forgot-password", page_type: "recovery" });
  }
  if (allText.includes("onboarding") || allText.includes("primeiro acesso") || allText.includes("boas-vindas") || allText.includes("tutorial")) {
    detectedPages.push({ page_key: "onboarding", label: "Onboarding", path: "/onboarding", page_type: "onboarding" });
  }
  if (allText.includes("dashboard") || allText.includes("painel") || allText.includes("tela principal") || allText.includes("home")) {
    detectedPages.push({ page_key: "dashboard", label: "Dashboard", path: "/dashboard", page_type: "dashboard" });
  }
  if (allText.includes("checkout") || allText.includes("pagamento") || allText.includes("finalizar compra")) {
    detectedPages.push({ page_key: "checkout", label: "Checkout", path: "/checkout", page_type: "checkout" });
  }
  if (allText.includes("configurações") || allText.includes("settings") || allText.includes("preferências")) {
    detectedPages.push({ page_key: "settings", label: "Configurações", path: "/settings", page_type: "settings" });
  }
  if (allText.includes("perfil") || allText.includes("profile") || allText.includes("minha conta")) {
    detectedPages.push({ page_key: "profile", label: "Perfil", path: "/profile", page_type: "profile" });
  }
  
  // Se detectou login ou signup, adicionar página de auth (escolha)
  if (detectedPages.some(p => p.page_key === "login" || p.page_key === "signup")) {
    if (!detectedPages.some(p => p.page_key === "auth")) {
      detectedPages.unshift({ page_key: "auth", label: "Página de Autenticação", path: "/auth", page_type: "auth" });
    }
  }
  
  return detectedPages;
}

/**
 * Valida uma Master Rule e retorna erros se houver
 */
export function validateMasterRule(data: unknown): {
  success: boolean;
  data?: MasterRule;
  errors?: z.ZodError;
} {
  const result = MasterRuleSchema.safeParse(data);
  
  if (result.success) {
    return { success: true, data: result.data };
  }
  
  return { success: false, errors: result.error };
}

/**
 * Formata erros de validação para exibição
 */
export function formatMasterRuleErrors(errors: z.ZodError): string[] {
  return errors.issues.map((err) => {
    const path = err.path.join(".");
    return `${path}: ${err.message}`;
  });
}

