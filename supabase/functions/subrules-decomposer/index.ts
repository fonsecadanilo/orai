import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import OpenAI from "https://deno.land/x/openai@v4.68.1/mod.ts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * AGENTE: Subrules Decomposer v2.0
 * 
 * NOVA ARQUITETURA:
 * Agora recebe DOIS documentos:
 * 1. Master Rule (Regras de Negócio)
 * 2. Journey (Jornada do Usuário)
 * 
 * E deve MESCLAR os dois para criar NÓS SIMBÓLICOS.
 * 
 * - Usa a Regra como fonte de verdade sobre o que PRECISA acontecer
 * - Usa a Jornada para entender COMO o usuário passa pelas etapas
 * 
 * Inclui:
 * - Mini-validador incremental ANTES de retornar
 * - Autofix pass baseado em relatório de erros
 * - Campo flow_category para posicionamento
 */

// Schema Zod para nó simbólico
const SubRuleNodeSchema = z.object({
  id: z.string().min(1).regex(/^[a-z0-9_]+$/),
  type: z.enum(["trigger", "action", "condition", "end", "subflow"]),
  title: z.string().min(3),
  description: z.string(),
  next_on_success: z.string().nullable().optional(),
  next_on_failure: z.string().nullable().optional(),
  end_status: z.enum(["success", "error"]).optional(),
  flow_category: z.enum(["main", "error", "alternative"]).optional().default("main"),
});

const SubrulesResponseSchema = z.object({
  nodes: z.array(SubRuleNodeSchema).min(3),
});

type SubRuleNode = z.infer<typeof SubRuleNodeSchema>;
type SubrulesResponse = z.infer<typeof SubrulesResponseSchema>;

// Interface para Journey v2.0
interface JourneyV2 {
  steps: string[];
  decisions: string[];
  failure_points: string[];
  motivations: string[];
}

