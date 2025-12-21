/**
 * Orchestrator v3.1 - Pipeline Completa de Criação de Fluxos
 * 
 * Executa a cadeia de 6 agentes em sequência:
 * 1. Product & Role Mapper
 * 2. Flow Synthesizer
 * 3. Archetype Modeler
 * 4. Flow Critic
 * 5. UX Block Composer
 * 6. Flow Connector & Reusability Tracker
 */

import type {
  V3PipelineRequest,
  V3PipelineResponse,
  ProductRoleMapperResponse,
  FlowSynthesizerResponse,
  ArchetypeModelResponse,
  FlowCriticResponse,
  UXBlockComposerV3Response,
  FlowConnectorResponse,
  V3FlowNode,
  NodeConnection,
} from "./types";

import { mapProductAndRole } from "./product-role-mapper";
import { synthesizeFlow } from "./flow-synthesizer";
import { modelArchetype } from "./archetype-modeler";
import { criticizeFlow, applyAutoFixes } from "./flow-critic";
import { composeUXBlocksV3 } from "./ux-block-composer-v3";
import { connectFlow, generateConnections, convertBlocksToNodes } from "./flow-connector";

export type ProgressCallback = (progress: {
  agent: number;
  agent_name: string;
  status: "running" | "completed" | "error";
  message: string;
  percentage: number;
}) => void;

/**
 * Executa a pipeline completa v3.1
 */
