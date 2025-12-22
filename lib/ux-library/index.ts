/**
 * Biblioteca UX Adaptativa v3.1
 * 
 * Sistema de composição de blocos UX que NUNCA copia literalmente.
 * Sempre adapta conforme: persona, page_key, intent, stage, inputs.
 */

import { supabase } from "@/lib/supabase/client";
import type { 
  MainNodeType,
  InputField,
  NodeAction,
  FeedbackMessage,
} from "@/lib/schemas/nodeTypesV3";

// ========================================
// TIPOS
// ========================================

export interface UXBlock {
  id: string;
  label: string;
  description: string;
  archetype: string;
  use_cases: string[];
  semantic_flow: {
    inputs?: InputField[];
    actions?: NodeAction[];
    validations?: string[];
    feedback?: FeedbackMessage[];
  };
  metadata?: Record<string, unknown>;
}

export interface AdaptationContext {
  persona: string;
  page_key: string;
  intent: string;
  stage: "entry" | "middle" | "exit";
  product_type?: string;
  role_scope?: string;
}

export interface AdaptedBlock {
  block_id: string;
  original_block_id?: string;
  adapted: boolean;
  adaptation_notes: string[];
  inputs: InputField[];
  actions: NodeAction[];
  feedback?: FeedbackMessage[];
  tooltip?: string;
  validation_summary: string[];
}

// ========================================
// REGRAS DE ADAPTAÇÃO
// ========================================

interface AdaptationRule {
  id: string;
  condition: (context: AdaptationContext, block: UXBlock) => boolean;
  apply: (inputs: InputField[], context: AdaptationContext) => InputField[];
}

const ADAPTATION_RULES: AdaptationRule[] = [
  // Regra: Em fintech, campos de email devem ter validação extra
  {
    id: "fintech_email_validation",
    condition: (ctx) => ctx.product_type === "fintech",
    apply: (inputs) => inputs.map(input => {
      if (input.field_type === "email") {
        return {
          ...input,
          validation_rules: [...(input.validation_rules || []), "corporate_email_preferred"],
          tooltip: "Recomendamos usar seu email corporativo",
        };
      }
      return input;
    }),
  },
  
  // Regra: Para admins, mostrar campos adicionais
  {
    id: "admin_extra_fields",
    condition: (ctx) => ctx.role_scope === "admin",
    apply: (inputs, ctx) => {
      if (ctx.page_key === "settings" || ctx.page_key === "profile") {
        return [
          ...inputs,
          {
            field_id: "admin_notes",
            field_name: "admin_notes",
            field_type: "textarea" as const,
            label: "Notas administrativas",
            placeholder: "Notas visíveis apenas para admins",
            required: false,
            validation_rules: [],
          },
        ];
      }
      return inputs;
    },
  },
  
  // Regra: Em onboarding, campos devem ser mais amigáveis
  {
    id: "onboarding_friendly",
    condition: (ctx) => ctx.stage === "entry" || ctx.page_key?.includes("onboarding"),
    apply: (inputs) => inputs.map(input => ({
      ...input,
      placeholder: input.placeholder || `Digite seu ${input.label.toLowerCase()}`,
      tooltip: input.tooltip || `Ajuda sobre ${input.label.toLowerCase()}`,
    })),
  },
  
  // Regra: Para guests, simplificar formulários
  {
    id: "guest_simplified",
    condition: (ctx) => ctx.persona === "guest" || ctx.role_scope === "guest",
    apply: (inputs) => inputs.filter(input => input.required !== false),
  },
  
  // Regra: Em checkout, validação em tempo real obrigatória
  {
    id: "checkout_realtime_validation",
    condition: (ctx) => ctx.page_key?.includes("checkout") || ctx.page_key?.includes("payment"),
    apply: (inputs) => inputs.map(input => ({
      ...input,
      validation_rules: [...(input.validation_rules || []), "realtime"],
    })),
  },
  
  // Regra: Senha em signup deve ter requisitos visíveis
  {
    id: "signup_password_hints",
    condition: (ctx) => ctx.page_key === "signup" || ctx.intent?.includes("cadastro"),
    apply: (inputs) => inputs.map(input => {
      if (input.field_type === "password" && input.field_name === "password") {
        return {
          ...input,
          tooltip: "Mínimo 8 caracteres, com letra maiúscula e número",
          validation_rules: [...(input.validation_rules || []), "show_strength_meter"],
        };
      }
      return input;
    }),
  },
];

// ========================================
// INPUTS PADRÃO POR CONTEXTO
// ========================================

