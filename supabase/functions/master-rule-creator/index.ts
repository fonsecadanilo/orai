import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import OpenAI from "https://deno.land/x/openai@v4.68.1/mod.ts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * AGENTE: Master Rule Creator v3.0
 * 
 * NOVA ARQUITETURA:
 * - Usa modelo forte (GPT-4.1)
 * - Gera APENAS semântica de negócio
 * - NÃO gera blueprint de nós, índices ou estrutura
 * - Validação rígida via Zod
 * 
 * O LLM cuida apenas de:
 * - Objetivo de negócio
 * - Contexto
 * - Atores
 * - Premissas
 * - Fluxos (principal, alternativos, erros)
 */

// Schema Zod para validação v2.0
const PageDefinitionSchema = z.object({
  page_key: z.string().min(1).regex(/^[a-z0-9_]+$/),
  label: z.string().min(3),
  path: z.string().optional(),
  description: z.string().optional(),
  page_type: z.enum([
    "auth", "login", "signup", "recovery", "onboarding", 
    "dashboard", "settings", "checkout", "profile", 
    "list", "detail", "form", "confirmation", "error", "success", "other"
  ]).optional().default("other"),
});

const MasterRuleSchema = z.object({
  business_goal: z.string().min(10),
  context: z.string().min(10),
  actors: z.array(z.string()).min(1),
  assumptions: z.array(z.string()),
  main_flow: z.array(z.string()).min(3),
  alternative_flows: z.array(z.string()),
  error_flows: z.array(z.string()),
  // NOVO v2.0
  pages_involved: z.array(PageDefinitionSchema).optional().default([]),
});

type PageDefinition = z.infer<typeof PageDefinitionSchema>;
type MasterRule = z.infer<typeof MasterRuleSchema>;

