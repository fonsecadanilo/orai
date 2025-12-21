/**
 * Tests for V3.1 Type Gates and Branching Gates
 * 
 * Validates:
 * - Type Hard Gate (blocks action-only flows)
 * - Type Repairer V3
 * - Branching Gates
 * - Group Label Gate
 */

import { describe, it, expect } from "vitest";
import {
  validateTypeDistributionV3,
  calculateTypeStats,
  isValidSemanticTypeV3,
  ALLOWED_SEMANTIC_TYPES_V3,
} from "../lib/validation/type-gates-v3";
import {
  TypeRepairerV3,
  repairTypes,
} from "../lib/validation/type-repairer-v3";
import {
  validateBranchingV3,
} from "../lib/validation/branching-gates-v3";
import {
  validateAndApplyGroupLabels,
  applyGroupLabels,
  inferGroupLabel,
} from "../lib/validation/group-label-gate-v3";

describe("Type Gates V3.1", () => {
  describe("validateTypeDistributionV3", () => {
    it("should FAIL when action ratio > 60%", () => {
      const nodes = [
        { id: "1", type: "trigger" },
        { id: "2", type: "action" },
        { id: "3", type: "action" },
        { id: "4", type: "action" },
        { id: "5", type: "action" },
        { id: "6", type: "end_success" },
      ];
      
      const result = validateTypeDistributionV3(nodes, []);
      
      expect(result.is_valid).toBe(false);
      expect(result.issues.some(i => i.rule_id === "T1_ACTION_RATIO")).toBe(true);
    });
    
    it("should FAIL when >6 nodes without condition/choice", () => {
      const nodes = [
        { id: "1", type: "trigger" },
        { id: "2", type: "form" },
        { id: "3", type: "form" },
        { id: "4", type: "form" },
        { id: "5", type: "form" },
        { id: "6", type: "feedback_success" },
        { id: "7", type: "end_success" },
      ];
      
      const result = validateTypeDistributionV3(nodes, []);
      
      expect(result.is_valid).toBe(false);
      expect(result.issues.some(i => i.rule_id === "T2_NO_BRANCHING")).toBe(true);
    });
    
    it("should FAIL when form exists but no feedback_error", () => {
      const nodes = [
        { id: "1", type: "trigger" },
        { id: "2", type: "form", impact_level: "high" as const },
        { id: "3", type: "end_success" },
      ];
      
      const result = validateTypeDistributionV3(nodes, []);
      
      expect(result.is_valid).toBe(false);
      expect(result.issues.some(i => i.rule_id === "T3_FORM_NO_ERROR_HANDLING")).toBe(true);
    });
    
    it("should PASS with diverse types and proper branching", () => {
      const nodes = [
        { id: "1", type: "trigger" },
        { id: "2", type: "form" },
        { id: "3", type: "condition" },
        { id: "4", type: "feedback_error" },
        { id: "5", type: "loopback" },
        { id: "6", type: "feedback_success" },
        { id: "7", type: "end_success" },
      ];
      
      const result = validateTypeDistributionV3(nodes, []);
      
      expect(result.is_valid).toBe(true);
    });
  });
  
  describe("calculateTypeStats", () => {
    it("should calculate action ratio correctly", () => {
      const nodes = [
        { id: "1", type: "trigger" },
        { id: "2", type: "action" },
        { id: "3", type: "form" },
        { id: "4", type: "end_success" },
      ];
      
      const stats = calculateTypeStats(nodes);
      
      // Only action and form are countable (trigger and end_success are structural)
      expect(stats.countable_nodes).toBe(2);
      expect(stats.action_count).toBe(1);
      expect(stats.action_ratio).toBe(0.5); // 1 action / 2 countable
    });
    
    it("should detect branching types", () => {
      const nodes = [
        { id: "1", type: "trigger" },
        { id: "2", type: "condition" },
        { id: "3", type: "choice" },
        { id: "4", type: "end_success" },
      ];
      
      const stats = calculateTypeStats(nodes);
      
      expect(stats.has_condition).toBe(true);
      expect(stats.has_choice).toBe(true);
      expect(stats.has_any_branching).toBe(true);
    });
  });
  
  describe("isValidSemanticTypeV3", () => {
    it("should return true for valid types", () => {
      expect(isValidSemanticTypeV3("trigger")).toBe(true);
      expect(isValidSemanticTypeV3("form")).toBe(true);
      expect(isValidSemanticTypeV3("condition")).toBe(true);
      expect(isValidSemanticTypeV3("feedback_error")).toBe(true);
      expect(isValidSemanticTypeV3("loopback")).toBe(true);
    });
    
    it("should return false for invalid types", () => {
      expect(isValidSemanticTypeV3("invalid_type")).toBe(false);
      expect(isValidSemanticTypeV3("user_action")).toBe(false);
      expect(isValidSemanticTypeV3("entry_point")).toBe(false);
    });
  });
});

