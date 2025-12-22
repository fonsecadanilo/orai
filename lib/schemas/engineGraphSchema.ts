import { z } from "zod";

/**
 * Schema do Engine Graph - Estrutura gerada pelo CÓDIGO
 * 
 * Este schema representa a estrutura final do fluxo após
 * o processamento determinístico pela engine.
 * 
 * Inclui:
 * - order_index (gerado via BFS)
 * - posições x, y (calculadas por algoritmo)
 * - edges com labels
 * - metadados de layout
 */

/**
 * Tipos de nós no grafo final
 */
export const EngineNodeTypeEnum = z.enum([
  "trigger",
  "action",
  "condition",
  "end",
  "subflow",
]);

export type EngineNodeType = z.infer<typeof EngineNodeTypeEnum>;

/**
 * Coluna do nó no layout (para posicionamento Y)
 */
export const LayoutColumnEnum = z.enum([
  "main",         // Linha principal (happy path)
  "error",        // Linha de erros (abaixo)
  "alternative",  // Linha alternativa (acima)
]);

export type LayoutColumn = z.infer<typeof LayoutColumnEnum>;

/**
 * Schema de um nó no grafo da engine
 */
export const EngineNodeSchema = z.object({
  // ID único (string para React Flow)
  id: z.string().min(1),
  
  // ID original simbólico
  symbolic_id: z.string().min(1),
  
  // Tipo do nó
  type: EngineNodeTypeEnum,
  
  // Título e descrição
  title: z.string().min(1),
  description: z.string(),
  
  // Índice de ordem (gerado via BFS)
  order_index: z.number().int().positive(),
  
  // Posições (calculadas por algoritmo)
  position_x: z.number(),
  position_y: z.number(),
  
  // Coluna no layout
  column: LayoutColumnEnum.default("main"),
  
  // Profundidade no grafo (nível BFS)
  depth: z.number().int().nonnegative(),
  
  // Status para end nodes
  end_status: z.enum(["success", "error"]).optional(),
  
  // Metadados adicionais
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type EngineNode = z.infer<typeof EngineNodeSchema>;

/**
 * Tipo de conexão (para estilização)
 */
export const ConnectionTypeEnum = z.enum([
  "success",      // Caminho de sucesso
  "failure",      // Caminho de falha
  "default",      // Conexão padrão
]);

export type ConnectionType = z.infer<typeof ConnectionTypeEnum>;

/**
 * Schema de uma edge (conexão) no grafo
 */
export const EngineEdgeSchema = z.object({
  // ID único da edge
  id: z.string().min(1),
  
  // IDs dos nós conectados
  source: z.string().min(1),
  target: z.string().min(1),
  
  // Tipo da conexão
  type: ConnectionTypeEnum.default("default"),
  
  // Label da edge (Sim, Não, etc)
  label: z.string().optional(),
  
  // Se a edge é animada
  animated: z.boolean().default(false),
  
  // Estilo da edge
  style: z.object({
    stroke: z.string().optional(),
    strokeWidth: z.number().optional(),
    strokeDasharray: z.string().optional(),
  }).optional(),
});

export type EngineEdge = z.infer<typeof EngineEdgeSchema>;

/**
 * Informações de layout do grafo
 */
export const LayoutInfoSchema = z.object({
  // Dimensões totais
  width: z.number().positive(),
  height: z.number().positive(),
  
  // Centro do grafo
  center_x: z.number(),
  center_y: z.number(),
  
  // Configurações usadas
  config: z.object({
    node_spacing_x: z.number().default(280),
    node_spacing_y: z.number().default(180),
    start_x: z.number().default(100),
    start_y: z.number().default(300),
    orientation: z.enum(["horizontal", "vertical"]).default("horizontal"),
  }),
});

export type LayoutInfo = z.infer<typeof LayoutInfoSchema>;

/**
 * Schema do grafo completo da engine
 */
export const EngineGraphSchema = z.object({
  // Nós do grafo
  nodes: z.array(EngineNodeSchema),
  
  // Conexões (edges)
  edges: z.array(EngineEdgeSchema),
  
  // Informações de layout
  layout: LayoutInfoSchema,
  
  // Estatísticas
  stats: z.object({
    total_nodes: z.number().int().nonnegative(),
    total_edges: z.number().int().nonnegative(),
    triggers: z.number().int().nonnegative(),
    actions: z.number().int().nonnegative(),
    conditions: z.number().int().nonnegative(),
    ends_success: z.number().int().nonnegative(),
    ends_error: z.number().int().nonnegative(),
    subflows: z.number().int().nonnegative(),
    max_depth: z.number().int().nonnegative(),
  }),
  
  // Validação
  validation: z.object({
    is_valid: z.boolean(),
    errors: z.array(z.string()),
    warnings: z.array(z.string()),
    score: z.number().min(0).max(100),
  }),
});

export type EngineGraph = z.infer<typeof EngineGraphSchema>;

/**
 * Configuração para o layout do grafo
 */
export interface LayoutConfig {
  nodeSpacingX: number;
  nodeSpacingY: number;
  startX: number;
  startY: number;
  orientation: "horizontal" | "vertical";
  errorPathYOffset: number;
  alternativePathYOffset: number;
}

/**
 * Configuração padrão de layout
 */
export const DEFAULT_LAYOUT_CONFIG: LayoutConfig = {
  nodeSpacingX: 280,
  nodeSpacingY: 180,
  startX: 100,
  startY: 300,
  orientation: "horizontal",
  errorPathYOffset: 180,
  alternativePathYOffset: -180,
};

/**
 * Valida um grafo da engine
 */
export function validateEngineGraph(data: unknown): {
  success: boolean;
  data?: EngineGraph;
  errors?: z.ZodError;
} {
  const result = EngineGraphSchema.safeParse(data);
  
  if (result.success) {
    return { success: true, data: result.data };
  }
  
  return { success: false, errors: result.error };
}
















