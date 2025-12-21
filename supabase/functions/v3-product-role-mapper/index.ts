import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import OpenAI from "https://deno.land/x/openai@v4.68.1/mod.ts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * AGENTE 1: Product & Role Mapper v3.1
 * 
 * RESPONSABILIDADES:
 * - Analisar o prompt do usuário e identificar contexto do produto
 * - Detectar tipo de produto (SaaS, Fintech, E-commerce, etc.)
 * - Identificar e mapear roles/papéis de usuário
 * - Determinar o papel principal para o fluxo
 * - Extrair metadados semânticos do produto
 */

// Schema de entrada
const ProductRoleMapperRequestSchema = z.object({
  prompt: z.string(),
  project_id: z.number(),
  user_id: z.number(),
  existing_context: z.object({
    product_name: z.string().optional(),
    product_type: z.string().optional(),
    existing_roles: z.array(z.string()).optional(),
  }).optional(),
});

// Schema de saída do LLM
const ProductContextSchema = z.object({
  product_name: z.string(),
  product_type: z.enum([
    "saas", "fintech", "ecommerce", "healthcare", "education",
    "social", "marketplace", "productivity", "analytics", "other"
  ]),
  product_description: z.string(),
  industry: z.string(),
  target_audience: z.string(),
  key_features: z.array(z.string()),
  business_model: z.enum([
    "b2b", "b2c", "b2b2c", "marketplace", "subscription", "freemium", "other"
  ]),
});

const UserRoleSchema = z.object({
  role_id: z.string(),
  role_name: z.string(),
  display_name: z.string(),
  description: z.string(),
  permissions: z.array(z.string()),
  is_primary: z.boolean(),
  hierarchy_level: z.number(), // 0 = highest (admin), higher = lower
});

const LLMResponseSchema = z.object({
  product_context: ProductContextSchema,
  identified_roles: z.array(UserRoleSchema),
  primary_role_for_flow: z.string(), // role_id
  flow_context: z.object({
    main_goal: z.string(),
    user_intent: z.string(),
    expected_outcome: z.string(),
    key_actions: z.array(z.string()),
  }),
  metadata: z.object({
    confidence_score: z.number().min(0).max(1),
    reasoning: z.string(),
    suggestions: z.array(z.string()).optional(),
  }),
});

type ProductRoleMapperRequest = z.infer<typeof ProductRoleMapperRequestSchema>;
type LLMResponse = z.infer<typeof LLMResponseSchema>;