export const STANDARD_INPUTS: Record<string, InputField[]> = {
  login: [
    { field_id: "email", field_name: "email", field_type: "email", label: "E-mail", required: true, validation_rules: ["required", "valid_email"], placeholder: "seu@email.com" },
    { field_id: "password", field_name: "password", field_type: "password", label: "Senha", required: true, validation_rules: ["required", "min_length:6"], placeholder: "Sua senha" },
  ],
  signup: [
    { field_id: "name", field_name: "name", field_type: "text", label: "Nome completo", required: true, validation_rules: ["required", "min_length:3"], placeholder: "Seu nome" },
    { field_id: "email", field_name: "email", field_type: "email", label: "E-mail", required: true, validation_rules: ["required", "valid_email"], placeholder: "seu@email.com" },
    { field_id: "password", field_name: "password", field_type: "password", label: "Senha", required: true, validation_rules: ["required", "min_length:8", "has_uppercase", "has_number"], placeholder: "Mínimo 8 caracteres" },
    { field_id: "password_confirm", field_name: "password_confirm", field_type: "password", label: "Confirmar senha", required: true, validation_rules: ["required", "matches:password"], placeholder: "Repita a senha" },
  ],
  recovery: [
    { field_id: "email", field_name: "email", field_type: "email", label: "E-mail cadastrado", required: true, validation_rules: ["required", "valid_email"], placeholder: "seu@email.com", tooltip: "Enviaremos um link para redefinir sua senha" },
  ],
  invite_user: [
    { field_id: "email", field_name: "email", field_type: "email", label: "E-mail do convidado", required: true, validation_rules: ["required", "valid_email"], placeholder: "email@exemplo.com" },
    { field_id: "role", field_name: "role", field_type: "select", label: "Permissão", required: true, validation_rules: ["required"], options: [{ value: "admin", label: "Admin" }, { value: "member", label: "Membro" }] },
  ],
  profile: [
    { field_id: "name", field_name: "name", field_type: "text", label: "Nome", required: true, validation_rules: ["required", "min_length:3"] },
    { field_id: "email", field_name: "email", field_type: "email", label: "E-mail", required: true, validation_rules: ["required", "valid_email"] },
    { field_id: "phone", field_name: "phone", field_type: "tel", label: "Telefone", required: false, validation_rules: ["phone"] },
    { field_id: "avatar", field_name: "avatar", field_type: "file", label: "Foto de perfil", required: false, validation_rules: [] },
  ],
  checkout_payment: [
    { field_id: "card_number", field_name: "card_number", field_type: "text", label: "Número do cartão", required: true, validation_rules: ["required", "card_number"], placeholder: "0000 0000 0000 0000" },
    { field_id: "card_expiry", field_name: "card_expiry", field_type: "text", label: "Validade", required: true, validation_rules: ["required", "card_expiry"], placeholder: "MM/AA" },
    { field_id: "card_cvv", field_name: "card_cvv", field_type: "text", label: "CVV", required: true, validation_rules: ["required", "cvv"], placeholder: "123" },
    { field_id: "card_holder", field_name: "card_holder", field_type: "text", label: "Nome no cartão", required: true, validation_rules: ["required"], placeholder: "Como está no cartão" },
  ],
};

// ========================================
// AÇÕES PADRÃO POR CONTEXTO
// ========================================

export const STANDARD_ACTIONS: Record<string, NodeAction[]> = {
  login: [
    { action_id: "submit", label: "Entrar", action_type: "primary" },
    { action_id: "forgot", label: "Esqueci minha senha", action_type: "link" },
    { action_id: "signup", label: "Criar conta", action_type: "link" },
  ],
  signup: [
    { action_id: "submit", label: "Criar conta", action_type: "primary" },
    { action_id: "login", label: "Já tenho conta", action_type: "link" },
  ],
  recovery: [
    { action_id: "submit", label: "Enviar link", action_type: "primary" },
    { action_id: "back", label: "Voltar ao login", action_type: "link" },
  ],
  invite_user: [
    { action_id: "submit", label: "Enviar convite", action_type: "primary" },
    { action_id: "cancel", label: "Cancelar", action_type: "secondary" },
  ],
  profile: [
    { action_id: "save", label: "Salvar alterações", action_type: "primary" },
    { action_id: "cancel", label: "Cancelar", action_type: "secondary" },
  ],
  checkout_payment: [
    { action_id: "pay", label: "Pagar agora", action_type: "primary" },
    { action_id: "back", label: "Voltar", action_type: "secondary" },
  ],
  default_form: [
    { action_id: "submit", label: "Continuar", action_type: "primary" },
    { action_id: "cancel", label: "Cancelar", action_type: "secondary" },
  ],
};

// ========================================
// FUNÇÕES PRINCIPAIS
// ========================================

/**
 * Busca blocos UX compatíveis no banco
 */