export async function executeV3Pipeline(
  request: V3PipelineRequest,
  onProgress?: ProgressCallback
): Promise<V3PipelineResponse> {
  const startTime = Date.now();
  const warnings: string[] = [];

  const reportProgress = (
    agent: number,
    agent_name: string,
    status: "running" | "completed" | "error",
    message: string
  ) => {
    const percentage = Math.round((agent / 6) * 100);
    onProgress?.({ agent, agent_name, status, message, percentage });
    console.log(`[Pipeline v3.1] Agent ${agent}: ${agent_name} - ${status} - ${message}`);
  };

  try {
    // ========================================
    // AGENT 1: Product & Role Mapper
    // ========================================
    reportProgress(1, "Product & Role Mapper", "running", "Mapeando contexto do produto...");
    
    const productRoleResult = await mapProductAndRole({
      prompt: request.prompt,
      project_id: request.project_id,
      user_id: request.user_id,
    });

    if (!productRoleResult.success) {
      throw new Error(`Agent 1 falhou: ${productRoleResult.message}`);
    }
    
    // Normalizar resposta do Agent 1
    const roles = productRoleResult.roles || [];
    const productContext = productRoleResult.product_context || {};
    const primaryRole = productRoleResult.primary_role || roles[0]?.role_id || "user";
    
    reportProgress(1, "Product & Role Mapper", "completed", 
      `Produto: ${productContext.product_type || "unknown"}, Roles: ${roles.length}`);

    // ========================================
    // AGENT 2: Flow Synthesizer
    // ========================================
    reportProgress(2, "Flow Synthesizer", "running", "Sintetizando fluxo...");
    
    const flowSynthesizerResult = await synthesizeFlow({
      product_context: productContext,
      roles: roles,
      primary_role: primaryRole,
      user_prompt: request.prompt,
      project_id: request.project_id,
      user_id: request.user_id,
    });

    if (!flowSynthesizerResult.success) {
      throw new Error(`Agent 2 falhou: ${flowSynthesizerResult.message}`);
    }
    
    // Normalizar resposta do Agent 2
    const synthesizedFlow = flowSynthesizerResult.synthesized_flow || { steps: [], decisions: [], failure_points: [] };
    const flowSteps = synthesizedFlow.steps || [];
    const analysisResult = flowSynthesizerResult.analysis || { complexity_score: 0 };
    
    // DEBUG: Log step_type values from Flow Synthesizer
    console.log("[Pipeline v3.1] Flow Synthesizer steps detail:");
    flowSteps.forEach((step, idx) => {
      console.log(`  [${idx}] step_id=${step.step_id}, step_type=${step.step_type}, title=${step.title}`);
    });
    
    reportProgress(2, "Flow Synthesizer", "completed", 
      `Steps: ${flowSteps.length}, Complexidade: ${analysisResult.complexity_score}`);

    // ========================================
    // AGENT 3: Archetype Modeler
    // ========================================
    let archetypeModelResult: ArchetypeModelResponse;
    
    if (request.options?.include_archetype_modeling !== false) {
      reportProgress(3, "Archetype Modeler", "running", "Modelando arquétipos...");
      
      archetypeModelResult = await modelArchetype({
        synthesized_flow: synthesizedFlow,
        product_context: productContext,
        project_id: request.project_id,
        user_id: request.user_id,
      });

      if (!archetypeModelResult.success) {
        warnings.push(`Agent 3 com warnings: ${archetypeModelResult.message}`);
      }
      
      // DEBUG: Log what the Archetype Modeler returned
      console.log("[Pipeline v3.1] Archetype Modeler response:");
      console.log("  has enriched_flow:", !!archetypeModelResult.enriched_flow);
      console.log("  enriched_flow keys:", archetypeModelResult.enriched_flow ? Object.keys(archetypeModelResult.enriched_flow) : "N/A");
      console.log("  has rich_nodes:", !!(archetypeModelResult as any).rich_nodes);
      console.log("  archetype_mappings count:", archetypeModelResult.archetype_mappings?.length || 0);
      
      reportProgress(3, "Archetype Modeler", "completed", 
        `Arquétipos: ${archetypeModelResult.analysis?.archetypes_applied || 0}`);
    } else {
      // Pular modelagem de arquétipos
      archetypeModelResult = {
        success: true,
        archetype_mappings: [],
        suggested_archetypes: [],
        patterns_detected: [],
        enriched_flow: synthesizedFlow,
        analysis: { archetypes_applied: 0, coverage_percentage: 0, uncovered_steps: [] },
        message: "Modelagem de arquétipos pulada",
      };
      reportProgress(3, "Archetype Modeler", "completed", "Pulado (opção desativada)");
    }

    // ========================================
    // AGENT 4: Flow Critic
    // ========================================
    reportProgress(4, "Flow Critic", "running", "Validando fluxo...");
    
    let flowCriticResult = await criticizeFlow({
      synthesized_flow: archetypeModelResult.enriched_flow || synthesizedFlow,
      archetype_mappings: archetypeModelResult.archetype_mappings || [],
      product_context: productContext,
      roles: roles,
      project_id: request.project_id,
      user_id: request.user_id,
      validation_level: request.options?.validation_level || "standard",
    });

    if (!flowCriticResult.success) {
      throw new Error(`Agent 4 falhou: ${flowCriticResult.message}`);
    }

    // Aplicar auto-fixes se configurado
    let workingFlow = archetypeModelResult.enriched_flow || synthesizedFlow;
    const criticFindings = flowCriticResult.findings || [];
    
    if (request.options?.auto_fix_issues && criticFindings.some(f => f.auto_fixable)) {
      const autoFixResult = applyAutoFixes(workingFlow, criticFindings);
      const fixed_flow = autoFixResult?.fixed_flow;
      const fixes_applied = autoFixResult?.fixes_applied || [];
      
      if (fixed_flow) {
        workingFlow = fixed_flow;
      }
      
      if (fixes_applied.length > 0) {
        warnings.push(`Auto-fixes aplicados: ${fixes_applied.join(", ")}`);
        
        // Re-validar após fixes
        flowCriticResult = await criticizeFlow({
          synthesized_flow: workingFlow,
          archetype_mappings: archetypeModelResult.archetype_mappings || [],
          product_context: productContext,
          roles: roles,
          project_id: request.project_id,
          user_id: request.user_id,
          validation_level: request.options?.validation_level || "standard",
        });
      }
    }
    
    reportProgress(4, "Flow Critic", "completed", 
      `Score: ${flowCriticResult.integrity_score}%, Válido: ${flowCriticResult.is_valid}`);

    // ========================================
    // AGENT 5: UX Block Composer
    // ========================================
    reportProgress(5, "UX Block Composer", "running", "Compondo blocos UX...");
    
    // DEBUG: Log workingFlow before sending to UX Block Composer
    console.log("[Pipeline v3.1] workingFlow before UX Block Composer:");
    console.log("  workingFlow type:", typeof workingFlow);
    console.log("  workingFlow.steps count:", workingFlow?.steps?.length);
    if (workingFlow?.steps?.length > 0) {
      console.log("  First step keys:", Object.keys(workingFlow.steps[0] || {}));
      console.log("  First step sample:", JSON.stringify(workingFlow.steps[0], null, 2).slice(0, 500));
    }
    
    const uxComposerResult = await composeUXBlocksV3({
      synthesized_flow: workingFlow,
      archetype_mappings: archetypeModelResult.archetype_mappings || [],
      product_context: productContext,
      roles: roles,
      primary_role: primaryRole,
      project_id: request.project_id,
      user_id: request.user_id,
    });

    if (!uxComposerResult.success) {
      throw new Error(`Agent 5 falhou: ${uxComposerResult.message}`);
    }
    
    // Normalizar resposta do Agent 5
    const composedBlocks = uxComposerResult.composed_blocks || [];
    
    reportProgress(5, "UX Block Composer", "completed", 
      `Blocos: ${composedBlocks.length}`);

    // ========================================
    // AGENT 6: Flow Connector & Reusability Tracker
    // ========================================
    reportProgress(6, "Flow Connector", "running", "Conectando fluxo...");
    
    const flowConnectorResult = await connectFlow({
      composed_blocks: composedBlocks,
      synthesized_flow: workingFlow,
      project_id: request.project_id,
      user_id: request.user_id,
    });

    if (!flowConnectorResult.success) {
      throw new Error(`Agent 6 falhou: ${flowConnectorResult.message}`);
    }
    
    // Normalizar campos da resposta (Edge Function pode usar nomes diferentes)
    const connections = flowConnectorResult.connections || [];
    const reusabilityInfo = flowConnectorResult.reusability_info || 
      (flowConnectorResult as any).reuse_report?.details || [];
    const reusedCount = Array.isArray(reusabilityInfo) 
      ? reusabilityInfo.filter((r: any) => r.is_reused || r.reused).length 
      : 0;
    
    reportProgress(6, "Flow Connector", "completed", 
      `Conexões: ${connections.length}, Reuso: ${reusedCount}`);

    // ========================================
    // RESULTADO FINAL
    // ========================================
    const executionTime = Date.now() - startTime;

    // Usar nós finais da Edge Function se disponíveis, senão converter localmente
    let finalNodes: V3FlowNode[] = [];
    
    if ((flowConnectorResult as any).final_nodes?.length > 0) {
      // A Edge Function já retornou os nós finais
      finalNodes = (flowConnectorResult as any).final_nodes;
    } else if (composedBlocks.length > 0) {
      // Converter blocos em nós finais localmente
      finalNodes = convertBlocksToNodes(
        composedBlocks,
        connections,
        String((flowConnectorResult as any).flow_id || "temp")
      );
    }

    const response: V3PipelineResponse = {
      success: true,
      product_role_result: productRoleResult,
      flow_synthesis_result: flowSynthesizerResult,
      archetype_model_result: archetypeModelResult,
      flow_critic_result: flowCriticResult,
      ux_composer_result: uxComposerResult,
      flow_connector_result: flowConnectorResult,
      flow_id: (flowConnectorResult as any).flow_id || 0,
      master_rule_id: 0,
      sub_rule_ids: [],
      final_nodes: finalNodes,
      final_connections: connections,
      summary: {
        total_nodes: finalNodes.length,
        total_connections: connections.length,
        integrity_score: flowCriticResult.integrity_score,
        reused_nodes_count: reusedCount,
        execution_time_ms: executionTime,
        warnings,
      },
      message: `Pipeline v3.1 concluída em ${executionTime}ms. Score: ${flowCriticResult.integrity_score}%`,
    };

    console.log("[Pipeline v3.1] Concluída:", {
      nodes: finalNodes.length,
      connections: connections.length,
      score: flowCriticResult.integrity_score,
      time_ms: executionTime,
    });

    return response;

  } catch (error) {
    // Extrair mensagem de erro, tratando diferentes tipos
    let errorMessage: string;
    
    if (error instanceof Error) {
      errorMessage = error.message;
    } else if (typeof error === "object" && error !== null) {
      // AgentError ou outro objeto de erro
      errorMessage = (error as any).message || JSON.stringify(error);
    } else {
      errorMessage = String(error);
    }
    
    console.error("[Pipeline v3.1] Erro:", errorMessage);
    
    throw new Error(`Pipeline v3.1 falhou: ${errorMessage}`);
  }
}

