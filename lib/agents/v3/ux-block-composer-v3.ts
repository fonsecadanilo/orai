/**
 * Agent 5: UX Block Composer v3.1 (Adaptativo)
 * 
 * Responsabilidades:
 * - Consultar biblioteca ux_blocks
 * - ADAPTAR blocos (NUNCA copiar literalmente)
 * - Aplicar regras de adaptação por contexto
 * - Gerar subnós hierárquicos
 * 
 * REGRA PRINCIPAL: O agente NUNCA copia blocos da biblioteca literalmente.
 * Sempre adapta conforme: persona, page_key, intent, stage, inputs
 */

import { supabase } from "@/lib/supabase/client";
import type {
  UXBlockComposerV3Request,
  UXBlockComposerV3Response,
  AdaptedUXBlockV3,
  ProductContext,
  RoleDefinition,
  SynthesizedFlow,
  UXBlockInput,
} from "./types";
import type { AgentError } from "../types";

const EDGE_FUNCTION_URL = "v3-ux-block-composer-v3";

/**
 * V3.1: Tipos semânticos válidos
 * 
 * IMPORTANTE: O Flow Synthesizer agora retorna semantic_type diretamente.
 * Este mapeamento é apenas fallback para compatibilidade com flows antigos.
 */
const VALID_SEMANTIC_TYPES_V3 = new Set([
  "trigger",
  "action",
  "condition",
  "form",
  "choice",
  "option_choice",
  "feedback_success",
  "feedback_error",
  "end_success",
  "end_error",
  "end_neutral",
  "background_action",
  "delayed_action",
  "insight_branch",
  "configuration_matrix",
  "retry",
  "fallback",
  "loopback",
]);

/**
 * V3.1: Mapeamento legado (fallback) - APENAS para step_type antigos
 */
const LEGACY_STEP_TYPE_MAP: Record<string, string> = {
  "entry_point": "trigger",
  "exit_point": "end_neutral",
  "success_state": "end_success",
  "error_state": "end_error",
  "form_input": "form",
  "decision_point": "condition",
  "user_action": "action",
  "system_action": "background_action",
  "api_call": "background_action",
  "data_transform": "action",
  "validation": "condition",
  "redirect": "action",
  "notification": "feedback_success",
};

/**
 * V3.1: Resolve o tipo do nó priorizando semantic_type
 * 
 * Prioridade:
 * 1. semantic_type (se for válido V3.1)
 * 2. step_type mapeado (legado)
 * 3. Inferência por padrões (último recurso)
 * 4. HARD FAIL se nenhum funcionar (não retorna "action" cegamente)
 */
function resolveNodeType(step: { semantic_type?: string; step_type?: string; title?: string }): string {
  // 1. Se tem semantic_type válido, usar diretamente
  if (step.semantic_type && VALID_SEMANTIC_TYPES_V3.has(step.semantic_type)) {
    return step.semantic_type;
  }
  
  // 2. Se tem step_type, mapear via legado
  if (step.step_type) {
    if (VALID_SEMANTIC_TYPES_V3.has(step.step_type)) {
      return step.step_type;
    }
    if (LEGACY_STEP_TYPE_MAP[step.step_type]) {
      return LEGACY_STEP_TYPE_MAP[step.step_type];
    }
  }
  
  // 3. Inferência por padrões no título/tipo
  const content = `${step.title || ""} ${step.semantic_type || ""} ${step.step_type || ""}`.toLowerCase();
  
  if (/\b(trigger|start|begin|entry|landing|initial)\b/.test(content)) return "trigger";
  if (/\b(form|input|login|cadastro|register|signup|checkout|payment|email|password)\b/.test(content)) return "form";
  if (/\b(condition|if|check|verify|valid|whether)\b/.test(content)) return "condition";
  if (/\b(choice|choose|select|option|method|pick)\b/.test(content)) return "choice";
  if (/\b(end|final|complete|finish).*\b(success|ok|done)\b/.test(content)) return "end_success";
  if (/\b(end|final).*\b(error|fail)\b/.test(content)) return "end_error";
  if (/\b(success|confirm|welcome|obrigado|thank)\b/.test(content)) return "feedback_success";
  if (/\b(error|erro|fail|invalid|wrong)\b/.test(content)) return "feedback_error";
  if (/\b(process|load|api|fetch|async|wait|aguarda)\b/.test(content)) return "background_action";
  if (/\b(retry|tentar|novamente)\b/.test(content)) return "retry";
  if (/\b(back|voltar|return|loopback)\b/.test(content)) return "loopback";
  if (/\b(fallback|alternativ)\b/.test(content)) return "fallback";
  
  // 4. LOG WARNING e retornar action (mas isso será pego pelo Type Hard Gate)
  console.warn(`[UX Block Composer] FALLBACK TO ACTION: could not resolve type for step: ${JSON.stringify(step)}`);
  return "action";
}

