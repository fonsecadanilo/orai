import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * AGENTE: Flow Generator v3.1
 * 
 * ARQUITETURA 100% CÓDIGO DETERMINÍSTICO
 * 
 * Recebe nós simbólicos e transforma em grafo visual conectado.
 * SEMPRE cria conexões entre os nós, mesmo se não especificadas.
 */

// ========================================
// TIPOS
// ========================================

interface SubRuleNode {
  id: string;
  type: "trigger" | "action" | "condition" | "end" | "subflow";
  title: string;
  description: string;
  next_on_success?: string | null;
  next_on_failure?: string | null;
  end_status?: "success" | "error";
}

interface EngineNode {
  id: string;
  symbolic_id: string;
  type: string;
  title: string;
  description: string;
  order_index: number;
  position_x: number;
  position_y: number;
  column: "main" | "error" | "alternative";
  depth: number;
  end_status?: "success" | "error";
}

interface EngineEdge {
  id: string;
  source: string;
  target: string;
  type: "success" | "failure" | "default";
  label?: string;
  animated: boolean;
  style?: Record<string, unknown>;
}

interface LayoutConfig {
  nodeSpacingX: number;
  nodeSpacingY: number;
  startX: number;
  startY: number;
  errorPathYOffset: number;
}

// ========================================
// ENGINE FUNCTIONS
// ========================================

const DEFAULT_LAYOUT_CONFIG: LayoutConfig = {
  nodeSpacingX: 280,
  nodeSpacingY: 180,
  startX: 100,
  startY: 300,
  errorPathYOffset: 200,
};

/**
 * Constrói o grafo completo com nós e edges
 */
