/**
 * Tests for V3.1 Enforce Required Outputs
 * 
 * Validates:
 * - Conditions MUST have exactly 2 outputs (success + failure)
 * - Choices MUST have >= 2 options
 * - Forms/Actions with high impact MUST have error paths
 * - Terminals MUST have 0 outputs
 */

import { describe, it, expect } from "vitest";
import {
  enforceRequiredOutputsV3,
  validateEnforcedFlow,
  EnforceOutputsV3,
} from "../lib/validation/enforce-outputs-v3";

describe("Enforce Required Outputs V3.1", () => {
  describe("enforceRequiredOutputsV3", () => {
    it("should add failure branch to condition with only success", () => {
      const nodes = [
        { id: "trigger_1", type: "trigger", title: "Start" },
        { id: "form_1", type: "form", title: "Login Form" },
        { id: "condition_1", type: "condition", title: "Valid credentials?" },
        { id: "end_1", type: "end_success", title: "Done" },
      ];
      
      const connections = [
        { source_id: "trigger_1", target_id: "form_1", connection_type: "default" },
        { source_id: "form_1", target_id: "condition_1", connection_type: "success" },
        { source_id: "condition_1", target_id: "end_1", connection_type: "success", label: "Sim" },
        // MISSING: failure connection from condition_1
      ];
      
      const result = enforceRequiredOutputsV3(nodes, connections);
      
      // Should have added nodes (feedback_error + potentially loopback/end)
      expect(result.added_nodes.length).toBeGreaterThan(0);
      expect(result.added_nodes.some(n => n.type === "feedback_error")).toBe(true);
      
      // Should have added failure connection from condition
      expect(result.added_connections.some(c => 
        c.source_id === "condition_1" && c.connection_type === "failure"
      )).toBe(true);
      
      // Stats should show condition was fixed
      expect(result.stats.conditions_fixed).toBe(1);
      expect(result.issues_fixed.length).toBeGreaterThan(0);
    });

    it("should add both branches to condition with no outputs", () => {
      const nodes = [
        { id: "trigger_1", type: "trigger", title: "Start" },
        { id: "condition_1", type: "condition", title: "Is valid?" },
        // No subsequent nodes
      ];
      
      const connections = [
        { source_id: "trigger_1", target_id: "condition_1", connection_type: "default" },
        // MISSING: both success and failure connections
      ];
      
      const result = enforceRequiredOutputsV3(nodes, connections);
      
      // Should have added success and failure paths
      const conditionOutputs = result.connections.filter(c => c.source_id === "condition_1");
      expect(conditionOutputs.length).toBe(2);
      expect(conditionOutputs.some(c => c.connection_type === "success")).toBe(true);
      expect(conditionOutputs.some(c => c.connection_type === "failure")).toBe(true);
    });

    it("should add alternative option to choice with only 1 option", () => {
      const nodes = [
        { id: "trigger_1", type: "trigger", title: "Start" },
        { id: "choice_1", type: "choice", title: "Select payment method" },
        { id: "form_1", type: "form", title: "Credit card" },
      ];
      
      const connections = [
        { source_id: "trigger_1", target_id: "choice_1", connection_type: "default" },
        { source_id: "choice_1", target_id: "form_1", connection_type: "option", label: "Cartão" },
        // MISSING: second option
      ];
      
      const result = enforceRequiredOutputsV3(nodes, connections);
      
      // Should have added alternative option
      const choiceOutputs = result.connections.filter(c => c.source_id === "choice_1");
      expect(choiceOutputs.length).toBeGreaterThanOrEqual(2);
      expect(result.stats.choices_fixed).toBe(1);
    });

    it("should add error path to high-impact form", () => {
      const nodes = [
        { id: "trigger_1", type: "trigger", title: "Start" },
        { id: "form_1", type: "form", title: "Payment Form", impact_level: "high" as const },
        { id: "end_1", type: "end_success", title: "Done" },
      ];
      
      const connections = [
        { source_id: "trigger_1", target_id: "form_1", connection_type: "default" },
        { source_id: "form_1", target_id: "end_1", connection_type: "success" },
        // MISSING: failure path
      ];
      
      const result = enforceRequiredOutputsV3(nodes, connections);
      
      // Should have added feedback_error
      expect(result.added_nodes.some(n => n.type === "feedback_error")).toBe(true);
      
      // Should have added failure connection from form
      expect(result.added_connections.some(c => 
        c.source_id === "form_1" && c.connection_type === "failure"
      )).toBe(true);
      
      expect(result.stats.forms_fixed).toBe(1);
    });

    it("should remove outputs from terminal nodes", () => {
      const nodes = [
        { id: "trigger_1", type: "trigger", title: "Start" },
        { id: "end_success_1", type: "end_success", title: "Done" },
        { id: "action_1", type: "action", title: "Some action" },
      ];
      
      const connections = [
        { source_id: "trigger_1", target_id: "end_success_1", connection_type: "default" },
        { source_id: "end_success_1", target_id: "action_1", connection_type: "success" }, // INVALID!
      ];
      
      const result = enforceRequiredOutputsV3(nodes, connections);
      
      // Should have removed the invalid connection from terminal
      expect(result.removed_connections.length).toBe(1);
      expect(result.removed_connections[0].source_id).toBe("end_success_1");
      expect(result.stats.terminals_fixed).toBe(1);
      
      // Final connections should not include the terminal output
      expect(result.connections.some(c => c.source_id === "end_success_1")).toBe(false);
    });
  });

  describe("validateEnforcedFlow", () => {
    it("should PASS when condition has 2 outputs", () => {
      const nodes = [
        { id: "condition_1", type: "condition", title: "Test" },
      ];
      
      const connections = [
        { source_id: "condition_1", target_id: "node_a", connection_type: "success" },
        { source_id: "condition_1", target_id: "node_b", connection_type: "failure" },
      ];
      
      const result = validateEnforcedFlow(nodes, connections);
      expect(result.is_valid).toBe(true);
      expect(result.errors.length).toBe(0);
    });

    it("should FAIL when condition has only 1 output", () => {
      const nodes = [
        { id: "condition_1", type: "condition", title: "Test" },
      ];
      
      const connections = [
        { source_id: "condition_1", target_id: "node_a", connection_type: "success" },
        // MISSING failure
      ];
      
      const result = validateEnforcedFlow(nodes, connections);
      expect(result.is_valid).toBe(false);
      expect(result.errors.some(e => e.includes("HARD_GATE_FAIL"))).toBe(true);
    });

    it("should FAIL when terminal has outputs", () => {
      const nodes = [
        { id: "end_1", type: "end_success", title: "Done" },
      ];
      
      const connections = [
        { source_id: "end_1", target_id: "node_a", connection_type: "default" },
      ];
      
      const result = validateEnforcedFlow(nodes, connections);
      expect(result.is_valid).toBe(false);
      expect(result.errors.some(e => e.includes("HARD_GATE_FAIL") && e.includes("0"))).toBe(true);
    });
  });

  describe("EnforceOutputsV3 helper functions", () => {
    it("should correctly identify terminal types", () => {
      expect(EnforceOutputsV3.isTerminalType("end_success")).toBe(true);
      expect(EnforceOutputsV3.isTerminalType("end_error")).toBe(true);
      expect(EnforceOutputsV3.isTerminalType("end_neutral")).toBe(true);
      expect(EnforceOutputsV3.isTerminalType("action")).toBe(false);
      expect(EnforceOutputsV3.isTerminalType("form")).toBe(false);
    });

    it("should correctly identify binary branch types", () => {
      expect(EnforceOutputsV3.isBinaryBranchType("condition")).toBe(true);
      expect(EnforceOutputsV3.isBinaryBranchType("form")).toBe(false);
      expect(EnforceOutputsV3.isBinaryBranchType("choice")).toBe(false);
    });

    it("should correctly identify multi-option types", () => {
      expect(EnforceOutputsV3.isMultiOptionType("choice")).toBe(true);
      expect(EnforceOutputsV3.isMultiOptionType("option_choice")).toBe(true);
      expect(EnforceOutputsV3.isMultiOptionType("condition")).toBe(false);
    });
  });
});

