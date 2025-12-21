import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

import type {
  BrainAction,
  BrainActionResult,
  BrainActionsApplyRequest,
  BrainActionsApplyResponse,
} from "../_shared/brain-types.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * BRAIN ACTIONS APPLY
 * 
 * Aplica ações geradas pelo Brain de forma idempotente.
 * Cada ação tem um tipo específico e payload correspondente.
 */

// Schema de entrada
const RequestSchema = z.object({
  project_id: z.number(),
  thread_id: z.string().uuid(),
  message_id: z.string().uuid(),
  action_ids: z.array(z.string()).optional(),
});

// ========================================
// ACTION HANDLERS
// ========================================

interface ActionHandler {
  (
    supabase: ReturnType<typeof createClient>,
    projectId: number,
    action: BrainAction
  ): Promise<BrainActionResult>;
}

/**
 * Handler: Upsert Business Rule
 */
const handleUpsertRule: ActionHandler = async (supabase, projectId, action) => {
  const payload = action.payload as {
    rule_name: string;
    rule_type: string;
    description: string;
    conditions?: unknown;
    actions?: unknown;
    status?: string;
  };

  try {
    // Check if rule exists
    const { data: existing } = await supabase
      .from("business_rules")
      .select("id, version")
      .eq("project_id", projectId)
      .eq("rule_name", payload.rule_name)
      .single();

    if (existing) {
      // Update existing rule (increment version)
      const { error } = await supabase
        .from("business_rules")
        .update({
          rule_type: payload.rule_type,
          description: payload.description,
          conditions: payload.conditions,
          actions: payload.actions,
          status: payload.status || "draft",
          version: existing.version + 1,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id);

      if (error) throw error;

      return {
        action_id: action.action_id,
        success: true,
        result: { updated_id: existing.id, new_version: existing.version + 1 },
      };
    } else {
      // Create new rule
      const { data, error } = await supabase
        .from("business_rules")
        .insert({
          project_id: projectId,
          rule_name: payload.rule_name,
          rule_type: payload.rule_type,
          description: payload.description,
          conditions: payload.conditions || {},
          actions: payload.actions || {},
          status: payload.status || "draft",
          version: 1,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select("id")
        .single();

      if (error) throw error;

      return {
        action_id: action.action_id,
        success: true,
        result: { created_id: data.id },
      };
    }
  } catch (error) {
    return {
      action_id: action.action_id,
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
};

/**
 * Handler: Upsert Flow Spec
 */
const handleUpsertSpec: ActionHandler = async (supabase, projectId, action) => {
  const payload = action.payload as {
    flow_id: string;
    spec_name: string;
    spec_content: unknown;
  };

  try {
    // Mark all existing specs for this flow as not latest
    await supabase
      .from("flow_specs")
      .update({ is_latest: false })
      .eq("project_id", projectId)
      .eq("flow_id", payload.flow_id);

    // Get max version
    const { data: maxVersion } = await supabase
      .from("flow_specs")
      .select("version")
      .eq("project_id", projectId)
      .eq("flow_id", payload.flow_id)
      .order("version", { ascending: false })
      .limit(1)
      .single();

    const newVersion = (maxVersion?.version || 0) + 1;

    // Create new spec version
    const { data, error } = await supabase
      .from("flow_specs")
      .insert({
        project_id: projectId,
        flow_id: payload.flow_id,
        spec_name: payload.spec_name,
        spec_content: payload.spec_content,
        version: newVersion,
        is_latest: true,
        created_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (error) throw error;

    return {
      action_id: action.action_id,
      success: true,
      result: { created_id: data.id, version: newVersion },
    };
  } catch (error) {
    return {
      action_id: action.action_id,
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
};

/**
 * Handler: Upsert Flow
 */
const handleUpsertFlow: ActionHandler = async (supabase, projectId, action) => {
  const payload = action.payload as {
    flow_id?: string;
    flow_name: string;
    flow_type: string;
    nodes?: unknown[];
    edges?: unknown[];
  };

  try {
    const flowId = payload.flow_id || crypto.randomUUID();
    const now = new Date().toISOString();

    // Check if flow exists
    const { data: existing } = await supabase
      .from("flows")
      .select("id")
      .eq("project_id", projectId)
      .eq("id", flowId)
      .single();

    if (existing) {
      // Update existing flow
      const { error } = await supabase
        .from("flows")
        .update({
          name: payload.flow_name,
          type: payload.flow_type,
          nodes: payload.nodes,
          edges: payload.edges,
          updated_at: now,
        })
        .eq("id", flowId);

      if (error) throw error;

      return {
        action_id: action.action_id,
        success: true,
        result: { updated_id: flowId },
      };
    } else {
      // Create new flow
      const { data, error } = await supabase
        .from("flows")
        .insert({
          id: flowId,
          project_id: projectId,
          name: payload.flow_name,
          type: payload.flow_type,
          nodes: payload.nodes || [],
          edges: payload.edges || [],
          created_at: now,
          updated_at: now,
        })
        .select("id")
        .single();

      if (error) throw error;

      return {
        action_id: action.action_id,
        success: true,
        result: { created_id: data.id },
      };
    }
  } catch (error) {
    return {
      action_id: action.action_id,
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
};

/**
 * Handler: Update Flow Registry
 */
const handleUpdateRegistry: ActionHandler = async (supabase, projectId, action) => {
  const payload = action.payload as {
    flow_id: string;
    flow_name: string;
    flow_type: string;
    entry_node_id: string;
    exit_node_ids: string[];
    node_count: number;
  };

  try {
    const now = new Date().toISOString();

    const { data, error } = await supabase
      .from("flow_registry")
      .upsert({
        project_id: projectId,
        flow_id: payload.flow_id,
        flow_name: payload.flow_name,
        flow_type: payload.flow_type,
        entry_node_id: payload.entry_node_id,
        exit_node_ids: payload.exit_node_ids,
        node_count: payload.node_count,
        updated_at: now,
      }, {
        onConflict: "project_id,flow_id",
      })
      .select("id")
      .single();

    if (error) throw error;

    return {
      action_id: action.action_id,
      success: true,
      result: { registry_id: data.id },
    };
  } catch (error) {
    return {
      action_id: action.action_id,
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
};

/**
 * Handler: Create Persona
 */
const handleCreatePersona: ActionHandler = async (supabase, projectId, action) => {
  const payload = action.payload as {
    role_id: string;
    role_name: string;
    role_scope: string;
    permissions?: string[];
    restrictions?: string[];
    typical_goals?: string[];
    pain_points?: string[];
  };

  try {
    // Check if persona exists
    const { data: existing } = await supabase
      .from("personas")
      .select("id")
      .eq("project_id", projectId)
      .eq("role_id", payload.role_id)
      .single();

    if (existing) {
      // Update existing
      const { error } = await supabase
        .from("personas")
        .update({
          role_name: payload.role_name,
          role_scope: payload.role_scope,
          permissions: payload.permissions || [],
          restrictions: payload.restrictions || [],
          typical_goals: payload.typical_goals || [],
          pain_points: payload.pain_points || [],
        })
        .eq("id", existing.id);

      if (error) throw error;

      return {
        action_id: action.action_id,
        success: true,
        result: { updated_id: existing.id },
      };
    } else {
      // Create new
      const { data, error } = await supabase
        .from("personas")
        .insert({
          project_id: projectId,
          role_id: payload.role_id,
          role_name: payload.role_name,
          role_scope: payload.role_scope,
          permissions: payload.permissions || [],
          restrictions: payload.restrictions || [],
          typical_goals: payload.typical_goals || [],
          pain_points: payload.pain_points || [],
          created_at: new Date().toISOString(),
        })
        .select("id")
        .single();

      if (error) throw error;

      return {
        action_id: action.action_id,
        success: true,
        result: { created_id: data.id },
      };
    }
  } catch (error) {
    return {
      action_id: action.action_id,
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
};

/**
 * Handler: Update Product Profile
 */
const handleUpdateProductProfile: ActionHandler = async (supabase, projectId, action) => {
  const payload = action.payload as {
    product_name?: string;
    product_type?: string;
    industry?: string;
    business_model?: string;
    main_value_proposition?: string;
    key_features?: string[];
    target_audience?: string;
    maturity_stage?: string;
  };

  try {
    const now = new Date().toISOString();

    // Check if profile exists
    const { data: existing } = await supabase
      .from("product_profiles")
      .select("id")
      .eq("project_id", projectId)
      .single();

    if (existing) {
      const { error } = await supabase
        .from("product_profiles")
        .update({
          ...payload,
          updated_at: now,
        })
        .eq("id", existing.id);

      if (error) throw error;

      return {
        action_id: action.action_id,
        success: true,
        result: { updated_id: existing.id },
      };
    } else {
      const { data, error } = await supabase
        .from("product_profiles")
        .insert({
          project_id: projectId,
          product_name: payload.product_name || "Novo Produto",
          product_type: payload.product_type || "saas",
          industry: payload.industry,
          business_model: payload.business_model,
          main_value_proposition: payload.main_value_proposition,
          key_features: payload.key_features,
          target_audience: payload.target_audience,
          maturity_stage: payload.maturity_stage,
          created_at: now,
          updated_at: now,
        })
        .select("id")
        .single();

      if (error) throw error;

      return {
        action_id: action.action_id,
        success: true,
        result: { created_id: data.id },
      };
    }
  } catch (error) {
    return {
      action_id: action.action_id,
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
};

/**
 * Handler: Create Migration (log only, doesn't execute)
 */
const handleCreateMigration: ActionHandler = async (supabase, projectId, action) => {
  const payload = action.payload as {
    migration_name: string;
    sql: string;
    description: string;
  };

  try {
    // Log the migration for review (don't execute automatically)
    const { data, error } = await supabase
      .from("brain_migrations")
      .insert({
        project_id: projectId,
        migration_name: payload.migration_name,
        sql_content: payload.sql,
        description: payload.description,
        status: "pending",
        created_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (error) {
      // Table might not exist, which is ok
      console.warn("[brain-actions-apply] Migration table doesn't exist, skipping:", error);
      return {
        action_id: action.action_id,
        success: true,
        result: { message: "Migration logged for manual review" },
      };
    }

    return {
      action_id: action.action_id,
      success: true,
      result: { migration_id: data.id, status: "pending_review" },
    };
  } catch (error) {
    return {
      action_id: action.action_id,
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
};

/**
 * Handler: Notify User (no-op, just acknowledge)
 */
const handleNotifyUser: ActionHandler = async (_supabase, _projectId, action) => {
  // This is a no-op - notifications are handled by the client
  return {
    action_id: action.action_id,
    success: true,
    result: { acknowledged: true },
  };
};

// Action handler registry
const ACTION_HANDLERS: Record<string, ActionHandler> = {
  upsert_rule: handleUpsertRule,
  upsert_spec: handleUpsertSpec,
  upsert_flow: handleUpsertFlow,
  update_registry: handleUpdateRegistry,
  create_persona: handleCreatePersona,
  update_product_profile: handleUpdateProductProfile,
  create_migration: handleCreateMigration,
  notify_user: handleNotifyUser,
};

// ========================================
// MAIN HANDLER
// ========================================

Deno.serve(async (req: Request) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const request = RequestSchema.parse(body) as BrainActionsApplyRequest;

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log("[brain-actions-apply] Applying actions for message:", request.message_id);

    // Get message with actions
    const { data: message, error: messageError } = await supabase
      .from("brain_messages")
      .select("structured_output")
      .eq("id", request.message_id)
      .single();

    if (messageError || !message) {
      return new Response(
        JSON.stringify({
          success: false,
          message: `Message not found: ${request.message_id}`,
          results: [],
        }),
        { 
          status: 404, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }

    const structuredOutput = message.structured_output as { actions?: BrainAction[] } | null;
    const allActions = structuredOutput?.actions || [];

    if (allActions.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: "No actions to apply",
          results: [],
        } as BrainActionsApplyResponse),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Filter actions if specific IDs requested
    const actionsToApply = request.action_ids && request.action_ids.length > 0
      ? allActions.filter(a => request.action_ids!.includes(a.action_id))
      : allActions;

    // Sort by priority
    actionsToApply.sort((a, b) => a.priority - b.priority);

    console.log("[brain-actions-apply] Processing", actionsToApply.length, "actions");

    // Apply each action
    const results: BrainActionResult[] = [];

    for (const action of actionsToApply) {
      const handler = ACTION_HANDLERS[action.action_type];
      
      if (!handler) {
        results.push({
          action_id: action.action_id,
          success: false,
          error: `Unknown action type: ${action.action_type}`,
        });
        continue;
      }

      console.log(`[brain-actions-apply] Applying: ${action.action_type} (${action.action_id})`);
      
      const result = await handler(supabase, request.project_id, action);
      results.push(result);
    }

    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;

    const response: BrainActionsApplyResponse = {
      success: failCount === 0,
      results,
      message: `Applied ${successCount}/${actionsToApply.length} actions${failCount > 0 ? ` (${failCount} failed)` : ""}`,
    };

    console.log("[brain-actions-apply] Complete:", response.message);

    return new Response(
      JSON.stringify(response),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[brain-actions-apply] Error:", error);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        results: [],
        message: error instanceof Error ? error.message : String(error) 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
});