const SYSTEM_PROMPT = `Você é responsável por transformar REGRA DE NEGÓCIO + JORNADA DO USUÁRIO em NÓS SIMBÓLICOS para user flows.

## ⚠️ VOCÊ RECEBERÁ 2 DOCUMENTOS:

### DOCUMENTO 1: REGRA DE NEGÓCIO (Master Rule)
Fonte de verdade sobre O QUE PRECISA ACONTECER:
- Objetivo de negócio
- Atores envolvidos
- Fluxo principal (lógica)
- Fluxos alternativos
- Fluxos de erro

### DOCUMENTO 2: JORNADA DO USUÁRIO (Journey)
Fonte de verdade sobre COMO O USUÁRIO EXPERIMENTA:
- Etapas narrativas (steps)
- Pontos de decisão (decisions)
- Pontos de falha/abandono (failure_points)
- Motivações do usuário (motivations)

## SUA TAREFA
Mesclar as INTENÇÕES e PASSOS NARRATIVOS da Jornada + as REGRAS TÉCNICAS da Master Rule em uma lista organizada de NÓS SIMBÓLICOS.

## ⚠️ REGRA FUNDAMENTAL: VOCÊ NÃO DEFINE ENGINE!

### VOCÊ NÃO DECIDE (PROIBIDO):
❌ order_index (indexação numérica)
❌ x/y (posições)
❌ edges reais
❌ labels de edges
❌ layout visual

### VOCÊ DECIDE APENAS:
✅ id simbólico (slug único em snake_case)
✅ type (trigger | action | condition | end | subflow)
✅ title (título descritivo)
✅ description (o que acontece)
✅ next_on_success (ID SIMBÓLICO do próximo nó ou null)
✅ next_on_failure (ID SIMBÓLICO do próximo nó ou null - apenas para conditions)
✅ end_status (success | error - apenas para type === "end")
✅ flow_category (main | error | alternative)

## 🚨 REGRAS CRÍTICAS SOBRE IDs (OBRIGATÓRIO - NUNCA VIOLAR)

1. **CADA NÓ DEVE TER UM ID SIMBÓLICO ÚNICO EM SNAKE_CASE**
   Exemplos válidos:
   - start_flow
   - check_user_exists  
   - validate_credentials
   - redirect_to_provider
   - handle_error_token
   - end_success
   - end_error_validation

2. **next_on_success e next_on_failure SEMPRE devem referenciar IDs SIMBÓLICOS**
   ✅ CORRETO: next_on_success: "validate_credentials"
   ✅ CORRETO: next_on_failure: "end_error_validation"
   ❌ PROIBIDO: next_on_success: "2"
   ❌ PROIBIDO: next_on_failure: "10"
   ❌ PROIBIDO: next_on_success: 3

3. **NUNCA USE NÚMEROS COMO REFERÊNCIA OU ID**
   - IDs devem ser descritivos e únicos
   - Referências devem apontar para IDs existentes no array de nós

## USE A JORNADA PARA DETECTAR:
- Passos intermediários importantes (confirmações)
- Condições naturais de fluxo (decisões)
- Possíveis abandonos (failure_points → ends de erro)
- Erros narrados na experiência
- Loops de retentativa

## FLOW_CATEGORY (CLASSIFICAÇÃO DE CAMINHOS)
- "main": Caminho principal (happy path) - linha base
- "error": Caminhos de erro/falha - linha inferior
- "alternative": Caminhos alternativos (baseado em decisions) - linha superior

## REGRAS OBRIGATÓRIAS

1. **EXATAMENTE 1 TRIGGER**: flow_category = "main"
2. **PELO MENOS 1 END SUCCESS**: flow_category = "main", end_status = "success"
3. **CONDITIONS TÊM 2 CAMINHOS**: next_on_success E next_on_failure
4. **END NODES SÃO TERMINAIS**: NÃO têm next_*
5. **IDS SÃO SLUGS ÚNICOS**: snake_case
6. **SEM CICLOS INFINITOS**: Todo caminho chega a um END
7. **FAILURE_POINTS → END ERROR**: Cada ponto de falha da jornada deve ter um end correspondente

## FORMATO DE SAÍDA (JSON OBRIGATÓRIO)

{
  "nodes": [
    {
      "id": "start_trigger",
      "type": "trigger",
      "title": "Início do Fluxo",
      "description": "O usuário inicia a jornada",
      "next_on_success": "check_something",
      "flow_category": "main"
    },
    {
      "id": "check_something",
      "type": "condition",
      "title": "Verificar Algo?",
      "description": "Verifica se a condição da regra é atendida",
      "next_on_success": "do_action",
      "next_on_failure": "end_error_validation",
      "flow_category": "main"
    },
    {
      "id": "do_action",
      "type": "action",
      "title": "Executar Ação",
      "description": "Sistema executa ação conforme regra de negócio",
      "next_on_success": "end_success",
      "flow_category": "main"
    },
    {
      "id": "end_success",
      "type": "end",
      "title": "Fluxo Concluído",
      "description": "Processo finalizado com sucesso",
      "end_status": "success",
      "flow_category": "main"
    },
    {
      "id": "end_error_validation",
      "type": "end",
      "title": "Erro de Validação",
      "description": "Processo falhou (ponto de abandono identificado na jornada)",
      "end_status": "error",
      "flow_category": "error"
    }
  ]
}

⚠️ OBSERVE: Todas as referências (next_on_success, next_on_failure) usam IDs SIMBÓLICOS que existem no array de nós. NUNCA use números!

## EXEMPLO DE MESCLA (REGRA + JORNADA)

### REGRA DIZ:
- "O sistema valida os dados antes de prosseguir"
- "Se dados inválidos, rejeitar operação"

### JORNADA DIZ:
- Decisão: "O usuário confirma se quer continuar"
- Falha: "O usuário pode abandonar se dados forem rejeitados"
- Motivação: "O usuário quer ter certeza antes de confirmar"

### RESULTADO:
{
  "id": "validate_data",
  "type": "condition",
  "title": "Dados válidos?",
  "description": "Sistema valida dados conforme regra. Usuário aguarda confirmação.",
  "next_on_success": "proceed_action",
  "next_on_failure": "end_invalid_data",
  "flow_category": "main"
}

RETORNE APENAS JSON VÁLIDO, sem markdown ou explicações.`;