describe("Type Repairer V3.1", () => {
  describe("repairTypes", () => {
    it("should infer form type from title keywords", () => {
      const nodes = [
        { id: "1", type: "action", title: "Login Form", description: "Enter email and password" },
      ];
      
      const result = repairTypes(nodes, []);
      
      // First node should be promoted to trigger
      expect(result.nodes[0].type).toBe("trigger");
      expect(result.repairs_made.length).toBeGreaterThan(0);
    });
    
    it("should add feedback_error for critical forms", () => {
      const nodes = [
        { id: "1", type: "trigger", title: "Start" },
        { id: "2", type: "form", title: "Payment Form", impact_level: "high" as const },
        { id: "3", type: "end_success", title: "Done" },
      ];
      
      const result = repairTypes(nodes, []);
      
      // Should add feedback_error and loopback
      expect(result.nodes_added.length).toBeGreaterThan(0);
      expect(result.nodes_added.some(n => n.type === "feedback_error")).toBe(true);
    });
    
    it("should ensure first node is trigger", () => {
      const nodes = [
        { id: "1", type: "action", title: "Some action" },
        { id: "2", type: "end_success", title: "Done" },
      ];
      
      const result = repairTypes(nodes, []);
      
      expect(result.nodes[0].type).toBe("trigger");
    });
    
    it("should ensure last node is end_*", () => {
      const nodes = [
        { id: "1", type: "trigger", title: "Start" },
        { id: "2", type: "action", title: "Some action" },
      ];
      
      const result = repairTypes(nodes, []);
      
      expect(result.nodes[result.nodes.length - 1].type).toBe("end_success");
    });
  });
});

describe("Branching Gates V3.1", () => {
  describe("validateBranchingV3", () => {
    it("should fail when condition has only 1 output", () => {
      const nodes = [
        { id: "1", type: "trigger" },
        { id: "2", type: "condition" },
        { id: "3", type: "end_success" },
      ];
      
      const connections = [
        { source_id: "1", target_id: "2" },
        { source_id: "2", target_id: "3", connection_type: "success" },
      ];
      
      const result = validateBranchingV3(nodes, connections);
      
      expect(result.is_valid).toBe(false);
      expect(result.issues.some(i => i.rule_id === "B1_CONDITION_NEEDS_2_BRANCHES")).toBe(true);
    });
    
    it("should pass when condition has 2 outputs", () => {
      const nodes = [
        { id: "1", type: "trigger" },
        { id: "2", type: "condition" },
        { id: "3", type: "feedback_success" },
        { id: "4", type: "feedback_error" },
        { id: "5", type: "loopback" },
        { id: "6", type: "end_success" },
      ];
      
      const connections = [
        { source_id: "1", target_id: "2" },
        { source_id: "2", target_id: "3", connection_type: "success", label: "Sim" },
        { source_id: "2", target_id: "4", connection_type: "failure", label: "Não" },
        { source_id: "3", target_id: "6" },
        { source_id: "4", target_id: "5" },
        { source_id: "5", target_id: "2", connection_type: "loopback" },
      ];
      
      const result = validateBranchingV3(nodes, connections);
      
      expect(result.issues.filter(i => i.rule_id === "B1_CONDITION_NEEDS_2_BRANCHES")).toHaveLength(0);
    });
    
    it("should fail when form has no error handling", () => {
      const nodes = [
        { id: "1", type: "trigger" },
        { id: "2", type: "form", impact_level: "high" as const },
        { id: "3", type: "end_success" },
      ];
      
      const connections = [
        { source_id: "1", target_id: "2" },
        { source_id: "2", target_id: "3" },
      ];
      
      const result = validateBranchingV3(nodes, connections);
      
      expect(result.is_valid).toBe(false);
      expect(result.issues.some(i => i.rule_id === "B2_FORM_NO_FEEDBACK_ERROR")).toBe(true);
    });
  });
});