// Manter função antiga para compatibilidade (agora usa resolveNodeType internamente)
function mapStepTypeToV3Type(stepType: string): string {
  return resolveNodeType({ step_type: stepType });
}

/**
 * Compõe blocos UX adaptados para um fluxo
 */
export async function composeUXBlocksV3(
  request: UXBlockComposerV3Request
): Promise<UXBlockComposerV3Response> {
  console.log("[Agent 5: UX Block Composer] Compondo blocos...");

  // Normalizar dados de entrada
  const steps = request.synthesized_flow?.steps || [];
  const productContext = request.product_context || {};
  
  // V3.1: Log semantic types being received
  console.log("[UX Block Composer CLIENT] Received steps with types:");
  steps.forEach((step, idx) => {
    const resolvedType = resolveNodeType({
      semantic_type: (step as any).semantic_type,
      step_type: step.step_type,
      title: step.title,
    });
    console.log(`  [${idx}] step_id=${step.step_id}, semantic_type=${(step as any).semantic_type || 'N/A'}, step_type=${step.step_type || 'N/A'}, resolved=${resolvedType}, title=${step.title}`);
  });
  
  if (steps.length === 0) {
    console.warn("[UX Block Composer] Fluxo sem steps - retornando blocos vazios");
    return {
      success: true,
      composed_blocks: [],
      blocks_from_library: 0,
      blocks_generated: 0,
      adaptation_summary: {
        total_adaptations: 0,
        by_context: {},
      },
      message: "Nenhum step para compor blocos",
    };
  }

  // V3.1: Preparar rich_nodes com semantic_type resolvido
  const richNodes = steps.map(step => {
    const stepAny = step as any;
    const resolvedType = resolveNodeType({
      semantic_type: stepAny.semantic_type,
      step_type: step.step_type,
      title: step.title,
    });
    
    return {
      node_id: step.step_id || `step_${Math.random().toString(36).slice(2, 9)}`,
      node_type: resolvedType,
      semantic_type: resolvedType, // V3.1: Incluir semantic_type explícito
      original_step_type: step.step_type, // Preserve original for reference
      title: step.title || "Step",
      description: step.description,
      group_label: stepAny.group_label || "Etapa Principal", // V3.1: Group label
      user_intent: stepAny.user_intent,
      system_behavior: stepAny.system_behavior,
      impact_level: step.is_critical ? "high" : (stepAny.metadata?.impact_level || "medium"),
      inputs: step.inputs, // Pass through inputs from Flow Synthesizer
      suggested_edges: stepAny.suggested_edges, // V3.1: Edge hints
      error_cases: stepAny.error_cases, // V3.1: Error cases
    };
  });

  const { data, error } = await supabase.functions.invoke<UXBlockComposerV3Response>(
    EDGE_FUNCTION_URL,
    {
      body: {
        project_id: request.project_id,
        user_id: request.user_id,
        rich_nodes: richNodes,
        product_context: {
          product_name: productContext.product_name || "Produto",
          product_type: productContext.product_type || "saas",
          industry: productContext.target_audience || "general",
        },
        user_role: {
          role_id: request.primary_role || "user",
          role_name: request.primary_role || "user",
        },
      },
    }
  );

  if (error) {
    console.error("[UX Block Composer] Erro:", error);
    throw {
      code: "EDGE_FUNCTION_ERROR",
      message: error.message || "Erro ao conectar com o compositor de blocos UX",
      details: error,
    } as AgentError;
  }

  if (!data) {
    throw {
      code: "EMPTY_RESPONSE",
      message: "Resposta vazia do compositor de blocos UX",
    } as AgentError;
  }

  if (!data.success) {
    throw {
      code: "AGENT_ERROR",
      message: data.message || "Erro ao compor blocos UX",
    } as AgentError;
  }

  console.log("[UX Block Composer] Composição completa:", {
    blocks_count: data.composed_blocks?.length,
    from_library: data.blocks_from_library,
    generated: data.blocks_generated,
  });

  return data;
}

