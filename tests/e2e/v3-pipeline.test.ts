/**
 * E2E Tests for Oria v3.1 Pipeline
 * 
 * Testa o fluxo completo de ponta a ponta:
 * 1. Prompt → Product Role Mapper
 * 2. Product Role Mapper → Flow Synthesizer
 * 3. Flow Synthesizer → Archetype Modeler
 * 4. Archetype Modeler → Flow Critic
 * 5. Flow Critic → UX Block Composer
 * 6. UX Block Composer → Flow Connector
 * 7. Flow Connector → V3FlowNode[]
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { executeV3Pipeline, validatePipelineResults } from "@/lib/agents/v3/orchestrator-v3";
import type { 
  V3PipelineRequest, 
  V3PipelineResponse,
  ProductRoleMapperResponse,
  FlowSynthesizerResponse,
  ArchetypeModelResponse,
  FlowCriticResponse,
  UXBlockComposerV3Response,
  FlowConnectorResponse,
} from "@/lib/agents/v3/types";

// Mock completo dos agentes
vi.mock("@/lib/agents/v3/product-role-mapper", () => ({
  mapProductAndRole: vi.fn(),
  getProductContextFromProject: vi.fn(),
  saveProductContext: vi.fn(),
  getProjectRoles: vi.fn(),
}));

vi.mock("@/lib/agents/v3/flow-synthesizer", () => ({
  synthesizeFlow: vi.fn(),
  getExistingFlows: vi.fn(),
  analyzeFlowComplexity: vi.fn(),
  detectPatterns: vi.fn(),
}));

vi.mock("@/lib/agents/v3/archetype-modeler", () => ({
  modelArchetype: vi.fn(),
  mapArchetypesLocally: vi.fn(),
  getArchetypeRecommendations: vi.fn(),
  BUILTIN_ARCHETYPES: [],
}));

vi.mock("@/lib/agents/v3/flow-critic", () => ({
  criticizeFlow: vi.fn(),
  validateFlowLocally: vi.fn(),
  applyAutoFixes: vi.fn(),
  formatIntegrityScore: vi.fn(),
}));

vi.mock("@/lib/agents/v3/ux-block-composer-v3", () => ({
  composeUXBlocksV3: vi.fn(),
  searchLibraryBlocks: vi.fn(),
  adaptBlockForContext: vi.fn(),
  generateDefaultInputs: vi.fn(),
  composeBlocksLocally: vi.fn(),
}));

vi.mock("@/lib/agents/v3/flow-connector", () => ({
  connectFlow: vi.fn(),
  generateConnections: vi.fn(),
  detectReusableNodes: vi.fn(),
  generateDependencyGraph: vi.fn(),
  convertBlocksToNodes: vi.fn(),
  saveConnectedFlow: vi.fn(),
}));

describe("Oria v3.1 E2E Pipeline", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ================================================
  // FIXTURES
  // ================================================

  const mockProductRoleResponse: ProductRoleMapperResponse = {
    success: true,
    product_context: {
      product_name: "TaskFlow Pro",
      product_type: "saas",
      business_model: "b2b",
      main_value_proposition: "Gestão de tarefas para equipes",
      key_features: ["kanban", "automation", "reports"],
      target_audience: "Equipes de desenvolvimento",
      maturity_stage: "growth",
    },
    roles: [
      {
        role_id: "admin",
        role_name: "admin",
        role_scope: "global",
        permissions: ["manage_users", "manage_settings"],
        restrictions: [],
        typical_goals: ["Gerenciar equipe"],
        pain_points: ["Complexidade"],
      },
      {
        role_id: "member",
        role_name: "member",
        role_scope: "member",
        permissions: ["create_task", "update_task"],
        restrictions: [],
        typical_goals: ["Organizar trabalho"],
        pain_points: ["Tempo"],
      },
    ],
    primary_role: "member",
    analysis: {
      detected_product_type: "saas",
      detected_roles_count: 2,
      confidence_score: 0.92,
      suggestions: [],
    },
    message: "Contexto mapeado com sucesso",
  };

  const mockFlowSynthesizerResponse: FlowSynthesizerResponse = {
    success: true,
    synthesized_flow: {
      flow_id: "flow_1",
      flow_name: "Criar Nova Tarefa",
      flow_description: "Fluxo para criar uma nova tarefa no sistema",
      flow_category: "productivity",
      primary_role: "member",
      steps: [
        {
          step_id: "step_1",
          step_order: 1,
          title: "Abrir modal de criação",
          description: "Usuário clica no botão de nova tarefa",
          step_type: "action",
          is_critical: false,
          can_be_skipped: false,
        },
        {
          step_id: "step_2",
          step_order: 2,
          title: "Preencher dados da tarefa",
          description: "Formulário com título, descrição, prioridade",
          step_type: "form",
          is_critical: true,
          can_be_skipped: false,
        },
        {
          step_id: "step_3",
          step_order: 3,
          title: "Validar campos",
          description: "Validação de campos obrigatórios",
          step_type: "validation",
          is_critical: true,
          can_be_skipped: false,
        },
        {
          step_id: "step_4",
          step_order: 4,
          title: "Salvar tarefa",
          description: "Chamada à API para criar tarefa",
          step_type: "api_call",
          is_critical: true,
          can_be_skipped: false,
        },
        {
          step_id: "step_5",
          step_order: 5,
          title: "Exibir confirmação",
          description: "Toast de sucesso",
          step_type: "feedback",
          is_critical: false,
          can_be_skipped: true,
        },
      ],
      decisions: [
        {
          decision_id: "dec_1",
          after_step_id: "step_3",
          condition_expression: "isValid",
          true_branch_step_id: "step_4",
          false_branch_step_id: "error_1",
          decision_type: "validation_check",
        },
      ],
      failure_points: [
        {
          failure_id: "error_1",
          trigger_step_id: "step_3",
          failure_type: "validation",
          recovery_strategy: "inline_error",
          user_message: "Preencha os campos obrigatórios",
        },
      ],
      entry_step_id: "step_1",
      exit_step_ids: ["step_5"],
      estimated_completion_time_seconds: 45,
    },
    detected_patterns: ["form_submission", "validation_feedback"],
    reuse_opportunities: [],
    analysis: {
      total_steps: 5,
      critical_steps: 3,
      decision_points: 1,
      failure_points: 1,
      complexity_score: 4,
    },
    message: "Fluxo sintetizado com sucesso",
  };

  const mockArchetypeResponse: ArchetypeModelResponse = {
    success: true,
    archetype_mappings: [
      {
        step_id: "step_2",
        archetype_id: "form_progressive",
        archetype_name: "Progressive Form",
        category: "ux",
        confidence: 0.88,
      },
      {
        step_id: "step_5",
        archetype_id: "success_feedback",
        archetype_name: "Success Feedback",
        category: "ux",
        confidence: 0.95,
      },
    ],
    suggested_archetypes: [],
    patterns_detected: ["progressive_disclosure", "inline_validation"],
    enriched_flow: mockFlowSynthesizerResponse.synthesized_flow,
    analysis: {
      archetypes_applied: 2,
      coverage_percentage: 80,
      uncovered_steps: ["step_1"],
    },
    message: "Arquétipos modelados com sucesso",
  };

  const mockFlowCriticResponse: FlowCriticResponse = {
    success: true,
    is_valid: true,
    integrity_score: 87,
    findings: [
      {
        finding_id: "f1",
        severity: "minor",
        category: "accessibility",
        affected_element_id: "step_2",
        affected_element_type: "step",
        title: "Form sem labels ARIA",
        description: "Formulário não possui labels ARIA para acessibilidade",
        recommendation: "Adicionar aria-label aos campos",
        auto_fixable: true,
      },
    ],
    auto_fixes_applied: [],
    summary: {
      critical_count: 0,
      major_count: 0,
      minor_count: 1,
      suggestion_count: 0,
      auto_fixed_count: 0,
    },
    message: "Fluxo validado com score 87",
  };

  const mockUXComposerResponse: UXBlockComposerV3Response = {
    success: true,
    composed_blocks: [
      {
        block_id: "block_1",
        step_id: "step_1",
        block_type: "action_button",
        block_name: "Botão Nova Tarefa",
        is_from_library: true,
        library_block_id: "lib_btn_1",
        adaptations: [],
      },
      {
        block_id: "block_2",
        step_id: "step_2",
        block_type: "form",
        block_name: "Formulário de Tarefa",
        is_from_library: true,
        library_block_id: "lib_form_1",
        adaptations: [{ field: "fields", adaptation: "added_priority_field" }],
        inputs: [
          { field_id: "title", field_type: "text", label: "Título", required: true },
          { field_id: "description", field_type: "textarea", label: "Descrição", required: false },
          { field_id: "priority", field_type: "select", label: "Prioridade", required: true },
        ],
      },
      {
        block_id: "block_3",
        step_id: "step_5",
        block_type: "feedback",
        block_name: "Toast de Sucesso",
        is_from_library: true,
        library_block_id: "lib_toast_1",
        adaptations: [],
      },
    ],
    generated_blocks: [],
    library_usage: {
      blocks_reused: 3,
      blocks_adapted: 1,
      blocks_generated: 0,
      library_coverage_percentage: 100,
    },
    message: "Blocos UX compostos com sucesso",
  };

  const mockFlowConnectorResponse: FlowConnectorResponse = {
    success: true,
    connections: [
      { source_node_id: "node_1", target_node_id: "node_2", connection_type: "success" },
      { source_node_id: "node_2", target_node_id: "node_3", connection_type: "success" },
      { source_node_id: "node_3", target_node_id: "node_4", connection_type: "success" },
      { source_node_id: "node_3", target_node_id: "node_error", connection_type: "failure" },
      { source_node_id: "node_4", target_node_id: "node_5", connection_type: "success" },
    ],
    cross_references: [],
    reusability_info: [
      { node_id: "node_1", is_reused: false },
      { node_id: "node_2", is_reused: false },
    ],
    dependency_graph: {},
    message: "Fluxo conectado com sucesso",
  };

  // ================================================
  // TESTS
  // ================================================

  describe("Full Pipeline Execution", () => {
    it("should execute complete v3.1 pipeline successfully", async () => {
      // Arrange
      const { mapProductAndRole } = await import("@/lib/agents/v3/product-role-mapper");
      const { synthesizeFlow } = await import("@/lib/agents/v3/flow-synthesizer");
      const { modelArchetype } = await import("@/lib/agents/v3/archetype-modeler");
      const { criticizeFlow, applyAutoFixes } = await import("@/lib/agents/v3/flow-critic");
      const { composeUXBlocksV3 } = await import("@/lib/agents/v3/ux-block-composer-v3");
      const { connectFlow, convertBlocksToNodes } = await import("@/lib/agents/v3/flow-connector");

      vi.mocked(mapProductAndRole).mockResolvedValue(mockProductRoleResponse);
      vi.mocked(synthesizeFlow).mockResolvedValue(mockFlowSynthesizerResponse);
      vi.mocked(modelArchetype).mockResolvedValue(mockArchetypeResponse);
      vi.mocked(criticizeFlow).mockResolvedValue(mockFlowCriticResponse);
      vi.mocked(applyAutoFixes).mockReturnValue({
        fixed_flow: mockFlowSynthesizerResponse.synthesized_flow,
        fixes_applied: ["Added ARIA labels"],
      });
      vi.mocked(composeUXBlocksV3).mockResolvedValue(mockUXComposerResponse);
      vi.mocked(connectFlow).mockResolvedValue(mockFlowConnectorResponse);
      vi.mocked(convertBlocksToNodes).mockReturnValue([
        { id: "node_1", flow_id: "flow_1", type: "action", title: "Abrir modal", impact_level: "low", reused: false },
        { id: "node_2", flow_id: "flow_1", type: "form", title: "Preencher dados", impact_level: "high", reused: false },
        { id: "node_3", flow_id: "flow_1", type: "action", title: "Validar campos", impact_level: "medium", reused: false },
        { id: "node_4", flow_id: "flow_1", type: "action", title: "Salvar tarefa", impact_level: "high", reused: false },
        { id: "node_5", flow_id: "flow_1", type: "feedback_success", title: "Exibir confirmação", impact_level: "low", reused: false },
      ]);

      const request: V3PipelineRequest = {
        prompt: "Criar fluxo para adicionar nova tarefa no sistema de gestão",
        project_id: 1,
        user_id: 1,
        options: {
          validation_level: "standard",
          include_archetype_modeling: true,
          auto_fix_issues: true,
        },
      };

      const progressUpdates: any[] = [];

      // Act
      const result = await executeV3Pipeline(request, (progress) => {
        progressUpdates.push(progress);
      });

      // Assert
      expect(result.success).toBe(true);
      expect(result.final_nodes).toHaveLength(5);
      expect(result.final_connections).toHaveLength(5);
      expect(result.summary.integrity_score).toBe(87);
      
      // Verify all agents were called in order
      // Note: criticizeFlow is called twice when auto_fix is enabled and there are fixable issues
      expect(mapProductAndRole).toHaveBeenCalledTimes(1);
      expect(synthesizeFlow).toHaveBeenCalledTimes(1);
      expect(modelArchetype).toHaveBeenCalledTimes(1);
      expect(criticizeFlow).toHaveBeenCalledTimes(2); // 1st: validate, 2nd: re-validate after auto-fix
      expect(composeUXBlocksV3).toHaveBeenCalledTimes(1);
      expect(connectFlow).toHaveBeenCalledTimes(1);

      // Verify progress was reported
      expect(progressUpdates.length).toBeGreaterThan(0);
      expect(progressUpdates.some(p => p.agent === 1)).toBe(true);
      expect(progressUpdates.some(p => p.agent === 6)).toBe(true);
    });

    it("should skip archetype modeling when option is false", async () => {
      // Arrange
      const { mapProductAndRole } = await import("@/lib/agents/v3/product-role-mapper");
      const { synthesizeFlow } = await import("@/lib/agents/v3/flow-synthesizer");
      const { modelArchetype } = await import("@/lib/agents/v3/archetype-modeler");
      const { criticizeFlow } = await import("@/lib/agents/v3/flow-critic");
      const { composeUXBlocksV3 } = await import("@/lib/agents/v3/ux-block-composer-v3");
      const { connectFlow, convertBlocksToNodes } = await import("@/lib/agents/v3/flow-connector");

      vi.mocked(mapProductAndRole).mockResolvedValue(mockProductRoleResponse);
      vi.mocked(synthesizeFlow).mockResolvedValue(mockFlowSynthesizerResponse);
      vi.mocked(criticizeFlow).mockResolvedValue(mockFlowCriticResponse);
      vi.mocked(composeUXBlocksV3).mockResolvedValue(mockUXComposerResponse);
      vi.mocked(connectFlow).mockResolvedValue(mockFlowConnectorResponse);
      vi.mocked(convertBlocksToNodes).mockReturnValue([
        { id: "node_1", flow_id: "flow_1", type: "action", title: "Test", impact_level: "low", reused: false },
      ]);

      const request: V3PipelineRequest = {
        prompt: "Test",
        project_id: 1,
        user_id: 1,
        options: {
          include_archetype_modeling: false, // Skip archetype modeling
        },
      };

      // Act
      const result = await executeV3Pipeline(request);

      // Assert
      expect(result.success).toBe(true);
      expect(modelArchetype).not.toHaveBeenCalled(); // Should not be called
    });

    it("should handle Agent 1 failure gracefully", async () => {
      // Arrange
      const { mapProductAndRole } = await import("@/lib/agents/v3/product-role-mapper");

      vi.mocked(mapProductAndRole).mockResolvedValue({
        success: false,
        message: "Failed to connect to LLM",
        product_context: {} as any,
        roles: [],
        primary_role: "",
        analysis: {} as any,
      });

      const request: V3PipelineRequest = {
        prompt: "Test",
        project_id: 1,
        user_id: 1,
      };

      // Act & Assert
      await expect(executeV3Pipeline(request)).rejects.toThrow("Agent 1 falhou");
    });

    it("should handle Agent 4 (Flow Critic) failure and continue if auto_fix works", async () => {
      // Arrange
      const { mapProductAndRole } = await import("@/lib/agents/v3/product-role-mapper");
      const { synthesizeFlow } = await import("@/lib/agents/v3/flow-synthesizer");
      const { modelArchetype } = await import("@/lib/agents/v3/archetype-modeler");
      const { criticizeFlow, applyAutoFixes } = await import("@/lib/agents/v3/flow-critic");
      const { composeUXBlocksV3 } = await import("@/lib/agents/v3/ux-block-composer-v3");
      const { connectFlow, convertBlocksToNodes } = await import("@/lib/agents/v3/flow-connector");

      vi.mocked(mapProductAndRole).mockResolvedValue(mockProductRoleResponse);
      vi.mocked(synthesizeFlow).mockResolvedValue(mockFlowSynthesizerResponse);
      vi.mocked(modelArchetype).mockResolvedValue(mockArchetypeResponse);
      
      // First call returns fixable issues
      vi.mocked(criticizeFlow)
        .mockResolvedValueOnce({
          success: true,
          is_valid: false,
          integrity_score: 45,
          findings: [
            {
              finding_id: "f1",
              severity: "major",
              category: "completeness",
              affected_element_id: "step_2",
              affected_element_type: "step",
              title: "Missing error handling",
              description: "Form needs error handling",
              recommendation: "Add error handling",
              auto_fixable: true,
            },
          ],
          auto_fixes_applied: [],
          summary: { critical_count: 0, major_count: 1, minor_count: 0, suggestion_count: 0, auto_fixed_count: 0 },
          message: "Issues found",
        })
        // Second call after auto-fix returns valid
        .mockResolvedValueOnce({
          success: true,
          is_valid: true,
          integrity_score: 82,
          findings: [],
          auto_fixes_applied: ["f1"],
          summary: { critical_count: 0, major_count: 0, minor_count: 0, suggestion_count: 0, auto_fixed_count: 1 },
          message: "Auto-fixed",
        });

      vi.mocked(applyAutoFixes).mockReturnValue({
        fixed_flow: mockFlowSynthesizerResponse.synthesized_flow,
        fixes_applied: ["Added error handling"],
      });

      vi.mocked(composeUXBlocksV3).mockResolvedValue(mockUXComposerResponse);
      vi.mocked(connectFlow).mockResolvedValue(mockFlowConnectorResponse);
      vi.mocked(convertBlocksToNodes).mockReturnValue([
        { id: "node_1", flow_id: "flow_1", type: "action", title: "Test", impact_level: "low", reused: false },
      ]);

      const request: V3PipelineRequest = {
        prompt: "Test",
        project_id: 1,
        user_id: 1,
        options: {
          auto_fix_issues: true,
        },
      };

      // Act
      const result = await executeV3Pipeline(request);

      // Assert
      expect(result.success).toBe(true);
      expect(criticizeFlow).toHaveBeenCalledTimes(2); // Called twice (initial + after fix)
      expect(applyAutoFixes).toHaveBeenCalled();
      expect(result.summary.warnings).toContain("Auto-fixes aplicados: Added error handling");
    });
  });

  describe("Pipeline Results Validation", () => {
    it("should validate complete results", () => {
      const results: Partial<V3PipelineResponse> = {
        success: true,
        product_role_result: mockProductRoleResponse,
        flow_synthesis_result: mockFlowSynthesizerResponse,
        archetype_model_result: mockArchetypeResponse,
        flow_critic_result: mockFlowCriticResponse,
        ux_composer_result: mockUXComposerResponse,
        flow_connector_result: mockFlowConnectorResponse,
        final_nodes: [
          { id: "1", flow_id: "f1", type: "form", title: "Test", impact_level: "medium", reused: false },
        ],
      };

      const validation = validatePipelineResults(results);

      expect(validation.is_valid).toBe(true);
      expect(validation.issues).toHaveLength(0);
    });

    it("should detect multiple issues", () => {
      const results: Partial<V3PipelineResponse> = {
        success: true,
        product_role_result: undefined, // Missing
        flow_synthesis_result: { ...mockFlowSynthesizerResponse, success: false }, // Failed
        flow_critic_result: { ...mockFlowCriticResponse, is_valid: false }, // Invalid
        final_nodes: [], // Empty
      };

      const validation = validatePipelineResults(results);

      expect(validation.is_valid).toBe(false);
      expect(validation.issues.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe("Progress Tracking", () => {
    it("should report progress for all 6 agents", async () => {
      // Arrange
      const { mapProductAndRole } = await import("@/lib/agents/v3/product-role-mapper");
      const { synthesizeFlow } = await import("@/lib/agents/v3/flow-synthesizer");
      const { modelArchetype } = await import("@/lib/agents/v3/archetype-modeler");
      const { criticizeFlow } = await import("@/lib/agents/v3/flow-critic");
      const { composeUXBlocksV3 } = await import("@/lib/agents/v3/ux-block-composer-v3");
      const { connectFlow, convertBlocksToNodes } = await import("@/lib/agents/v3/flow-connector");

      vi.mocked(mapProductAndRole).mockResolvedValue(mockProductRoleResponse);
      vi.mocked(synthesizeFlow).mockResolvedValue(mockFlowSynthesizerResponse);
      vi.mocked(modelArchetype).mockResolvedValue(mockArchetypeResponse);
      vi.mocked(criticizeFlow).mockResolvedValue(mockFlowCriticResponse);
      vi.mocked(composeUXBlocksV3).mockResolvedValue(mockUXComposerResponse);
      vi.mocked(connectFlow).mockResolvedValue(mockFlowConnectorResponse);
      vi.mocked(convertBlocksToNodes).mockReturnValue([
        { id: "node_1", flow_id: "flow_1", type: "action", title: "Test", impact_level: "low", reused: false },
      ]);

      const progressUpdates: any[] = [];
      const request: V3PipelineRequest = {
        prompt: "Test",
        project_id: 1,
        user_id: 1,
      };

      // Act
      await executeV3Pipeline(request, (progress) => {
        progressUpdates.push(progress);
      });

      // Assert - Check all 6 agents reported progress
      const agentNumbers = progressUpdates.map(p => p.agent).filter(Boolean);
      expect(new Set(agentNumbers).size).toBe(6); // All 6 unique agents
      
      // Check status transitions
      const agent1Updates = progressUpdates.filter(p => p.agent === 1);
      expect(agent1Updates.some(p => p.status === "running")).toBe(true);
      expect(agent1Updates.some(p => p.status === "completed")).toBe(true);
    });

    it("should calculate percentage correctly", async () => {
      // Arrange
      const { mapProductAndRole } = await import("@/lib/agents/v3/product-role-mapper");
      const { synthesizeFlow } = await import("@/lib/agents/v3/flow-synthesizer");
      const { modelArchetype } = await import("@/lib/agents/v3/archetype-modeler");
      const { criticizeFlow } = await import("@/lib/agents/v3/flow-critic");
      const { composeUXBlocksV3 } = await import("@/lib/agents/v3/ux-block-composer-v3");
      const { connectFlow, convertBlocksToNodes } = await import("@/lib/agents/v3/flow-connector");

      vi.mocked(mapProductAndRole).mockResolvedValue(mockProductRoleResponse);
      vi.mocked(synthesizeFlow).mockResolvedValue(mockFlowSynthesizerResponse);
      vi.mocked(modelArchetype).mockResolvedValue(mockArchetypeResponse);
      vi.mocked(criticizeFlow).mockResolvedValue(mockFlowCriticResponse);
      vi.mocked(composeUXBlocksV3).mockResolvedValue(mockUXComposerResponse);
      vi.mocked(connectFlow).mockResolvedValue(mockFlowConnectorResponse);
      vi.mocked(convertBlocksToNodes).mockReturnValue([
        { id: "node_1", flow_id: "flow_1", type: "action", title: "Test", impact_level: "low", reused: false },
      ]);

      const progressUpdates: any[] = [];

      // Act
      await executeV3Pipeline({ prompt: "Test", project_id: 1, user_id: 1 }, (progress) => {
        progressUpdates.push(progress);
      });

      // Assert - Percentages should increase
      const percentages = progressUpdates.map(p => p.percentage).filter(Boolean);
      for (let i = 1; i < percentages.length; i++) {
        expect(percentages[i]).toBeGreaterThanOrEqual(percentages[i - 1]);
      }
      
      // Final percentage should be 100
      expect(percentages[percentages.length - 1]).toBe(100);
    });
  });
});