/**
 * Valida e corrige IDs simbólicos
 * Converte referências numéricas para IDs simbólicos válidos
 */
function ensureSymbolicIds(nodes: SubRuleNode[]): SubRuleNode[] {
  const idRegex = /^[a-z0-9_]+$/;
  const numericRefRegex = /^\d+$/;
  
  // Criar mapa de índice → id para correção automática
  const indexToIdMap = new Map<string, string>();
  nodes.forEach((node, idx) => {
    indexToIdMap.set(String(idx + 1), node.id);
  });
  
  // Também mapear por ordem se for sequencial
  nodes.forEach((node, idx) => {
    // Assumir que order_index pode ser idx + 1 ou pode pular (ex: 1,2,3...10,11,12)
    indexToIdMap.set(String(idx + 1), node.id);
  });
  
  const correctedNodes: SubRuleNode[] = [];
  
  for (let i = 0; i < nodes.length; i++) {
    const node = { ...nodes[i] };
    
    // Validar e corrigir ID do nó
    if (!node.id || !idRegex.test(node.id)) {
      // Gerar ID baseado no título
      const baseId = node.title
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9\s]/g, "")
        .trim()
        .replace(/\s+/g, "_")
        .substring(0, 30);
      node.id = baseId || `node_${i + 1}`;
      console.log(`[subrules-decomposer] ID corrigido: "${nodes[i].id}" → "${node.id}"`);
    }
    
    // Corrigir next_on_success se for numérico
    if (node.next_on_success && numericRefRegex.test(node.next_on_success)) {
      const correctedRef = indexToIdMap.get(node.next_on_success);
      if (correctedRef) {
        console.log(`[subrules-decomposer] next_on_success corrigido: "${node.next_on_success}" → "${correctedRef}"`);
        node.next_on_success = correctedRef;
      } else {
        console.warn(`[subrules-decomposer] next_on_success "${node.next_on_success}" não pode ser resolvido`);
        node.next_on_success = null;
      }
    }
    
    // Corrigir next_on_failure se for numérico
    if (node.next_on_failure && numericRefRegex.test(node.next_on_failure)) {
      const correctedRef = indexToIdMap.get(node.next_on_failure);
      if (correctedRef) {
        console.log(`[subrules-decomposer] next_on_failure corrigido: "${node.next_on_failure}" → "${correctedRef}"`);
        node.next_on_failure = correctedRef;
      } else {
        console.warn(`[subrules-decomposer] next_on_failure "${node.next_on_failure}" não pode ser resolvido`);
        node.next_on_failure = null;
      }
    }
    
    correctedNodes.push(node);
  }
  
  // Segunda passada: verificar que todas as referências apontam para IDs existentes
  const allIds = new Set(correctedNodes.map(n => n.id));
  
  for (const node of correctedNodes) {
    if (node.next_on_success && !allIds.has(node.next_on_success)) {
      console.warn(`[subrules-decomposer] Referência inválida: "${node.id}".next_on_success = "${node.next_on_success}" não existe`);
      // Tentar encontrar um nó com título similar ou próximo na sequência
      const nextIdx = correctedNodes.findIndex(n => n.id === node.id) + 1;
      if (nextIdx < correctedNodes.length && correctedNodes[nextIdx].type !== "end") {
        node.next_on_success = correctedNodes[nextIdx].id;
        console.log(`[subrules-decomposer] Corrigido para próximo nó: "${node.next_on_success}"`);
      } else {
        node.next_on_success = null;
      }
    }
    
    if (node.next_on_failure && !allIds.has(node.next_on_failure)) {
      console.warn(`[subrules-decomposer] Referência inválida: "${node.id}".next_on_failure = "${node.next_on_failure}" não existe`);
      // Tentar encontrar um end de erro
      const errorEnd = correctedNodes.find(n => n.type === "end" && n.end_status === "error");
      if (errorEnd) {
        node.next_on_failure = errorEnd.id;
        console.log(`[subrules-decomposer] Corrigido para end de erro: "${node.next_on_failure}"`);
      } else {
        node.next_on_failure = null;
      }
    }
  }
  
  return correctedNodes;
}

