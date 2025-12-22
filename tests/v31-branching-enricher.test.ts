/**
 * Tests for V3.1 Pipeline - Branching Enricher, Validator, and AutoFix
 */

import { describe, test, expect } from "vitest";
import {
  enrichBranching,
  type EnricherNode,
  type EnricherConnection,
} from "@/lib/validation/branching-enricher-v3";
import {
  validateGraphV3,
  autoFixGraphV3,
  type ValidatorNode,
  type ValidatorConnection,
} from "@/lib/validation/validate-graph-v3";
import {
  getNodeGrammar,
  isTerminalNode,
  needsErrorHandling,
} from "@/lib/validation/node-grammar-v3";

// ========================================
// NODE GRAMMAR V3 TESTS
// ========================================

describe("NodeGrammarV3", () => {
  test("should identify terminal nodes correctly", () => {
    expect(isTerminalNode("end_success")).toBe(true);
    expect(isTerminalNode("end_error")).toBe(true);
    expect(isTerminalNode("end_neutral")).toBe(true);
    expect(isTerminalNode("end")).toBe(true);
    expect(isTerminalNode("action")).toBe(false);
    expect(isTerminalNode("form")).toBe(false);
    expect(isTerminalNode("condition")).toBe(false);
  });

  test("should identify nodes needing error handling", () => {
    // Form with medium impact needs error handling
    expect(needsErrorHandling("form", "medium")).toBe(true);
    expect(needsErrorHandling("form", "high")).toBe(true);
    expect(needsErrorHandling("form", "low")).toBe(false);

    // Action with high impact needs error handling
    expect(needsErrorHandling("action", "high")).toBe(true);
    expect(needsErrorHandling("action", "medium")).toBe(false);

    // Terminals don't need error handling
    expect(needsErrorHandling("end_success", "high")).toBe(false);
  });

  test("should have correct min/max outputs for conditions", () => {
    const grammar = getNodeGrammar("condition");
    expect(grammar.min_outputs).toBe(2);
    expect(grammar.max_outputs).toBe(2);
  });
});

// ========================================
// BRANCHING ENRICHER TESTS
// ========================================

describe("BranchingEnricherV3", () => {
  test("should add error handling for forms with medium impact", () => {
    const nodes: EnricherNode[] = [
      { id: "1", type: "trigger", title: "Start" },
      { id: "2", type: "form", title: "Login Form", impact_level: "medium" },
      { id: "3", type: "end_success", title: "Success" },
    ];

    const connections: EnricherConnection[] = [
      { source_node_id: "1", target_node_id: "2", connection_type: "success" },
      { source_node_id: "2", target_node_id: "3", connection_type: "success" },
    ];

    const result = enrichBranching(nodes, connections, "Login Flow");

    // Should add error handling nodes
    expect(result.added_nodes.length).toBeGreaterThan(0);
    expect(result.added_connections.length).toBeGreaterThan(0);
    expect(result.stats.error_paths_added).toBeGreaterThan(0);
  });

  test("should fix conditions with only 1 branch", () => {
    const nodes: EnricherNode[] = [
      { id: "1", type: "trigger", title: "Start" },
      { id: "2", type: "condition", title: "Is Valid?" },
      { id: "3", type: "end_success", title: "Success" },
    ];

    const connections: EnricherConnection[] = [
      { source_node_id: "1", target_node_id: "2", connection_type: "success" },
      { source_node_id: "2", target_node_id: "3", connection_type: "success" }, // Only 1 branch!
    ];

    const result = enrichBranching(nodes, connections);

    // Should add missing branch
    expect(result.stats.condition_branches_fixed).toBe(1);
    expect(result.added_nodes.length).toBeGreaterThan(0);
  });

  test("should add login-specific error handling", () => {
    const nodes: EnricherNode[] = [
      { id: "1", type: "trigger", title: "Acesso à Plataforma" },
      { id: "2", type: "form", title: "Login na Plataforma", impact_level: "medium" },
      { id: "3", type: "condition", title: "Validação de Credenciais" },
      { id: "4", type: "end_success", title: "Login Sucesso" },
    ];

    const connections: EnricherConnection[] = [
      { source_node_id: "1", target_node_id: "2", connection_type: "success" },
      { source_node_id: "2", target_node_id: "3", connection_type: "success" },
      { source_node_id: "3", target_node_id: "4", connection_type: "success" },
    ];

    const result = enrichBranching(nodes, connections, "Fluxo de Login");

    // Should detect login pattern and add error handling
    expect(result.stats.error_paths_added).toBeGreaterThan(0);
  });

  test("should add checkout-specific error handling", () => {
    const nodes: EnricherNode[] = [
      { id: "1", type: "trigger", title: "Início Checkout" },
      { id: "2", type: "form", title: "Dados de Pagamento", impact_level: "high" },
      { id: "3", type: "action", title: "Processar Pagamento", impact_level: "high" },
      { id: "4", type: "end_success", title: "Compra Finalizada" },
    ];

    const connections: EnricherConnection[] = [
      { source_node_id: "1", target_node_id: "2", connection_type: "success" },
      { source_node_id: "2", target_node_id: "3", connection_type: "success" },
      { source_node_id: "3", target_node_id: "4", connection_type: "success" },
    ];

    const result = enrichBranching(nodes, connections, "Checkout Flow");

    // Should detect checkout pattern and add payment error handling
    expect(result.stats.error_paths_added).toBeGreaterThan(0);
  });
});

