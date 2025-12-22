import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import OpenAI from "https://deno.land/x/openai@v4.68.1/mod.ts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

import type {
  BrainMode,
  BrainModel,
  BrainMessage,
  BrainMessageMetadata,
  BrainOutput,
  BrainAction,
  BrainMessageSendRequest,
  ContextStats,
  ProjectContext,
  RouteResult,
  ModelConfig,
  BrainStreamEvent,
} from "../_shared/brain-types.ts";
import { 
  routeDeterministic, 
  route, 
  getModelConfig,
  formatRouteResult,
} from "../_shared/brain-router.ts";
import {
  loadEnvConfig,
  getSystemPromptForMode,
  DEFAULT_THRESHOLDS,
} from "../_shared/brain-configs.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * BRAIN MESSAGE SEND
 * 
 * Envia uma mensagem para o Brain com:
 * - Roteamento inteligente de modelo
 * - Streaming de resposta
 * - Persistência de mensagens
 * - Atualização de canvas blocks
 */

// Schema de entrada
const RequestSchema = z.object({
  project_id: z.number(),
  thread_id: z.string().uuid().optional(),
  user_prompt: z.string().min(1),
  editor_context: z.object({
    selected_node_ids: z.array(z.string()).optional(),
    viewport: z.object({
      x: z.number(),
      y: z.number(),
      zoom: z.number(),
    }).optional(),
    current_flow_id: z.string().optional(),
    editor_mode: z.enum(["view", "edit", "comment"]).optional(),
  }).optional(),
  force_mode: z.enum(["PLAN", "CONSULT", "BATCH", "LONG_CONTEXT"]).optional(),
  force_model: z.string().optional(),
});

// Schema de output do Brain
const BrainOutputSchema = z.object({
  assistant_response_md: z.string(),
  actions: z.array(z.object({
    action_id: z.string(),
    action_type: z.string(),
    payload: z.unknown(),
    description: z.string(),
    reversible: z.boolean(),
    priority: z.number(),
  })),
  reasoning_summary: z.string().optional(),
  warnings: z.array(z.string()).optional(),
  follow_up_suggestions: z.array(z.string()).optional(),
});

// ========================================
// CONTEXT LOADING
// ========================================

async function loadProjectContext(
  supabase: ReturnType<typeof createClient>,
  projectId: number
): Promise<ProjectContext> {
  // Load product profile
  const { data: productProfile } = await supabase
    .from("product_profiles")
    .select("*")
    .eq("project_id", projectId)
    .single();

  // Load personas
  const { data: personas } = await supabase
    .from("personas")
    .select("*")
    .eq("project_id", projectId);

  // Load business rules (only approved ones for efficiency)
  const { data: businessRules } = await supabase
    .from("business_rules")
    .select("*")
    .eq("project_id", projectId)
    .eq("status", "approved");

  // Load flow registry
  const { data: flowRegistry } = await supabase
    .from("flow_registry")
    .select("*")
    .eq("project_id", projectId);

  // Load latest flow specs
  const { data: flowSpecs } = await supabase
    .from("flow_specs")
    .select("*")
    .eq("project_id", projectId)
    .eq("is_latest", true);

  return {
    project_id: projectId,
    product_profile: productProfile || null,
    personas: personas || [],
    business_rules: businessRules || [],
    flow_registry: flowRegistry || [],
    flow_specs: flowSpecs || [],
  };
}

async function loadThreadMessages(
  supabase: ReturnType<typeof createClient>,
  threadId: string,
  limit: number = 20
): Promise<BrainMessage[]> {
  const { data: messages } = await supabase
    .from("brain_messages")
    .select("*")
    .eq("thread_id", threadId)
    .order("created_at", { ascending: false })
    .limit(limit);

  return (messages || []).reverse();
}

// ========================================
// TOKEN ESTIMATION
// ========================================

const CHARS_PER_TOKEN = 3.5;

function estimateTokens(obj: unknown): number {
  if (!obj) return 0;
  try {
    const json = JSON.stringify(obj);
    return Math.ceil(json.length / CHARS_PER_TOKEN);
  } catch {
    return 0;
  }
}

