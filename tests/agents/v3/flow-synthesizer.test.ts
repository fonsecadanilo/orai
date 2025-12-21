/**
 * Tests for Agent 2: Flow Synthesizer
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { supabase } from "@/lib/supabase/client";
import {
  synthesizeFlow,
  analyzeFlowComplexity,
  detectPatterns,
} from "@/lib/agents/v3/flow-synthesizer";
import type { SynthesizedFlow, ProductContext, RoleDefinition } from "@/lib/agents/v3/types";

describe("Flow Synthesizer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockProductContext: ProductContext = {
    product_name: "Test SaaS",
    product_type: "saas",
    business_model: "b2b",
    main_value_proposition: "Testing platform",
    key_features: ["feature1"],
    target_audience: "Developers",
    maturity_stage: "growth",
  };

  const mockRoles: RoleDefinition[] = [
    {
      role_id: "user",
      role_name: "user",
      role_scope: "member",
      permissions: ["view", "edit"],
      restrictions: [],
      typical_goals: ["Complete tasks"],
      pain_points: [],
    },
  ];

  describe("synthesizeFlow", () => {
    it("should successfully synthesize a flow", async () => {
      const mockResponse = {
        success: true,
        synthesized_flow: {
          flow_id: "flow_1",
          flow_name: "Login Flow",
          flow_description: "User authentication flow",
          flow_category: "authentication",
          primary_role: "user",
          steps: [
            {
              step_id: "step_1",
              step_order: 1,
              title: "Enter credentials",
              description: "User enters email and password",
              step_type: "form",
              is_critical: true,
              can_be_skipped: false,
            },
          ],
          decisions: [],
          failure_points: [],
          entry_step_id: "step_1",
          exit_step_ids: ["step_1"],
          estimated_completion_time_seconds: 60,
        },
        detected_patterns: ["authentication_form"],
        reuse_opportunities: [],
        analysis: {
          total_steps: 1,
          critical_steps: 1,
          decision_points: 0,
          failure_points: 0,
          complexity_score: 3,
        },
        message: "Fluxo sintetizado",
      };

      vi.mocked(supabase.functions.invoke).mockResolvedValue({
        data: mockResponse,
        error: null,
      });

      const result = await synthesizeFlow({
        product_context: mockProductContext,
        roles: mockRoles,
        primary_role: "user",
        user_prompt: "Create login flow",
        project_id: 1,
        user_id: 1,
      });

      expect(result.success).toBe(true);
      expect(result.synthesized_flow.flow_name).toBe("Login Flow");
      expect(result.synthesized_flow.steps).toHaveLength(1);
    });

    it("should throw error when Edge Function fails", async () => {
      vi.mocked(supabase.functions.invoke).mockResolvedValue({
        data: null,
        error: { message: "Server error" } as any,
      });

      await expect(
        synthesizeFlow({
          product_context: mockProductContext,
          roles: mockRoles,
          primary_role: "user",
          user_prompt: "Test",
          project_id: 1,
          user_id: 1,
        })
      ).rejects.toMatchObject({
        code: "EDGE_FUNCTION_ERROR",
      });
    });
  });

  describe("analyzeFlowComplexity", () => {
    it("should calculate complexity score correctly for simple flow", () => {
      const simpleFlow: SynthesizedFlow = {
        flow_id: "1",
        flow_name: "Simple Flow",
        flow_description: "A simple flow",
        flow_category: "other",
        primary_role: "user",
        steps: [
          { step_id: "1", step_order: 1, title: "Step 1", description: "", step_type: "form", is_critical: false, can_be_skipped: true },
          { step_id: "2", step_order: 2, title: "Step 2", description: "", step_type: "action", is_critical: false, can_be_skipped: true },
        ],
        decisions: [],
        failure_points: [],
        entry_step_id: "1",
        exit_step_ids: ["2"],
        estimated_completion_time_seconds: 30,
      };

      const result = analyzeFlowComplexity(simpleFlow);

      expect(result.complexity_score).toBeLessThan(50);
      expect(result.breakdown.steps_score).toBeGreaterThan(0);
      expect(result.breakdown.decisions_score).toBe(0);
    });

    it("should calculate higher complexity for complex flow", () => {
      const complexFlow: SynthesizedFlow = {
        flow_id: "2",
        flow_name: "Complex Flow",
        flow_description: "A complex flow",
        flow_category: "checkout",
        primary_role: "user",
        steps: Array(10).fill(null).map((_, i) => ({
          step_id: `step_${i}`,
          step_order: i,
          title: `Step ${i}`,
          description: "",
          step_type: "form" as const,
          is_critical: i < 3,
          can_be_skipped: false,
        })),
        decisions: Array(5).fill(null).map((_, i) => ({
          decision_id: `dec_${i}`,
          after_step_id: `step_${i}`,
          question: `Decision ${i}?`,
          options: [
            { option_id: "yes", label: "Sim", leads_to_step_id: `step_${i + 1}`, is_default: false },
            { option_id: "no", label: "Não", leads_to_step_id: `step_${i + 2}`, is_default: true },
          ],
        })),
        failure_points: Array(5).fill(null).map((_, i) => ({
          failure_id: `fail_${i}`,
          at_step_id: `step_${i}`,
          failure_type: "validation" as const,
          description: "Validation error",
          recovery_strategy: "retry" as const,
        })),
        entry_step_id: "step_0",
        exit_step_ids: ["step_9"],
        estimated_completion_time_seconds: 300,
      };

      const result = analyzeFlowComplexity(complexFlow);

      expect(result.complexity_score).toBeGreaterThan(70);
    });
  });

  describe("detectPatterns", () => {
    it("should detect authentication pattern", () => {
      const authFlow: SynthesizedFlow = {
        flow_id: "1",
        flow_name: "Login",
        flow_description: "Login flow",
        flow_category: "authentication",
        primary_role: "user",
        steps: [
          { step_id: "1", step_order: 1, title: "Enter password", description: "", step_type: "form", is_critical: true, can_be_skipped: false },
        ],
        decisions: [],
        failure_points: [],
        entry_step_id: "1",
        exit_step_ids: ["1"],
        estimated_completion_time_seconds: 30,
      };

      const patterns = detectPatterns(authFlow);

      expect(patterns).toContain("authentication_form");
      expect(patterns).toContain("password_handling");
    });

    it("should detect retry pattern", () => {
      const flowWithRetry: SynthesizedFlow = {
        flow_id: "1",
        flow_name: "Submit Form",
        flow_description: "Form submission",
        flow_category: "other",
        primary_role: "user",
        steps: [
          { step_id: "1", step_order: 1, title: "Fill form", description: "", step_type: "form", is_critical: false, can_be_skipped: false },
        ],
        decisions: [],
        failure_points: [
          {
            failure_id: "f1",
            at_step_id: "1",
            failure_type: "system",
            description: "Network error",
            recovery_strategy: "retry",
          },
        ],
        entry_step_id: "1",
        exit_step_ids: ["1"],
        estimated_completion_time_seconds: 60,
      };

      const patterns = detectPatterns(flowWithRetry);

      expect(patterns).toContain("retry_pattern");
    });

    it("should detect branching flow", () => {
      const branchingFlow: SynthesizedFlow = {
        flow_id: "1",
        flow_name: "Choice Flow",
        flow_description: "Flow with choices",
        flow_category: "other",
        primary_role: "user",
        steps: [
          { step_id: "1", step_order: 1, title: "Choose", description: "", step_type: "choice", is_critical: false, can_be_skipped: false },
        ],
        decisions: [
          {
            decision_id: "d1",
            after_step_id: "1",
            question: "Which path?",
            options: [
              { option_id: "a", label: "Path A", leads_to_step_id: "2", is_default: false },
              { option_id: "b", label: "Path B", leads_to_step_id: "3", is_default: true },
            ],
          },
        ],
        failure_points: [],
        entry_step_id: "1",
        exit_step_ids: ["1"],
        estimated_completion_time_seconds: 30,
      };

      const patterns = detectPatterns(branchingFlow);

      expect(patterns).toContain("branching_flow");
    });
  });
});







