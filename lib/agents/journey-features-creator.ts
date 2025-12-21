import { supabase } from "@/lib/supabase/client";
import type {
  JourneyFeaturesCreatorRequest,
  JourneyFeaturesCreatorResponse,
  AgentError,
} from "./types";
import type { Journey } from "@/lib/schemas/journeySchema";

const EDGE_FUNCTION_URL = "journey-features-creator";

/**
 * Agente 2: Journey Creator v2.0
 * 
 * NOVA ARQUITETURA v2.0:
 * A Journey agora é ENTRADA para o Subrules Decomposer (junto com Master Rule).
 * 
 * Pipeline atualizada:
 * 1. Master Rule → define LÓGICA DE NEGÓCIO
 * 2. Journey → define EXPERIÊNCIA DO USUÁRIO
 * 3. Subrules → combina ambos para criar NÓS SIMBÓLICOS
 * 
 * Três camadas da Journey:
 * 1. Intenções do Usuário (o que ele quer fazer e em que ordem)
 * 2. Microjornadas (caminhos felizes e de erro)
 * 3. Pontos de decisão, dúvidas ou oportunidades
 * 
 * PROIBIDO: Descrever UI/UX detalhada
 * PERMITIDO: Narrativas que ajudam o Subrules
 */
export async function createJourneyAndFeatures(
  masterRuleId: number,
  projectId: number,
  userId: number,
  options?: {
    masterRuleContent?: string;
    masterRuleTitle?: string;
    businessRules?: string[];
    conversationId?: string;
  }
): Promise<JourneyFeaturesCreatorResponse> {
  const requestBody: JourneyFeaturesCreatorRequest = {
    master_rule_id: masterRuleId,
    master_rule_content: options?.masterRuleContent || "",
    master_rule_title: options?.masterRuleTitle || "",
    business_rules: options?.businessRules || [],
    project_id: projectId,
    user_id: userId,
    conversation_id: options?.conversationId,
  };

  const { data, error } = await supabase.functions.invoke<JourneyFeaturesCreatorResponse>(
    EDGE_FUNCTION_URL,
    {
      body: requestBody,
    }
  );

  if (error) {
    console.error("Erro ao chamar journey-features-creator:", error);
    throw {
      code: "EDGE_FUNCTION_ERROR",
      message: error.message || "Erro ao conectar com o agente de jornada",
      details: error,
    } as AgentError;
  }

  if (!data) {
    throw {
      code: "EMPTY_RESPONSE",
      message: "Resposta vazia do agente de jornada",
    } as AgentError;
  }

  if (!data.success) {
    throw {
      code: "AGENT_ERROR",
      message: data.message || "Erro ao gerar jornada e features",
    } as AgentError;
  }

  return data;
}

/**
 * Busca uma jornada pelo ID
 */
export async function getJourneyById(
  journeyId: number
): Promise<JourneyFeaturesCreatorResponse["user_journey"] | null> {
  const { data, error } = await supabase
    .from("user_journeys")
    .select("*")
    .eq("id", journeyId)
    .single();

  if (error || !data) {
    console.error("Erro ao buscar jornada:", error);
    return null;
  }

  return {
    name: data.name,
    description: data.description,
    persona: data.persona,
    goal: data.goal,
    starting_point: data.starting_point,
    ending_point: data.ending_point,
    steps: data.steps || [],
    success_metrics: data.success_metrics || [],
    narrative: data.narrative || "",
  };
}

/**
 * Busca jornada por regra master
 */
export async function getJourneyByMasterRuleId(
  masterRuleId: number
): Promise<JourneyFeaturesCreatorResponse["user_journey"] | null> {
  const { data, error } = await supabase
    .from("user_journeys")
    .select("*")
    .eq("master_rule_id", masterRuleId)
    .single();

  if (error || !data) {
    return null;
  }

  return {
    name: data.name,
    description: data.description,
    persona: data.persona,
    goal: data.goal,
    starting_point: data.starting_point,
    ending_point: data.ending_point,
    steps: data.steps || [],
    success_metrics: data.success_metrics || [],
    narrative: data.narrative || "",
  };
}

/**
 * Busca features sugeridas por jornada ou regra master
 */
