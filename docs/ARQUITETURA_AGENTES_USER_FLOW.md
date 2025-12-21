# 📐 Arquitetura Completa do Sistema de Agentes - Criação de User Flow

> **Versão:** 3.1  
> **Última Atualização:** Dezembro 2024  
> **Autor:** Equipe Técnica Oria

---

## 📋 Índice

1. [Visão Geral da Arquitetura](#1-visão-geral-da-arquitetura)
2. [Pipeline de Criação (12 Etapas)](#2-pipeline-de-criação-12-etapas)
3. [Agentes Detalhados](#3-agentes-detalhados)
   - [3.1 Master Rule Creator](#31-master-rule-creator)
   - [3.2 Journey Features Creator](#32-journey-features-creator)
   - [3.3 Flow Enricher](#33-flow-enricher)
   - [3.4 Page Mapper](#34-page-mapper)
   - [3.5 Subrules Decomposer](#35-subrules-decomposer)
   - [3.6 Flow Generator](#36-flow-generator)
   - [3.7 Flow Validator](#37-flow-validator)
   - [3.8 UX Block Composer](#38-ux-block-composer)
4. [Orquestrador](#4-orquestrador)
5. [Schemas Zod](#5-schemas-zod)
6. [Banco de Dados (Supabase)](#6-banco-de-dados-supabase)
7. [Tipos e Interfaces](#7-tipos-e-interfaces)
8. [Fluxo de Dados](#8-fluxo-de-dados)
9. [Validações e Autofix](#9-validações-e-autofix)

---

## 1. Visão Geral da Arquitetura

### 1.1 Filosofia de Separação

A arquitetura segue uma filosofia clara de separação de responsabilidades:

| Responsabilidade | Quem Executa | Exemplos |
|------------------|--------------|----------|
| **Semântica de Negócio** | LLM (IA) | Regras, fluxos, intenções, UX |
| **Estrutura e Layout** | Código (Determinístico) | IDs, posições X/Y, edges, order_index |
| **Validação** | Zod + Código | Schemas, grafo, referências |

### 1.2 Diagrama da Pipeline v3.0

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           USER PROMPT                                        │
│                 "Crie um fluxo de login e cadastro"                          │
└─────────────────────────┬───────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  ETAPA 1: MASTER RULE CREATOR (LLM - GPT-4 Turbo)                           │
│  ├── Gera: business_goal, context, actors, assumptions                       │
│  ├── Gera: main_flow, alternative_flows, error_flows                         │
│  └── NOVO v2.0: pages_involved (páginas do fluxo)                            │
│  → Validação Zod: MasterRuleSchema                                           │
└─────────────────────────┬───────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  ETAPA 2: JOURNEY FEATURES CREATOR (LLM - GPT-4o-mini)                       │
│  ├── Gera: steps (com page_key), decisions, failure_points, motivations      │
│  ├── Gera: suggested_features                                                │
│  └── NOVO v2.1: journey_structured (objetos com step_id, page_key)           │
│  → Validação Zod: JourneySchema / JourneyStructuredSchema                    │
└─────────────────────────┬───────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  ETAPA 3: FLOW ENRICHER (LLM - GPT-4o-mini) [NOVO v3.0]                      │
│  ├── Gera: extra_steps (passos adicionais SaaS)                              │
│  ├── Gera: extra_decisions, extra_failure_points                             │
│  ├── Gera: ux_recommendations                                                │
│  └── Gera: patterns_applied (ex: password_recovery_flow)                     │
│  → Validação Zod: FlowEnricherResponseSchema                                 │
└─────────────────────────┬───────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  ETAPA 4: PAGE MAPPER (100% CÓDIGO) [NOVO v3.0]                              │
│  ├── Cria: PageContext com páginas e transições                              │
│  ├── Detecta: tipo de fluxo (auth, signup, checkout, etc.)                   │
│  └── Infere: transições padrão SaaS                                          │
│  → Validação: validatePageContext()                                          │
└─────────────────────────┬───────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  ETAPA 5: SUBRULES DECOMPOSER (LLM - GPT-4o)                                 │
│  ├── Recebe: MasterRule + Journey + EnrichedFlow + PageContext               │
│  ├── Gera: RichNodes (nós simbólicos com semântica rica)                     │
│  │   ├── id, type, title, description                                        │
│  │   ├── next_on_success, next_on_failure                                    │
│  │   ├── page_key, user_intent, system_behavior                              │
│  │   ├── inputs (campos de formulário)                                       │
│  │   └── error_cases, allows_retry, allows_cancel                            │
│  └── Inclui: Mini-validador incremental + Autofix                            │
│  → Validação Zod: RichSubrulesResponseSchema                                 │
│  → Validação Grafo: validateSubrulesGraph()                                  │
└─────────────────────────┬───────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  ETAPA 6: FLOW GENERATOR (100% CÓDIGO DETERMINÍSTICO)                        │
│  ├── Recebe: symbolic_nodes                                                  │
│  ├── Engine: buildGraph → assignOrderIndex → assignLayout → validateGraph    │
│  ├── Gera: EngineNodes com position_x, position_y, order_index               │
│  ├── Gera: EngineEdges com source, target, label, type                       │
│  └── Salva: Flow, Nodes, Connections no Supabase                             │
│  → Validação: validateGraph()                                                │
└─────────────────────────┬───────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  ETAPA 7: VALIDAÇÃO SAAS [NOVO v3.0]                                         │
│  ├── validateSaaSFlow() - Verifica padrões SaaS                              │
│  ├── Score de qualidade (0-100)                                              │
│  └── Sugestões de melhoria                                                   │
└─────────────────────────┬───────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           RESULTADO FINAL                                    │
│  ├── flow_id, master_rule_id, sub_rule_ids, journey_id                       │
│  ├── generated_flow (nodes, connections)                                     │
│  ├── page_context (páginas e transições)                                     │
│  ├── saas_validation (score, warnings, suggestions)                          │
│  └── summary (estatísticas, tempo de execução)                               │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Pipeline de Criação (12 Etapas)

### Etapas Detalhadas do Orquestrador

| # | Etapa | Tipo | Descrição |
|---|-------|------|-----------|
| 1 | Criar Master Rule | LLM | Gera regra de negócio com `pages_involved` |
| 2 | Validar Master Rule | Zod | Schema `MasterRuleSchema` |
| 3 | Criar Jornada | LLM | Gera journey com `page_key` |
| 4 | Validar Jornada | Zod | Schema `JourneySchema` / `JourneyStructuredSchema` |
| 5 | Enriquecer Fluxo | LLM | Aplica padrões SaaS (NOVO v3.0) |
| 6 | Mapear Páginas | CÓDIGO | Cria `PageContext` (NOVO v3.0) |
| 7 | Criar Subrules | LLM | Gera `RichNodes` com todos os contextos |
| 8 | Validar Subrules | Zod + Grafo | Validação incremental + SaaS |
| 9 | Autofix | LLM | Corrige erros automaticamente se necessário |
| 10 | Gerar Flow | CÓDIGO | Engine determinística |
| 11 | Validar Grafo Final | CÓDIGO | `validateGraph()` + `validateSaaSFlow()` |
| 12 | Retornar Resultado | - | Flow + Journey + Features + Pages + Warnings |

---

## 3. Agentes Detalhados

### 3.1 Master Rule Creator

**Arquivo Local:** `lib/agents/master-rule-creator.ts`  
**Edge Function:** `supabase/functions/master-rule-creator/index.ts`  
**Modelo LLM:** GPT-4 Turbo Preview  
**Temperatura:** 0.3 (determinístico)

#### Responsabilidade

Gera a **especificação semântica** de regras de negócio. NÃO cria estrutura técnica.

#### O que FAZ ✅

- Identificar objetivo de negócio (`business_goal`)
- Descrever contexto/cenário (`context`)
- Listar atores (`actors`)
- Definir premissas (`assumptions`)
- Descrever fluxo principal (`main_flow`) - mínimo 5 passos
- Identificar fluxos alternativos (`alternative_flows`)
- Identificar casos de erro (`error_flows`)
- **NOVO v2.0:** Identificar páginas envolvidas (`pages_involved`)

#### O que NÃO FAZ ❌

- Criar IDs de nós
- Definir tipos de nós (trigger, action, etc.)
- Criar índices ou `order_index`
- Definir posições X/Y
- Criar conexões ou edges
- Descrever detalhes visuais

#### Prompt do Sistema (Resumo)

```markdown
Você é um especialista em análise de processos de produtos digitais (principalmente SaaS).

## SEU PAPEL
Sua função é criar uma especificação SEMÂNTICA de regras de negócio, incluindo as PÁGINAS ENVOLVIDAS.

## SOBRE PÁGINAS (pages_involved)
Tipos de páginas comuns:
- auth, login, signup, recovery, onboarding, dashboard, settings, checkout, profile, etc.

Para cada página, defina:
- page_key: slug em snake_case
- label: nome amigável
- path: sugestão de URL
- description: papel da página
- page_type: tipo da página

## FORMATO DE SAÍDA
{
  "business_goal": "...",
  "context": "...",
  "actors": [...],
  "assumptions": [...],
  "main_flow": [...],
  "alternative_flows": [...],
  "error_flows": [...],
  "pages_involved": [
    { "page_key": "login", "label": "Página de Login", "path": "/login", "page_type": "login" }
  ]
}
```

#### Schema Zod

```typescript
const MasterRuleSchema = z.object({
  business_goal: z.string().min(10),
  context: z.string().min(10),
  actors: z.array(z.string()).min(1),
  assumptions: z.array(z.string()),
  main_flow: z.array(z.string()).min(3),
  alternative_flows: z.array(z.string()),
  error_flows: z.array(z.string()),
  pages_involved: z.array(PageDefinitionSchema).optional().default([]),
});

const PageDefinitionSchema = z.object({
  page_key: z.string().min(1).regex(/^[a-z0-9_]+$/),
  label: z.string().min(3),
  path: z.string().optional(),
  description: z.string().optional(),
  page_type: z.enum(["auth", "login", "signup", "recovery", "onboarding", 
    "dashboard", "settings", "checkout", "profile", "list", "detail", 
    "form", "confirmation", "error", "success", "other"]).optional().default("other"),
});
```

---

### 3.2 Journey Features Creator

**Arquivo Local:** `lib/agents/journey-features-creator.ts`  
**Edge Function:** `supabase/functions/journey-features-creator/index.ts`  
**Modelo LLM:** GPT-4o-mini  
**Temperatura:** 0.4 (balanceado)

#### Responsabilidade

Cria a **jornada do usuário narrativa** que será combinada com a Master Rule para gerar nós.

#### O que FAZ ✅

- Criar etapas narrativas (`steps`) - mínimo 5 com `page_key`
- Identificar pontos de decisão (`decisions`) com `page_key`
- Identificar pontos de falha (`failure_points`) com `page_key`
- Descrever motivações do usuário (`motivations`)
- Sugerir features (`suggested_features`)
- **NOVO v2.1:** Gerar `journey_structured` com objetos completos
- **NOVO v2.1:** Gerar `page_context` (transições entre páginas)

#### Prompt do Sistema (Resumo)

```markdown
Você é um especialista em criação de JORNADAS DO USUÁRIO narrativas.

## SEU PAPEL
Criar uma jornada do usuário que será COMBINADA com uma Regra de Negócio para gerar um fluxo.

## CAMADAS
1. INTENÇÕES DO USUÁRIO (steps) - com step_id, description, page_key, user_intent
2. PONTOS DE DECISÃO (decisions) - com decision_id, description, page_key, options
3. PONTOS DE FALHA (failure_points) - com failure_id, description, page_key, recovery

## PÁGINAS COMUNS (page_key)
auth, login, signup, recovery, onboarding, dashboard, settings, checkout, etc.

## FORMATO DE SAÍDA
{
  "journey": {
    "steps": [
      { "step_id": "user_arrives_auth", "description": "...", "page_key": "auth", "user_intent": "..." }
    ],
    "decisions": [...],
    "failure_points": [...],
    "motivations": [...]
  },
  "suggested_features": [...],
  "analysis": { "total_steps": 5, "decision_points": 3, "complexity": "medium" }
}
```

#### Schemas Zod

```typescript
const JourneyStepStructuredSchema = z.object({
  step_id: z.string().optional(),
  description: z.string().min(5),
  page_key: z.string().optional(),
  user_intent: z.string().optional(),
  system_reaction: z.string().optional(),
});

const JourneyStructuredSchema = z.object({
  steps: z.array(JourneyStepStructuredSchema).min(3),
  decisions: z.array(DecisionStructuredSchema),
  failure_points: z.array(FailurePointStructuredSchema),
  motivations: z.array(z.string()),
});
```

---

### 3.3 Flow Enricher

**Arquivo Local:** `lib/agents/flow-enricher.ts`  
**Edge Function:** `supabase/functions/flow-enricher/index.ts`  
**Modelo LLM:** GPT-4o-mini  
**Temperatura:** 0.4

#### Responsabilidade

Enriquece o fluxo com **padrões universais de UX de SaaS** antes da decomposição.

#### O que FAZ ✅

- Identificar passos importantes faltando (`extra_steps`)
- Sugerir microfluxos padrão (recuperar senha, retry, etc.)
- Adicionar validações e confirmações (`extra_decisions`)
- Identificar pontos de abandono (`extra_failure_points`)
- Fornecer recomendações de UX (`ux_recommendations`)
- Listar padrões aplicados (`patterns_applied`)

#### Padrões SaaS Aplicados

| Contexto | Padrão |
|----------|--------|
| Login | Sempre oferecer "Esqueci minha senha" |
| Cadastro | Redirect para onboarding + confirmação de email |
| Checkout | Confirmação antes de pagamento + retry em falha |
| Onboarding | Opção de pular |
| Formulários | Validação em tempo real |
| Loading | Feedback visual + possibilidade de cancelar |

#### Prompt do Sistema (Resumo)

```markdown
Você é um especialista em Product Design e UX em SaaS.

## SEU PAPEL
Receber MasterRule + Journey e ENRIQUECER com padrões universais de UX.
Você NÃO cria nós. Você SUGERE enriquecimentos.

## PADRÕES SaaS COMUNS
1. Autenticação: recuperar senha, login social
2. Formulários: validação em tempo real, retry
3. Onboarding: permitir pular, mostrar progresso
4. Estados de Loading: feedback visual, cancelar
5. Tratamento de Erros: mensagens claras, retry automático
6. Sucesso: confirmar ação, próximos passos

## FORMATO DE SAÍDA
{
  "extra_steps": [{ "step_id": "...", "description": "...", "page_key": "...", "pattern_type": "..." }],
  "extra_decisions": [...],
  "extra_failure_points": [...],
  "ux_recommendations": [{ "target": "...", "recommendation": "...", "priority": "high" }],
  "patterns_applied": ["password_recovery_flow", "form_validation_realtime"]
}
```

#### Schema Zod

```typescript
const FlowEnricherResponseSchema = z.object({
  extra_steps: z.array(ExtraStepSchema),
  extra_decisions: z.array(ExtraDecisionSchema),
  extra_failure_points: z.array(ExtraFailurePointSchema),
  ux_recommendations: z.array(UxRecommendationSchema).optional(),
  notes: z.array(z.string()).optional(),
  patterns_applied: z.array(z.string()).optional(),
});

const ExtraStepSchema = z.object({
  step_id: z.string(),
  description: z.string(),
  page_key: z.string().optional(),
  after_step: z.string().optional(),
  reason: z.string(),
  is_optional: z.boolean().default(false),
  pattern_type: z.enum([
    "confirmation", "validation", "recovery", "retry", "cancel",
    "skip", "loading", "success_feedback", "error_feedback", 
    "redirect", "onboarding_step", "other"
  ]).optional(),
});
```

---

### 3.4 Page Mapper

**Arquivo Local:** `lib/agents/page-mapper.ts`  
**Tipo:** 100% Código Determinístico (NÃO usa LLM)

#### Responsabilidade

Mapeia páginas e transições a partir dos dados da Master Rule e Journey.

#### Funções Principais

```typescript
// Cria o PageContext completo
function createPageContext(
  pagesInvolved: PageDefinition[],
  journeyStructured?: JourneyStructured,
  journey?: Journey,
  enrichedFlow?: EnrichedFlow
): PageContext

// Infere transições padrão por tipo de fluxo
function inferStandardTransitions(
  flowType: "auth" | "signup" | "checkout" | "onboarding" | "crud" | "other",
  existingPages: string[]
): PageTransition[]

// Detecta tipo de fluxo pelas páginas
function detectFlowType(pages: string[]): FlowType

// Valida o contexto de páginas
function validatePageContext(context: PageContext): ValidationResult
```

#### Transições Padrão por Tipo de Fluxo

| Tipo | Transições Inferidas |
|------|---------------------|
| auth | auth → login, auth → signup, login → dashboard, login → recovery |
| signup | signup → onboarding, onboarding → dashboard |
| checkout | checkout → confirmation, checkout → error |

---

### 3.5 Subrules Decomposer

**Arquivo Local:** `lib/agents/subrules-decomposer.ts`  
**Edge Function:** `supabase/functions/subrules-decomposer/index.ts`  
**Modelo LLM:** GPT-4o  
**Temperatura:** 0.2 (mais determinístico)

#### Responsabilidade

Recebe **4 documentos** e os mescla para criar **RichNodes** (nós simbólicos ricos).

#### Documentos de Entrada

1. **Master Rule** - Regras de negócio + páginas
2. **Journey** - Jornada do usuário + page_key
3. **Enriched Flow** (opcional) - Enriquecimentos SaaS
4. **Page Context** (opcional) - Transições de páginas

#### O que o LLM DECIDE ✅

- `id` (slug único em snake_case)
- `type` (trigger | action | condition | end | subflow)
- `title`, `description`
- `next_on_success`, `next_on_failure` (IDs simbólicos)
- `end_status` (success | error | cancel)
- `flow_category` (main | error | alternative)
- **NOVOS v3.0:**
  - `page_key` - página onde o nó acontece
  - `user_intent` - o que o usuário quer
  - `system_behavior` - o que o sistema faz
  - `ux_recommendation` - dica de UX
  - `inputs` - campos de formulário
  - `error_cases` - erros esperados
  - `allows_retry`, `allows_cancel`

#### O que o MOTOR (código) DECIDE ❌

- `order_index`
- `position_x`, `position_y`
- Edges reais
- Labels de edges
- Layout visual

#### Prompt do Sistema (Resumo)

```markdown
Você é um engenheiro de automação de fluxos especializado em SaaS.

## VOCÊ RECEBERÁ ATÉ 4 DOCUMENTOS:
1. REGRA DE NEGÓCIO (Master Rule) - com pages_involved
2. JORNADA DO USUÁRIO (Journey) - com page_key
3. ENRIQUECIMENTOS (Flow Enricher) - passos extras, recomendações
4. CONTEXTO DE PÁGINAS (PageContext) - transições

## SUA TAREFA
Gerar uma lista de NÓS RICOS (RichNodes) que representem o fluxo completo.

## REGRAS CRÍTICAS
1. EXATAMENTE 1 TRIGGER
2. PELO MENOS 1 END SUCCESS
3. CONDITIONS TÊM 2 CAMINHOS (next_on_success + next_on_failure)
4. END NODES SÃO TERMINAIS (sem next_*)
5. IDs SÃO SLUGS ÚNICOS (snake_case)
6. SEM CICLOS INFINITOS

## PADRÕES SAAS OBRIGATÓRIOS
- LOGIN: email + password inputs, condição de validação, link recuperar senha
- SIGNUP: inputs completos, validação, destino onboarding/dashboard
- ONBOARDING: opção de pular (allows_cancel = true)

## FORMATO DE SAÍDA
{
  "nodes": [
    {
      "id": "start_auth",
      "type": "trigger",
      "title": "Início da Autenticação",
      "description": "...",
      "page_key": "auth",
      "user_intent": "Acessar o sistema",
      "system_behavior": "Exibir opções",
      "next_on_success": "choose_auth_method",
      "flow_category": "main"
    },
    {
      "id": "fill_login_form",
      "type": "action",
      "title": "Preencher Login",
      "page_key": "login",
      "inputs": [
        { "name": "email", "type": "email", "required": true, "validation": ["required", "valid_email"] },
        { "name": "password", "type": "password", "required": true, "validation": ["required", "min_length:6"] }
      ],
      "error_cases": ["Email não cadastrado", "Senha incorreta"],
      "allows_retry": true,
      "next_on_success": "validate_credentials",
      "flow_category": "main"
    }
  ]
}
```

#### Schema Zod (RichNode)

```typescript
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

const FormInputSchema = z.object({
  name: z.string().min(1),
  type: z.enum(["text", "email", "password", "number", "tel", "date", "select", "checkbox", "radio", "textarea", "file"]),
  label: z.string().optional(),
  placeholder: z.string().optional(),
  required: z.boolean().optional().default(false),
  validation: z.array(z.string()).optional(),
  options: z.array(z.object({ value: z.string(), label: z.string() })).optional(),
});
```

#### Validação de Grafo

A Edge Function inclui um **mini-validador incremental** antes de retornar:

```typescript
function validateGraphIncremental(nodes: SubRuleNode[]): {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
}
```

**Regras Validadas:**
1. Exatamente 1 trigger
2. Pelo menos 1 end com status success
3. Todas as referências (`next_on_*`) apontam para IDs existentes
4. Conditions têm 2 caminhos
5. End nodes não têm conexões de saída
6. End nodes têm `end_status` definido
7. Nós não-end têm pelo menos uma saída
8. Detecção de ciclos (DFS)

#### Autofix Pass

Se a validação falhar, a Edge Function tenta corrigir automaticamente:

```typescript
const autofixPrompt = `Corrija o mapa de nós abaixo com base nos erros detectados.
NÃO reescreva do zero. Apenas ajuste o necessário.

## ERROS DETECTADOS
${errorReport}

## INSTRUÇÕES DE CORREÇÃO
1. Se falta trigger: adicione um trigger no início
2. Se falta end success: adicione um end_success no final
3. Se condition não tem failure: adicione next_on_failure
4. Se referência inválida: corrija o id
5. Se end tem next_*: remova as conexões
6. Se ciclo detectado: quebre direcionando para um end

RETORNE APENAS O JSON CORRIGIDO`;
```

---

### 3.6 Flow Generator

**Arquivo Local:** `lib/agents/flow-generator.ts`  
**Edge Function:** `supabase/functions/flow-generator/index.ts`  
**Tipo:** 100% Código Determinístico (NÃO usa LLM)

#### Responsabilidade

Transforma nós simbólicos em um **grafo visual conectado** e salva no banco.

#### Pipeline da Engine

```
symbolic_nodes
      │
      ▼
┌─────────────────────┐
│   normalizeNodes()  │  Garante trigger e end
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│    buildGraph()     │  Cria EngineNodes e EngineEdges
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  buildEdgesAlways() │  Garante conexões (explícitas + sequenciais)
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│   validateGraph()   │  Valida estrutura final
└──────────┬──────────┘
           │
           ▼
       Salva no DB
  (flows, nodes, connections)
```

#### Configuração de Layout

```typescript
const DEFAULT_LAYOUT_CONFIG: LayoutConfig = {
  nodeSpacingX: 280,         // Espaçamento horizontal
  nodeSpacingY: 180,         // Espaçamento vertical
  startX: 100,               // Posição X inicial
  startY: 300,               // Posição Y inicial (caminho principal)
  errorPathYOffset: 200,     // Offset Y para caminhos de erro
};
```

#### Estrutura dos Nós Gerados

```typescript
interface EngineNode {
  id: string;               // "node_1", "node_2", etc.
  symbolic_id: string;      // ID original do LLM
  type: string;             // trigger, action, condition, end, subflow
  title: string;
  description: string;
  order_index: number;      // Ordem no fluxo (BFS)
  position_x: number;       // Posição X calculada
  position_y: number;       // Posição Y calculada
  column: "main" | "error" | "alternative";
  depth: number;            // Profundidade no grafo
  end_status?: "success" | "error";
}
```

#### Estrutura das Edges Geradas

```typescript
interface EngineEdge {
  id: string;               // "edge_1", "edge_2", etc.
  source: string;           // ID do nó origem
  target: string;           // ID do nó destino
  type: "success" | "failure" | "default";
  label?: string;           // "Sim", "Não", etc.
  animated: boolean;
  style?: {
    stroke?: string;
    strokeDasharray?: string;
  };
}
```

---

### 3.7 Flow Validator

**Arquivo Local:** `lib/agents/flow-validator.ts`  
**Tipo:** 100% Código Determinístico

#### Responsabilidade

Valida a **estrutura do grafo** e garante conformidade com a gramática do User Flow.

#### Gramática do User Flow

| Tipo de Nó | Saídas Válidas | Entradas Válidas |
|------------|----------------|------------------|
| trigger | action, condition, field_group, subflow | - (nenhuma) |
| action | action, condition, end, subflow | trigger, action, condition, field_group, subflow |
| condition | action, condition, subflow, end | trigger, action, field_group, subflow |
| end | - (terminal) | action, condition, subflow |
| text | qualquer (visual) | - (nenhuma formal) |

#### Validações Realizadas

```typescript
function validateFlow(nodes, connections): ValidationResult {
  // 1. Exatamente 1 trigger
  validateTriggers(nodes, issues);
  
  // 2. Pelo menos 1 end success (máximo 1)
  validateEnds(nodes, issues);
  
  // 3. Conditions têm 2 saídas (sim/não)
  validateConditions(nodes, connections, issues);
  
  // 4. Actions têm saída
  validateActions(nodes, connections, issues);
  
  // 5. Nós não-trigger têm entrada
  validateOrphanNodes(nodes, connections, issues);
  
  // 6. Nós não-end têm saída
  validateDisconnectedNodes(nodes, connections, issues);
  
  // 7. Caminho navegável do trigger ao end
  validateFlowNavigation(nodes, connections, issues);
  
  // 8. Subflows têm target_flow_id e saída
  validateSubflows(nodes, connections, issues);
}
```

#### Score de Qualidade

```typescript
function calculateScore(issues, stats): number {
  let score = 100;
  
  // Penalidades
  for (const issue of issues) {
    switch (issue.severity) {
      case "error": score -= 15; break;
      case "warning": score -= 5; break;
      case "info": break; // Não penaliza
    }
  }
  
  // Bônus por boas práticas
  if (stats.triggers === 1) score += 5;
  if (stats.endSuccess === 1) score += 5;
  if (stats.conditions > 0) score += 3;
  if (stats.disconnectedNodes === 0) score += 5;
  if (stats.orphanNodes === 0) score += 5;
  
  return Math.max(0, Math.min(100, score));
}
```

#### Auto-Correção

```typescript
function autoFixFlow(nodes, connections): AutoFixResult {
  // 1. Adicionar Trigger se não existir
  if (triggers.length === 0) {
    nodes.unshift({ type: "trigger", title: "Início do Fluxo", ... });
  }
  
  // 2. Adicionar End de sucesso se não existir
  if (successEnds.length === 0) {
    nodes.push({ type: "end", status: "success", title: "Fluxo Concluído", ... });
  }
  
  // 3. Converter múltiplos End de sucesso em erro
  if (successEnds.length > 1) {
    for (let i = 0; i < successEnds.length - 1; i++) {
      successEnds[i].status = "error";
    }
  }
  
  return { fixed: true, nodes, connections, fixesApplied };
}
```

---

### 3.8 UX Block Composer

**Arquivo Local:** `lib/agents/ux-block-composer.ts`  
**Edge Function:** `supabase/functions/v3-ux-block-composer/index.ts`  
**Tipo:** Híbrido (Consulta DB + LLM para adaptação)

#### Responsabilidade

Consulta a **biblioteca de blocos UX** e adapta blocos relevantes para o contexto do usuário.

#### Fluxo

1. Recebe contexto (master rule, journey, use cases)
2. Busca blocos na tabela `ux_blocks` (Supabase)
3. Usa IA para selecionar e adaptar blocos
4. Retorna blocos adaptados prontos para uso

#### Interface

```typescript
interface UXBlockComposerRequest {
  project_id: number;
  user_id: number;
  context: {
    master_rule_id?: number;
    master_rule_content?: any;
    journey?: any;
    use_cases?: string[];
    business_type?: string;
    target_features?: string[];
  };
  search_query?: string;
  max_blocks?: number;
}

interface AdaptedUXBlock {
  block_id: string;
  block_label: string;
  relevance_score?: number;
  adapted_semantic_flow: any;
  adaptation_notes?: string;
}
```

---

## 4. Orquestrador

**Arquivo:** `lib/agents/orchestrator.ts`

### Função Principal

```typescript
async function createCompleteFlowWithAgents(
  request: FullFlowCreationRequest,
  onProgress?: ProgressCallback
): Promise<FullFlowCreationResponse>
```

### Request

```typescript
interface FullFlowCreationRequest {
  prompt: string;
  project_id: number;
  user_id: number;
  options?: {
    decomposition_depth?: "shallow" | "normal" | "deep";
    include_error_paths?: boolean;
    auto_proceed?: boolean;
    layout_orientation?: "vertical" | "horizontal";
    include_journey?: boolean;  // default: true
    include_enrichment?: boolean;  // default: true (v3.0)
  };
}
```

### Response

```typescript
interface FullFlowCreationResponse {
  success: boolean;
  
  // Resultados de cada agente
  master_rule_result: MasterRuleCreatorResponse;
  decomposition_result: SubrulesDecomposerResponse;
  journey_result?: JourneyFeaturesCreatorResponse;
  flow_result: FlowGeneratorResponse;
  
  // NOVO v3.0
  enricher_result?: FlowEnricherResult;
  page_context?: PageContextResult;
  saas_validation?: SaaSValidationResult;
  
  // IDs finais
  master_rule_id: number;
  sub_rule_ids: number[];
  journey_id?: number;
  flow_id: number;
  
  // Resumo
  summary: {
    total_rules_created: number;
    total_nodes_created: number;
    total_connections_created: number;
    total_features_identified?: number;
    total_pages_mapped?: number;
    total_transitions?: number;
    saas_score?: number;
    enrichments_applied?: number;
    execution_time_ms: number;
    warnings?: string[];
  };
}
```

### Normalização de Referências

O orquestrador inclui uma função crítica para normalizar referências numéricas para IDs simbólicos:

```typescript
function normalizeNodeReferences(nodes: any[]): any[] {
  // Criar mapa de índice → ID simbólico
  const idMap = new Map<string, string>();
  
  nodes.forEach((node, idx) => {
    idMap.set(String(idx + 1), nodeId);  // "1" → "start_auth"
    idMap.set(String(node.order_index), nodeId);
    idMap.set(nodeId, nodeId);
  });
  
  // Resolver todas as referências
  return nodes.map(node => ({
    ...node,
    next_on_success: resolveRef(node.next_on_success),
    next_on_failure: resolveRef(node.next_on_failure),
  }));
}
```

### Callback de Progresso

```typescript
type ProgressCallback = (progress: CreationProgress) => void;

interface CreationProgress {
  step: CreationStep;  // "creating_master", "decomposing", "creating_flow", etc.
  message: string;
  percentage?: number;  // 0-100
  details?: {
    master_rule_created?: boolean;
    master_rule_id?: number;
    sub_rules_count?: number;
    nodes_created?: number;
    connections_created?: number;
  };
}
```

---

## 5. Schemas Zod

### Localização dos Schemas

| Schema | Arquivo |
|--------|---------|
| MasterRuleSchema | `lib/schemas/masterRuleSchema.ts` |
| JourneySchema, JourneyStructuredSchema | `lib/schemas/journeySchema.ts` |
| SubRuleNodeSchema, RichNodeSchema | `lib/schemas/subrulesSchema.ts` |
| EngineGraphSchema | `lib/schemas/engineGraphSchema.ts` |

### Validações Principais

```typescript
// Master Rule
validateMasterRule(data: unknown): { success: boolean; data?: MasterRule; errors?: ZodError }

// Journey
validateJourney(data: unknown): { success: boolean; data?: Journey; errors?: ZodError }
validateEnrichedJourney(data: unknown): { success: boolean; data?: EnrichedJourney; errors?: ZodError }

// Subrules
validateSubrules(data: unknown): { success: boolean; data?: SubrulesResponse; errors?: ZodError }
validateRichSubrules(data: unknown): { success: boolean; data?: RichSubrulesResponse; errors?: ZodError }
validateSubrulesGraph(nodes: SubRuleNode[]): GraphValidationResult

// SaaS
validateSaaSFlow(nodes: RichNode[]): SaaSValidationResult

// Engine
validateEngineGraph(data: unknown): { success: boolean; data?: EngineGraph; errors?: ZodError }
```

---

## 6. Banco de Dados (Supabase)

### Tabelas Principais

#### `rules`

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | serial | PK |
| project_id | int | FK para projects |
| flow_id | int | FK para flows (opcional) |
| title | text | Título da regra |
| description | text | Descrição |
| content | text | Conteúdo markdown |
| rule_type | enum | 'global', 'flow_master', 'node_rule' |
| parent_rule_id | int | FK para regra pai (hierarquia) |
| order_index | int | Ordem dentro do fluxo |
| suggested_node_type | text | trigger, action, condition, end, subflow |
| category | text | autenticacao, pagamento, etc. |
| priority | enum | low, medium, high, critical |
| status | enum | draft, active, deprecated, archived |
| metadata | jsonb | Dados extras (semantic_data, page_key, inputs, etc.) |
| acceptance_criteria | text[] | Critérios de aceite |
| edge_cases | text[] | Casos extremos |
| tags | text[] | Tags |

#### `flows`

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | serial | PK |
| project_id | int | FK para projects |
| name | text | Nome do fluxo |
| description | text | Descrição |
| journey_id | int | FK para user_journeys |
| metadata | jsonb | Metadados (validation, source, etc.) |

#### `nodes`

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | serial | PK |
| flow_id | int | FK para flows |
| type | enum | trigger, action, condition, end, subflow, field_group, note |
| title | text | Título do nó |
| description | text | Descrição |
| position_x | float | Posição X no canvas |
| position_y | float | Posição Y no canvas |
| subflow_id | int | FK para outro flow (se type = subflow) |
| metadata | jsonb | symbolic_id, order_index, column, status, page_key, inputs, etc. |

#### `connections`

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | serial | PK |
| flow_id | int | FK para flows |
| source_node_id | int | FK para nodes (origem) |
| target_node_id | int | FK para nodes (destino) |
| label | text | "Sim", "Não", "Sucesso", "Erro", etc. |

#### `user_journeys`

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | serial | PK |
| project_id | int | FK para projects |
| master_rule_id | int | FK para rules (flow_master) |
| name | text | Nome da jornada |
| description | text | Descrição |
| persona | text | Persona alvo |
| goal | text | Objetivo |
| starting_point | text | Ponto de partida |
| ending_point | text | Ponto de chegada |
| steps | jsonb | Array de passos |
| success_metrics | text[] | Métricas de sucesso |
| narrative | text | Narrativa completa |
| metadata | jsonb | journey_v2, journey_structured, page_context |

#### `suggested_features`

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | serial | PK |
| project_id | int | FK para projects |
| journey_id | int | FK para user_journeys |
| master_rule_id | int | FK para rules |
| feature_id | text | ID único da feature |
| name | text | Nome |
| description | text | Descrição |
| type | enum | essential, enhancement, nice_to_have |
| complexity | enum | simple, medium, complex |
| priority | enum | low, medium, high, critical |
| related_journey_steps | int[] | Índices dos passos relacionados |
| user_value | text | Valor para o usuário |
| acceptance_criteria | text[] | Critérios de aceite |

#### `ux_blocks` (Biblioteca de Blocos)

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | text | PK (slug único) |
| label | text | Nome amigável |
| description | text | Descrição |
| archetype | text | Arquétipo do bloco |
| use_cases | text[] | Casos de uso |
| semantic_flow | jsonb | Fluxo semântico do bloco |
| metadata | jsonb | Metadados extras |

---

## 7. Tipos e Interfaces

### Tipos de Nós

```typescript
type SuggestedNodeType = 
  | "trigger"      // Gatilho inicial do fluxo
  | "action"       // Ação executada pelo sistema
  | "condition"    // Condição/decisão com bifurcação
  | "subflow"      // Referência a outro fluxo
  | "field_group"  // Grupo de campos de formulário
  | "end"          // Nó de término do fluxo
  | "text"         // Nó de texto (comentário ou regra)
  | "note";        // Alias para text
```

### Tipos de Status

```typescript
type EndStatus = "success" | "error" | "cancel";
type FlowCategory = "main" | "error" | "alternative";
type RulePriority = "low" | "medium" | "high" | "critical";
type RuleStatus = "draft" | "active" | "deprecated" | "archived";
```

### Tipos de Inputs

```typescript
type InputType = 
  | "text" | "email" | "password" | "number" | "tel" 
  | "date" | "datetime" | "select" | "checkbox" | "radio" 
  | "textarea" | "file" | "hidden";

// Validações comuns
const COMMON_VALIDATIONS = [
  "required",
  "valid_email",
  "min_length:N",
  "max_length:N",
  "matches:field",  // ex: matches:password
  "phone",
  "card_number",
  "card_expiry",
  "cvv"
];
```

### Inputs Padrão por Página

```typescript
const STANDARD_PAGE_INPUTS: Record<string, FormInput[]> = {
  login: [
    { name: "email", type: "email", label: "E-mail", required: true, validation: ["required", "valid_email"] },
    { name: "password", type: "password", label: "Senha", required: true, validation: ["required", "min_length:6"] },
  ],
  signup: [
    { name: "name", type: "text", label: "Nome completo", required: true, validation: ["required", "min_length:3"] },
    { name: "email", type: "email", label: "E-mail", required: true, validation: ["required", "valid_email"] },
    { name: "password", type: "password", label: "Senha", required: true, validation: ["required", "min_length:8", "has_uppercase", "has_number"] },
    { name: "password_confirm", type: "password", label: "Confirmar senha", required: true, validation: ["required", "matches:password"] },
  ],
  recovery: [
    { name: "email", type: "email", label: "E-mail cadastrado", required: true, validation: ["required", "valid_email"] },
  ],
  // ... outros
};
```

---

## 8. Fluxo de Dados

### Diagrama de Fluxo de Dados

```
                    ┌──────────────────────────────────────────────────────────────┐
                    │                        USER PROMPT                            │
                    └────────────────────────────┬─────────────────────────────────┘
                                                 │
                                                 ▼
                    ┌──────────────────────────────────────────────────────────────┐
                    │                     ORCHESTRATOR                              │
                    │                 createCompleteFlowWithAgents()                │
                    └────────────────────────────┬─────────────────────────────────┘
                                                 │
          ┌──────────────────────────────────────┼──────────────────────────────────────┐
          │                                      │                                      │
          ▼                                      ▼                                      │
┌─────────────────────┐              ┌─────────────────────┐                           │
│  MASTER RULE        │              │  JOURNEY CREATOR    │                           │
│  CREATOR            │──────┐       │                     │                           │
│  (LLM - GPT-4)      │      │       │  (LLM - GPT-4o-mini)│                           │
└─────────┬───────────┘      │       └─────────┬───────────┘                           │
          │                  │                 │                                       │
          ▼                  │                 ▼                                       │
┌─────────────────────┐      │       ┌─────────────────────┐                           │
│  MasterRule +       │      │       │  Journey +          │                           │
│  pages_involved     │──────┼──────▶│  journey_structured │                           │
└─────────────────────┘      │       └──────────┬──────────┘                           │
                             │                  │                                      │
                             │       ┌──────────▼──────────┐                           │
                             │       │  FLOW ENRICHER      │                           │
                             │       │  (LLM - GPT-4o-mini)│                           │
                             │       └──────────┬──────────┘                           │
                             │                  │                                      │
                             │       ┌──────────▼──────────┐                           │
                             │       │  EnrichedFlow       │                           │
                             │       │  (extra_steps, etc.)│                           │
                             │       └──────────┬──────────┘                           │
                             │                  │                                      │
                             │       ┌──────────▼──────────┐                           │
                             │       │  PAGE MAPPER        │                           │
                             │       │  (100% CÓDIGO)      │                           │
                             │       └──────────┬──────────┘                           │
                             │                  │                                      │
                             │       ┌──────────▼──────────┐                           │
                             │       │  PageContext        │                           │
                             │       │  (pages, transitions)│                          │
                             │       └──────────┬──────────┘                           │
                             │                  │                                      │
                             ▼                  ▼                                      │
                    ┌──────────────────────────────────────────────────────────────┐   │
                    │              SUBRULES DECOMPOSER                              │   │
                    │              (LLM - GPT-4o)                                    │   │
                    │                                                                │   │
                    │  Inputs: MasterRule + Journey + EnrichedFlow + PageContext    │   │
                    │  Output: RichNodes (nós simbólicos com semântica rica)        │   │
                    └────────────────────────────┬─────────────────────────────────┘   │
                                                 │                                      │
                                                 ▼                                      │
                    ┌──────────────────────────────────────────────────────────────┐   │
                    │                  FLOW GENERATOR                               │   │
                    │                  (100% CÓDIGO)                                 │   │
                    │                                                                │   │
                    │  Engine: buildGraph → assignLayout → buildEdges               │   │
                    │  Output: EngineNodes + EngineEdges                             │   │
                    └────────────────────────────┬─────────────────────────────────┘   │
                                                 │                                      │
                                                 ▼                                      │
                    ┌──────────────────────────────────────────────────────────────┐   │
                    │                     SUPABASE DB                               │◀──┘
                    │                                                                │
                    │  Saves: flows, nodes, connections, rules, user_journeys       │
                    └────────────────────────────┬─────────────────────────────────┘
                                                 │
                                                 ▼
                    ┌──────────────────────────────────────────────────────────────┐
                    │                  RESULTADO FINAL                              │
                    │                                                                │
                    │  - flow_id, master_rule_id, sub_rule_ids, journey_id          │
                    │  - generated_flow (nodes, connections)                         │
                    │  - page_context (pages, transitions)                           │
                    │  - saas_validation (score, warnings, suggestions)             │
                    │  - summary (estatísticas, tempo de execução)                  │
                    └──────────────────────────────────────────────────────────────┘
```

---

## 9. Validações e Autofix

### Níveis de Validação

| Nível | Quando | O que Valida |
|-------|--------|--------------|
| **Schema (Zod)** | Após cada LLM | Estrutura JSON, tipos, campos obrigatórios |
| **Grafo Incremental** | Após Subrules | Trigger único, ends, referências, ciclos |
| **SaaS** | Após Flow Generator | Padrões de produto, inputs obrigatórios |
| **Grafo Final** | Após Flow Generator | Conectividade, navegabilidade |

### Códigos de Erro Comuns

| Código | Severidade | Descrição |
|--------|------------|-----------|
| `GRAPH_NO_TRIGGER` | error | Fluxo não tem trigger |
| `GRAPH_MULTIPLE_TRIGGERS` | error | Fluxo tem múltiplos triggers |
| `GRAPH_NO_SUCCESS_END` | error | Fluxo não tem end de sucesso |
| `GRAPH_INVALID_REF` | error | Referência a ID inexistente |
| `GRAPH_CONDITION_NO_SUCCESS` | error | Condition sem caminho de sucesso |
| `GRAPH_CONDITION_NO_FAILURE` | error | Condition sem caminho de falha |
| `GRAPH_END_HAS_NEXT` | error | End tem conexão de saída |
| `GRAPH_CYCLE` | error | Ciclo infinito detectado |
| `GRAPH_NUMERIC_REF` | error | Referência numérica (deveria ser slug) |
| `AUTH_NO_RECOVERY` | warning | Login sem recuperação de senha |
| `SIGNUP_NO_EMAIL` | warning | Cadastro sem campo de email |
| `ONBOARDING_NO_SKIP` | warning | Onboarding não permite pular |

### Processo de Autofix

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        VALIDAÇÃO FALHOU                                      │
│                     (erros no grafo detectados)                              │
└────────────────────────────┬────────────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    GERAR RELATÓRIO DE ERROS                                  │
│                                                                              │
│  Erro 1: GRAPH_NO_TRIGGER - Deve haver exatamente 1 trigger                 │
│  Erro 2: GRAPH_CONDITION_NO_FAILURE - Condition "X" não tem falha           │
└────────────────────────────┬────────────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                   CHAMAR LLM PARA AUTOFIX                                    │
│                   (GPT-4o-mini, temperatura 0.1)                             │
│                                                                              │
│  Prompt: "Corrija o mapa de nós com base nos erros. NÃO reescreva do zero." │
└────────────────────────────┬────────────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    VALIDAR RESULTADO DO AUTOFIX                              │
│                                                                              │
│  if (newErrors.length < oldErrors.length) {                                  │
│    // Autofix melhorou → usar versão corrigida                              │
│    addWarning("AUTOFIX_APPLIED");                                            │
│  } else {                                                                    │
│    // Autofix não resolveu → manter original e retornar erros               │
│  }                                                                           │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 📝 Notas Finais

### Versões dos Modelos LLM

| Agente | Modelo | Motivo |
|--------|--------|--------|
| Master Rule Creator | GPT-4 Turbo Preview | Maior qualidade para regras complexas |
| Journey Creator | GPT-4o-mini | Bom equilíbrio velocidade/qualidade |
| Flow Enricher | GPT-4o-mini | Foco em padrões conhecidos |
| Subrules Decomposer | GPT-4o | Maior qualidade para mescla de documentos |
| Autofix | GPT-4o-mini | Correções simples e rápidas |

### Temperaturas

| Agente | Temperatura | Motivo |
|--------|-------------|--------|
| Master Rule Creator | 0.3 | Mais determinístico |
| Journey Creator | 0.4 | Balanceado |
| Flow Enricher | 0.4 | Balanceado |
| Subrules Decomposer | 0.2 | Muito determinístico |
| Autofix | 0.1 | Quase determinístico |

### Próximos Passos (Roadmap)

1. **v3.2:** Suporte a múltiplos idiomas nos prompts
2. **v3.3:** Cache de blocos UX adaptados
3. **v3.4:** Validação de acessibilidade (a11y)
4. **v4.0:** Geração de código a partir dos RichNodes

---

> **Documento gerado para a equipe técnica da Oria**  
> Para dúvidas, consulte o código-fonte em `/lib/agents/` e `/supabase/functions/`







