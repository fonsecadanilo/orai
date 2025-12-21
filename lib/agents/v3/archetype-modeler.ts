/**
 * Agent 3: Archetype Modeler v3.1
 * 
 * Responsabilidades:
 * - Aplicar arquétipos de UX, Segurança, Compliance
 * - Enriquecer steps com metadados de arquétipo
 * - Mapear padrões para cada passo
 * - Gerar rich nodes com semântica completa
 */

import { supabase } from "@/lib/supabase/client";
import type {
  ArchetypeModelRequest,
  ArchetypeModelResponse,
  Archetype,
  NodeArchetypeMapping,
  SynthesizedFlow,
  ProductContext,
} from "./types";
import type { AgentError } from "../types";

const EDGE_FUNCTION_URL = "v3-archetype-modeler";

// Arquétipos pré-definidos
export const BUILTIN_ARCHETYPES: Archetype[] = [
  {
    archetype_id: "ux_form_validation",
    archetype_name: "Validação de Formulário em Tempo Real",
    archetype_category: "ux_pattern",
    description: "Validar campos de formulário enquanto o usuário digita",
    applicable_contexts: ["form", "authentication", "checkout"],
    implementation_hints: ["Usar debounce de 300ms", "Mostrar feedback visual imediato", "Evitar bloqueio do formulário"],
  },
  {
    archetype_id: "ux_progressive_disclosure",
    archetype_name: "Revelação Progressiva",
    archetype_category: "ux_pattern",
    description: "Mostrar informações de forma gradual para não sobrecarregar o usuário",
    applicable_contexts: ["onboarding", "configuration_matrix", "form"],
    implementation_hints: ["Agrupar campos relacionados", "Usar expansão/colapso", "Mostrar apenas campos essenciais inicialmente"],
  },
  {
    archetype_id: "sec_rate_limiting",
    archetype_name: "Rate Limiting",
    archetype_category: "security",
    description: "Limitar tentativas de ações sensíveis",
    applicable_contexts: ["authentication", "api_call", "form"],
    implementation_hints: ["Implementar lockout após N tentativas", "Mostrar contador de tentativas restantes", "Oferecer recuperação"],
  },
  {
    archetype_id: "sec_data_masking",
    archetype_name: "Mascaramento de Dados Sensíveis",
    archetype_category: "security",
    description: "Ocultar dados sensíveis na exibição",
    applicable_contexts: ["form", "feedback_success", "action"],
    implementation_hints: ["Mascarar CPF, cartões, senhas", "Permitir toggle de visibilidade", "Usar *** para dados parciais"],
  },
  {
    archetype_id: "comp_lgpd_consent",
    archetype_name: "Consentimento LGPD",
    archetype_category: "compliance",
    description: "Obter consentimento explícito para tratamento de dados",
    applicable_contexts: ["form", "authentication", "onboarding"],
    implementation_hints: ["Checkbox não pré-marcado", "Link para política de privacidade", "Armazenar evidência de consentimento"],
  },
  {
    archetype_id: "perf_lazy_loading",
    archetype_name: "Carregamento Preguiçoso",
    archetype_category: "performance",
    description: "Carregar dados apenas quando necessário",
    applicable_contexts: ["action", "background_action", "form"],
    implementation_hints: ["Usar intersection observer", "Mostrar skeleton loaders", "Priorizar conteúdo above the fold"],
  },
  {
    archetype_id: "ux_error_recovery",
    archetype_name: "Recuperação de Erros",
    archetype_category: "ux_pattern",
    description: "Permitir que usuários se recuperem de erros facilmente",
    applicable_contexts: ["feedback_error", "retry", "fallback"],
    implementation_hints: ["Mensagens claras e acionáveis", "Botão de retry visível", "Preservar dados já inseridos"],
  },
];

/**
 * Modela arquétipos para um fluxo sintetizado
 */