/**
 * Mini-validador de grafo incremental
 */
interface ValidationError {
  code: string;
  message: string;
  nodeId?: string;
}

function validateGraphIncremental(nodes: SubRuleNode[]): {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
} {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];
  const nodeIds = new Set(nodes.map(n => n.id));

  // 1. Exatamente 1 trigger
  const triggers = nodes.filter(n => n.type === "trigger");
  if (triggers.length === 0) {
    errors.push({
      code: "GRAPH_NO_TRIGGER",
      message: "Deve haver exatamente 1 trigger",
    });
  } else if (triggers.length > 1) {
    errors.push({
      code: "GRAPH_MULTIPLE_TRIGGERS",
      message: `Encontrados ${triggers.length} triggers, deve ter apenas 1`,
    });
  }

  // 2. Pelo menos 1 end success
  const successEnds = nodes.filter(n => n.type === "end" && n.end_status === "success");
  if (successEnds.length === 0) {
    errors.push({
      code: "GRAPH_NO_SUCCESS_END",
      message: "Deve haver pelo menos 1 end com status success",
    });
  }

  // 3. Verificar referências de IDs
  for (const node of nodes) {
    if (node.next_on_success && !nodeIds.has(node.next_on_success)) {
      errors.push({
        code: "GRAPH_INVALID_REF",
        message: `Nó "${node.id}" referencia "${node.next_on_success}" que não existe`,
        nodeId: node.id,
      });
    }
    if (node.next_on_failure && !nodeIds.has(node.next_on_failure)) {
      errors.push({
        code: "GRAPH_INVALID_REF",
        message: `Nó "${node.id}" referencia "${node.next_on_failure}" que não existe`,
        nodeId: node.id,
      });
    }
  }

  // 4. Conditions devem ter 2 caminhos
  for (const node of nodes) {
    if (node.type === "condition") {
      if (!node.next_on_success) {
        errors.push({
          code: "GRAPH_CONDITION_NO_SUCCESS",
          message: `Condition "${node.id}" não tem next_on_success`,
          nodeId: node.id,
        });
      }
      if (!node.next_on_failure) {
        errors.push({
          code: "GRAPH_CONDITION_NO_FAILURE",
          message: `Condition "${node.id}" não tem next_on_failure`,
          nodeId: node.id,
        });
      }
    }
  }

  // 5. End nodes não podem ter next
  for (const node of nodes) {
    if (node.type === "end") {
      if (node.next_on_success || node.next_on_failure) {
        errors.push({
          code: "GRAPH_END_HAS_NEXT",
          message: `End "${node.id}" não pode ter conexões de saída`,
          nodeId: node.id,
        });
      }
      if (!node.end_status) {
        errors.push({
          code: "GRAPH_END_NO_STATUS",
          message: `End "${node.id}" deve ter end_status (success/error)`,
          nodeId: node.id,
        });
      }
    }
  }

  // 6. Nós não-end devem ter pelo menos uma saída
  for (const node of nodes) {
    if (node.type !== "end" && !node.next_on_success) {
      if (node.type === "trigger") {
        errors.push({
          code: "GRAPH_TRIGGER_NO_OUTPUT",
          message: `Trigger "${node.id}" não tem next_on_success`,
          nodeId: node.id,
        });
      } else {
        warnings.push({
          code: "GRAPH_NO_OUTPUT",
          message: `Nó "${node.id}" não tem conexão de saída`,
          nodeId: node.id,
        });
      }
    }
  }

  // 7. Detectar ciclos
  const cycleErrors = detectCycles(nodes);
  errors.push(...cycleErrors);

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Detecta ciclos no grafo
 */
