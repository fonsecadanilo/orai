import { supabase } from "@/lib/supabase/client";
import type {
  FlowGeneratorRequest,
  FlowGeneratorResponse,
  SubrulesDecomposerResponse,
  SymbolicNode,
  UserJourney,
  SuggestedFeature,
  AgentError,
} from "./types";

const EDGE_FUNCTION_URL = "flow-generator";

/**
 * Agente 3: Flow Generator v3.0
 * 
 * NOVA ARQUITETURA - 100% CÓDIGO DETERMINÍSTICO
 * 
 * Este agente NÃO usa IA para gerar o fluxo visual.
 * Ele recebe os nós simbólicos e transforma em um grafo visual
 * usando a engine determinística no servidor.
 * 
 * O cliente envia: symbolic_nodes (do Subrules Decomposer)
 * O servidor faz: buildGraph → assignOrderIndex → assignLayout → validateGraph
 */
export async function generateFlow(
  masterRuleId: number,
  subRulesOrSymbolicNodes: SubrulesDecomposerResponse["sub_rules"] | SymbolicNode[],
  flowStructure: SubrulesDecomposerResponse["flow_structure"],
  dependencyGraph: SubrulesDecomposerResponse["dependency_graph"],
  projectId: number,
  userId: number,
  options?: {
    layoutOptions?: {
      orientation?: "vertical" | "horizontal";
      spacing?: "compact" | "normal" | "spacious";
      showErrorPaths?: boolean;
      showValidationNodes?: boolean;
      groupRelatedNodes?: boolean;
    };
    conversationId?: string;
    userJourney?: UserJourney;
    suggestedFeatures?: SuggestedFeature[];
    // Se passar nós simbólicos diretamente
    symbolicNodes?: SymbolicNode[];
  }
): Promise<FlowGeneratorResponse> {
  // Usar nós simbólicos se fornecidos diretamente, senão converter de sub_rules
  let symbolicNodes: SymbolicNode[];
  
  if (options?.symbolicNodes && options.symbolicNodes.length > 0) {
    // Nós simbólicos fornecidos diretamente
    symbolicNodes = options.symbolicNodes;
  } else if (isSymbolicNodeArray(subRulesOrSymbolicNodes)) {
    // Já são nós simbólicos
    symbolicNodes = subRulesOrSymbolicNodes;
  } else {
    // Converter sub_rules para nós simbólicos
    symbolicNodes = convertSubRulesToSymbolicNodes(subRulesOrSymbolicNodes);
  }

  // Garantir estrutura válida
  symbolicNodes = ensureValidGraphStructure(symbolicNodes);

  // Configurar layout options
  const layoutOptions = {
    nodeSpacingX: options?.layoutOptions?.spacing === "spacious" ? 350 : 
                  options?.layoutOptions?.spacing === "compact" ? 220 : 280,
    nodeSpacingY: 180,
    startX: 100,
    startY: 300,
    errorPathYOffset: 180,
  };

  const requestBody = {
    master_rule_id: masterRuleId,
    symbolic_nodes: symbolicNodes, // Campo esperado pela Edge Function
    project_id: projectId,
    user_id: userId,
    layout_options: layoutOptions,
  };

  console.log("[flow-generator] Enviando para Edge Function:", {
    master_rule_id: masterRuleId,
    symbolic_nodes_count: symbolicNodes.length,
    symbolic_nodes: symbolicNodes,
  });

  const { data, error } = await supabase.functions.invoke<FlowGeneratorResponse>(
    EDGE_FUNCTION_URL,
    {
      body: requestBody,
    }
  );

  if (error) {
    console.error("Erro ao chamar flow-generator:", error);
    throw {
      code: "EDGE_FUNCTION_ERROR",
      message: error.message || "Erro ao conectar com o agente de fluxo",
      details: error,
    } as AgentError;
  }

  if (!data) {
    throw {
      code: "EMPTY_RESPONSE",
      message: "Resposta vazia do agente de fluxo",
    } as AgentError;
  }

  if (!data.success) {
    throw {
      code: "AGENT_ERROR",
      message: data.message || "Erro ao gerar fluxo visual",
      details: (data as any).validation || (data as any).graph_errors,
    } as AgentError;
  }

  return data;
}