describe("Group Label Gate V3.1", () => {
  describe("validateAndApplyGroupLabels", () => {
    it("should not require labels for flows <= 5 nodes", () => {
      const nodes = [
        { id: "1", type: "trigger" },
        { id: "2", type: "form" },
        { id: "3", type: "end_success" },
      ];
      
      const result = validateAndApplyGroupLabels(nodes);
      
      expect(result.is_valid).toBe(true);
    });
    
    it("should suggest labels for flows > 5 nodes without labels", () => {
      const nodes = [
        { id: "1", type: "trigger" },
        { id: "2", type: "form" },
        { id: "3", type: "condition" },
        { id: "4", type: "feedback_error" },
        { id: "5", type: "loopback" },
        { id: "6", type: "end_success" },
      ];
      
      const result = validateAndApplyGroupLabels(nodes);
      
      expect(Object.keys(result.suggested_labels).length).toBeGreaterThan(0);
    });
  });
  
  describe("inferGroupLabel", () => {
    it("should infer Início for trigger", () => {
      const node = { id: "1", type: "trigger" };
      expect(inferGroupLabel(node, 0, 5)).toBe("Início");
    });
    
    it("should infer Conclusão for end_success", () => {
      const node = { id: "1", type: "end_success" };
      expect(inferGroupLabel(node, 4, 5)).toBe("Conclusão");
    });
    
    it("should infer Tratamento de Erro for feedback_error", () => {
      const node = { id: "1", type: "feedback_error" };
      expect(inferGroupLabel(node, 2, 5)).toBe("Tratamento de Erro");
    });
    
    it("should infer from title keywords", () => {
      const node = { id: "1", type: "form", title: "Formulário de Login" };
      expect(inferGroupLabel(node, 1, 5)).toBe("Autenticação");
    });
  });
  
  describe("applyGroupLabels", () => {
    it("should apply labels to all nodes", () => {
      const nodes = [
        { id: "1", type: "trigger" },
        { id: "2", type: "form" },
        { id: "3", type: "end_success" },
      ];
      
      const result = applyGroupLabels(nodes);
      
      expect(result.every(n => n.group_label !== undefined)).toBe(true);
    });
    
    it("should preserve existing labels", () => {
      const nodes = [
        { id: "1", type: "trigger", group_label: "Custom Label" },
        { id: "2", type: "form" },
      ];
      
      const result = applyGroupLabels(nodes);
      
      expect(result[0].group_label).toBe("Custom Label");
    });
  });
});