// ========================================
// VALIDATE GRAPH V3 TESTS
// ========================================

describe("ValidateGraphV3", () => {
  test("should validate a correct flow", () => {
    const nodes: ValidatorNode[] = [
      { id: "1", type: "trigger", title: "Start", metadata: { v3_type: "trigger" } },
      { id: "2", type: "action", title: "Action", metadata: { v3_type: "action" } },
      { id: "3", type: "end_success", title: "End", metadata: { v3_type: "end_success" } },
    ];

    const connections: ValidatorConnection[] = [
      { source_node_id: "1", target_node_id: "2", connection_type: "success" },
      { source_node_id: "2", target_node_id: "3", connection_type: "success" },
    ];

    const result = validateGraphV3(nodes, connections);

    expect(result.stats.trigger_count).toBe(1);
    expect(result.stats.end_count).toBe(1);
    expect(result.summary.errors).toBe(0);
  });

  test("should detect missing trigger", () => {
    const nodes: ValidatorNode[] = [
      { id: "1", type: "action", title: "Action", metadata: { v3_type: "action" } },
      { id: "2", type: "end_success", title: "End", metadata: { v3_type: "end_success" } },
    ];

    const connections: ValidatorConnection[] = [
      { source_node_id: "1", target_node_id: "2", connection_type: "success" },
    ];

    const result = validateGraphV3(nodes, connections);

    expect(result.is_valid).toBe(false);
    expect(result.issues.some(i => i.title.includes("Trigger"))).toBe(true);
  });

  test("should detect terminal node with outputs", () => {
    const nodes: ValidatorNode[] = [
      { id: "1", type: "trigger", title: "Start", metadata: { v3_type: "trigger" } },
      { id: "2", type: "end_success", title: "End", metadata: { v3_type: "end_success" } },
      { id: "3", type: "action", title: "After End", metadata: { v3_type: "action" } },
    ];

    const connections: ValidatorConnection[] = [
      { source_node_id: "1", target_node_id: "2", connection_type: "success" },
      { source_node_id: "2", target_node_id: "3", connection_type: "success" }, // Invalid!
    ];

    const result = validateGraphV3(nodes, connections);

    expect(result.issues.some(i => i.category === "terminal")).toBe(true);
  });

  test("should detect condition with only 1 branch", () => {
    const nodes: ValidatorNode[] = [
      { id: "1", type: "trigger", title: "Start", metadata: { v3_type: "trigger" } },
      { id: "2", type: "condition", title: "Check", metadata: { v3_type: "condition" } },
      { id: "3", type: "end_success", title: "End", metadata: { v3_type: "end_success" } },
    ];

    const connections: ValidatorConnection[] = [
      { source_node_id: "1", target_node_id: "2", connection_type: "success" },
      { source_node_id: "2", target_node_id: "3", connection_type: "success" }, // Only 1 branch!
    ];

    const result = validateGraphV3(nodes, connections);

    expect(result.issues.some(i => i.category === "branching")).toBe(true);
  });

  test("should calculate branching score", () => {
    const nodes: ValidatorNode[] = [
      { id: "1", type: "trigger", title: "Start", metadata: { v3_type: "trigger" } },
      { id: "2", type: "condition", title: "Check", metadata: { v3_type: "condition" } },
      { id: "3", type: "end_success", title: "Success", metadata: { v3_type: "end_success" } },
      { id: "4", type: "end_error", title: "Error", metadata: { v3_type: "end_error" } },
    ];

    const connections: ValidatorConnection[] = [
      { source_node_id: "1", target_node_id: "2", connection_type: "success" },
      { source_node_id: "2", target_node_id: "3", connection_type: "success" },
      { source_node_id: "2", target_node_id: "4", connection_type: "failure" },
    ];

    const result = validateGraphV3(nodes, connections);

    // Should have good branching score (condition has 2 branches)
    expect(result.branching_score).toBeGreaterThan(50);
    expect(result.stats.conditions_with_two_branches).toBe(1);
  });
});

