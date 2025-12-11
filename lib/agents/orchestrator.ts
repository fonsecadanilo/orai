/**
 * Orquestrador dos Agentes v2.0
 * 
 * NOVA ARQUITETURA DETERMINÍSTICA:
 * 
 * Pipeline (10 etapas):
 * 1. Criar Master Rule (LLM)
 * 2. Validar Master Rule (Zod)
 * 3. Criar Jornada do Usuário (LLM)
 * 4. Validar Jornada (Zod)
 * 5. Criar Subrules usando {masterRule + journey} (LLM)
 * 6. Validar Subrules (schema + regras incrementais)
 * 7. Se falhar, executar Autofix com relatório
 * 8. Gerar Flow com engine determinística (CÓDIGO)
 * 9. Validar grafo final
 * 10. Retornar: fluxo + jornada + features + warnings
 * 
 * O LLM cuida apenas de semântica.
 * O código cuida de motor, estrutura, gramática, layout e indexação.
 */

import type {
  FullFlowCreationRequest,
  FullFlowCreationResponse,
  CreationProgress,
  MasterRuleCreatorResponse,
  SubrulesDecomposerResponse,
  JourneyFeaturesCreatorResponse,
  FlowGeneratorResponse,
  JourneyV2,
} from "./types";
import { createMasterRule } from "./master-rule-creator";
import { decomposeIntoSubrules } from "./subrules-decomposer";
import { createJourneyAndFeatures, extractBusinessRulesFromContent } from "./journey-features-creator";
import { generateFlow } from "./flow-generator";

export type ProgressCallback = (progress: CreationProgress) => void;

/**
 * 🔧 CORREÇÃO: Normaliza referências de nós
 * Garante que todas as referências (next_on_success, next_on_failure) 
 * usam IDs simbólicos válidos, não índices numéricos
 */
export function normalizeNodeReferences(nodes: any[]): any[] {
  if (!nodes || nodes.length === 0) return nodes;
  
  const numericRefRegex = /^\d+$/;
  
  // Criar mapa de índice/order_index → ID simbólico
  const idMap = new Map<string, string>();
  
  nodes.forEach((node, idx) => {
    const nodeId = node.id || node.metadata?.symbolic_id || `node_${idx + 1}`;
    
    // Mapear pelo índice baseado em 1
    idMap.set(String(idx + 1), nodeId);
    
    // Mapear pelo order_index se existir
    if (node.order_index) {
      idMap.set(String(node.order_index), nodeId);
    }
    
    // Mapear pelo db_id se existir
    if (node.db_id) {
      idMap.set(String(node.db_id), nodeId);
    }
    
    // Mapear pelo próprio ID
    idMap.set(nodeId, nodeId);
  });
  
  console.log("[orchestrator] normalizeNodeReferences - idMap criado:", Object.fromEntries(idMap));
  
  // Função auxiliar para resolver referências
  const resolveRef = (ref: string | null | undefined): string | null => {
    if (!ref) return null;
    
    // Se for referência numérica, tentar resolver
    if (numericRefRegex.test(ref)) {
      const resolved = idMap.get(ref);
      if (resolved) {
        console.log(`[orchestrator] Referência numérica "${ref}" → "${resolved}"`);
        return resolved;
      }
      console.warn(`[orchestrator] Referência numérica "${ref}" não resolvida`);
      return null;
    }
    
    // Se já é um ID simbólico, verificar se existe
    if (idMap.has(ref)) {
      return ref;
    }
    
    // Tentar encontrar por similaridade (caso o ID tenha sido modificado)
    for (const [key, value] of idMap) {
      if (value.includes(ref) || ref.includes(value)) {
        console.log(`[orchestrator] Referência "${ref}" resolvida por similaridade → "${value}"`);
        return value;
      }
    }
    
    console.warn(`[orchestrator] Referência "${ref}" não encontrada no mapa`);
    return ref; // Retornar como está para não perder a referência
  };
  
  // Normalizar todos os nós
  return nodes.map((node, idx) => {
    const nodeId = node.id || node.metadata?.symbolic_id || `node_${idx + 1}`;
    
    return {
      ...node,
      id: nodeId,
      next_on_success: resolveRef(node.next_on_success || node.metadata?.next_on_success),
      next_on_failure: resolveRef(node.next_on_failure || node.metadata?.next_on_failure),
    };
  });
}