/**
 * Verifica se o array é de SymbolicNodes
 */
function isSymbolicNodeArray(arr: any[]): arr is SymbolicNode[] {
  if (!arr || arr.length === 0) return false;
  const first = arr[0];
  // SymbolicNode tem id como string e type específico
  return (
    typeof first.id === "string" &&
    typeof first.type === "string" &&
    ["trigger", "action", "condition", "end", "subflow"].includes(first.type) &&
    !first.order_index // sub_rules têm order_index, symbolic_nodes não
  );
}

/**
 * Converte sub_rules (AtomicSubRule) para nós simbólicos
 * IMPORTANTE: Garante que as conexões next_on_success e next_on_failure estejam preenchidas
 */
function convertSubRulesToSymbolicNodes(subRules: any[]): SymbolicNode[] {
  // Primeiro passo: criar todos os nós com IDs
  const nodes: SymbolicNode[] = subRules.map((sr: any, idx: number) => {
    // Determinar o tipo do nó
    let nodeType: SymbolicNode["type"] = sr.suggested_node_type || "action";
    
    // Se for terminal e não tem tipo definido como "end", verificar
    if (sr.is_terminal && nodeType !== "end") {
      nodeType = "end";
    }
    
    // Determinar end_status para nós de fim
    let endStatus: "success" | "error" | undefined = undefined;
    if (nodeType === "end") {
      if (sr.is_error_path || sr.metadata?.is_error_path || sr.path_type === "error_path") {
        endStatus = "error";
      } else {
        endStatus = "success";
      }
    }
    
    // Gerar ID consistente
    const nodeId = sr.metadata?.symbolic_id || sr.id?.toString() || `node_${idx + 1}`;
    
    return {
      id: nodeId,
      type: nodeType,
      title: sr.title,
      description: sr.description || sr.expected_outcome || "",
      next_on_success: sr.next_on_success || sr.metadata?.next_on_success || null,
      next_on_failure: sr.next_on_failure || sr.metadata?.next_on_failure || null,
      end_status: endStatus,
      db_id: sr.db_id,
    };
  });

  // Segundo passo: garantir conexões sequenciais para nós que não têm
  // Criar mapa de IDs para validação
  const nodeIds = new Set(nodes.map(n => n.id));
  
  // Separar nós principais e de erro
  const mainNodes = nodes.filter(n => n.type !== "end" || n.end_status !== "error");
  const errorNodes = nodes.filter(n => n.type === "end" && n.end_status === "error");
  
  // Garantir conexões sequenciais no caminho principal
  for (let i = 0; i < mainNodes.length; i++) {
    const node = mainNodes[i];
    
    // Nós end não precisam de next_on_success
    if (node.type === "end") {
      node.next_on_success = null;
      node.next_on_failure = null;
      continue;
    }
    
    // Validar se next_on_success existe
    if (node.next_on_success && !nodeIds.has(node.next_on_success)) {
      console.warn(`[convertSubRulesToSymbolicNodes] next_on_success "${node.next_on_success}" não existe, será corrigido`);
      node.next_on_success = null;
    }
    
    // Se não tem next_on_success, conectar ao próximo nó
    if (!node.next_on_success && i < mainNodes.length - 1) {
      const nextNode = mainNodes[i + 1];
      node.next_on_success = nextNode.id;
      console.log(`[convertSubRulesToSymbolicNodes] Conectando "${node.id}" -> "${nextNode.id}" (sequencial)`);
    }
    
    // Para conditions, garantir next_on_failure
    if (node.type === "condition") {
      if (node.next_on_failure && !nodeIds.has(node.next_on_failure)) {
        console.warn(`[convertSubRulesToSymbolicNodes] next_on_failure "${node.next_on_failure}" não existe, será corrigido`);
        node.next_on_failure = null;
      }
      
      if (!node.next_on_failure && errorNodes.length > 0) {
        node.next_on_failure = errorNodes[0].id;
        console.log(`[convertSubRulesToSymbolicNodes] Conectando "${node.id}" -> "${errorNodes[0].id}" (failure)`);
      }
    }
  }

  console.log(`[convertSubRulesToSymbolicNodes] Convertidos ${nodes.length} nós, ${mainNodes.length} main, ${errorNodes.length} error`);
  
  return nodes;
}