// ========================================
// AUTO-FIX V3 TESTS
// ========================================

describe("AutoFixV3", () => {
  test("should auto-fix missing trigger", () => {
    const nodes: ValidatorNode[] = [
      { id: "1", type: "action", title: "Action", metadata: { v3_type: "action" } },
      { id: "2", type: "end_success", title: "End", metadata: { v3_type: "end_success" } },
    ];

    const connections: ValidatorConnection[] = [
      { source_node_id: "1", target_node_id: "2", connection_type: "success" },
    ];

    const validation = validateGraphV3(nodes, connections);
    const result = autoFixGraphV3(nodes, connections, validation);

    // Should add trigger
    expect(result.added_nodes.some(n => n.type === "trigger")).toBe(true);
    expect(result.fixed_issues.length).toBeGreaterThan(0);
  });

  test("should remove connections from terminal nodes", () => {
    const nodes: ValidatorNode[] = [
      { id: "1", type: "trigger", title: "Start", metadata: { v3_type: "trigger" } },
      { id: "2", type: "end_success", title: "End", metadata: { v3_type: "end_success" } },
      { id: "3", type: "action", title: "After", metadata: { v3_type: "action" } },
    ];

    const connections: ValidatorConnection[] = [
      { id: "c1", source_node_id: "1", target_node_id: "2", connection_type: "success" },
      { id: "c2", source_node_id: "2", target_node_id: "3", connection_type: "success" },
    ];

    const validation = validateGraphV3(nodes, connections);
    const result = autoFixGraphV3(nodes, connections, validation);

    // Should remove invalid connection from terminal
    expect(result.removed_connections.length).toBeGreaterThan(0);
  });

  test("should apply branching enrichment during fix", () => {
    const nodes: ValidatorNode[] = [
      { id: "1", type: "trigger", title: "Start", metadata: { v3_type: "trigger" } },
      { id: "2", type: "form", title: "Form", metadata: { v3_type: "form", impact_level: "medium" } },
      { id: "3", type: "end_success", title: "End", metadata: { v3_type: "end_success" } },
    ];

    const connections: ValidatorConnection[] = [
      { source_node_id: "1", target_node_id: "2", connection_type: "success" },
      { source_node_id: "2", target_node_id: "3", connection_type: "success" },
    ];

    const validation = validateGraphV3(nodes, connections);
    const result = autoFixGraphV3(nodes, connections, validation, "Test Flow");

    // Should add error handling from BranchingEnricher
    expect(result.added_nodes.length).toBeGreaterThan(0);
  });
});