const SYSTEM_PROMPT = `Você é um especialista em Product Design e arquitetura de sistemas SaaS.

## SEU PAPEL

Analisar prompts de usuários e extrair:
1. **Contexto do Produto** - Tipo, indústria, modelo de negócio
2. **Roles/Papéis** - Quem são os usuários e suas permissões
3. **Contexto do Fluxo** - Objetivo, intenção, resultado esperado

## TIPOS DE PRODUTO RECONHECIDOS

- **saas**: Software as a Service genérico
- **fintech**: Serviços financeiros, pagamentos, banking
- **ecommerce**: Lojas online, vendas
- **healthcare**: Saúde, telemedicina, wellness
- **education**: EdTech, cursos, LMS
- **social**: Redes sociais, comunidades
- **marketplace**: Plataformas de dois lados
- **productivity**: Ferramentas de produtividade
- **analytics**: BI, dashboards, métricas
- **other**: Outros tipos

## ROLES COMUNS POR TIPO

### SaaS Geral
- owner: Proprietário/criador da conta
- admin: Administrador com controle total
- manager: Gerente com controle de equipe
- member: Membro regular
- guest: Convidado com acesso limitado
- viewer: Apenas visualização

### Fintech
- account_holder: Titular da conta
- authorized_user: Usuário autorizado
- compliance_officer: Oficial de compliance
- support_agent: Agente de suporte

### E-commerce
- store_owner: Dono da loja
- store_manager: Gerente da loja
- customer: Cliente
- guest_customer: Cliente não registrado

## REGRAS

1. SEMPRE identifique pelo menos 2 roles
2. SEMPRE marque uma role como is_primary: true (a mais relevante para o fluxo)
3. Hierarchy_level: 0 = mais alto (admin), números maiores = níveis menores
4. Permissions devem ser ações específicas ("create_user", "view_reports", etc.)
5. Confidence_score: sua confiança na análise (0-1)

## FORMATO DE SAÍDA (JSON OBRIGATÓRIO)

{
  "product_context": {
    "product_name": "Nome do produto inferido ou genérico",
    "product_type": "saas|fintech|ecommerce|...",
    "product_description": "Descrição breve",
    "industry": "Indústria/setor",
    "target_audience": "Público-alvo",
    "key_features": ["feature1", "feature2"],
    "business_model": "b2b|b2c|..."
  },
  "identified_roles": [
    {
      "role_id": "admin",
      "role_name": "admin",
      "display_name": "Administrador",
      "description": "Controle total do sistema",
      "permissions": ["manage_users", "manage_settings", "view_all"],
      "is_primary": false,
      "hierarchy_level": 0
    },
    {
      "role_id": "member",
      "role_name": "member",
      "display_name": "Membro",
      "description": "Usuário regular",
      "permissions": ["view_own", "edit_own"],
      "is_primary": true,
      "hierarchy_level": 2
    }
  ],
  "primary_role_for_flow": "member",
  "flow_context": {
    "main_goal": "Objetivo principal do fluxo",
    "user_intent": "O que o usuário quer alcançar",
    "expected_outcome": "Resultado esperado",
    "key_actions": ["ação1", "ação2", "ação3"]
  },
  "metadata": {
    "confidence_score": 0.85,
    "reasoning": "Explicação da análise",
    "suggestions": ["sugestão opcional"]
  }
}

RETORNE APENAS JSON VÁLIDO, sem markdown ou explicações.`;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const request = ProductRoleMapperRequestSchema.parse(body);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const openaiKey = Deno.env.get("OPENAI_API_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseKey);
    const openai = new OpenAI({ apiKey: openaiKey });

    // Buscar contexto existente do projeto se disponível
    let projectContext = "";
    if (request.project_id) {
      const { data: project } = await supabase
        .from("projects")
        .select("name, description, metadata")
        .eq("id", request.project_id)
        .single();

      if (project) {
        projectContext = `
CONTEXTO DO PROJETO EXISTENTE:
- Nome: ${project.name}
- Descrição: ${project.description || "Não especificada"}
- Metadados: ${project.metadata ? JSON.stringify(project.metadata) : "Nenhum"}
`;
      }
    }

    // Adicionar contexto existente se fornecido
    let existingContextStr = "";
    if (request.existing_context) {
      existingContextStr = `
CONTEXTO PRÉVIO FORNECIDO:
- Nome do Produto: ${request.existing_context.product_name || "Não especificado"}
- Tipo de Produto: ${request.existing_context.product_type || "Não especificado"}
- Roles Existentes: ${request.existing_context.existing_roles?.join(", ") || "Nenhuma"}
`;
    }

    const userMessage = `Analise o seguinte prompt e extraia o contexto do produto e roles:

PROMPT DO USUÁRIO:
"${request.prompt}"

${projectContext}
${existingContextStr}

## INSTRUÇÕES

1. Identifique o tipo de produto e seu contexto
2. Liste todos os roles/papéis de usuário relevantes
3. Determine qual role é o foco principal do fluxo
4. Extraia o objetivo e contexto do fluxo

RETORNE APENAS JSON VÁLIDO.`;

    console.log("[v3-product-role-mapper] Analisando prompt...");

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userMessage },
      ],
      temperature: 0.3,
      max_tokens: 2000,
      response_format: { type: "json_object" },
    });

    const assistantMessage = completion.choices[0]?.message?.content;
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

    // Validar com Zod
    const validationResult = LLMResponseSchema.safeParse(parsedResponse);
    
    if (!validationResult.success) {
      console.warn("[v3-product-role-mapper] Validação falhou:", validationResult.error.errors);
      
      // Tentar extrair dados parciais
      const partialData = parsedResponse as any;
      
      // Formatar resposta parcial no formato esperado pelo cliente
      const defaultRole = { role_id: "user", role_name: "user", display_name: "Usuário", description: "Usuário padrão", permissions: ["view_own"], hierarchy_level: 1 };
      const identifiedRoles = partialData.identified_roles || [defaultRole];
      
      return new Response(
        JSON.stringify({
          success: true,
          product_context: {
            ...(partialData.product_context || { product_name: "Produto", product_type: "saas" }),
            main_value_proposition: partialData.product_context?.product_description || "",
          },
          roles: identifiedRoles.map((role: any) => ({
            role_id: role.role_id || "user",
            role_name: role.role_name || "user",
            display_name: role.display_name || "Usuário",
            description: role.description || "",
            permissions: role.permissions || [],
            can_create_flows: (role.hierarchy_level || 2) <= 1,
            can_edit_flows: (role.hierarchy_level || 2) <= 2,
            can_view_flows: true,
          })),
          primary_role: partialData.primary_role_for_flow || identifiedRoles[0]?.role_id || "user",
          analysis: {
            detected_product_type: partialData.product_context?.product_type || "saas",
            detected_roles_count: identifiedRoles.length,
            confidence_score: 0.5,
            suggestions: [],
          },
          flow_context: partialData.flow_context || { main_goal: request.prompt, user_intent: request.prompt, expected_outcome: "Fluxo completo", key_actions: [] },
          validation_warnings: validationResult.error.errors.map(e => `${e.path.join(".")}: ${e.message}`),
          message: "Contexto mapeado com validação parcial",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const result: LLMResponse = validationResult.data;

    console.log("[v3-product-role-mapper] Mapeamento completo:", {
      product_type: result.product_context.product_type,
      roles_count: result.identified_roles.length,
      primary_role: result.primary_role_for_flow,
      confidence: result.metadata.confidence_score,
    });

    // Formatar resposta no formato esperado pelo cliente
    return new Response(
      JSON.stringify({
        success: true,
        product_context: {
          ...result.product_context,
          main_value_proposition: result.product_context.product_description,
        },
        roles: result.identified_roles.map(role => ({
          role_id: role.role_id,
          role_name: role.role_name,
          display_name: role.display_name,
          description: role.description,
          permissions: role.permissions,
          can_create_flows: role.hierarchy_level <= 1,
          can_edit_flows: role.hierarchy_level <= 2,
          can_view_flows: true,
        })),
        primary_role: result.primary_role_for_flow,
        analysis: {
          detected_product_type: result.product_context.product_type,
          detected_roles_count: result.identified_roles.length,
          confidence_score: result.metadata.confidence_score,
          suggestions: result.metadata.suggestions || [],
        },
        flow_context: result.flow_context,
        message: `Contexto mapeado: ${result.product_context.product_type} com ${result.identified_roles.length} roles identificadas`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[v3-product-role-mapper] Erro:", error);
    return new Response(
      JSON.stringify({ success: false, message: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