/**
 * Garante que o grafo tem estrutura válida (trigger, end, e conexões)
 * CORRIGIDO: Agora também garante que todos os nós não-end têm conexões de saída
 */
function ensureValidGraphStructure(nodes: SymbolicNode[]): SymbolicNode[] {
  if (nodes.length === 0) {
    return [
      {
        id: "start_trigger",
        type: "trigger",
        title: "Início do Fluxo",
        description: "Ponto de entrada do fluxo",
        next_on_success: "end_success",
      },
      {
        id: "end_success",
        type: "end",
        title: "Fluxo Concluído",
        description: "Término bem-sucedido",
        end_status: "success",
      },
    ];
  }

  const result = [...nodes];
  
  // Criar set de IDs para validação
  const nodeIds = new Set(result.map(n => n.id));

  // Garantir que há pelo menos um trigger
  const hasTrigger = result.some(n => n.type === "trigger");
  if (!hasTrigger && result.length > 0) {
    // Transformar o primeiro nó em trigger ou adicionar um
    if (result[0].type === "action") {
      result[0].type = "trigger";
    } else {
      const autoTriggerId = "auto_trigger";
      result.unshift({
        id: autoTriggerId,
        type: "trigger",
        title: "Início do Fluxo",
        description: "Ponto de entrada automático",
        next_on_success: result[0].id,
      });
      nodeIds.add(autoTriggerId);
    }
  }

  // Garantir que há pelo menos um end de sucesso
  let hasSuccessEnd = result.some(n => n.type === "end" && n.end_status === "success");
  if (!hasSuccessEnd && result.length > 0) {
    // Verificar se o último nó pode ser convertido
    const lastMainNode = result.filter(n => n.type !== "end" || n.end_status !== "error").pop();
    if (lastMainNode && lastMainNode.type !== "trigger" && lastMainNode.type !== "condition") {
      lastMainNode.type = "end";
      lastMainNode.end_status = "success";
      // End não deve ter conexões de saída
      lastMainNode.next_on_success = undefined;
      lastMainNode.next_on_failure = undefined;
      hasSuccessEnd = true;
    } else {
      // Adicionar end
      const newEndId = "auto_end_success";
      result.push({
        id: newEndId,
        type: "end",
        title: "Fluxo Concluído",
        description: "Término bem-sucedido automático",
        end_status: "success",
      });
      nodeIds.add(newEndId);
      hasSuccessEnd = true;
    }
  }

  // Separar nós principais e de erro para conexões
  const mainNodes = result.filter(n => n.type !== "end" || n.end_status !== "error");
  const errorNodes = result.filter(n => n.type === "end" && n.end_status === "error");
  
  // Encontrar o ID do end de sucesso
  const successEndNode = result.find(n => n.type === "end" && n.end_status === "success");
  const successEndId = successEndNode?.id || "auto_end_success";

  // GARANTIR CONEXÕES: Iterar sobre nós principais e criar conexões faltantes
  for (let i = 0; i < mainNodes.length; i++) {
    const node = mainNodes[i];
    
    // End nodes não precisam de conexão de saída
    if (node.type === "end") {
      node.next_on_success = undefined;
      node.next_on_failure = undefined;
      continue;
    }
    
    // Validar se next_on_success referencia um nó existente
    if (node.next_on_success && !nodeIds.has(node.next_on_success)) {
      console.warn(`[ensureValidGraphStructure] "${node.id}".next_on_success="${node.next_on_success}" não existe`);
      node.next_on_success = null;
    }
    
    // Se não tem next_on_success, conectar ao próximo nó ou ao end
    if (!node.next_on_success) {
      // Encontrar próximo nó no caminho principal
      const nextMainNode = mainNodes[i + 1];
      if (nextMainNode) {
        node.next_on_success = nextMainNode.id;
        console.log(`[ensureValidGraphStructure] Criando conexão: "${node.id}" -> "${nextMainNode.id}"`);
      } else if (node.type !== "end") {
        // Se é o último nó não-end, conectar ao end de sucesso
        node.next_on_success = successEndId;
        console.log(`[ensureValidGraphStructure] Criando conexão final: "${node.id}" -> "${successEndId}"`);
      }
    }
    
    // Para conditions, garantir next_on_failure
    if (node.type === "condition") {
      if (node.next_on_failure && !nodeIds.has(node.next_on_failure)) {
        console.warn(`[ensureValidGraphStructure] "${node.id}".next_on_failure="${node.next_on_failure}" não existe`);
        node.next_on_failure = null;
      }
      
      if (!node.next_on_failure) {
        // Conectar ao primeiro erro ou criar um end de erro
        if (errorNodes.length > 0) {
          node.next_on_failure = errorNodes[0].id;
          console.log(`[ensureValidGraphStructure] Criando conexão de erro: "${node.id}" -> "${errorNodes[0].id}"`);
        } else {
          // Criar end de erro
          const errorEndId = `auto_error_${node.id}`;
          result.push({
            id: errorEndId,
            type: "end",
            title: "Erro",
            description: `Erro na condição ${node.title}`,
            end_status: "error",
          });
          nodeIds.add(errorEndId);
          node.next_on_failure = errorEndId;
          console.log(`[ensureValidGraphStructure] Criando end de erro: "${node.id}" -> "${errorEndId}"`);
        }
      }
    }
  }

  console.log(`[ensureValidGraphStructure] Resultado: ${result.length} nós com conexões garantidas`);
  
  return result;
}