/**
 * Nova pipeline v2.0: Cria fluxo completo com a nova arquitetura
 * 
 * Fluxo:
 * 1. createMasterRule → Validação
 * 2. createJourneyAndFeatures → Validação (AGORA ANTES do Subrules)
 * 3. decomposeIntoSubrules (com journey) → Validação de grafo → Autofix se necessário
 * 4. generateFlow (100% código) → Validação final
 */
export async function createCompleteFlowWithAgents(
  request: FullFlowCreationRequest,
  onProgress?: ProgressCallback
): Promise<FullFlowCreationResponse> {
  const startTime = Date.now();
  const includeJourney = request.options?.include_journey !== false;
  
  let masterRuleResult: MasterRuleCreatorResponse | null = null;
  let journeyResult: JourneyFeaturesCreatorResponse | null = null;
  let decompositionResult: SubrulesDecomposerResponse | null = null;
  let flowResult: FlowGeneratorResponse | null = null;
  
  // Coletar warnings ao longo do processo
  const allWarnings: string[] = [];

  try {
    // ========================================
    // ETAPA 1: Criar Regra Master (LLM)
    // ========================================
    onProgress?.({
      step: "creating_master",
      message: "1/10 - Criando regra de negócio...",
      percentage: 5,
      details: { master_rule_created: false },
    });

    console.log("[orchestrator] Etapa 1: Criando Master Rule...");
    
    masterRuleResult = await createMasterRule(
      request.prompt,
      request.project_id,
      request.user_id
    );

    // ========================================
    // ETAPA 2: Validar Master Rule (Zod)
    // ========================================
    onProgress?.({
      step: "creating_master",
      message: "2/10 - Validando regra de negócio...",
      percentage: 10,
      details: { master_rule_created: false },
    });

    console.log("[orchestrator] Etapa 2: Validando Master Rule...");
    
    // Validação já é feita na Edge Function com Zod
    if (!masterRuleResult.success || !masterRuleResult.master_rule_id) {
      throw new Error(masterRuleResult.message || "Falha ao criar/validar regra master");
    }

    onProgress?.({
      step: "creating_master",
      message: `Regra master criada: ${masterRuleResult.master_rule.title || "Sem título"}`,
      percentage: 15,
      details: {
        master_rule_created: true,
        master_rule_id: masterRuleResult.master_rule_id,
      },
    });

    // ========================================
    // ETAPA 3: Criar Jornada do Usuário (LLM)
    // ========================================
    let journeyV2: JourneyV2 | undefined = undefined;
    
    if (includeJourney) {
      onProgress?.({
        step: "linking",
        message: "3/10 - Criando jornada do usuário...",
        percentage: 20,
        details: {
          master_rule_created: true,
          master_rule_id: masterRuleResult.master_rule_id,
        },
      });

      console.log("[orchestrator] Etapa 3: Criando Journey...");

      try {
        const masterContent = typeof masterRuleResult.master_rule.content === 'string'
          ? masterRuleResult.master_rule.content
          : masterRuleResult.master_rule.content?.happy_path || '';
        
        const businessRules = extractBusinessRulesFromContent(masterContent);

        journeyResult = await createJourneyAndFeatures(
          masterRuleResult.master_rule_id,
          request.project_id,
          request.user_id,
          {
            masterRuleContent: masterContent,
            masterRuleTitle: masterRuleResult.master_rule.title,
            businessRules,
          }
        );
        
        // Extrair JourneyV2 se disponível
        journeyV2 = journeyResult.journey;
        
        console.log("[orchestrator] Journey criada:", {
          journey_id: journeyResult.journey_id,
          steps: journeyV2?.steps?.length || 0,
          decisions: journeyV2?.decisions?.length || 0,
          failure_points: journeyV2?.failure_points?.length || 0,
        });
        
      } catch (journeyError) {
        console.warn("[orchestrator] Erro ao criar jornada (continuando sem):", journeyError);
        allWarnings.push("Jornada não foi criada: " + String(journeyError));
      }
    }

    // ========================================
    // ETAPA 4: Validar Jornada (Zod)
    // ========================================
    if (journeyV2) {
      onProgress?.({
        step: "linking",
        message: "4/10 - Validando jornada do usuário...",
        percentage: 30,
        details: {
          master_rule_created: true,
          master_rule_id: masterRuleResult.master_rule_id,
        },
      });

      console.log("[orchestrator] Etapa 4: Validando Journey...");
      
      // Validação básica da estrutura
      if (!journeyV2.steps || journeyV2.steps.length < 3) {
        allWarnings.push("Jornada tem menos de 3 etapas - pode estar simplificada");
      }
      if (!journeyV2.decisions || journeyV2.decisions.length === 0) {
        allWarnings.push("Jornada não define pontos de decisão");
      }
      if (!journeyV2.failure_points || journeyV2.failure_points.length === 0) {
        allWarnings.push("Jornada não define pontos de falha/abandono");
      }
    } else {
      onProgress?.({
        step: "linking",
        message: "4/10 - Jornada não disponível, continuando...",
        percentage: 30,
        details: {
          master_rule_created: true,
          master_rule_id: masterRuleResult.master_rule_id,
        },
      });
    }

    // Pausar para revisão se não for auto_proceed
    if (!request.options?.auto_proceed) {
      onProgress?.({
        step: "master_review",
        message: "Regra master e jornada prontas para revisão",
        percentage: 35,
        details: {
          master_rule_created: true,
          master_rule_id: masterRuleResult.master_rule_id,
        },
      });
    }

    // ========================================
    // ETAPA 5: Criar Subrules com {masterRule + journey}
    // ========================================
    onProgress?.({
      step: "decomposing",
      message: "5/10 - Criando nós simbólicos (Regra + Jornada)...",
      percentage: 40,
      details: {
        master_rule_created: true,
        master_rule_id: masterRuleResult.master_rule_id,
      },
    });

    console.log("[orchestrator] Etapa 5: Decompondo em Subrules (com Journey)...");

    decompositionResult = await decomposeIntoSubrules(
      masterRuleResult.master_rule_id,
      masterRuleResult.master_rule,
      request.project_id,
      request.user_id,
      {
        journey: journeyV2, // Passa a Journey para o Subrules Decomposer
        decompositionDepth: request.options?.decomposition_depth || "normal",
        includeErrorPaths: request.options?.include_error_paths !== false,
        includeValidationNodes: true,
      }
    );

    // ========================================
    // ETAPA 6: Validar Subrules (schema + regras incrementais)
    // ========================================
    onProgress?.({
      step: "decomposing",
      message: "6/10 - Validando nós simbólicos...",
      percentage: 50,
      details: {
        master_rule_created: true,
        master_rule_id: masterRuleResult.master_rule_id,
        sub_rules_count: decompositionResult.sub_rules?.length || 0,
      },
    });

    console.log("[orchestrator] Etapa 6: Validando Subrules...");
    
    // Validação de grafo já é feita na Edge Function
    if (!decompositionResult.success) {
      // Verificar se há warnings de validação
      const graphValidation = (decompositionResult as any).graph_validation;
      if (graphValidation?.warnings) {
        allWarnings.push(...graphValidation.warnings.map((w: any) => w.message || w));
      }
      throw new Error(decompositionResult.message || "Falha ao decompor regras");
    }

    // Adicionar warnings de validação se existirem
    const graphValidation = (decompositionResult as any).graph_validation;
    if (graphValidation?.warnings) {
      allWarnings.push(...graphValidation.warnings.map((w: any) => w.message || w));
    }

    onProgress?.({
      step: "decomposing",
      message: `${decompositionResult.sub_rules?.length || 0} nós criados (Regra + Jornada)`,
      percentage: 55,
      details: {
        master_rule_created: true,
        master_rule_id: masterRuleResult.master_rule_id,
        sub_rules_count: decompositionResult.sub_rules?.length || 0,
      },
    });

    // ========================================
    // ETAPA 7: Autofix já executado na Edge Function
    // (Se houve falha e autofix funcionou, continuamos aqui)
    // ========================================
    if (graphValidation?.warnings?.some((w: any) => 
      (w.code || w).toString().includes("AUTOFIX_APPLIED")
    )) {
      onProgress?.({
        step: "decomposing",
        message: "7/10 - Autofix aplicado aos nós...",
        percentage: 60,
        details: {
          master_rule_created: true,
          master_rule_id: masterRuleResult.master_rule_id,
          sub_rules_count: decompositionResult.sub_rules?.length || 0,
        },
      });
      
      console.log("[orchestrator] Etapa 7: Autofix foi aplicado");
      allWarnings.push("Autofix foi aplicado para corrigir erros no grafo");
    }

    // ========================================
    // ETAPA 8: Gerar Fluxo Visual (100% CÓDIGO)
    // ========================================
    onProgress?.({
      step: "creating_flow",
      message: "8/10 - Gerando fluxo visual (engine)...",
      percentage: 70,
      details: {
        master_rule_created: true,
        master_rule_id: masterRuleResult.master_rule_id,
        sub_rules_count: decompositionResult.sub_rules?.length || 0,
      },
    });

    console.log("[orchestrator] Etapa 8: Gerando Flow...");

    // Usar nós simbólicos diretamente da resposta (preferido) ou sub_rules como fallback
    let symbolicNodes = decompositionResult.symbolic_nodes;
    
    if (!symbolicNodes || symbolicNodes.length === 0) {
      // Converter sub_rules para symbolic_nodes
      const subRules = decompositionResult.sub_rules || [];
      
      symbolicNodes = subRules.map((sr: any, idx: number) => {
        const nodeId = sr.id || sr.metadata?.symbolic_id || `node_${idx + 1}`;
        
        return {
          id: nodeId,
          type: sr.suggested_node_type || sr.type || "action",
          title: sr.title,
          description: sr.description || "",
          next_on_success: sr.next_on_success || sr.metadata?.next_on_success || null,
          next_on_failure: sr.next_on_failure || sr.metadata?.next_on_failure || null,
          end_status: sr.end_status || sr.metadata?.status || sr.metadata?.end_status,
          flow_category: sr.flow_category || sr.metadata?.flow_category || "main",
          db_id: sr.db_id,
          order_index: sr.order_index || idx + 1,
        };
      });
    }

    // 🔧 CORREÇÃO: Normalizar todas as referências ANTES de enviar ao Flow Generator
    console.log("[orchestrator] Normalizando referências dos nós simbólicos...");
    symbolicNodes = normalizeNodeReferences(symbolicNodes);
    
    console.log("[orchestrator] Nós simbólicos normalizados para flow-generator:", symbolicNodes?.length);
    console.log("[orchestrator] Exemplo de nó normalizado:", symbolicNodes?.[0]);
    console.log("[orchestrator] Primeiro nó:", symbolicNodes?.[0]);

    flowResult = await generateFlow(
      masterRuleResult.master_rule_id,
      symbolicNodes,
      decompositionResult.flow_structure,
      decompositionResult.dependency_graph,
      request.project_id,
      request.user_id,
      {
        layoutOptions: {
          orientation: request.options?.layout_orientation || "horizontal",
          spacing: "normal",
          showErrorPaths: request.options?.include_error_paths !== false,
          showValidationNodes: true,
          groupRelatedNodes: true,
        },
        symbolicNodes,
        userJourney: journeyResult?.user_journey,
        suggestedFeatures: journeyResult?.suggested_features,
      }
    );

    if (!flowResult.success) {
      throw new Error(flowResult.message || "Falha ao gerar fluxo");
    }

    // ========================================
    // ETAPA 9: Validar Grafo Final
    // ========================================
    onProgress?.({
      step: "creating_flow",
      message: "9/10 - Validando grafo final...",
      percentage: 85,
      details: {
        master_rule_created: true,
        master_rule_id: masterRuleResult.master_rule_id,
        sub_rules_count: decompositionResult.sub_rules?.length || 0,
        nodes_created: flowResult.generated_flow.nodes.length,
        connections_created: flowResult.generated_flow.connections.length,
      },
    });

    console.log("[orchestrator] Etapa 9: Validando grafo final...");
    
    // Adicionar warnings de validação do flow se existirem
    const flowValidation = (flowResult as any).validation;
    if (flowValidation?.warnings) {
      allWarnings.push(...flowValidation.warnings.filter((w: string) => 
        !w.includes("AUTO_FIX_APPLIED") // Evitar duplicatas
      ));
    }
    if (flowValidation?.errors?.length > 0) {
      allWarnings.push(`Validação do grafo reportou ${flowValidation.errors.length} erro(s)`);
    }

    // ========================================
    // ETAPA 10: Retornar Resultado Final
    // ========================================
    const executionTime = Date.now() - startTime;

    onProgress?.({
      step: "completed",
      message: "10/10 - Fluxo criado com sucesso!",
      percentage: 100,
      details: {
        master_rule_created: true,
        master_rule_id: masterRuleResult.master_rule_id,
        sub_rules_count: decompositionResult.sub_rules?.length || 0,
        nodes_created: flowResult.generated_flow.nodes.length,
        connections_created: flowResult.generated_flow.connections.length,
      },
    });

    console.log("[orchestrator] Etapa 10: Concluído!", {
      execution_time_ms: executionTime,
      nodes: flowResult.generated_flow.nodes.length,
      connections: flowResult.generated_flow.connections.length,
      warnings: allWarnings.length,
    });

    return {
      success: true,
      master_rule_result: masterRuleResult,
      decomposition_result: decompositionResult,
      journey_result: journeyResult || undefined,
      flow_result: flowResult,
      master_rule_id: masterRuleResult.master_rule_id,
      sub_rule_ids: decompositionResult.sub_rule_ids,
      journey_id: journeyResult?.journey_id,
      flow_id: flowResult.flow_id!,
      summary: {
        total_rules_created: 1 + (decompositionResult.sub_rules?.length || 0),
        total_nodes_created: flowResult.generated_flow.nodes.length,
        total_connections_created: flowResult.generated_flow.connections.length,
        total_features_identified: journeyResult?.suggested_features?.length,
        execution_time_ms: executionTime,
        warnings: allWarnings,
      },
      message: `Fluxo "${flowResult.generated_flow.name}" criado com ${flowResult.generated_flow.nodes.length} nós (pipeline v2.0)`,
    };

  } catch (error: any) {
    console.error("[orchestrator] Erro:", error);
    
    onProgress?.({
      step: "error",
      message: error.message || "Erro durante a criação do fluxo",
      percentage: 0,
      details: {
        master_rule_created: !!masterRuleResult,
        master_rule_id: masterRuleResult?.master_rule_id,
        sub_rules_count: decompositionResult?.sub_rules?.length || 0,
      },
    });

    throw error;
  }
}