/**
 * Continua a criação de fluxo a partir de um estado intermediário
 */
export async function continueV3Pipeline(
  fromAgent: number,
  previousResults: Partial<V3PipelineResponse>,
  request: V3PipelineRequest,
  onProgress?: ProgressCallback
): Promise<V3PipelineResponse> {
  // Implementação simplificada - reinicia do agente especificado
  // Em produção, restauraria o estado dos agentes anteriores
  return executeV3Pipeline(request, onProgress);
}

/**
 * Retenta um agente específico com correções
 */
export async function retryV3Agent(
  agentNumber: number,
  corrections: Record<string, unknown>,
  previousResults: Partial<V3PipelineResponse>,
  request: V3PipelineRequest
): Promise<Partial<V3PipelineResponse>> {
  // Implementação para retry de agente específico
  console.log(`[Pipeline v3.1] Retrying agent ${agentNumber} with corrections:`, corrections);
  
  // Por enquanto, re-executa a pipeline completa
  return executeV3Pipeline(request);
}

/**
 * Valida se os resultados de uma pipeline são consistentes
 */
export function validatePipelineResults(results: Partial<V3PipelineResponse>): {
  is_valid: boolean;
  issues: string[];
} {
  const issues: string[] = [];

  if (!results.product_role_result?.success) {
    issues.push("Resultado do Product & Role Mapper inválido");
  }

  if (!results.flow_synthesis_result?.success) {
    issues.push("Resultado do Flow Synthesizer inválido");
  }

  if (!results.flow_critic_result?.is_valid) {
    issues.push("Fluxo não passou na validação do Flow Critic");
  }

  if (!results.final_nodes || results.final_nodes.length === 0) {
    issues.push("Nenhum nó final gerado");
  }

  return {
    is_valid: issues.length === 0,
    issues,
  };
}
