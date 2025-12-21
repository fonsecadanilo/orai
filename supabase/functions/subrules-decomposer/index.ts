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

// Schema Zod para input de formulário
const FormInputSchema = z.object({
  name: z.string().min(1),
  type: z.enum(["text", "email", "password", "number", "tel", "date", "datetime", "select", "checkbox", "radio", "textarea", "file", "hidden"]).default("text"),
  label: z.string().optional(),
  placeholder: z.string().optional(),
  required: z.boolean().optional().default(false),
  validation: z.array(z.string()).optional(),
  options: z.array(z.object({ value: z.string(), label: z.string() })).optional(),
});

// Schema Zod para nó rico (RichNode) v3.0
const RichNodeSchema = z.object({
  // Campos base
  id: z.string().min(1).regex(/^[a-z0-9_]+$/),
  type: z.enum(["trigger", "action", "condition", "end", "subflow"]),
  title: z.string().min(3),
  description: z.string(),
  next_on_success: z.string().nullable().optional(),
  next_on_failure: z.string().nullable().optional(),
  end_status: z.enum(["success", "error", "cancel"]).optional(),
  flow_category: z.enum(["main", "error", "alternative"]).optional().default("main"),
  
  // NOVOS campos v3.0
  page_key: z.string().optional(),
  user_intent: z.string().optional(),
  system_behavior: z.string().optional(),
  ux_recommendation: z.string().optional(),
  inputs: z.array(FormInputSchema).optional(),
  error_cases: z.array(z.string()).optional(),
  allows_retry: z.boolean().optional().default(false),
  allows_cancel: z.boolean().optional().default(false),
});

// Schema básico (compatibilidade)
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

// Response com RichNodes
const RichSubrulesResponseSchema = z.object({
  nodes: z.array(RichNodeSchema).min(3),
});

// Response básico (compatibilidade)
const SubrulesResponseSchema = z.object({
  nodes: z.array(SubRuleNodeSchema).min(3),
});

type RichNode = z.infer<typeof RichNodeSchema>;
type SubRuleNode = z.infer<typeof SubRuleNodeSchema>;
type RichSubrulesResponse = z.infer<typeof RichSubrulesResponseSchema>;
type SubrulesResponse = z.infer<typeof SubrulesResponseSchema>;

// Interface para Journey v2.0
interface JourneyV2 {
  steps: string[];
  decisions: string[];
  failure_points: string[];
  motivations: string[];
}

