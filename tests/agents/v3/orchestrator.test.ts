/**
 * Tests for Orchestrator v3.1
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { validatePipelineResults } from "@/lib/agents/v3/orchestrator-v3";
import type { V3PipelineResponse, ProductContext, RoleDefinition, SynthesizedFlow } from "@/lib/agents/v3/types";

describe("Orchestrator v3.1", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockProductContext: ProductContext = {
    product_name: "Test SaaS",
    product_type: "saas",
    business_model: "b2b",
    main_value_proposition: "Testing",
    key_features: [],
    target_audience: "Devs",
    maturity_stage: "growth",
  };

  const mockRoles: RoleDefinition[] = [
    {
      role_id: "user",
      role_name: "user",
      role_scope: "member",
      permissions: [],
      restrictions: [],
      typical_goals: [],
      pain_points: [],
    },
  ];

  const mockSynthesizedFlow: SynthesizedFlow = {
    flow_id: "1",
    flow_name: "Test Flow",
    flow_description: "A test flow",
    flow_category: "other",
    primary_role: "user",
    steps: [
      { step_id: "1", step_order: 1, title: "Step 1", description: "", step_type: "form", is_critical: false, can_be_skipped: false },
    ],
    decisions: [],
    failure_points: [],
    entry_step_id: "1",
    exit_step_ids: ["1"],
    estimated_completion_time_seconds: 30,
  };

  describe("validatePipelineResults", () => {
    it("should validate complete pipeline results", () => {
      const completeResults: Partial<V3PipelineResponse> = {
        product_role_result: {
          success: true,
          product_context: mockProductContext,
          roles: mockRoles,
          primary_role: "user",
          analysis: {
            detected_product_type: "saas",
            detected_roles_count: 1,
            confidence_score: 0.9,
            suggestions: [],
          },
          message: "OK",
        },
        flow_synthesis_result: {
          success: true,
          synthesized_flow: mockSynthesizedFlow,
          detected_patterns: [],
          reuse_opportunities: [],
          analysis: {
            total_steps: 1,
            critical_steps: 0,
            decision_points: 0,
            failure_points: 0,
            complexity_score: 2,
          },
          message: "OK",
        },
        flow_critic_result: {
          success: true,
          is_valid: true,
          integrity_score: 85,
          findings: [],
          auto_fixes_applied: [],
          summary: {
            critical_count: 0,
            major_count: 0,
            minor_count: 0,
            suggestion_count: 0,
            auto_fixed_count: 0,
          },
          message: "OK",
        },
        final_nodes: [
          {
            id: "1",
            flow_id: "1",
            type: "form",
            title: "Step 1",
            impact_level: "medium",
            reused: false,
          },
        ],
      };

      const result = validatePipelineResults(completeResults);

      expect(result.is_valid).toBe(true);
      expect(result.issues).toHaveLength(0);
    });

    it("should detect missing product role result", () => {
      const incompleteResults: Partial<V3PipelineResponse> = {
        product_role_result: undefined,
        flow_synthesis_result: {
          success: true,
          synthesized_flow: mockSynthesizedFlow,
          detected_patterns: [],
          reuse_opportunities: [],
          analysis: {
            total_steps: 1,
            critical_steps: 0,
            decision_points: 0,
            failure_points: 0,
            complexity_score: 2,
          },
          message: "OK",
        },
        flow_critic_result: {
          success: true,
          is_valid: true,
          integrity_score: 85,
          findings: [],
          auto_fixes_applied: [],
          summary: {
            critical_count: 0,
            major_count: 0,
            minor_count: 0,
            suggestion_count: 0,
            auto_fixed_count: 0,
          },
          message: "OK",
        },
        final_nodes: [{ id: "1", flow_id: "1", type: "form", title: "Test", impact_level: "medium", reused: false }],
      };

      const result = validatePipelineResults(incompleteResults);

      expect(result.is_valid).toBe(false);
      expect(result.issues.some(i => i.includes("Product & Role Mapper"))).toBe(true);
    });

    it("should detect failed flow synthesis", () => {
      const failedResults: Partial<V3PipelineResponse> = {
        product_role_result: {
          success: true,
          product_context: mockProductContext,
          roles: mockRoles,
          primary_role: "user",
          analysis: { detected_product_type: "saas", detected_roles_count: 1, confidence_score: 0.9, suggestions: [] },
          message: "OK",
        },
        flow_synthesis_result: {
          success: false, // Failed
          synthesized_flow: mockSynthesizedFlow,
          detected_patterns: [],
          reuse_opportunities: [],
          analysis: { total_steps: 0, critical_steps: 0, decision_points: 0, failure_points: 0, complexity_score: 0 },
          message: "Failed",
        },
        flow_critic_result: {
          success: true,
          is_valid: true,
          integrity_score: 85,
          findings: [],
          auto_fixes_applied: [],
          summary: { critical_count: 0, major_count: 0, minor_count: 0, suggestion_count: 0, auto_fixed_count: 0 },
          message: "OK",
        },
        final_nodes: [],
      };

      const result = validatePipelineResults(failedResults);

      expect(result.is_valid).toBe(false);
      expect(result.issues.some(i => i.includes("Flow Synthesizer"))).toBe(true);
    });

    it("should detect invalid flow critic result", () => {
      const invalidFlowResults: Partial<V3PipelineResponse> = {
        product_role_result: {
          success: true,
          product_context: mockProductContext,
          roles: mockRoles,
          primary_role: "user",
          analysis: { detected_product_type: "saas", detected_roles_count: 1, confidence_score: 0.9, suggestions: [] },
          message: "OK",
        },
        flow_synthesis_result: {
          success: true,
          synthesized_flow: mockSynthesizedFlow,
          detected_patterns: [],
          reuse_opportunities: [],
          analysis: { total_steps: 1, critical_steps: 0, decision_points: 0, failure_points: 0, complexity_score: 2 },
          message: "OK",
        },
        flow_critic_result: {
          success: true,
          is_valid: false, // Invalid
          integrity_score: 20,
          findings: [
            {
              finding_id: "f1",
              severity: "critical",
              category: "completeness",
              affected_element_id: "flow",
              affected_element_type: "flow",
              title: "Critical issue",
              description: "Missing entry",
              recommendation: "Fix it",
              auto_fixable: false,
            },
          ],
          auto_fixes_applied: [],
          summary: { critical_count: 1, major_count: 0, minor_count: 0, suggestion_count: 0, auto_fixed_count: 0 },
          message: "Invalid",
        },
        final_nodes: [],
      };

      const result = validatePipelineResults(invalidFlowResults);

      expect(result.is_valid).toBe(false);
      expect(result.issues.some(i => i.includes("Flow Critic"))).toBe(true);
    });

    it("should detect empty final nodes", () => {
      const emptyNodesResults: Partial<V3PipelineResponse> = {
        product_role_result: {
          success: true,
          product_context: mockProductContext,
          roles: mockRoles,
          primary_role: "user",
          analysis: { detected_product_type: "saas", detected_roles_count: 1, confidence_score: 0.9, suggestions: [] },
          message: "OK",
        },
        flow_synthesis_result: {
          success: true,
          synthesized_flow: mockSynthesizedFlow,
          detected_patterns: [],
          reuse_opportunities: [],
          analysis: { total_steps: 1, critical_steps: 0, decision_points: 0, failure_points: 0, complexity_score: 2 },
          message: "OK",
        },
        flow_critic_result: {
          success: true,
          is_valid: true,
          integrity_score: 85,
          findings: [],
          auto_fixes_applied: [],
          summary: { critical_count: 0, major_count: 0, minor_count: 0, suggestion_count: 0, auto_fixed_count: 0 },
          message: "OK",
        },
        final_nodes: [], // Empty
      };

      const result = validatePipelineResults(emptyNodesResults);

      expect(result.is_valid).toBe(false);
      expect(result.issues.some(i => i.includes("nó"))).toBe(true);
    });
  });
});







