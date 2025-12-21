# 🔧 Engine de Geração de Grafo - Documentação Técnica

> **Versão:** 1.0  
> **Última Atualização:** Dezembro 2024  
> **Componente:** Flow Generator Engine

---

## 📋 Índice

1. [Visão Geral](#1-visão-geral)
2. [Pipeline da Engine](#2-pipeline-da-engine)
3. [Funções Principais](#3-funções-principais)
4. [Conversão para ReactFlow](#4-conversão-para-reactflow)
5. [Tratamento de Erros](#5-tratamento-de-erros)

---

## 1. Visão Geral

A Engine de Geração de Grafo é um componente **100% determinístico** (sem IA) que transforma nós simbólicos em um grafo visual conectado.

### Características

- **Entrada:** `SymbolicNode[]` (nós do LLM)
- **Saída:** `EngineGraph` (nodes + edges posicionados)
- **Sem IA:** Todo o processamento é código
- **Determinístico:** Mesma entrada = mesma saída

---

## 2. Pipeline da Engine

```
symbolic_nodes
      │
      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          NORMALIZAÇÃO                                        │
│  normalizeNodes(nodes)                                                       │
│  ├── Garante que existe 1 trigger no início                                 │
│  ├── Garante que existe pelo menos 1 end success                            │
│  └── Filtra nós inválidos                                                    │
└─────────────────────────────────────────────────────────────────────────────┘
      │
      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          SEPARAÇÃO DE PATHS                                  │
│  separatePaths(nodes)                                                        │
│  ├── mainPath: flow_category = "main" ou undefined                          │
│  ├── errorPath: flow_category = "error"                                      │
│  └── altPath: flow_category = "alternative"                                  │
└─────────────────────────────────────────────────────────────────────────────┘
      │
      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          ORDENAÇÃO (BFS)                                     │
│  assignOrderIndex(nodes)                                                     │
│  ├── BFS a partir do trigger                                                 │
│  ├── Atribui order_index baseado na distância do trigger                    │
│  └── Nós não alcançáveis recebem order_index = 999                          │
└─────────────────────────────────────────────────────────────────────────────┘
      │
      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          POSICIONAMENTO                                      │
│  assignLayout(nodes, config)                                                 │
│  ├── position_x = startX + (order_index * nodeSpacingX)                     │
│  ├── position_y = startY (main) ou startY + errorPathYOffset (error)        │
│  └── Atribui column e depth                                                  │
└─────────────────────────────────────────────────────────────────────────────┘
      │
      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          CRIAÇÃO DE EDGES                                    │
│  buildEdgesAlways(nodes)                                                     │
│  ├── 1. Edges explícitas (next_on_success, next_on_failure)                 │
│  ├── 2. Edges sequenciais (main path por order_index)                        │
│  └── 3. Fallback: se nenhuma edge, conecta sequencialmente                  │
└─────────────────────────────────────────────────────────────────────────────┘
      │
      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          VALIDAÇÃO FINAL                                     │
│  validateGraph(nodes, edges)                                                 │
│  ├── Trigger único                                                           │
│  ├── End success existe                                                      │
│  ├── Conditions têm 2 caminhos                                               │
│  └── Todos os nós estão conectados                                           │
└─────────────────────────────────────────────────────────────────────────────┘
      │
      ▼
   EngineGraph
  (nodes, edges, layout_info)
```

---

## 3. Funções Principais

### 3.1 buildGraph

```typescript
function buildGraph(
  symbolicNodes: SubRuleNode[],
  layoutConfig: LayoutConfig
): { nodes: EngineNode[]; edges: EngineEdge[] }
```

**Lógica:**

1. Normalizar nós (garantir trigger e end)
2. Separar por categoria (main, error, alternative)
3. Atribuir order_index via BFS
4. Calcular posições X/Y
5. Criar edges

### 3.2 buildEdgesAlways

```typescript
function buildEdgesAlways(
  nodes: EngineNode[],
  symbolicNodes: SubRuleNode[]
): EngineEdge[]
```

**Lógica (em ordem de prioridade):**

1. **Edges explícitas:** Se `next_on_success` ou `next_on_failure` existem, criar edge
2. **Conditions:** Sempre criar edge para success E failure (se condition não tem failure explícito, conectar ao próximo error end)
3. **Edges sequenciais:** Para nós main_path sem edges, conectar ao próximo por order_index
4. **Fallback:** Se nenhuma edge criada, conectar todos sequencialmente

### 3.3 normalizeNodes

```typescript
function normalizeNodes(nodes: SubRuleNode[]): SubRuleNode[]
```

**Correções automáticas:**

- Se não há trigger: cria um no início
- Se não há end success: cria um no final
- Filtra nós com type undefined

### 3.4 Configuração de Layout

```typescript
const DEFAULT_LAYOUT_CONFIG: LayoutConfig = {
  nodeSpacingX: 280,         // Horizontal entre nós
  nodeSpacingY: 180,         // Vertical entre linhas
  startX: 100,               // X inicial
  startY: 300,               // Y caminho principal
  errorPathYOffset: 200,     // Y offset para erros
};
```

**Cálculo de posição:**

```typescript
position_x = startX + (order_index * nodeSpacingX);

// Para main path:
position_y = startY;

// Para error path:
position_y = startY + errorPathYOffset;

// Para alternative path:
position_y = startY - errorPathYOffset;
```

---

## 4. Conversão para ReactFlow

### 4.1 Função Principal

**Arquivo:** `lib/supabase/client.ts`

```typescript
function convertSavedFlowToReactFlow(savedFlow: SavedFlow): {
  nodes: Node[];
  edges: Edge[];
}
```

### 4.2 Mapeamento de Tipos

```typescript
const typeMapping: Record<string, string> = {
  trigger: "trigger",
  action: "action",
  condition: "condition",
  subflow: "subflow",
  field_group: "fieldGroup",
  end: "end",           // Crítico: mapear para "end" (não "action")
  note: "text",         // Crítico: mapear para "text" (não "postit")
  text: "text",
};
```

### 4.3 Estrutura do Nó ReactFlow

```typescript
interface ReactFlowNode {
  id: string;               // "node_1", "node_2", etc.
  type: string;             // "trigger", "action", "condition", etc.
  position: { x: number; y: number };
  data: {
    label: string;          // Título do nó
    description?: string;   // Descrição
    // Específicos por tipo:
    status?: "success" | "error";           // Para end
    expression?: string;                     // Para condition
    subflowId?: number;                      // Para subflow
    subtype?: string;                        // Para text (rule, note)
    content?: string;                        // Para text
    metadata?: object;                       // Metadados extras
  };
}
```

### 4.4 Estrutura da Edge ReactFlow

```typescript
interface ReactFlowEdge {
  id: string;               // "edge_node1_node2"
  source: string;           // ID do nó origem
  target: string;           // ID do nó destino
  sourceHandle?: string;    // "success" ou "failure" para conditions
  label?: string;           // "Sim", "Não", etc.
  labelStyle?: object;
  style?: {
    stroke: string;         // Cor da linha
    strokeWidth?: number;
    strokeDasharray?: string; // Para linhas tracejadas
  };
  markerEnd?: {
    type: string;           // "arrow"
    color: string;
  };
  animated?: boolean;
}
```

### 4.5 Cores das Edges

```typescript
const edgeColors: Record<string, string> = {
  "Sim": "#22c55e",         // Verde - caminho de sucesso
  "Não": "#ef4444",         // Vermelho - caminho de erro
  "Sucesso": "#22c55e",
  "Erro": "#ef4444",
  "default": "#6b7280",     // Cinza - padrão
};
```

### 4.6 Lógica de Handles

Para nós `condition`, a conexão usa handles específicos:

```typescript
if (sourceNode?.type === "condition") {
  const lowerLabel = label?.toLowerCase() || "";
  
  if (lowerLabel.includes("sim") || lowerLabel.includes("sucesso") || lowerLabel.includes("success")) {
    edge.sourceHandle = "success";
  } else if (lowerLabel.includes("não") || lowerLabel.includes("erro") || lowerLabel.includes("failure")) {
    edge.sourceHandle = "failure";
  }
}
```

---

## 5. Tratamento de Erros

### 5.1 Erros Comuns

| Erro | Causa | Solução |
|------|-------|---------|
| Grafo vazio | LLM retornou nodes vazios | normalizeNodes adiciona trigger + end |
| Nós sem edges | LLM não definiu next_* | buildEdgesAlways cria edges sequenciais |
| Referências numéricas | LLM usou "1" ao invés de "step_1" | normalizeNodeReferences no orquestrador |
| Ciclos | LLM criou referência circular | validateGraph detecta e retorna erro |

### 5.2 Validações no Flow Generator

```typescript
// Após salvar nós
if (createdNodes.length === 0 && nodes.length > 0) {
  return new Response(
    JSON.stringify({ success: false, error: "Nenhum nó foi salvo" }),
    { status: 500 }
  );
}

// Após salvar connections
if (edges.length > 0 && createdConnections.length === 0) {
  return new Response(
    JSON.stringify({ success: false, error: "Nenhuma conexão foi salva" }),
    { status: 500 }
  );
}
```

### 5.3 Fallback Global

```typescript
try {
  const result = await handleRequest(req);
  return result;
} catch (error) {
  console.error("[FLOW-GENERATOR] Erro global:", error);
  return new Response(
    JSON.stringify({
      success: false,
      error: error.message,
      stack: error.stack,
    }),
    { status: 500 }
  );
}
```

---

## 📊 Diagrama: Fluxo Completo de Dados

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         SYMBOLIC NODES (do LLM)                              │
│                                                                              │
│  [                                                                           │
│    { id: "start", type: "trigger", title: "Início", next_on_success: "a" }, │
│    { id: "a", type: "action", title: "Ação A", next_on_success: "check" },   │
│    { id: "check", type: "condition", title: "Válido?",                       │
│      next_on_success: "ok", next_on_failure: "err" },                        │
│    { id: "ok", type: "end", title: "Sucesso", end_status: "success" },       │
│    { id: "err", type: "end", title: "Erro", end_status: "error" },           │
│  ]                                                                           │
└─────────────────────────────────────────────────────────────────────────────┘
                                       │
                                       ▼
                              ┌─────────────────┐
                              │  buildGraph()   │
                              └────────┬────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         ENGINE NODES                                         │
│                                                                              │
│  [                                                                           │
│    { id: "node_1", symbolic_id: "start", type: "trigger",                   │
│      order_index: 0, position_x: 100, position_y: 300, column: "main" },    │
│    { id: "node_2", symbolic_id: "a", type: "action",                         │
│      order_index: 1, position_x: 380, position_y: 300, column: "main" },    │
│    { id: "node_3", symbolic_id: "check", type: "condition",                  │
│      order_index: 2, position_x: 660, position_y: 300, column: "main" },    │
│    { id: "node_4", symbolic_id: "ok", type: "end",                           │
│      order_index: 3, position_x: 940, position_y: 300, column: "main" },    │
│    { id: "node_5", symbolic_id: "err", type: "end",                          │
│      order_index: 3, position_x: 940, position_y: 500, column: "error" },   │
│  ]                                                                           │
└─────────────────────────────────────────────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         ENGINE EDGES                                         │
│                                                                              │
│  [                                                                           │
│    { id: "edge_1", source: "node_1", target: "node_2",                       │
│      type: "success", label: null },                                         │
│    { id: "edge_2", source: "node_2", target: "node_3",                       │
│      type: "success", label: null },                                         │
│    { id: "edge_3", source: "node_3", target: "node_4",                       │
│      type: "success", label: "Sim" },                                        │
│    { id: "edge_4", source: "node_3", target: "node_5",                       │
│      type: "failure", label: "Não" },                                        │
│  ]                                                                           │
└─────────────────────────────────────────────────────────────────────────────┘
                                       │
                                       ▼
                     ┌─────────────────────────────────┐
                     │   SALVAR NO SUPABASE            │
                     │   flows → nodes → connections   │
                     └─────────────────────────────────┘
                                       │
                                       ▼
                     ┌─────────────────────────────────┐
                     │ convertSavedFlowToReactFlow()   │
                     └────────────────┬────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         REACT FLOW NODES                                     │
│                                                                              │
│  [                                                                           │
│    { id: "node_1", type: "trigger",                                          │
│      position: { x: 100, y: 300 },                                           │
│      data: { label: "Início", description: "..." } },                        │
│    { id: "node_3", type: "condition",                                        │
│      position: { x: 660, y: 300 },                                           │
│      data: { label: "Válido?", expression: "..." } },                        │
│    ...                                                                       │
│  ]                                                                           │
└─────────────────────────────────────────────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         REACT FLOW EDGES                                     │
│                                                                              │
│  [                                                                           │
│    { id: "edge_node3_node4", source: "node_3", target: "node_4",             │
│      sourceHandle: "success", label: "Sim",                                  │
│      style: { stroke: "#22c55e" },                                           │
│      markerEnd: { type: "arrow", color: "#22c55e" } },                       │
│    { id: "edge_node3_node5", source: "node_3", target: "node_5",             │
│      sourceHandle: "failure", label: "Não",                                  │
│      style: { stroke: "#ef4444" },                                           │
│      markerEnd: { type: "arrow", color: "#ef4444" } },                       │
│    ...                                                                       │
│  ]                                                                           │
└─────────────────────────────────────────────────────────────────────────────┘
                                       │
                                       ▼
                         ┌───────────────────────┐
                         │    REACT FLOW UI      │
                         │    (Canvas Visual)    │
                         └───────────────────────┘
```

---

> **Nota:** Este documento complementa a documentação principal em `ARQUITETURA_AGENTES_USER_FLOW.md`