// ========================================
// INTEGRATION TESTS
// ========================================

describe("V3.1 Pipeline Integration", () => {
  test("should enrich and validate a login flow", () => {
    // Simulating a linear login flow (the problem we're fixing)
    const nodes: EnricherNode[] = [
      { id: "step_1", type: "trigger", title: "Acesso à Plataforma", impact_level: "medium" },
      { id: "step_2", type: "choice", title: "Escolha uma Opção", impact_level: "medium" },
      { id: "step_3", type: "form", title: "Login na Plataforma", impact_level: "medium" },
      { id: "step_4", type: "condition", title: "Validação de Credenciais", impact_level: "medium" },
      { id: "step_5", type: "end_success", title: "Login Bem-Sucedido", impact_level: "medium" },
    ];

    const connections: EnricherConnection[] = [
      { source_node_id: "step_1", target_node_id: "step_2", connection_type: "success" },
      { source_node_id: "step_2", target_node_id: "step_3", connection_type: "success" },
      { source_node_id: "step_3", target_node_id: "step_4", connection_type: "success" },
      { source_node_id: "step_4", target_node_id: "step_5", connection_type: "success" },
    ];

    // Step 1: Enrich
    const enrichment = enrichBranching(nodes, connections, "Fluxo de Login e Cadastro");

    console.log("Enrichment results:", {
      added_nodes: enrichment.added_nodes.map(n => ({ id: n.id, type: n.type, title: n.title })),
      added_connections: enrichment.added_connections.map(c => ({
        from: c.source_node_id,
        to: c.target_node_id,
        type: c.connection_type,
      })),
      stats: enrichment.stats,
    });

    // Should have error paths and loopbacks now
    expect(enrichment.stats.error_paths_added).toBeGreaterThan(0);

    // Step 2: Validate the enriched flow
    const allNodes: ValidatorNode[] = [
      ...nodes.map(n => ({ ...n, metadata: { v3_type: n.type, impact_level: n.impact_level } })),
      ...enrichment.added_nodes.map(n => ({ ...n, metadata: { v3_type: n.type } })),
    ];

    const allConnections: ValidatorConnection[] = [
      ...connections,
      ...enrichment.added_connections,
    ];

    const validation = validateGraphV3(allNodes, allConnections);

    console.log("Validation results:", {
      is_valid: validation.is_valid,
      integrity_score: validation.integrity_score,
      branching_score: validation.branching_score,
      issues: validation.issues.length,
      stats: validation.stats,
    });

    // Should have better branching score after enrichment
    expect(validation.branching_score).toBeGreaterThan(50);
  });

  test("should produce a flow with proper error paths", () => {
    // Minimal flow that should get error handling
    const nodes: EnricherNode[] = [
      { id: "1", type: "trigger", title: "Start" },
      { id: "2", type: "form", title: "Email Form", impact_level: "medium" },
      { id: "3", type: "end_success", title: "Done" },
    ];

    const connections: EnricherConnection[] = [
      { source_node_id: "1", target_node_id: "2", connection_type: "success" },
      { source_node_id: "2", target_node_id: "3", connection_type: "success" },
    ];

    const result = enrichBranching(nodes, connections, "Signup Flow");

    // Should have at least one error node and loopback
    const hasErrorNode = result.added_nodes.some(n => n.type === "feedback_error");
    const hasLoopback = result.added_connections.some(c => c.connection_type === "loopback");

    expect(hasErrorNode).toBe(true);
    expect(hasLoopback).toBe(true);
  });
});