/**
 * Busca blocos relevantes na biblioteca
 */
export async function searchLibraryBlocks(options: {
  useCases?: string[];
  archetype?: string;
  searchQuery?: string;
  limit?: number;
}): Promise<{ id: string; label: string; semantic_type: string; intent: string }[]> {
  let query = supabase
    .from("ux_blocks")
    .select("id, label, archetype, metadata");

  if (options.useCases && options.useCases.length > 0) {
    query = query.overlaps("use_cases", options.useCases);
  }

  if (options.archetype) {
    query = query.eq("archetype", options.archetype);
  }

  if (options.searchQuery) {
    query = query.or(
      `label.ilike.%${options.searchQuery}%,description.ilike.%${options.searchQuery}%`
    );
  }

  const { data, error } = await query.limit(options.limit || 20);

  if (error || !data) {
    return [];
  }

  return data.map(block => ({
    id: block.id,
    label: block.label,
    semantic_type: block.archetype || "generic",
    intent: (block.metadata as any)?.intent || "general",
  }));
}

/**
 * Adapta um bloco da biblioteca para o contexto específico
 * 
 * IMPORTANTE: Esta função NUNCA retorna o bloco original.
 * Sempre aplica adaptações baseadas no contexto.
 */
export function adaptBlockForContext(
  originalBlock: Partial<AdaptedUXBlockV3>,
  context: {
    productType: ProductContext["product_type"];
    roleId: string;
    pageKey?: string;
    intent?: string;
  }
): AdaptedUXBlockV3 {
  const adaptedBlock: AdaptedUXBlockV3 = {
    block_id: `adapted_${originalBlock.block_id || Date.now()}`,
    original_block_id: originalBlock.block_id,
    adapted: true,
    block_type: originalBlock.block_type || "form",
    title: originalBlock.title || "Bloco Adaptado",
    input_fields: [],
    actions: [],
    impact_level: originalBlock.impact_level || "medium",
    adapted_for_intent: context.intent,
    adapted_for_page_key: context.pageKey,
  };

  // Adaptar inputs baseado no tipo de produto
  let inputs = [...(originalBlock.input_fields || [])];

  // Fintech: adicionar validações extras
  if (context.productType === "fintech") {
    inputs = inputs.map(input => {
      if (input.field_type === "email") {
        return {
          ...input,
          validation_rules: [...(input.validation_rules || []), "corporate_email_preferred"],
          tooltip: input.tooltip || "Use seu email corporativo para maior segurança",
        };
      }
      if (input.field_name?.toLowerCase().includes("cpf")) {
        return {
          ...input,
          validation_rules: [...(input.validation_rules || []), "cpf_valid", "cpf_unique"],
        };
      }
      return input;
    });
  }

  // Healthcare: adicionar avisos de privacidade
  if (context.productType === "healthtech") {
    inputs = inputs.map(input => ({
      ...input,
      tooltip: input.tooltip || "Seus dados são protegidos conforme LGPD/HIPAA",
    }));
  }

  // Admin: adicionar campos extras
  if (context.roleId === "admin") {
    inputs.push({
      field_name: "internal_notes",
      field_type: "textarea",
      label: "Notas Internas (Admin)",
      required: false,
      validation_rules: [],
    });
  }

  adaptedBlock.input_fields = inputs;

  // Adaptar ações
  const actions = [...(originalBlock.actions || [])];
  
  // Garantir que há pelo menos uma ação primária
  if (!actions.some(a => a.action_type === "primary")) {
    actions.push({
      action_id: "submit",
      label: "Confirmar",
      action_type: "primary",
    });
  }

  // Adicionar ação de cancelar se não existir
  if (!actions.some(a => a.action_type === "secondary" || a.label.toLowerCase().includes("cancel"))) {
    actions.push({
      action_id: "cancel",
      label: "Cancelar",
      action_type: "secondary",
    });
  }

  adaptedBlock.actions = actions;

  return adaptedBlock;
}