function buildGraph(
  inputNodes: SubRuleNode[],
  config: LayoutConfig = DEFAULT_LAYOUT_CONFIG
): { nodes: EngineNode[]; edges: EngineEdge[]; nodeIdMap: Map<string, string> } {
  const nodeIdMap = new Map<string, string>();
  
  // Garantir dados válidos
  if (!inputNodes || inputNodes.length === 0) {
    return createMinimalFlow(config, nodeIdMap);
  }

  // Normalizar e preparar nós
  const subrules = normalizeNodes(inputNodes);
  
  // 🔧 CORREÇÃO: Criar mapeamento ANTES de separar os nós
  // Isso garante que todas as referências possam ser resolvidas
  subrules.forEach((node, idx) => {
    const engineId = `node_${idx + 1}`;
    
    // Mapear pelo ID simbólico original
    nodeIdMap.set(node.id, engineId);
    
    // Mapear pelo índice (para compatibilidade com referências numéricas antigas)
    nodeIdMap.set(String(idx + 1), engineId);
    
    // Mapear pelo próprio engineId
    nodeIdMap.set(engineId, engineId);
  });
  
  console.log("[flow-generator] nodeIdMap inicial:", Object.fromEntries(nodeIdMap));
  
  // Separar nós principais e de erro
  const mainNodes: SubRuleNode[] = [];
  const errorNodes: SubRuleNode[] = [];
  
  for (const node of subrules) {
    if (node.type === "end" && node.end_status === "error") {
      errorNodes.push(node);
    } else if (node.title?.toLowerCase().includes("erro") || node.description?.toLowerCase().includes("erro")) {
      errorNodes.push({ ...node, end_status: "error" });
    } else {
      mainNodes.push(node);
    }
  }

  // Criar nós da engine - primeiro os principais, depois os de erro
  const engineNodes: EngineNode[] = [];
  let orderIndex = 1;

  // Nós principais (caminho feliz)
  for (let i = 0; i < mainNodes.length; i++) {
    const node = mainNodes[i];
    // Usar o ID já mapeado
    const nodeId = nodeIdMap.get(node.id) || `node_${orderIndex}`;
    
    engineNodes.push({
      id: nodeId,
      symbolic_id: node.id,
      type: node.type,
      title: node.title,
      description: node.description || "",
      order_index: orderIndex,
      position_x: config.startX + i * config.nodeSpacingX,
      position_y: config.startY,
      column: "main",
      depth: i,
      end_status: node.type === "end" ? (node.end_status || "success") : undefined,
    });
    orderIndex++;
  }

  // Nós de erro (abaixo)
  for (let i = 0; i < errorNodes.length; i++) {
    const node = errorNodes[i];
    // Usar o ID já mapeado
    const nodeId = nodeIdMap.get(node.id) || `node_${orderIndex}`;
    
    // Posicionar abaixo, alinhado com nós de condição se houver
    const conditionNodes = engineNodes.filter(n => n.type === "condition");
    const baseX = conditionNodes.length > 0 
      ? conditionNodes[Math.min(i, conditionNodes.length - 1)].position_x + config.nodeSpacingX
      : config.startX + (mainNodes.length + i) * config.nodeSpacingX;
    
    engineNodes.push({
      id: nodeId,
      symbolic_id: node.id,
      type: node.type || "end",
      title: node.title,
      description: node.description || "",
      order_index: orderIndex,
      position_x: baseX,
      position_y: config.startY + config.errorPathYOffset,
      column: "error",
      depth: mainNodes.length + i,
      end_status: "error",
    });
    orderIndex++;
  }

  // Criar edges - SEMPRE conectar nós
  const edges = buildEdgesAlways(engineNodes, mainNodes, errorNodes, nodeIdMap, subrules);

  // 🔧 CORREÇÃO: Validar que edges foram criadas
  if (edges.length === 0 && engineNodes.length > 1) {
    console.error("[flow-generator] ALERTA: Nenhuma edge foi criada! Tentando fallback...");
    
    // Criar edges sequenciais como último recurso
    for (let i = 0; i < engineNodes.length - 1; i++) {
      const current = engineNodes[i];
      const next = engineNodes[i + 1];
      
      if (current.type !== "end") {
        edges.push({
          id: `edge_fallback_${i + 1}`,
          source: current.id,
          target: next.id,
          type: "success",
          label: current.type === "condition" ? "Sim" : undefined,
          animated: false,
        });
      }
    }
    
    console.log("[flow-generator] Edges de fallback criadas:", edges.length);
  }

  return { nodes: engineNodes, edges, nodeIdMap };
}

/**
 * Normaliza os nós de entrada
 */
function normalizeNodes(nodes: SubRuleNode[]): SubRuleNode[] {
  const result = [...nodes];
  
  // Garantir que o primeiro nó é trigger
  if (result.length > 0 && result[0].type !== "trigger") {
    result[0] = { ...result[0], type: "trigger" };
  }
  
  // Garantir que há pelo menos um end de sucesso
  const hasSuccessEnd = result.some(n => n.type === "end" && n.end_status === "success");
  if (!hasSuccessEnd && result.length > 0) {
    // Encontrar último nó que não seja trigger ou condition
    let lastValidIdx = result.length - 1;
    while (lastValidIdx >= 0 && (result[lastValidIdx].type === "trigger" || result[lastValidIdx].type === "condition")) {
      lastValidIdx--;
    }
    
    if (lastValidIdx >= 0) {
      result[lastValidIdx] = { 
        ...result[lastValidIdx], 
        type: "end", 
        end_status: "success" 
      };
    } else {
      // Adicionar end
      result.push({
        id: "auto_end_success",
        type: "end",
        title: "Fluxo Concluído",
        description: "Término bem-sucedido",
        end_status: "success",
      });
    }
  }
  
  return result;
}

/**
 * Cria fluxo mínimo quando não há nós
 */