function calculateContextStats(
  context: ProjectContext,
  messages: BrainMessage[]
): ContextStats {
  const env = loadEnvConfig();
  const threshold = env.BRAIN_LONG_CONTEXT_THRESHOLD || DEFAULT_THRESHOLDS.LONG_CONTEXT_THRESHOLD;

  const productTokens = estimateTokens(context.product_profile);
  const personasTokens = estimateTokens(context.personas);
  const rulesTokens = estimateTokens(context.business_rules);
  const registryTokens = estimateTokens(context.flow_registry);
  const specsTokens = estimateTokens(context.flow_specs);
  const messagesTokens = estimateTokens(messages);

  const totalTokens = 1500 + productTokens + personasTokens + rulesTokens + 
                      registryTokens + specsTokens + messagesTokens;

  return {
    total_tokens_estimate: totalTokens,
    business_rules_count: context.business_rules.length,
    flow_specs_count: context.flow_specs.length,
    flow_registry_count: context.flow_registry.length,
    personas_count: context.personas.length,
    thread_messages_count: messages.length,
    is_large_context: totalTokens > threshold,
    largest_item_tokens: Math.max(
      productTokens, personasTokens, rulesTokens, registryTokens, specsTokens
    ),
  };
}

// ========================================
// CLASSIFIER
// ========================================

async function classifyPrompt(
  openai: OpenAI,
  prompt: string,
  stats: ContextStats
): Promise<{
  mode: BrainMode;
  complexity: number;
  risk_level: "low" | "medium" | "high";
  requires_structured_output: boolean;
  needs_tool_use: boolean;
  confidence: number;
}> {
  const classifierPrompt = `Classifique o prompt em: PLAN (criar/alterar arquitetura/regras), CONSULT (perguntas/explicações), BATCH (transformações em lote), LONG_CONTEXT (contexto grande).

Prompt: "${prompt}"
Contexto: ${stats.total_tokens_estimate} tokens, ${stats.business_rules_count} regras, ${stats.flow_specs_count} specs

Responda apenas JSON: {"mode": "...", "complexity": 0-1, "risk_level": "low|medium|high", "requires_structured_output": bool, "needs_tool_use": bool, "confidence": 0-1}`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: classifierPrompt }],
    temperature: 0.1,
    max_tokens: 150,
    response_format: { type: "json_object" },
  });

  const content = response.choices[0]?.message?.content || "{}";
  const result = JSON.parse(content);

  return {
    mode: result.mode || "CONSULT",
    complexity: result.complexity || 0.5,
    risk_level: result.risk_level || "low",
    requires_structured_output: result.requires_structured_output ?? false,
    needs_tool_use: result.needs_tool_use ?? false,
    confidence: result.confidence || 0.5,
  };
}

// ========================================
// MAIN HANDLER
// ========================================

