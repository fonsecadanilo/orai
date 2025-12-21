# 📘 Documentação Técnica Completa - Oria Pipeline v3.1

## Construção Inteligente de User Flows

**Versão:** 3.1  
**Data:** Dezembro 2024  
**Equipe:** Oria Engineering

---

## 📑 Índice

1. [Visão Geral da Arquitetura](#1-visão-geral-da-arquitetura)
2. [Pipeline de 6 Agentes de IA](#2-pipeline-de-6-agentes-de-ia)
3. [Detalhamento de Cada Agente](#3-detalhamento-de-cada-agente)
4. [Schemas e Estruturas de Dados](#4-schemas-e-estruturas-de-dados)
5. [Engine Determinística](#5-engine-determinística)
6. [Banco de Dados (Supabase)](#6-banco-de-dados-supabase)
7. [Edge Functions](#7-edge-functions)
8. [Integração Frontend](#8-integração-frontend)
9. [Fluxo de Dados Completo](#9-fluxo-de-dados-completo)
10. [Tipos de Nós v3.1](#10-tipos-de-nós-v31)
11. [Validações e Score de Integridade](#11-validações-e-score-de-integridade)
12. [Troubleshooting e Debug](#12-troubleshooting-e-debug)

---

## 1. Visão Geral da Arquitetura

### 1.1 Princípios Fundamentais

A Oria utiliza uma arquitetura híbrida onde:

- **IA (LLM)** cuida da semântica, UX, regras de negócio e criatividade
- **Código Determinístico** cuida de estrutura, layout, validação e persistência

```
┌─────────────────────────────────────────────────────────────────┐
│                    ORIA v3.1 ARCHITECTURE                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐       │
│  │   Frontend   │───▶│   Supabase   │───▶│ Edge Functions│       │
│  │   (React)    │    │   Client     │    │   (Deno)     │       │
│  └──────────────┘    └──────────────┘    └──────────────┘       │
│         │                   │                   │                │
│         │                   ▼                   ▼                │
│         │            ┌──────────────┐    ┌──────────────┐       │
│         │            │   Database   │    │   OpenAI     │       │
│         │            │  PostgreSQL  │    │   GPT-4o     │       │
│         │            └──────────────┘    └──────────────┘       │
│         │                   │                                    │
│         ▼                   ▼                                    │
│  ┌──────────────────────────────────────────────────────┐       │
│  │              ENGINE (100% Código)                     │       │
│  │  buildGraph → assignOrderIndex → assignLayout         │       │
│  └──────────────────────────────────────────────────────┘       │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 1.2 Tecnologias Utilizadas

| Camada | Tecnologia | Propósito |
|--------|------------|-----------|
| Frontend | Next.js 14 + React | Interface de usuário |
| State Management | React Hooks | Gerenciamento de estado |
| Flow Editor | React Flow | Visualização de fluxos |
| Backend | Supabase Edge Functions | APIs serverless |
| Database | Supabase PostgreSQL | Persistência |
| IA | OpenAI GPT-4o-mini | Processamento semântico |
| Validação | Zod | Schema validation |
| Runtime | Deno (Edge Functions) | Execução serverless |

### 1.3 Diretórios Principais

```
oria-app/
├── lib/
│   ├── agents/           # Agentes de IA
│   │   ├── v3/          # Pipeline v3.1 (6 agentes)
│   │   ├── types.ts     # Tipos compartilhados
│   │   └── index.ts     # Exports centralizados
│   ├── engine/          # Engine determinística
│   │   ├── buildGraph.ts
│   │   ├── assignLayout.ts
│   │   └── validateGraph.ts
│   ├── schemas/         # Schemas Zod
│   ├── supabase/        # Cliente Supabase
│   └── validation/      # Validações adicionais
├── supabase/
│   └── functions/       # Edge Functions
├── hooks/
│   └── useFlowCreator.ts
└── components/
    └── flow/            # Componentes do editor
```

---

## 2. Pipeline de 6 Agentes de IA

### 2.1 Visão Geral do Pipeline

A pipeline v3.1 consiste em 6 agentes especializados executados em sequência:

```
┌─────────────────────────────────────────────────────────────────┐
│                    PIPELINE v3.1 - 6 AGENTES                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. PRODUCT & ROLE MAPPER                                        │
│     Input: Prompt do usuário                                     │
│     Output: Contexto do produto + Roles identificadas            │
│                         │                                        │
│                         ▼                                        │
│  2. FLOW SYNTHESIZER                                             │
│     Input: Contexto + Roles                                      │
│     Output: Fluxo sintetizado (steps, decisions, failures)       │
│                         │                                        │
│                         ▼                                        │
│  3. ARCHETYPE MODELER                                            │
│     Input: Fluxo sintetizado + Contexto                          │
│     Output: Arquétipos aplicados + Fluxo enriquecido             │
│                         │                                        │
│                         ▼                                        │
│  4. FLOW CRITIC                                                  │
│     Input: Fluxo enriquecido + Arquétipos                        │
│     Output: Validação + Score de Integridade + Auto-fixes        │
│                         │                                        │
│                         ▼                                        │
│  5. UX BLOCK COMPOSER                                            │
│     Input: Fluxo validado + Arquétipos                           │
│     Output: Blocos UX adaptados com inputs e ações               │
│                         │                                        │
│                         ▼                                        │
│  6. FLOW CONNECTOR                                               │
│     Input: Blocos UX + Fluxo                                     │
│     Output: Nós finais + Conexões + Layout + DB IDs              │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 Orquestrador

**Arquivo:** `lib/agents/v3/orchestrator-v3.ts`

O orquestrador coordena a execução sequencial dos 6 agentes:

```typescript
export async function executeV3Pipeline(
  request: V3PipelineRequest,
  onProgress?: ProgressCallback
): Promise<V3PipelineResponse> {
  // 1. Product & Role Mapper
  const productRoleResult = await mapProductAndRole({ ... });
  
  // 2. Flow Synthesizer
  const flowSynthesizerResult = await synthesizeFlow({ ... });
  
  // 3. Archetype Modeler
  const archetypeModelResult = await modelArchetype({ ... });
  
  // 4. Flow Critic (+ Auto-fixes)
  let flowCriticResult = await criticizeFlow({ ... });
  
  // 5. UX Block Composer
  const uxComposerResult = await composeUXBlocksV3({ ... });
  
  // 6. Flow Connector (salva no banco)
  const flowConnectorResult = await connectFlow({ ... });
  
  return { success: true, ... };
}
```

---

## 3. Detalhamento de Cada Agente

### 3.1 Agent 1: Product & Role Mapper

**Arquivos:**
- Cliente: `lib/agents/v3/product-role-mapper.ts`
- Edge Function: `supabase/functions/v3-product-role-mapper/index.ts`

**Responsabilidades:**
- Analisar o prompt do usuário
- Detectar tipo de produto (SaaS, Fintech, E-commerce, etc.)
- Identificar roles/papéis de usuário
- Determinar o papel principal para o fluxo

**Input:**
```typescript
interface ProductRoleMapperRequest {
  prompt: string;              // "Criar fluxo de login para SaaS"
  project_id: number;
  user_id: number;
  existing_context?: Partial<ProductContext>;
}
```

**Output:**
```typescript
interface ProductRoleMapperResponse {
  success: boolean;
  product_context: {
    product_name: string;
    product_type: "saas" | "fintech" | "ecommerce" | ...;
    business_model: "b2b" | "b2c" | ...;
    main_value_proposition: string;
    key_features: string[];
  };
  roles: RoleDefinition[];
  primary_role: string;
  analysis: {
    detected_product_type: string;
    detected_roles_count: number;
    confidence_score: number;
    suggestions: string[];
  };
}
```

**Tipos de Produto Reconhecidos:**
- `saas` - Software as a Service
- `fintech` - Serviços financeiros
- `ecommerce` - E-commerce/Lojas
- `healthtech` - Saúde
- `edtech` - Educação
- `marketplace` - Plataformas dois lados
- `analytics` - BI/Dashboards
- `other` - Outros

**Roles Comuns:**
| Role | Descrição | Permissões |
|------|-----------|------------|
| `owner` | Proprietário da conta | Todas |
| `admin` | Administrador | manage_users, manage_settings |
| `manager` | Gerente de equipe | manage_team, view_reports |
| `member` | Membro regular | view_own, edit_own |
| `viewer` | Apenas visualização | view_only |
| `guest` | Convidado | limited_access |

---

### 3.2 Agent 2: Flow Synthesizer

**Arquivos:**
- Cliente: `lib/agents/v3/flow-synthesizer.ts`
- Edge Function: `supabase/functions/v3-flow-synthesizer/index.ts`

**Responsabilidades:**
- Sintetizar fluxo semântico com steps, decisions, failures
- Detectar padrões reutilizáveis
- Calcular complexidade do fluxo
- Gerar estrutura inicial de nós

**Input:**
```typescript
interface FlowSynthesizerRequest {
  product_context: ProductContext;
  roles: RoleDefinition[];
  primary_role: string;
  user_prompt: string;
  project_id: number;
  user_id: number;
}
```

**Output:**
```typescript
interface FlowSynthesizerResponse {
  success: boolean;
  synthesized_flow: {
    flow_id: string;
    flow_name: string;
    flow_description: string;
    flow_category: "authentication" | "onboarding" | "checkout" | ...;
    steps: FlowStep[];
    decisions: FlowDecision[];
    failure_points: FlowFailurePoint[];
  };
  detected_patterns: string[];
  analysis: {
    total_steps: number;
    decision_points: number;
    failure_points: number;
    complexity_score: number; // 1-10
  };
}
```

**Tipos de Steps (step_type):**
| Tipo | Descrição | Uso |
|------|-----------|-----|
| `entry_point` | Ponto de entrada | Primeiro nó do fluxo |
| `form_input` | Entrada de formulário | Login, cadastro, checkout |
| `decision_point` | Ponto de decisão | Escolhas do usuário |
| `user_action` | Ação simples | Cliques, toggles |
| `system_action` | Ação do sistema | Processamento |
| `validation` | Validação | Verificação de dados |
| `api_call` | Chamada de API | Integrações externas |
| `notification` | Notificação | Toasts, alertas |
| `success_state` | Sucesso | Conclusão bem-sucedida |
| `error_state` | Erro | Estado de erro |
| `exit_point` | Ponto de saída | Término do fluxo |

---

### 3.3 Agent 3: Archetype Modeler

**Arquivos:**
- Cliente: `lib/agents/v3/archetype-modeler.ts`
- Edge Function: `supabase/functions/v3-archetype-modeler/index.ts`

**Responsabilidades:**
- Aplicar arquétipos de UX, Segurança e Compliance
- Enriquecer steps com metadados
- Mapear padrões para cada passo

**Arquétipos Built-in:**

```typescript
const BUILTIN_ARCHETYPES = [
  {
    archetype_id: "ux_form_validation",
    archetype_name: "Validação em Tempo Real",
    archetype_category: "ux_pattern",
    applicable_contexts: ["form", "authentication", "checkout"],
    implementation_hints: ["Usar debounce de 300ms", "Feedback visual imediato"]
  },
  {
    archetype_id: "sec_rate_limiting",
    archetype_name: "Rate Limiting",
    archetype_category: "security",
    applicable_contexts: ["authentication", "api_call"],
    implementation_hints: ["Lockout após N tentativas", "Contador de tentativas"]
  },
  {
    archetype_id: "comp_lgpd_consent",
    archetype_name: "Consentimento LGPD",
    archetype_category: "compliance",
    applicable_contexts: ["form", "authentication"],
    implementation_hints: ["Checkbox não pré-marcado", "Link para política"]
  },
  // ... mais arquétipos
];
```

**Categorias de Arquétipos:**
- `ux_pattern` - Padrões de UX
- `security` - Segurança
- `compliance` - Conformidade legal
- `performance` - Performance

---

### 3.4 Agent 4: Flow Critic

**Arquivos:**
- Cliente: `lib/agents/v3/flow-critic.ts`
- Edge Function: `supabase/functions/v3-flow-critic/index.ts`

**Responsabilidades:**
- Validar completude e consistência do fluxo
- Calcular Score de Integridade (0-100)
- Identificar problemas por severidade
- Aplicar auto-fixes quando possível

**Input:**
```typescript
interface FlowCriticRequest {
  synthesized_flow: SynthesizedFlow;
  archetype_mappings: NodeArchetypeMapping[];
  product_context: ProductContext;
  roles: RoleDefinition[];
  validation_level?: "basic" | "standard" | "strict";
}
```

**Output:**
```typescript
interface FlowCriticResponse {
  success: boolean;
  is_valid: boolean;
  integrity_score: number; // 0-100
  findings: CritiqueFinding[];
  auto_fixes_applied: { finding_id: string; fix_description: string }[];
  summary: {
    critical_count: number;
    major_count: number;
    minor_count: number;
    suggestion_count: number;
    auto_fixed_count: number;
  };
}
```

**Severidades de Finding:**
| Severidade | Descrição | Impacto no Score |
|------------|-----------|------------------|
| `critical` | Erro crítico | -25 pontos |
| `major` | Problema maior | -10 pontos |
| `minor` | Problema menor | -3 pontos |
| `suggestion` | Sugestão | 0 pontos |

**Categorias de Finding:**
- `completeness` - Fluxo incompleto
- `consistency` - Inconsistências
- `ux` - Problemas de UX
- `security` - Problemas de segurança
- `performance` - Performance
- `accessibility` - Acessibilidade

---

### 3.5 Agent 5: UX Block Composer

**Arquivos:**
- Cliente: `lib/agents/v3/ux-block-composer-v3.ts`
- Edge Function: `supabase/functions/v3-ux-block-composer-v3/index.ts`

**Responsabilidades:**
- Consultar biblioteca ux_blocks
- ADAPTAR blocos (nunca copiar literalmente)
- Gerar inputs e ações para cada bloco
- Criar subnós hierárquicos

**REGRA FUNDAMENTAL:** O agente NUNCA copia blocos da biblioteca. Sempre adapta conforme:
- Persona
- page_key
- Intent
- Stage
- Inputs

**Mapeamento de step_type → V3 node_type:**
```typescript
const STEP_TYPE_TO_V3_NODE_TYPE = {
  "entry_point": "trigger",
  "exit_point": "end_neutral",
  "success_state": "end_success",
  "error_state": "end_error",
  "form_input": "form",
  "decision_point": "choice",
  "user_action": "action",
  "api_call": "background_action",
  "validation": "condition",
  "notification": "feedback_success",
};
```

**Output:**
```typescript
interface UXBlockComposerV3Response {
  success: boolean;
  composed_blocks: AdaptedUXBlockV3[];
  blocks_from_library: number;
  blocks_generated: number;
  adaptation_notes: { step_id: string; note: string }[];
}

interface AdaptedUXBlockV3 {
  block_id: string;
  original_block_id?: string;
  adapted: boolean;
  block_type: NodeTypeV3;
  title: string;
  input_fields: UXBlockInput[];
  actions: { action_id: string; label: string; action_type: string }[];
  feedback_messages?: { trigger: string; message: string }[];
  impact_level: "low" | "medium" | "high";
}
```

---

### 3.6 Agent 6: Flow Connector

**Arquivos:**
- Cliente: `lib/agents/v3/flow-connector.ts`
- Edge Function: `supabase/functions/v3-flow-connector/index.ts`

**Responsabilidades:**
- Criar conexões (edges) entre nós
- Calcular layout HORIZONTAL (esquerda → direita)
- Rastrear reuso entre fluxos
- Salvar fluxo final no banco de dados

**Cálculo de Layout:**
```typescript
function calculateHorizontalLayout(nodes, connections) {
  const SPACING_X = 400; // Espaçamento horizontal
  const SPACING_Y = 200; // Espaçamento vertical
  const START_X = 100;
  const CENTER_Y = 300;
  
  // BFS para posicionamento
  // - Main path: y = CENTER_Y
  // - Error path: y = CENTER_Y + offset (abaixo)
  // - Alternative: y = CENTER_Y - offset (acima)
}
```

**Output:**
```typescript
interface FlowConnectorResponse {
  success: boolean;
  flow_id: number;
  final_nodes: V3FlowNode[];
  connections: NodeConnection[];
  reuse_report: {
    total_nodes: number;
    reused_nodes: number;
    details: ReusabilityInfo[];
  };
}
```

**Tipos de Conexão:**
| Tipo | Descrição | Estilo Visual |
|------|-----------|---------------|
| `success` | Caminho de sucesso | Verde |
| `failure` | Caminho de falha | Vermelho |
| `fallback` | Fallback | Laranja |
| `retry` | Retry | Amarelo |
| `conditional` | Condicional | Azul |
| `default` | Padrão | Cinza |

---

## 4. Schemas e Estruturas de Dados

### 4.1 Localização dos Schemas

**Diretório:** `lib/schemas/`

| Arquivo | Propósito |
|---------|-----------|
| `masterRuleSchema.ts` | Schema da Master Rule |
| `journeySchema.ts` | Schema da Jornada do Usuário |
| `subrulesSchema.ts` | Schema dos Nós Ricos (RichNodes) |
| `nodeTypesV3.ts` | Tipos de Nós v3.1 |
| `engineGraphSchema.ts` | Schema do Grafo da Engine |

### 4.2 Master Rule Schema

```typescript
const MasterRuleSchema = z.object({
  business_goal: z.string().min(10),
  context: z.string().min(10),
  actors: z.array(z.string()).min(1),
  assumptions: z.array(z.string()),
  main_flow: z.array(z.string()).min(3),
  alternative_flows: z.array(z.string()),
  error_flows: z.array(z.string()),
  pages_involved: z.array(PageDefinitionSchema).optional(),
});
```

### 4.3 RichNode Schema (Nós Ricos)

```typescript
const RichNodeSchema = z.object({
  // Campos base
  id: z.string().regex(/^[a-z0-9_]+$/),
  type: z.enum(["trigger", "action", "condition", "end", "subflow"]),
  title: z.string().min(3),
  description: z.string(),
  
  // Conexões
  next_on_success: z.string().nullable().optional(),
  next_on_failure: z.string().nullable().optional(),
  
  // Categorização
  flow_category: z.enum(["main", "error", "alternative"]),
  end_status: z.enum(["success", "error", "cancel"]).optional(),
  
  // Campos v3.0 (novos)
  page_key: z.string().optional(),
  user_intent: z.string().optional(),
  system_behavior: z.string().optional(),
  ux_recommendation: z.string().optional(),
  inputs: z.array(FormInputSchema).optional(),
  error_cases: z.array(z.string()).optional(),
  allows_retry: z.boolean().optional(),
  allows_cancel: z.boolean().optional(),
});
```

### 4.4 Tipos de Nós v3.1

```typescript
const MainNodeTypeSchema = z.enum([
  // Interação com Usuário
  "form",                  // Formulário
  "choice",                // Escolha entre opções
  "action",                // Ação do sistema
  
  // Feedback
  "feedback_success",      // Feedback positivo
  "feedback_error",        // Feedback de erro
  
  // Condições
  "condition",             // Condição/decisão
  
  // Término
  "end_success",           // Término bem-sucedido
  "end_error",             // Término com erro
  "end_neutral",           // Término neutro
  
  // Recuperação
  "retry",                 // Tentar novamente
  "fallback",              // Caminho alternativo
  "loopback",              // Retorno a passo anterior
  
  // Ações Especiais
  "background_action",     // Ação em segundo plano
  "delayed_action",        // Ação com delay
  "configuration_matrix",  // Matriz de configuração
  "insight_branch",        // Ramificação baseada em dados
  
  // Legacy
  "trigger",               // Gatilho inicial
  "end",                   // Término genérico
  "subflow",               // Referência a outro fluxo
]);
```

---

## 5. Engine Determinística

### 5.1 Visão Geral

A Engine é 100% código determinístico (sem IA). Transforma nós simbólicos em um grafo visual.

**Diretório:** `lib/engine/`

### 5.2 Pipeline da Engine

```
SubRules → buildGraph → assignOrderIndex → assignLayout → validateGraph → EngineGraph
```

### 5.3 buildGraph

**Arquivo:** `lib/engine/buildGraph.ts`

```typescript
function buildGraph(subrules: SubRuleNode[], config: Partial<LayoutConfig>) {
  // 1. Encontrar trigger (ponto de entrada)
  const trigger = subrules.find(s => s.type === "trigger");
  
  // 2. BFS para determinar ordem e profundidade
  const bfsResult = performBFS(trigger.id, subruleMap);
  
  // 3. Classificar nós por tipo de caminho (main, error, alternative)
  const classifiedNodes = classifyNodes(subrules, bfsResult);
  
  // 4. Criar nós da engine
  const engineNodes = subrules.map(subrule => ({
    id: `node_${orderIndex}`,
    symbolic_id: subrule.id,
    type: subrule.type,
    title: subrule.title,
    column: classifiedNodes.get(subrule.id)?.column || "main",
    // ...
  }));
  
  // 5. Criar edges
  const edges = buildEdges(subrules, nodeIdMap);
  
  return { nodes: engineNodes, edges, nodeIdMap };
}
```

### 5.4 assignLayout

**Arquivo:** `lib/engine/assignLayout.ts`

```typescript
function assignLayout(nodes, edges, config) {
  // Layout HORIZONTAL (esquerda → direita)
  // 
  // Convenções de posição:
  // - X: startX + (depth * nodeSpacingX)
  // - Y baseado em flow_category:
  //   - main: startY (linha central)
  //   - error: startY + errorPathYOffset (abaixo)
  //   - alternative: startY + alternativePathYOffset (acima)
  
  const depths = calculateDepths(nodes, edges);
  const yPositions = calculateYPositions(nodes, edges, config);
  
  return positionedNodes;
}
```

### 5.5 validateGraph

**Arquivo:** `lib/engine/validateGraph.ts`

Validações realizadas:
1. Exatamente 1 trigger
2. Pelo menos 1 end com status success
3. Todas as referências de IDs são válidas
4. Conditions têm 2 caminhos (success + failure)
5. End nodes não têm conexões de saída
6. Nós não-end têm pelo menos uma saída
7. Não há referências numéricas (apenas IDs simbólicos)
8. Não há ciclos (DFS)

---

## 6. Banco de Dados (Supabase)

### 6.1 Estrutura das Tabelas

```sql
-- Tabela de Projetos
CREATE TABLE projects (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Tabela de Fluxos
CREATE TABLE flows (
  id SERIAL PRIMARY KEY,
  project_id INTEGER REFERENCES projects(id),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  status VARCHAR(50) DEFAULT 'draft',
  master_rule_id INTEGER,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Tabela de Nós
CREATE TABLE nodes (
  id SERIAL PRIMARY KEY,
  flow_id INTEGER REFERENCES flows(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL, -- trigger, action, condition, end, etc.
  title VARCHAR(255),
  description TEXT,
  position_x INTEGER DEFAULT 0,
  position_y INTEGER DEFAULT 0,
  subflow_id INTEGER REFERENCES flows(id),
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Tabela de Conexões
CREATE TABLE connections (
  id SERIAL PRIMARY KEY,
  flow_id INTEGER REFERENCES flows(id) ON DELETE CASCADE,
  source_node_id INTEGER REFERENCES nodes(id) ON DELETE CASCADE,
  target_node_id INTEGER REFERENCES nodes(id) ON DELETE CASCADE,
  label VARCHAR(255),
  connection_type VARCHAR(50),
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Tabela de Regras
CREATE TABLE rules (
  id SERIAL PRIMARY KEY,
  project_id INTEGER REFERENCES projects(id),
  flow_id INTEGER REFERENCES flows(id),
  rule_type VARCHAR(50) NOT NULL, -- global, flow_master, node_rule
  parent_rule_id INTEGER REFERENCES rules(id),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  content TEXT,
  category VARCHAR(100),
  priority VARCHAR(50),
  status VARCHAR(50) DEFAULT 'active',
  order_index INTEGER,
  suggested_node_type VARCHAR(50),
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### 6.2 Metadata JSONB em Nodes

```typescript
// Estrutura do metadata em nodes
interface NodeMetadata {
  // CRÍTICO: Tipo V3 original
  v3_type: string; // "form", "choice", "action", etc.
  
  // Layout
  column: "main" | "error" | "alternative";
  impact_level: "low" | "medium" | "high";
  
  // Conexões simbólicas
  next_on_success: string;
  next_on_failure: string;
  
  // UX
  inputs: FormInput[];
  actions: NodeAction[];
  children: SubNode[];
  
  // Reuso
  reused: boolean;
  source_flow_id: number;
}
```

### 6.3 Cliente Supabase

**Arquivo:** `lib/supabase/client.ts`

```typescript
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// URL base para Edge Functions
export const SUPABASE_FUNCTIONS_URL = `${supabaseUrl}/functions/v1`;
```

### 6.4 Funções de Acesso a Dados

**Arquivo:** `lib/supabase/flows.ts`

```typescript
// Buscar todos os fluxos de um projeto
async function getFlows(projectId: number): Promise<FlowListItem[]>

// Buscar fluxo específico com nós e conexões
async function getFlowById(flowId: number): Promise<SavedFlow | null>

// Criar novo fluxo
async function createFlow(flow: Omit<SavedFlow, 'id' | 'created_at' | 'updated_at' | 'nodes' | 'connections'>): Promise<SavedFlow | null>

// Converter fluxo salvo para formato ReactFlow
function convertSavedFlowToReactFlow(savedFlow: SavedFlow)
```

---

## 7. Edge Functions

### 7.1 Listagem de Edge Functions

```
supabase/functions/
├── v3-product-role-mapper/     # Agente 1: Mapeamento de produto e roles
├── v3-flow-synthesizer/        # Agente 2: Síntese de fluxo
├── v3-archetype-modeler/       # Agente 3: Modelagem de arquétipos
├── v3-flow-critic/             # Agente 4: Crítica e validação
├── v3-ux-block-composer-v3/    # Agente 5: Composição de blocos UX
├── v3-flow-connector/          # Agente 6: Conexão e persistência
└── (legacy functions...)
```

### 7.2 Estrutura de uma Edge Function

```typescript
// supabase/functions/v3-{agent-name}/index.ts

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import OpenAI from "https://deno.land/x/openai@v4.68.1/mod.ts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Schema de entrada (Zod)
const RequestSchema = z.object({ ... });

// Schema de saída do LLM (Zod)
const LLMResponseSchema = z.object({ ... });

// System prompt para o LLM
const SYSTEM_PROMPT = `...`;

Deno.serve(async (req: Request) => {
  // 1. Validar CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // 2. Parsear e validar entrada
    const body = await req.json();
    const request = RequestSchema.parse(body);

    // 3. Inicializar clientes
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    const openai = new OpenAI({ apiKey: Deno.env.get("OPENAI_API_KEY")! });

    // 4. Chamar LLM
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userMessage },
      ],
      temperature: 0.3,
      max_tokens: 4000,
      response_format: { type: "json_object" },
    });

    // 5. Validar resposta do LLM com Zod
    const validationResult = LLMResponseSchema.safeParse(parsedResponse);

    // 6. Retornar resultado
    return new Response(
      JSON.stringify({ success: true, ... }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, message: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
```

### 7.3 Variáveis de Ambiente Necessárias

```env
# Supabase
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=xxx
SUPABASE_ANON_KEY=xxx

# OpenAI
OPENAI_API_KEY=sk-xxx
```

---

## 8. Integração Frontend

### 8.1 Hook useFlowCreator

**Arquivo:** `hooks/useFlowCreator.ts`

```typescript
interface UseFlowCreatorOptions {
  projectId: number;
  userId: number;
  onV3FlowCreated?: (response: V3PipelineResponse) => void;
  onSuccess?: (response: V3PipelineResponse) => void;
  onError?: (error: AgentError) => void;
  onProgressChange?: (progress: CreationProgress) => void;
}

interface UseFlowCreatorReturn {
  // Função principal
  createCompleteFlow: (prompt: string) => Promise<V3PipelineResponse | null>;
  
  // Estado
  isLoading: boolean;
  progress: CreationProgress;
  error: AgentError | null;
  
  // Resposta v3.1
  v3Response: V3PipelineResponse | null;
  
  // Fluxo gerado para ReactFlow
  generatedFlow: GeneratedFlow | null;
  
  // IDs
  flowMasterRuleId: number | null;
  subRuleIds: number[];
  flowId: number | null;
  
  // Reset
  reset: () => void;
}

export function useFlowCreator(options): UseFlowCreatorReturn {
  // Implementação...
}
```

### 8.2 Uso do Hook

```tsx
function FlowEditor() {
  const {
    createCompleteFlow,
    isLoading,
    progress,
    generatedFlow,
    flowId,
    error
  } = useFlowCreator({
    projectId: 1,
    userId: 1,
    onSuccess: (response) => {
      console.log("Flow created!", response.flow_id);
    },
    onProgressChange: (progress) => {
      console.log(`${progress.percentage}%: ${progress.message}`);
    }
  });

  const handleCreate = async () => {
    const result = await createCompleteFlow("Criar fluxo de login para SaaS");
    if (result) {
      // Sucesso! generatedFlow contém os nós e conexões
    }
  };

  return (
    <div>
      <button onClick={handleCreate} disabled={isLoading}>
        {isLoading ? `${progress.percentage}%` : "Criar Fluxo"}
      </button>
      {generatedFlow && (
        <ReactFlow
          nodes={generatedFlow.nodes}
          edges={generatedFlow.connections}
        />
      )}
    </div>
  );
}
```

### 8.3 Estados de Progresso

```typescript
type CreationStep = 
  | "idle"              // Inicial
  | "analyzing"         // Analisando prompt
  | "creating_master"   // Agentes 1-2
  | "master_review"     // Revisão opcional
  | "decomposing"       // Agentes 3-4
  | "decompose_review"  // Revisão opcional
  | "creating_flow"     // Agentes 5-6
  | "linking"           // Vinculando nós
  | "completed"         // Sucesso
  | "error";            // Erro

interface CreationProgress {
  step: CreationStep;
  message: string;
  percentage?: number;
  details?: {
    master_rule_created?: boolean;
    master_rule_id?: number;
    sub_rules_count?: number;
    nodes_created?: number;
    connections_created?: number;
    integrity_score?: number;
  };
}
```

---

## 9. Fluxo de Dados Completo

### 9.1 Diagrama de Sequência

```
┌─────────┐     ┌──────────┐     ┌─────────────────┐     ┌─────────┐
│ Frontend│     │ Supabase │     │ Edge Functions  │     │ OpenAI  │
└────┬────┘     └────┬─────┘     └────────┬────────┘     └────┬────┘
     │               │                    │                    │
     │ createCompleteFlow("prompt")       │                    │
     │──────────────▶│                    │                    │
     │               │ invoke(v3-product-role-mapper)          │
     │               │───────────────────▶│                    │
     │               │                    │ chat.completions   │
     │               │                    │───────────────────▶│
     │               │                    │◀───────────────────│
     │               │◀───────────────────│                    │
     │               │                    │                    │
     │               │ invoke(v3-flow-synthesizer)             │
     │               │───────────────────▶│                    │
     │               │                    │ chat.completions   │
     │               │                    │───────────────────▶│
     │               │                    │◀───────────────────│
     │               │◀───────────────────│                    │
     │               │                    │                    │
     │               │ ... (repete para cada agente)           │
     │               │                    │                    │
     │               │ invoke(v3-flow-connector)               │
     │               │───────────────────▶│                    │
     │               │                    │ INSERT flows       │
     │               │                    │ INSERT nodes       │
     │               │                    │ INSERT connections │
     │               │◀───────────────────│                    │
     │◀──────────────│                    │                    │
     │               │                    │                    │
     │ { flow_id, nodes, connections }    │                    │
     │               │                    │                    │
```

### 9.2 Transformação de Dados

```
Prompt do Usuário
       │
       ▼
┌──────────────────────────────┐
│ Agent 1: ProductRoleMapper   │
│ Output: ProductContext +     │
│         RoleDefinition[]     │
└──────────────────────────────┘
       │
       ▼
┌──────────────────────────────┐
│ Agent 2: FlowSynthesizer     │
│ Output: SynthesizedFlow      │
│   - steps[]                  │
│   - decisions[]              │
│   - failure_points[]         │
└──────────────────────────────┘
       │
       ▼
┌──────────────────────────────┐
│ Agent 3: ArchetypeModeler    │
│ Output: EnrichedFlow +       │
│         ArchetypeMappings[]  │
└──────────────────────────────┘
       │
       ▼
┌──────────────────────────────┐
│ Agent 4: FlowCritic          │
│ Output: ValidatedFlow +      │
│         IntegrityScore       │
└──────────────────────────────┘
       │
       ▼
┌──────────────────────────────┐
│ Agent 5: UXBlockComposer     │
│ Output: AdaptedUXBlock[]     │
│   - input_fields[]           │
│   - actions[]                │
└──────────────────────────────┘
       │
       ▼
┌──────────────────────────────┐
│ Agent 6: FlowConnector       │
│ Output:                      │
│   - V3FlowNode[] (com IDs)   │
│   - NodeConnection[]         │
│   - layout (x, y positions)  │
│   - DB flow_id               │
└──────────────────────────────┘
       │
       ▼
┌──────────────────────────────┐
│ ReactFlow                    │
│ Visualização do fluxo        │
└──────────────────────────────┘
```

---

## 10. Tipos de Nós v3.1

### 10.1 Configurações Visuais

```typescript
const NODE_VISUAL_CONFIGS = {
  form: {
    icon: "FileInput",
    color: "#3b82f6",
    bgColor: "#eff6ff",
    label: "Form",
    description: "Collects user data through input fields",
    supportsInputs: true,
    supportsOutputs: 1,
  },
  choice: {
    icon: "ListChecks",
    color: "#8b5cf6",
    bgColor: "#f5f3ff",
    label: "Choice",
    description: "Presents options for user selection",
    supportsOutputs: -1, // Múltiplas saídas
  },
  condition: {
    icon: "GitBranch",
    color: "#6366f1",
    bgColor: "#eef2ff",
    label: "Condition",
    description: "Branching based on a condition",
    supportsOutputs: 2, // Yes/No
  },
  end_success: {
    icon: "CheckCircle2",
    color: "#22c55e",
    bgColor: "#dcfce7",
    label: "End (Success)",
    supportsOutputs: 0, // Terminal
  },
  end_error: {
    icon: "XOctagon",
    color: "#ef4444",
    bgColor: "#fee2e2",
    label: "End (Error)",
    supportsOutputs: 0, // Terminal
  },
  trigger: {
    icon: "Play",
    color: "#10b981",
    bgColor: "#d1fae5",
    label: "Trigger",
    description: "Flow entry point",
    supportsOutputs: 1,
  },
  // ... mais tipos
};
```

### 10.2 Mapeamento para Banco de Dados

```typescript
function convertV3ToDBType(v3Type: MainNodeType): string {
  const mapping = {
    form: "action",
    choice: "condition",
    action: "action",
    feedback_success: "action",
    feedback_error: "action",
    condition: "condition",
    end_success: "end",
    end_error: "end",
    end_neutral: "end",
    trigger: "trigger",
    subflow: "subflow",
    // ...
  };
  return mapping[v3Type] || "action";
}
```

**IMPORTANTE:** O tipo v3 original é sempre preservado em `metadata.v3_type` para recuperação correta ao carregar o fluxo.

---

## 11. Validações e Score de Integridade

### 11.1 Validação de Grafo

```typescript
function validateSubrulesGraph(nodes: SubRuleNode[]): GraphValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // 1. Exatamente 1 trigger
  const triggers = nodes.filter(n => n.type === "trigger");
  if (triggers.length !== 1) {
    errors.push("GRAPH_INVALID_TRIGGER_COUNT");
  }

  // 2. Pelo menos 1 end com success
  const successEnds = nodes.filter(n => n.type === "end" && n.end_status === "success");
  if (successEnds.length === 0) {
    errors.push("GRAPH_NO_SUCCESS_END");
  }

  // 3. Referências válidas
  const nodeIds = new Set(nodes.map(n => n.id));
  for (const node of nodes) {
    if (node.next_on_success && !nodeIds.has(node.next_on_success)) {
      errors.push(`GRAPH_INVALID_REF: ${node.id} → ${node.next_on_success}`);
    }
  }

  // 4. Conditions têm 2 caminhos
  const conditions = nodes.filter(n => n.type === "condition");
  for (const c of conditions) {
    if (!c.next_on_success || !c.next_on_failure) {
      errors.push(`GRAPH_CONDITION_INCOMPLETE: ${c.id}`);
    }
  }

  // 5. Detecção de ciclos (DFS)
  const cycleErrors = detectCycles(nodes);
  errors.push(...cycleErrors);

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}
```

### 11.2 Validação SaaS

```typescript
function validateSaaSFlow(nodes: RichNode[]): SaaSValidationResult {
  // Detectar tipo de fluxo
  const isAuthFlow = nodes.some(n => 
    n.page_key?.includes("login") || n.page_key?.includes("signup")
  );

  // Validações específicas
  if (isAuthFlow) {
    // Login deve ter tratamento de erro
    // Deve ter recuperação de senha
    // Deve ter destino pós-sucesso
  }

  if (hasSignup) {
    // Signup deve ter inputs: email, password
    // Deve ir para onboarding ou dashboard
  }

  // Calcular score
  let score = 100;
  score -= errors.filter(e => e.severity === "critical").length * 20;
  score -= errors.filter(e => e.severity === "error").length * 10;
  score -= warnings.length * 5;

  return { isValid, errors, warnings, score, suggestions };
}
```

### 11.3 Cálculo do Score de Integridade

| Fator | Impacto |
|-------|---------|
| Erro crítico | -20 a -25 pontos |
| Erro maior | -10 pontos |
| Warning | -5 pontos |
| Erro menor | -3 pontos |
| Boas práticas (bonus) | +5 pontos |

**Score Final:** max(0, min(100, score))

---

## 12. Troubleshooting e Debug

### 12.1 Logs de Debug

Cada agente possui logs detalhados:

```typescript
// No cliente
console.log("[Agent 1: Product & Role Mapper] Iniciando mapeamento...");
console.log("[Pipeline v3.1] Agent 2: Flow Synthesizer - completed");

// Na Edge Function
console.log("[v3-flow-synthesizer] Sintetizando fluxo...");
console.log("[v3-flow-connector] Processing", nodes.length, "nodes...");
```

### 12.2 Erros Comuns

| Erro | Causa | Solução |
|------|-------|---------|
| `GRAPH_NO_TRIGGER` | Fluxo sem ponto de entrada | Verificar se LLM gerou trigger |
| `GRAPH_NO_SUCCESS_END` | Fluxo sem término de sucesso | Verificar se há end com status success |
| `GRAPH_INVALID_REF` | Referência a nó inexistente | Verificar IDs simbólicos |
| `GRAPH_CYCLE` | Ciclo detectado no grafo | Verificar conexões |
| `EDGE_FUNCTION_ERROR` | Erro na Edge Function | Verificar logs do Supabase |
| `EMPTY_RESPONSE` | LLM não retornou dados | Verificar prompt e tokens |

### 12.3 Validação de Resposta do LLM

```typescript
// Todas as Edge Functions validam a resposta do LLM com Zod
const validationResult = LLMResponseSchema.safeParse(parsedResponse);

if (!validationResult.success) {
  // Log dos erros de validação
  console.warn("Validação falhou:", validationResult.error.errors);
  
  // Tentar extrair dados parciais
  const partialData = parsedResponse as any;
  // ...
}
```

### 12.4 Verificação de Tipos v3

Para garantir que os tipos v3 estão sendo preservados:

```typescript
// No Flow Connector (Edge Function)
const nodesToInsert = finalNodes.map(node => ({
  type: mapToDbType(node.type), // Tipo para enum do banco
  metadata: {
    v3_type: node.type, // CRÍTICO: Preservar tipo v3 original
    // ...
  },
}));

// Ao carregar do banco
const originalType = metadata.v3_type || node.type;
const reactFlowType = V3_NODE_TYPES.has(originalType) ? originalType : "action";
```

---

## Apêndice A: Glossário

| Termo | Definição |
|-------|-----------|
| **Pipeline** | Sequência de agentes que processam o prompt |
| **Agente** | Módulo de IA especializado em uma tarefa |
| **Engine** | Código determinístico que processa estruturas |
| **RichNode** | Nó com metadados completos de UX |
| **Flow Category** | Classificação do caminho (main/error/alternative) |
| **Integrity Score** | Pontuação de 0-100 da qualidade do fluxo |
| **Archetype** | Padrão de UX/Segurança/Compliance aplicável |
| **Edge Function** | Função serverless no Supabase |

---

## Apêndice B: Referências de Arquivos

| Arquivo | Propósito |
|---------|-----------|
| `lib/agents/v3/index.ts` | Exports dos agentes v3.1 |
| `lib/agents/v3/types.ts` | Tipos TypeScript dos agentes |
| `lib/agents/v3/orchestrator-v3.ts` | Orquestrador da pipeline |
| `lib/schemas/*.ts` | Schemas Zod |
| `lib/engine/*.ts` | Engine determinística |
| `lib/supabase/client.ts` | Cliente Supabase |
| `lib/supabase/flows.ts` | Funções de acesso a fluxos |
| `hooks/useFlowCreator.ts` | Hook principal do frontend |
| `supabase/functions/v3-*/index.ts` | Edge Functions |

---

**Documento mantido por:** Equipe de Engenharia Oria  
**Última atualização:** Dezembro 2024