describe("Smoke Tests - Complete Flow Scenarios", () => {
  describe("Login Flow", () => {
    it("should validate a proper login flow", () => {
      const nodes = [
        { id: "trigger_1", type: "trigger", title: "Acessar página de login", group_label: "Início" },
        { id: "form_1", type: "form", title: "Preencher credenciais", group_label: "Autenticação", impact_level: "high" as const },
        { id: "condition_1", type: "condition", title: "Credenciais válidas?", group_label: "Verificação" },
        { id: "feedback_error_1", type: "feedback_error", title: "Erro de login", group_label: "Tratamento de Erro" },
        { id: "loopback_1", type: "loopback", title: "Tentar novamente", group_label: "Tratamento de Erro" },
        { id: "feedback_success_1", type: "feedback_success", title: "Login realizado", group_label: "Confirmação" },
        { id: "end_success_1", type: "end_success", title: "Redirecionar para dashboard", group_label: "Conclusão" },
      ];
      
      const connections = [
        { source_id: "trigger_1", target_id: "form_1" },
        { source_id: "form_1", target_id: "condition_1" },
        { source_id: "condition_1", target_id: "feedback_success_1", connection_type: "success", label: "Sim" },
        { source_id: "condition_1", target_id: "feedback_error_1", connection_type: "failure", label: "Não" },
        { source_id: "feedback_error_1", target_id: "loopback_1" },
        { source_id: "loopback_1", target_id: "form_1", connection_type: "loopback" },
        { source_id: "feedback_success_1", target_id: "end_success_1" },
      ];
      
      // Type validation
      const typeResult = validateTypeDistributionV3(nodes, connections);
      expect(typeResult.is_valid).toBe(true);
      expect(typeResult.stats.action_ratio).toBeLessThanOrEqual(0.6);
      expect(typeResult.stats.has_any_branching).toBe(true);
      
      // Branching validation
      const branchResult = validateBranchingV3(nodes, connections);
      expect(branchResult.issues.filter(i => i.severity === "error")).toHaveLength(0);
      
      // Group label validation
      const groupResult = validateAndApplyGroupLabels(nodes);
      expect(groupResult.nodes_without_label).toHaveLength(0);
    });
  });
  
  describe("Checkout Flow", () => {
    it("should validate a proper checkout flow with payment retry", () => {
      const nodes = [
        { id: "trigger_1", type: "trigger", title: "Iniciar checkout", group_label: "Início" },
        { id: "form_1", type: "form", title: "Endereço de entrega", group_label: "Entrega" },
        { id: "choice_1", type: "choice", title: "Método de pagamento", group_label: "Pagamento" },
        { id: "form_2", type: "form", title: "Dados do cartão", group_label: "Pagamento", impact_level: "high" as const },
        { id: "background_1", type: "background_action", title: "Processar pagamento", group_label: "Processamento" },
        { id: "condition_1", type: "condition", title: "Pagamento aprovado?", group_label: "Verificação" },
        { id: "feedback_error_1", type: "feedback_error", title: "Pagamento recusado", group_label: "Tratamento de Erro" },
        { id: "retry_1", type: "retry", title: "Tentar outro método", group_label: "Tratamento de Erro" },
        { id: "feedback_success_1", type: "feedback_success", title: "Pedido confirmado", group_label: "Confirmação" },
        { id: "end_success_1", type: "end_success", title: "Exibir resumo", group_label: "Conclusão" },
      ];
      
      const connections = [
        { source_id: "trigger_1", target_id: "form_1" },
        { source_id: "form_1", target_id: "choice_1" },
        { source_id: "choice_1", target_id: "form_2", connection_type: "option", label: "Cartão" },
        { source_id: "form_2", target_id: "background_1" },
        { source_id: "background_1", target_id: "condition_1" },
        { source_id: "condition_1", target_id: "feedback_success_1", connection_type: "success", label: "Sim" },
        { source_id: "condition_1", target_id: "feedback_error_1", connection_type: "failure", label: "Não" },
        { source_id: "feedback_error_1", target_id: "retry_1" },
        { source_id: "retry_1", target_id: "choice_1", connection_type: "retry" },
        { source_id: "feedback_success_1", target_id: "end_success_1" },
      ];
      
      // Type validation
      const typeResult = validateTypeDistributionV3(nodes, connections);
      expect(typeResult.is_valid).toBe(true);
      expect(typeResult.stats.action_ratio).toBeLessThanOrEqual(0.6);
      
      // Should have both condition and choice
      expect(typeResult.stats.has_condition).toBe(true);
      expect(typeResult.stats.has_choice).toBe(true);
    });
  });
});



