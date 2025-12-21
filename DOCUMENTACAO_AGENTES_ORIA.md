# 🤖 Documentação Completa dos Agentes de IA - Oria

> **Versão:** 3.0  
> **Última atualização:** Dezembro 2025  
> **Público-alvo:** Equipe Oria (técnicos e não-técnicos)

---

## 📚 Índice

1. [Introdução - O que são os Agentes?](#1-introdução---o-que-são-os-agentes)
2. [Visão Geral da Arquitetura](#2-visão-geral-da-arquitetura)
3. [Os 4 Agentes de IA](#3-os-4-agentes-de-ia)
   - [Agente 1: Master Rule Creator](#agente-1-master-rule-creator)
   - [Agente 2: Subrules Decomposer](#agente-2-subrules-decomposer)
   - [Agente 3: Flow Generator](#agente-3-flow-generator)
   - [Agente 4: Journey & Features Creator](#agente-4-journey--features-creator)
4. [O Orquestrador - Maestro dos Agentes](#4-o-orquestrador---maestro-dos-agentes)
5. [Fluxo Completo de Criação de User Flow](#5-fluxo-completo-de-criação-de-user-flow)
6. [Engine de Processamento (Código Determinístico)](#6-engine-de-processamento-código-determinístico)
7. [Tabelas do Banco de Dados](#7-tabelas-do-banco-de-dados)
8. [Prompts e Comandos Importantes](#8-prompts-e-comandos-importantes)
9. [Validações e Regras de Qualidade](#9-validações-e-regras-de-qualidade)
10. [Glossário de Termos](#10-glossário-de-termos)

---

## 1. Introdução - O que são os Agentes?

### Para quem não é técnico 🧑‍💼

Imagine que você quer criar um **fluxo de cadastro de usuário** para um aplicativo. Em vez de desenhar cada caixinha manualmente, você simplesmente **descreve o que quer em português**:

> "Quero um fluxo de cadastro onde o usuário preenche email e senha, o sistema valida os dados, e se tudo estiver ok, cria a conta. Se der erro, mostra uma mensagem."

Os **agentes de IA** são como **assistentes inteligentes** que pegam essa descrição e:
1. **Entendem** o que você quer fazer (a lógica do negócio)
2. **Quebram** em passos menores e mais específicos
3. **Desenham** automaticamente o fluxo visual com as caixinhas e setas
4. **Mapeiam** a jornada do usuário e sugerem funcionalidades

### Para quem é técnico 👨‍💻

A arquitetura usa **4 agentes especializados** que trabalham em pipeline:
- **LLMs (IA)** cuidam apenas da **semântica** (entender e descrever o negócio)
- **Código determinístico** cuida da **estrutura** (posições, conexões, validações)

Isso garante **consistência** e **previsibilidade** nos resultados.

---

## 2. Visão Geral da Arquitetura

### Diagrama do Pipeline

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           USUÁRIO                                        │
│                    "Quero um fluxo de cadastro..."                       │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         ORQUESTRADOR                                     │
│              (Coordena todos os agentes em sequência)                   │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
            ┌───────────────────────┼───────────────────────┐
            │                       │                       │
            ▼                       ▼                       ▼
┌───────────────────┐   ┌───────────────────┐   ┌───────────────────┐
│   AGENTE 1        │   │   AGENTE 2        │   │   AGENTE 4        │
│   Master Rule     │──▶│   Subrules        │   │   Journey &       │
│   Creator         │   │   Decomposer      │◀──│   Features        │
│                   │   │                   │   │   (paralelo)      │
│   🤖 IA (GPT-4)   │   │   🤖 IA (GPT-4)   │   │   🤖 IA (GPT-4)   │
└───────────────────┘   └───────────────────┘   └───────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         AGENTE 3 - Flow Generator                        │
│                    ⚙️ 100% CÓDIGO (sem IA)                               │
│                                                                         │
│    ┌─────────┐    ┌─────────────┐    ┌────────────┐    ┌───────────┐   │
│    │ Build   │───▶│ Assign      │───▶│ Calculate  │───▶│ Validate  │   │
│    │ Graph   │    │ Order Index │    │ Layout     │    │ Graph     │   │
│    └─────────┘    └─────────────┘    └────────────┘    └───────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         FLUXO VISUAL                                     │
│              (Nós, conexões, posições - pronto para exibir)             │
└─────────────────────────────────────────────────────────────────────────┘
```

### Filosofia da Arquitetura

| O que a IA faz | O que o Código faz |
|----------------|-------------------|
| Entende linguagem natural | Calcula posições X/Y |
| Identifica passos do fluxo | Atribui índices de ordem |
| Descreve regras de negócio | Cria conexões entre nós |
| Sugere tratamentos de erro | Valida estrutura do grafo |
| Mapeia jornada do usuário | Garante consistência |

---

## 3. Os 4 Agentes de IA

### Agente 1: Master Rule Creator

#### O que faz? 📋

O **Master Rule Creator** é o primeiro agente a entrar em ação. Ele recebe o pedido do usuário em linguagem natural e cria uma **especificação completa de regra de negócio**.

#### Para não-técnicos 🧑‍💼

Pense nele como um **analista de negócios** que ouve o que você quer e documenta tudo de forma organizada:
- Qual é o **objetivo** principal?
- Quem são os **participantes** (usuário, sistema)?
- Quais são os **passos** do processo?
- O que pode dar **errado**?
- Quais são as **variações** possíveis?

#### Para técnicos 👨‍💻

**Localização do código:**
- Frontend: `lib/agents/master-rule-creator.ts`
- Backend: `supabase/functions/master-rule-creator/index.ts`

**Modelo de IA utilizado:** GPT-4-turbo-preview

**Schema de saída (validado com Zod):**
```typescript
{
  business_goal: string,      // Objetivo principal
  context: string,            // Cenário/situação
  actors: string[],           // Participantes (usuário, sistema)
  assumptions: string[],      // Premissas/pré-requisitos
  main_flow: string[],        // Passos do happy path (mín. 3)
  alternative_flows: string[], // Variações
  error_flows: string[]       // Tratamentos de erro
}
```

#### O que ele NÃO faz ❌

- **Não cria nós** (caixinhas)
- **Não define posições** (X, Y)
- **Não cria conexões** (setas)
- **Não estrutura o grafo** visual

Ele foca **100% na semântica do negócio**.

#### Exemplo de entrada e saída

**Entrada do usuário:**
> "Criar um fluxo de recuperação de senha"

**Saída do agente:**
```json
{
  "business_goal": "Permitir que usuários recuperem acesso à conta quando esquecem a senha",
  "context": "Usuário na tela de login, clicou em 'Esqueci minha senha'",
  "actors": ["Usuário", "Sistema de autenticação", "Serviço de email"],
  "assumptions": [
    "Usuário possui email cadastrado",
    "Sistema de email está funcionando"
  ],
  "main_flow": [
    "Usuário informa o email cadastrado",
    "Sistema verifica se email existe na base",
    "Sistema gera token temporário",
    "Sistema envia email com link de recuperação",
    "Usuário acessa o link",
    "Usuário define nova senha",
    "Sistema valida e atualiza a senha",
    "Sistema confirma alteração"
  ],
  "alternative_flows": [
    "Se email não encontrado, informar que não existe conta com esse email"
  ],
  "error_flows": [
    "Se falha ao enviar email, permitir reenvio",
    "Se token expirado, solicitar nova recuperação"
  ]
}
```

---

### Agente 2: Subrules Decomposer

#### O que faz? 🧩

O **Subrules Decomposer** pega a regra de negócio criada pelo Agente 1 e **transforma em nós simbólicos** - elementos que representam cada passo do fluxo.

#### Para não-técnicos 🧑‍💼

Imagine que o Agente 1 escreveu uma **receita de bolo**. O Agente 2 pega essa receita e transforma em **cartões individuais**, cada um com uma instrução específica:

- Cartão 1: "Pré-aqueça o forno"
- Cartão 2: "Misture os ingredientes secos"
- Cartão 3: "A massa está homogênea?" (decisão)
- Cartão 4: "Leve ao forno"
- Cartão 5: "Bolo pronto!" (fim)

Cada cartão tem uma **conexão** dizendo qual é o próximo passo.

#### Para técnicos 👨‍💻

**Localização do código:**
- Frontend: `lib/agents/subrules-decomposer.ts`
- Backend: `supabase/functions/subrules-decomposer/index.ts`

**Modelo de IA utilizado:** GPT-4o-mini

**Tipos de nós gerados:**

| Tipo | Descrição | Símbolo |
|------|-----------|---------|
| `trigger` | Ponto de início (1 por fluxo) | ▶️ |
| `action` | Ação executada pelo sistema | ⚡ |
| `condition` | Decisão com 2 caminhos (Sim/Não) | ❓ |
| `subflow` | Referência a outro fluxo | 🔄 |
| `end` | Término (sucesso ou erro) | 🏁 |

**Schema de nó simbólico:**
```typescript
{
  id: string,                    // Slug único (ex: "check_email")
  type: "trigger" | "action" | "condition" | "end" | "subflow",
  title: string,                 // Título descritivo
  description: string,           // O que acontece
  next_on_success?: string,      // ID do próximo nó (sucesso)
  next_on_failure?: string,      // ID do próximo nó (falha) - só para condition
  end_status?: "success" | "error"  // Só para type === "end"
}
```

#### O que ele NÃO faz ❌

- **Não define `order_index`** (ordem numérica)
- **Não calcula posições X/Y**
- **Não cria edges reais** (só referências por ID)

#### Regras importantes 📏

1. **Exatamente 1 trigger** por fluxo
2. **Mínimo 1 end com status "success"**
3. **Conditions DEVEM ter 2 caminhos** (success e failure)
4. **IDs são slugs** (snake_case, ex: `validate_email`)
5. **End nodes não podem ter saída**
6. **Não pode haver ciclos infinitos**

#### Exemplo de saída

```json
{
  "nodes": [
    {
      "id": "start_recovery",
      "type": "trigger",
      "title": "Início da Recuperação",
      "description": "Usuário clica em 'Esqueci minha senha'",
      "next_on_success": "input_email"
    },
    {
      "id": "input_email",
      "type": "action",
      "title": "Informar Email",
      "description": "Usuário digita o email cadastrado",
      "next_on_success": "check_email"
    },
    {
      "id": "check_email",
      "type": "condition",
      "title": "Email existe?",
      "description": "Verifica se o email está cadastrado",
      "next_on_success": "send_token",
      "next_on_failure": "end_not_found"
    },
    {
      "id": "send_token",
      "type": "action",
      "title": "Enviar Email",
      "description": "Sistema envia link de recuperação",
      "next_on_success": "end_success"
    },
    {
      "id": "end_success",
      "type": "end",
      "title": "Recuperação Iniciada",
      "description": "Email enviado com sucesso",
      "end_status": "success"
    },
    {
      "id": "end_not_found",
      "type": "end",
      "title": "Email Não Encontrado",
      "description": "Não existe conta com este email",
      "end_status": "error"
    }
  ]
}
```

---

### Agente 3: Flow Generator

#### O que faz? 📐

O **Flow Generator** é diferente dos outros - ele é **100% código**, sem IA. Ele pega os nós simbólicos do Agente 2 e transforma em um **grafo visual completo** com:
- Posições calculadas (X, Y)
- Índices de ordem
- Conexões reais entre nós
- Validação de estrutura

#### Para não-técnicos 🧑‍💼

Se os Agentes 1 e 2 criaram os "cartões" com as instruções, o Agente 3 é o **organizador** que:
- Coloca cada cartão no **lugar certo** em um quadro
- Desenha **setas** conectando os cartões na ordem correta
- **Numera** cada cartão (1, 2, 3...)
- Verifica se está tudo **organizado corretamente**

Ele trabalha de forma **automática e previsível** - sempre organizará os mesmos cartões da mesma forma.

#### Para técnicos 👨‍💻

**Localização do código:**
- Frontend: `lib/agents/flow-generator.ts`
- Engine: `lib/engine/` (buildGraph, assignOrderIndex, assignLayout, validateGraph)
- Backend: `supabase/functions/flow-generator/index.ts`

**Por que não usa IA?**

A estrutura visual (posições, conexões) deve ser **determinística**:
- Mesmo input → Mesmo output
- Sem variações ou "criatividade"
- Previsível e consistente
- Mais rápido e barato

**Pipeline da Engine:**

```
1. buildGraph      → Cria estrutura de nós e identifica conexões
2. assignOrderIndex → Atribui índices via BFS (Busca em Largura)
3. assignLayout     → Calcula posições X/Y
4. validateGraph    → Verifica se o grafo é válido
```

**Configuração de Layout:**
```typescript
{
  nodeSpacingX: 280,      // Espaço horizontal entre nós
  nodeSpacingY: 180,      // Espaço vertical entre linhas
  startX: 100,            // Posição X inicial
  startY: 300,            // Posição Y da linha principal
  errorPathYOffset: 200,  // Offset Y para caminhos de erro
}
```

#### Estrutura do nó final (EngineNode)

```typescript
{
  id: "node_1",              // ID único para o React Flow
  symbolic_id: "start_recovery", // ID original do Agente 2
  type: "trigger",
  title: "Início da Recuperação",
  description: "...",
  order_index: 1,            // Índice de ordem (BFS)
  position_x: 100,           // Posição X calculada
  position_y: 300,           // Posição Y calculada
  column: "main",            // main | error | alternative
  depth: 0,                  // Profundidade no grafo
  end_status?: "success"     // Só para ends
}
```

---

### Agente 4: Journey & Features Creator

#### O que faz? 🗺️

O **Journey & Features Creator** cria uma **jornada do usuário** escrita e identifica **funcionalidades (features)** necessárias. Ele roda em **paralelo** com o Agente 2.

#### Para não-técnicos 🧑‍💼

Enquanto os outros agentes criam o fluxo técnico, este agente pensa como um **designer de produto**:

- **Jornada do usuário:** Uma história de como o usuário vai usar o sistema
- **Features:** Lista de funcionalidades que precisam existir
- **Dores:** O que pode frustrar o usuário?
- **Oportunidades:** Como podemos melhorar a experiência?

#### Para técnicos 👨‍💻

**Localização do código:**
- Frontend: `lib/agents/journey-features-creator.ts`
- Backend: `supabase/functions/journey-features-creator/index.ts`

**Modelo de IA utilizado:** GPT-4o-mini

**Schema da Jornada:**
```typescript
{
  name: string,              // Nome da jornada
  description: string,       // Descrição em uma frase
  persona: string,           // Tipo de usuário
  goal: string,              // Objetivo principal
  starting_point: string,    // De onde vem
  ending_point: string,      // Para onde vai
  steps: JourneyStep[],      // Passos da jornada
  success_metrics: string[], // Métricas de sucesso
  narrative: string          // História em texto corrido
}
```

**Schema de um passo da jornada:**
```typescript
{
  order: number,
  action: string,            // O que o usuário FAZ
  context: string,           // Por que está fazendo
  expected_outcome: string,  // O que espera acontecer
  emotional_state: "neutral" | "positive" | "negative" | "anxious" | "excited",
  touchpoint: "page" | "modal" | "form" | "button" | "notification" | "email",
  pain_points: string[],     // Possíveis frustrações
  opportunities: string[]    // Oportunidades de melhoria
}
```

**Schema de Feature sugerida:**
```typescript
{
  id: string,
  name: string,
  description: string,
  type: "essential" | "enhancement" | "nice_to_have",
  related_journey_steps: number[],
  complexity: "simple" | "medium" | "complex",
  priority: "low" | "medium" | "high" | "critical",
  user_value: string,
  business_value: string,
  acceptance_criteria: string[]
}
```

---

## 4. O Orquestrador - Maestro dos Agentes

### O que faz? 🎼

O **Orquestrador** é o módulo que **coordena** todos os agentes em sequência, gerenciando o fluxo completo de criação.

**Localização:** `lib/agents/orchestrator.ts`

### Pipeline do Orquestrador

```
1. Recebe prompt do usuário
           │
           ▼
2. Chama Master Rule Creator (Agente 1)
           │
           ▼
3. Valida resposta (Zod)
           │
           ▼
4. Chama Subrules Decomposer (Agente 2)
           │    ╲
           │     ╲──▶ Journey & Features Creator (Agente 4) [paralelo]
           ▼
5. Valida grafo (estrutura)
           │
           ▼
6. Chama Flow Generator (Agente 3 - código)
           │
           ▼
7. Valida fluxo final
           │
           ▼
8. Retorna resultado completo
```

### Callbacks de Progresso

O orquestrador envia **atualizações de progresso** durante a execução:

```typescript
type CreationStep = 
  | "idle"           // Aguardando
  | "analyzing"      // Analisando prompt
  | "creating_master"// Criando regra master
  | "master_review"  // Revisão da regra master
  | "decomposing"    // Decompondo em subrules
  | "decompose_review" // Revisão das subrules
  | "creating_flow"  // Gerando fluxo visual
  | "linking"        // Vinculando elementos
  | "completed"      // Concluído!
  | "error"          // Erro

// Callback recebe:
{
  step: CreationStep,
  message: string,
  percentage: number,  // 0-100
  details: {
    master_rule_created?: boolean,
    master_rule_id?: number,
    sub_rules_count?: number,
    nodes_created?: number,
    connections_created?: number
  }
}
```

---

## 5. Fluxo Completo de Criação de User Flow

### Passo a Passo Visual

```
┌─────────────────────────────────────────────────────────────────────┐
│ ETAPA 1: USUÁRIO ESCREVE O PEDIDO                                   │
│ "Criar um fluxo de checkout de pagamento com validação de cartão"   │
└─────────────────────────────────────────────────────────────────────┘
                                │
                        ▼ (10% progresso)
┌─────────────────────────────────────────────────────────────────────┐
│ ETAPA 2: MASTER RULE CREATOR (Agente 1)                             │
│                                                                     │
│ Entrada:  "Criar fluxo de checkout..."                              │
│ Saída:    {                                                         │
│             business_goal: "Processar pagamento de compra",         │
│             main_flow: ["Exibir carrinho", "Coletar dados"...],    │
│             error_flows: ["Cartão recusado", "Timeout"...]         │
│           }                                                         │
│                                                                     │
│ Salvo em: Tabela `rules` (rule_type: "flow_master")                │
└─────────────────────────────────────────────────────────────────────┘
                                │
                        ▼ (35% progresso)
┌─────────────────────────────────────────────────────────────────────┐
│ ETAPA 3: SUBRULES DECOMPOSER (Agente 2)                             │
│                                                                     │
│ Entrada:  Regra master do Agente 1                                  │
│ Saída:    {                                                         │
│             nodes: [                                                │
│               { id: "start_checkout", type: "trigger", ... },      │
│               { id: "check_cart", type: "condition", ... },         │
│               { id: "process_payment", type: "action", ... },       │
│               { id: "end_success", type: "end", ... }               │
│             ]                                                       │
│           }                                                         │
│                                                                     │
│ Salvo em: Tabela `rules` (rule_type: "node_rule")                  │
│           com parent_rule_id apontando para a master rule           │
└─────────────────────────────────────────────────────────────────────┘
                                │
        ┌───────────────────────┴───────────────────────┐
        │                                               │
        ▼ (paralelo)                                   ▼
┌───────────────────────┐                     ┌───────────────────────┐
│ ETAPA 3.1: JOURNEY    │                     │ ETAPA 4: FLOW         │
│ (Agente 4 - opcional) │                     │ GENERATOR (Agente 3)  │
│                       │                     │                       │
│ Cria jornada escrita  │                     │ 100% código:          │
│ e lista features      │                     │ • BFS para ordem      │
│                       │                     │ • Layout automático   │
│ Salvo em:             │                     │ • Cria conexões       │
│ `user_journeys`       │                     │                       │
│ `suggested_features`  │                     │ Salvo em:             │
│                       │                     │ `flows`               │
│                       │                     │ `nodes`               │
│                       │                     │ `connections`         │
└───────────────────────┘                     └───────────────────────┘
                                │
                        ▼ (100% progresso)
┌─────────────────────────────────────────────────────────────────────┐
│ ETAPA 5: RESULTADO FINAL                                            │
│                                                                     │
│ • Regra master salva no banco                                       │
│ • Subregras salvas e vinculadas                                     │
│ • Fluxo visual criado com nós e conexões                           │
│ • Jornada do usuário documentada                                    │
│ • Features sugeridas listadas                                       │
│                                                                     │
│ Pronto para exibir no editor visual! 🎉                            │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 6. Engine de Processamento (Código Determinístico)

### Visão Geral

A **Engine** é o coração do Agente 3. É um conjunto de funções em código que transformam nós simbólicos em um grafo visual.

**Localização:** `lib/engine/`

### Módulos da Engine

#### 6.1 buildGraph.ts - Construtor do Grafo

**O que faz:**
- Recebe nós simbólicos do Agente 2
- Realiza **BFS (Busca em Largura)** a partir do trigger
- Classifica nós em "main", "error" ou "alternative"
- Cria estrutura de edges (conexões)

**Algoritmo BFS simplificado:**
```
1. Começa no trigger (nó de início)
2. Adiciona à fila de processamento
3. Para cada nó na fila:
   a. Marca como visitado
   b. Adiciona seus vizinhos (next_on_success, next_on_failure) à fila
   c. Registra a profundidade (quantos passos do trigger)
4. Repete até processar todos os nós alcançáveis
```

#### 6.2 assignOrderIndex.ts - Atribuição de Ordem

**O que faz:**
- Atribui `order_index` (1, 2, 3...) baseado na ordem BFS
- Permite ordenação e referência dos nós

#### 6.3 assignLayout.ts - Cálculo de Posições

**O que faz:**
- Calcula posições X/Y para cada nó
- Nós do happy path ficam na linha principal (Y = 300)
- Nós de erro ficam abaixo (Y = 300 + offset)
- Nós alternativos ficam acima

**Configuração:**
```typescript
{
  nodeSpacingX: 280,        // Espaço horizontal
  nodeSpacingY: 180,        // Espaço vertical
  startX: 100,              // X do primeiro nó
  startY: 300,              // Y da linha principal
  errorPathYOffset: 200     // Offset para erros
}
```

#### 6.4 validateGraph.ts - Validação de Estrutura

**O que valida:**

| Regra | Tipo | Descrição |
|-------|------|-----------|
| NO_TRIGGER | Erro | Deve ter exatamente 1 trigger |
| MULTIPLE_TRIGGERS | Erro | Mais de 1 trigger detectado |
| NO_END | Erro | Deve ter pelo menos 1 end |
| NO_SUCCESS_END | Erro | Deve ter 1 end de sucesso |
| CONDITION_NO_YES | Erro | Condition sem caminho "Sim" |
| CONDITION_NO_NO | Aviso | Condition sem caminho "Não" |
| ORPHAN_NODE | Erro | Nó sem conexão de entrada |
| DISCONNECTED_NODE | Erro | Nó sem conexão de saída |
| UNREACHABLE_NODE | Aviso | Nó não alcançável do trigger |

**Score de qualidade:** 0-100 (penalidades por erros/avisos)

---

## 7. Tabelas do Banco de Dados

### 7.1 Tabela `flows` - Fluxos

**Descrição:** Armazena os fluxos visuais criados.

| Campo | Tipo | Descrição | Salvo pelo |
|-------|------|-----------|------------|
| `id` | integer | ID único do fluxo | Automático |
| `project_id` | integer | ID do projeto | Usuário/Sistema |
| `name` | text | Nome do fluxo | Agente 3 |
| `description` | text | Descrição do fluxo | Agente 3 |
| `journey_id` | integer | ID da jornada (opcional) | Agente 4 |
| `metadata` | jsonb | Dados extras | Sistema |
| `created_at` | timestamp | Data de criação | Automático |
| `updated_at` | timestamp | Última atualização | Automático |

**Exemplo de metadata:**
```json
{
  "source": "flow-generator-v3.1",
  "validation_passed": true,
  "validation_score": 95
}
```

---

### 7.2 Tabela `nodes` - Nós dos Fluxos

**Descrição:** Armazena cada nó (caixinha) do fluxo visual.

| Campo | Tipo | Descrição | Salvo pelo |
|-------|------|-----------|------------|
| `id` | integer | ID único do nó | Automático |
| `flow_id` | integer | ID do fluxo pai | Agente 3 |
| `type` | text | Tipo do nó | Agente 2/3 |
| `title` | text | Título do nó | Agente 2 |
| `description` | text | Descrição | Agente 2 |
| `position_x` | float | Posição horizontal | Agente 3 |
| `position_y` | float | Posição vertical | Agente 3 |
| `subflow_id` | integer | ID do subfluxo (se tipo subflow) | Opcional |
| `metadata` | jsonb | Dados extras | Sistema |
| `created_at` | timestamp | Data de criação | Automático |
| `updated_at` | timestamp | Última atualização | Automático |

**Tipos de nó válidos:**
- `trigger` - Início do fluxo
- `action` - Ação do sistema
- `condition` - Decisão (bifurcação)
- `end` - Fim do fluxo
- `subflow` - Referência a outro fluxo
- `field_group` - Grupo de campos (formulário)
- `note` - Anotação/comentário

**Exemplo de metadata:**
```json
{
  "symbolic_id": "check_cart",
  "order_index": 3,
  "column": "main",
  "depth": 2,
  "status": "success"
}
```

---

### 7.3 Tabela `connections` - Conexões (Setas)

**Descrição:** Armazena as conexões (setas) entre os nós.

| Campo | Tipo | Descrição | Salvo pelo |
|-------|------|-----------|------------|
| `id` | integer | ID único da conexão | Automático |
| `flow_id` | integer | ID do fluxo pai | Agente 3 |
| `source_node_id` | integer | ID do nó de origem | Agente 3 |
| `target_node_id` | integer | ID do nó de destino | Agente 3 |
| `label` | text | Rótulo da conexão | Agente 3 |
| `metadata` | jsonb | Dados extras (estilo) | Sistema |
| `created_at` | timestamp | Data de criação | Automático |
| `updated_at` | timestamp | Última atualização | Automático |

**Labels comuns:**
- `"Sim"` - Caminho positivo de condition
- `"Não"` - Caminho negativo de condition
- `null` - Conexão padrão (success)

---

### 7.4 Tabela `rules` - Regras de Negócio

**Descrição:** Armazena as regras de negócio (master e subregras).

| Campo | Tipo | Descrição | Salvo pelo |
|-------|------|-----------|------------|
| `id` | integer | ID único | Automático |
| `project_id` | integer | ID do projeto | Sistema |
| `title` | text | Título da regra | Agente 1/2 |
| `description` | text | Descrição | Agente 1/2 |
| `content` | text | Conteúdo (Markdown) | Agente 1 |
| `rule_type` | text | Tipo da regra | Sistema |
| `scope` | text | Escopo | Sistema |
| `category` | text | Categoria | Agente 1 |
| `priority` | text | Prioridade | Agente 1/2 |
| `status` | text | Status | Sistema |
| `parent_rule_id` | integer | ID da regra pai (para subregras) | Agente 2 |
| `order_index` | integer | Índice de ordem | Engine |
| `suggested_node_type` | text | Tipo de nó sugerido | Agente 2 |
| `flow_id` | integer | ID do fluxo vinculado | Agente 3 |
| `acceptance_criteria` | jsonb | Critérios de aceite | Agente 1 |
| `edge_cases` | jsonb | Casos de borda | Agente 1 |
| `metadata` | jsonb | Dados extras | Sistema |
| `created_at` | timestamp | Data de criação | Automático |
| `updated_at` | timestamp | Última atualização | Automático |

**Tipos de regra (`rule_type`):**
- `flow_master` - Regra principal do fluxo (Agente 1)
- `node_rule` - Subregra de um nó (Agente 2)
- `global` - Regra global do projeto

**Exemplo de metadata para flow_master:**
```json
{
  "source": "master-rule-creator-v3",
  "prompt": "Criar fluxo de checkout...",
  "semantic_data": {
    "business_goal": "...",
    "main_flow": ["..."],
    "error_flows": ["..."]
  }
}
```

**Exemplo de metadata para node_rule:**
```json
{
  "symbolic_id": "check_cart",
  "next_on_success": "show_payment",
  "next_on_failure": "end_empty_cart",
  "source": "subrules-decomposer-v3"
}
```

---

### 7.5 Tabela `user_journeys` - Jornadas do Usuário

**Descrição:** Armazena as jornadas criadas pelo Agente 4.

| Campo | Tipo | Descrição | Salvo pelo |
|-------|------|-----------|------------|
| `id` | integer | ID único | Automático |
| `project_id` | integer | ID do projeto | Sistema |
| `master_rule_id` | integer | ID da regra master | Agente 4 |
| `name` | text | Nome da jornada | Agente 4 |
| `description` | text | Descrição | Agente 4 |
| `persona` | text | Tipo de usuário | Agente 4 |
| `goal` | text | Objetivo principal | Agente 4 |
| `starting_point` | text | De onde vem | Agente 4 |
| `ending_point` | text | Para onde vai | Agente 4 |
| `steps` | jsonb | Passos da jornada | Agente 4 |
| `success_metrics` | jsonb | Métricas de sucesso | Agente 4 |
| `narrative` | text | História em texto | Agente 4 |
| `metadata` | jsonb | Dados extras | Sistema |

---

### 7.6 Tabela `suggested_features` - Features Sugeridas

**Descrição:** Armazena as features identificadas pelo Agente 4.

| Campo | Tipo | Descrição | Salvo pelo |
|-------|------|-----------|------------|
| `id` | integer | ID único | Automático |
| `project_id` | integer | ID do projeto | Sistema |
| `journey_id` | integer | ID da jornada | Agente 4 |
| `master_rule_id` | integer | ID da regra master | Agente 4 |
| `feature_id` | text | ID simbólico (ex: feat_1) | Agente 4 |
| `name` | text | Nome da feature | Agente 4 |
| `description` | text | Descrição | Agente 4 |
| `type` | text | essential/enhancement/nice_to_have | Agente 4 |
| `related_journey_steps` | jsonb | Passos relacionados | Agente 4 |
| `complexity` | text | simple/medium/complex | Agente 4 |
| `priority` | text | low/medium/high/critical | Agente 4 |
| `user_value` | text | Valor para usuário | Agente 4 |
| `business_value` | text | Valor para negócio | Agente 4 |
| `acceptance_criteria` | jsonb | Critérios de aceite | Agente 4 |

---

### 7.7 Tabela `agent_conversations` - Histórico de Conversas

**Descrição:** Armazena o histórico de interações com os agentes.

| Campo | Tipo | Descrição | Salvo pelo |
|-------|------|-----------|------------|
| `id` | uuid | ID único da conversa | Sistema |
| `project_id` | integer | ID do projeto | Sistema |
| `user_id` | integer | ID do usuário | Sistema |
| `agent_type` | text | Tipo do agente | Sistema |
| `messages` | jsonb | Array de mensagens | Todos agentes |
| `context` | jsonb | Contexto da conversa | Todos agentes |
| `created_at` | timestamp | Data de criação | Automático |
| `updated_at` | timestamp | Última atualização | Automático |

**Tipos de agente (`agent_type`):**
- `master_rule_creator_v3`
- `subrules_decomposer_v3`
- `flow_generator_v3`
- `journey_features_creator`

---

## 8. Prompts e Comandos Importantes

### 8.1 Prompt do Master Rule Creator

Este é o prompt enviado ao GPT-4 para criar a regra master:

```
Você é um especialista em análise de processos de negócio.

## SEU PAPEL
Sua função é criar uma especificação SEMÂNTICA de regras de negócio.
Você NÃO cria estruturas técnicas, nós, grafos ou layouts.
Você APENAS descreve a lógica de negócio de forma clara e completa.

## O QUE VOCÊ NÃO FAZ (PROIBIDO)
❌ Criar IDs de nós
❌ Definir tipos de nós (trigger, action, condition, etc)
❌ Criar índices ou order_index
❌ Definir posições X/Y
❌ Criar conexões ou edges
❌ Definir layout ou estrutura visual
❌ Usar termos técnicos de grafo

## O QUE VOCÊ FAZ (OBRIGATÓRIO)
✅ Identificar o objetivo principal do negócio
✅ Descrever o contexto/cenário
✅ Listar os atores envolvidos (usuário, sistema, etc)
✅ Definir premissas/suposições
✅ Descrever o fluxo principal passo a passo
✅ Identificar fluxos alternativos
✅ Identificar casos de erro e exceção
```

### 8.2 Prompt do Subrules Decomposer

```
Você é responsável por transformar semântica de negócio em um conjunto 
de NÓS SIMBÓLICOS para user flows.

## ⚠️ REGRA FUNDAMENTAL: VOCÊ NÃO DEFINE ENGINE!

### VOCÊ NÃO DEFINE (PROIBIDO):
❌ order_index (números de ordem)
❌ x/y (posições)
❌ edges reais
❌ labels de edges
❌ convenções numéricas
❌ layout visual

### VOCÊ DEFINE APENAS:
✅ id simbólico (slug único, ex: "start_trigger", "validate_email")
✅ type (trigger | action | condition | end | subflow)
✅ title (título descritivo)
✅ description (o que acontece neste passo)
✅ next_on_success (id do próximo nó em sucesso)
✅ next_on_failure (id do próximo nó em falha - APENAS para conditions)
✅ end_status (success | error - APENAS para type === "end")

## REGRAS OBRIGATÓRIAS

1. **EXATAMENTE 1 TRIGGER**: Todo grafo começa com um único trigger
2. **PELO MENOS 1 END SUCCESS**: Todo grafo deve ter ao menos 1 end de sucesso
3. **CONDITIONS TÊM 2 CAMINHOS**: Toda condition deve ter next_on_success E next_on_failure
4. **END NODES SÃO TERMINAIS**: Não têm conexões de saída
5. **IDS SÃO SLUGS ÚNICOS**: Formato snake_case
6. **SEM CICLOS**: O grafo não pode ter ciclos infinitos
```

### 8.3 Prompt do Journey & Features Creator

```
Você é uma IA especialista em criar fluxos de jornada do usuário 
com foco em produto digital.

## SEU OBJETIVO
1. Compreender a jornada completa do usuário
2. Identificar o objetivo principal do fluxo
3. Listar os principais passos na interface
4. Identificar features necessárias
5. Mapear dores e oportunidades

## TIPOS DE PASSOS DA JORNADA
- Acessar página/tela
- Visualizar informações
- Clicar em botão/link
- Preencher formulário
- Enviar solicitação
- Aguardar processamento
- Receber feedback/confirmação
- Acompanhar resultado/status

⚠️ EVITE blocos técnicos isolados sem contexto real
✅ PRIORIZE ações da jornada humana centrada no usuário
```

---

## 9. Validações e Regras de Qualidade

### 9.1 Validações do Master Rule Creator

| Regra | Obrigatório | Descrição |
|-------|-------------|-----------|
| `business_goal` | ✅ | Mínimo 10 caracteres |
| `context` | ✅ | Mínimo 10 caracteres |
| `actors` | ✅ | Mínimo 1 ator |
| `main_flow` | ✅ | Mínimo 3 passos |
| `alternative_flows` | ❌ | Recomendado 2+ |
| `error_flows` | ❌ | Recomendado 2+ |

**Score de qualidade:** 
- Base: 50 pontos
- +10: 5+ passos no main_flow
- +10: 8+ passos no main_flow
- +10: 2+ alternative_flows
- +10: 2+ error_flows
- +5: 2+ atores
- +5: 2+ premissas
- -10: Passos muito curtos (média < 20 caracteres)

### 9.2 Validações do Grafo (Engine)

| Código | Severidade | Descrição |
|--------|------------|-----------|
| NO_TRIGGER | Erro | Sem trigger |
| MULTIPLE_TRIGGERS | Erro | Mais de 1 trigger |
| NO_END | Erro | Sem nó end |
| NO_SUCCESS_END | Erro | Sem end de sucesso |
| MULTIPLE_SUCCESS_ENDS | Aviso | Mais de 1 end de sucesso |
| CONDITION_NO_SUCCESS | Erro | Condition sem caminho "Sim" |
| CONDITION_NO_FAILURE | Erro | Condition sem caminho "Não" |
| ACTION_NO_OUTPUT | Erro | Action sem conexão de saída |
| ORPHAN_NODE | Erro | Nó sem entrada |
| DISCONNECTED_NODE | Erro | Nó sem saída (exceto end) |
| UNREACHABLE_SUCCESS_END | Erro | End não alcançável do trigger |
| UNREACHABLE_NODE | Aviso | Nó isolado do fluxo |
| GRAPH_CYCLE | Erro | Ciclo infinito detectado |
| GRAPH_INVALID_REF | Erro | Referência a nó inexistente |

---

## 10. Glossário de Termos

| Termo | Significado |
|-------|-------------|
| **Agente** | Módulo de IA ou código que executa uma tarefa específica |
| **BFS** | Busca em Largura - algoritmo para percorrer grafos em "ondas" |
| **Edge** | Conexão/seta entre dois nós |
| **Engine** | Motor de processamento - código que transforma dados |
| **Edge Function** | Função serverless executada no Supabase |
| **Flow** | Fluxo visual com nós e conexões |
| **Grafo** | Estrutura de dados com nós e conexões |
| **Happy Path** | Caminho principal/ideal do fluxo (sem erros) |
| **LLM** | Large Language Model (modelo de linguagem como GPT) |
| **Master Rule** | Regra principal que descreve todo o fluxo |
| **Node/Nó** | Elemento visual do fluxo (caixinha) |
| **Orquestrador** | Módulo que coordena a execução dos agentes |
| **Pipeline** | Sequência de processamentos |
| **Schema** | Estrutura de dados esperada |
| **Slug** | Identificador em formato URL-friendly (snake_case) |
| **Subrule** | Subregra que representa um passo específico |
| **Symbolic ID** | Identificador descritivo (ex: "check_email") |
| **Trigger** | Nó inicial que dispara o fluxo |
| **Zod** | Biblioteca de validação de schemas TypeScript |

---

## 📞 Suporte

Para dúvidas sobre esta documentação ou sugestões de melhoria:
- Abra uma issue no repositório
- Entre em contato com a equipe de desenvolvimento

---

*Documentação gerada em Dezembro 2024 - Versão 3.0*