function createMinimalFlow(
  config: LayoutConfig,
  nodeIdMap: Map<string, string>
): { nodes: EngineNode[]; edges: EngineEdge[]; nodeIdMap: Map<string, string> } {
  nodeIdMap.set("auto_trigger", "node_1");
  nodeIdMap.set("auto_end", "node_2");
  
  return {
    nodes: [
      {
        id: "node_1",
        symbolic_id: "auto_trigger",
        type: "trigger",
        title: "Início do Fluxo",
        description: "Ponto de entrada",
        order_index: 1,
        position_x: config.startX,
        position_y: config.startY,
        column: "main",
        depth: 0,
      },
      {
        id: "node_2",
        symbolic_id: "auto_end",
        type: "end",
        title: "Fim do Fluxo",
        description: "Término",
        order_index: 2,
        position_x: config.startX + config.nodeSpacingX,
        position_y: config.startY,
        column: "main",
        depth: 1,
        end_status: "success",
      },
    ],
    edges: [
      {
        id: "edge_1",
        source: "node_1",
        target: "node_2",
        type: "success",
        animated: false,
      },
    ],
    nodeIdMap,
  };
}

/**
 * SEMPRE cria edges entre os nós
 * - Primeiro tenta usar conexões explícitas (next_on_success, next_on_failure)
 * - Depois garante conexões sequenciais para nós sem conexão
 * - Conecta conditions aos nós de erro
 */
function buildEdgesAlways(
  engineNodes: EngineNode[],
  mainNodes: SubRuleNode[],
  errorNodes: SubRuleNode[],
  nodeIdMap: Map<string, string>,
  originalNodes: SubRuleNode[]
): EngineEdge[] {
  const edges: EngineEdge[] = [];
  let edgeIndex = 1;
  
  // Separar nós por coluna
  const mainEngineNodes = engineNodes.filter(n => n.column === "main");
  const errorEngineNodes = engineNodes.filter(n => n.column === "error");
  
  // Ordenar por order_index
  mainEngineNodes.sort((a, b) => a.order_index - b.order_index);
  errorEngineNodes.sort((a, b) => a.order_index - b.order_index);

  console.log(`[flow-generator] buildEdgesAlways: ${mainEngineNodes.length} main, ${errorEngineNodes.length} error`);
  console.log(`[flow-generator] nodeIdMap size: ${nodeIdMap.size}`);
  
  // Criar mapa reverso: engine_id -> symbolic_id
  const reverseIdMap = new Map<string, string>();
  for (const [symbolicId, engineId] of nodeIdMap.entries()) {
    reverseIdMap.set(engineId, symbolicId);
  }

  // Set para rastrear quais nós já têm conexão de saída
  const nodesWithSuccessEdge = new Set<string>();
  const nodesWithFailureEdge = new Set<string>();

  // 1. Primeiro, tentar usar conexões explícitas dos nós originais
  for (const node of originalNodes) {
    const sourceId = nodeIdMap.get(node.id);
    if (!sourceId) {
      console.log(`[flow-generator] Node "${node.id}" não encontrado no nodeIdMap`);
      continue;
    }
    
    // Conexão de sucesso
    if (node.next_on_success) {
      const targetId = nodeIdMap.get(node.next_on_success);
      if (targetId) {
        edges.push({
          id: `edge_${edgeIndex++}`,
          source: sourceId,
          target: targetId,
          type: "success",
          label: node.type === "condition" ? "Sim" : undefined,
          animated: false,
        });
        nodesWithSuccessEdge.add(sourceId);
        console.log(`[flow-generator] Edge explícita: ${sourceId} -> ${targetId} (success)`);
      } else {
        console.log(`[flow-generator] Target "${node.next_on_success}" não encontrado para "${node.id}"`);
      }
    }
    
    // Conexão de falha
    if (node.next_on_failure) {
      const targetId = nodeIdMap.get(node.next_on_failure);
      if (targetId) {
        edges.push({
          id: `edge_${edgeIndex++}`,
          source: sourceId,
          target: targetId,
          type: "failure",
          label: "Não",
          animated: false,
          style: { stroke: "#ef4444", strokeDasharray: "5,5" },
        });
        nodesWithFailureEdge.add(sourceId);
        console.log(`[flow-generator] Edge explícita: ${sourceId} -> ${targetId} (failure)`);
      }
    }
  }

  console.log(`[flow-generator] Após conexões explícitas: ${edges.length} edges`);

  // 2. GARANTIR conexões sequenciais para TODOS os nós do caminho principal
  // Isso é o fallback mais importante - conecta nós em ordem se não houver conexão explícita
  for (let i = 0; i < mainEngineNodes.length; i++) {
    const currentNode = mainEngineNodes[i];
    
    // Nós end não têm conexão de saída
    if (currentNode.type === "end") continue;
    
    // Verificar se já tem conexão de sucesso
    if (!nodesWithSuccessEdge.has(currentNode.id)) {
      // Encontrar próximo nó que não seja end de erro
      let nextNode: EngineNode | null = null;
      for (let j = i + 1; j < mainEngineNodes.length; j++) {
        const candidate = mainEngineNodes[j];
        // Pular nós de erro no caminho principal
        if (candidate.type !== "end" || candidate.end_status !== "error") {
          nextNode = candidate;
          break;
        }
      }
      
      if (nextNode) {
        edges.push({
          id: `edge_${edgeIndex++}`,
          source: currentNode.id,
          target: nextNode.id,
          type: "success",
          label: currentNode.type === "condition" ? "Sim" : undefined,
          animated: false,
        });
        nodesWithSuccessEdge.add(currentNode.id);
        console.log(`[flow-generator] Edge sequencial: ${currentNode.id} -> ${nextNode.id}`);
      }
    }
    
    // Se for condition e não tem conexão de falha, conectar ao primeiro erro
    if (currentNode.type === "condition" && !nodesWithFailureEdge.has(currentNode.id)) {
      if (errorEngineNodes.length > 0) {
        const errorNode = errorEngineNodes[0];
        edges.push({
          id: `edge_${edgeIndex++}`,
          source: currentNode.id,
          target: errorNode.id,
          type: "failure",
          label: "Não",
          animated: false,
          style: { stroke: "#ef4444", strokeDasharray: "5,5" },
        });
        nodesWithFailureEdge.add(currentNode.id);
        console.log(`[flow-generator] Edge de erro: ${currentNode.id} -> ${errorNode.id}`);
      }
    }
  }

  console.log(`[flow-generator] Total de ${edges.length} conexões criadas`);
  return edges;
}