const SYSTEM_PROMPT = `Você é um especialista em análise de processos de produtos digitais (principalmente SaaS).

## SEU PAPEL
Sua função é criar uma especificação SEMÂNTICA de regras de negócio, incluindo as PÁGINAS ENVOLVIDAS.
Você NÃO cria estruturas técnicas, nós, grafos ou layouts.
Você descreve a lógica de negócio e identifica as páginas do sistema.

## ⚠️ IMPORTANTE: SUA SAÍDA SERÁ COMBINADA COM UMA JORNADA DO USUÁRIO
Sua resposta será usada JUNTAMENTE com uma Jornada do Usuário para construir um fluxo.
Portanto, seja OBJETIVO, CLARO e SEM DETALHES VISUAIS (cores, botões, layout).
Foque na LÓGICA DE NEGÓCIO e nas PÁGINAS que participam do fluxo.

## O QUE VOCÊ NÃO FAZ (PROIBIDO)
❌ Criar IDs de nós
❌ Definir tipos de nós (trigger, action, condition, etc)
❌ Criar índices ou order_index
❌ Definir posições X/Y
❌ Criar conexões ou edges
❌ Definir layout ou estrutura visual
❌ Usar termos técnicos de grafo
❌ Descrever detalhes visuais (botões, cores, posições de elementos)

## O QUE VOCÊ FAZ (OBRIGATÓRIO)
✅ Identificar o objetivo principal do negócio
✅ Descrever o contexto/cenário
✅ Listar os atores envolvidos (usuário, sistema, etc)
✅ Definir premissas/suposições
✅ Descrever o fluxo principal passo a passo (LÓGICA, não telas)
✅ Identificar fluxos alternativos (variações de negócio)
✅ Identificar casos de erro e exceção (regras de falha)
✅ **NOVO**: Identificar PÁGINAS ENVOLVIDAS no fluxo

## SOBRE PÁGINAS (pages_involved)

Você deve identificar quais páginas fazem parte do fluxo, com base em padrões comuns de SaaS:

### Tipos de páginas comuns:
- auth: Tela de autenticação inicial (escolha entre login e cadastro)
- login: Tela de login
- signup: Tela de cadastro
- recovery: Tela de recuperação de senha
- onboarding: Tela/fluxo de primeiro acesso pós-cadastro
- dashboard: Tela principal após login
- settings: Tela de configurações
- checkout: Tela de pagamento
- profile: Tela de perfil do usuário
- list: Tela de listagem
- detail: Tela de detalhe
- form: Formulário genérico
- confirmation: Tela de confirmação
- error: Página de erro
- success: Página de sucesso

### Para cada página, defina:
- page_key: slug em snake_case (ex: "login", "signup", "onboarding")
- label: nome amigável (ex: "Página de Login")
- path: sugestão de URL (ex: "/login")
- description: papel da página no fluxo
- page_type: tipo da página (um dos tipos acima)

## FORMATO DE SAÍDA (JSON OBRIGATÓRIO)

{
  "business_goal": "Objetivo principal do processo de negócio em uma frase clara e mensurável",
  
  "context": "Cenário ou situação em que este processo ocorre",
  
  "actors": [
    "Ator 1 (ex: Usuário, Cliente, Sistema, Administrador)"
  ],
  
  "assumptions": [
    "Premissa 1: O que assumimos como verdade para o negócio",
    "Premissa 2: Condições necessárias para o fluxo funcionar"
  ],
  
  "main_flow": [
    "Passo 1: Ação de negócio clara (quem faz o quê)",
    "Passo 2: Próxima ação de negócio",
    "Passo 3: Continuação lógica",
    "... (mínimo 5 passos)"
  ],
  
  "alternative_flows": [
    "Alternativa 1: Se condição X, então acontece Y",
    "Alternativa 2: Quando situação diferente ocorre"
  ],
  
  "error_flows": [
    "Erro 1: Se regra X falhar, consequência Y e recuperação Z",
    "Erro 2: Em caso de falha técnica, comportamento esperado"
  ],
  
  "pages_involved": [
    {
      "page_key": "auth",
      "label": "Página de Autenticação",
      "path": "/auth",
      "description": "Tela inicial onde o usuário escolhe entre login e cadastro.",
      "page_type": "auth"
    },
    {
      "page_key": "login",
      "label": "Página de Login",
      "path": "/login",
      "description": "Tela com formulário para usuários que já possuem conta.",
      "page_type": "login"
    }
  ]
}

## REGRAS DE QUALIDADE

1. business_goal: Claro, mensurável, orientado a resultado de negócio
2. context: Explica QUANDO e POR QUE o processo acontece
3. actors: Lista TODOS os participantes (humanos e sistemas)
4. assumptions: Lista pré-requisitos e condições prévias
5. main_flow: NO MÍNIMO 5 passos claros, focados em AÇÕES DE NEGÓCIO
6. alternative_flows: Variações legítimas do caminho feliz
7. error_flows: Todas as falhas de negócio e técnicas
8. pages_involved: TODAS as páginas que participam do fluxo (mínimo 2)

## PADRÕES SAAS A CONSIDERAR

### Fluxos de autenticação devem incluir:
- Página de auth (escolha)
- Página de login
- Página de signup (se aplicável)
- Página de recovery (esqueci minha senha)
- Página de onboarding ou dashboard (destino pós-login)

### Fluxos de cadastro devem incluir:
- Página de signup
- Página de onboarding (primeiro acesso)
- Página de dashboard (destino final)

### Fluxos de checkout devem incluir:
- Página de checkout
- Página de confirmation (pós-pagamento)
- Página de error (em caso de falha)
- Página de success (sucesso)

⚠️ NÃO descreva layout, cores, botões específicos. Foque no PAPEL da página no fluxo.

RETORNE APENAS JSON VÁLIDO, sem markdown ou explicações.`;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { prompt, project_id, user_id, conversation_id } = await req.json();

    if (!prompt || !project_id || !user_id) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: "Campos obrigatórios faltando: prompt, project_id, user_id" 
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const openaiKey = Deno.env.get("OPENAI_API_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseKey);
    const openai = new OpenAI({ apiKey: openaiKey });

    const userMessage = `Crie uma especificação de REGRA DE NEGÓCIO para:

"${prompt}"

## IMPORTANTE
Esta especificação será COMBINADA com uma JORNADA DO USUÁRIO posteriormente.
Foque na lógica de negócio, regras E nas páginas envolvidas.

## REQUISITOS
- NÃO crie nós, IDs, índices ou estrutura técnica
- Descreva a semântica de negócio (regras, condições, atores)
- Inclua pelo menos 5 passos no fluxo principal (ações de negócio)
- Identifique pelo menos 2 fluxos alternativos (variações de regra)
- Identifique pelo menos 2 fluxos de erro (falhas de negócio)
- IDENTIFIQUE TODAS AS PÁGINAS ENVOLVIDAS (auth, login, signup, dashboard, etc.)
- Seja OBJETIVO e CLARO - descreva o papel de cada página, não detalhes visuais

## PADRÕES SAAS
- Se for fluxo de autenticação: inclua auth, login, signup, recovery, dashboard
- Se for fluxo de cadastro: inclua signup, onboarding, dashboard
- Se for fluxo de checkout: inclua checkout, confirmation, success, error

RETORNE APENAS JSON VÁLIDO.`;

    // Usar modelo forte (GPT-4.1 ou GPT-4-turbo)
    const completion = await openai.chat.completions.create({
      model: "gpt-4-turbo-preview", // Modelo forte para Master Rule
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userMessage },
      ],
      temperature: 0.3, // Mais determinístico
      max_tokens: 3000,
      response_format: { type: "json_object" },
    });

    const assistantMessage = completion.choices[0]?.message?.content;
    if (!assistantMessage) {
      return new Response(
        JSON.stringify({ success: false, message: "Resposta vazia do modelo" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let parsedRule: unknown;
    try {
      parsedRule = JSON.parse(assistantMessage);
    } catch {
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: "Erro ao parsear JSON da resposta",
          raw_response: assistantMessage 
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validar com Zod
    const validationResult = MasterRuleSchema.safeParse(parsedRule);
    
    if (!validationResult.success) {
      const errors = validationResult.error.errors.map(
        (e) => `${e.path.join(".")}: ${e.message}`
      );
      
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: "Validação falhou",
          validation_errors: errors,
          raw_response: parsedRule
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let masterRule: MasterRule = validationResult.data;

    // NOVO v2.0: Complementar páginas detectadas automaticamente
    let detectedPages = detectPagesFromFlow(masterRule);
    
    // Mesclar páginas do LLM com páginas detectadas
    if (!masterRule.pages_involved || masterRule.pages_involved.length === 0) {
      masterRule.pages_involved = detectedPages;
    } else {
      // Adicionar páginas detectadas que não estão na lista do LLM
      const existingKeys = new Set(masterRule.pages_involved.map(p => p.page_key));
      for (const detected of detectedPages) {
        if (!existingKeys.has(detected.page_key)) {
          masterRule.pages_involved.push(detected);
        }
      }
    }

    // Gerar título a partir do business_goal
    const title = masterRule.business_goal.length > 80
      ? masterRule.business_goal.substring(0, 77) + "..."
      : masterRule.business_goal;

    // Gerar markdown formatado
    const markdownContent = formatMasterRuleToMarkdown(masterRule);

    // Detectar categoria automaticamente
    const category = detectCategory(prompt, masterRule);
    
    // NOVO v2.0: Detectar se envolve autenticação
    const involvesAuth = masterRule.pages_involved?.some(p => 
      ["auth", "login", "signup", "recovery"].includes(p.page_key)
    ) || false;
    
    // NOVO v2.0: Detectar se requer onboarding
    const requiresOnboarding = masterRule.pages_involved?.some(p => 
      p.page_key === "onboarding"
    ) || false;

    // Salvar no banco (sem flow_blueprint)
    const { data: savedRule, error: ruleError } = await supabase
      .from("rules")
      .insert({
        title,
        description: masterRule.context,
        content: markdownContent,
        category,
        priority: "high",
        status: "active",
        rule_type: "flow_master",
        scope: "flow",
        project_id,
        acceptance_criteria: masterRule.main_flow.map((step, i) => `Passo ${i + 1} executado corretamente`),
        edge_cases: masterRule.error_flows,
        // NÃO incluir flow_blueprint - isso é responsabilidade da engine
        metadata: { 
          source: "master-rule-creator-v3.1",
          version: "2.0",
          prompt,
          semantic_data: masterRule, // Salvar dados semânticos incluindo pages_involved
          involves_auth: involvesAuth,
          requires_onboarding: requiresOnboarding,
          detected_pages: masterRule.pages_involved?.map(p => p.page_key) || [],
        },
      })
      .select("*")
      .single();

    if (ruleError) {
      console.error("Erro ao salvar regra:", ruleError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: "Erro ao salvar regra no banco",
          details: ruleError 
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Salvar conversa
    const newConversationId = conversation_id || crypto.randomUUID();
    await supabase.from("agent_conversations").upsert({
      id: newConversationId,
      project_id,
      user_id,
      agent_type: "master_rule_creator_v3",
      messages: [
        { role: "user", content: userMessage },
        { role: "assistant", content: assistantMessage },
      ],
      context: { master_rule_id: savedRule.id },
      updated_at: new Date().toISOString(),
    });

    // Análise da regra v2.0
    const analysis = {
      steps_count: masterRule.main_flow.length,
      alternative_flows_count: masterRule.alternative_flows.length,
      error_flows_count: masterRule.error_flows.length,
      actors_count: masterRule.actors.length,
      assumptions_count: masterRule.assumptions.length,
      // NOVO v2.0
      pages_count: masterRule.pages_involved?.length || 0,
      involves_auth: involvesAuth,
      requires_onboarding: requiresOnboarding,
      quality_score: calculateQualityScore(masterRule),
    };

    return new Response(
      JSON.stringify({
        success: true,
        master_rule: {
          ...savedRule,
          semantic_data: masterRule, // Incluir dados semânticos na resposta
          // NOVO v2.0: Incluir páginas na resposta
          pages_involved: masterRule.pages_involved,
        },
        master_rule_id: savedRule.id,
        conversation_id: newConversationId,
        analysis,
        message: `Regra master "${title}" criada com ${analysis.steps_count} passos e ${analysis.pages_count} páginas`,
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

/**
 * Formata MasterRule para Markdown
 */
function formatMasterRuleToMarkdown(rule: MasterRule): string {
  let markdown = `# ${rule.business_goal}

## Contexto
${rule.context}

## Atores
${rule.actors.map((a) => `- ${a}`).join("\n")}

## Premissas
${rule.assumptions.map((a) => `- ${a}`).join("\n")}

## Fluxo Principal
${rule.main_flow.map((step, i) => `${i + 1}. ${step}`).join("\n")}

## Fluxos Alternativos
${rule.alternative_flows.map((f) => `- ${f}`).join("\n")}

## Fluxos de Erro/Exceção
${rule.error_flows.map((e) => `- ${e}`).join("\n")}`;

  // NOVO v2.0: Adicionar páginas
  if (rule.pages_involved && rule.pages_involved.length > 0) {
    markdown += `\n\n## Páginas Envolvidas\n`;
    for (const page of rule.pages_involved) {
      markdown += `\n### ${page.label} (\`${page.page_key}\`)\n`;
      if (page.path) markdown += `- **Rota:** ${page.path}\n`;
      if (page.page_type) markdown += `- **Tipo:** ${page.page_type}\n`;
      if (page.description) markdown += `- **Descrição:** ${page.description}\n`;
    }
  }

  return markdown;
}

/**
 * Detecta páginas automaticamente com base no conteúdo do fluxo
 */
function detectPagesFromFlow(rule: MasterRule): PageDefinition[] {
  const allText = [
    ...rule.main_flow, 
    ...rule.alternative_flows, 
    ...rule.error_flows,
    rule.business_goal,
    rule.context
  ].join(" ").toLowerCase();
  
  const detectedPages: PageDefinition[] = [];
  
  // Detectar páginas comuns
  if (allText.includes("login") || allText.includes("entrar") || allText.includes("autenticar")) {
    detectedPages.push({ 
      page_key: "login", 
      label: "Página de Login", 
      path: "/login", 
      page_type: "login",
      description: "Tela de login para usuários existentes"
    });
  }
  
  if (allText.includes("cadastro") || allText.includes("registr") || allText.includes("criar conta") || allText.includes("signup")) {
    detectedPages.push({ 
      page_key: "signup", 
      label: "Página de Cadastro", 
      path: "/signup", 
      page_type: "signup",
      description: "Tela de cadastro para novos usuários"
    });
  }
  
  if (allText.includes("recuperar senha") || allText.includes("esqueci") || allText.includes("resetar senha")) {
    detectedPages.push({ 
      page_key: "recovery", 
      label: "Recuperação de Senha", 
      path: "/forgot-password", 
      page_type: "recovery",
      description: "Tela para recuperar senha esquecida"
    });
  }
  
  if (allText.includes("onboarding") || allText.includes("primeiro acesso") || allText.includes("boas-vindas") || allText.includes("tutorial")) {
    detectedPages.push({ 
      page_key: "onboarding", 
      label: "Onboarding", 
      path: "/onboarding", 
      page_type: "onboarding",
      description: "Fluxo de primeiro acesso após cadastro"
    });
  }
  
  if (allText.includes("dashboard") || allText.includes("painel") || allText.includes("tela principal") || allText.includes("home")) {
    detectedPages.push({ 
      page_key: "dashboard", 
      label: "Dashboard", 
      path: "/dashboard", 
      page_type: "dashboard",
      description: "Tela principal após login bem-sucedido"
    });
  }
  
  if (allText.includes("checkout") || allText.includes("pagamento") || allText.includes("finalizar compra")) {
    detectedPages.push({ 
      page_key: "checkout", 
      label: "Checkout", 
      path: "/checkout", 
      page_type: "checkout",
      description: "Tela de pagamento"
    });
  }
  
  if (allText.includes("configurações") || allText.includes("settings") || allText.includes("preferências")) {
    detectedPages.push({ 
      page_key: "settings", 
      label: "Configurações", 
      path: "/settings", 
      page_type: "settings",
      description: "Tela de configurações"
    });
  }
  
  if (allText.includes("perfil") || allText.includes("profile") || allText.includes("minha conta")) {
    detectedPages.push({ 
      page_key: "profile", 
      label: "Perfil", 
      path: "/profile", 
      page_type: "profile",
      description: "Tela de perfil do usuário"
    });
  }
  
  // Se detectou login ou signup, adicionar página de auth (escolha)
  if (detectedPages.some(p => p.page_key === "login" || p.page_key === "signup")) {
    if (!detectedPages.some(p => p.page_key === "auth")) {
      detectedPages.unshift({ 
        page_key: "auth", 
        label: "Página de Autenticação", 
        path: "/auth", 
        page_type: "auth",
        description: "Tela inicial com opção de login ou cadastro"
      });
    }
  }
  
  return detectedPages;
}

/**
 * Detecta categoria automaticamente
 */
function detectCategory(prompt: string, rule: MasterRule): string {
  const text = `${prompt} ${rule.business_goal} ${rule.context}`.toLowerCase();
  
  if (text.includes("login") || text.includes("autenticação") || text.includes("senha")) {
    return "autenticacao";
  }
  if (text.includes("pagamento") || text.includes("cartão") || text.includes("pix")) {
    return "pagamento";
  }
  if (text.includes("cadastro") || text.includes("registro") || text.includes("criar conta")) {
    return "cadastro";
  }
  if (text.includes("checkout") || text.includes("compra") || text.includes("carrinho")) {
    return "checkout";
  }
  if (text.includes("onboarding") || text.includes("primeiro acesso") || text.includes("boas-vindas")) {
    return "onboarding";
  }
  
  return "outro";
}

/**
 * Calcula score de qualidade da regra v2.0
 */
function calculateQualityScore(rule: MasterRule): number {
  let score = 50; // Base
  
  // Pontos por quantidade de passos
  if (rule.main_flow.length >= 5) score += 10;
  if (rule.main_flow.length >= 8) score += 10;
  
  // Pontos por fluxos alternativos
  if (rule.alternative_flows.length >= 2) score += 10;
  if (rule.alternative_flows.length >= 4) score += 5;
  
  // Pontos por fluxos de erro
  if (rule.error_flows.length >= 2) score += 10;
  if (rule.error_flows.length >= 4) score += 5;
  
  // Pontos por atores identificados
  if (rule.actors.length >= 2) score += 5;
  
  // Pontos por premissas
  if (rule.assumptions.length >= 2) score += 5;
  
  // NOVO v2.0: Pontos por páginas identificadas
  if (rule.pages_involved && rule.pages_involved.length >= 2) score += 10;
  if (rule.pages_involved && rule.pages_involved.length >= 4) score += 5;
  
  // NOVO v2.0: Pontos por padrões SaaS identificados
  const pageKeys = rule.pages_involved?.map(p => p.page_key) || [];
  
  // Se é fluxo de auth, verificar se tem as páginas necessárias
  if (pageKeys.includes("login") || pageKeys.includes("signup")) {
    if (pageKeys.includes("dashboard") || pageKeys.includes("onboarding")) score += 5;
    if (pageKeys.includes("recovery")) score += 5;
  }
  
  // Penalidade por passos muito curtos
  const avgStepLength = rule.main_flow.reduce((sum, s) => sum + s.length, 0) / rule.main_flow.length;
  if (avgStepLength < 20) score -= 10;
  
  return Math.min(100, Math.max(0, score));
}