const SYSTEM_PROMPT = `Você é um engenheiro de automação de fluxos especializado em SaaS.

## ⚠️ VOCÊ RECEBERÁ ATÉ 4 DOCUMENTOS:

### DOCUMENTO 1: REGRA DE NEGÓCIO (Master Rule)
- Objetivo de negócio
- Atores envolvidos
- Fluxo principal, alternativos e erros
- PÁGINAS ENVOLVIDAS (pages_involved)

### DOCUMENTO 2: JORNADA DO USUÁRIO (Journey)
- Etapas narrativas com page_key
- Pontos de decisão
- Pontos de falha/abandono

### DOCUMENTO 3: ENRIQUECIMENTOS (Flow Enricher) - OPCIONAL
- Passos extras sugeridos
- Decisões extras
- Pontos de falha extras
- Recomendações de UX

### DOCUMENTO 4: CONTEXTO DE PÁGINAS (PageContext) - OPCIONAL
- Transições entre páginas
- Página de entrada
- Páginas de saída

## SUA TAREFA
Gerar uma lista de NÓS RICOS (RichNodes) que representem o fluxo completo.

## ⚠️ REGRA FUNDAMENTAL: VOCÊ NÃO DEFINE ENGINE!

### VOCÊ NÃO DECIDE:
❌ order_index, x/y, edges reais, labels de edges, layout visual

### VOCÊ DECIDE:
✅ id (slug único em snake_case)
✅ type (trigger | action | condition | end | subflow)
✅ title, description
✅ next_on_success, next_on_failure (IDs SIMBÓLICOS)
✅ end_status (success | error | cancel)
✅ flow_category (main | error | alternative)

### NOVOS CAMPOS v3.0 (PREENCHER QUANDO RELEVANTE):
✅ page_key - página onde o nó acontece
✅ user_intent - o que o usuário quer fazer
✅ system_behavior - o que o sistema faz
✅ ux_recommendation - dica de UX
✅ inputs - campos de formulário (para nós com formulários)
✅ error_cases - erros esperados neste nó
✅ allows_retry - se permite tentar novamente
✅ allows_cancel - se permite cancelar

## 📋 INPUTS (PARA NÓS COM FORMULÁRIOS)

Para nós que envolvem formulários, PREENCHA o campo "inputs":

{
  "inputs": [
    {
      "name": "email",
      "type": "email",
      "label": "E-mail",
      "required": true,
      "validation": ["required", "valid_email"]
    },
    {
      "name": "password",
      "type": "password",
      "label": "Senha",
      "required": true,
      "validation": ["required", "min_length:8"]
    }
  ]
}

### Tipos de input:
text, email, password, number, tel, date, select, checkbox, radio, textarea, file

### Validações comuns:
- required
- valid_email
- min_length:N
- max_length:N
- matches:field (ex: matches:password)
- phone
- card_number

## PADRÕES SAAS OBRIGATÓRIOS

### 1. Fluxos de LOGIN devem ter:
- Input de email + password
- Condição de validação de credenciais
- Caminho para recuperar senha
- Destino: dashboard ou onboarding

### 2. Fluxos de SIGNUP devem ter:
- Inputs: name, email, password, password_confirm
- Validação de campos
- Destino: onboarding ou dashboard

### 3. Fluxos de ONBOARDING devem ter:
- Opção de pular (allows_cancel = true)
- Múltiplos steps
- Destino: dashboard

### 4. SEMPRE incluir:
- Tratamento de erros claros
- Opção de retry onde fizer sentido
- allows_cancel em operações longas

## REGRAS CRÍTICAS

1. **EXATAMENTE 1 TRIGGER**
2. **PELO MENOS 1 END SUCCESS**
3. **CONDITIONS TÊM 2 CAMINHOS**
4. **END NODES SÃO TERMINAIS**
5. **IDs SÃO SLUGS ÚNICOS**
6. **SEM CICLOS INFINITOS**
7. **TODOS OS IDs REFERENCIADOS DEVEM EXISTIR**

## FORMATO DE SAÍDA (JSON OBRIGATÓRIO)

{
  "nodes": [
    {
      "id": "start_auth",
      "type": "trigger",
      "title": "Início da Autenticação",
      "description": "Usuário acessa a tela de autenticação",
      "page_key": "auth",
      "user_intent": "Acessar o sistema",
      "system_behavior": "Exibir opções de login e cadastro",
      "next_on_success": "choose_auth_method",
      "flow_category": "main"
    },
    {
      "id": "choose_auth_method",
      "type": "condition",
      "title": "Login ou Cadastro?",
      "description": "Usuário escolhe entre fazer login ou criar conta",
      "page_key": "auth",
      "user_intent": "Escolher como acessar",
      "next_on_success": "fill_login_form",
      "next_on_failure": "fill_signup_form",
      "flow_category": "main"
    },
    {
      "id": "fill_login_form",
      "type": "action",
      "title": "Preencher Login",
      "description": "Usuário preenche email e senha",
      "page_key": "login",
      "user_intent": "Entrar na conta existente",
      "system_behavior": "Validar campos em tempo real",
      "ux_recommendation": "Mostrar indicador de força da senha",
      "inputs": [
        {
          "name": "email",
          "type": "email",
          "label": "E-mail",
          "required": true,
          "validation": ["required", "valid_email"]
        },
        {
          "name": "password",
          "type": "password",
          "label": "Senha",
          "required": true,
          "validation": ["required", "min_length:6"]
        }
      ],
      "error_cases": ["Email não cadastrado", "Senha incorreta", "Conta bloqueada"],
      "allows_retry": true,
      "next_on_success": "validate_credentials",
      "flow_category": "main"
    },
    {
      "id": "validate_credentials",
      "type": "condition",
      "title": "Credenciais válidas?",
      "description": "Sistema verifica se email e senha estão corretos",
      "page_key": "login",
      "system_behavior": "Consultar banco de dados e validar hash",
      "next_on_success": "redirect_dashboard",
      "next_on_failure": "show_login_error",
      "flow_category": "main"
    },
    {
      "id": "show_login_error",
      "type": "action",
      "title": "Exibir Erro de Login",
      "description": "Mostrar mensagem de erro e opção de recuperar senha",
      "page_key": "login",
      "system_behavior": "Exibir mensagem amigável",
      "ux_recommendation": "Oferecer link para recuperar senha",
      "allows_retry": true,
      "next_on_success": "fill_login_form",
      "flow_category": "error"
    },
    {
      "id": "redirect_dashboard",
      "type": "action",
      "title": "Redirecionar para Dashboard",
      "description": "Login bem-sucedido, redirecionar usuário",
      "page_key": "dashboard",
      "system_behavior": "Redirecionar e carregar dados do usuário",
      "next_on_success": "end_success",
      "flow_category": "main"
    },
    {
      "id": "end_success",
      "type": "end",
      "title": "Login Concluído",
      "description": "Usuário autenticado com sucesso",
      "page_key": "dashboard",
      "end_status": "success",
      "flow_category": "main"
    }
  ]
}

⚠️ NUNCA use números como IDs ou referências!
✅ SEMPRE preencha page_key quando souber a página
✅ SEMPRE preencha inputs para nós com formulários
✅ Use error_cases para listar erros esperados

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
  // #region agent log
  const initLog = JSON.stringify({location:'subrules-decomposer/index.ts:652',message:'Edge function iniciada',data:{method:req.method,url:req.url},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'});
  await Deno.writeTextFile('/Users/danilofonseca/Desktop/oria-app/.cursor/debug.log', initLog + '\n', { append: true }).catch((e) => console.error('Erro ao escrever log:', e));
  // #endregion
  
  console.log("[subrules-decomposer] ========== INÍCIO DA REQUISIÇÃO ==========");
  console.log("[subrules-decomposer] Method:", req.method);
  
  if (req.method === "OPTIONS") {
    console.log("[subrules-decomposer] Respondendo OPTIONS (CORS)");
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Parse JSON com logging
    let body;
    try {
      const rawBody = await req.text();
      console.log("[subrules-decomposer] Raw body length:", rawBody.length);
      
      if (!rawBody || rawBody.trim() === "") {
        // #region agent log
        const emptyBodyLog = JSON.stringify({location:'subrules-decomposer/index.ts:668',message:'Body vazio - retornando 400',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'});
        await Deno.writeTextFile('/Users/danilofonseca/Desktop/oria-app/.cursor/debug.log', emptyBodyLog + '\n', { append: true }).catch(() => {});
        // #endregion
        console.error("[subrules-decomposer] Body vazio!");
        return new Response(
          JSON.stringify({ success: false, message: "Body vazio" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      body = JSON.parse(rawBody);
    } catch (parseError) {
      // #region agent log
      const parseErrorLog = JSON.stringify({location:'subrules-decomposer/index.ts:677',message:'Erro ao parsear body - retornando 400',data:{error:String(parseError)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'});
      await Deno.writeTextFile('/Users/danilofonseca/Desktop/oria-app/.cursor/debug.log', parseErrorLog + '\n', { append: true }).catch(() => {});
      // #endregion
      console.error("[subrules-decomposer] Erro ao parsear body:", parseError);
      return new Response(
        JSON.stringify({ success: false, message: "Body inválido: " + String(parseError) }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { 
      master_rule_id, 
      journey,
      journey_structured,
      enriched_flow,
      page_context,
      project_id, 
      user_id,
      master_rule_content
    } = body;

    // #region agent log
    const logData = JSON.stringify({location:'subrules-decomposer/index.ts:693',message:'Parâmetros recebidos no edge function',data:{master_rule_id:master_rule_id,project_id:project_id,user_id:user_id,has_master_rule_content:!!master_rule_content,master_rule_content_keys:master_rule_content?Object.keys(master_rule_content):null,has_journey:!!journey,has_journey_structured:!!journey_structured,has_enriched_flow:!!enriched_flow,has_page_context:!!page_context},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'});
    await Deno.writeTextFile('/Users/danilofonseca/Desktop/oria-app/.cursor/debug.log', logData + '\n', { append: true }).catch(() => {});
    // #endregion

    console.log("[subrules-decomposer] Parâmetros recebidos:", {
      master_rule_id: master_rule_id,
      project_id: project_id,
      user_id: user_id,
      has_journey: !!journey,
      has_journey_structured: !!journey_structured,
      has_enriched_flow: !!enriched_flow,
      has_page_context: !!page_context,
    });

    if (!master_rule_id || !project_id || !user_id) {
      // #region agent log
      const errorLog = JSON.stringify({location:'subrules-decomposer/index.ts:711',message:'Campos obrigatórios faltando',data:{master_rule_id:!master_rule_id?'FALTANDO':'OK',project_id:!project_id?'FALTANDO':'OK',user_id:!user_id?'FALTANDO':'OK'},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'});
      await Deno.writeTextFile('/Users/danilofonseca/Desktop/oria-app/.cursor/debug.log', errorLog + '\n', { append: true }).catch(() => {});
      // #endregion
      console.error("[subrules-decomposer] Campos obrigatórios faltando:", {
        master_rule_id: !master_rule_id ? "FALTANDO" : "OK",
        project_id: !project_id ? "FALTANDO" : "OK",
        user_id: !user_id ? "FALTANDO" : "OK",
      });
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: `Campos obrigatórios faltando: ${!master_rule_id ? 'master_rule_id ' : ''}${!project_id ? 'project_id ' : ''}${!user_id ? 'user_id' : ''}`.trim()
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
    const { data: masterRule, error: masterRuleError } = await supabase
      .from("rules")
      .select("*")
      .eq("id", master_rule_id)
      .single();

    // #region agent log
    const masterRuleLog = JSON.stringify({location:'subrules-decomposer/index.ts:733',message:'Resultado da busca da master rule',data:{master_rule_id:master_rule_id,has_master_rule:!!masterRule,has_error:!!masterRuleError,error_message:masterRuleError?.message},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'});
    await Deno.writeTextFile('/Users/danilofonseca/Desktop/oria-app/.cursor/debug.log', masterRuleLog + '\n', { append: true }).catch(() => {});
    // #endregion

    if (!masterRule) {
      // #region agent log
      const notFoundLog = JSON.stringify({location:'subrules-decomposer/index.ts:737',message:'Master rule não encontrada',data:{master_rule_id:master_rule_id,error:masterRuleError?.message},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'});
      await Deno.writeTextFile('/Users/danilofonseca/Desktop/oria-app/.cursor/debug.log', notFoundLog + '\n', { append: true }).catch(() => {});
      // #endregion
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
    
    // Usar journey_structured se disponível
    const structuredJourney = journey_structured || journeyData?.metadata?.journey_structured;
    
    if (structuredJourney) {
      journeyContext += "**Etapas Narrativas (com página):**\n";
      structuredJourney.steps?.forEach((step: any, i: number) => {
        journeyContext += `${i + 1}. [${step.page_key || '?'}] ${step.description}`;
        if (step.step_id) journeyContext += ` (id: ${step.step_id})`;
        if (step.user_intent) journeyContext += `\n   → Intenção: ${step.user_intent}`;
        journeyContext += "\n";
      });
      journeyContext += "\n";
      
      if (structuredJourney.decisions?.length > 0) {
        journeyContext += "**Pontos de Decisão:**\n";
        structuredJourney.decisions.forEach((decision: any) => {
          journeyContext += `- [${decision.page_key || '?'}] ${decision.description}`;
          if (decision.options?.length) journeyContext += ` (opções: ${decision.options.join(', ')})`;
          journeyContext += "\n";
        });
        journeyContext += "\n";
      }
      
      if (structuredJourney.failure_points?.length > 0) {
        journeyContext += "**Pontos de Falha/Abandono:**\n";
        structuredJourney.failure_points.forEach((failure: any) => {
          journeyContext += `- [${failure.page_key || '?'}] ${failure.description}`;
          if (failure.recovery) journeyContext += ` → Recuperação: ${failure.recovery}`;
          journeyContext += "\n";
        });
        journeyContext += "\n";
      }
    } else if (journeyData) {
      journeyContext += "**Etapas Narrativas (steps):**\n";
      journeyData.steps.forEach((step: string, i: number) => {
        journeyContext += `${i + 1}. ${step}\n`;
      });
      journeyContext += "\n";
      
      if (journeyData.decisions?.length > 0) {
        journeyContext += "**Pontos de Decisão (decisions):**\n";
        journeyData.decisions.forEach((decision: string) => {
          journeyContext += `- ${decision}\n`;
        });
        journeyContext += "\n";
      }
      
      if (journeyData.failure_points?.length > 0) {
        journeyContext += "**Pontos de Falha/Abandono (failure_points):**\n";
        journeyData.failure_points.forEach((failure: string) => {
          journeyContext += `- ${failure}\n`;
        });
        journeyContext += "\n";
      }
      
      if (journeyData.motivations?.length > 0) {
        journeyContext += "**Motivações do Usuário (motivations):**\n";
        journeyData.motivations.forEach((motivation: string) => {
          journeyContext += `- ${motivation}\n`;
        });
        journeyContext += "\n";
      }
    } else {
      journeyContext += "*Jornada não fornecida. Criar nós baseado apenas na Regra de Negócio.*\n\n";
    }
    
    // NOVO v3.0: Construir contexto do Flow Enricher
    let enricherContext = "";
    if (enriched_flow) {
      enricherContext = `## DOCUMENTO 3: ENRIQUECIMENTOS (Flow Enricher)\n\n`;
      
      if (enriched_flow.extra_steps?.length > 0) {
        enricherContext += "**Passos Extras Sugeridos:**\n";
        enriched_flow.extra_steps.forEach((step: any) => {
          enricherContext += `- [${step.page_key || '?'}] ${step.description}`;
          enricherContext += ` (${step.pattern_type || 'other'})`;
          if (step.reason) enricherContext += ` → ${step.reason}`;
          enricherContext += "\n";
        });
        enricherContext += "\n";
      }
      
      if (enriched_flow.extra_decisions?.length > 0) {
        enricherContext += "**Decisões Extras Sugeridas:**\n";
        enriched_flow.extra_decisions.forEach((decision: any) => {
          enricherContext += `- [${decision.page_key || '?'}] ${decision.description}`;
          if (decision.options?.length) enricherContext += ` (opções: ${decision.options.join(', ')})`;
          enricherContext += "\n";
        });
        enricherContext += "\n";
      }
      
      if (enriched_flow.extra_failure_points?.length > 0) {
        enricherContext += "**Pontos de Falha Extras:**\n";
        enriched_flow.extra_failure_points.forEach((failure: any) => {
          enricherContext += `- [${failure.page_key || '?'}] ${failure.description}`;
          if (failure.allows_retry) enricherContext += " (permite retry)";
          enricherContext += "\n";
        });
        enricherContext += "\n";
      }
      
      if (enriched_flow.ux_recommendations?.length > 0) {
        enricherContext += "**Recomendações de UX:**\n";
        enriched_flow.ux_recommendations.forEach((rec: any) => {
          enricherContext += `- ${rec.target}: ${rec.recommendation}`;
          if (rec.pattern_name) enricherContext += ` [${rec.pattern_name}]`;
          enricherContext += "\n";
        });
        enricherContext += "\n";
      }
    }
    
    // NOVO v3.0: Construir contexto do PageContext
    let pageContextText = "";
    if (page_context) {
      pageContextText = `## DOCUMENTO 4: CONTEXTO DE PÁGINAS\n\n`;
      
      if (page_context.pages?.length > 0) {
        pageContextText += "**Páginas Disponíveis:**\n";
        page_context.pages.forEach((page: any) => {
          pageContextText += `- ${page.page_key}: ${page.label}`;
          if (page.page_type) pageContextText += ` (${page.page_type})`;
          pageContextText += "\n";
        });
        pageContextText += "\n";
      }
      
      if (page_context.transitions?.length > 0) {
        pageContextText += "**Transições de Página:**\n";
        page_context.transitions.forEach((t: any) => {
          pageContextText += `- ${t.from_page} → ${t.to_page}`;
          if (t.reason) pageContextText += ` (${t.reason})`;
          if (t.is_error_path) pageContextText += " [ERRO]";
          pageContextText += "\n";
        });
        pageContextText += "\n";
      }
      
      if (page_context.entry_page) {
        pageContextText += `**Página de Entrada:** ${page_context.entry_page}\n`;
      }
      if (page_context.exit_pages_success?.length > 0) {
        pageContextText += `**Páginas de Saída (Sucesso):** ${page_context.exit_pages_success.join(', ')}\n`;
      }
      if (page_context.exit_pages_error?.length > 0) {
        pageContextText += `**Páginas de Saída (Erro):** ${page_context.exit_pages_error.join(', ')}\n`;
      }
    }

    const userMessage = `Transforme os documentos abaixo em NÓS RICOS (RichNodes) para um user flow:

${masterRuleContext}
${journeyContext}
${enricherContext}
${pageContextText}

## INSTRUÇÕES

1. Use a REGRA como fonte de verdade sobre O QUE acontece
2. Use a JORNADA para entender COMO o usuário experimenta E em qual PÁGINA
3. Use os ENRIQUECIMENTOS para adicionar padrões SaaS recomendados
4. Use o CONTEXTO DE PÁGINAS para garantir transições corretas
5. Cada DECISÃO da jornada pode virar uma CONDITION
6. Cada PONTO DE FALHA pode virar um END ERROR ou um nó com allows_retry
7. Garanta: 1 trigger, ≥1 end success, conditions com 2 caminhos
8. Use flow_category para classificar cada nó (main, error, alternative)

## CAMPOS OBRIGATÓRIOS v3.0

Para CADA nó, preencha:
- id, type, title, description (sempre)
- next_on_success, next_on_failure (quando aplicável)
- page_key (SEMPRE que souber a página)
- inputs (para nós com formulários - LOGIN, SIGNUP, etc.)
- user_intent (o que o usuário quer)
- system_behavior (o que o sistema faz)
- error_cases (erros esperados)
- allows_retry (true se pode tentar de novo)

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
      const rawNodes = (parsedResponse as { nodes: RichNode[] }).nodes;
      console.log("[subrules-decomposer] Verificando e corrigindo IDs simbólicos...");
      const correctedNodes = ensureSymbolicIds(rawNodes);
      (parsedResponse as { nodes: RichNode[] }).nodes = correctedNodes;
      console.log("[subrules-decomposer] IDs corrigidos:", correctedNodes.map(n => ({ id: n.id, next: n.next_on_success, page_key: n.page_key })));
    }

    // Tentar validar como RichNodes primeiro (v3.0)
    let richValidationResult = RichSubrulesResponseSchema.safeParse(parsedResponse);
    let isRichResponse = richValidationResult.success;
    let subrulesResponse: SubrulesResponse | RichSubrulesResponse;
    
    // #region agent log
    const validationLog = JSON.stringify({location:'subrules-decomposer/index.ts:1027',message:'Início da validação Zod',data:{rich_validation_success:richValidationResult.success,rich_validation_errors:richValidationResult.success?null:richValidationResult.error.errors.map((e:any)=>`${e.path.join(".")}: ${e.message}`)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'});
    await Deno.writeTextFile('/Users/danilofonseca/Desktop/oria-app/.cursor/debug.log', validationLog + '\n', { append: true }).catch(() => {});
    // #endregion
    
    if (richValidationResult.success) {
      subrulesResponse = richValidationResult.data;
      console.log("[subrules-decomposer] Validado como RichNodes v3.0");
    } else {
      // Fallback para validação básica
      const basicValidationResult = SubrulesResponseSchema.safeParse(parsedResponse);
      
      // #region agent log
      const basicValidationLog = JSON.stringify({location:'subrules-decomposer/index.ts:1036',message:'Validação básica Zod',data:{basic_validation_success:basicValidationResult.success,basic_validation_errors:basicValidationResult.success?null:basicValidationResult.error.errors.map((e:any)=>`${e.path.join(".")}: ${e.message}`)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'});
      await Deno.writeTextFile('/Users/danilofonseca/Desktop/oria-app/.cursor/debug.log', basicValidationLog + '\n', { append: true }).catch(() => {});
      // #endregion
      
      if (!basicValidationResult.success) {
        const errors = basicValidationResult.error.errors.map(
          (e) => `${e.path.join(".")}: ${e.message}`
        );
        
        // #region agent log
        const zodErrorLog = JSON.stringify({location:'subrules-decomposer/index.ts:1043',message:'Validação Zod falhou - retornando 400',data:{errors:errors},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'});
        await Deno.writeTextFile('/Users/danilofonseca/Desktop/oria-app/.cursor/debug.log', zodErrorLog + '\n', { append: true }).catch(() => {});
        // #endregion
        
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
      
      subrulesResponse = basicValidationResult.data;
      console.log("[subrules-decomposer] Validado como SubRuleNodes básicos");
    }

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
      // #region agent log
      const graphErrorLog = JSON.stringify({location:'subrules-decomposer/index.ts:1117',message:'Validação de grafo falhou após autofix - retornando 400',data:{errors:graphValidation.errors.map((e:any)=>e.message),warnings:graphValidation.warnings.map((w:any)=>w.message),nodes_count:subrulesResponse.nodes.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'F'});
      await Deno.writeTextFile('/Users/danilofonseca/Desktop/oria-app/.cursor/debug.log', graphErrorLog + '\n', { append: true }).catch(() => {});
      // #endregion
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
      // Extrair campos RichNode se disponíveis
      const richNode = node as RichNode;
      
      // Construir conteúdo markdown rico
      let content = `# ${node.title}\n\n${node.description}`;
      if (richNode.page_key) content += `\n\n**Página:** ${richNode.page_key}`;
      if (richNode.user_intent) content += `\n**Intenção do Usuário:** ${richNode.user_intent}`;
      if (richNode.system_behavior) content += `\n**Comportamento do Sistema:** ${richNode.system_behavior}`;
      if (richNode.ux_recommendation) content += `\n**Recomendação UX:** ${richNode.ux_recommendation}`;
      if (richNode.error_cases?.length) content += `\n**Erros Esperados:** ${richNode.error_cases.join(', ')}`;
      
      const { data: saved, error } = await supabase
        .from("rules")
        .insert({
          title: node.title,
          description: node.description,
          content,
          rule_type: "node_rule",
          scope: "node",
          parent_rule_id: master_rule_id,
          project_id,
          suggested_node_type: node.type,
          status: "active",
          priority: node.type === "end" && node.end_status === "error" ? "high" : "medium",
          metadata: {
            // Campos básicos
            symbolic_id: node.id,
            next_on_success: node.next_on_success,
            next_on_failure: node.next_on_failure,
            end_status: node.end_status,
            flow_category: node.flow_category || "main",
            // NOVOS campos v3.0
            page_key: richNode.page_key,
            user_intent: richNode.user_intent,
            system_behavior: richNode.system_behavior,
            ux_recommendation: richNode.ux_recommendation,
            inputs: richNode.inputs,
            error_cases: richNode.error_cases,
            allows_retry: richNode.allows_retry,
            allows_cancel: richNode.allows_cancel,
            // Metadados
            source: "subrules-decomposer-v3",
            is_rich_node: isRichResponse,
            has_journey_context: !!journeyData,
            has_enricher_context: !!enriched_flow,
            has_page_context: !!page_context,
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

    // Estatísticas v3.0
    const richNodes = subrulesResponse.nodes as RichNode[];
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
      // NOVOS stats v3.0
      nodes_with_page: richNodes.filter(n => n.page_key).length,
      nodes_with_inputs: richNodes.filter(n => n.inputs?.length).length,
      total_inputs: richNodes.reduce((sum, n) => sum + (n.inputs?.length || 0), 0),
      nodes_with_ux_recommendation: richNodes.filter(n => n.ux_recommendation).length,
      nodes_allowing_retry: richNodes.filter(n => n.allows_retry).length,
      unique_pages: [...new Set(richNodes.map(n => n.page_key).filter(Boolean))],
    };

    return new Response(
      JSON.stringify({
        success: true,
        master_rule_id,
        sub_rules: savedSubRules,
        sub_rule_ids: savedSubRules.map(s => s.db_id),
        symbolic_nodes: subrulesResponse.nodes,
        // NOVO v3.0
        rich_nodes: isRichResponse ? subrulesResponse.nodes : null,
        stats,
        graph_validation: graphValidation,
        // Contextos utilizados
        context_info: {
          has_journey: !!journeyData,
          has_journey_structured: !!structuredJourney,
          has_enricher: !!enriched_flow,
          has_page_context: !!page_context,
          is_rich_response: isRichResponse,
        },
        message: `${savedSubRules.length} nós ${isRichResponse ? 'ricos' : 'simbólicos'} criados (páginas: ${stats.unique_pages.length}, inputs: ${stats.total_inputs})`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    // #region agent log
    const errorLog = JSON.stringify({location:'subrules-decomposer/index.ts:1253',message:'Erro não tratado na edge function',data:{error_message:String(error),error_name:error?.name,error_stack:error?.stack},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'G'});
    await Deno.writeTextFile('/Users/danilofonseca/Desktop/oria-app/.cursor/debug.log', errorLog + '\n', { append: true }).catch(() => {});
    // #endregion
    console.error("Erro:", error);
    return new Response(
      JSON.stringify({ success: false, message: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