export async function searchUXBlocks(options: {
  semantic_type?: string;
  intent?: string;
  page_key?: string;
  archetype?: string;
  limit?: number;
}): Promise<UXBlock[]> {
  let query = supabase.from("ux_blocks").select("*");

  if (options.archetype) {
    query = query.eq("archetype", options.archetype);
  }

  if (options.page_key) {
    query = query.contains("use_cases", [options.page_key]);
  }

  const { data, error } = await query.limit(options.limit || 20);

  if (error) {
    console.error("[ux-library] Erro ao buscar blocos:", error);
    return [];
  }

  return (data || []).map(row => ({
    id: row.id,
    label: row.label,
    description: row.description || "",
    archetype: row.archetype || "",
    use_cases: row.use_cases || [],
    semantic_flow: row.semantic_flow || {},
    metadata: row.metadata,
  }));
}

/**
 * Adapta um bloco UX para o contexto fornecido
 * NUNCA copia literalmente - sempre adapta
 */
export function adaptBlock(
  block: UXBlock | null,
  context: AdaptationContext
): AdaptedBlock {
  const adaptationNotes: string[] = [];
  
  // Começar com inputs padrão do page_key ou do bloco
  let inputs: InputField[] = [];
  
  if (block?.semantic_flow?.inputs) {
    inputs = [...block.semantic_flow.inputs];
    adaptationNotes.push(`Inputs base do bloco "${block.id}"`);
  } else if (STANDARD_INPUTS[context.page_key]) {
    inputs = [...STANDARD_INPUTS[context.page_key]];
    adaptationNotes.push(`Inputs padrão para "${context.page_key}"`);
  } else if (STANDARD_INPUTS[context.intent]) {
    inputs = [...STANDARD_INPUTS[context.intent]];
    adaptationNotes.push(`Inputs padrão para intent "${context.intent}"`);
  }

  // Aplicar regras de adaptação
  for (const rule of ADAPTATION_RULES) {
    if (rule.condition(context, block || {} as UXBlock)) {
      inputs = rule.apply(inputs, context);
      adaptationNotes.push(`Regra aplicada: ${rule.id}`);
    }
  }

  // Obter ações padrão
  let actions: NodeAction[] = [];
  if (block?.semantic_flow?.actions) {
    actions = [...block.semantic_flow.actions];
  } else if (STANDARD_ACTIONS[context.page_key]) {
    actions = [...STANDARD_ACTIONS[context.page_key]];
  } else {
    actions = [...STANDARD_ACTIONS.default_form];
  }

  // Adaptar labels de ações baseado no contexto
  actions = actions.map(action => ({
    ...action,
    label: adaptActionLabel(action.label, context),
  }));

  // Gerar resumo de validações
  const validationSummary = inputs
    .filter(i => i.validation_rules?.length)
    .map(i => `${i.label}: ${i.validation_rules?.join(", ")}`);

  return {
    block_id: `${context.page_key}_${context.intent}_block`,
    original_block_id: block?.id,
    adapted: true,
    adaptation_notes: adaptationNotes,
    inputs,
    actions,
    feedback: block?.semantic_flow?.feedback,
    validation_summary: validationSummary,
  };
}

/**
 * Compõe um bloco UX completo para um contexto
 */
export async function composeUXBlock(
  context: AdaptationContext
): Promise<AdaptedBlock> {
  // Buscar bloco compatível na biblioteca
  const blocks = await searchUXBlocks({
    page_key: context.page_key,
    intent: context.intent,
    limit: 1,
  });

  const matchingBlock = blocks[0] || null;

  // Adaptar (nunca copiar literalmente)
  return adaptBlock(matchingBlock, context);
}

/**
 * Compõe múltiplos blocos para um fluxo
 */
export async function composeBlocksForFlow(
  steps: Array<{
    step_id: string;
    page_key?: string;
    intent: string;
    persona: string;
    stage: "entry" | "middle" | "exit";
  }>,
  productType?: string,
  roleScope?: string
): Promise<Map<string, AdaptedBlock>> {
  const blocksMap = new Map<string, AdaptedBlock>();

  for (const step of steps) {
    const context: AdaptationContext = {
      persona: step.persona,
      page_key: step.page_key || step.intent,
      intent: step.intent,
      stage: step.stage,
      product_type: productType,
      role_scope: roleScope,
    };

    const adaptedBlock = await composeUXBlock(context);
    blocksMap.set(step.step_id, adaptedBlock);
  }

  return blocksMap;
}

// ========================================
// HELPERS
// ========================================

function adaptActionLabel(label: string, context: AdaptationContext): string {
  // Adaptar labels baseado no contexto
  if (context.persona === "guest" && label === "Salvar") {
    return "Continuar";
  }
  if (context.stage === "exit" && label === "Continuar") {
    return "Finalizar";
  }
  return label;
}

/**
 * Gera output JSON do bloco adaptado (para debug/log)
 */
export function formatAdaptedBlockOutput(block: AdaptedBlock): string {
  return JSON.stringify({
    block_id: block.block_id,
    adapted: block.adapted,
    input_fields: block.inputs.map(i => ({
      label: i.label,
      type: i.field_type,
      required: i.required,
    })),
    tooltip: block.tooltip,
  }, null, 2);
}









