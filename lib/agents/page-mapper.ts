/**
 * Page Mapper Agent v1.0
 * 
 * CAMADA NA PIPELINE v3.0:
 * Mapeia páginas e transições a partir de MasterRule + Journey.
 * 
 * IMPORTANTE: Este agente é 100% código determinístico.
 * NÃO usa LLM - apenas processa os dados estruturados.
 * 
 * Pipeline:
 * 1. Master Rule Creator → MasterRule (com pages_involved)
 * 2. Journey Creator → Journey (com page_key em steps)
 * 3. Flow Enricher → EnrichedFlow
 * 4. Page Mapper → PageContext (ESTE AGENTE)
 * 5. Subrules Decomposer → RichNodes
 * 6. Flow Generator → Visual Graph
 */

import type { PageDefinition } from "@/lib/schemas/masterRuleSchema";
import type { 
  PageContext, 
  PageTransition, 
  JourneyStructured,
  Journey 
} from "@/lib/schemas/journeySchema";
import type { EnrichedFlow } from "./flow-enricher";

/**
 * Cria o PageContext a partir das páginas e jornada
 */
export function createPageContext(
  pagesInvolved: PageDefinition[],
  journeyStructured?: JourneyStructured,
  journey?: Journey,
  enrichedFlow?: EnrichedFlow
): PageContext {
  const pagesUsed = new Map<string, { page_key: string; label: string; path?: string; description?: string; page_type?: string }>();
  const transitions: PageTransition[] = [];
  
  // 1. Adicionar páginas da MasterRule
  for (const page of pagesInvolved) {
    pagesUsed.set(page.page_key, {
      page_key: page.page_key,
      label: page.label,
      path: page.path,
      description: page.description,
      page_type: page.page_type,
    });
  }
  
  // 2. Extrair páginas da Journey estruturada
  if (journeyStructured) {
    // Steps
    for (let i = 0; i < journeyStructured.steps.length; i++) {
      const step = journeyStructured.steps[i];
      
      if (step.page_key) {
        if (!pagesUsed.has(step.page_key)) {
          pagesUsed.set(step.page_key, {
            page_key: step.page_key,
            label: formatPageLabel(step.page_key),
          });
        }
        
        // Detectar transições entre steps consecutivos
        if (i < journeyStructured.steps.length - 1) {
          const nextStep = journeyStructured.steps[i + 1];
          if (nextStep.page_key && step.page_key !== nextStep.page_key) {
            transitions.push({
              from_page: step.page_key,
              to_page: nextStep.page_key,
              reason: step.step_id || `step_${i + 1}_to_${i + 2}`,
              is_error_path: false,
            });
          }
        }
      }
    }
    
    // Decisions - adicionar transições para cada opção
    for (const decision of journeyStructured.decisions) {
      if (decision.page_key && decision.options) {
        for (const option of decision.options) {
          // Verificar se a opção é uma page_key conhecida
          const normalizedOption = option.toLowerCase().replace(/\s+/g, '_');
          if (pagesUsed.has(normalizedOption) || isLikelyPageKey(normalizedOption)) {
            transitions.push({
              from_page: decision.page_key,
              to_page: normalizedOption,
              reason: `user_chose_${normalizedOption}`,
              is_error_path: false,
            });
          }
        }
      }
    }
    
    // Failure points - adicionar transições de erro
    for (const failure of journeyStructured.failure_points) {
      if (failure.page_key) {
        // Adicionar página de erro se não existe
        if (!pagesUsed.has("error")) {
          pagesUsed.set("error", {
            page_key: "error",
            label: "Página de Erro",
            page_type: "error",
          });
        }
        
        transitions.push({
          from_page: failure.page_key,
          to_page: failure.recovery_page || "error",
          reason: failure.failure_id || `failure_${failure.description.substring(0, 20)}`,
          is_error_path: true,
        });
      }
    }
  }
  
  // 3. Adicionar páginas do EnrichedFlow
  if (enrichedFlow) {
    for (const step of enrichedFlow.extra_steps) {
      if (step.page_key && !pagesUsed.has(step.page_key)) {
        pagesUsed.set(step.page_key, {
          page_key: step.page_key,
          label: formatPageLabel(step.page_key),
        });
      }
    }
    
    for (const decision of enrichedFlow.extra_decisions) {
      if (decision.page_key && !pagesUsed.has(decision.page_key)) {
        pagesUsed.set(decision.page_key, {
          page_key: decision.page_key,
          label: formatPageLabel(decision.page_key),
        });
      }
    }
    
    for (const failure of enrichedFlow.extra_failure_points) {
      if (failure.page_key && !pagesUsed.has(failure.page_key)) {
        pagesUsed.set(failure.page_key, {
          page_key: failure.page_key,
          label: formatPageLabel(failure.page_key),
        });
      }
    }
  }
  
  // 4. Determinar páginas de entrada e saída
  let entryPage: string | undefined;
  const exitPagesSuccess: string[] = [];
  const exitPagesError: string[] = [];
  
  // Página de entrada é a primeira da jornada
  if (journeyStructured?.steps[0]?.page_key) {
    entryPage = journeyStructured.steps[0].page_key;
  } else if (pagesUsed.has("auth")) {
    entryPage = "auth";
  } else if (pagesUsed.has("login")) {
    entryPage = "login";
  }
  
  // Páginas de saída com sucesso
  for (const [key, page] of pagesUsed) {
    if (
      page.page_type === "success" || 
      page.page_type === "dashboard" ||
      key === "dashboard" ||
      key === "success" ||
      key === "confirmation"
    ) {
      exitPagesSuccess.push(key);
    }
  }
  
  // Páginas de saída com erro
  for (const [key, page] of pagesUsed) {
    if (page.page_type === "error" || key === "error") {
      exitPagesError.push(key);
    }
  }
  
  // 5. Remover transições duplicadas
  const uniqueTransitions = removeDuplicateTransitions(transitions);
  
  return {
    pages: Array.from(pagesUsed.values()),
    transitions: uniqueTransitions,
    entry_page: entryPage,
    exit_pages_success: exitPagesSuccess.length > 0 ? exitPagesSuccess : undefined,
    exit_pages_error: exitPagesError.length > 0 ? exitPagesError : undefined,
  };
}