describe("Smoke Tests - Complete Flow Scenarios", () => {
  describe("Onboarding Flow (with 2 conditions)", () => {
    it("should ensure both conditions have 2 branches each", () => {
      const nodes = [
        { id: "trigger_1", type: "trigger", title: "Welcome" },
        { id: "form_1", type: "form", title: "Basic Info", impact_level: "medium" as const },
        { id: "condition_1", type: "condition", title: "Info Valid?" },
        { id: "choice_1", type: "choice", title: "Account Type" },
        { id: "form_2", type: "form", title: "Additional Info" },
        { id: "condition_2", type: "condition", title: "Registration Complete?" },
        { id: "end_1", type: "end_success", title: "Done" },
      ];
      
      // PROBLEMATIC: Linear flow without failure paths
      const connections = [
        { source_id: "trigger_1", target_id: "form_1", connection_type: "default" },
        { source_id: "form_1", target_id: "condition_1", connection_type: "success" },
        { source_id: "condition_1", target_id: "choice_1", connection_type: "success", label: "Yes" },
        { source_id: "choice_1", target_id: "form_2", connection_type: "option" },
        { source_id: "form_2", target_id: "condition_2", connection_type: "success" },
        { source_id: "condition_2", target_id: "end_1", connection_type: "success", label: "Yes" },
      ];
      
      const result = enforceRequiredOutputsV3(nodes, connections);
      
      // Both conditions should now have 2 outputs
      const condition1Outputs = result.connections.filter(c => c.source_id === "condition_1");
      const condition2Outputs = result.connections.filter(c => c.source_id === "condition_2");
      
      expect(condition1Outputs.length).toBe(2);
      expect(condition2Outputs.length).toBe(2);
      
      // Validate the enforced flow
      const validation = validateEnforcedFlow(result.nodes, result.connections);
      expect(validation.is_valid).toBe(true);
    });
  });

  describe("Login Flow (invalid credentials + forgot password)", () => {
    it("should have proper error handling for login", () => {
      const nodes = [
        { id: "trigger_1", type: "trigger", title: "Access Login Page" },
        { id: "form_1", type: "form", title: "Enter Credentials", impact_level: "high" as const },
        { id: "condition_1", type: "condition", title: "Credentials Valid?" },
        { id: "feedback_1", type: "feedback_success", title: "Login OK" },
        { id: "end_1", type: "end_success", title: "Dashboard" },
      ];
      
      const connections = [
        { source_id: "trigger_1", target_id: "form_1", connection_type: "default" },
        { source_id: "form_1", target_id: "condition_1", connection_type: "success" },
        { source_id: "condition_1", target_id: "feedback_1", connection_type: "success", label: "Sim" },
        { source_id: "feedback_1", target_id: "end_1", connection_type: "default" },
        // MISSING: failure from condition, error handling for form
      ];
      
      const result = enforceRequiredOutputsV3(nodes, connections);
      
      // Should have feedback_error for failed login
      expect(result.added_nodes.some(n => n.type === "feedback_error")).toBe(true);
      
      // Condition should have failure branch
      const conditionFailure = result.connections.find(c => 
        c.source_id === "condition_1" && c.connection_type === "failure"
      );
      expect(conditionFailure).toBeDefined();
      
      // Validate
      const validation = validateEnforcedFlow(result.nodes, result.connections);
      expect(validation.is_valid).toBe(true);
    });
  });

  describe("Signup Flow (email exists + weak password)", () => {
    it("should add error paths for signup validations", () => {
      const nodes = [
        { id: "trigger_1", type: "trigger", title: "Start Signup" },
        { id: "form_1", type: "form", title: "Email & Password", impact_level: "high" as const },
        { id: "condition_1", type: "condition", title: "Email Available?" },
        { id: "condition_2", type: "condition", title: "Password Strong?" },
        { id: "end_1", type: "end_success", title: "Account Created" },
      ];
      
      const connections = [
        { source_id: "trigger_1", target_id: "form_1", connection_type: "default" },
        { source_id: "form_1", target_id: "condition_1", connection_type: "success" },
        { source_id: "condition_1", target_id: "condition_2", connection_type: "success", label: "Sim" },
        { source_id: "condition_2", target_id: "end_1", connection_type: "success", label: "Sim" },
      ];
      
      const result = enforceRequiredOutputsV3(nodes, connections);
      
      // Both conditions should have failure branches
      expect(result.stats.conditions_fixed).toBe(2);
      
      // Validate
      const validation = validateEnforcedFlow(result.nodes, result.connections);
      expect(validation.is_valid).toBe(true);
    });
  });

  describe("Checkout Flow (payment failed + change method)", () => {
    it("should add retry/fallback for payment failures", () => {
      const nodes = [
        { id: "trigger_1", type: "trigger", title: "Start Checkout" },
        { id: "form_1", type: "form", title: "Shipping Address" },
        { id: "choice_1", type: "choice", title: "Payment Method" },
        { id: "form_2", type: "form", title: "Card Details", impact_level: "high" as const },
        { id: "condition_1", type: "condition", title: "Payment Approved?" },
        { id: "end_1", type: "end_success", title: "Order Confirmed" },
      ];
      
      const connections = [
        { source_id: "trigger_1", target_id: "form_1", connection_type: "default" },
        { source_id: "form_1", target_id: "choice_1", connection_type: "success" },
        { source_id: "choice_1", target_id: "form_2", connection_type: "option", label: "Card" },
        { source_id: "form_2", target_id: "condition_1", connection_type: "success" },
        { source_id: "condition_1", target_id: "end_1", connection_type: "success", label: "Sim" },
        // MISSING: second option for choice, failure for condition
      ];
      
      const result = enforceRequiredOutputsV3(nodes, connections);
      
      // Choice should have >=2 options
      const choiceOutputs = result.connections.filter(c => c.source_id === "choice_1");
      expect(choiceOutputs.length).toBeGreaterThanOrEqual(2);
      
      // Condition should have failure
      const conditionFailure = result.connections.find(c => 
        c.source_id === "condition_1" && c.connection_type === "failure"
      );
      expect(conditionFailure).toBeDefined();
      
      // Validate
      const validation = validateEnforcedFlow(result.nodes, result.connections);
      expect(validation.is_valid).toBe(true);
    });
  });
});