export async function modelArchetype(
  request: ArchetypeModelRequest
): Promise<ArchetypeModelResponse> {
  console.log("[Agent 3: Archetype Modeler] Modelando arquétipos...");

  const { data, error } = await supabase.functions.invoke<ArchetypeModelResponse>(
    EDGE_FUNCTION_URL,
    {
      body: {
        project_id: request.project_id,
        user_id: request.user_id,
        product_context: {
          product_name: request.product_context.product_name,
          product_type: request.product_context.product_type,
          industry: request.product_context.target_audience,
        },
        synthesized_flow: {
          flow_title: request.synthesized_flow.flow_name,
          flow_description: request.synthesized_flow.flow_description,
          steps: request.synthesized_flow.steps.map(s => ({
            step_id: s.step_id,
            title: s.title,
            description: s.description,
            step_type: s.step_type,
            page_key: s.page_key,
          })),
          decisions: request.synthesized_flow.decisions,
          failure_points: request.synthesized_flow.failure_points,
        },
      },
    }
  );

  if (error) {
    console.error("[Archetype Modeler] Erro:", error);
    throw {
      code: "EDGE_FUNCTION_ERROR",
      message: error.message || "Erro ao conectar com o modelador de arquétipos",
      details: error,
    } as AgentError;
  }

  if (!data) {
    throw {
      code: "EMPTY_RESPONSE",
      message: "Resposta vazia do modelador de arquétipos",
    } as AgentError;
  }

  if (!data.success) {
    throw {
      code: "AGENT_ERROR",
      message: data.message || "Erro ao modelar arquétipos",
    } as AgentError;
  }

  console.log("[Archetype Modeler] Modelagem completa:", {
    archetypes_applied: data.analysis?.archetypes_applied,
    coverage: data.analysis?.coverage_percentage,
  });

  return data;
}

/**
 * Mapeia arquétipos localmente (sem chamada de API)
 * Útil para validação rápida
 */
export function mapArchetypesLocally(
  flow: SynthesizedFlow,
  productContext: ProductContext
): NodeArchetypeMapping[] {
  const mappings: NodeArchetypeMapping[] = [];

  for (const step of flow.steps) {
    const applicableArchetypes: string[] = [];
    
    // Mapear arquétipos baseado no tipo de step
    for (const archetype of BUILTIN_ARCHETYPES) {
      if (archetype.applicable_contexts.includes(step.step_type)) {
        applicableArchetypes.push(archetype.archetype_id);
      }
    }
    
    // Adicionar arquétipos específicos por contexto
    if (productContext.product_type === "fintech") {
      if (step.step_type === "form") {
        applicableArchetypes.push("sec_data_masking");
        applicableArchetypes.push("comp_lgpd_consent");
      }
    }
    
    if (flow.category === "authentication") {
      applicableArchetypes.push("sec_rate_limiting");
    }

    mappings.push({
      step_id: step.step_id,
      archetypes_applied: [...new Set(applicableArchetypes)],
      archetype_parameters: {},
      confidence_score: 0.8,
    });
  }

  return mappings;
}

/**
 * Obtém recomendações de arquétipos para um tipo de produto
 */
export function getArchetypeRecommendations(
  productType: ProductContext["product_type"]
): Archetype[] {
  const recommendations: Archetype[] = [];

  switch (productType) {
    case "fintech":
      recommendations.push(
        ...BUILTIN_ARCHETYPES.filter(a => 
          a.archetype_category === "security" || 
          a.archetype_category === "compliance"
        )
      );
      break;
    case "healthtech":
      recommendations.push(
        ...BUILTIN_ARCHETYPES.filter(a => 
          a.archetype_category === "compliance" || 
          a.archetype_id === "sec_data_masking"
        )
      );
      break;
    case "e-commerce":
      recommendations.push(
        ...BUILTIN_ARCHETYPES.filter(a => 
          a.archetype_category === "ux_pattern" || 
          a.archetype_category === "performance"
        )
      );
      break;
    default:
      recommendations.push(
        ...BUILTIN_ARCHETYPES.filter(a => a.archetype_category === "ux_pattern")
      );
  }

  return recommendations;
}