/**
 * Regenera apenas o fluxo visual (mantendo as regras)
 */
export async function regenerateFlow(
  masterRuleId: number,
  projectId: number,
  userId: number,
  options?: {
    layoutOptions?: FlowGeneratorRequest["layout_options"];
  }
): Promise<FlowGeneratorResponse> {
  // Buscar subregras existentes com metadados simbólicos
  const { data: subRulesData, error: subRulesError } = await supabase
    .from("rules")
    .select("*")
    .eq("parent_rule_id", masterRuleId)
    .eq("rule_type", "node_rule")
    .order("order_index", { ascending: true });

  if (subRulesError || !subRulesData?.length) {
    throw {
      code: "NO_SUBRULES",
      message: "Nenhuma subregra encontrada para regenerar o fluxo",
    } as AgentError;
  }

  // Converter diretamente para nós simbólicos
  const symbolicNodes: SymbolicNode[] = subRulesData.map((rule: any) => ({
    id: rule.metadata?.symbolic_id || `node_${rule.order_index || rule.id}`,
    type: rule.suggested_node_type || "action",
    title: rule.title,
    description: rule.description || "",
    next_on_success: rule.metadata?.next_on_success || null,
    next_on_failure: rule.metadata?.next_on_failure || null,
    end_status: rule.metadata?.end_status || (rule.metadata?.status as "success" | "error" | undefined),
    db_id: rule.id,
  }));

  const flowStructure = {
    total_nodes: symbolicNodes.length,
    happy_path_nodes: symbolicNodes.filter(n => n.type !== "end" || n.end_status !== "error").length,
    error_path_nodes: symbolicNodes.filter(n => n.end_status === "error").length,
    validation_nodes: 0,
    decision_points: symbolicNodes.filter(n => n.type === "condition").length,
    paths: [],
  };

  const dependencyGraph: Record<number, { depends_on: number[]; leads_to: number[] }> = {};

  return generateFlow(
    masterRuleId,
    symbolicNodes,
    flowStructure,
    dependencyGraph,
    projectId,
    userId,
    {
      ...options,
      symbolicNodes, // Passar diretamente
    }
  );
}