/**
 * Infere transições padrão baseado no tipo de fluxo
 */
export function inferStandardTransitions(
  flowType: "auth" | "signup" | "checkout" | "onboarding" | "crud" | "other",
  existingPages: string[]
): PageTransition[] {
  const transitions: PageTransition[] = [];
  
  switch (flowType) {
    case "auth":
      if (existingPages.includes("auth") && existingPages.includes("login")) {
        transitions.push({
          from_page: "auth",
          to_page: "login",
          reason: "user_chose_login",
        });
      }
      if (existingPages.includes("auth") && existingPages.includes("signup")) {
        transitions.push({
          from_page: "auth",
          to_page: "signup",
          reason: "user_chose_signup",
        });
      }
      if (existingPages.includes("login") && existingPages.includes("dashboard")) {
        transitions.push({
          from_page: "login",
          to_page: "dashboard",
          reason: "login_success",
        });
      }
      if (existingPages.includes("login") && existingPages.includes("recovery")) {
        transitions.push({
          from_page: "login",
          to_page: "recovery",
          reason: "user_forgot_password",
        });
      }
      break;
      
    case "signup":
      if (existingPages.includes("signup") && existingPages.includes("onboarding")) {
        transitions.push({
          from_page: "signup",
          to_page: "onboarding",
          reason: "signup_success",
        });
      }
      if (existingPages.includes("onboarding") && existingPages.includes("dashboard")) {
        transitions.push({
          from_page: "onboarding",
          to_page: "dashboard",
          reason: "onboarding_completed",
        });
      }
      // Pular onboarding
      if (existingPages.includes("onboarding") && existingPages.includes("dashboard")) {
        transitions.push({
          from_page: "onboarding",
          to_page: "dashboard",
          reason: "user_skipped_onboarding",
        });
      }
      break;
      
    case "checkout":
      if (existingPages.includes("checkout") && existingPages.includes("confirmation")) {
        transitions.push({
          from_page: "checkout",
          to_page: "confirmation",
          reason: "payment_success",
        });
      }
      if (existingPages.includes("checkout") && existingPages.includes("error")) {
        transitions.push({
          from_page: "checkout",
          to_page: "error",
          reason: "payment_failed",
          is_error_path: true,
        });
      }
      break;
  }
  
  return transitions;
}