export async function getSuggestedFeatures(
  params: { journeyId?: number; masterRuleId?: number }
): Promise<JourneyFeaturesCreatorResponse["suggested_features"]> {
  let query = supabase.from("suggested_features").select("*");

  if (params.journeyId) {
    query = query.eq("journey_id", params.journeyId);
  } else if (params.masterRuleId) {
    query = query.eq("master_rule_id", params.masterRuleId);
  } else {
    return [];
  }

  const { data, error } = await query.order("priority", { ascending: false });

  if (error || !data) {
    console.error("Erro ao buscar features:", error);
    return [];
  }

  return data.map((f) => ({
    id: f.feature_id,
    name: f.name,
    description: f.description,
    type: f.type,
    related_journey_steps: f.related_journey_steps || [],
    complexity: f.complexity,
    priority: f.priority,
    user_value: f.user_value,
    business_value: f.business_value,
    acceptance_criteria: f.acceptance_criteria || [],
  }));
}

/**
 * Extrai regras de negócio do conteúdo markdown da master rule
 * 
 * Esta função analisa o conteúdo da regra master e extrai
 * as regras de negócio implícitas para passar ao agente de jornada.
 */
export function extractBusinessRulesFromContent(content: string): string[] {
  const rules: string[] = [];
  
  if (!content) return rules;
  
  // Procurar seção de regras de negócio
  const rulesMatch = content.match(/## Regras de Negocio\n([\s\S]*?)(?=##|$)/i);
  if (rulesMatch) {
    const rulesText = rulesMatch[1];
    const lines = rulesText.split("\n").filter(l => l.trim().startsWith("-"));
    rules.push(...lines.map(l => l.replace(/^-\s*/, "").trim()));
  }

  // Procurar fluxo principal para extrair regras implícitas
  const flowMatch = content.match(/## Fluxo Principal\n([\s\S]*?)(?=##|$)/i);
  if (flowMatch) {
    const flowText = flowMatch[1];
    const lines = flowText.split("\n").filter(l => l.trim().match(/^\d+\./));
    // Adicionar apenas passos que parecem regras
    lines.forEach(l => {
      const cleaned = l.replace(/^\d+\.\s*/, "").trim();
      if (cleaned.length > 20 && !rules.includes(cleaned)) {
        rules.push(cleaned);
      }
    });
  }

  // Procurar premissas
  const assumptionsMatch = content.match(/## Premissas\n([\s\S]*?)(?=##|$)/i);
  if (assumptionsMatch) {
    const assumptionsText = assumptionsMatch[1];
    const lines = assumptionsText.split("\n").filter(l => l.trim().startsWith("-"));
    lines.forEach(l => {
      const cleaned = l.replace(/^-\s*/, "").trim();
      if (cleaned.length > 10 && !rules.includes(cleaned)) {
        rules.push(cleaned);
      }
    });
  }

  return rules.slice(0, 15); // Limitar a 15 regras
}

/**
 * Enriquece descrições de nós com contexto da jornada
 * 
 * Esta função pode ser usada para adicionar informações da jornada
 * às descrições dos nós do fluxo.
 */
export function enrichNodeWithJourneyContext(
  nodeDescription: string,
  journeyStep?: {
    action?: string;
    context?: string;
    expected_outcome?: string;
    touchpoint?: string;
    pain_points?: string[];
  }
): string {
  if (!journeyStep) return nodeDescription;
  
  const parts: string[] = [nodeDescription];
  
  if (journeyStep.action) {
    parts.push(`\n\n👤 **O que o usuário faz:** ${journeyStep.action}`);
  }
  
  if (journeyStep.context) {
    parts.push(`💡 **Por quê:** ${journeyStep.context}`);
  }
  
  if (journeyStep.expected_outcome) {
    parts.push(`✅ **Resultado esperado:** ${journeyStep.expected_outcome}`);
  }
  
  if (journeyStep.touchpoint) {
    const touchpointLabels: Record<string, string> = {
      page: "Página",
      modal: "Modal",
      form: "Formulário",
      button: "Botão",
      notification: "Notificação",
      email: "E-mail",
      external: "Sistema externo",
    };
    parts.push(`📍 **Touchpoint:** ${touchpointLabels[journeyStep.touchpoint] || journeyStep.touchpoint}`);
  }
  
  if (journeyStep.pain_points?.length) {
    parts.push(`⚠️ **Pontos de atenção:** ${journeyStep.pain_points.join("; ")}`);
  }
  
  return parts.join("\n");
}