function detectCycles(nodes: SubRuleNode[]): ValidationError[] {
  const errors: ValidationError[] = [];
  const visited = new Set<string>();
  const recStack = new Set<string>();
  const nodeMap = new Map(nodes.map(n => [n.id, n]));

  function hasCycle(nodeId: string, path: string[]): boolean {
    if (recStack.has(nodeId)) {
      const cycleStart = path.indexOf(nodeId);
      const cycle = [...path.slice(cycleStart), nodeId].join(" -> ");
      errors.push({
        code: "GRAPH_CYCLE",
        message: `Ciclo detectado: ${cycle}`,
        nodeId,
      });
      return true;
    }
    
    if (visited.has(nodeId)) return false;
    
    visited.add(nodeId);
    recStack.add(nodeId);
    
    const node = nodeMap.get(nodeId);
    if (node) {
      if (node.next_on_success && hasCycle(node.next_on_success, [...path, nodeId])) {
        return true;
      }
      if (node.next_on_failure && hasCycle(node.next_on_failure, [...path, nodeId])) {
        return true;
      }
    }
    
    recStack.delete(nodeId);
    return false;
  }

  for (const node of nodes) {
    if (!visited.has(node.id)) {
      hasCycle(node.id, []);
    }
  }

  return errors;
}

/**
 * Gera relatório de erros para autofix
 */
function generateErrorReport(errors: ValidationError[]): string {
  if (errors.length === 0) return "";
  
  let report = "## ERROS DETECTADOS NO GRAFO\n\n";
  errors.forEach((error, i) => {
    report += `Erro ${i + 1}: ${error.message}\n`;
    if (error.nodeId) {
      report += `  → Nó afetado: ${error.nodeId}\n`;
    }
  });
  
  return report;
}

/**
 * Prompt para autofix
 */