/**
 * Detecta o tipo de fluxo baseado nas páginas
 */
export function detectFlowType(pages: string[]): "auth" | "signup" | "checkout" | "onboarding" | "crud" | "other" {
  const pagesLower = pages.map(p => p.toLowerCase());
  
  if (pagesLower.includes("auth") || (pagesLower.includes("login") && pagesLower.includes("signup"))) {
    return "auth";
  }
  if (pagesLower.includes("signup") && !pagesLower.includes("login")) {
    return "signup";
  }
  if (pagesLower.includes("checkout") || pagesLower.includes("payment")) {
    return "checkout";
  }
  if (pagesLower.includes("onboarding") && !pagesLower.includes("login")) {
    return "onboarding";
  }
  if (pagesLower.includes("list") || pagesLower.includes("detail") || pagesLower.includes("form")) {
    return "crud";
  }
  
  return "other";
}

// ========================================
// HELPERS
// ========================================

/**
 * Formata page_key para label legível
 */
function formatPageLabel(pageKey: string): string {
  return pageKey
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Verifica se uma string parece ser um page_key
 */
function isLikelyPageKey(value: string): boolean {
  const commonPageKeys = [
    "auth", "login", "signup", "recovery", "reset_password",
    "onboarding", "dashboard", "settings", "profile",
    "checkout", "payment", "confirmation", "success", "error",
    "list", "detail", "form", "home"
  ];
  
  return commonPageKeys.includes(value.toLowerCase());
}

/**
 * Remove transições duplicadas
 */
function removeDuplicateTransitions(transitions: PageTransition[]): PageTransition[] {
  const seen = new Set<string>();
  const unique: PageTransition[] = [];
  
  for (const t of transitions) {
    const key = `${t.from_page}->${t.to_page}:${t.reason}`;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(t);
    }
  }
  
  return unique;
}

/**
 * Valida um PageContext
 */
export function validatePageContext(context: PageContext): {
  isValid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Deve ter pelo menos uma página
  if (!context.pages || context.pages.length === 0) {
    errors.push("PageContext deve ter pelo menos uma página");
  }
  
  // Verificar se todas as páginas referenciadas em transições existem
  const pageKeys = new Set(context.pages.map(p => p.page_key));
  
  for (const t of context.transitions) {
    if (!pageKeys.has(t.from_page)) {
      errors.push(`Transição referencia página inexistente: ${t.from_page}`);
    }
    if (!pageKeys.has(t.to_page)) {
      errors.push(`Transição referencia página inexistente: ${t.to_page}`);
    }
  }
  
  // Verificar se entry_page existe
  if (context.entry_page && !pageKeys.has(context.entry_page)) {
    errors.push(`Página de entrada inexistente: ${context.entry_page}`);
  }
  
  // Verificar exit pages
  for (const exitPage of context.exit_pages_success || []) {
    if (!pageKeys.has(exitPage)) {
      warnings.push(`Página de saída (sucesso) inexistente: ${exitPage}`);
    }
  }
  
  for (const exitPage of context.exit_pages_error || []) {
    if (!pageKeys.has(exitPage)) {
      warnings.push(`Página de saída (erro) inexistente: ${exitPage}`);
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}