/**
 * Processa nós simbólicos localmente (sem chamar a edge function)
 * Útil para preview ou testes
 */
export function processSymbolicNodesLocally(
  symbolicNodes: SymbolicNode[]
): {
  nodes: Array<{
    id: string;
    type: string;
    title: string;
    description: string;
    position_x: number;
    position_y: number;
    order_index: number;
  }>;
  edges: Array<{
    id: string;
    source: string;
    target: string;
    label?: string;
  }>;
} {
  const config = {
    nodeSpacingX: 280,
    nodeSpacingY: 180,
    startX: 100,
    startY: 300,
  };
  
  const nodeIdMap = new Map<string, string>();
  const nodes: Array<{
    id: string;
    type: string;
    title: string;
    description: string;
    position_x: number;
    position_y: number;
    order_index: number;
  }> = [];
  const edges: Array<{
    id: string;
    source: string;
    target: string;
    label?: string;
  }> = [];
  
  // BFS simples para ordenação
  const trigger = symbolicNodes.find(n => n.type === "trigger");
  if (!trigger) {
    // Fallback: usar ordem do array
    symbolicNodes.forEach((node, idx) => {
      const nodeId = `node_${idx + 1}`;
      nodeIdMap.set(node.id, nodeId);
      nodes.push({
        id: nodeId,
        type: node.type,
        title: node.title,
        description: node.description,
        position_x: config.startX + idx * config.nodeSpacingX,
        position_y: config.startY,
        order_index: idx + 1,
      });
    });
  } else {
    // BFS a partir do trigger
    const visited = new Set<string>();
    const queue: { id: string; depth: number }[] = [{ id: trigger.id, depth: 0 }];
    let orderIndex = 1;
    
    while (queue.length > 0) {
      const { id, depth } = queue.shift()!;
      if (visited.has(id)) continue;
      visited.add(id);
      
      const node = symbolicNodes.find(n => n.id === id);
      if (!node) continue;
      
      const nodeId = `node_${orderIndex}`;
      nodeIdMap.set(id, nodeId);
      
      const isError = node.type === "end" && node.end_status === "error";
      
      nodes.push({
        id: nodeId,
        type: node.type,
        title: node.title,
        description: node.description,
        position_x: config.startX + depth * config.nodeSpacingX,
        position_y: isError ? config.startY + config.nodeSpacingY : config.startY,
        order_index: orderIndex,
      });
      
      orderIndex++;
      
      if (node.next_on_success && !visited.has(node.next_on_success)) {
        queue.push({ id: node.next_on_success, depth: depth + 1 });
      }
      if (node.next_on_failure && !visited.has(node.next_on_failure)) {
        queue.push({ id: node.next_on_failure, depth: depth + 1 });
      }
    }
    
    // Adicionar nós não visitados
    for (const node of symbolicNodes) {
      if (!visited.has(node.id)) {
        const nodeId = `node_${orderIndex}`;
        nodeIdMap.set(node.id, nodeId);
        nodes.push({
          id: nodeId,
          type: node.type,
          title: node.title,
          description: node.description,
          position_x: config.startX + nodes.length * config.nodeSpacingX,
          position_y: config.startY,
          order_index: orderIndex,
        });
        orderIndex++;
      }
    }
  }
  
  // Criar edges
  let edgeIndex = 1;
  for (const node of symbolicNodes) {
    const sourceId = nodeIdMap.get(node.id);
    if (!sourceId) continue;
    
    if (node.next_on_success) {
      const targetId = nodeIdMap.get(node.next_on_success);
      if (targetId) {
        edges.push({
          id: `edge_${edgeIndex++}`,
          source: sourceId,
          target: targetId,
          label: node.type === "condition" ? "Sim" : undefined,
        });
      }
    }
    
    if (node.next_on_failure) {
      const targetId = nodeIdMap.get(node.next_on_failure);
      if (targetId) {
        edges.push({
          id: `edge_${edgeIndex++}`,
          source: sourceId,
          target: targetId,
          label: "Não",
        });
      }
    }
  }
  
  return { nodes, edges };
}
