/**
 * Tests for Agent 6: Flow Connector
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  generateConnections,
  convertBlocksToNodes,
} from "@/lib/agents/v3/flow-connector";
import type { SynthesizedFlow, AdaptedUXBlockV3, NodeConnection } from "@/lib/agents/v3/types";

describe("Flow Connector", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("generateConnections", () => {
    it("should generate sequential connections for simple flow", () => {
      const simpleFlow: SynthesizedFlow = {
        flow_id: "1",
        flow_name: "Simple",
        flow_description: "",
        flow_category: "other",
        primary_role: "user",
        steps: [
          { step_id: "step_1", step_order: 1, title: "Step 1", description: "", step_type: "form", is_critical: false, can_be_skipped: false },
          { step_id: "step_2", step_order: 2, title: "Step 2", description: "", step_type: "action", is_critical: false, can_be_skipped: false },
          { step_id: "step_3", step_order: 3, title: "Step 3", description: "", step_type: "end_success", is_critical: false, can_be_skipped: false },
        ],
        decisions: [],
        failure_points: [],
        entry_step_id: "step_1",
        exit_step_ids: ["step_3"],
        estimated_completion_time_seconds: 60,
      };

      const connections = generateConnections(simpleFlow);

      expect(connections).toHaveLength(2);
      expect(connections[0].source_node_id).toBe("step_1");
      expect(connections[0].target_node_id).toBe("step_2");
      expect(connections[1].source_node_id).toBe("step_2");
      expect(connections[1].target_node_id).toBe("step_3");
    });

    it("should generate connections for decisions", () => {
      const flowWithDecision: SynthesizedFlow = {
        flow_id: "1",
        flow_name: "With Decision",
        flow_description: "",
        flow_category: "other",
        primary_role: "user",
        steps: [
          { step_id: "step_1", step_order: 1, title: "Step 1", description: "", step_type: "condition", is_critical: false, can_be_skipped: false },
          { step_id: "step_2", step_order: 2, title: "Path A", description: "", step_type: "action", is_critical: false, can_be_skipped: false },
          { step_id: "step_3", step_order: 3, title: "Path B", description: "", step_type: "action", is_critical: false, can_be_skipped: false },
        ],
        decisions: [
          {
            decision_id: "dec_1",
            after_step_id: "step_1",
            question: "Which path?",
            options: [
              { option_id: "a", label: "A", leads_to_step_id: "step_2", is_default: false },
              { option_id: "b", label: "B", leads_to_step_id: "step_3", is_default: true },
            ],
          },
        ],
        failure_points: [],
        entry_step_id: "step_1",
        exit_step_ids: ["step_2", "step_3"],
        estimated_completion_time_seconds: 60,
      };

      const connections = generateConnections(flowWithDecision);

      // Should have connections from step_1 to both step_2 and step_3
      const fromStep1 = connections.filter(c => c.source_node_id === "step_1");
      expect(fromStep1).toHaveLength(2);
      expect(fromStep1.some(c => c.target_node_id === "step_2")).toBe(true);
      expect(fromStep1.some(c => c.target_node_id === "step_3")).toBe(true);
    });

    it("should generate failure connections", () => {
      const flowWithFailure: SynthesizedFlow = {
        flow_id: "1",
        flow_name: "With Failure",
        flow_description: "",
        flow_category: "other",
        primary_role: "user",
        steps: [
          { step_id: "step_1", step_order: 1, title: "Step 1", description: "", step_type: "form", is_critical: true, can_be_skipped: false },
          { step_id: "step_2", step_order: 2, title: "Step 2", description: "", step_type: "action", is_critical: false, can_be_skipped: false },
          { step_id: "retry_step", step_order: 3, title: "Retry", description: "", step_type: "retry", is_critical: false, can_be_skipped: false },
        ],
        decisions: [],
        failure_points: [
          {
            failure_id: "fail_1",
            at_step_id: "step_1",
            failure_type: "validation",
            description: "Validation error",
            recovery_strategy: "retry",
            recovery_step_id: "retry_step",
          },
        ],
        entry_step_id: "step_1",
        exit_step_ids: ["step_2"],
        estimated_completion_time_seconds: 60,
      };

      const connections = generateConnections(flowWithFailure);

      // Should have a failure connection
      const failureConnection = connections.find(
        c => c.source_node_id === "step_1" && c.connection_type === "retry"
      );
      expect(failureConnection).toBeDefined();
      expect(failureConnection?.target_node_id).toBe("retry_step");
    });

    it("should mark primary path connections", () => {
      const flow: SynthesizedFlow = {
        flow_id: "1",
        flow_name: "Test",
        flow_description: "",
        flow_category: "other",
        primary_role: "user",
        steps: [
          { step_id: "1", step_order: 1, title: "1", description: "", step_type: "form", is_critical: false, can_be_skipped: false },
          { step_id: "2", step_order: 2, title: "2", description: "", step_type: "action", is_critical: false, can_be_skipped: false },
        ],
        decisions: [],
        failure_points: [],
        entry_step_id: "1",
        exit_step_ids: ["2"],
        estimated_completion_time_seconds: 30,
      };

      const connections = generateConnections(flow);

      expect(connections[0].is_primary_path).toBe(true);
    });
  });

  describe("convertBlocksToNodes", () => {
    it("should convert blocks to nodes with positions", () => {
      const blocks: AdaptedUXBlockV3[] = [
        {
          block_id: "block_1",
          adapted: true,
          block_type: "form",
          title: "Form Block",
          input_fields: [],
          actions: [],
          impact_level: "medium",
        },
        {
          block_id: "block_2",
          adapted: true,
          block_type: "action",
          title: "Action Block",
          input_fields: [],
          actions: [],
          impact_level: "low",
        },
      ];

      const connections: NodeConnection[] = [
        {
          connection_id: "conn_1",
          source_node_id: "block_1",
          target_node_id: "block_2",
          connection_type: "success",
          is_primary_path: true,
          order_priority: 0,
        },
      ];

      const nodes = convertBlocksToNodes(blocks, connections, "flow_1");

      expect(nodes).toHaveLength(2);
      expect(nodes[0].id).toBe("block_1");
      expect(nodes[0].flow_id).toBe("flow_1");
      expect(nodes[0].type).toBe("form");
      expect(nodes[0].position_x).toBeDefined();
      expect(nodes[0].position_y).toBeDefined();
    });

    it("should set next_on_success from connections", () => {
      const blocks: AdaptedUXBlockV3[] = [
        {
          block_id: "block_1",
          adapted: true,
          block_type: "form",
          title: "Form",
          input_fields: [],
          actions: [],
          impact_level: "medium",
        },
        {
          block_id: "block_2",
          adapted: true,
          block_type: "end_success",
          title: "End",
          input_fields: [],
          actions: [],
          impact_level: "low",
        },
      ];

      const connections: NodeConnection[] = [
        {
          connection_id: "conn_1",
          source_node_id: "block_1",
          target_node_id: "block_2",
          connection_type: "success",
          is_primary_path: true,
          order_priority: 0,
        },
      ];

      const nodes = convertBlocksToNodes(blocks, connections, "flow_1");

      expect(nodes[0].next_on_success).toBe("block_2");
    });

    it("should set next_on_failure from failure connections", () => {
      const blocks: AdaptedUXBlockV3[] = [
        {
          block_id: "block_1",
          adapted: true,
          block_type: "form",
          title: "Form",
          input_fields: [],
          actions: [],
          impact_level: "high",
        },
        {
          block_id: "block_2",
          adapted: true,
          block_type: "fallback",
          title: "Fallback",
          input_fields: [],
          actions: [],
          impact_level: "low",
        },
      ];

      const connections: NodeConnection[] = [
        {
          connection_id: "conn_1",
          source_node_id: "block_1",
          target_node_id: "block_2",
          connection_type: "fallback",
          is_primary_path: false,
          order_priority: 1,
        },
      ];

      const nodes = convertBlocksToNodes(blocks, connections, "flow_1");

      expect(nodes[0].next_on_failure).toBe("block_2");
    });

    it("should preserve impact_level from blocks", () => {
      const blocks: AdaptedUXBlockV3[] = [
        {
          block_id: "block_1",
          adapted: true,
          block_type: "action",
          title: "High Impact",
          input_fields: [],
          actions: [],
          impact_level: "high",
        },
      ];

      const nodes = convertBlocksToNodes(blocks, [], "flow_1");

      expect(nodes[0].impact_level).toBe("high");
    });

    it("should mark reused blocks", () => {
      const blocks: AdaptedUXBlockV3[] = [
        {
          block_id: "block_1",
          original_block_id: "library_block_1",
          adapted: true,
          block_type: "form",
          title: "Reused Block",
          input_fields: [],
          actions: [],
          impact_level: "medium",
        },
      ];

      const nodes = convertBlocksToNodes(blocks, [], "flow_1");

      expect(nodes[0].reused).toBe(true);
    });
  });
});