/**
 * Gera inputs padrão para um tipo de formulário
 */
export function generateDefaultInputs(
  formType: string,
  productType: ProductContext["product_type"]
): UXBlockInput[] {
  const baseInputs: Record<string, UXBlockInput[]> = {
    login: [
      {
        field_name: "email",
        field_type: "email",
        label: "Email",
        placeholder: "seu@email.com",
        required: true,
        validation_rules: ["email"],
      },
      {
        field_name: "password",
        field_type: "password",
        label: "Senha",
        placeholder: "••••••••",
        required: true,
        validation_rules: ["min_length:8"],
      },
    ],
    signup: [
      {
        field_name: "name",
        field_type: "text",
        label: "Nome completo",
        placeholder: "Seu nome",
        required: true,
        validation_rules: ["min_length:2"],
      },
      {
        field_name: "email",
        field_type: "email",
        label: "Email",
        placeholder: "seu@email.com",
        required: true,
        validation_rules: ["email"],
      },
      {
        field_name: "password",
        field_type: "password",
        label: "Senha",
        placeholder: "Mínimo 8 caracteres",
        required: true,
        validation_rules: ["min_length:8", "has_uppercase", "has_number"],
      },
    ],
    contact: [
      {
        field_name: "name",
        field_type: "text",
        label: "Nome",
        required: true,
        validation_rules: [],
      },
      {
        field_name: "email",
        field_type: "email",
        label: "Email",
        required: true,
        validation_rules: ["email"],
      },
      {
        field_name: "message",
        field_type: "textarea",
        label: "Mensagem",
        required: true,
        validation_rules: ["min_length:10"],
      },
    ],
  };

  let inputs = baseInputs[formType] || [];

  // Adicionar campos específicos por tipo de produto
  if (productType === "fintech" && formType === "signup") {
    inputs.push({
      field_name: "cpf",
      field_type: "text",
      label: "CPF",
      placeholder: "000.000.000-00",
      required: true,
      validation_rules: ["cpf_valid"],
    });
  }

  if (productType === "e-commerce" && formType === "signup") {
    inputs.push({
      field_name: "phone",
      field_type: "tel",
      label: "Telefone",
      placeholder: "(00) 00000-0000",
      required: false,
      validation_rules: ["phone_br"],
    });
  }

  return inputs;
}

/**
 * Compõe blocos localmente (sem chamada de API)
 * Útil para preview rápido
 */
export function composeBlocksLocally(
  flow: SynthesizedFlow,
  productContext: ProductContext,
  primaryRole: string
): AdaptedUXBlockV3[] {
  return flow.steps.map(step => {
    const block: AdaptedUXBlockV3 = {
      block_id: `local_${step.step_id}`,
      adapted: true,
      block_type: step.step_type,
      title: step.title,
      description: step.description,
      input_fields: step.step_type === "form" 
        ? generateDefaultInputs("contact", productContext.product_type)
        : [],
      actions: [
        {
          action_id: "continue",
          label: "Continuar",
          action_type: "primary",
        },
      ],
      impact_level: step.is_critical ? "high" : "medium",
      role_scope: step.role_required,
      adapted_for_page_key: step.page_key,
    };

    return adaptBlockForContext(block, {
      productType: productContext.product_type,
      roleId: primaryRole,
      pageKey: step.page_key,
    });
  });
}
