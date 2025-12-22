/**
 * Tests for Agent 4: Flow Critic
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { supabase } from "@/lib/supabase/client";
import {
  validateFlowLocally,
  applyAutoFixes,
  formatIntegrityScore,
} from "@/lib/agents/v3/flow-critic";
import type { SynthesizedFlow, CritiqueFinding } from "@/lib/agents/v3/types";

describe("Flow Critic", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("validateFlowLocally", () => {
    it("should validate a well-formed flow", () => {
      const validFlow: SynthesizedFlow = {
        flow_id: "1",
        flow_name: "Valid Flow",
        flow_description: "A valid flow",
        flow_category: "other",
        primary_role: "user",
        steps: [
          { step_id: "1", step_order: 1, title: "Start", description: "", step_type: "form", is_critical: true, can_be_skipped: false },
          { step_id: "2", step_order: 2, title: "End", description: "", step_type: "end_success", is_critical: false, can_be_skipped: false },
        ],
        decisions: [],
        failure_points: [
          { failure_id: "f1", at_step_id: "1", failure_type: "validation", description: "Error", recovery_strategy: "retry", recovery_step_id: "1" },
        ],
        entry_step_id: "1",
        exit_step_ids: ["2"],
        estimated_completion_time_seconds: 30,
      };

      const result = validateFlowLocally(validFlow);

      expect(result.is_valid).toBe(true);
      expect(result.integrity_score).toBeGreaterThan(80);
    });

    it("should fail flow without entry point", () => {
      const flowWithoutEntry: SynthesizedFlow = {
        flow_id: "1",
        flow_name: "Invalid Flow",
        flow_description: "Missing entry",
        flow_category: "other",
        primary_role: "user",
        steps: [
          { step_id: "1", step_order: 1, title: "Step", description: "", step_type: "form", is_critical: false, can_be_skipped: false },
        ],
        decisions: [],
        failure_points: [],
        entry_step_id: "", // Missing
        exit_step_ids: ["1"],
        estimated_completion_time_seconds: 30,
      };

      const result = validateFlowLocally(flowWithoutEntry);

      expect(result.is_valid).toBe(false);
      expect(result.findings.some(f => f.title.includes("entrada"))).toBe(true);
    });

    it("should fail flow without exit points", () => {
      const flowWithoutExit: SynthesizedFlow = {
        flow_id: "1",
        flow_name: "No Exit Flow",
        flow_description: "Missing exit",
        flow_category: "other",
        primary_role: "user",
        steps: [
          { step_id: "1", step_order: 1, title: "Step", description: "", step_type: "form", is_critical: false, can_be_skipped: false },
        ],
        decisions: [],
        failure_points: [],
        entry_step_id: "1",
        exit_step_ids: [], // Missing
        estimated_completion_time_seconds: 30,
      };

      const result = validateFlowLocally(flowWithoutExit);

      expect(result.is_valid).toBe(false);
      expect(result.findings.some(f => f.title.includes("saída"))).toBe(true);
    });

    it("should warn about decisions with insufficient options", () => {
      const flowWithBadDecision: SynthesizedFlow = {
        flow_id: "1",
        flow_name: "Bad Decision Flow",
        flow_description: "Invalid decision",
        flow_category: "other",
        primary_role: "user",
        steps: [
          { step_id: "1", step_order: 1, title: "Step", description: "", step_type: "condition", is_critical: false, can_be_skipped: false },
        ],
        decisions: [
          {
            decision_id: "d1",
            after_step_id: "1",
            question: "Only one option?",
            options: [{ option_id: "a", label: "A", leads_to_step_id: "2", is_default: true }], // Only 1 option
          },
        ],
        failure_points: [],
        entry_step_id: "1",
        exit_step_ids: ["1"],
        estimated_completion_time_seconds: 30,
      };

      const result = validateFlowLocally(flowWithBadDecision);

      expect(result.findings.some(f => f.category === "consistency")).toBe(true);
    });

    it("should warn about critical steps without failure handling", () => {
      const flowWithUnhandledCritical: SynthesizedFlow = {
        flow_id: "1",
        flow_name: "Unhandled Critical",
        flow_description: "Missing failure point",
        flow_category: "other",
        primary_role: "user",
        steps: [
          { step_id: "1", step_order: 1, title: "Critical Step", description: "", step_type: "form", is_critical: true, can_be_skipped: false },
        ],
        decisions: [],
        failure_points: [], // No failure points for critical step
        entry_step_id: "1",
        exit_step_ids: ["1"],
        estimated_completion_time_seconds: 30,
      };

      const result = validateFlowLocally(flowWithUnhandledCritical);

      expect(result.findings.some(f => f.category === "ux" && f.severity === "major")).toBe(true);
    });
  });

  describe("applyAutoFixes", () => {
    it("should auto-fix missing exit point", () => {
      const flowWithoutExit: SynthesizedFlow = {
        flow_id: "1",
        flow_name: "No Exit",
        flow_description: "",
        flow_category: "other",
        primary_role: "user",
        steps: [
          { step_id: "1", step_order: 1, title: "Step 1", description: "", step_type: "form", is_critical: false, can_be_skipped: false },
          { step_id: "2", step_order: 2, title: "Last Step", description: "", step_type: "action", is_critical: false, can_be_skipped: false },
        ],
        decisions: [],
        failure_points: [],
        entry_step_id: "1",
        exit_step_ids: [],
        estimated_completion_time_seconds: 30,
      };

      const findings: CritiqueFinding[] = [
        {
          finding_id: "f1",
          severity: "critical",
          category: "completeness",
          affected_element_id: "flow",
          affected_element_type: "flow",
          title: "Ponto de saída ausente",
          description: "Missing exit",
          recommendation: "Add exit",
          auto_fixable: true,
        },
      ];

      const { fixed_flow, fixes_applied } = applyAutoFixes(flowWithoutExit, findings);

      expect(fixed_flow.exit_step_ids).toHaveLength(1);
      expect(fixed_flow.exit_step_ids[0]).toBe("2");
      expect(fixes_applied.length).toBeGreaterThan(0);
    });

    it("should auto-fix missing failure point for critical step", () => {
      const flowWithCriticalStep: SynthesizedFlow = {
        flow_id: "1",
        flow_name: "Critical No Fail",
        flow_description: "",
        flow_category: "other",
        primary_role: "user",
        steps: [
          { step_id: "critical_1", step_order: 1, title: "Critical Step", description: "", step_type: "form", is_critical: true, can_be_skipped: false },
        ],
        decisions: [],
        failure_points: [],
        entry_step_id: "critical_1",
        exit_step_ids: ["critical_1"],
        estimated_completion_time_seconds: 30,
      };

      const findings: CritiqueFinding[] = [
        {
          finding_id: "f1",
          severity: "major",
          category: "ux",
          affected_element_id: "critical_1",
          affected_element_type: "step",
          title: "Step crítico sem tratamento de falha",
          description: "No failure handling",
          recommendation: "Add failure point",
          auto_fixable: true,
        },
      ];

      const { fixed_flow, fixes_applied } = applyAutoFixes(flowWithCriticalStep, findings);

      expect(fixed_flow.failure_points.length).toBeGreaterThan(0);
      expect(fixes_applied.length).toBeGreaterThan(0);
    });

    it("should not modify non-auto-fixable findings", () => {
      const flow: SynthesizedFlow = {
        flow_id: "1",
        flow_name: "Test",
        flow_description: "",
        flow_category: "other",
        primary_role: "user",
        steps: [],
        decisions: [],
        failure_points: [],
        entry_step_id: "",
        exit_step_ids: [],
        estimated_completion_time_seconds: 0,
      };

      const findings: CritiqueFinding[] = [
        {
          finding_id: "f1",
          severity: "suggestion",
          category: "ux",
          affected_element_id: "x",
          affected_element_type: "flow",
          title: "Manual fix needed",
          description: "Requires manual intervention",
          recommendation: "Fix manually",
          auto_fixable: false,
        },
      ];

      const { fixes_applied } = applyAutoFixes(flow, findings);

      expect(fixes_applied).toHaveLength(0);
    });
  });

  describe("formatIntegrityScore", () => {
    it("should format excellent score", () => {
      const result = formatIntegrityScore(95);

      expect(result.label).toBe("Excelente");
      expect(result.color).toBe("#22c55e");
    });

    it("should format good score", () => {
      const result = formatIntegrityScore(75);

      expect(result.label).toBe("Bom");
      expect(result.color).toBe("#84cc16");
    });

    it("should format attention score", () => {
      const result = formatIntegrityScore(55);

      expect(result.label).toBe("Atenção");
      expect(result.color).toBe("#eab308");
    });

    it("should format problems score", () => {
      const result = formatIntegrityScore(40);

      expect(result.label).toBe("Problemas");
      expect(result.color).toBe("#f97316");
    });

    it("should format critical score", () => {
      const result = formatIntegrityScore(20);

      expect(result.label).toBe("Crítico");
      expect(result.color).toBe("#ef4444");
    });
  });
});









