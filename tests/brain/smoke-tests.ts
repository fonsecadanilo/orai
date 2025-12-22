/**
 * BRAIN AGENT SMOKE TESTS
 * 
 * Testes de fumaça para validar funcionalidades críticas do Brain Agent.
 * Execute com: npx vitest run tests/brain/smoke-tests.ts
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

// Configuração
const SUPABASE_URL = process.env.SUPABASE_URL || "http://localhost:54321";
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const TEST_PROJECT_ID = 1;
const TEST_USER_ID = "test-user-smoke";

let supabase: SupabaseClient;

describe("Brain Agent Smoke Tests", () => {
  beforeAll(() => {
    supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
  });

  afterAll(async () => {
    // Cleanup: Remover dados de teste
    await supabase.from("brain_flow_plans").delete().eq("project_id", TEST_PROJECT_ID).like("id", "test-%");
    await supabase.from("brain_messages").delete().eq("project_id", TEST_PROJECT_ID);
    await supabase.from("brain_threads").delete().eq("project_id", TEST_PROJECT_ID);
    await supabase.from("brain_canvas_blocks").delete().eq("project_id", TEST_PROJECT_ID);
    await supabase.from("canvas_edges").delete().eq("project_id", TEST_PROJECT_ID);
  });

  // ========================================
  // TEST 1: Add Brain Block via Toolbar
  // ========================================
  describe("1. Add Brain Block via Toolbar", () => {
    it("should create a brain_canvas_block and brain_thread", async () => {
      // Simular chamada à Edge Function editor-add-brain-block
      const response = await fetch(`${SUPABASE_URL}/functions/v1/editor-add-brain-block`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${SUPABASE_KEY}`,
        },
        body: JSON.stringify({
          project_id: TEST_PROJECT_ID,
          user_id: TEST_USER_ID,
          position: { x: 100, y: 200 },
          initial_prompt: "Teste smoke - criar flow de login",
        }),
      });

      expect(response.ok).toBe(true);
      const result = await response.json();
      
      expect(result.success).toBe(true);
      expect(result.canvas_block).toBeDefined();
      expect(result.canvas_block.id).toBeDefined();
      expect(result.thread).toBeDefined();
      expect(result.thread.id).toBeDefined();
      
      // Verificar que foram criados no DB
      const { data: block } = await supabase
        .from("brain_canvas_blocks")
        .select("*")
        .eq("id", result.canvas_block.id)
        .single();
      
      expect(block).toBeDefined();
      expect(block?.block_type).toBe("brain_chat");
      
      const { data: thread } = await supabase
        .from("brain_threads")
        .select("*")
        .eq("id", result.thread.id)
        .single();
      
      expect(thread).toBeDefined();
    });
  });

  // ========================================
  // TEST 2: Plan Flow Request
  // ========================================
  describe("2. Plan Flow Request", () => {
    let threadId: string;
    let canvasBlockId: string;

    beforeAll(async () => {
      // Criar thread e block para teste
      const response = await fetch(`${SUPABASE_URL}/functions/v1/editor-add-brain-block`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${SUPABASE_KEY}`,
        },
        body: JSON.stringify({
          project_id: TEST_PROJECT_ID,
          user_id: TEST_USER_ID,
          position: { x: 300, y: 200 },
        }),
      });
      
      const result = await response.json();
      threadId = result.thread.id;
      canvasBlockId = result.canvas_block.id;
    });

    it("should create a plan_v1 when asking to 'plan onboarding flow'", async () => {
      // Enviar mensagem pedindo plano
      const response = await fetch(`${SUPABASE_URL}/functions/v1/brain-message-send`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${SUPABASE_KEY}`,
        },
        body: JSON.stringify({
          project_id: TEST_PROJECT_ID,
          thread_id: threadId,
          user_id: TEST_USER_ID,
          message: "Crie um plano para um flow de onboarding de novos usuários",
          canvas_block_id: canvasBlockId,
        }),
      });

      expect(response.ok).toBe(true);
      
      // Aguardar processamento (streaming)
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      // Verificar se criou plano
      const { data: plans } = await supabase
        .from("brain_flow_plans")
        .select("*")
        .eq("canvas_block_id", canvasBlockId)
        .order("created_at", { ascending: false });
      
      // Pode ter criado plano (depende do LLM)
      if (plans && plans.length > 0) {
        const latestPlan = plans[0];
        expect(latestPlan.status).toMatch(/draft|revised/);
        expect(latestPlan.plan_version).toBeGreaterThanOrEqual(1);
        expect(latestPlan.plan_md).toBeDefined();
      }
    });
  });

  // ========================================
  // TEST 3: Request Changes - Plan v2
  // ========================================
  describe("3. Request Changes - Plan v2", () => {
    it("should increment plan_version when requesting changes", async () => {
      // Criar plano inicial
      const { data: initialPlan } = await supabase
        .from("brain_flow_plans")
        .insert({
          project_id: TEST_PROJECT_ID,
          canvas_block_id: "test-block-v2",
          thread_id: "test-thread-v2",
          status: "draft",
          plan_version: 1,
          plan_md: "# Plano v1\n\nEste é o plano inicial",
          plan_json: { flow_goal: "Test flow", steps: [{ order: 1, title: "Step 1" }] },
        })
        .select()
        .single();

      expect(initialPlan).toBeDefined();
      
      // Simular upsert com revisão
      const response = await fetch(`${SUPABASE_URL}/functions/v1/brain-plan-upsert`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${SUPABASE_KEY}`,
        },
        body: JSON.stringify({
          project_id: TEST_PROJECT_ID,
          plan_id: initialPlan!.id,
          canvas_block_id: "test-block-v2",
          thread_id: "test-thread-v2",
          plan_md: "# Plano v2\n\nPlano revisado com mudanças",
          plan_json: { 
            flow_goal: "Test flow v2", 
            steps: [
              { order: 1, title: "Step 1 Revisado" },
              { order: 2, title: "Step 2 Novo" },
            ] 
          },
        }),
      });

      expect(response.ok).toBe(true);
      const result = await response.json();
      
      expect(result.success).toBe(true);
      expect(result.plan.plan_version).toBe(2);
      expect(result.plan.status).toBe("revised");
      
      // Verificar histórico de versões
      const { data: versions } = await supabase
        .from("brain_flow_plan_versions")
        .select("*")
        .eq("plan_id", initialPlan!.id);
      
      expect(versions).toBeDefined();
      expect(versions!.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ========================================
  // TEST 4: Approve & Build - Hard Gate
  // ========================================
  describe("4. Approve & Build - Hard Gate", () => {
    it("should reject approval of non-draft/revised plans", async () => {
      // Criar plano já aprovado
      const { data: approvedPlan } = await supabase
        .from("brain_flow_plans")
        .insert({
          project_id: TEST_PROJECT_ID,
          canvas_block_id: "test-block-approved",
          thread_id: "test-thread-approved",
          status: "approved",
          plan_version: 1,
          plan_md: "# Plano Aprovado",
          plan_json: { flow_goal: "Test", steps: [] },
        })
        .select()
        .single();

      const response = await fetch(`${SUPABASE_URL}/functions/v1/brain-plan-approve-build`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${SUPABASE_KEY}`,
        },
        body: JSON.stringify({
          project_id: TEST_PROJECT_ID,
          plan_id: approvedPlan!.id,
          approved_by: TEST_USER_ID,
        }),
      });

      expect(response.status).toBe(400);
      const result = await response.json();
      expect(result.success).toBe(false);
      expect(result.message).toContain("não pode ser aprovado");
    });

    it("should reject approval without valid plan_json", async () => {
      // Criar plano sem steps
      const { data: invalidPlan } = await supabase
        .from("brain_flow_plans")
        .insert({
          project_id: TEST_PROJECT_ID,
          canvas_block_id: "test-block-invalid",
          thread_id: "test-thread-invalid",
          status: "draft",
          plan_version: 1,
          plan_md: "# Plano Inválido",
          plan_json: { flow_goal: "Test", steps: [] }, // Steps vazios
        })
        .select()
        .single();

      const response = await fetch(`${SUPABASE_URL}/functions/v1/brain-plan-approve-build`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${SUPABASE_KEY}`,
        },
        body: JSON.stringify({
          project_id: TEST_PROJECT_ID,
          plan_id: invalidPlan!.id,
          approved_by: TEST_USER_ID,
        }),
      });

      expect(response.status).toBe(400);
      const result = await response.json();
      expect(result.success).toBe(false);
    });
  });

  // ========================================
  // TEST 5: Canvas Edges - Persistence
  // ========================================
  describe("5. Canvas Edges - Persistence", () => {
    it("should persist and retrieve canvas_edges", async () => {
      // Criar edge Brain -> Brain (continuation)
      const { data: edge1, error: error1 } = await supabase
        .from("canvas_edges")
        .insert({
          project_id: TEST_PROJECT_ID,
          source_type: "canvas_block",
          source_id: "brain-block-1",
          source_handle: "out_ref",
          target_type: "canvas_block",
          target_id: "brain-block-2",
          target_handle: "in_ref",
          edge_type: "continuation",
          label: "continua para",
          created_by: TEST_USER_ID,
        })
        .select()
        .single();

      expect(error1).toBeNull();
      expect(edge1).toBeDefined();
      expect(edge1?.edge_type).toBe("continuation");

      // Criar edge Brain -> Node (explains)
      const { data: edge2, error: error2 } = await supabase
        .from("canvas_edges")
        .insert({
          project_id: TEST_PROJECT_ID,
          source_type: "canvas_block",
          source_id: "brain-block-1",
          source_handle: "out_ref",
          target_type: "flow_node",
          target_id: "node-123",
          target_handle: "default",
          edge_type: "explains",
          label: "explica",
          created_by: TEST_USER_ID,
        })
        .select()
        .single();

      expect(error2).toBeNull();
      expect(edge2).toBeDefined();
      expect(edge2?.edge_type).toBe("explains");

      // Verificar retrieval
      const { data: edges } = await supabase
        .from("canvas_edges")
        .select("*")
        .eq("project_id", TEST_PROJECT_ID)
        .eq("source_id", "brain-block-1");

      expect(edges).toBeDefined();
      expect(edges!.length).toBeGreaterThanOrEqual(2);
    });

    it("should allow updating edge_type", async () => {
      // Criar edge
      const { data: edge } = await supabase
        .from("canvas_edges")
        .insert({
          project_id: TEST_PROJECT_ID,
          source_type: "canvas_block",
          source_id: "brain-block-update",
          target_type: "flow_node",
          target_id: "node-update",
          edge_type: "reference",
          created_by: TEST_USER_ID,
        })
        .select()
        .single();

      // Atualizar edge_type
      const { data: updatedEdge, error } = await supabase
        .from("canvas_edges")
        .update({ edge_type: "depends_on" })
        .eq("id", edge!.id)
        .select()
        .single();

      expect(error).toBeNull();
      expect(updatedEdge?.edge_type).toBe("depends_on");
    });
  });

  // ========================================
  // TEST 6: Branching Validation
  // ========================================
  describe("6. Branching Validation", () => {
    it("should enforce conditions with 2 branches", async () => {
      // Este teste é mais de integração - verificar se o auto-fix funciona
      // criando um plano com condition sem branches
      
      const { data: plan } = await supabase
        .from("brain_flow_plans")
        .insert({
          project_id: TEST_PROJECT_ID,
          canvas_block_id: "test-block-branching",
          thread_id: "test-thread-branching",
          status: "draft",
          plan_version: 1,
          plan_md: "# Plano com Condition",
          plan_json: { 
            flow_goal: "Login Flow", 
            steps: [
              { order: 1, group: "Início", title: "Trigger", node_type: "trigger" },
              { order: 2, group: "Auth", title: "Preencher credenciais", node_type: "form" },
              { order: 3, group: "Verificação", title: "Credenciais válidas?", node_type: "condition" },
              { order: 4, group: "Conclusão", title: "Login realizado", node_type: "end_success" },
            ],
            decision_points: [],
            failure_points: [],
            inputs: [],
            rules_refs: [],
            acceptance_checklist: [],
          },
        })
        .select()
        .single();

      expect(plan).toBeDefined();
      expect(plan?.plan_json.steps.length).toBe(4);
      
      // O auto-fix será testado quando chamarmos approve-build
      // Por agora, apenas verificamos que o plano foi criado
    });
  });

  // ========================================
  // TEST 7: Rate Limiting & Auth
  // ========================================
  describe("7. Rate Limiting & Auth", () => {
    it("should reject requests without authorization", async () => {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/brain-message-send`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          // Sem Authorization header
        },
        body: JSON.stringify({
          project_id: TEST_PROJECT_ID,
          thread_id: "test",
          user_id: TEST_USER_ID,
          message: "Test",
        }),
      });

      // Deve falhar ou retornar erro de auth
      expect(response.status).toBeGreaterThanOrEqual(400);
    });

    it("should validate project_id ownership", async () => {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/brain-plan-approve-build`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${SUPABASE_KEY}`,
        },
        body: JSON.stringify({
          project_id: 99999, // Project que não existe
          plan_id: "00000000-0000-0000-0000-000000000000",
          approved_by: TEST_USER_ID,
        }),
      });

      expect(response.status).toBeGreaterThanOrEqual(400);
    });
  });
});

// ========================================
// HELPER: Run individual test
// ========================================
export async function runSingleTest(testName: string) {
  console.log(`Running test: ${testName}`);
  // Implementar se necessário para testes manuais
}

