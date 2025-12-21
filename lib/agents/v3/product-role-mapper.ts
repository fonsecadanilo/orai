/**
 * Agent 1: Product & Role Mapper v3.1
 * 
 * Responsabilidades:
 * - Analisar o prompt do usuário e identificar contexto do produto
 * - Detectar tipo de produto (SaaS, Fintech, E-commerce, etc.)
 * - Identificar e mapear roles/papéis de usuário
 * - Determinar o papel principal para o fluxo
 */

import { supabase } from "@/lib/supabase/client";
import type {
  ProductRoleMapperRequest,
  ProductRoleMapperResponse,
  ProductContext,
  RoleDefinition,
} from "./types";
import type { AgentError } from "../types";

const EDGE_FUNCTION_URL = "v3-product-role-mapper";

/**
 * Mapeia contexto de produto e roles de usuário a partir do prompt
 */
export async function mapProductAndRole(
  request: ProductRoleMapperRequest
): Promise<ProductRoleMapperResponse> {
  console.log("[Agent 1: Product & Role Mapper] Iniciando mapeamento...");

  const { data, error } = await supabase.functions.invoke<ProductRoleMapperResponse>(
    EDGE_FUNCTION_URL,
    {
      body: {
        prompt: request.prompt,
        project_id: request.project_id,
        user_id: request.user_id,
        existing_context: request.existing_context,
      },
    }
  );

  if (error) {
    console.error("[Product & Role Mapper] Erro:", error);
    throw {
      code: "EDGE_FUNCTION_ERROR",
      message: error.message || "Erro ao conectar com o agente de mapeamento",
      details: error,
    } as AgentError;
  }

  if (!data) {
    throw {
      code: "EMPTY_RESPONSE",
      message: "Resposta vazia do agente de mapeamento",
    } as AgentError;
  }

  if (!data.success) {
    throw {
      code: "AGENT_ERROR",
      message: data.message || "Erro ao mapear produto e roles",
    } as AgentError;
  }

  console.log("[Product & Role Mapper] Mapeamento completo:", {
    product_type: data.product_context?.product_type,
    roles_count: data.roles?.length,
    primary_role: data.primary_role,
  });

  return data;
}

/**
 * Extrai contexto do produto de um projeto existente
 */
export async function getProductContextFromProject(
  projectId: number
): Promise<Partial<ProductContext> | null> {
  const { data: project, error } = await supabase
    .from("projects")
    .select("name, description, metadata")
    .eq("id", projectId)
    .single();

  if (error || !project) {
    return null;
  }

  // Tentar extrair contexto dos metadados do projeto
  const metadata = project.metadata as Record<string, unknown> | null;
  
  if (metadata?.product_context) {
    return metadata.product_context as Partial<ProductContext>;
  }

  // Retornar contexto básico
  return {
    product_name: project.name,
    main_value_proposition: project.description || undefined,
  };
}

/**
 * Salva contexto de produto no projeto
 */
export async function saveProductContext(
  projectId: number,
  context: ProductContext
): Promise<boolean> {
  const { error } = await supabase
    .from("projects")
    .update({
      metadata: supabase.rpc("jsonb_set", {
        target: "metadata",
        path: ["product_context"],
        value: context,
      }),
    })
    .eq("id", projectId);

  return !error;
}

/**
 * Lista roles definidas para um projeto
 */
export async function getProjectRoles(
  projectId: number
): Promise<RoleDefinition[]> {
  const { data, error } = await supabase
    .from("projects")
    .select("metadata")
    .eq("id", projectId)
    .single();

  if (error || !data) {
    return [];
  }

  const metadata = data.metadata as Record<string, unknown> | null;
  return (metadata?.roles as RoleDefinition[]) || [];
}
