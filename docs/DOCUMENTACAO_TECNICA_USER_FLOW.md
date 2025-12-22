# 🔧 Documentação Técnica Completa: Sistema de Criação de User Flows

> **Versão:** 3.2  
> **Última atualização:** Dezembro 2024  
> **Público-alvo:** Equipe Técnica Oria

---

## 📚 Índice

1. [Visão Geral da Arquitetura](#1-visão-geral-da-arquitetura)
2. [Arquitetura v3.0 - Pipeline de 6 Agentes](#2-arquitetura-v30)
3. [Arquitetura v3.1 - Nova Pipeline de 6 Agentes](#3-arquitetura-v31)
4. [Engine Determinística (Código)](#4-engine-determinística)
5. [Schemas e Validações (Zod)](#5-schemas-e-validações)
6. [Banco de Dados Supabase](#6-banco-de-dados)
7. [Edge Functions (Backend)](#7-edge-functions)
8. [Orquestradores](#8-orquestradores)
9. [Fluxo de Dados End-to-End](#9-fluxo-de-dados)
10. [Referência de Arquivos](#10-referência-de-arquivos)

---

## 1. Visão Geral da Arquitetura

### 1.1 Filosofia de Design

O sistema segue uma separação clara de responsabilidades:

| Componente | Responsabilidade | Tipo |
|------------|------------------|------|
| **LLMs (OpenAI)** | Semântica, UX, interpretação de intenção | IA |
| **Engine (Código)** | Estrutura, layout, conexões, validação | Determinístico |

### 1.2 Duas Arquiteturas de Agentes

O sistema possui **duas arquiteturas paralelas**:

```
┌─────────────────────────────────────────────────────────────────┐
│                    ARQUITETURA v3.0                             │
│            (Pipeline Enriquecida - 6 Agentes)                   │
│                                                                 │
│  Master Rule → Journey → Flow Enricher → Page Mapper →          │
│  Subrules Decomposer → Flow Generator                           │
│                                                                 │
│  📍 Arquivos: lib/agents/orchestrator.ts                        │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                    ARQUITETURA v3.1                             │
│            (Nova Pipeline - 6 Agentes)                          │
│                                                                 │
│  Product Role Mapper → Flow Synthesizer → Archetype Modeler →   │
│  Flow Critic → UX Block Composer → Flow Connector               │
│                                                                 │
│  📍 Arquivos: lib/agents/v3/orchestrator-v3.ts                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Arquitetura v3.0

### 2.1 Pipeline de 12 Etapas

```typescript
// lib/agents/orchestrator.ts - createCompleteFlowWithAgents()

// Etapa 1-2: Master Rule
const masterRuleResult = await createMasterRule(request);
validateMasterRule(masterRuleResult.semantic_data); // Zod

// Etapa 3-4: Journey
const journeyResult = await createJourneyAndFeatures(masterRuleResult);
validateJourney(journeyResult); // Zod

// Etapa 5: Flow Enricher (NOVO v3.0)
const enrichedFlow = await enrichFlow(masterRuleResult, journeyResult);

// Etapa 6: Page Mapper (CÓDIGO - NOVO v3.0)
const pageContext = createPageContext(masterRuleResult.pages_involved);
const transitions = inferStandardTransitions(pageContext);

// Etapa 7-9: Subrules Decomposer
const subrules = await decomposeIntoSubrules({
  master_rule: masterRuleResult,
  journey: journeyResult,
  enriched_flow: enrichedFlow,
  page_context: pageContext
});

// Validação + Autofix se necessário
if (!validateSubrulesGraph(subrules)) {
  subrules = await retryWithFix(subrules, validationErrors);
}

// Etapa 10-12: Flow Generator (CÓDIGO 100%)
const symbolicNodes = normalizeNodeReferences(subrules);
const flow = await generateFlow(symbolicNodes);
```

### 2.2 Agentes v3.0 Detalhados

#### 2.2.1 Master Rule Creator

**Propósito:** Criar especificação semântica de regras de negócio.

```typescript
// lib/agents/master-rule-creator.ts

interface MasterRuleCreatorRequest {
  prompt: string;
  project_id: number;
  user_id: number;
}

interface MasterRuleSemanticData {
  business_goal: string;          // Objetivo do negócio
  context: string;                // Contexto da operação
  actors: string[];               // Atores envolvidos
  assumptions: string[];          // Premissas
  main_flow: string[];            // Fluxo principal (passos)
  alternative_flows: string[];    // Fluxos alternativos
  error_flows: string[];          // Fluxos de erro
  pages_involved: PageDefinition[]; // NOVO: Páginas do fluxo
}

interface PageDefinition {
  page_key: string;   // Ex: "login", "dashboard"
  label: string;      // Ex: "Página de Login"
  path?: string;      // Ex: "/login"
  description?: string;
  page_type: 'auth' | 'login' | 'signup' | 'dashboard' | 'checkout' | etc;
}
```

**Modelo IA:** GPT-4-turbo-preview  
**Edge Function:** `supabase/functions/master-rule-creator/index.ts`

#### 2.2.2 Journey Creator

**Propósito:** Criar jornada narrativa do usuário.

```typescript
// lib/agents/journey-features-creator.ts

interface JourneyStructured {
  steps: JourneyStep[];
  decisions: DecisionPoint[];
  failure_points: FailurePoint[];
  motivations: string[];
}

interface JourneyStep {
  step_id: string;
  description: string;
  page_key: string;        // Página onde acontece
  user_intent: string;     // Intenção do usuário
  system_reaction: string; // Resposta do sistema
}

interface DecisionPoint {
  decision_id: string;
  description: string;
  page_key: string;
  options: string[];       // Opções disponíveis
  destination_pages: string[]; // Páginas de destino
}

interface FailurePoint {
  failure_id: string;
  description: string;
  page_key: string;
  recovery?: string;       // Como recuperar
  recovery_page?: string;  // Página de recuperação
}
```

**Modelo IA:** GPT-4o-mini

#### 2.2.3 Flow Enricher

**Propósito:** Adicionar padrões SaaS ao fluxo.

```typescript
// lib/agents/flow-enricher.ts

interface EnrichedFlow {
  extra_steps: ExtraStep[];           // Passos adicionais sugeridos
  extra_decisions: ExtraDecision[];   // Decisões extras
  extra_failure_points: ExtraFailurePoint[];
  ux_recommendations: UxRecommendation[];
  patterns_applied: string[];         // Ex: ["confirmation", "retry"]
}

interface ExtraStep {
  step_id: string;
  description: string;
  page_key: string;
  pattern_type: 'confirmation' | 'loading' | 'success_feedback' | 'retry' | 'skip';
  reason: string; // Por que este passo é importante
}

interface UxRecommendation {
  target: string;           // Alvo da recomendação
  recommendation: string;   // Descrição da recomendação
  priority: 'low' | 'medium' | 'high';
  pattern_name?: string;    // Nome do padrão UX
}
```

**Modelo IA:** GPT-4o-mini

#### 2.2.4 Page Mapper (100% Código)

**Propósito:** Mapear páginas e transições deterministicamente.

```typescript
// lib/agents/page-mapper.ts

interface PageContext {
  pages: PageDefinition[];
  transitions: PageTransition[];
  entry_page: string;
  exit_pages_success: string[];
  exit_pages_error: string[];
}

interface PageTransition {
  from_page: string;
  to_page: string;
  reason: string;      // Motivo da transição
  is_error_path?: boolean;
}

// Função principal
export function createPageContext(
  pagesInvolved: PageDefinition[]
): PageContext;

// Inferência de transições padrão baseado em tipo de fluxo
export function inferStandardTransitions(
  context: PageContext,
  flowType: 'auth' | 'signup' | 'checkout' | 'onboarding'
): PageTransition[];
```

#### 2.2.5 Subrules Decomposer

**Propósito:** Criar RichNodes mesclando todos os contextos.

```typescript
// lib/agents/subrules-decomposer.ts

// Entrada: 4 documentos
interface SubrulesDecomposerRequest {
  master_rule_id: string;
  master_rule_content: MasterRuleSemanticData;
  journey?: JourneyStructured;
  enriched_flow?: EnrichedFlow;
  page_context?: PageContext;
  project_id: number;
  user_id: number;
}

// Saída: RichNodes v3.0
interface RichNode {
  // Campos base (obrigatórios)
  id: string;                    // snake_case único (ex: "validate_email")
  type: 'trigger' | 'action' | 'condition' | 'end' | 'subflow';
  title: string;
  description: string;
  next_on_success: string | null;
  next_on_failure: string | null;
  end_status?: 'success' | 'error' | 'cancel';
  flow_category: 'main' | 'error' | 'alternative';
  
  // Campos v3.0 (novos)
  page_key?: string;             // Página onde acontece
  user_intent?: string;          // Intenção do usuário
  system_behavior?: string;      // Comportamento do sistema
  ux_recommendation?: string;    // Dica de UX
  inputs?: FormInput[];          // Campos de formulário
  error_cases?: string[];        // Erros esperados
  allows_retry?: boolean;        // Permite retry
  allows_cancel?: boolean;       // Permite cancelar
  retry_node_id?: string;        // Nó para retry
  cancel_node_id?: string;       // Nó para cancel
}

interface FormInput {
  name: string;
  type: 'text' | 'email' | 'password' | 'number' | 'tel' | 'date' | 'select' | 'checkbox' | 'radio' | 'textarea' | 'file';
  label?: string;
  placeholder?: string;
  required?: boolean;
  validation?: string[];         // Ex: ["required", "valid_email", "min_length:8"]
  options?: { value: string; label: string }[];
}
```

**Modelo IA:** GPT-4o (mais capaz para mescla complexa)

#### 2.2.6 Flow Generator (100% Código)

**Propósito:** Converter nós simbólicos em grafo visual.

```typescript
// lib/agents/flow-generator.ts + lib/engine/

// Entrada
interface SymbolicNode {
  id: string;
  type: NodeType;
  title: string;
  description: string;
  next_on_success?: string | null;
  next_on_failure?: string | null;
  end_status?: 'success' | 'error';
  flow_category?: 'main' | 'error' | 'alternative';
}

// Saída
interface EngineGraph {
  nodes: EngineNode[];
  edges: EngineEdge[];
  layoutInfo: LayoutInfo;
}

interface EngineNode {
  id: string;           // UUID gerado
  symbolic_id: string;  // ID original (ex: "validate_email")
  type: NodeType;
  title: string;
  description: string;
  order_index: number;  // Ordem de processamento (BFS)
  position_x: number;   // Coordenada X calculada
  position_y: number;   // Coordenada Y calculada
  column: 'main' | 'error' | 'alternative';
  depth: number;        // Profundidade no grafo
  end_status?: 'success' | 'error';
}

interface EngineEdge {
  id: string;
  source: string;       // ID do nó de origem
  target: string;       // ID do nó de destino
  type: 'success' | 'failure';
  label?: string;       // "Sim", "Não", etc
  animated?: boolean;
  style?: { stroke: string };
}
```

---

## 3. Arquitetura v3.1

### 3.1 Pipeline de 6 Agentes

```typescript
// lib/agents/v3/orchestrator-v3.ts - executeV3Pipeline()

// Agente 1: Product & Role Mapper
const productContext = await mapProductAndRole(request);

// Agente 2: Flow Synthesizer
const synthesizedFlow = await synthesizeFlow(productContext);

// Agente 3: Archetype Modeler
const archetype = await modelArchetype(synthesizedFlow);

// Agente 4: Flow Critic
const criticResult = await criticizeFlow(synthesizedFlow, archetype);

// Agente 5: UX Block Composer
const composedBlocks = await composeUXBlocksV3(criticResult, synthesizedFlow);

// Agente 6: Flow Connector & Reusability Tracker
const finalFlow = await connectFlow(composedBlocks, synthesizedFlow);
```

### 3.2 Agentes v3.1 Detalhados

#### 3.2.1 Product & Role Mapper

**Propósito:** Identificar contexto do produto e papéis de usuário.

```typescript
// lib/agents/v3/product-role-mapper.ts

interface ProductRoleMapperRequest {
  prompt: string;
  project_id: number;
  existing_context?: ProductContext;
}

interface ProductRoleMapperResponse {
  product_type: string;           // Ex: "SaaS B2B", "E-commerce"
  business_model: string;         // Ex: "subscription", "marketplace"
  value_proposition: string;      // Proposta de valor
  primary_role: UserRole;         // Papel principal
  secondary_roles: UserRole[];    // Papéis secundários
  domain_terms: string[];         // Termos do domínio
}

interface UserRole {
  role_id: string;
  name: string;
  description: string;
  permissions: string[];
  goals: string[];
}
```

**Modelo IA:** GPT-4o

#### 3.2.2 Flow Synthesizer

**Propósito:** Sintetizar fluxo semântico inicial.

```typescript
// lib/agents/v3/flow-synthesizer.ts

interface FlowSynthesizerResponse {
  flow_name: string;
  flow_goal: string;
  steps: SynthesizedStep[];
  decisions: SynthesizedDecision[];
  failure_points: SynthesizedFailure[];
  complexity_score: number;       // 1-10
  estimated_time_seconds: number; // Tempo estimado do usuário
}

interface SynthesizedStep {
  step_id: string;
  step_type: string;  // Tipo semântico (ex: "form_fill", "validation", "redirect")
  title: string;
  description: string;
  page_key?: string;
  user_action: string;
  system_response: string;
  next_step_id?: string;
}

interface SynthesizedDecision {
  decision_id: string;
  step_id: string;              // Passo onde ocorre
  description: string;
  options: {
    option_id: string;
    label: string;
    next_step_id: string;
  }[];
}
```

**Modelo IA:** GPT-4o

#### 3.2.3 Archetype Modeler

**Propósito:** Modelar arquétipo de fluxo baseado em padrões conhecidos.

```typescript
// lib/agents/v3/archetype-modeler.ts

interface ArchetypeModelResponse {
  archetype_name: string;         // Ex: "Authentication", "Checkout"
  archetype_pattern: string;      // Padrão identificado
  required_steps: string[];       // Passos obrigatórios
  optional_steps: string[];       // Passos opcionais
  best_practices: string[];       // Boas práticas
  anti_patterns: string[];        // Coisas a evitar
  similar_flows: string[];        // Fluxos similares conhecidos
}
```

**Modelo IA:** GPT-4o-mini

#### 3.2.4 Flow Critic

**Propósito:** Criticar e sugerir melhorias no fluxo.

```typescript
// lib/agents/v3/flow-critic.ts

interface FlowCriticResponse {
  overall_score: number;          // 0-100
  ux_score: number;               // 0-100
  completeness_score: number;     // 0-100
  issues: CriticIssue[];
  suggestions: CriticSuggestion[];
  approved: boolean;              // Se pode prosseguir
}

interface CriticIssue {
  issue_id: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  step_id?: string;
  description: string;
  impact: string;
}

interface CriticSuggestion {
  suggestion_id: string;
  type: 'add_step' | 'modify_step' | 'remove_step' | 'reorder';
  target_step_id?: string;
  description: string;
  rationale: string;
  priority: 'low' | 'medium' | 'high';
}
```

**Modelo IA:** GPT-4o

#### 3.2.5 UX Block Composer

**Propósito:** Compor blocos de UX adaptados ao contexto.

```typescript
// lib/agents/v3/ux-block-composer-v3.ts

// MAPEAMENTO CRÍTICO: step_type → V3 node type
const STEP_TYPE_TO_V3_NODE_TYPE: Record<string, string> = {
  // Formulários
  'form_fill': 'form',
  'input': 'form',
  'data_entry': 'form',
  
  // Decisões
  'decision': 'choice',
  'branch': 'choice',
  'conditional': 'choice',
  
  // Validações
  'validation': 'validation',
  'verify': 'validation',
  'check': 'validation',
  
  // Finalizações
  'success': 'end_success',
  'complete': 'end_success',
  'error': 'end_error',
  'failure': 'end_error',
  'cancel': 'end_cancel',
  
  // Início
  'start': 'trigger',
  'entry': 'trigger',
  
  // Ações
  'action': 'action',
  'process': 'action',
  'redirect': 'redirect',
  'notification': 'notification',
  'loading': 'loading',
  'display': 'display',
  'api_call': 'api_call',
};

// Função de mapeamento com fallback inteligente
export function mapStepTypeToV3Type(stepType: string): string {
  if (!stepType) return 'action';
  
  const normalized = stepType.toLowerCase().trim();
  
  // Busca direta
  if (STEP_TYPE_TO_V3_NODE_TYPE[normalized]) {
    return STEP_TYPE_TO_V3_NODE_TYPE[normalized];
  }
  
  // Fallback baseado em keywords
  if (normalized.includes('form') || normalized.includes('input')) return 'form';
  if (normalized.includes('decision') || normalized.includes('choice')) return 'choice';
  if (normalized.includes('success') || normalized.includes('complete')) return 'end_success';
  if (normalized.includes('error') || normalized.includes('fail')) return 'end_error';
  if (normalized.includes('trigger') || normalized.includes('start')) return 'trigger';
  if (normalized.includes('valid')) return 'validation';
  if (normalized.includes('notify') || normalized.includes('alert')) return 'notification';
  
  return 'action'; // Default
}

interface UXBlockComposerV3Response {
  composed_blocks: AdaptedUXBlockV3[];
  library_blocks_used: string[];  // IDs dos blocos da biblioteca usados
  custom_blocks_created: number;  // Blocos criados do zero
}

interface AdaptedUXBlockV3 {
  block_id: string;
  step_id: string;                // Referência ao step do synthesizer
  node_id: string;                // ID único do nó
  v3_type: string;                // TIPO V3 (form, choice, action, etc)
  title: string;
  description: string;
  page_key?: string;
  
  // Dados do bloco
  inputs?: FormInput[];
  options?: BlockOption[];
  
  // Contexto
  adapted_from?: string;          // ID do bloco da biblioteca
  adaptations_made: string[];     // Adaptações feitas
}
```

**Modelo IA:** GPT-4o

#### 3.2.6 Flow Connector

**Propósito:** Conectar blocos, gerar layout e rastrear reusabilidade.

```typescript
// lib/agents/v3/flow-connector.ts

interface FlowConnectorResponse {
  nodes: V3FlowNode[];
  connections: NodeConnection[];
  reusable_nodes: ReusableNode[];
  dependency_graph: DependencyNode[];
}

interface V3FlowNode {
  node_id: string;
  v3_type: string;                // PRESERVAR tipo V3!
  title: string;
  description: string;
  position_x: number;
  position_y: number;
  column: 'main' | 'error' | 'alternative';
  order_index: number;
  metadata: {
    step_id?: string;
    page_key?: string;
    v3_type: string;              // Duplicado para garantia
    inputs?: FormInput[];
    // ... outros dados
  };
}

interface NodeConnection {
  connection_id: string;
  source_node_id: string;
  target_node_id: string;
  connection_type: 'success' | 'failure' | 'option';
  label?: string;
}

// FUNÇÃO CRÍTICA: Converter blocos para nós com layout
export function convertBlocksToNodes(
  blocks: AdaptedUXBlockV3[],
  connections: NodeConnection[]
): V3FlowNode[] {
  // BFS para determinar profundidade e ordem
  const depths = calculateDepthsBFS(blocks, connections);
  
  // Layout horizontal
  const SPACING_X = 300;
  const SPACING_Y = 200;
  const START_Y_MAIN = 300;
  const START_Y_ERROR = 500;
  const START_Y_ALT = 100;
  
  return blocks.map((block, index) => {
    const depth = depths.get(block.node_id) || index;
    const column = determineColumn(block, connections);
    
    let y = START_Y_MAIN;
    if (column === 'error') y = START_Y_ERROR;
    if (column === 'alternative') y = START_Y_ALT;
    
    return {
      node_id: block.node_id,
      v3_type: block.v3_type,     // PRESERVAR!
      title: block.title,
      description: block.description,
      position_x: 100 + (depth * SPACING_X),
      position_y: y,
      column,
      order_index: depth,
      metadata: {
        step_id: block.step_id,
        page_key: block.page_key,
        v3_type: block.v3_type,   // DUPLICAR para segurança
        inputs: block.inputs,
      }
    };
  });
}

// FUNÇÃO CRÍTICA: Salvar no banco preservando v3_type
export async function saveConnectedFlow(
  projectId: number,
  flowName: string,
  nodes: V3FlowNode[],
  connections: NodeConnection[]
): Promise<SavedFlowResult> {
  // 1. Criar flow
  const { data: flow } = await supabase
    .from('flows')
    .insert({
      project_id: projectId,
      name: flowName,
      metadata: { source: 'v3.1-pipeline' }
    })
    .select()
    .single();
  
  // 2. Salvar nós COM v3_type no metadata
  const savedNodes = await Promise.all(
    nodes.map(node => 
      supabase.from('nodes').insert({
        flow_id: flow.id,
        type: node.v3_type,         // Salvar como type principal
        title: node.title,
        description: node.description,
        position_x: node.position_x,
        position_y: node.position_y,
        metadata: {
          ...node.metadata,
          v3_type: node.v3_type,    // TAMBÉM no metadata!
        }
      }).select().single()
    )
  );
  
  // 3. Mapear IDs simbólicos → IDs do banco
  const idMap = new Map<string, number>();
  savedNodes.forEach((result, idx) => {
    idMap.set(nodes[idx].node_id, result.data.id);
  });
  
  // 4. Salvar conexões
  await Promise.all(
    connections.map(conn =>
      supabase.from('connections').insert({
        flow_id: flow.id,
        source_node_id: idMap.get(conn.source_node_id),
        target_node_id: idMap.get(conn.target_node_id),
        label: conn.label,
      })
    )
  );
  
  return { flow_id: flow.id, nodes_count: nodes.length };
}
```

---

## 4. Engine Determinística

### 4.1 Pipeline da Engine

```
SubRuleNode[] → buildGraph → assignOrderIndex → assignLayout → validateGraph → EngineGraph
```

### 4.2 buildGraph

```typescript
// lib/engine/buildGraph.ts

export function buildGraph(nodes: SubRuleNode[]): EngineGraph {
  // 1. Criar nós com IDs únicos
  const engineNodes = nodes.map(node => ({
    id: generateUUID(),
    symbolic_id: node.id,
    type: node.type,
    title: node.title,
    description: node.description,
    order_index: 0,  // Será calculado
    position_x: 0,   // Será calculado
    position_y: 0,   // Será calculado
    column: 'main',  // Será classificado
    depth: 0,        // Será calculado
    end_status: node.end_status,
  }));
  
  // 2. Classificar nós (main, error, alternative)
  classifyNodes(engineNodes, nodes);
  
  // 3. Criar edges
  const edges = buildEdges(engineNodes, nodes);
  
  return { nodes: engineNodes, edges, layoutInfo: {} };
}

function classifyNodes(engineNodes: EngineNode[], original: SubRuleNode[]) {
  // Prioriza flow_category do nó original
  original.forEach((node, i) => {
    if (node.flow_category) {
      engineNodes[i].column = node.flow_category;
    } else if (node.type === 'end' && node.end_status === 'error') {
      engineNodes[i].column = 'error';
    } else {
      engineNodes[i].column = 'main';
    }
  });
}
```

### 4.3 assignOrderIndex (BFS)

```typescript
// lib/engine/assignOrderIndex.ts

export function assignOrderIndex(graph: EngineGraph): void {
  const trigger = graph.nodes.find(n => n.type === 'trigger');
  if (!trigger) return;
  
  // BFS a partir do trigger
  const queue: string[] = [trigger.id];
  const visited = new Set<string>();
  let orderIndex = 1;
  
  while (queue.length > 0) {
    const currentId = queue.shift()!;
    if (visited.has(currentId)) continue;
    
    visited.add(currentId);
    const node = graph.nodes.find(n => n.id === currentId);
    if (node) {
      node.order_index = orderIndex++;
    }
    
    // Adicionar vizinhos (filhos)
    const outEdges = graph.edges.filter(e => e.source === currentId);
    outEdges.forEach(edge => {
      if (!visited.has(edge.target)) {
        queue.push(edge.target);
      }
    });
  }
  
  // Nós órfãos recebem índice no final
  graph.nodes.forEach(node => {
    if (!visited.has(node.id)) {
      node.order_index = orderIndex++;
    }
  });
}
```

### 4.4 assignLayout

```typescript
// lib/engine/assignLayout.ts

export const DEFAULT_LAYOUT_CONFIG = {
  nodeSpacingX: 280,
  nodeSpacingY: 180,
  startX: 100,
  mainPathY: 300,
  errorPathYOffset: 200,
  alternativePathYOffset: -200,
};

export function assignLayout(
  graph: EngineGraph, 
  config = DEFAULT_LAYOUT_CONFIG
): void {
  // 1. Calcular profundidades via BFS
  const depths = calculateDepths(graph);
  
  // 2. Agrupar por coluna
  const mainNodes = graph.nodes.filter(n => n.column === 'main');
  const errorNodes = graph.nodes.filter(n => n.column === 'error');
  const altNodes = graph.nodes.filter(n => n.column === 'alternative');
  
  // 3. Calcular posições
  assignPositionsToGroup(mainNodes, depths, config.mainPathY, config);
  assignPositionsToGroup(errorNodes, depths, config.mainPathY + config.errorPathYOffset, config);
  assignPositionsToGroup(altNodes, depths, config.mainPathY + config.alternativePathYOffset, config);
  
  // 4. Ajustar overlaps
  adjustLayoutForOverlap(graph, config);
}

function calculateDepths(graph: EngineGraph): Map<string, number> {
  const depths = new Map<string, number>();
  const trigger = graph.nodes.find(n => n.type === 'trigger');
  if (!trigger) return depths;
  
  const queue: Array<{ id: string; depth: number }> = [{ id: trigger.id, depth: 0 }];
  const visited = new Set<string>();
  
  while (queue.length > 0) {
    const { id, depth } = queue.shift()!;
    if (visited.has(id)) continue;
    
    visited.add(id);
    depths.set(id, depth);
    
    const outEdges = graph.edges.filter(e => e.source === id);
    outEdges.forEach(edge => {
      if (!visited.has(edge.target)) {
        queue.push({ id: edge.target, depth: depth + 1 });
      }
    });
  }
  
  return depths;
}

function assignPositionsToGroup(
  nodes: EngineNode[],
  depths: Map<string, number>,
  baseY: number,
  config: typeof DEFAULT_LAYOUT_CONFIG
) {
  // Agrupar por depth
  const byDepth = new Map<number, EngineNode[]>();
  nodes.forEach(node => {
    const depth = depths.get(node.id) || 0;
    if (!byDepth.has(depth)) byDepth.set(depth, []);
    byDepth.get(depth)!.push(node);
  });
  
  // Posicionar cada grupo
  byDepth.forEach((group, depth) => {
    const totalHeight = (group.length - 1) * config.nodeSpacingY;
    const startY = baseY - totalHeight / 2;
    
    group.forEach((node, i) => {
      node.position_x = config.startX + depth * config.nodeSpacingX;
      node.position_y = startY + i * config.nodeSpacingY;
      node.depth = depth;
    });
  });
}
```

### 4.5 validateGraph

```typescript
// lib/engine/validateGraph.ts

export interface GraphValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
}

export function validateGraph(graph: EngineGraph): GraphValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];
  
  // 1. Exatamente 1 trigger
  const triggers = graph.nodes.filter(n => n.type === 'trigger');
  if (triggers.length === 0) {
    errors.push({ code: 'NO_TRIGGER', message: 'Grafo deve ter 1 trigger' });
  }
  if (triggers.length > 1) {
    errors.push({ code: 'MULTIPLE_TRIGGERS', message: `${triggers.length} triggers encontrados` });
  }
  
  // 2. Pelo menos 1 end success
  const successEnds = graph.nodes.filter(n => n.type === 'end' && n.end_status === 'success');
  if (successEnds.length === 0) {
    errors.push({ code: 'NO_SUCCESS_END', message: 'Deve ter pelo menos 1 end success' });
  }
  
  // 3. Verificar referências inválidas
  const nodeIds = new Set(graph.nodes.map(n => n.id));
  graph.edges.forEach(edge => {
    if (!nodeIds.has(edge.source)) {
      errors.push({ code: 'INVALID_SOURCE', message: `Edge source ${edge.source} não existe` });
    }
    if (!nodeIds.has(edge.target)) {
      errors.push({ code: 'INVALID_TARGET', message: `Edge target ${edge.target} não existe` });
    }
  });
  
  // 4. Condition deve ter 2 saídas
  const conditions = graph.nodes.filter(n => n.type === 'condition');
  conditions.forEach(condition => {
    const outEdges = graph.edges.filter(e => e.source === condition.id);
    if (outEdges.length < 2) {
      errors.push({ 
        code: 'CONDITION_INCOMPLETE', 
        message: `Condition ${condition.symbolic_id} deve ter 2 saídas` 
      });
    }
  });
  
  // 5. End não pode ter saídas
  const ends = graph.nodes.filter(n => n.type === 'end');
  ends.forEach(end => {
    const outEdges = graph.edges.filter(e => e.source === end.id);
    if (outEdges.length > 0) {
      errors.push({ code: 'END_HAS_OUTPUT', message: `End ${end.symbolic_id} não pode ter saídas` });
    }
  });
  
  // 6. Detectar ciclos
  const cycleErrors = detectCycles(graph);
  errors.push(...cycleErrors);
  
  // 7. Nós órfãos (warning)
  const hasIncoming = new Set(graph.edges.map(e => e.target));
  graph.nodes.forEach(node => {
    if (node.type !== 'trigger' && !hasIncoming.has(node.id)) {
      warnings.push({ code: 'ORPHAN_NODE', message: `Nó ${node.symbolic_id} não tem entrada` });
    }
  });
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

function detectCycles(graph: EngineGraph): ValidationError[] {
  const errors: ValidationError[] = [];
  const visited = new Set<string>();
  const recStack = new Set<string>();
  
  function dfs(nodeId: string, path: string[]): boolean {
    if (recStack.has(nodeId)) {
      const cycleStart = path.indexOf(nodeId);
      const cycle = [...path.slice(cycleStart), nodeId].join(' → ');
      errors.push({ code: 'CYCLE_DETECTED', message: `Ciclo: ${cycle}` });
      return true;
    }
    
    if (visited.has(nodeId)) return false;
    
    visited.add(nodeId);
    recStack.add(nodeId);
    
    const outEdges = graph.edges.filter(e => e.source === nodeId);
    for (const edge of outEdges) {
      if (dfs(edge.target, [...path, nodeId])) return true;
    }
    
    recStack.delete(nodeId);
    return false;
  }
  
  for (const node of graph.nodes) {
    if (!visited.has(node.id)) {
      dfs(node.id, []);
    }
  }
  
  return errors;
}
```

---

## 5. Schemas e Validações

### 5.1 Schema Master Rule (Zod)

```typescript
// lib/schemas/masterRuleSchema.ts

import { z } from 'zod';

export const PageDefinitionSchema = z.object({
  page_key: z.string().min(1).regex(/^[a-z0-9_]+$/),
  label: z.string().min(1),
  path: z.string().optional(),
  description: z.string().optional(),
  page_type: z.enum([
    'auth', 'login', 'signup', 'recovery', 'onboarding',
    'dashboard', 'settings', 'checkout', 'profile',
    'confirmation', 'error', 'success', 'landing', 'other'
  ]),
});

export const MasterRuleSchema = z.object({
  business_goal: z.string().min(10),
  context: z.string().min(10),
  actors: z.array(z.string()).min(1),
  assumptions: z.array(z.string()).optional(),
  main_flow: z.array(z.string()).min(3),
  alternative_flows: z.array(z.string()).optional(),
  error_flows: z.array(z.string()).optional(),
  pages_involved: z.array(PageDefinitionSchema).optional(),
});

export function validateMasterRule(data: unknown) {
  return MasterRuleSchema.safeParse(data);
}
```

### 5.2 Schema Subrules (Zod)

```typescript
// lib/schemas/subrulesSchema.ts

import { z } from 'zod';

export const NodeTypeEnum = z.enum(['trigger', 'action', 'condition', 'end', 'subflow']);
export const EndStatusEnum = z.enum(['success', 'error', 'cancel']);
export const FlowCategoryEnum = z.enum(['main', 'error', 'alternative']);

export const FormInputSchema = z.object({
  name: z.string().min(1),
  type: z.enum([
    'text', 'email', 'password', 'number', 'tel', 'date',
    'datetime', 'select', 'checkbox', 'radio', 'textarea', 'file', 'hidden'
  ]).default('text'),
  label: z.string().optional(),
  placeholder: z.string().optional(),
  required: z.boolean().default(false),
  validation: z.array(z.string()).optional(),
  options: z.array(z.object({ value: z.string(), label: z.string() })).optional(),
});

export const RichNodeSchema = z.object({
  // Campos obrigatórios
  id: z.string().min(1).regex(/^[a-z0-9_]+$/),
  type: NodeTypeEnum,
  title: z.string().min(3),
  description: z.string(),
  
  // Conexões
  next_on_success: z.string().nullable().optional(),
  next_on_failure: z.string().nullable().optional(),
  
  // Status e categoria
  end_status: EndStatusEnum.optional(),
  flow_category: FlowCategoryEnum.default('main'),
  
  // Campos v3.0
  page_key: z.string().optional(),
  user_intent: z.string().optional(),
  system_behavior: z.string().optional(),
  ux_recommendation: z.string().optional(),
  inputs: z.array(FormInputSchema).optional(),
  error_cases: z.array(z.string()).optional(),
  allows_retry: z.boolean().default(false),
  allows_cancel: z.boolean().default(false),
  retry_node_id: z.string().optional(),
  cancel_node_id: z.string().optional(),
});

export const SubrulesResponseSchema = z.object({
  nodes: z.array(RichNodeSchema).min(3),
});
```

### 5.3 Validação SaaS Específica

```typescript
// lib/schemas/subrulesSchema.ts - validateSaaSFlow()

export interface SaaSValidationResult {
  score: number;           // 0-100
  errors: string[];
  warnings: string[];
  suggestions: string[];
}

export function validateSaaSFlow(
  nodes: RichNode[], 
  flowType?: string
): SaaSValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const suggestions: string[] = [];
  let score = 100;
  
  // Detectar tipo de fluxo
  const detectedType = flowType || detectFlowType(nodes);
  
  if (detectedType === 'login' || detectedType === 'auth') {
    // Login deve ter inputs de email e password
    const loginNodes = nodes.filter(n => 
      n.page_key === 'login' || n.title.toLowerCase().includes('login')
    );
    
    const hasEmailInput = loginNodes.some(n => 
      n.inputs?.some(i => i.type === 'email' || i.name === 'email')
    );
    const hasPasswordInput = loginNodes.some(n => 
      n.inputs?.some(i => i.type === 'password' || i.name === 'password')
    );
    
    if (!hasEmailInput) {
      errors.push('Fluxo de login deve ter input de email');
      score -= 15;
    }
    if (!hasPasswordInput) {
      errors.push('Fluxo de login deve ter input de senha');
      score -= 15;
    }
    
    // Verificar recuperação de senha
    const hasRecoveryPath = nodes.some(n => 
      n.page_key === 'recovery' || 
      n.title.toLowerCase().includes('recuper') ||
      n.title.toLowerCase().includes('forgot')
    );
    
    if (!hasRecoveryPath) {
      warnings.push('Fluxo de login deve ter opção de recuperar senha');
      score -= 5;
    }
  }
  
  if (detectedType === 'signup') {
    // Signup deve ter confirmação de senha
    const signupNodes = nodes.filter(n => 
      n.page_key === 'signup' || n.title.toLowerCase().includes('cadastr')
    );
    
    const hasConfirmPassword = signupNodes.some(n =>
      n.inputs?.some(i => i.name === 'password_confirm' || i.name === 'confirmPassword')
    );
    
    if (!hasConfirmPassword) {
      suggestions.push('Considere adicionar confirmação de senha no cadastro');
      score -= 3;
    }
  }
  
  // Verificar tratamento de erro
  const hasErrorEnd = nodes.some(n => n.type === 'end' && n.end_status === 'error');
  if (!hasErrorEnd) {
    warnings.push('Fluxo não tem tratamento de erro (end error)');
    score -= 10;
  }
  
  // Verificar retry em ações críticas
  const criticalActions = nodes.filter(n => 
    n.type === 'action' && 
    (n.title.toLowerCase().includes('pagar') ||
     n.title.toLowerCase().includes('enviar') ||
     n.title.toLowerCase().includes('processar'))
  );
  
  criticalActions.forEach(action => {
    if (!action.allows_retry) {
      suggestions.push(`Considere permitir retry em "${action.title}"`);
    }
  });
  
  return {
    score: Math.max(0, score),
    errors,
    warnings,
    suggestions,
  };
}
```

---

## 6. Banco de Dados

### 6.1 Diagrama de Entidades

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              PROJETOS                                        │
│                                                                             │
│  projects                                                                   │
│  ├── id (PK)                                                               │
│  ├── name                                                                  │
│  ├── user_id (FK)                                                          │
│  └── metadata (jsonb) ─────────────────┐                                   │
│                                         │                                   │
└─────────────────────────────────────────┼───────────────────────────────────┘
                                          │
         ┌────────────────────────────────┼────────────────────────────────┐
         │                                │                                │
         ▼                                ▼                                ▼
┌─────────────────┐              ┌─────────────────┐              ┌─────────────────┐
│     rules       │              │     flows       │              │ user_journeys   │
│                 │              │                 │              │                 │
│ id (PK)         │              │ id (PK)         │              │ id (PK)         │
│ project_id (FK) │              │ project_id (FK) │              │ project_id (FK) │
│ title           │◀─────────────│ journey_id (FK) │─────────────▶│ master_rule_id  │
│ description     │              │ name            │              │ name            │
│ content (text)  │              │ description     │              │ persona         │
│ rule_type       │              │ metadata        │              │ goal            │
│ scope           │              │   - source      │              │ steps (jsonb)   │
│ parent_rule_id  │              │   - score       │              │ narrative       │
│ flow_id (FK)    │─────────────▶│ created_at      │              │ metadata        │
│ suggested_node  │              │ updated_at      │              │   - journey_v2  │
│ status          │              └────────┬────────┘              │   - structured  │
│ priority        │                       │                       │ created_at      │
│ metadata        │                       │                       └─────────────────┘
│   - semantic    │                       │
│   - symbolic_id │              ┌────────┴────────┐
│   - page_key    │              │                 │
│   - inputs      │              ▼                 ▼
│ created_at      │      ┌─────────────┐   ┌─────────────────┐
│ updated_at      │      │   nodes     │   │  connections    │
└─────────────────┘      │             │   │                 │
                         │ id (PK)     │   │ id (PK)         │
                         │ flow_id(FK) │   │ flow_id (FK)    │
                         │ type        │   │ source_node_id  │
                         │ title       │   │ target_node_id  │
                         │ description │   │ label           │
                         │ position_x  │   │ created_at      │
                         │ position_y  │   │ updated_at      │
                         │ metadata    │   └─────────────────┘
                         │   - v3_type │
                         │   - symbolic│
                         │   - inputs  │
                         │ created_at  │
                         │ updated_at  │
                         └─────────────┘
```

### 6.2 Tabela: rules

**Propósito:** Armazena regras de negócio (master) e nós simbólicos (node_rule).

```sql
CREATE TABLE rules (
  id SERIAL PRIMARY KEY,
  project_id INTEGER REFERENCES projects(id),
  title TEXT NOT NULL,
  description TEXT,
  content TEXT,  -- Markdown formatado
  rule_type TEXT NOT NULL,  -- 'flow_master' | 'node_rule'
  scope TEXT,  -- 'flow' | 'node'
  parent_rule_id INTEGER REFERENCES rules(id),
  flow_id INTEGER REFERENCES flows(id),
  suggested_node_type TEXT,  -- 'trigger' | 'action' | 'condition' | 'end' | 'subflow'
  status TEXT DEFAULT 'active',
  priority TEXT DEFAULT 'medium',
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices importantes
CREATE INDEX idx_rules_project ON rules(project_id);
CREATE INDEX idx_rules_parent ON rules(parent_rule_id);
CREATE INDEX idx_rules_flow ON rules(flow_id);
CREATE INDEX idx_rules_type ON rules(rule_type);
```

**Estrutura metadata para flow_master:**
```json
{
  "semantic_data": {
    "business_goal": "...",
    "context": "...",
    "actors": ["..."],
    "main_flow": ["..."],
    "alternative_flows": ["..."],
    "error_flows": ["..."],
    "pages_involved": [...]
  },
  "category": "auth|checkout|onboarding|...",
  "quality_score": 85
}
```

**Estrutura metadata para node_rule:**
```json
{
  "symbolic_id": "validate_email",
  "next_on_success": "send_email",
  "next_on_failure": "end_error",
  "end_status": "success|error|cancel",
  "flow_category": "main|error|alternative",
  "page_key": "login",
  "user_intent": "Verificar se email é válido",
  "system_behavior": "Validar formato e existência",
  "ux_recommendation": "Mostrar feedback em tempo real",
  "inputs": [...],
  "error_cases": ["Email inválido", "Email não cadastrado"],
  "allows_retry": true,
  "allows_cancel": false,
  "source": "subrules-decomposer-v3",
  "is_rich_node": true
}
```

### 6.3 Tabela: flows

**Propósito:** Armazena metadados do fluxo visual.

```sql
CREATE TABLE flows (
  id SERIAL PRIMARY KEY,
  project_id INTEGER REFERENCES projects(id),
  name TEXT NOT NULL,
  description TEXT,
  journey_id INTEGER REFERENCES user_journeys(id),
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_flows_project ON flows(project_id);
CREATE INDEX idx_flows_journey ON flows(journey_id);
```

**Estrutura metadata:**
```json
{
  "source": "v3.0-pipeline|v3.1-pipeline",
  "validation_score": 95,
  "total_nodes": 12,
  "total_connections": 14,
  "has_error_paths": true,
  "pages_count": 4,
  "archetype": "authentication"
}
```

### 6.4 Tabela: nodes

**Propósito:** Armazena cada nó visual do fluxo.

```sql
CREATE TABLE nodes (
  id SERIAL PRIMARY KEY,
  flow_id INTEGER REFERENCES flows(id) ON DELETE CASCADE,
  type TEXT NOT NULL,  -- Tipo do nó (v3_type para v3.1)
  title TEXT NOT NULL,
  description TEXT,
  position_x FLOAT NOT NULL,
  position_y FLOAT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_nodes_flow ON nodes(flow_id);
CREATE INDEX idx_nodes_type ON nodes(type);
```

**Estrutura metadata (CRÍTICO para v3.1):**
```json
{
  "v3_type": "form|choice|action|trigger|end_success|end_error|...",
  "symbolic_id": "fill_login_form",
  "order_index": 3,
  "column": "main",
  "depth": 2,
  "page_key": "login",
  "step_id": "step_3",
  "inputs": [
    {"name": "email", "type": "email", "required": true},
    {"name": "password", "type": "password", "required": true}
  ],
  "end_status": "success|error|cancel"
}
```

> ⚠️ **IMPORTANTE:** O campo `metadata.v3_type` é crítico para o v3.1. Ele garante que o tipo correto do nó seja preservado ao carregar do banco.

### 6.5 Tabela: connections

**Propósito:** Armazena conexões (edges) entre nós.

```sql
CREATE TABLE connections (
  id SERIAL PRIMARY KEY,
  flow_id INTEGER REFERENCES flows(id) ON DELETE CASCADE,
  source_node_id INTEGER REFERENCES nodes(id) ON DELETE CASCADE,
  target_node_id INTEGER REFERENCES nodes(id) ON DELETE CASCADE,
  label TEXT,  -- "Sim", "Não", etc
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_connections_flow ON connections(flow_id);
CREATE INDEX idx_connections_source ON connections(source_node_id);
CREATE INDEX idx_connections_target ON connections(target_node_id);
```

### 6.6 Tabela: user_journeys

**Propósito:** Armazena jornadas do usuário criadas pelo Journey Creator.

```sql
CREATE TABLE user_journeys (
  id SERIAL PRIMARY KEY,
  project_id INTEGER REFERENCES projects(id),
  master_rule_id INTEGER REFERENCES rules(id),
  name TEXT NOT NULL,
  persona TEXT,
  goal TEXT,
  steps JSONB,  -- Array de strings simples
  narrative TEXT,  -- Narrativa em texto
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_journeys_project ON user_journeys(project_id);
CREATE INDEX idx_journeys_master ON user_journeys(master_rule_id);
```

**Estrutura metadata:**
```json
{
  "journey_v2": {
    "steps": ["..."],
    "decisions": ["..."],
    "failure_points": ["..."],
    "motivations": ["..."]
  },
  "journey_structured": {
    "steps": [{
      "step_id": "...",
      "description": "...",
      "page_key": "...",
      "user_intent": "...",
      "system_reaction": "..."
    }],
    "decisions": [...],
    "failure_points": [...]
  },
  "page_context": {
    "pages": [...],
    "transitions": [...],
    "entry_page": "...",
    "exit_pages_success": [...],
    "exit_pages_error": [...]
  }
}
```

### 6.7 Tabela: agent_conversations

**Propósito:** Log de todas as conversas com agentes de IA.

```sql
CREATE TABLE agent_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id INTEGER REFERENCES projects(id),
  user_id INTEGER REFERENCES users(id),
  agent_type TEXT NOT NULL,  -- 'master_rule_creator_v3', 'subrules_decomposer', etc
  messages JSONB NOT NULL,  -- Array de mensagens
  context JSONB,  -- Contexto adicional
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_conversations_project ON agent_conversations(project_id);
CREATE INDEX idx_conversations_user ON agent_conversations(user_id);
CREATE INDEX idx_conversations_agent ON agent_conversations(agent_type);
```

**Estrutura messages:**
```json
[
  {"role": "system", "content": "..."},
  {"role": "user", "content": "..."},
  {"role": "assistant", "content": "..."}
]
```

---

## 7. Edge Functions

### 7.1 Estrutura de uma Edge Function

```typescript
// supabase/functions/[agent-name]/index.ts

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import OpenAI from "https://deno.land/x/openai@v4.68.1/mod.ts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    
    // Inicializar clientes
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    const openai = new OpenAI({ apiKey: Deno.env.get("OPENAI_API_KEY")! });
    
    // Lógica do agente...
    const result = await processWithAI(openai, body);
    
    // Validar com Zod
    const validated = MySchema.parse(result);
    
    // Salvar no banco
    await saveToDatabase(supabase, validated);
    
    return new Response(
      JSON.stringify({ success: true, data: validated }),
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

### 7.2 Edge Functions Disponíveis

| Função | Arquivo | Modelo IA | Propósito |
|--------|---------|-----------|-----------|
| master-rule-creator | `supabase/functions/master-rule-creator/` | GPT-4-turbo | Criar regras de negócio |
| journey-features-creator | `supabase/functions/journey-features-creator/` | GPT-4o-mini | Criar jornada do usuário |
| flow-enricher | `supabase/functions/flow-enricher/` | GPT-4o-mini | Enriquecer com padrões SaaS |
| subrules-decomposer | `supabase/functions/subrules-decomposer/` | GPT-4o | Criar RichNodes |
| flow-generator | `supabase/functions/flow-generator/` | N/A (código) | Gerar grafo visual |
| v3-product-role-mapper | `supabase/functions/v3-product-role-mapper/` | GPT-4o | Mapear produto e roles |
| v3-flow-synthesizer | `supabase/functions/v3-flow-synthesizer/` | GPT-4o | Sintetizar fluxo |
| v3-archetype-modeler | `supabase/functions/v3-archetype-modeler/` | GPT-4o-mini | Modelar arquétipo |
| v3-flow-critic | `supabase/functions/v3-flow-critic/` | GPT-4o | Criticar fluxo |
| v3-ux-block-composer-v3 | `supabase/functions/v3-ux-block-composer-v3/` | GPT-4o | Compor blocos UX |
| v3-flow-connector | `supabase/functions/v3-flow-connector/` | N/A (código) | Conectar e posicionar |

---

## 8. Orquestradores

### 8.1 Orquestrador v3.0

```typescript
// lib/agents/orchestrator.ts

export interface FullFlowCreationRequest {
  prompt: string;
  project_id: number;
  user_id: number;
}

export interface ProgressCallback {
  (progress: {
    step: string;
    message: string;
    percentage: number;
    details?: Record<string, any>;
  }): void;
}

export async function createCompleteFlowWithAgents(
  request: FullFlowCreationRequest,
  onProgress?: ProgressCallback
): Promise<FullFlowCreationResponse> {
  // 12 etapas...
}

// Função para corrigir referências numéricas
function normalizeNodeReferences(nodes: SubRuleNode[]): SymbolicNode[] {
  const idMap = new Map<string, string>();
  
  // Mapear índices para IDs simbólicos
  nodes.forEach((node, idx) => {
    idMap.set(String(idx + 1), node.id);
    if (node.db_id) idMap.set(String(node.db_id), node.id);
  });
  
  // Corrigir referências
  return nodes.map(node => ({
    ...node,
    next_on_success: resolveReference(node.next_on_success, idMap),
    next_on_failure: resolveReference(node.next_on_failure, idMap),
  }));
}

function resolveReference(ref: string | null, idMap: Map<string, string>): string | null {
  if (!ref) return null;
  if (/^\d+$/.test(ref)) {
    return idMap.get(ref) || null;
  }
  return ref;
}
```

### 8.2 Orquestrador v3.1

```typescript
// lib/agents/v3/orchestrator-v3.ts

export interface V3PipelineRequest {
  prompt: string;
  project_id: number;
  user_id: number;
  existing_flows?: string[];  // Para análise de reusabilidade
}

export async function executeV3Pipeline(
  request: V3PipelineRequest,
  onProgress?: ProgressCallback
): Promise<V3PipelineResponse> {
  // 6 agentes em sequência
  
  // Agente 1: Product & Role Mapper
  onProgress?.({ step: 'product_mapper', percentage: 10, message: 'Mapeando produto...' });
  const productContext = await mapProductAndRole(request);
  
  // Agente 2: Flow Synthesizer
  onProgress?.({ step: 'synthesizer', percentage: 25, message: 'Sintetizando fluxo...' });
  const synthesizedFlow = await synthesizeFlow({
    ...request,
    product_context: productContext
  });
  
  // Agente 3: Archetype Modeler
  onProgress?.({ step: 'archetype', percentage: 40, message: 'Modelando arquétipo...' });
  const archetype = await modelArchetype(synthesizedFlow);
  
  // Agente 4: Flow Critic
  onProgress?.({ step: 'critic', percentage: 55, message: 'Analisando qualidade...' });
  const criticResult = await criticizeFlow(synthesizedFlow, archetype);
  
  // Se crítico reprovar, pode-se iterar
  if (!criticResult.approved && criticResult.issues.some(i => i.severity === 'critical')) {
    throw new Error('Fluxo rejeitado pelo crítico');
  }
  
  // Agente 5: UX Block Composer
  onProgress?.({ step: 'composer', percentage: 70, message: 'Compondo blocos UX...' });
  const composedBlocks = await composeUXBlocksV3({
    synthesized_flow: synthesizedFlow,
    archetype,
    critic_suggestions: criticResult.suggestions,
    product_context: productContext
  });
  
  // Agente 6: Flow Connector
  onProgress?.({ step: 'connector', percentage: 85, message: 'Conectando fluxo...' });
  const connectedFlow = await connectFlow({
    composed_blocks: composedBlocks,
    synthesized_flow: synthesizedFlow
  });
  
  // Salvar no banco
  onProgress?.({ step: 'saving', percentage: 95, message: 'Salvando...' });
  const savedFlow = await saveConnectedFlow(
    request.project_id,
    synthesizedFlow.flow_name,
    connectedFlow.nodes,
    connectedFlow.connections
  );
  
  onProgress?.({ step: 'completed', percentage: 100, message: 'Concluído!' });
  
  return {
    success: true,
    flow_id: savedFlow.flow_id,
    nodes_count: connectedFlow.nodes.length,
    connections_count: connectedFlow.connections.length,
    reusable_nodes: connectedFlow.reusable_nodes,
    archetype: archetype.archetype_name,
    quality_scores: {
      overall: criticResult.overall_score,
      ux: criticResult.ux_score,
      completeness: criticResult.completeness_score
    }
  };
}
```

---

## 9. Fluxo de Dados End-to-End

### 9.1 Fluxo v3.0 Completo

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ INPUT: Prompt do Usuário                                                    │
│ "Criar um fluxo de recuperação de senha para um SaaS B2B"                  │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ ETAPA 1-2: Master Rule Creator                                              │
│                                                                             │
│ OUTPUT: MasterRuleSemanticData                                              │
│ {                                                                           │
│   business_goal: "Permitir recuperação de acesso...",                       │
│   main_flow: ["Acessar tela", "Informar email", "Validar", "Enviar"],       │
│   pages_involved: [{page_key:"login"}, {page_key:"recovery"}]               │
│ }                                                                           │
│                                                                             │
│ BANCO: rules (rule_type: flow_master)                                       │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ ETAPA 3-4: Journey Creator                                                  │
│                                                                             │
│ OUTPUT: JourneyStructured                                                   │
│ {                                                                           │
│   steps: [                                                                  │
│     { step_id:"access", page_key:"recovery", user_intent:"Recuperar..." }   │
│   ],                                                                        │
│   failure_points: [{ failure_id:"email_not_found", recovery:"..." }]        │
│ }                                                                           │
│                                                                             │
│ BANCO: user_journeys                                                        │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ ETAPA 5: Flow Enricher                                                      │
│                                                                             │
│ OUTPUT: EnrichedFlow                                                        │
│ {                                                                           │
│   extra_steps: [{ pattern_type:"confirmation", ... }],                      │
│   ux_recommendations: [{ target:"email_input", recommendation:"..." }]      │
│ }                                                                           │
│                                                                             │
│ BANCO: (não salva, passa adiante)                                           │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ ETAPA 6: Page Mapper (CÓDIGO)                                               │
│                                                                             │
│ OUTPUT: PageContext                                                         │
│ {                                                                           │
│   pages: [login, recovery, dashboard, error],                               │
│   transitions: [{from:"recovery", to:"dashboard", reason:"success"}],       │
│   entry_page: "recovery"                                                    │
│ }                                                                           │
│                                                                             │
│ BANCO: (não salva, passa adiante)                                           │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ ETAPA 7-9: Subrules Decomposer                                              │
│                                                                             │
│ INPUT: master_rule + journey + enriched + page_context                      │
│                                                                             │
│ OUTPUT: RichNode[]                                                          │
│ [                                                                           │
│   { id:"start_recovery", type:"trigger", page_key:"recovery", ... },        │
│   { id:"input_email", type:"action", inputs:[{name:"email"}], ... },        │
│   { id:"validate_email", type:"condition", next_on_failure:"end_error" },   │
│   { id:"send_email", type:"action", ... },                                  │
│   { id:"end_success", type:"end", end_status:"success" },                   │
│   { id:"end_error", type:"end", end_status:"error" }                        │
│ ]                                                                           │
│                                                                             │
│ BANCO: rules (rule_type: node_rule) - 1 por nó                              │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ ETAPA 10-12: Flow Generator (CÓDIGO)                                        │
│                                                                             │
│ PIPELINE:                                                                   │
│ 1. buildGraph() - criar estrutura                                           │
│ 2. assignOrderIndex() - BFS para ordem                                      │
│ 3. assignLayout() - calcular X/Y                                            │
│ 4. validateGraph() - verificar consistência                                 │
│                                                                             │
│ OUTPUT: EngineGraph                                                         │
│ {                                                                           │
│   nodes: [                                                                  │
│     { id:"uuid1", symbolic_id:"start_recovery", position_x:100, y:300 },    │
│     { id:"uuid2", symbolic_id:"input_email", position_x:380, y:300 },       │
│     ...                                                                     │
│   ],                                                                        │
│   edges: [                                                                  │
│     { source:"uuid1", target:"uuid2", type:"success" },                     │
│     { source:"uuid3", target:"uuid5", type:"failure", label:"Não" },        │
│     ...                                                                     │
│   ]                                                                         │
│ }                                                                           │
│                                                                             │
│ BANCO: flows, nodes, connections                                            │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ OUTPUT FINAL                                                                │
│                                                                             │
│ {                                                                           │
│   success: true,                                                            │
│   flow_id: 42,                                                              │
│   master_rule_id: 123,                                                      │
│   journey_id: 15,                                                           │
│   sub_rule_ids: [124, 125, 126, 127, 128, 129],                            │
│   summary: {                                                                │
│     total_nodes: 6,                                                         │
│     total_connections: 6,                                                   │
│     pages_mapped: 4                                                         │
│   }                                                                         │
│ }                                                                           │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 9.2 Conversão para ReactFlow

```typescript
// lib/supabase/flows.ts - convertSavedFlowToReactFlow()

export function convertSavedFlowToReactFlow(savedFlow: SavedFlow): {
  nodes: ReactFlowNode[];
  edges: ReactFlowEdge[];
} {
  const nodes = savedFlow.nodes.map(node => {
    // CRÍTICO: Usar v3_type do metadata se disponível
    const reactFlowType = node.metadata?.v3_type || node.type || mapLegacyType(node.type);
    
    return {
      id: String(node.id),
      type: reactFlowType,
      position: { x: node.position_x, y: node.position_y },
      data: {
        title: node.title,
        description: node.description,
        ...addTypeSpecificData(node, reactFlowType),
      },
    };
  });
  
  const edges = savedFlow.connections.map(conn => ({
    id: String(conn.id),
    source: String(conn.source_node_id),
    target: String(conn.target_node_id),
    label: conn.label,
    type: 'smoothstep',
    style: conn.label === 'Não' ? { stroke: '#ef4444' } : undefined,
  }));
  
  return { nodes, edges };
}

function mapLegacyType(type: string): string {
  const mapping: Record<string, string> = {
    'input': 'form',
    'decision': 'choice',
    'process': 'action',
    // ... outros mapeamentos
  };
  return mapping[type] || type;
}
```

---

## 10. Referência de Arquivos

### 10.1 Estrutura de Diretórios

```
lib/
├── agents/
│   ├── index.ts                 # Exports centralizados v3.0
│   ├── orchestrator.ts          # Orquestrador v3.0
│   ├── types.ts                 # Tipos compartilhados
│   ├── master-rule-creator.ts   # Agente 1
│   ├── journey-features-creator.ts # Agente 2
│   ├── flow-enricher.ts         # Agente 3
│   ├── page-mapper.ts           # Agente 4 (código)
│   ├── subrules-decomposer.ts   # Agente 5
│   ├── flow-generator.ts        # Agente 6 (código)
│   └── v3/
│       ├── index.ts             # Exports v3.1
│       ├── orchestrator-v3.ts   # Orquestrador v3.1
│       ├── types.ts             # Tipos v3.1
│       ├── product-role-mapper.ts
│       ├── flow-synthesizer.ts
│       ├── archetype-modeler.ts
│       ├── flow-critic.ts
│       ├── ux-block-composer-v3.ts
│       └── flow-connector.ts
├── engine/
│   ├── index.ts                 # Pipeline completo
│   ├── buildGraph.ts            # Construir estrutura
│   ├── assignOrderIndex.ts      # BFS para ordem
│   ├── assignLayout.ts          # Calcular posições
│   └── validateGraph.ts         # Validação
├── schemas/
│   ├── index.ts
│   ├── masterRuleSchema.ts      # Zod para Master Rule
│   ├── subrulesSchema.ts        # Zod para Subrules
│   ├── journeySchema.ts         # Zod para Journey
│   └── engineGraphSchema.ts     # Zod para EngineGraph
└── supabase/
    ├── client.ts                # Cliente Supabase
    └── flows.ts                 # CRUD de flows

supabase/functions/
├── master-rule-creator/
│   └── index.ts
├── journey-features-creator/
│   └── index.ts
├── flow-enricher/
│   └── index.ts
├── subrules-decomposer/
│   └── index.ts
├── flow-generator/
│   └── index.ts
├── v3-product-role-mapper/
│   └── index.ts
├── v3-flow-synthesizer/
│   └── index.ts
├── v3-archetype-modeler/
│   └── index.ts
├── v3-flow-critic/
│   └── index.ts
├── v3-ux-block-composer-v3/
│   └── index.ts
└── v3-flow-connector/
    └── index.ts
```

### 10.2 Componentes Visuais (React)

```
components/flow/
├── FlowEditor.tsx               # Editor principal
├── nodes/
│   ├── index.ts                 # Exports de nós
│   ├── TriggerNode.tsx          # Nó de início
│   ├── ActionNode.tsx           # Nó de ação
│   ├── ConditionNode.tsx        # Nó de condição
│   ├── EndNode.tsx              # Nó de fim
│   ├── SubflowNode.tsx          # Referência a subfluxo
│   └── v3/
│       ├── FormNode.tsx         # Formulário v3
│       ├── ChoiceNode.tsx       # Escolha v3
│       ├── ValidationNode.tsx   # Validação v3
│       ├── NotificationNode.tsx # Notificação v3
│       └── ...
├── AIPrompt.tsx                 # Input do prompt
├── AILoadingOverlay.tsx         # Overlay de loading
└── ZoomControls.tsx             # Controles de zoom
```

---

## Conclusão

Esta documentação cobre:

1. **Duas arquiteturas paralelas** (v3.0 e v3.1)
2. **12 etapas do pipeline v3.0** detalhadas
3. **6 agentes v3.1** com interfaces completas
4. **Engine determinística** com BFS e layout
5. **Schemas Zod** para validação
6. **Banco de dados** com estrutura completa
7. **Edge Functions** com exemplos
8. **Fluxo de dados** end-to-end

Para dúvidas ou atualizações, consulte o código-fonte nos arquivos referenciados.

---

*Documentação técnica v3.2 - Dezembro 2024*