/**
 * Valida o grafo
 */
function validateGraph(
  nodes: EngineNode[],
  edges: EngineEdge[]
): { isValid: boolean; errors: string[]; warnings: string[]; score: number } {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  const triggers = nodes.filter(n => n.type === "trigger");
  const successEnds = nodes.filter(n => n.type === "end" && n.end_status === "success");
  
  if (triggers.length === 0) errors.push("NO_TRIGGER");
  if (triggers.length > 1) warnings.push("MULTIPLE_TRIGGERS");
  if (successEnds.length === 0) errors.push("NO_SUCCESS_END");
  
  // 🔧 CORREÇÃO: Verificar se há edges quando há múltiplos nós
  if (nodes.length > 1 && edges.length === 0) {
    errors.push("NO_CONNECTIONS: Flow has multiple nodes but no connections");
  }
  
  // Verificar se todas as conditions têm ambos os caminhos
  const conditions = nodes.filter(n => n.type === "condition");
  for (const condition of conditions) {
    const outgoingEdges = edges.filter(e => e.source === condition.id);
    const hasSuccess = outgoingEdges.some(e => e.type === "success" || e.label === "Sim");
    const hasFailure = outgoingEdges.some(e => e.type === "failure" || e.label === "Não");
    
    if (outgoingEdges.length === 0) {
      errors.push(`CONDITION_NO_EDGES: ${condition.title} has no outgoing edges`);
    } else if (!hasSuccess || !hasFailure) {
      warnings.push(`CONDITION_INCOMPLETE: ${condition.title} missing ${!hasSuccess ? 'success' : 'failure'} path`);
    }
  }
  
  // Verificar conectividade - nós sem saída (exceto ends)
  const nodesWithOutput = new Set(edges.map(e => e.source));
  for (const node of nodes) {
    if (node.type !== "end" && !nodesWithOutput.has(node.id)) {
      warnings.push(`DISCONNECTED_OUTPUT: ${node.title} has no outgoing connection`);
    }
  }
  
  // Verificar conectividade - nós sem entrada (exceto trigger)
  const nodesWithInput = new Set(edges.map(e => e.target));
  for (const node of nodes) {
    if (node.type !== "trigger" && !nodesWithInput.has(node.id)) {
      warnings.push(`ORPHAN_NODE: ${node.title} has no incoming connection`);
    }
  }
  
  // 🔧 CORREÇÃO: Score mais severo para problemas de conectividade
  let score = 100;
  score -= errors.length * 25; // Erros são mais graves
  score -= warnings.length * 5;
  
  // Penalidade extra se não há conexões
  if (edges.length === 0 && nodes.length > 1) {
    score = 0;
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    score: Math.max(0, Math.min(100, score)),
  };
}