/**
 * Continua a criação a partir de uma etapa específica
 */
export async function continueFlowCreation(
  fromStep: "decomposing" | "creating_flow",
  masterRuleId: number,
  projectId: number,
  userId: number,
  options?: FullFlowCreationRequest["options"] & { journey?: JourneyV2 },
  onProgress?: ProgressCallback
): Promise<Partial<FullFlowCreationResponse>> {
  if (fromStep === "decomposing") {
    // Buscar regra master
    const { supabase } = await import("@/lib/supabase/client");
    const { data: masterRule } = await supabase
      .from("rules")
      .select("*")
      .eq("id", masterRuleId)
      .single();

    if (!masterRule) {
      throw new Error("Regra master não encontrada");
    }

    // Buscar journey se existir
    let journeyV2: JourneyV2 | undefined = options?.journey;
    if (!journeyV2) {
      const { data: journeyRecord } = await supabase
        .from("user_journeys")
        .select("metadata")
        .eq("master_rule_id", masterRuleId)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();
      
      journeyV2 = journeyRecord?.metadata?.journey_v2;
    }

    onProgress?.({
      step: "decomposing",
      message: "Decompondo em nós simbólicos (com Jornada)...",
      percentage: 40,
    });

    const decompositionResult = await decomposeIntoSubrules(
      masterRuleId,
      null,
      projectId,
      userId,
      {
        journey: journeyV2,
        decompositionDepth: options?.decomposition_depth || "normal",
        includeErrorPaths: options?.include_error_paths !== false,
      }
    );

    if (!decompositionResult.success) {
      throw new Error(decompositionResult.message || "Falha na decomposição");
    }

    onProgress?.({
      step: "creating_flow",
      message: "Gerando fluxo visual...",
      percentage: 70,
    });

    // Usar nós simbólicos diretamente ou converter sub_rules
    let symbolicNodes = decompositionResult.symbolic_nodes;
    
    if (!symbolicNodes || symbolicNodes.length === 0) {
      const subRules = decompositionResult.sub_rules || [];
      
      symbolicNodes = subRules.map((sr: any, idx: number) => ({
        id: sr.id || sr.metadata?.symbolic_id || `node_${idx + 1}`,
        type: sr.suggested_node_type || sr.type || "action",
        title: sr.title,
        description: sr.description || "",
        next_on_success: sr.next_on_success || sr.metadata?.next_on_success || null,
        next_on_failure: sr.next_on_failure || sr.metadata?.next_on_failure || null,
        end_status: sr.end_status || sr.metadata?.status || sr.metadata?.end_status,
        flow_category: sr.flow_category || sr.metadata?.flow_category || "main",
        db_id: sr.db_id,
        order_index: sr.order_index || idx + 1,
      }));
    }

    // 🔧 CORREÇÃO: Normalizar referências antes de enviar ao Flow Generator
    symbolicNodes = normalizeNodeReferences(symbolicNodes);

    const flowResult = await generateFlow(
      masterRuleId,
      symbolicNodes,
      decompositionResult.flow_structure,
      decompositionResult.dependency_graph,
      projectId,
      userId,
      { symbolicNodes }
    );

    onProgress?.({
      step: "completed",
      message: "Fluxo criado com sucesso!",
      percentage: 100,
    });

    return {
      success: true,
      decomposition_result: decompositionResult,
      flow_result: flowResult,
      master_rule_id: masterRuleId,
      sub_rule_ids: decompositionResult.sub_rule_ids,
      flow_id: flowResult.flow_id,
    };
  }

  if (fromStep === "creating_flow") {
    // Buscar subregras existentes
    const { supabase } = await import("@/lib/supabase/client");
    const { data: subRulesData } = await supabase
      .from("rules")
      .select("*")
      .eq("parent_rule_id", masterRuleId)
      .eq("rule_type", "node_rule")
      .order("order_index", { ascending: true });

    if (!subRulesData?.length) {
      throw new Error("Nenhuma subregra encontrada");
    }

    // Converter para nós simbólicos
    let symbolicNodes = subRulesData.map((rule: any, idx: number) => ({
      id: rule.metadata?.symbolic_id || `node_${idx + 1}`,
      type: rule.suggested_node_type || "action",
      title: rule.title,
      description: rule.description || "",
      next_on_success: rule.metadata?.next_on_success || null,
      next_on_failure: rule.metadata?.next_on_failure || null,
      end_status: rule.metadata?.end_status || rule.metadata?.status,
      flow_category: rule.metadata?.flow_category || "main",
      db_id: rule.id,
      order_index: rule.order_index || idx + 1,
    }));

    // 🔧 CORREÇÃO: Normalizar referências antes de enviar ao Flow Generator
    symbolicNodes = normalizeNodeReferences(symbolicNodes);

    const flowStructure = {
      total_nodes: symbolicNodes.length,
      happy_path_nodes: symbolicNodes.filter(n => n.end_status !== "error").length,
      error_path_nodes: symbolicNodes.filter(n => n.end_status === "error").length,
      validation_nodes: 0,
      decision_points: symbolicNodes.filter((r) => r.type === "condition").length,
      paths: [],
    };

    const dependencyGraph: Record<number, { depends_on: number[]; leads_to: number[] }> = {};

    onProgress?.({
      step: "creating_flow",
      message: "Gerando fluxo visual...",
      percentage: 70,
    });

    const flowResult = await generateFlow(
      masterRuleId,
      symbolicNodes,
      flowStructure,
      dependencyGraph,
      projectId,
      userId,
      { symbolicNodes }
    );

    onProgress?.({
      step: "completed",
      message: "Fluxo criado com sucesso!",
      percentage: 100,
    });

    return {
      success: true,
      flow_result: flowResult,
      master_rule_id: masterRuleId,
      sub_rule_ids: subRulesData.map((r: any) => r.id),
      flow_id: flowResult.flow_id,
    };
  }

  throw new Error(`Etapa inválida: ${fromStep}`);
}

/**
 * Retry com fix pass
 * Se a decomposição falhar na validação de grafo,
 * tenta corrigir automaticamente
 */
export async function retryWithFix(
  masterRuleId: number,
  projectId: number,
  userId: number,
  errors: string[],
  journey?: JourneyV2,
  onProgress?: ProgressCallback
): Promise<SubrulesDecomposerResponse> {
  onProgress?.({
    step: "decomposing",
    message: "Tentando corrigir erros de grafo...",
    percentage: 50,
  });

  // Re-chamar decomposição - autofix é feito internamente
  const result = await decomposeIntoSubrules(
    masterRuleId,
    null,
    projectId,
    userId,
    {
      journey,
      decompositionDepth: "normal",
      includeErrorPaths: true,
      includeValidationNodes: true,
    }
  );

  return result;
}
