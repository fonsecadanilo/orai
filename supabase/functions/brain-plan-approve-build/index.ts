import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * BRAIN PLAN APPROVE & BUILD
 * 
 * Server-side gate para aprovar plano e disparar builders v3.1.
 * Este é o ÚNICO ponto de entrada para construção de flows!
 * 
 * Fluxo:
 * 1. Validar que plano existe e está em estado válido (draft/revised)
 * 2. Validar que plan_json.spec existe
 * 3. Marcar status = approved
 * 4. Disparar builders v3.1 (v3-flow-synthesizer)
 * 5. Marcar status = building
 * 6. Ao finalizar: status = built + result_flow_id + criar edge
 */

const RequestSchema = z.object({
  project_id: z.number(),
  plan_id: z.string().uuid(),
  approved_by: z.string().min(1),
});

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const request = RequestSchema.parse(body);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log("[brain-plan-approve-build] Starting approval for plan:", request.plan_id);

    const now = new Date().toISOString();

    // 1. Buscar plano
    const { data: plan, error: planError } = await supabase
      .from("brain_flow_plans")
      .select("*")
      .eq("id", request.plan_id)
      .single();

    if (planError || !plan) {
      return new Response(
        JSON.stringify({ success: false, message: "Plano não encontrado" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Validar estado (HARD GATE)
    if (!["draft", "revised"].includes(plan.status)) {
      return new Response(
        JSON.stringify({
          success: false,
          message: `Plano não pode ser aprovado no estado '${plan.status}'. Estados válidos: draft, revised`,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. Validar que project_id corresponde
    if (plan.project_id !== request.project_id) {
      return new Response(
        JSON.stringify({ success: false, message: "Project ID não corresponde" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 4. Validar que plan_json tem dados suficientes
    const planJson = plan.plan_json;
    if (!planJson || !planJson.flow_goal || !planJson.steps || planJson.steps.length === 0) {
      return new Response(
        JSON.stringify({
          success: false,
          message: "Plano inválido: faltam flow_goal ou steps",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 5. Marcar como approved
    const { error: approveError } = await supabase
      .from("brain_flow_plans")
      .update({
        status: "approved",
        approved_at: now,
        approved_by: request.approved_by,
        updated_at: now,
      })
      .eq("id", request.plan_id);

    if (approveError) throw approveError;

    console.log("[brain-plan-approve-build] Plan approved, starting build...");

    // 6. Gerar build_job_id único
    const buildJobId = crypto.randomUUID();

    // 7. Marcar como building
    const { data: updatedPlan, error: buildingError } = await supabase
      .from("brain_flow_plans")
      .update({
        status: "building",
        build_job_id: buildJobId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", request.plan_id)
      .select()
      .single();

    if (buildingError) throw buildingError;

    // 8. Disparar builders v3.1 de forma assíncrona
    // NOTA: Não esperamos a conclusão aqui - o builder vai atualizar o status quando terminar
    dispatchBuilders(supabase, supabaseUrl, supabaseKey, {
      plan_id: request.plan_id,
      project_id: request.project_id,
      build_job_id: buildJobId,
      plan_json: planJson,
      canvas_block_id: plan.canvas_block_id,
    }).catch(err => {
      console.error("[brain-plan-approve-build] Builder dispatch failed:", err);
    });

    console.log("[brain-plan-approve-build] Build dispatched with job:", buildJobId);

    return new Response(
      JSON.stringify({
        success: true,
        plan: updatedPlan,
        build_job_id: buildJobId,
        message: "Plano aprovado! Construção iniciada.",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[brain-plan-approve-build] Error:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        message: error instanceof Error ? error.message : String(error) 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// ========================================
// VALIDAÇÃO V3.1 (HARD GATE)
// ========================================

interface BranchingNode {
  id: string;
  type: string;
  title?: string;
  impact_level?: "low" | "medium" | "high";
  has_validations?: boolean;
  has_required_fields?: boolean;
  inputs?: Array<{ required?: boolean; validation_rules?: string[] }>;
}

interface BranchingConnection {
  source_id: string;
  target_id: string;
  connection_type?: string;
  label?: string;
}

interface ValidationIssue {
  rule_id: string;
  severity: "error" | "warning";
  message: string;
  node_id?: string;
  auto_fixable: boolean;
}

// Tipos que indicam ramificação
const BRANCHING_TYPES = new Set(["condition", "choice", "option_choice", "insight_branch"]);

/**
 * REGRA B1: Conditions devem ter exatamente 2 saídas
 */
function checkConditionBranches(
  nodes: BranchingNode[],
  connections: BranchingConnection[]
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const conditions = nodes.filter(n => n.type === "condition");
  
  for (const condition of conditions) {
    const outgoing = connections.filter(c => c.source_id === condition.id);
    
    if (outgoing.length < 2) {
      issues.push({
        rule_id: "B1_CONDITION_NEEDS_2_BRANCHES",
        severity: "error",
        message: `Condition "${condition.title || condition.id}" tem apenas ${outgoing.length} saída(s). Deve ter 2 (success/failure).`,
        node_id: condition.id,
        auto_fixable: true,
      });
    }
  }
  return issues;
}

/**
 * REGRA B2: Forms com validações devem ter feedback_error + loopback
 */
function checkFormErrorHandling(
  nodes: BranchingNode[],
  connections: BranchingConnection[]
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  
  const criticalForms = nodes.filter(n => {
    if (n.type !== "form") return false;
    if (n.impact_level === "medium" || n.impact_level === "high") return true;
    if (n.has_validations || n.has_required_fields) return true;
    if (n.inputs?.some(i => i.required)) return true;
    return false;
  });
  
  if (criticalForms.length === 0) return issues;
  
  const hasFeedbackError = nodes.some(n => n.type === "feedback_error");
  
  if (!hasFeedbackError) {
    issues.push({
      rule_id: "B2_FORM_NO_FEEDBACK_ERROR",
      severity: "error",
      message: `Existem ${criticalForms.length} forms críticos sem feedback_error no flow.`,
      auto_fixable: true,
    });
  }
  
  return issues;
}

/**
 * REGRA B4: Flows > 6 nós devem ter pelo menos 1 branch
 */
function checkMinimumBranching(nodes: BranchingNode[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const MIN_NODES = 6;
  
  if (nodes.length <= MIN_NODES) return issues;
  
  const hasBranching = nodes.some(n => BRANCHING_TYPES.has(n.type));
  
  if (!hasBranching) {
    issues.push({
      rule_id: "B4_NO_BRANCHING_IN_LARGE_FLOW",
      severity: "error",
      message: `Flow com ${nodes.length} nós não tem ramificação.`,
      auto_fixable: true,
    });
  }
  
  return issues;
}

/**
 * Validação completa de branching v3.1
 */
function validateBranchingV31(nodes: BranchingNode[], connections: BranchingConnection[]): {
  is_valid: boolean;
  issues: ValidationIssue[];
} {
  const issues: ValidationIssue[] = [];
  
  issues.push(...checkConditionBranches(nodes, connections));
  issues.push(...checkFormErrorHandling(nodes, connections));
  issues.push(...checkMinimumBranching(nodes));
  
  return {
    is_valid: !issues.some(i => i.severity === "error"),
    issues,
  };
}

/**
 * Auto-fix de estrutura do flow v3.1
 * Adiciona nós faltantes para garantir branching completo
 */
function autoFixFlowStructure(
  nodes: any[],
  connections: any[]
): { nodes: any[]; connections: any[]; fixes_applied: string[] } {
  const fixedNodes = [...nodes];
  const fixedConnections = [...connections];
  const fixesApplied: string[] = [];
  
  // Fix B1: Conditions sem 2 branches
  const conditions = fixedNodes.filter(n => n.type === "condition" || n.semantic_type === "condition");
  for (const condition of conditions) {
    const outgoing = fixedConnections.filter(c => c.source_id === condition.step_id || c.source_id === condition.id);
    
    if (outgoing.length < 2) {
      // Adicionar feedback_error para o branch de falha
      const errorNodeId = `feedback_error_auto_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      fixedNodes.push({
        step_id: errorNodeId,
        semantic_type: "feedback_error",
        title: "Erro de Validação",
        description: `Tratamento de erro para: ${condition.title || condition.step_id}`,
        group_label: "Tratamento de Erro",
        order_index: fixedNodes.length,
      });
      
      // Adicionar loopback
      const loopbackNodeId = `loopback_auto_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      fixedNodes.push({
        step_id: loopbackNodeId,
        semantic_type: "loopback",
        title: "Tentar Novamente",
        description: "Retornar para corrigir informações",
        group_label: "Tratamento de Erro",
        order_index: fixedNodes.length,
      });
      
      // Adicionar conexões
      if (outgoing.length === 0) {
        // Adicionar branch success (próximo nó)
        const nextNode = fixedNodes.find(n => 
          (n.order_index || 0) > (condition.order_index || 0) && 
          n.step_id !== errorNodeId && n.step_id !== loopbackNodeId
        );
        if (nextNode) {
          fixedConnections.push({
            source_id: condition.step_id || condition.id,
            target_id: nextNode.step_id || nextNode.id,
            connection_type: "success",
            label: "Sim",
          });
        }
      }
      
      // Adicionar branch failure
      fixedConnections.push({
        source_id: condition.step_id || condition.id,
        target_id: errorNodeId,
        connection_type: "failure",
        label: "Não",
      });
      
      // Conectar error -> loopback
      fixedConnections.push({
        source_id: errorNodeId,
        target_id: loopbackNodeId,
        connection_type: "default",
      });
      
      fixesApplied.push(`B1: Adicionado feedback_error + loopback para condition "${condition.title}"`);
    }
  }
  
  // Fix B2: Forms sem error handling
  const criticalForms = fixedNodes.filter(n => 
    (n.type === "form" || n.semantic_type === "form") &&
    (n.impact_level === "medium" || n.impact_level === "high" || n.inputs?.some((i: any) => i.required))
  );
  
  const hasFeedbackError = fixedNodes.some(n => n.type === "feedback_error" || n.semantic_type === "feedback_error");
  
  if (criticalForms.length > 0 && !hasFeedbackError) {
    const errorNodeId = `feedback_error_form_${Date.now()}`;
    fixedNodes.push({
      step_id: errorNodeId,
      semantic_type: "feedback_error",
      title: "Erro no Formulário",
      description: "Corrija os campos destacados e tente novamente",
      group_label: "Tratamento de Erro",
      order_index: fixedNodes.length,
    });
    
    const loopbackNodeId = `loopback_form_${Date.now()}`;
    fixedNodes.push({
      step_id: loopbackNodeId,
      semantic_type: "loopback",
      title: "Corrigir Informações",
      description: "Voltar ao formulário para correção",
      group_label: "Tratamento de Erro",
      order_index: fixedNodes.length,
    });
    
    fixesApplied.push(`B2: Adicionado feedback_error + loopback para ${criticalForms.length} forms críticos`);
  }
  
  // Fix B4: Flow grande sem branching
  if (fixedNodes.length > 6) {
    const hasBranching = fixedNodes.some(n => 
      BRANCHING_TYPES.has(n.type) || BRANCHING_TYPES.has(n.semantic_type)
    );
    
    if (!hasBranching) {
      // Encontrar um ponto de decisão natural (após form ou action crítica)
      const insertPoint = fixedNodes.findIndex(n => 
        (n.type === "form" || n.semantic_type === "form") ||
        ((n.type === "action" || n.semantic_type === "action") && n.impact_level === "high")
      );
      
      if (insertPoint >= 0) {
        const conditionNodeId = `condition_auto_${Date.now()}`;
        const conditionNode = {
          step_id: conditionNodeId,
          semantic_type: "condition",
          title: "Dados Válidos?",
          description: "Verificar se os dados estão corretos",
          group_label: "Verificação",
          order_index: insertPoint + 0.5,
          branch_success_meaning: "Prosseguir com o fluxo",
          branch_failure_meaning: "Mostrar erro e permitir correção",
        };
        
        fixedNodes.splice(insertPoint + 1, 0, conditionNode);
        fixesApplied.push(`B4: Adicionado condition após "${fixedNodes[insertPoint]?.title || 'step'}" para criar branching`);
      }
    }
  }
  
  // Reordenar order_index
  fixedNodes.forEach((node, idx) => {
    node.order_index = idx;
  });
  
  return { nodes: fixedNodes, connections: fixedConnections, fixes_applied: fixesApplied };
}

/**
 * Dispara os builders v3.1 de forma assíncrona
 */
async function dispatchBuilders(
  supabase: ReturnType<typeof createClient>,
  supabaseUrl: string,
  supabaseKey: string,
  params: {
    plan_id: string;
    project_id: number;
    build_job_id: string;
    plan_json: unknown;
    canvas_block_id: string;
  }
) {
  try {
    console.log("[dispatchBuilders] Starting build for plan:", params.plan_id);

    // Carregar contexto necessário
    const { data: productProfile } = await supabase
      .from("product_profiles")
      .select("*")
      .eq("project_id", params.project_id)
      .single();

    const { data: approvedRules } = await supabase
      .from("rules")
      .select("*")
      .eq("project_id", params.project_id)
      .eq("status", "active");

    // Preparar spec para v3-flow-synthesizer
    const planJson = params.plan_json as {
      flow_goal: string;
      actors: string[];
      steps: { order: number; group: string; title: string; description: string; node_type?: string }[];
      decision_points: unknown[];
      failure_points: unknown[];
      inputs: unknown[];
      rules_refs: string[];
      acceptance_checklist: string[];
      spec?: unknown;
    };

    // Converter plan para formato do flow-synthesizer
    const flowSpec = planJson.spec || {
      flow_name: planJson.flow_goal.slice(0, 50),
      flow_description: planJson.flow_goal,
      steps: planJson.steps.map(s => ({
        step_number: s.order,
        step_title: s.title,
        step_description: s.description,
        node_type: s.node_type || "action",
        group: s.group,
      })),
      decision_points: planJson.decision_points,
      inputs: planJson.inputs,
    };

    // Chamar v3-flow-synthesizer
    const synthResponse = await fetch(`${supabaseUrl}/functions/v1/v3-flow-synthesizer`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${supabaseKey}`,
      },
      body: JSON.stringify({
        project_id: params.project_id,
        flow_spec: flowSpec,
        product_profile: productProfile,
        business_rules: approvedRules || [],
        source: "brain_plan",
        brain_plan_id: params.plan_id,
      }),
    });

    if (!synthResponse.ok) {
      const error = await synthResponse.text();
      throw new Error(`v3-flow-synthesizer failed: ${error}`);
    }

    const synthResult = await synthResponse.json();
    console.log("[dispatchBuilders] Synthesizer result:", synthResult);

    // ========================================
    // FASE 6: VALIDAÇÃO V3.1 + AUTO-FIX
    // ========================================
    
    if (synthResult.success && synthResult.synthesized_flow?.steps) {
      const steps = synthResult.synthesized_flow.steps;
      const connections: BranchingConnection[] = [];
      
      // Construir conexões a partir de suggested_edges
      for (const step of steps) {
        if (step.suggested_edges) {
          for (const edge of step.suggested_edges) {
            const targetStep = steps.find((s: any) => 
              s.step_id === edge.target_hint || 
              s.title?.toLowerCase().includes(edge.target_hint?.toLowerCase() || "")
            );
            if (targetStep) {
              connections.push({
                source_id: step.step_id,
                target_id: targetStep.step_id,
                connection_type: edge.type,
                label: edge.label,
              });
            }
          }
        }
        
        // Conectar sequencialmente se não houver edges explícitos
        if (!step.suggested_edges || step.suggested_edges.length === 0) {
          const nextStep = steps.find((s: any) => s.order_index === (step.order_index || 0) + 1);
          if (nextStep && !step.semantic_type?.startsWith("end")) {
            connections.push({
              source_id: step.step_id,
              target_id: nextStep.step_id,
              connection_type: "default",
            });
          }
        }
      }
      
      // Validar branching
      const validation = validateBranchingV31(
        steps.map((s: any) => ({
          id: s.step_id,
          type: s.semantic_type || s.type || "action",
          title: s.title,
          impact_level: s.metadata?.impact_level,
          has_validations: s.inputs?.some((i: any) => i.validation_rules?.length),
          has_required_fields: s.inputs?.some((i: any) => i.required),
          inputs: s.inputs,
        })),
        connections
      );
      
      console.log("[dispatchBuilders] Validation result:", validation);
      
      let finalSteps = steps;
      let finalConnections = connections;
      let autoFixStats: string[] = [];
      
      // Se não passou na validação, tentar auto-fix
      if (!validation.is_valid) {
        console.log("[dispatchBuilders] Validation failed, attempting auto-fix...");
        
        const { nodes: fixedNodes, connections: fixedConns, fixes_applied } = autoFixFlowStructure(steps, connections);
        
        finalSteps = fixedNodes;
        finalConnections = fixedConns;
        autoFixStats = fixes_applied;
        
        console.log("[dispatchBuilders] Auto-fix applied:", fixes_applied);
        
        // Re-validar após fix
        const revalidation = validateBranchingV31(
          finalSteps.map((s: any) => ({
            id: s.step_id,
            type: s.semantic_type || "action",
            title: s.title,
            impact_level: s.metadata?.impact_level,
            inputs: s.inputs,
          })),
          finalConnections
        );
        
        if (!revalidation.is_valid) {
          // HARD GATE: Se ainda não passou, bloquear build
          console.error("[dispatchBuilders] HARD GATE: Validation failed after auto-fix:", revalidation.issues);
          
          await supabase
            .from("brain_flow_plans")
            .update({
              status: "revised",
              updated_at: new Date().toISOString(),
            })
            .eq("id", params.plan_id);
            
          return;
        }
      }
      
      // Salvar flow com validação OK
      const now = new Date().toISOString();
      
      // Criar flow na tabela flows
      const { data: savedFlow, error: flowError } = await supabase
        .from("flows")
        .insert({
          project_id: params.project_id,
          name: synthResult.synthesized_flow.flow_name || "Flow gerado pelo Brain",
          description: synthResult.synthesized_flow.flow_description,
          status: "draft",
          metadata: {
            generated_from_brain_plan: params.plan_id,
            generated_from_brain_block: params.canvas_block_id,
            generated_at: now,
            type_stats: synthResult.type_stats,
            auto_fix_stats: autoFixStats,
            validation_passed: true,
          },
          created_at: now,
          updated_at: now,
        })
        .select()
        .single();
        
      if (flowError) {
        throw new Error(`Erro ao salvar flow: ${flowError.message}`);
      }
      
      console.log("[dispatchBuilders] Flow saved:", savedFlow.id);
      
      // Salvar nós
      const nodesToInsert = finalSteps.map((step: any, idx: number) => ({
        flow_id: savedFlow.id,
        type: step.semantic_type || step.type || "action",
        title: step.title,
        description: step.description,
        position_x: 400,
        position_y: 100 + idx * 150,
        order_index: idx,
        metadata: {
          step_id: step.step_id,
          group_label: step.group_label,
          user_intent: step.user_intent,
          system_behavior: step.system_behavior,
          inputs: step.inputs,
          error_cases: step.error_cases,
          impact_level: step.metadata?.impact_level,
          suggested_edges: step.suggested_edges,
        },
      }));
      
      const { data: savedNodes, error: nodesError } = await supabase
        .from("nodes")
        .insert(nodesToInsert)
        .select();
        
      if (nodesError) {
        console.error("[dispatchBuilders] Error saving nodes:", nodesError);
      } else {
        console.log("[dispatchBuilders] Nodes saved:", savedNodes?.length);
        
        // Criar mapa step_id -> node.id real
        const stepToNodeMap: Record<string, number> = {};
        for (const node of savedNodes || []) {
          const stepId = node.metadata?.step_id;
          if (stepId) {
            stepToNodeMap[stepId] = node.id;
          }
        }
        
        // Salvar conexões
        const connectionsToInsert = finalConnections
          .filter(c => stepToNodeMap[c.source_id] && stepToNodeMap[c.target_id])
          .map(c => ({
            flow_id: savedFlow.id,
            source_node_id: stepToNodeMap[c.source_id],
            target_node_id: stepToNodeMap[c.target_id],
            connection_type: c.connection_type || "default",
            label: c.label,
          }));
        
        if (connectionsToInsert.length > 0) {
          const { error: connError } = await supabase
            .from("connections")
            .insert(connectionsToInsert);
            
          if (connError) {
            console.error("[dispatchBuilders] Error saving connections:", connError);
          } else {
            console.log("[dispatchBuilders] Connections saved:", connectionsToInsert.length);
          }
        }
      }
      
      // Marcar plano como built
      await supabase
        .from("brain_flow_plans")
        .update({
          status: "built",
          result_flow_id: savedFlow.id,
          updated_at: now,
        })
        .eq("id", params.plan_id);

      // Criar edge de ligação (BrainBlock -> Flow)
      await createGeneratedFromEdge(supabase, {
        project_id: params.project_id,
        canvas_block_id: params.canvas_block_id,
        flow_id: savedFlow.id,
      });

      console.log("[dispatchBuilders] Build complete! Flow ID:", savedFlow.id);
      
    } else {
      // Fallback: se não tem steps, marcar como erro
      await supabase
        .from("brain_flow_plans")
        .update({
          status: "revised",
          updated_at: new Date().toISOString(),
        })
        .eq("id", params.plan_id);

      console.error("[dispatchBuilders] Build failed: No steps in synthesized flow");
    }

  } catch (error) {
    console.error("[dispatchBuilders] Error:", error);

    // Marcar como erro
    await supabase
      .from("brain_flow_plans")
      .update({
        status: "revised",
        updated_at: new Date().toISOString(),
      })
      .eq("id", params.plan_id);
  }
}

/**
 * Cria edge de ligação BrainBlock -> Flow (generated_from)
 */
async function createGeneratedFromEdge(
  supabase: ReturnType<typeof createClient>,
  params: {
    project_id: number;
    canvas_block_id: string;
    flow_id: number;
  }
) {
  try {
    // Buscar primeiro nó do flow (entry point)
    const { data: nodes } = await supabase
      .from("nodes")
      .select("id")
      .eq("flow_id", params.flow_id)
      .order("position_y", { ascending: true })
      .limit(1);

    if (!nodes || nodes.length === 0) {
      console.warn("[createGeneratedFromEdge] No nodes found in flow");
      return;
    }

    const entryNodeId = nodes[0].id;

    // Verificar se já existe edge
    const { data: existingEdge } = await supabase
      .from("connections")
      .select("id")
      .eq("flow_id", params.flow_id)
      .eq("metadata->>edge_type", "generated_from")
      .single();

    if (existingEdge) {
      console.log("[createGeneratedFromEdge] Edge already exists");
      return;
    }

    // Criar edge especial
    // NOTA: Isso pode precisar de ajuste dependendo da estrutura do canvas
    // Por ora, vamos apenas registrar a relação no metadata do flow
    await supabase
      .from("flows")
      .update({
        metadata: {
          generated_from_brain_block: params.canvas_block_id,
          generated_at: new Date().toISOString(),
        },
      })
      .eq("id", params.flow_id);

    console.log("[createGeneratedFromEdge] Edge created/updated");
  } catch (error) {
    console.error("[createGeneratedFromEdge] Error:", error);
  }
}