// ========================================
// HANDLER PRINCIPAL
// ========================================

Deno.serve(async (req: Request) => {
  console.log("[flow-generator] ========== INÍCIO DA REQUISIÇÃO ==========");
  console.log("[flow-generator] Method:", req.method);
  console.log("[flow-generator] URL:", req.url);
  
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    console.log("[flow-generator] Respondendo OPTIONS (CORS preflight)");
    return new Response("ok", { headers: corsHeaders });
  }

  // Wrapper de erro global para capturar QUALQUER exceção
  try {
    return await handleRequest(req);
  } catch (globalError) {
    console.error("[flow-generator] ❌ ERRO GLOBAL NÃO TRATADO:", globalError);
    console.error("[flow-generator] Stack:", (globalError as Error)?.stack || "N/A");
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        message: "Erro interno não tratado: " + String(globalError),
        error_type: (globalError as Error)?.constructor?.name || "Unknown",
        stack: (globalError as Error)?.stack?.split("\n").slice(0, 5) || []
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// Handler principal separado para melhor tratamento de erros
async function handleRequest(req: Request): Promise<Response> {
  try {
    // 1. Parse request body
    let body;
    try {
      const rawBody = await req.text();
      console.log("[flow-generator] Raw body length:", rawBody.length);
      
      if (!rawBody || rawBody.trim() === "") {
        return new Response(
          JSON.stringify({ success: false, message: "Body vazio" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      body = JSON.parse(rawBody);
    } catch (parseError) {
      console.error("[flow-generator] Erro ao parsear body:", parseError);
      return new Response(
        JSON.stringify({ success: false, message: "Body inválido: " + String(parseError) }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { master_rule_id, symbolic_nodes, project_id, user_id, layout_options } = body;

    console.log("[flow-generator] Recebido:", {
      master_rule_id,
      project_id,
      user_id,
      nodes_count: symbolic_nodes?.length || 0,
      first_node: symbolic_nodes?.[0] || null,
    });

    // 2. Validate required fields
    if (!master_rule_id || !project_id || !user_id) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: `Campos obrigatórios faltando: ${!master_rule_id ? 'master_rule_id ' : ''}${!project_id ? 'project_id ' : ''}${!user_id ? 'user_id' : ''}`.trim()
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. Validate symbolic_nodes
    if (!symbolic_nodes || !Array.isArray(symbolic_nodes)) {
      console.error("[flow-generator] symbolic_nodes inválido:", symbolic_nodes);
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: "symbolic_nodes é obrigatório e deve ser um array"
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (symbolic_nodes.length === 0) {
      console.warn("[flow-generator] symbolic_nodes vazio, criando fluxo mínimo");
    }

    // 4. Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseKey) {
      console.error("[flow-generator] Variáveis de ambiente faltando");
      return new Response(
        JSON.stringify({ success: false, message: "Configuração do servidor incompleta" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // 5. Buscar regra master
    console.log("[flow-generator] Buscando regra master:", master_rule_id);
    
    let flowName = "Fluxo sem nome";
    let flowDescription = "";
    
    try {
      const { data: masterRule, error: masterRuleError } = await supabase
        .from("rules")
        .select("title, description")
        .eq("id", master_rule_id)
        .single();

      if (masterRuleError) {
        console.warn("[flow-generator] Erro ao buscar regra master:", masterRuleError);
        // Continuar mesmo sem encontrar a regra
      } else if (masterRule) {
        flowName = masterRule.title || "Fluxo sem nome";
        flowDescription = masterRule.description || "";
      }
    } catch (masterQueryError) {
      console.warn("[flow-generator] Exceção ao buscar regra master:", masterQueryError);
    }

    console.log("[flow-generator] Nome do fluxo:", flowName);

    // 6. Configuração de layout
    const config: LayoutConfig = { ...DEFAULT_LAYOUT_CONFIG, ...(layout_options || {}) };
    
    // 7. Construir grafo
    console.log("[flow-generator] Construindo grafo com", symbolic_nodes.length, "nós...");
    
    let nodes: EngineNode[];
    let edges: EngineEdge[];
    let nodeIdMap: Map<string, string>;
    
    try {
      const graphResult = buildGraph(symbolic_nodes as SubRuleNode[], config);
      nodes = graphResult.nodes;
      edges = graphResult.edges;
      nodeIdMap = graphResult.nodeIdMap;
    } catch (buildError) {
      console.error("[flow-generator] Erro ao construir grafo:", buildError);
      return new Response(
        JSON.stringify({ success: false, message: "Erro ao construir grafo: " + String(buildError) }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    console.log("[flow-generator] Grafo construído:", {
      nodes: nodes.length,
      edges: edges.length,
      nodeIdMap_size: nodeIdMap.size,
    });

    // 8. Validar
    const validation = validateGraph(nodes, edges);
    console.log("[flow-generator] Validação:", validation);

    // 9. Salvar flow no banco
    console.log("[flow-generator] Salvando flow no banco...");
    
    let savedFlow;
    try {
      const { data, error: flowError } = await supabase
        .from("flows")
        .insert({
          project_id,
          name: flowName,
          description: flowDescription,
          metadata: {
            source: "flow-generator-v3.1",
            validation_passed: validation.isValid,
            validation_score: validation.score,
          },
        })
        .select("id")
        .single();

      if (flowError) {
        console.error("[flow-generator] Erro ao criar flow:", flowError);
        return new Response(
          JSON.stringify({ 
            success: false, 
            message: "Erro ao criar flow: " + (flowError.message || JSON.stringify(flowError)),
            details: flowError 
          }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (!data) {
        console.error("[flow-generator] Flow criado mas sem ID retornado");
        return new Response(
          JSON.stringify({ success: false, message: "Flow criado mas sem ID retornado" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      savedFlow = data;
      console.log("[flow-generator] Flow criado com ID:", savedFlow.id);
    } catch (flowSaveError) {
      console.error("[flow-generator] Exceção ao salvar flow:", flowSaveError);
      return new Response(
        JSON.stringify({ success: false, message: "Exceção ao salvar flow: " + String(flowSaveError) }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 10. Salvar nós
    console.log("[flow-generator] Salvando", nodes.length, "nós...");
    
    const dbNodeIdMap: Record<string, number> = {};
    const createdNodes: Array<EngineNode & { db_id: number }> = [];
    const failedNodes: Array<{ node: EngineNode; error: string }> = [];

    for (const node of nodes) {
      try {
        const { data: savedNode, error: nodeError } = await supabase
          .from("nodes")
          .insert({
            flow_id: savedFlow.id,
            type: node.type === "text" ? "note" : node.type,
            title: node.title || "Sem título",
            description: node.description || "",
            position_x: node.position_x || 0,
            position_y: node.position_y || 0,
            metadata: {
              symbolic_id: node.symbolic_id,
              order_index: node.order_index,
              column: node.column,
              depth: node.depth,
              status: node.end_status,
            },
          })
          .select("id")
          .single();

        if (nodeError) {
          console.error(`[flow-generator] Erro ao salvar nó "${node.id}":`, nodeError);
          failedNodes.push({ node, error: nodeError.message || String(nodeError) });
        } else if (savedNode) {
          dbNodeIdMap[node.id] = savedNode.id;
          createdNodes.push({ ...node, db_id: savedNode.id });
        }
      } catch (nodeSaveError) {
        console.error(`[flow-generator] Exceção ao salvar nó "${node.id}":`, nodeSaveError);
        failedNodes.push({ node, error: String(nodeSaveError) });
      }
    }

    console.log("[flow-generator] Nós salvos:", createdNodes.length, "/ Falhas:", failedNodes.length);

    // Se nenhum nó foi salvo, retornar erro
    if (createdNodes.length === 0 && nodes.length > 0) {
      console.error("[flow-generator] Nenhum nó foi salvo!");
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: "Nenhum nó foi salvo no banco",
          details: { failedNodes: failedNodes.slice(0, 5) }
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 🔧 CORREÇÃO: Log detalhado das edges antes de salvar
    console.log("[flow-generator] Edges a serem salvas:", edges.length);
    console.log("[flow-generator] dbNodeIdMap:", dbNodeIdMap);
    
    // Salvar conexões
    const createdConnections = [];
    const failedConnections = [];
    
    for (const edge of edges) {
      const sourceDbId = dbNodeIdMap[edge.source];
      const targetDbId = dbNodeIdMap[edge.target];

      console.log(`[flow-generator] Tentando salvar edge: ${edge.source} (db:${sourceDbId}) -> ${edge.target} (db:${targetDbId})`);

      if (sourceDbId && targetDbId) {
        const { data: savedConn, error: connError } = await supabase
          .from("connections")
          .insert({
            flow_id: savedFlow.id,
            source_node_id: sourceDbId,
            target_node_id: targetDbId,
            label: edge.label || null,
            // Nota: A tabela connections não tem coluna metadata
          })
          .select("id")
          .single();

        if (connError) {
          console.error(`[flow-generator] Erro ao salvar connection:`, connError);
          failedConnections.push({ edge, error: connError });
        } else if (savedConn) {
          console.log(`[flow-generator] Connection salva: ${savedConn.id}`);
          createdConnections.push({
            id: savedConn.id,
            source_id: edge.source,
            target_id: edge.target,
            source_node_id: sourceDbId,
            target_node_id: targetDbId,
            label: edge.label,
            type: edge.type,
          });
        }
      } else {
        console.warn(`[flow-generator] Edge ignorada - IDs não encontrados: source=${edge.source}, target=${edge.target}`);
        failedConnections.push({ edge, error: "IDs não encontrados no dbNodeIdMap" });
      }
    }

    // 🔧 CORREÇÃO: Validação crítica - garantir que connections foram salvas
    if (edges.length > 0 && createdConnections.length === 0) {
      console.error("[flow-generator] ERRO CRÍTICO: Nenhuma connection foi salva!");
      console.error("[flow-generator] Edges tentadas:", edges.length);
      console.error("[flow-generator] Falhas:", failedConnections);
      
      // Retornar erro em vez de sucesso falso
      return new Response(
        JSON.stringify({
          success: false,
          message: "EDGE_SAVE_ERROR: Edges foram geradas mas nenhuma foi salva no banco",
          details: {
            edges_count: edges.length,
            saved_count: 0,
            failed: failedConnections,
            dbNodeIdMap,
          },
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    // Log de warning se algumas falharam
    if (failedConnections.length > 0) {
      console.warn(`[flow-generator] ${failedConnections.length} conexões falharam ao salvar`);
    }

    // 12. Vincular flow à regra master
    console.log("[flow-generator] Vinculando flow à regra master...");
    try {
      await supabase
        .from("rules")
        .update({ flow_id: savedFlow.id, updated_at: new Date().toISOString() })
        .eq("id", master_rule_id);
    } catch (linkError) {
      console.warn("[flow-generator] Erro ao vincular flow (não crítico):", linkError);
    }

    // 13. Estatísticas finais
    const stats = {
      total_nodes: createdNodes.length,
      total_connections: createdConnections.length,
      triggers: createdNodes.filter(n => n.type === "trigger").length,
      actions: createdNodes.filter(n => n.type === "action").length,
      conditions: createdNodes.filter(n => n.type === "condition").length,
      ends_success: createdNodes.filter(n => n.type === "end" && n.end_status === "success").length,
      ends_error: createdNodes.filter(n => n.type === "end" && n.end_status === "error").length,
      failed_nodes: failedNodes.length,
      failed_connections: failedConnections.length,
    };

    console.log("[flow-generator] ✅ Sucesso! Stats:", stats);

    // Criar resposta de forma segura para evitar erros de serialização
    const safeNodes = createdNodes.map(n => ({
      id: n.id,
      db_id: n.db_id,
      type: n.type,
      title: n.title || "",
      description: n.description || "",
      position_x: n.position_x || 0,
      position_y: n.position_y || 0,
      order_index: n.order_index,
      column: n.column,
      depth: n.depth,
      end_status: n.end_status,
      symbolic_id: n.symbolic_id,
    }));

    const safeConnections = createdConnections.map(c => ({
      id: c.id,
      source_id: c.source_id,
      target_id: c.target_id,
      source_node_id: c.source_node_id,
      target_node_id: c.target_node_id,
      label: c.label || null,
      type: c.type,
    }));

    const safeValidation = {
      isValid: validation.isValid || false,
      score: typeof validation.score === 'number' ? validation.score : 0,
      errors: Array.isArray(validation.errors) ? validation.errors : [],
      warnings: Array.isArray(validation.warnings) ? validation.warnings : [],
    };

    const responseData = {
      success: true,
      flow_id: savedFlow.id,
      generated_flow: {
        id: savedFlow.id,
        name: flowName || "Fluxo sem nome",
        description: flowDescription || "",
        flow_master_rule_id: master_rule_id,
        nodes: safeNodes,
        connections: safeConnections,
        stats,
      },
      linked_rules: { flow_master_rule_id: master_rule_id },
      validation: safeValidation,
      warnings: [
        ...(failedNodes.length > 0 ? [`${failedNodes.length} nós não foram salvos`] : []),
        ...(failedConnections.length > 0 ? [`${failedConnections.length} conexões não foram salvas`] : []),
      ],
      message: `Fluxo criado com ${stats.total_nodes} nós e ${stats.total_connections} conexões`,
    };

    // Tentar serializar e verificar se há erros
    let jsonResponse: string;
    try {
      jsonResponse = JSON.stringify(responseData);
    } catch (serializationError) {
      console.error("[flow-generator] Erro de serialização:", serializationError);
      // Retornar resposta mínima se a serialização falhar
      return new Response(
        JSON.stringify({
          success: true,
          flow_id: savedFlow.id,
          message: `Fluxo criado com ${stats.total_nodes} nós (resposta simplificada devido a erro de serialização)`,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(jsonResponse, { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error) {
    console.error("[flow-generator] ❌ Erro não tratado no handleRequest:", error);
    
    // Tentar extrair mais informações do erro
    let errorMessage = String(error);
    if (error instanceof Error) {
      errorMessage = error.message;
      if (error.stack) {
        console.error("[flow-generator] Stack trace:", error.stack);
      }
    }
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        message: "Erro interno: " + errorMessage,
        error_type: (error as Error)?.constructor?.name || "Unknown"
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
}