Deno.serve(async (req: Request) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const startTime = Date.now();
  let firstTokenTime: number | undefined;

  try {
    const body = await req.json();
    const request = RequestSchema.parse(body) as BrainMessageSendRequest;

    const env = loadEnvConfig();
    const supabaseUrl = env.SUPABASE_URL!;
    const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY!;
    const openaiKey = env.OPENAI_API_KEY!;

    const supabase = createClient(supabaseUrl, supabaseKey);
    const openai = new OpenAI({ apiKey: openaiKey });

    console.log("[brain-message-send] Processing message for project:", request.project_id);

    // ========================================
    // 1. LOAD CONTEXT
    // ========================================
    const projectContext = await loadProjectContext(supabase, request.project_id);
    
    // Get or create thread
    let threadId = request.thread_id;
    if (!threadId) {
      threadId = crypto.randomUUID();
      const now = new Date().toISOString();
      await supabase.from("brain_threads").insert({
        id: threadId,
        project_id: request.project_id,
        user_id: 1, // TODO: get from auth
        title: request.user_prompt.slice(0, 50) + (request.user_prompt.length > 50 ? "..." : ""),
        status: "active",
        messages_count: 0,
        last_message_at: now,
        created_at: now,
        updated_at: now,
      });
    }

    const threadMessages = await loadThreadMessages(supabase, threadId);
    const contextStats = calculateContextStats(projectContext, threadMessages);

    console.log("[brain-message-send] Context loaded:", {
      tokens: contextStats.total_tokens_estimate,
      rules: contextStats.business_rules_count,
      specs: contextStats.flow_specs_count,
      messages: contextStats.thread_messages_count,
    });

    // ========================================
    // 2. ROUTE
    // ========================================
    let routeResult: RouteResult;

    if (request.force_mode) {
      // Forced mode
      const config = getModelConfig({
        mode: request.force_mode,
        model: (request.force_model as BrainModel) || "gpt-4o",
        was_uncertain: false,
        used_classifier: false,
        complexity: 0.5,
        risk_level: "low",
        requires_structured_output: true,
        needs_tool_use: false,
        routing_rules_applied: ["forced_mode"],
        routing_reason: `Modo forçado: ${request.force_mode}`,
      });
      routeResult = {
        mode: request.force_mode,
        model: (request.force_model as BrainModel) || config.model,
        was_uncertain: false,
        used_classifier: false,
        complexity: 0.5,
        risk_level: "low",
        requires_structured_output: true,
        needs_tool_use: false,
        routing_rules_applied: ["forced_mode"],
        routing_reason: `Modo forçado: ${request.force_mode}`,
      };
    } else {
      // Use classifier if enabled and uncertain
      const classifierFn = env.BRAIN_CLASSIFIER_ENABLED 
        ? (p: string, s: ContextStats) => classifyPrompt(openai, p, s)
        : undefined;
      
      routeResult = await route(request.user_prompt, contextStats, classifierFn);
    }

    const modelConfig = getModelConfig(routeResult);
    console.log("[brain-message-send] Route:", formatRouteResult(routeResult));

    // ========================================
    // 3. SAVE USER MESSAGE
    // ========================================
    const userMessageId = crypto.randomUUID();
    const now = new Date().toISOString();
    
    await supabase.from("brain_messages").insert({
      id: userMessageId,
      thread_id: threadId,
      project_id: request.project_id,
      role: "user",
      content: request.user_prompt,
      structured_output: null,
      metadata: {
        mode: routeResult.mode,
        model: "user",
        reasoning_effort: "none",
        text_verbosity: "none",
        routing_reason: "User message",
        latency_ms: 0,
        input_tokens: 0,
        output_tokens: 0,
        used_classifier: false,
        was_uncertain: false,
      },
      created_at: now,
    });

    // ========================================
    // 4. CREATE CANVAS BLOCK (for streaming)
    // ========================================
    const canvasBlockId = crypto.randomUUID();
    await supabase.from("brain_canvas_blocks").insert({
      id: canvasBlockId,
      project_id: request.project_id,
      thread_id: threadId,
      block_type: "brain_chat",
      position_x: 100,
      position_y: 100,
      width: 500,
      height: 400,
      streaming: true,
      content: "",
      mode: routeResult.mode,
      model: routeResult.model,
      created_at: now,
      updated_at: now,
    });

    // ========================================
    // 5. BUILD PROMPT
    // ========================================
    const systemPrompt = getSystemPromptForMode(routeResult.mode);
    
    // Build context summary for the prompt
    const contextSummary = `## CONTEXTO DO PROJETO

**Produto:** ${projectContext.product_profile?.product_name || "Não definido"}
**Tipo:** ${projectContext.product_profile?.product_type || "N/A"}
**Indústria:** ${projectContext.product_profile?.industry || "N/A"}

**Regras de Negócio:** ${contextStats.business_rules_count} aprovadas
**Flow Specs:** ${contextStats.flow_specs_count}
**Personas:** ${contextStats.personas_count}

${contextStats.business_rules_count > 0 ? `### Regras Relevantes
${projectContext.business_rules.slice(0, 5).map(r => `- ${r.rule_name}: ${r.description.slice(0, 100)}...`).join("\n")}` : ""}

${threadMessages.length > 0 ? `### Histórico Recente
${threadMessages.slice(-5).map(m => `[${m.role}]: ${m.content.slice(0, 100)}...`).join("\n")}` : ""}`;

    const messages: OpenAI.ChatCompletionMessageParam[] = [
      { role: "system", content: systemPrompt },
      { role: "user", content: `${contextSummary}\n\n## SOLICITAÇÃO DO USUÁRIO\n\n${request.user_prompt}` },
    ];

    // ========================================
    // 6. CALL LLM WITH STREAMING
    // ========================================
    
    // Setup streaming response
    const encoder = new TextEncoder();
    const stream = new TransformStream();
    const writer = stream.writable.getWriter();

    // Send start event
    const startEvent: BrainStreamEvent = {
      type: "start",
      thread_id: threadId,
      message_id: crypto.randomUUID(),
      mode: routeResult.mode,
      model: routeResult.model,
      canvas_block_id: canvasBlockId,
    };
    await writer.write(encoder.encode(`data: ${JSON.stringify(startEvent)}\n\n`));

    // Call OpenAI
    let fullContent = "";
    let contentIndex = 0;
    let inputTokens = 0;
    let outputTokens = 0;

    // Try with fallback chain
    let currentModel = modelConfig.model;
    let fallbackIndex = 0;
    let success = false;

    while (!success && fallbackIndex <= modelConfig.fallback_chain.length) {
      try {
        // Map model names to actual OpenAI models
        const actualModel = mapModelName(currentModel);
        
        const completion = await openai.chat.completions.create({
          model: actualModel,
          messages,
          temperature: modelConfig.temperature,
          max_tokens: modelConfig.max_output_tokens,
          stream: true,
          response_format: modelConfig.json_schema_name ? { type: "json_object" } : undefined,
        });

        for await (const chunk of completion) {
          const delta = chunk.choices[0]?.delta?.content || "";
          
          if (delta) {
            if (!firstTokenTime) {
              firstTokenTime = Date.now();
            }
            
            fullContent += delta;
            contentIndex++;

            // Send delta event
            const deltaEvent: BrainStreamEvent = {
              type: "delta",
              content: delta,
              index: contentIndex,
            };
            await writer.write(encoder.encode(`data: ${JSON.stringify(deltaEvent)}\n\n`));

            // Update canvas block periodically
            if (contentIndex % 10 === 0) {
              await supabase.from("brain_canvas_blocks")
                .update({ content: fullContent, updated_at: new Date().toISOString() })
                .eq("id", canvasBlockId);
            }
          }

          // Get usage from final chunk
          if (chunk.usage) {
            inputTokens = chunk.usage.prompt_tokens;
            outputTokens = chunk.usage.completion_tokens;
          }
        }

        success = true;
      } catch (error) {
        console.error(`[brain-message-send] Model ${currentModel} failed:`, error);
        
        // Try next model in fallback chain
        if (fallbackIndex < modelConfig.fallback_chain.length) {
          currentModel = modelConfig.fallback_chain[fallbackIndex];
          fallbackIndex++;
          
          const errorEvent: BrainStreamEvent = {
            type: "error",
            error: `Model ${currentModel} failed, trying ${modelConfig.fallback_chain[fallbackIndex - 1]}`,
            failed_model: currentModel as BrainModel,
            fallback_model: modelConfig.fallback_chain[fallbackIndex - 1],
          };
          await writer.write(encoder.encode(`data: ${JSON.stringify(errorEvent)}\n\n`));
        } else {
          throw error;
        }
      }
    }

    // ========================================
    // 7. PARSE OUTPUT & VALIDATE
    // ========================================
    let brainOutput: BrainOutput | null = null;
    
    if (modelConfig.json_schema_name) {
      try {
        const parsed = JSON.parse(fullContent);
        brainOutput = BrainOutputSchema.parse(parsed);
      } catch (parseError) {
        console.error("[brain-message-send] Failed to parse JSON output:", parseError);
        // Create a default output with the raw content
        brainOutput = {
          assistant_response_md: fullContent,
          actions: [],
          warnings: ["Output não estava em formato JSON válido"],
        };
      }
    }

    // ========================================
    // 8. SAVE ASSISTANT MESSAGE
    // ========================================
    const latencyMs = Date.now() - startTime;
    const timeToFirstTokenMs = firstTokenTime ? firstTokenTime - startTime : undefined;
    
    const assistantMessageId = crypto.randomUUID();
    const messageMetadata: BrainMessageMetadata = {
      mode: routeResult.mode,
      model: currentModel as BrainModel,
      reasoning_effort: modelConfig.reasoning_effort,
      text_verbosity: modelConfig.text_verbosity,
      routing_reason: routeResult.routing_reason,
      model_fallback_chain: fallbackIndex > 0 ? modelConfig.fallback_chain.slice(0, fallbackIndex) : undefined,
      latency_ms: latencyMs,
      time_to_first_token_ms: timeToFirstTokenMs,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      used_classifier: routeResult.used_classifier,
      was_uncertain: routeResult.was_uncertain,
    };

    const assistantMessage: BrainMessage = {
      id: assistantMessageId,
      thread_id: threadId,
      project_id: request.project_id,
      role: "assistant",
      content: brainOutput?.assistant_response_md || fullContent,
      structured_output: brainOutput,
      metadata: messageMetadata,
      created_at: new Date().toISOString(),
    };

    await supabase.from("brain_messages").insert(assistantMessage);

    // Update thread
    await supabase.from("brain_threads")
      .update({
        messages_count: threadMessages.length + 2,
        last_message_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", threadId);

    // Finalize canvas block
    await supabase.from("brain_canvas_blocks")
      .update({
        content: brainOutput?.assistant_response_md || fullContent,
        streaming: false,
        updated_at: new Date().toISOString(),
      })
      .eq("id", canvasBlockId);

    // ========================================
    // 9. EXECUTE ACTIONS (if any)
    // ========================================
    if (brainOutput?.actions && brainOutput.actions.length > 0) {
      const actionResults = await executeActions(
        supabase,
        brainOutput.actions as BrainAction[],
        {
          project_id: request.project_id,
          thread_id: threadId,
          canvas_block_id: canvasBlockId,
        }
      );
      
      // Send actions event
      const actionsEvent: BrainStreamEvent = {
        type: "actions",
        actions: brainOutput.actions as BrainAction[],
        results: actionResults,
      };
      await writer.write(encoder.encode(`data: ${JSON.stringify(actionsEvent)}\n\n`));
    }

    // ========================================
    // 10. SEND COMPLETE EVENT
    // ========================================
    const completeEvent: BrainStreamEvent = {
      type: "complete",
      message: assistantMessage,
      output: brainOutput || undefined,
    };
    await writer.write(encoder.encode(`data: ${JSON.stringify(completeEvent)}\n\n`));
    
    // Send metadata event
    const metadataEvent: BrainStreamEvent = {
      type: "metadata",
      metadata: messageMetadata,
    };
    await writer.write(encoder.encode(`data: ${JSON.stringify(metadataEvent)}\n\n`));

    await writer.close();

    console.log("[brain-message-send] Complete:", {
      thread_id: threadId,
      mode: routeResult.mode,
      model: currentModel,
      latency_ms: latencyMs,
      tokens: { input: inputTokens, output: outputTokens },
    });

    return new Response(stream.readable, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    });

  } catch (error) {
    console.error("[brain-message-send] Error:", error);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        message: error instanceof Error ? error.message : String(error) 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
});

// ========================================
// ACTION EXECUTOR
// ========================================

interface ActionContext {
  project_id: number;
  thread_id: string;
  canvas_block_id: string;
}

interface BrainAction {
  action_id: string;
  action_type: string;
  payload: unknown;
  description: string;
  reversible: boolean;
  priority: number;
}

interface ActionResult {
  action_id: string;
  success: boolean;
  message: string;
  data?: unknown;
}

async function executeActions(
  supabase: ReturnType<typeof createClient>,
  actions: BrainAction[],
  context: ActionContext
): Promise<ActionResult[]> {
  const results: ActionResult[] = [];

  // Sort by priority
  const sortedActions = [...actions].sort((a, b) => a.priority - b.priority);

  for (const action of sortedActions) {
    try {
      const result = await executeAction(supabase, action, context);
      results.push(result);
    } catch (error) {
      results.push({
        action_id: action.action_id,
        success: false,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return results;
}

async function executeAction(
  supabase: ReturnType<typeof createClient>,
  action: BrainAction,
  context: ActionContext
): Promise<ActionResult> {
  const { action_id, action_type, payload } = action;

  switch (action_type) {
    case "upsert_brain_flow_plan":
      return await handleUpsertBrainFlowPlan(supabase, action_id, payload as unknown, context);

    case "set_plan_status":
      return await handleSetPlanStatus(supabase, action_id, payload as unknown, context);

    case "upsert_rule":
      return await handleUpsertRule(supabase, action_id, payload as unknown, context);

    case "upsert_spec":
      return await handleUpsertSpec(supabase, action_id, payload as unknown, context);

    default:
      console.log(`[executeAction] Unknown action type: ${action_type}`);
      return {
        action_id,
        success: false,
        message: `Unknown action type: ${action_type}`,
      };
  }
}

// Handler: upsert_brain_flow_plan
async function handleUpsertBrainFlowPlan(
  supabase: ReturnType<typeof createClient>,
  action_id: string,
  payload: unknown,
  context: ActionContext
): Promise<ActionResult> {
  const data = payload as {
    plan_md: string;
    plan_json: unknown;
    flow_key?: string;
  };

  if (!data.plan_md || !data.plan_json) {
    return { action_id, success: false, message: "Missing plan_md or plan_json" };
  }

  const now = new Date().toISOString();

  // Check if plan exists
  const { data: existingPlan } = await supabase
    .from("brain_flow_plans")
    .select("id, plan_version, status")
    .eq("canvas_block_id", context.canvas_block_id)
    .single();

  if (existingPlan) {
    // Don't update if already approved/building/built
    if (["approved", "building", "built"].includes(existingPlan.status)) {
      return {
        action_id,
        success: false,
        message: `Cannot update plan with status '${existingPlan.status}'`,
      };
    }

    // Save version history
    await supabase.from("brain_flow_plan_versions").insert({
      id: crypto.randomUUID(),
      plan_id: existingPlan.id,
      version: existingPlan.plan_version,
      plan_md: data.plan_md,
      plan_json: data.plan_json,
      created_at: now,
      change_summary: "Atualização via Brain",
    });

    // Update plan
    await supabase
      .from("brain_flow_plans")
      .update({
        plan_md: data.plan_md,
        plan_json: data.plan_json,
        plan_version: existingPlan.plan_version + 1,
        status: "revised",
        flow_key: data.flow_key,
        updated_at: now,
      })
      .eq("id", existingPlan.id);

    return {
      action_id,
      success: true,
      message: `Plan updated to v${existingPlan.plan_version + 1}`,
      data: { plan_id: existingPlan.id, version: existingPlan.plan_version + 1 },
    };
  } else {
    // Create new plan
    const planId = crypto.randomUUID();
    await supabase.from("brain_flow_plans").insert({
      id: planId,
      project_id: context.project_id,
      thread_id: context.thread_id,
      canvas_block_id: context.canvas_block_id,
      flow_key: data.flow_key,
      status: "draft",
      plan_version: 1,
      plan_md: data.plan_md,
      plan_json: data.plan_json,
      created_at: now,
      updated_at: now,
    });

    // Link plan to canvas block
    await supabase
      .from("brain_canvas_blocks")
      .update({ plan_id: planId, updated_at: now })
      .eq("id", context.canvas_block_id);

    return {
      action_id,
      success: true,
      message: "Plan created (v1)",
      data: { plan_id: planId, version: 1 },
    };
  }
}

// Handler: set_plan_status
async function handleSetPlanStatus(
  supabase: ReturnType<typeof createClient>,
  action_id: string,
  payload: unknown,
  context: ActionContext
): Promise<ActionResult> {
  const data = payload as { status: string; plan_id?: string };

  if (!data.status) {
    return { action_id, success: false, message: "Missing status" };
  }

  // Note: We intentionally DO NOT allow setting status to 'approved', 'building', or 'built'
  // via actions. These statuses can ONLY be set via the approve_and_build endpoint (server gate).
  const allowedStatuses = ["draft", "revised", "cancelled"];
  if (!allowedStatuses.includes(data.status)) {
    return {
      action_id,
      success: false,
      message: `Cannot set status to '${data.status}' via action. Use approve_and_build endpoint for approval.`,
    };
  }

  const query = data.plan_id
    ? supabase.from("brain_flow_plans").update({ status: data.status, updated_at: new Date().toISOString() }).eq("id", data.plan_id)
    : supabase.from("brain_flow_plans").update({ status: data.status, updated_at: new Date().toISOString() }).eq("canvas_block_id", context.canvas_block_id);

  const { error } = await query;

  if (error) {
    return { action_id, success: false, message: error.message };
  }

  return { action_id, success: true, message: `Plan status set to '${data.status}'` };
}

// Handler: upsert_rule
async function handleUpsertRule(
  supabase: ReturnType<typeof createClient>,
  action_id: string,
  payload: unknown,
  context: ActionContext
): Promise<ActionResult> {
  const data = payload as {
    rule_key?: string;
    rule_name: string;
    description: string;
    rule_type?: string;
    priority?: number;
  };

  const now = new Date().toISOString();

  const { data: inserted, error } = await supabase
    .from("business_rules")
    .upsert(
      {
        project_id: context.project_id,
        rule_key: data.rule_key || `rule_${Date.now()}`,
        rule_name: data.rule_name,
        description: data.description,
        rule_type: data.rule_type || "business",
        priority: data.priority || 50,
        status: "draft",
        created_at: now,
        updated_at: now,
      },
      { onConflict: "project_id,rule_key" }
    )
    .select()
    .single();

  if (error) {
    return { action_id, success: false, message: error.message };
  }

  return {
    action_id,
    success: true,
    message: `Rule '${data.rule_name}' upserted`,
    data: { rule_id: inserted?.id },
  };
}

// Handler: upsert_spec
async function handleUpsertSpec(
  supabase: ReturnType<typeof createClient>,
  action_id: string,
  payload: unknown,
  context: ActionContext
): Promise<ActionResult> {
  const data = payload as {
    spec_key?: string;
    spec_name: string;
    spec_content: unknown;
    spec_type?: string;
  };

  const now = new Date().toISOString();

  // Set previous latest to false
  if (data.spec_key) {
    await supabase
      .from("flow_specs")
      .update({ is_latest: false })
      .eq("project_id", context.project_id)
      .eq("spec_key", data.spec_key);
  }

  const { data: inserted, error } = await supabase
    .from("flow_specs")
    .insert({
      project_id: context.project_id,
      spec_key: data.spec_key || `spec_${Date.now()}`,
      spec_name: data.spec_name,
      spec_content: data.spec_content,
      spec_type: data.spec_type || "flow",
      is_latest: true,
      version: 1,
      created_at: now,
      updated_at: now,
    })
    .select()
    .single();

  if (error) {
    return { action_id, success: false, message: error.message };
  }

  return {
    action_id,
    success: true,
    message: `Spec '${data.spec_name}' created`,
    data: { spec_id: inserted?.id },
  };
}

// ========================================
// HELPER: Map model names to actual OpenAI models
// ========================================

function mapModelName(model: BrainModel): string {
  const modelMap: Record<string, string> = {
    // Future models -> current equivalents
    "gpt-5.2": "gpt-4o",
    "gpt-5.2-pro": "o1",
    "gpt-5-mini": "gpt-4o-mini",
    "gpt-5-nano": "gpt-4o-mini",
    "gpt-4.1": "gpt-4o",
    "gpt-4.1-mini": "gpt-4o-mini",
    "gpt-4.1-nano": "gpt-4o-mini",
    // Current models
    "gpt-4o": "gpt-4o",
    "gpt-4o-mini": "gpt-4o-mini",
    "o3": "o1", // o3 not yet available
    "o3-mini": "o1-mini", // o3-mini not yet available
    "o1": "o1",
    "o1-mini": "o1-mini",
  };
  
  return modelMap[model] || "gpt-4o";
}