function generateAutofixPrompt(nodes: SubRuleNode[], errors: ValidationError[]): string {
  const errorReport = generateErrorReport(errors);
  
  return `Corrija o mapa de nós abaixo com base nos erros detectados.
NÃO reescreva do zero. Apenas ajuste o necessário.

${errorReport}

## MAPA DE NÓS ATUAL (JSON):
${JSON.stringify(nodes, null, 2)}

## INSTRUÇÕES DE CORREÇÃO:
1. Se falta trigger: adicione um trigger no início
2. Se falta end success: adicione um end_success no final do happy path
3. Se condition não tem failure: adicione next_on_failure para um end_error existente ou crie um
4. Se referência inválida: corrija o id referenciado
5. Se end tem next_*: remova as conexões de saída
6. Se ciclo detectado: quebre o ciclo direcionando para um end

## ⚠️ REGRAS CRÍTICAS SOBRE IDs:
- TODOS os IDs devem ser em snake_case (ex: start_flow, validate_user, end_success)
- next_on_success e next_on_failure DEVEM referenciar IDs simbólicos, NUNCA números
- ❌ PROIBIDO: next_on_success: "2" ou next_on_failure: "10"
- ✅ CORRETO: next_on_success: "validate_user", next_on_failure: "end_error"

RETORNE APENAS O JSON CORRIGIDO com { "nodes": [...] }`;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { 
      master_rule_id, 
      journey,
      project_id, 
      user_id 
    } = await req.json();

    if (!master_rule_id || !project_id || !user_id) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: "Campos obrigatórios faltando: master_rule_id, project_id, user_id" 
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const openaiKey = Deno.env.get("OPENAI_API_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseKey);
    const openai = new OpenAI({ apiKey: openaiKey });

    // Buscar regra master
    const { data: masterRule } = await supabase
      .from("rules")
      .select("*")
      .eq("id", master_rule_id)
      .single();

    if (!masterRule) {
      return new Response(
        JSON.stringify({ success: false, message: "Regra master não encontrada" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Buscar journey se não foi passada
    let journeyData: JourneyV2 | null = journey;
    if (!journeyData) {
      const { data: journeyRecord } = await supabase
        .from("user_journeys")
        .select("metadata")
        .eq("master_rule_id", master_rule_id)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();
      
      if (journeyRecord?.metadata?.journey_v2) {
        journeyData = journeyRecord.metadata.journey_v2;
      }
    }

    // Construir contexto da Master Rule
    const semanticData = masterRule.metadata?.semantic_data;
    let masterRuleContext = `## DOCUMENTO 1: REGRA DE NEGÓCIO\n\n`;
    masterRuleContext += `**Título:** ${masterRule.title}\n\n`;
    
    if (semanticData) {
      masterRuleContext += `**Objetivo:** ${semanticData.business_goal || masterRule.description}\n\n`;
      masterRuleContext += `**Contexto:** ${semanticData.context || ""}\n\n`;
      
      if (semanticData.actors?.length > 0) {
        masterRuleContext += `**Atores:** ${semanticData.actors.join(", ")}\n\n`;
      }
      
      if (semanticData.main_flow?.length > 0) {
        masterRuleContext += "**Fluxo Principal:**\n";
        semanticData.main_flow.forEach((step: string, i: number) => {
          masterRuleContext += `${i + 1}. ${step}\n`;
        });
        masterRuleContext += "\n";
      }
      
      if (semanticData.alternative_flows?.length > 0) {
        masterRuleContext += "**Fluxos Alternativos:**\n";
        semanticData.alternative_flows.forEach((flow: string) => {
          masterRuleContext += `- ${flow}\n`;
        });
        masterRuleContext += "\n";
      }
      
      if (semanticData.error_flows?.length > 0) {
        masterRuleContext += "**Fluxos de Erro:**\n";
        semanticData.error_flows.forEach((flow: string) => {
          masterRuleContext += `- ${flow}\n`;
        });
        masterRuleContext += "\n";
      }
    } else {
      masterRuleContext += `**Descrição:** ${masterRule.description}\n\n`;
      masterRuleContext += `**Conteúdo:**\n${masterRule.content?.substring(0, 3000) || ""}\n\n`;
    }

    // Construir contexto da Journey
    let journeyContext = `## DOCUMENTO 2: JORNADA DO USUÁRIO\n\n`;
    
    if (journeyData) {
      journeyContext += "**Etapas Narrativas (steps):**\n";
      journeyData.steps.forEach((step, i) => {
        journeyContext += `${i + 1}. ${step}\n`;
      });
      journeyContext += "\n";
      
      if (journeyData.decisions?.length > 0) {
        journeyContext += "**Pontos de Decisão (decisions):**\n";
        journeyData.decisions.forEach((decision) => {
          journeyContext += `- ${decision}\n`;
        });
        journeyContext += "\n";
      }
      
      if (journeyData.failure_points?.length > 0) {
        journeyContext += "**Pontos de Falha/Abandono (failure_points):**\n";
        journeyData.failure_points.forEach((failure) => {
          journeyContext += `- ${failure}\n`;
        });
        journeyContext += "\n";
      }
      
      if (journeyData.motivations?.length > 0) {
        journeyContext += "**Motivações do Usuário (motivations):**\n";
        journeyData.motivations.forEach((motivation) => {
          journeyContext += `- ${motivation}\n`;
        });
        journeyContext += "\n";
      }
    } else {
      journeyContext += "*Jornada não fornecida. Criar nós baseado apenas na Regra de Negócio.*\n\n";
    }

    const userMessage = `Transforme os 2 documentos abaixo em NÓS SIMBÓLICOS para um user flow:

${masterRuleContext}
${journeyContext}

## INSTRUÇÕES

1. Use a REGRA como fonte de verdade sobre O QUE acontece
2. Use a JORNADA para entender COMO o usuário experimenta
3. Cada DECISÃO da jornada pode virar uma CONDITION
4. Cada PONTO DE FALHA pode virar um END ERROR
5. Mesclhe as informações em nós coerentes
6. Garanta: 1 trigger, ≥1 end success, conditions com 2 caminhos
7. Use flow_category para classificar cada nó (main, error, alternative)

RETORNE APENAS JSON VÁLIDO com { "nodes": [...] }`;

    // Usar GPT-4o para melhor qualidade na mescla
    let completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userMessage },
      ],
      temperature: 0.2,
      max_tokens: 5000,
      response_format: { type: "json_object" },
    });

    let assistantMessage = completion.choices[0]?.message?.content;
    if (!assistantMessage) {
      return new Response(
        JSON.stringify({ success: false, message: "Resposta vazia do modelo" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let parsedResponse: unknown;
    try {
      parsedResponse = JSON.parse(assistantMessage);
    } catch {
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: "Erro ao parsear JSON",
          raw_response: assistantMessage 
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 🔧 CORREÇÃO: Garantir IDs simbólicos válidos e corrigir referências numéricas
    if (parsedResponse && typeof parsedResponse === 'object' && 'nodes' in parsedResponse) {
      const rawNodes = (parsedResponse as { nodes: SubRuleNode[] }).nodes;
      console.log("[subrules-decomposer] Verificando e corrigindo IDs simbólicos...");
      const correctedNodes = ensureSymbolicIds(rawNodes);
      (parsedResponse as { nodes: SubRuleNode[] }).nodes = correctedNodes;
      console.log("[subrules-decomposer] IDs corrigidos:", correctedNodes.map(n => ({ id: n.id, next: n.next_on_success })));
    }

    // Validar com Zod
    let validationResult = SubrulesResponseSchema.safeParse(parsedResponse);
    
    if (!validationResult.success) {
      const errors = validationResult.error.errors.map(
        (e) => `${e.path.join(".")}: ${e.message}`
      );
      
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: "Validação Zod falhou",
          validation_errors: errors,
          raw_response: parsedResponse
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let subrulesResponse: SubrulesResponse = validationResult.data;

    // Mini-validador incremental
    let graphValidation = validateGraphIncremental(subrulesResponse.nodes);
    
    // Se falhou, tentar autofix
    if (!graphValidation.isValid) {
      console.log("[subrules-decomposer] Validação falhou, tentando autofix...");
      console.log("[subrules-decomposer] Erros:", graphValidation.errors);
      
      const autofixPrompt = generateAutofixPrompt(subrulesResponse.nodes, graphValidation.errors);
      
      // Chamar LLM para corrigir
      const fixCompletion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "Você é um corretor de grafos. Corrija os erros apontados mantendo a estrutura original o máximo possível." },
          { role: "user", content: autofixPrompt },
        ],
        temperature: 0.1,
        max_tokens: 5000,
        response_format: { type: "json_object" },
      });
      
      const fixedMessage = fixCompletion.choices[0]?.message?.content;
      if (fixedMessage) {
        try {
          const fixedParsed = JSON.parse(fixedMessage);
          
          // 🔧 CORREÇÃO: Garantir IDs simbólicos também após autofix
          if (fixedParsed && typeof fixedParsed === 'object' && 'nodes' in fixedParsed) {
            const rawFixedNodes = (fixedParsed as { nodes: SubRuleNode[] }).nodes;
            const correctedFixedNodes = ensureSymbolicIds(rawFixedNodes);
            (fixedParsed as { nodes: SubRuleNode[] }).nodes = correctedFixedNodes;
            console.log("[subrules-decomposer] IDs corrigidos após autofix");
          }
          
          const fixedValidation = SubrulesResponseSchema.safeParse(fixedParsed);
          
          if (fixedValidation.success) {
            const newGraphValidation = validateGraphIncremental(fixedValidation.data.nodes);
            
            if (newGraphValidation.isValid || newGraphValidation.errors.length < graphValidation.errors.length) {
              console.log("[subrules-decomposer] Autofix aplicado com sucesso");
              subrulesResponse = fixedValidation.data;
              graphValidation = newGraphValidation;
              
              // Adicionar warning sobre autofix
              graphValidation.warnings.push({
                code: "AUTOFIX_APPLIED",
                message: "Autofix foi aplicado para corrigir erros no grafo",
              });
            }
          }
        } catch (e) {
          console.error("[subrules-decomposer] Erro no autofix:", e);
        }
      }
    }

    // Se ainda não está válido após autofix, retornar erro
    if (!graphValidation.isValid) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: "Validação de grafo falhou mesmo após autofix",
          graph_errors: graphValidation.errors,
          graph_warnings: graphValidation.warnings,
          nodes: subrulesResponse.nodes
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Salvar subrules no banco
    const savedSubRules = [];
    for (const node of subrulesResponse.nodes) {
      const { data: saved, error } = await supabase
        .from("rules")
        .insert({
          title: node.title,
          description: node.description,
          content: `# ${node.title}\n\n${node.description}`,
          rule_type: "node_rule",
          scope: "node",
          parent_rule_id: master_rule_id,
          project_id,
          suggested_node_type: node.type,
          status: "active",
          priority: node.type === "end" && node.end_status === "error" ? "high" : "medium",
          metadata: {
            symbolic_id: node.id,
            next_on_success: node.next_on_success,
            next_on_failure: node.next_on_failure,
            end_status: node.end_status,
            flow_category: node.flow_category || "main",
            source: "subrules-decomposer-v2",
            has_journey_context: !!journeyData,
          },
        })
        .select("*")
        .single();

      if (!error && saved) {
        savedSubRules.push({
          db_id: saved.id,
          ...node,
        });
      }
    }

    // Atualizar regra master
    await supabase
      .from("rules")
      .update({
        metadata: {
          ...masterRule.metadata,
          sub_rules_count: savedSubRules.length,
          has_error_paths: subrulesResponse.nodes.some(n => n.end_status === "error"),
          has_journey_context: !!journeyData,
          decomposer_version: "2.0",
        },
        updated_at: new Date().toISOString(),
      })
      .eq("id", master_rule_id);

    // Estatísticas
    const stats = {
      total: savedSubRules.length,
      triggers: subrulesResponse.nodes.filter(n => n.type === "trigger").length,
      actions: subrulesResponse.nodes.filter(n => n.type === "action").length,
      conditions: subrulesResponse.nodes.filter(n => n.type === "condition").length,
      subflows: subrulesResponse.nodes.filter(n => n.type === "subflow").length,
      ends_success: subrulesResponse.nodes.filter(n => n.type === "end" && n.end_status === "success").length,
      ends_error: subrulesResponse.nodes.filter(n => n.type === "end" && n.end_status === "error").length,
      main_path: subrulesResponse.nodes.filter(n => n.flow_category === "main").length,
      error_path: subrulesResponse.nodes.filter(n => n.flow_category === "error").length,
      alternative_path: subrulesResponse.nodes.filter(n => n.flow_category === "alternative").length,
    };

    return new Response(
      JSON.stringify({
        success: true,
        master_rule_id,
        sub_rules: savedSubRules,
        sub_rule_ids: savedSubRules.map(s => s.db_id),
        symbolic_nodes: subrulesResponse.nodes,
        stats,
        graph_validation: graphValidation,
        has_journey_context: !!journeyData,
        message: `${savedSubRules.length} nós simbólicos criados (com contexto de jornada: ${!!journeyData})`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Erro:", error);
    return new Response(
      JSON.stringify({ success: false, message: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
