/**
 * Brain Router Tests
 * 
 * Testes para o roteamento inteligente de modelos LLM.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  routeDeterministic,
  route,
  getModelConfig,
  formatRouteResult,
  shouldUseRAG,
} from "@/lib/brain/router";
import {
  calculateContextStats,
  estimateStringTokens,
  estimateJsonTokens,
} from "@/lib/brain/token-estimator";
import type { ContextStats, ProjectContext, BrainMessage } from "@/lib/brain/types";

// ========================================
// FIXTURES
// ========================================

const createMockContextStats = (overrides: Partial<ContextStats> = {}): ContextStats => ({
  total_tokens_estimate: 10_000,
  business_rules_count: 5,
  flow_specs_count: 3,
  flow_registry_count: 10,
  personas_count: 4,
  thread_messages_count: 10,
  is_large_context: false,
  largest_item_tokens: 2000,
  ...overrides,
});

const createLargeContextStats = (): ContextStats => ({
  total_tokens_estimate: 300_000, // Exceeds 250k threshold
  business_rules_count: 100,
  flow_specs_count: 50,
  flow_registry_count: 200,
  personas_count: 20,
  thread_messages_count: 100,
  is_large_context: true,
  largest_item_tokens: 50_000,
});

// ========================================
// DETERMINISTIC ROUTING TESTS
// ========================================

describe("Brain Router - Deterministic Routing", () => {
  describe("PLAN mode detection", () => {
    it("should route to PLAN for architecture prompts", () => {
      const prompts = [
        "Criar nova arquitetura do fluxo de onboarding",
        "Preciso refatorar o pipeline de checkout",
        "Alterar a estrutura de regras de negócio",
        "Gerar um novo FlowSpec para cadastro",
      ];

      for (const prompt of prompts) {
        const result = routeDeterministic(prompt, createMockContextStats());
        expect(result.mode).toBe("PLAN");
        expect(result.routing_rules_applied).toContain("plan_patterns_matched");
      }
    });

    it("should route to PLAN for business rules prompts", () => {
      const prompts = [
        "Criar nova regra de validação de CPF",
        "Adicionar regra de negócio para limite de crédito",
        "Modificar a regra de aprovação de pedidos",
        "Business rule para controle de estoque",
      ];

      for (const prompt of prompts) {
        const result = routeDeterministic(prompt, createMockContextStats());
        expect(result.mode).toBe("PLAN");
      }
    });

    it("should route to PLAN_PRO for high-risk prompts", () => {
      const prompts = [
        "Preciso refatorar e migrar todas as regras obsoletas para o novo formato",
        "Criar plano de migração de produção do schema antigo para v3",
        "Resolver conflito entre regras contraditórias em produção - alterar arquitetura",
      ];

      for (const prompt of prompts) {
        const result = routeDeterministic(prompt, createMockContextStats());
        expect(result.mode).toBe("PLAN");
        expect(result.risk_level).toBe("high");
        // Should suggest PRO model
        expect(result.routing_rules_applied).toContain("high_risk_use_pro");
      }
    });

    it("should route to PLAN for conflict resolution prompts", () => {
      const prompts = [
        "Tem um conflito entre essas duas regras - preciso alterar",
        "Isso contradiz a regra existente, preciso criar nova regra",
        "Refatorar o fluxo que está inconsistente com o spec",
        "Corrigir a lógica de branching que não está bifurcando corretamente",
      ];

      for (const prompt of prompts) {
        const result = routeDeterministic(prompt, createMockContextStats());
        expect(result.mode).toBe("PLAN");
      }
    });
  });

  describe("CONSULT mode detection", () => {
    it("should route to CONSULT for short questions", () => {
      const prompts = [
        "O que é um FlowSpec?",
        "Como funciona o branching?",
        "Onde está a regra de CPF?",
        "Qual modelo usar aqui?",
        "Por que isso não funciona?",
      ];

      for (const prompt of prompts) {
        const result = routeDeterministic(prompt, createMockContextStats());
        expect(result.mode).toBe("CONSULT");
        expect(result.routing_rules_applied.some(r => 
          r.includes("short_question") || r.includes("consult_patterns")
        )).toBe(true);
      }
    });

    it("should route to CONSULT for explanation requests", () => {
      const prompts = [
        "Me explica como funciona o sistema de regras",
        "Pode me falar sobre as personas do projeto?",
        "Resumo do fluxo de checkout",
        "Listar todas as regras aprovadas",
      ];

      for (const prompt of prompts) {
        const result = routeDeterministic(prompt, createMockContextStats());
        expect(result.mode).toBe("CONSULT");
      }
    });

    it("should route to CONSULT for suggestion requests", () => {
      const prompts = [
        "Você acha que devo usar form ou choice aqui?",
        "Alguma sugestão de melhoria?",
        "Recomenda alguma abordagem diferente?",
      ];

      for (const prompt of prompts) {
        const result = routeDeterministic(prompt, createMockContextStats());
        expect(result.mode).toBe("CONSULT");
      }
    });
  });

  describe("BATCH mode detection", () => {
    it("should route to BATCH for bulk transformation prompts", () => {
      const prompts = [
        "Reescrever todas as labels em português",
        "Normalizar os nomes das regras",
        "Padronizar os tooltips de todos os campos",
        "Traduzir todos os textos para inglês",
      ];

      for (const prompt of prompts) {
        const result = routeDeterministic(prompt, createMockContextStats());
        expect(result.mode).toBe("BATCH");
        expect(result.routing_rules_applied).toContain("batch_patterns_matched");
      }
    });

    it("should route to BATCH for extraction prompts", () => {
      const prompts = [
        "Extrair lista de todos os campos obrigatórios",
        "Gerar variações do texto de sucesso",
        "Formatar todos os nomes de acordo com o padrão",
        "Normalizar os labels dos campos",
      ];

      for (const prompt of prompts) {
        const result = routeDeterministic(prompt, createMockContextStats());
        expect(result.mode).toBe("BATCH");
      }
    });
  });

  describe("LONG_CONTEXT mode detection", () => {
    it("should route to LONG_CONTEXT when context exceeds threshold", () => {
      const result = routeDeterministic(
        "Me explica tudo sobre o projeto",
        createLargeContextStats()
      );

      expect(result.mode).toBe("LONG_CONTEXT");
      expect(result.routing_rules_applied).toContain("context_tokens_exceeded_threshold");
    });

    it("should include token count in routing reason", () => {
      const result = routeDeterministic(
        "Qualquer pergunta",
        createLargeContextStats()
      );

      expect(result.routing_reason).toContain("300");
      expect(result.routing_reason.toLowerCase()).toContain("token");
    });
  });

  describe("Uncertain routing", () => {
    it("should mark uncertain when no clear pattern", () => {
      const ambiguousPrompts = [
        "Fazer algo com os dados",
        "Processar as informações",
        "Olhar o sistema",
      ];

      for (const prompt of ambiguousPrompts) {
        const result = routeDeterministic(prompt, createMockContextStats());
        // Default to CONSULT when uncertain
        expect(result.mode).toBe("CONSULT");
        expect(result.uncertain).toBe(true);
        expect(result.routing_rules_applied).toContain("no_clear_pattern");
      }
    });
  });
});

// ========================================
// COMPLEXITY & RISK ESTIMATION
// ========================================

describe("Brain Router - Complexity & Risk Estimation", () => {
  it("should estimate higher complexity for long prompts", () => {
    const shortPrompt = "O que é isso?";
    const longPrompt = `Preciso criar uma arquitetura complexa que envolva múltiplos fluxos,
      integração com sistemas externos, migração de dados legados, e garantir que todos
      os casos de erro estejam cobertos. Além disso, preciso refatorar as regras existentes
      para se adequarem ao novo modelo de dados e garantir compatibilidade retroativa.`;

    const shortResult = routeDeterministic(shortPrompt, createMockContextStats());
    const longResult = routeDeterministic(longPrompt, createMockContextStats());

    expect(longResult.complexity).toBeGreaterThan(shortResult.complexity);
  });

  it("should detect high risk for destructive operations", () => {
    const highRiskPrompts = [
      "Deletar todas as regras",
      "Remover os fluxos antigos",
      "Migração de produção",
      "Breaking change nas APIs",
    ];

    for (const prompt of highRiskPrompts) {
      const result = routeDeterministic(prompt, createMockContextStats());
      expect(result.risk_level).toBe("high");
    }
  });

  it("should detect medium risk for modification operations", () => {
    const mediumRiskPrompts = [
      "Alterar a regra de validação",
      "Modificar o fluxo existente",
      "Atualizar as permissões",
    ];

    for (const prompt of mediumRiskPrompts) {
      const result = routeDeterministic(prompt, createMockContextStats());
      expect(result.risk_level).toBe("medium");
    }
  });

  it("should detect low risk for read-only operations", () => {
    const lowRiskPrompts = [
      "Qual é o status do projeto?",
      "Mostrar as regras atuais",
      "Explicar o funcionamento",
    ];

    for (const prompt of lowRiskPrompts) {
      const result = routeDeterministic(prompt, createMockContextStats());
      expect(result.risk_level).toBe("low");
    }
  });
});

// ========================================
// MODEL CONFIG RESOLUTION
// ========================================

describe("Brain Router - Model Config Resolution", () => {
  it("should return correct config for PLAN mode", () => {
    const result = routeDeterministic(
      "Criar nova arquitetura",
      createMockContextStats()
    );
    const config = getModelConfig(result);

    expect(config.reasoning_effort).toBe("medium");
    expect(config.text_verbosity).toBe("medium");
    expect(config.json_schema_name).toBe("BrainOutput");
    expect(config.fallback_chain.length).toBeGreaterThan(0);
  });

  it("should return correct config for CONSULT mode", () => {
    const result = routeDeterministic(
      "O que é isso?",
      createMockContextStats()
    );
    const config = getModelConfig(result);

    expect(config.reasoning_effort).toBe("low");
    expect(config.text_verbosity).toBe("low");
    expect(config.max_output_tokens).toBeLessThan(8000);
  });

  it("should return correct config for BATCH mode", () => {
    const result = routeDeterministic(
      "Normalizar todas as labels",
      createMockContextStats()
    );
    const config = getModelConfig(result);

    expect(config.reasoning_effort).toBe("minimal");
    expect(config.text_verbosity).toBe("low");
  });

  it("should use high reasoning effort for high-risk PLAN", () => {
    const result = routeDeterministic(
      "Criar plano de migração de produção com breaking changes - refatorar toda arquitetura",
      createMockContextStats()
    );
    const config = getModelConfig(result);

    expect(result.mode).toBe("PLAN");
    expect(result.risk_level).toBe("high");
    expect(config.reasoning_effort).toBe("high");
  });
});

// ========================================
// ROUTE WITH CLASSIFIER
// ========================================

describe("Brain Router - With Classifier", () => {
  it("should use classifier result when deterministic is uncertain", async () => {
    const mockClassifier = vi.fn().mockResolvedValue({
      mode: "PLAN",
      complexity: 0.8,
      risk_level: "medium",
      requires_structured_output: true,
      needs_tool_use: false,
      confidence: 0.9,
    });

    const result = await route(
      "Fazer algo com os dados",
      createMockContextStats(),
      mockClassifier
    );

    expect(mockClassifier).toHaveBeenCalled();
    expect(result.mode).toBe("PLAN");
    expect(result.used_classifier).toBe(true);
    expect(result.routing_rules_applied).toContain("classifier_used");
  });

  it("should not use classifier when deterministic is certain", async () => {
    const mockClassifier = vi.fn().mockResolvedValue({
      mode: "BATCH",
      complexity: 0.3,
      risk_level: "low",
      requires_structured_output: false,
      needs_tool_use: false,
      confidence: 0.9,
    });

    const result = await route(
      "Criar nova arquitetura do sistema",
      createMockContextStats(),
      mockClassifier
    );

    expect(mockClassifier).not.toHaveBeenCalled();
    expect(result.mode).toBe("PLAN");
    expect(result.used_classifier).toBe(false);
  });

  it("should fallback to deterministic when classifier fails", async () => {
    const mockClassifier = vi.fn().mockRejectedValue(new Error("API Error"));

    const result = await route(
      "Fazer algo com os dados",
      createMockContextStats(),
      mockClassifier
    );

    expect(mockClassifier).toHaveBeenCalled();
    // Should fallback to CONSULT (default for uncertain)
    expect(result.mode).toBe("CONSULT");
    expect(result.routing_rules_applied).toContain("classifier_failed_fallback");
  });
});

// ========================================
// TOKEN ESTIMATION
// ========================================

describe("Brain Router - Token Estimation", () => {
  it("should estimate tokens for strings", () => {
    const shortText = "Hello";
    const longText = "This is a longer text that should have more tokens";

    const shortTokens = estimateStringTokens(shortText);
    const longTokens = estimateStringTokens(longText);

    expect(shortTokens).toBeLessThan(longTokens);
    expect(shortTokens).toBeGreaterThan(0);
  });

  it("should estimate tokens for JSON objects", () => {
    const simpleObj = { name: "test" };
    const complexObj = {
      name: "test",
      nested: { a: 1, b: 2, c: [1, 2, 3, 4, 5] },
      list: ["item1", "item2", "item3"],
    };

    const simpleTokens = estimateJsonTokens(simpleObj);
    const complexTokens = estimateJsonTokens(complexObj);

    expect(complexTokens).toBeGreaterThan(simpleTokens);
  });

  it("should calculate context stats correctly", () => {
    const mockContext: ProjectContext = {
      project_id: 1,
      product_profile: {
        id: 1,
        project_id: 1,
        product_name: "Test Product",
        product_type: "saas",
        created_at: "",
        updated_at: "",
      },
      personas: [
        {
          id: 1,
          project_id: 1,
          role_id: "admin",
          role_name: "Admin",
          role_scope: "admin",
          permissions: ["read", "write"],
          restrictions: [],
          typical_goals: [],
          pain_points: [],
          created_at: "",
        },
      ],
      business_rules: [],
      flow_registry: [],
      flow_specs: [],
    };

    const stats = calculateContextStats(mockContext, []);

    expect(stats.personas_count).toBe(1);
    expect(stats.business_rules_count).toBe(0);
    expect(stats.total_tokens_estimate).toBeGreaterThan(0);
    expect(stats.is_large_context).toBe(false);
  });
});

// ========================================
// RAG STRATEGY
// ========================================

describe("Brain Router - RAG Strategy", () => {
  it("should suggest RAG for moderate context size", () => {
    const moderateStats = createMockContextStats({
      total_tokens_estimate: 150_000, // 60% of 250k
      is_large_context: false,
    });

    expect(shouldUseRAG(moderateStats)).toBe(true);
  });

  it("should not suggest RAG for small context", () => {
    const smallStats = createMockContextStats({
      total_tokens_estimate: 10_000,
      is_large_context: false,
    });

    expect(shouldUseRAG(smallStats)).toBe(false);
  });
});

// ========================================
// FORMAT ROUTE RESULT
// ========================================

describe("Brain Router - Formatting", () => {
  it("should format route result for logging", () => {
    const result = routeDeterministic(
      "Criar nova regra",
      createMockContextStats()
    );

    const formatted = formatRouteResult(result);

    expect(formatted).toContain("PLAN");
    expect(formatted).toContain("Mode:");
    expect(formatted).toContain("Model:");
    expect(formatted).toContain("Risk:");
  });
});

// ========================================
// EDGE CASES
// ========================================

describe("Brain Router - Edge Cases", () => {
  it("should handle empty prompt", () => {
    const result = routeDeterministic("", createMockContextStats());
    
    // Should default to CONSULT when uncertain
    expect(result.mode).toBe("CONSULT");
    expect(result.uncertain).toBe(true);
  });

  it("should handle very long prompt", () => {
    const longPrompt = "x".repeat(10000);
    const result = routeDeterministic(longPrompt, createMockContextStats());
    
    // Should not throw
    expect(result.mode).toBeDefined();
  });

  it("should handle special characters in prompt", () => {
    const specialPrompt = "Criar regra com emoji 🚀 e acentos: àéîõü ç";
    const result = routeDeterministic(specialPrompt, createMockContextStats());
    
    expect(result.mode).toBe("PLAN"); // Contains "criar regra"
  });

  it("should handle mixed language prompts", () => {
    const mixedPrompt = "Create new business rule para validação de email";
    const result = routeDeterministic(mixedPrompt, createMockContextStats());
    
    expect(result.mode).toBe("PLAN"); // Contains "business rule"
  });
});

