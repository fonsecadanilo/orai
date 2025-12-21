# 📋 Documentação Completa do Fluxo de Criação de User Flow

> **Versão:** 3.1  
> **Última atualização:** Dezembro 2024  
> **Objetivo:** Documentar todo o processo de criação de User Flow de ponta a ponta, incluindo agentes de IA, banco de dados e lógica interna.

---

## 📚 Sumário

1. [Introdução Simples - O que acontece quando você cria um fluxo?](#1-introdução-simples)
2. [Visão Geral da Arquitetura](#2-visão-geral-da-arquitetura)
3. [O Pipeline Completo: 12 Etapas](#3-o-pipeline-completo-12-etapas)
4. [Os 6 Agentes em Detalhe](#4-os-6-agentes-em-detalhe)
   - [Agente 1: Master Rule Creator](#agente-1-master-rule-creator)
   - [Agente 2: Journey Creator](#agente-2-journey-creator)
   - [Agente 3: Flow Enricher](#agente-3-flow-enricher)
   - [Agente 4: Page Mapper](#agente-4-page-mapper)
   - [Agente 5: Subrules Decomposer](#agente-5-subrules-decomposer)
   - [Agente 6: Flow Generator](#agente-6-flow-generator)
5. [O Orquestrador - O Maestro](#5-o-orquestrador)
6. [Banco de Dados: Tabelas e Momentos de Criação](#6-banco-de-dados)
7. [Diagrama Visual do Fluxo](#7-diagrama-visual)
8. [Prompts Internos dos Agentes de IA](#8-prompts-internos)
9. [Validações e Regras de Qualidade](#9-validações)
10. [Glossário de Termos](#10-glossário)
11. [FAQ - Perguntas Frequentes](#11-faq)

---

## 1. Introdução Simples

### Para qualquer pessoa (não técnica) 👥

Imagine que você está num restaurante. Você diz ao garçom: **"Quero um prato saudável com frango"**. O que acontece?

1. 🧑‍🍳 **Chef analista** entende o pedido e define: "é um prato de frango grelhado com legumes"
2. 📝 **Chef de planejamento** pensa na experiência: "primeiro o cliente vai ver o menu, escolher, confirmar..."
3. ✨ **Chef de qualidade** sugere: "devemos oferecer opção sem glúten, e se der erro?"
4. 🗺️ **Organizador** mapeia: "primeiro a entrada, depois o prato, depois a sobremesa"
5. 📦 **Chef executor** monta os ingredientes: "frango, legumes, temperos, em ordem"
6. 🎨 **Chef de apresentação** coloca tudo no prato de forma bonita

**Na Oria, é a mesma coisa!** Você escreve:

> "Quero um fluxo de cadastro de usuário"

E os agentes de IA fazem todo o trabalho:
- Entendem o que você quer
- Planejam a experiência do usuário
- Adicionam boas práticas
- Organizam as páginas
- Criam os passos do fluxo
- Montam o diagrama visual

### Para pessoas técnicas 🧑‍💻

A arquitetura usa **6 agentes especializados** que trabalham em pipeline:

| Agente | Tipo | Responsabilidade |
|--------|------|------------------|
| Master Rule Creator | IA (GPT-4) | Semântica de negócio |
| Journey Creator | IA (GPT-4o-mini) | Experiência do usuário |
| Flow Enricher | IA (GPT-4o-mini) | Padrões SaaS |
| Page Mapper | Código | Mapeamento de páginas |
| Subrules Decomposer | IA (GPT-4o) | Nós simbólicos |
| Flow Generator | Código | Grafo visual |

**Filosofia:** LLMs para semântica, código para estrutura.

---

## 2. Visão Geral da Arquitetura

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              USUÁRIO                                         │
│                    "Quero um fluxo de cadastro..."                          │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           ORQUESTRADOR v3.0                                  │
│              (Coordena todos os 6 agentes em 12 etapas)                     │
│                                                                              │
│  Arquivos: lib/agents/orchestrator.ts                                        │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                 ┌──────────────────┼──────────────────┐
                 ▼                  ▼                  ▼
    ┌────────────────────┐  ┌────────────────────┐  ┌────────────────────┐
    │ MASTER RULE        │  │ JOURNEY            │  │ FLOW ENRICHER      │
    │ CREATOR            │──│ CREATOR            │──│                    │
    │                    │  │                    │  │ 🤖 IA (GPT-4o-mini)│
    │ 🤖 IA (GPT-4-turbo)│  │ 🤖 IA (GPT-4o-mini)│  │                    │
    └────────────────────┘  └────────────────────┘  └────────────────────┘
                 │                  │                        │
                 └──────────────────┼────────────────────────┘
                                    ▼
                      ┌────────────────────────┐
                      │ PAGE MAPPER            │
                      │                        │
                      │ ⚙️ 100% CÓDIGO         │
                      └────────────────────────┘
                                    │
                                    ▼
                      ┌────────────────────────┐
                      │ SUBRULES DECOMPOSER    │
                      │                        │
                      │ 🤖 IA (GPT-4o)         │
                      └────────────────────────┘
                                    │
                                    ▼
                      ┌────────────────────────┐
                      │ FLOW GENERATOR         │
                      │                        │
                      │ ⚙️ 100% CÓDIGO         │
                      │ • BFS para ordem       │
                      │ • Layout automático    │
                      │ • Cria conexões        │
                      └────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           FLUXO VISUAL PRONTO! 🎉                           │
│              (Nós, conexões, posições - pronto para exibir)                 │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Divisão de Responsabilidades

| O que a IA faz | O que o Código faz |
|----------------|-------------------|
| Entende linguagem natural | Calcula posições X/Y |
| Identifica passos do fluxo | Atribui índices de ordem |
| Descreve regras de negócio | Cria conexões entre nós |
| Sugere tratamentos de erro | Valida estrutura do grafo |
| Mapeia jornada do usuário | Garante consistência |
| Adiciona padrões SaaS | Salva no banco de dados |

---

## 3. O Pipeline Completo: 12 Etapas

### Linha do Tempo Visual

```
TEMPO ───────────────────────────────────────────────────────────────────────▶

 5%    10%    20%    30%    35%    40%    50%    55%    65%    70%    85%   100%
  │      │      │      │      │      │      │      │      │      │      │      │
  ▼      ▼      ▼      ▼      ▼      ▼      ▼      ▼      ▼      ▼      ▼      ▼
┌────┐┌────┐┌────┐┌────┐┌────┐┌────┐┌────┐┌────┐┌────┐┌────┐┌────┐┌────┐
│ E1 ││ E2 ││ E3 ││ E4 ││ E5 ││ E6 ││ E7 ││ E8 ││ E9 ││E10 ││E11 ││E12 │
└────┘└────┘└────┘└────┘└────┘└────┘└────┘└────┘└────┘└────┘└────┘└────┘
  │      │      │      │      │      │      │      │      │      │      │      │
  │      │      │      │      │      │      │      │      │      │      │      │
  ▼      ▼      ▼      ▼      ▼      ▼      ▼      ▼      ▼      ▼      ▼      ▼
Criar  Valid  Criar  Valid  Enri-  Mape-  Criar  Valid  Auto-  Gerar  Valid  Retor-
Master Master Jour-  Jour-  quecer ar     Sub-   Sub-   fix    Flow   Final  nar
Rule   Rule   ney    ney    Flow   Pági-  rules  rules         Visual        Resul-
                                   nas                                        tado
```

### Descrição de Cada Etapa

| # | Etapa | Agente | O que acontece | Banco de Dados |
|---|-------|--------|----------------|----------------|
| 1 | Criar Master Rule | Master Rule Creator | IA analisa o prompt e cria especificação de negócio | Salva em `rules` (rule_type: flow_master) |
| 2 | Validar Master Rule | Código (Zod) | Valida estrutura da resposta da IA | - |
| 3 | Criar Jornada | Journey Creator | IA cria jornada do usuário com passos, decisões, falhas | Salva em `user_journeys` |
| 4 | Validar Jornada | Código (Zod) | Valida estrutura da jornada | - |
| 5 | Enriquecer Fluxo | Flow Enricher | IA adiciona padrões SaaS (confirmações, retries, etc) | - |
| 6 | Mapear Páginas | Page Mapper | Código identifica páginas e transições | - |
| 7 | Criar Subrules | Subrules Decomposer | IA cria nós simbólicos mesclando todos os contextos | Salva em `rules` (rule_type: node_rule) |
| 8 | Validar Subrules | Código | Valida estrutura do grafo (trigger, ends, conexões) | - |
| 9 | Autofix | Código + IA | Se houver erros, tenta corrigir automaticamente | - |
| 10 | Gerar Flow Visual | Flow Generator | Código calcula posições, cria edges, monta grafo | Salva em `flows` |
| 11 | Validar Final | Código | Valida grafo final e padrões SaaS | Salva nós em `nodes`, conexões em `connections` |
| 12 | Retornar Resultado | Orquestrador | Retorna tudo para a interface | Atualiza `rules.flow_id` |

---

## 4. Os 6 Agentes em Detalhe

### Agente 1: Master Rule Creator

#### 🎯 Propósito
Recebe o prompt do usuário em linguagem natural e cria uma **especificação semântica de regras de negócio**.

#### 📍 Localização do Código
- **Frontend:** `lib/agents/master-rule-creator.ts`
- **Backend (Edge Function):** `supabase/functions/master-rule-creator/index.ts`

#### 🤖 Modelo de IA
GPT-4-turbo-preview (modelo forte para análise complexa)

#### 📥 Entrada (o que recebe)
```typescript
{
  prompt: "Criar fluxo de recuperação de senha",
  project_id: 1,
  user_id: 1
}
```

#### 📤 Saída (o que gera)
```typescript
{
  business_goal: "Permitir que usuários recuperem acesso quando esquecem a senha",
  context: "Usuário na tela de login, clicou em 'Esqueci minha senha'",
  actors: ["Usuário", "Sistema de autenticação", "Serviço de email"],
  assumptions: [
    "Usuário possui email cadastrado",
    "Sistema de email está funcionando"
  ],
  main_flow: [
    "Usuário informa o email cadastrado",
    "Sistema verifica se email existe na base",
    "Sistema gera token temporário",
    "Sistema envia email com link de recuperação",
    "Usuário acessa o link",
    "Usuário define nova senha",
    "Sistema valida e atualiza a senha",
    "Sistema confirma alteração"
  ],
  alternative_flows: [
    "Se email não encontrado, informar que não existe conta"
  ],
  error_flows: [
    "Se falha ao enviar email, permitir reenvio",
    "Se token expirado, solicitar nova recuperação"
  ],
  pages_involved: [
    { page_key: "login", label: "Página de Login", path: "/login", page_type: "login" },
    { page_key: "recovery", label: "Recuperação de Senha", path: "/forgot-password", page_type: "recovery" }
  ]
}
```

#### 💾 O que salva no banco
Cria 1 registro na tabela `rules`:
- `rule_type`: "flow_master"
- `title`: Derivado do business_goal
- `content`: Markdown formatado
- `metadata.semantic_data`: JSON completo acima

#### ❌ O que NÃO faz
- Não cria nós (caixinhas)
- Não define posições (X, Y)
- Não cria conexões (setas)
- Não descreve interface (botões, cores)

---

### Agente 2: Journey Creator

#### 🎯 Propósito
Cria uma **jornada narrativa do usuário** que será combinada com a Master Rule para criar nós ricos.

#### 📍 Localização do Código
- **Frontend:** `lib/agents/journey-features-creator.ts`
- **Backend (Edge Function):** `supabase/functions/journey-features-creator/index.ts`

#### 🤖 Modelo de IA
GPT-4o-mini (bom equilíbrio entre velocidade e qualidade)

#### 📥 Entrada
```typescript
{
  master_rule_id: 123,
  master_rule_content: "...",
  master_rule_title: "Recuperação de Senha",
  business_rules: ["Validar email", "Gerar token seguro"],
  project_id: 1,
  user_id: 1
}
```

#### 📤 Saída
```typescript
{
  journey: {
    steps: [
      "O usuário acessa a tela de login e clica em esqueci minha senha",
      "O usuário informa seu email cadastrado",
      "O sistema verifica se o email existe"
    ],
    decisions: [
      "O usuário decide se quer tentar outro email ou verificar caixa de spam"
    ],
    failure_points: [
      "Email não encontrado - usuário pode ter digitado errado",
      "Token expirado - usuário demorou para acessar o link"
    ],
    motivations: [
      "Usuário esqueceu a senha e quer acessar sua conta",
      "Usuário precisa completar uma tarefa urgente"
    ]
  },
  journey_structured: {
    steps: [
      {
        step_id: "access_recovery",
        description: "O usuário acessa a tela de recuperação",
        page_key: "recovery",
        user_intent: "Recuperar acesso à conta",
        system_reaction: "Mostrar formulário de email"
      }
    ],
    decisions: [
      {
        decision_id: "try_again_or_check_spam",
        description: "Decidir próximo passo após mensagem de erro",
        page_key: "recovery",
        options: ["tentar_novamente", "verificar_spam"]
      }
    ],
    failure_points: [
      {
        failure_id: "email_not_found",
        description: "Email não encontrado no sistema",
        page_key: "recovery",
        recovery: "Sugerir verificar digitação ou criar conta"
      }
    ]
  },
  suggested_features: [
    {
      id: "feat_1",
      name: "Validação de email em tempo real",
      type: "essential",
      complexity: "simple",
      priority: "high"
    }
  ]
}
```

#### 💾 O que salva no banco
1. Cria 1 registro na tabela `user_journeys`
2. Cria N registros na tabela `suggested_features`
3. Cria 1 registro na tabela `agent_conversations`

---

### Agente 3: Flow Enricher

#### 🎯 Propósito
Analisa a Master Rule + Journey e **sugere enriquecimentos** baseados em padrões SaaS comuns.

#### 📍 Localização do Código
- **Frontend:** `lib/agents/flow-enricher.ts`
- **Backend (Edge Function):** `supabase/functions/flow-enricher/index.ts`

#### 🤖 Modelo de IA
GPT-4o-mini

#### O que sugere

| Tipo de Fluxo | Sugestões Automáticas |
|---------------|----------------------|
| Login | Opção "Esqueci minha senha", feedback de erro amigável |
| Cadastro | Confirmação de email, onboarding pós-cadastro |
| Checkout | Confirmação antes de pagamento, opção de retry |
| Onboarding | Opção de pular, indicador de progresso |

#### 📤 Saída
```typescript
{
  extra_steps: [
    {
      step_id: "email_confirmation",
      description: "Sistema envia email de confirmação",
      page_key: "signup",
      pattern_type: "confirmation",
      reason: "Padrão SaaS: confirmar email para segurança"
    }
  ],
  extra_decisions: [
    {
      decision_id: "skip_or_continue",
      description: "Usuário pode pular onboarding",
      page_key: "onboarding",
      options: ["continuar", "pular"]
    }
  ],
  extra_failure_points: [
    {
      failure_id: "payment_failed",
      description: "Pagamento recusado",
      page_key: "checkout",
      recovery_action: "Tentar outro cartão",
      allows_retry: true
    }
  ],
  ux_recommendations: [
    {
      target: "login_form",
      recommendation: "Mostrar indicador de força da senha",
      priority: "medium",
      pattern_name: "password_strength"
    }
  ],
  patterns_applied: ["confirmation", "retry", "skip"]
}
```

---

### Agente 4: Page Mapper

#### 🎯 Propósito
Mapeia **páginas e transições** a partir dos dados coletados pelos agentes anteriores.

#### ⚙️ Tipo
**100% código determinístico** - NÃO usa IA

#### 📍 Localização do Código
- `lib/agents/page-mapper.ts`

#### O que faz
1. Coleta páginas da Master Rule (`pages_involved`)
2. Extrai páginas da Journey (`page_key` em cada step)
3. Adiciona páginas do Flow Enricher
4. Infere transições entre páginas
5. Detecta tipo de fluxo (auth, signup, checkout, etc.)
6. Adiciona transições padrão

#### 📤 Saída
```typescript
{
  pages: [
    { page_key: "login", label: "Página de Login", page_type: "login" },
    { page_key: "recovery", label: "Recuperação de Senha", page_type: "recovery" },
    { page_key: "dashboard", label: "Dashboard", page_type: "dashboard" }
  ],
  transitions: [
    { from_page: "login", to_page: "recovery", reason: "user_forgot_password" },
    { from_page: "login", to_page: "dashboard", reason: "login_success" }
  ],
  entry_page: "login",
  exit_pages_success: ["dashboard"],
  exit_pages_error: ["error"]
}
```

---

### Agente 5: Subrules Decomposer

#### 🎯 Propósito
Recebe **TODOS os contextos** (Master Rule + Journey + Enricher + Page Context) e cria **nós ricos (RichNodes)**.

#### 📍 Localização do Código
- **Frontend:** `lib/agents/subrules-decomposer.ts`
- **Backend (Edge Function):** `supabase/functions/subrules-decomposer/index.ts`

#### 🤖 Modelo de IA
GPT-4o (modelo mais capaz para mescla complexa)

#### 📥 Entrada
Recebe até 4 documentos:
1. **Master Rule** - Regras de negócio
2. **Journey** - Jornada do usuário
3. **Enriched Flow** - Enriquecimentos SaaS
4. **Page Context** - Mapeamento de páginas

#### 📤 Saída (RichNodes)
```typescript
{
  nodes: [
    {
      id: "start_recovery",
      type: "trigger",
      title: "Início da Recuperação",
      description: "Usuário acessa a tela de recuperação de senha",
      page_key: "recovery",
      user_intent: "Recuperar acesso à conta",
      system_behavior: "Exibir formulário de email",
      next_on_success: "input_email",
      flow_category: "main"
    },
    {
      id: "input_email",
      type: "action",
      title: "Informar Email",
      description: "Usuário digita o email cadastrado",
      page_key: "recovery",
      inputs: [
        {
          name: "email",
          type: "email",
          label: "E-mail",
          required: true,
          validation: ["required", "valid_email"]
        }
      ],
      error_cases: ["Email não cadastrado", "Formato inválido"],
      allows_retry: true,
      next_on_success: "validate_email",
      flow_category: "main"
    },
    {
      id: "validate_email",
      type: "condition",
      title: "Email existe?",
      description: "Sistema verifica se email está cadastrado",
      page_key: "recovery",
      next_on_success: "send_token",
      next_on_failure: "end_email_not_found",
      flow_category: "main"
    },
    {
      id: "end_email_not_found",
      type: "end",
      title: "Email Não Encontrado",
      description: "Não existe conta com este email",
      page_key: "recovery",
      end_status: "error",
      flow_category: "error"
    },
    {
      id: "send_token",
      type: "action",
      title: "Enviar Email de Recuperação",
      description: "Sistema gera token e envia email",
      page_key: "recovery",
      system_behavior: "Gerar token seguro e enviar para o email",
      next_on_success: "end_success",
      flow_category: "main"
    },
    {
      id: "end_success",
      type: "end",
      title: "Email Enviado",
      description: "Link de recuperação enviado com sucesso",
      page_key: "recovery",
      end_status: "success",
      flow_category: "main"
    }
  ]
}
```

#### Tipos de Nós

| Tipo | Descrição | Símbolo | Campos Especiais |
|------|-----------|---------|------------------|
| `trigger` | Ponto de início (1 por fluxo) | ▶️ | - |
| `action` | Ação do sistema | ⚡ | `inputs`, `error_cases`, `allows_retry` |
| `condition` | Decisão com 2 caminhos | ❓ | `next_on_failure` obrigatório |
| `subflow` | Referência a outro fluxo | 🔄 | `target_flow_id` |
| `end` | Término do fluxo | 🏁 | `end_status` (success/error) |

#### 💾 O que salva no banco
Cria N registros na tabela `rules`:
- `rule_type`: "node_rule"
- `parent_rule_id`: ID da master rule
- `suggested_node_type`: tipo do nó
- `metadata`: contém `symbolic_id`, `next_on_success`, `next_on_failure`, `page_key`, etc.

---

### Agente 6: Flow Generator

#### 🎯 Propósito
Recebe os nós simbólicos e cria o **grafo visual completo** com posições, conexões e validação.

#### ⚙️ Tipo
**100% código determinístico** - NÃO usa IA

#### 📍 Localização do Código
- **Frontend:** `lib/agents/flow-generator.ts`
- **Engine:** `lib/engine/` (buildGraph, assignOrderIndex, assignLayout, validateGraph)
- **Backend (Edge Function):** `supabase/functions/flow-generator/index.ts`

#### Pipeline da Engine

```
1. buildGraph      → Cria estrutura de nós, separa main/error, normaliza IDs
2. assignOrderIndex → Atribui índices via BFS (Busca em Largura)
3. assignLayout     → Calcula posições X/Y baseado na coluna (main, error)
4. validateGraph    → Verifica se o grafo é válido
```

#### Configuração de Layout
```typescript
{
  nodeSpacingX: 280,      // Espaço horizontal entre nós
  nodeSpacingY: 180,      // Espaço vertical entre linhas
  startX: 100,            // Posição X inicial
  startY: 300,            // Posição Y da linha principal
  errorPathYOffset: 200   // Offset Y para caminhos de erro
}
```

#### 📤 Saída
```typescript
{
  nodes: [
    {
      id: "node_1",
      symbolic_id: "start_recovery",
      type: "trigger",
      title: "Início da Recuperação",
      order_index: 1,
      position_x: 100,
      position_y: 300,
      column: "main",
      depth: 0
    },
    // ... mais nós com posições calculadas
  ],
  edges: [
    {
      id: "edge_1",
      source: "node_1",
      target: "node_2",
      type: "success",
      label: undefined
    },
    {
      id: "edge_2",
      source: "node_3",
      target: "node_4",
      type: "failure",
      label: "Não",
      style: { stroke: "#ef4444" }
    }
  ]
}
```

#### 💾 O que salva no banco
1. Cria 1 registro na tabela `flows`
2. Cria N registros na tabela `nodes` (um para cada nó)
3. Cria N registros na tabela `connections` (uma para cada edge)
4. Atualiza `rules.flow_id` na master rule

---

## 5. O Orquestrador

### 🎯 Propósito
O Orquestrador é o **maestro** que coordena todos os agentes em sequência, gerenciando o fluxo completo.

### 📍 Localização
`lib/agents/orchestrator.ts`

### Função Principal
```typescript
export async function createCompleteFlowWithAgents(
  request: FullFlowCreationRequest,
  onProgress?: ProgressCallback
): Promise<FullFlowCreationResponse>
```

### Callbacks de Progresso
O orquestrador envia atualizações em tempo real:

```typescript
{
  step: "creating_master",  // Etapa atual
  message: "3/12 - Criando jornada do usuário...",
  percentage: 20,
  details: {
    master_rule_created: true,
    master_rule_id: 123,
    sub_rules_count: 0,
    nodes_created: 0
  }
}
```

### Estados Possíveis

| Estado | Descrição |
|--------|-----------|
| `idle` | Aguardando |
| `analyzing` | Analisando prompt |
| `creating_master` | Criando regra master |
| `master_review` | Revisão da regra master |
| `decomposing` | Decompondo em subrules |
| `decompose_review` | Revisão das subrules |
| `creating_flow` | Gerando fluxo visual |
| `linking` | Vinculando elementos |
| `completed` | Concluído! 🎉 |
| `error` | Erro |

---

## 6. Banco de Dados

### Diagrama de Relacionamentos

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│     rules       │     │     flows       │     │     nodes       │
│                 │     │                 │     │                 │
│ id (PK)         │◀────│ id (PK)         │────▶│ id (PK)         │
│ project_id      │     │ project_id      │     │ flow_id (FK)    │
│ flow_id (FK)    │────▶│ name            │     │ type            │
│ parent_rule_id  │     │ description     │     │ title           │
│ rule_type       │     │ journey_id (FK) │     │ description     │
│ title           │     │ metadata        │     │ position_x      │
│ content         │     │ created_at      │     │ position_y      │
│ suggested_node  │     │ updated_at      │     │ metadata        │
│ metadata        │     └─────────────────┘     │ created_at      │
│ created_at      │            │                │ updated_at      │
│ updated_at      │            │                └─────────────────┘
└─────────────────┘            │                        │
        │                      │                        │
        │              ┌───────┴───────┐               │
        │              │               │               │
        ▼              ▼               ▼               ▼
┌─────────────────┐   ┌─────────────────┐   ┌─────────────────┐
│ user_journeys   │   │ suggested_     │   │  connections    │
│                 │   │ features       │   │                 │
│ id (PK)         │   │                │   │ id (PK)         │
│ project_id      │   │ id (PK)        │   │ flow_id (FK)    │
│ master_rule_id  │   │ project_id     │   │ source_node_id  │
│ name            │   │ journey_id     │   │ target_node_id  │
│ persona         │   │ master_rule_id │   │ label           │
│ goal            │   │ name           │   │ created_at      │
│ steps           │   │ type           │   │ updated_at      │
│ narrative       │   │ priority       │   └─────────────────┘
│ metadata        │   │ acceptance_    │
│ created_at      │   │ criteria       │
│ updated_at      │   └─────────────────┘
└─────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                    agent_conversations                          │
│                                                                 │
│ id (PK/UUID)  │ project_id  │ user_id  │ agent_type  │ messages│
└─────────────────────────────────────────────────────────────────┘
```

### Tabela: `rules`

| Campo | Tipo | Descrição | Quem Salva |
|-------|------|-----------|------------|
| `id` | integer | ID único | Auto |
| `project_id` | integer | ID do projeto | Sistema |
| `title` | text | Título da regra | Agente 1/5 |
| `description` | text | Descrição | Agente 1/5 |
| `content` | text | Conteúdo Markdown | Agente 1 |
| `rule_type` | text | `flow_master` ou `node_rule` | Sistema |
| `parent_rule_id` | integer | ID da regra pai (para node_rule) | Agente 5 |
| `suggested_node_type` | text | trigger/action/condition/end/subflow | Agente 5 |
| `flow_id` | integer | ID do fluxo vinculado | Agente 6 |
| `metadata` | jsonb | Dados extras (symbolic_id, next_on_success, etc) | Todos |

**Momento de criação:**
- `flow_master`: Etapa 1 (Master Rule Creator)
- `node_rule`: Etapa 7 (Subrules Decomposer)

---

### Tabela: `flows`

| Campo | Tipo | Descrição | Quem Salva |
|-------|------|-----------|------------|
| `id` | integer | ID único do fluxo | Auto |
| `project_id` | integer | ID do projeto | Sistema |
| `name` | text | Nome do fluxo | Agente 6 |
| `description` | text | Descrição | Agente 6 |
| `journey_id` | integer | ID da jornada | Agente 4 |
| `metadata` | jsonb | source, validation_score, etc | Agente 6 |

**Momento de criação:** Etapa 10 (Flow Generator)

---

### Tabela: `nodes`

| Campo | Tipo | Descrição | Quem Salva |
|-------|------|-----------|------------|
| `id` | integer | ID único do nó | Auto |
| `flow_id` | integer | ID do fluxo pai | Agente 6 |
| `type` | text | trigger/action/condition/end/subflow/note | Agente 6 |
| `title` | text | Título do nó | Agente 5/6 |
| `description` | text | Descrição | Agente 5/6 |
| `position_x` | float | Posição horizontal | Agente 6 |
| `position_y` | float | Posição vertical | Agente 6 |
| `metadata` | jsonb | symbolic_id, order_index, column, status | Agente 6 |

**Momento de criação:** Etapa 11 (após salvar flow)

---

### Tabela: `connections`

| Campo | Tipo | Descrição | Quem Salva |
|-------|------|-----------|------------|
| `id` | integer | ID único | Auto |
| `flow_id` | integer | ID do fluxo pai | Agente 6 |
| `source_node_id` | integer | ID do nó de origem | Agente 6 |
| `target_node_id` | integer | ID do nó de destino | Agente 6 |
| `label` | text | "Sim", "Não", null | Agente 6 |

**Momento de criação:** Etapa 11 (após salvar nodes)

---

### Tabela: `user_journeys`

| Campo | Tipo | Descrição | Quem Salva |
|-------|------|-----------|------------|
| `id` | integer | ID único | Auto |
| `project_id` | integer | ID do projeto | Sistema |
| `master_rule_id` | integer | ID da regra master | Agente 2 |
| `name` | text | Nome da jornada | Agente 2 |
| `persona` | text | Tipo de usuário | Agente 2 |
| `goal` | text | Objetivo principal | Agente 2 |
| `steps` | jsonb | Array de passos | Agente 2 |
| `narrative` | text | História em texto | Agente 2 |
| `metadata` | jsonb | journey_v2, journey_structured, page_context | Agente 2 |

**Momento de criação:** Etapa 3 (Journey Creator)

---

### Tabela: `suggested_features`

| Campo | Tipo | Descrição | Quem Salva |
|-------|------|-----------|------------|
| `id` | integer | ID único | Auto |
| `project_id` | integer | ID do projeto | Sistema |
| `journey_id` | integer | ID da jornada | Agente 2 |
| `feature_id` | text | ID simbólico (feat_1) | Agente 2 |
| `name` | text | Nome da feature | Agente 2 |
| `type` | text | essential/enhancement/nice_to_have | Agente 2 |
| `complexity` | text | simple/medium/complex | Agente 2 |
| `priority` | text | low/medium/high/critical | Agente 2 |

**Momento de criação:** Etapa 3 (Journey Creator)

---

### Tabela: `agent_conversations`

| Campo | Tipo | Descrição | Quem Salva |
|-------|------|-----------|------------|
| `id` | uuid | ID único da conversa | Sistema |
| `project_id` | integer | ID do projeto | Sistema |
| `user_id` | integer | ID do usuário | Sistema |
| `agent_type` | text | master_rule_creator_v3, etc | Todos agentes |
| `messages` | jsonb | Array de mensagens | Todos agentes |
| `context` | jsonb | Contexto da conversa | Todos agentes |

**Momento de criação:** Cada agente de IA salva sua conversa

---

## 7. Diagrama Visual do Fluxo

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│  PROMPT DO USUÁRIO                                                          │
│  "Criar um fluxo de checkout de pagamento"                                  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  ETAPA 1-2: MASTER RULE CREATOR                                             │
│  ─────────────────────────────                                              │
│                                                                             │
│  🤖 GPT-4-turbo analisa e cria:                                             │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ {                                                                   │   │
│  │   business_goal: "Processar pagamento de compra online",            │   │
│  │   main_flow: ["Exibir carrinho", "Coletar dados de pagamento",      │   │
│  │               "Processar pagamento", "Confirmar compra"],           │   │
│  │   error_flows: ["Cartão recusado", "Timeout"],                      │   │
│  │   pages_involved: [checkout, confirmation, error]                   │   │
│  │ }                                                                   │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  💾 Salva: rules (flow_master)                                              │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  ETAPA 3-4: JOURNEY CREATOR                                                 │
│  ──────────────────────────                                                 │
│                                                                             │
│  🤖 GPT-4o-mini cria jornada narrativa:                                     │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ steps: [                                                            │   │
│  │   { page_key: "checkout", description: "Usuário revisa carrinho" }, │   │
│  │   { page_key: "checkout", description: "Usuário preenche cartão" }, │   │
│  │   { page_key: "confirmation", description: "Vê confirmação" }       │   │
│  │ ],                                                                  │   │
│  │ decisions: ["Escolher forma de pagamento"],                         │   │
│  │ failure_points: ["Cartão recusado", "Timeout"]                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  💾 Salva: user_journeys, suggested_features                                │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  ETAPA 5: FLOW ENRICHER                                                     │
│  ──────────────────────                                                     │
│                                                                             │
│  🤖 GPT-4o-mini adiciona padrões SaaS:                                      │
│                                                                             │
│  + [confirmation] Confirmar dados antes de pagar                            │
│  + [retry] Permitir tentar novamente se pagamento falhar                    │
│  + [loading] Mostrar indicador durante processamento                        │
│  + [success_feedback] Mostrar confirmação clara após sucesso                │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  ETAPA 6: PAGE MAPPER                                                       │
│  ────────────────────                                                       │
│                                                                             │
│  ⚙️ Código mapeia páginas e transições:                                     │
│                                                                             │
│  páginas: [checkout, confirmation, error, success]                          │
│  transições: checkout → confirmation (sucesso)                              │
│              checkout → error (falha)                                       │
│              confirmation → success (ok)                                    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  ETAPA 7-9: SUBRULES DECOMPOSER                                             │
│  ─────────────────────────────                                              │
│                                                                             │
│  🤖 GPT-4o mescla TUDO e cria RichNodes:                                    │
│                                                                             │
│  ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐  │
│  │ TRIGGER  │──▶│ ACTION   │──▶│ CONDITION│──▶│ ACTION   │──▶│ END      │  │
│  │ Início   │   │ Preencher│   │ Válido?  │   │ Processar│   │ Sucesso  │  │
│  │ checkout │   │ cartão   │   │          │   │ pagamento│   │          │  │
│  └──────────┘   └──────────┘   └────┬─────┘   └──────────┘   └──────────┘  │
│                                      │                                      │
│                                      │ Não                                  │
│                                      ▼                                      │
│                               ┌──────────┐                                  │
│                               │ END      │                                  │
│                               │ Erro     │                                  │
│                               │          │                                  │
│                               └──────────┘                                  │
│                                                                             │
│  💾 Salva: rules (node_rule) - um para cada nó                              │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  ETAPA 10-12: FLOW GENERATOR                                                │
│  ───────────────────────────                                                │
│                                                                             │
│  ⚙️ Código calcula layout e valida:                                         │
│                                                                             │
│  1. BFS a partir do trigger → define order_index                            │
│  2. Calcula position_x (spacing * depth)                                    │
│  3. Calcula position_y (main=300, error=300+200)                            │
│  4. Cria edges baseado em next_on_success/failure                           │
│  5. Valida grafo (trigger único, end success, sem ciclos)                   │
│                                                                             │
│  💾 Salva: flows, nodes, connections                                        │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  ✅ RESULTADO FINAL                                                         │
│                                                                             │
│  {                                                                          │
│    success: true,                                                           │
│    flow_id: 42,                                                             │
│    master_rule_id: 123,                                                     │
│    sub_rule_ids: [124, 125, 126, 127, 128, 129],                            │
│    journey_id: 15,                                                          │
│    summary: {                                                               │
│      total_rules_created: 7,                                                │
│      total_nodes_created: 6,                                                │
│      total_connections_created: 6,                                          │
│      total_pages_mapped: 4,                                                 │
│      execution_time_ms: 8500                                                │
│    }                                                                        │
│  }                                                                          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 8. Prompts Internos dos Agentes de IA

### Master Rule Creator - System Prompt

```
Você é um especialista em análise de processos de produtos digitais (principalmente SaaS).

## SEU PAPEL
Sua função é criar uma especificação SEMÂNTICA de regras de negócio, incluindo as PÁGINAS ENVOLVIDAS.
Você NÃO cria estruturas técnicas, nós, grafos ou layouts.
Você descreve a lógica de negócio e identifica as páginas do sistema.

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

RETORNE APENAS JSON VÁLIDO.
```

### Subrules Decomposer - System Prompt

```
Você é um engenheiro de automação de fluxos especializado em SaaS.

## VOCÊ RECEBERÁ ATÉ 4 DOCUMENTOS:
1. REGRA DE NEGÓCIO (Master Rule)
2. JORNADA DO USUÁRIO (Journey) 
3. ENRIQUECIMENTOS (Flow Enricher) - OPCIONAL
4. CONTEXTO DE PÁGINAS (PageContext) - OPCIONAL

## SUA TAREFA
Gerar uma lista de NÓS RICOS (RichNodes) que representem o fluxo completo.

## VOCÊ NÃO DECIDE:
❌ order_index, x/y, edges reais, labels de edges, layout visual

## VOCÊ DECIDE:
✅ id (slug único em snake_case)
✅ type (trigger | action | condition | end | subflow)
✅ title, description
✅ next_on_success, next_on_failure (IDs SIMBÓLICOS)
✅ end_status (success | error | cancel)
✅ flow_category (main | error | alternative)
✅ page_key - página onde o nó acontece
✅ user_intent - o que o usuário quer fazer
✅ system_behavior - o que o sistema faz
✅ inputs - campos de formulário (para nós com formulários)
✅ error_cases - erros esperados neste nó
✅ allows_retry - se permite tentar novamente

## REGRAS CRÍTICAS
1. EXATAMENTE 1 TRIGGER
2. PELO MENOS 1 END SUCCESS
3. CONDITIONS TÊM 2 CAMINHOS
4. END NODES SÃO TERMINAIS
5. IDs SÃO SLUGS ÚNICOS
6. SEM CICLOS INFINITOS
7. TODOS OS IDs REFERENCIADOS DEVEM EXISTIR

⚠️ NUNCA use números como IDs ou referências!

RETORNE APENAS JSON VÁLIDO.
```

---

## 9. Validações e Regras de Qualidade

### Validações do Master Rule Creator

| Regra | Obrigatório | Mínimo |
|-------|-------------|--------|
| `business_goal` | ✅ | 10 caracteres |
| `context` | ✅ | 10 caracteres |
| `actors` | ✅ | 1 ator |
| `main_flow` | ✅ | 3 passos |
| `alternative_flows` | ❌ | Recomendado 2+ |
| `error_flows` | ❌ | Recomendado 2+ |
| `pages_involved` | ❌ | Recomendado 2+ |

### Validações do Grafo (Engine)

| Código | Severidade | Descrição |
|--------|------------|-----------|
| `GRAPH_NO_TRIGGER` | Erro | Sem trigger |
| `GRAPH_MULTIPLE_TRIGGERS` | Erro | Mais de 1 trigger |
| `GRAPH_NO_SUCCESS_END` | Erro | Sem end de sucesso |
| `GRAPH_CONDITION_NO_SUCCESS` | Erro | Condition sem caminho "Sim" |
| `GRAPH_CONDITION_NO_FAILURE` | Erro | Condition sem caminho "Não" |
| `GRAPH_END_HAS_NEXT` | Erro | End com conexão de saída |
| `GRAPH_INVALID_REF` | Erro | Referência a nó inexistente |
| `GRAPH_CYCLE` | Erro | Ciclo infinito detectado |
| `NO_CONNECTIONS` | Erro | Nós sem conexões |
| `ORPHAN_NODE` | Aviso | Nó sem entrada |
| `DISCONNECTED_OUTPUT` | Aviso | Nó sem saída (exceto end) |

### Score de Qualidade (0-100)

| Critério | Pontos |
|----------|--------|
| Base | 50 |
| 5+ passos no main_flow | +10 |
| 8+ passos no main_flow | +10 |
| 2+ alternative_flows | +10 |
| 2+ error_flows | +10 |
| 2+ atores | +5 |
| 2+ pages_involved | +10 |
| 4+ pages_involved | +5 |
| Passos muito curtos (média < 20 chars) | -10 |

---

## 10. Glossário de Termos

### Termos Gerais

| Termo | Significado para Todos | Detalhe Técnico |
|-------|------------------------|-----------------|
| **Fluxo (Flow)** | O diagrama visual com caixinhas e setas | Estrutura de dados com nós e conexões |
| **Nó (Node)** | Cada caixinha no diagrama | Elemento com tipo, título, posição |
| **Conexão (Edge)** | Cada seta entre caixinhas | Ligação entre source e target |
| **Trigger** | O início do fluxo (círculo) | Primeiro nó, só pode ter 1 |
| **Action** | Uma ação que acontece (retângulo) | Nó de processamento |
| **Condition** | Uma decisão com Sim/Não (losango) | Nó com 2 caminhos obrigatórios |
| **End** | O fim do fluxo | Pode ser success ou error |
| **Subflow** | Referência a outro fluxo | Permite modularização |

### Termos Técnicos

| Termo | Significado |
|-------|-------------|
| **Agente** | Módulo (IA ou código) que executa uma tarefa específica |
| **BFS** | Busca em Largura - algoritmo para percorrer o grafo em "ondas" |
| **Edge Function** | Função serverless executada no Supabase |
| **Grafo** | Estrutura de dados com nós e conexões |
| **Happy Path** | Caminho principal/ideal do fluxo (sem erros) |
| **LLM** | Large Language Model (modelo de linguagem como GPT) |
| **Orquestrador** | Módulo que coordena a execução dos agentes |
| **Pipeline** | Sequência de processamentos |
| **RichNode** | Nó com campos extras (page_key, inputs, etc) |
| **Schema** | Estrutura de dados esperada |
| **Slug** | Identificador em formato URL-friendly (snake_case) |
| **Symbolic ID** | ID descritivo (ex: "check_email") |
| **Zod** | Biblioteca de validação de schemas TypeScript |

### Páginas Comuns (page_key)

| Chave | Tipo | Descrição |
|-------|------|-----------|
| `auth` | auth | Tela de escolha (login ou cadastro) |
| `login` | login | Tela de login |
| `signup` | signup | Tela de cadastro |
| `recovery` | recovery | Recuperação de senha |
| `onboarding` | onboarding | Primeiro acesso |
| `dashboard` | dashboard | Tela principal |
| `settings` | settings | Configurações |
| `checkout` | checkout | Pagamento |
| `profile` | profile | Perfil do usuário |
| `confirmation` | confirmation | Tela de confirmação |
| `error` | error | Página de erro |
| `success` | success | Página de sucesso |

---

## 11. FAQ - Perguntas Frequentes

### Para Todos

**P: Quanto tempo leva para criar um fluxo?**
R: Geralmente 5-15 segundos, dependendo da complexidade.

**P: O que acontece se eu escrever algo confuso?**
R: Os agentes tentam entender e criar algo útil. Se algo ficar muito diferente do esperado, você pode ajustar manualmente ou tentar um prompt mais claro.

**P: Posso editar o fluxo depois de criado?**
R: Sim! O fluxo visual pode ser editado diretamente na interface.

**P: O que é o "Score de Qualidade"?**
R: É uma pontuação de 0 a 100 que indica quão completa e bem estruturada ficou a regra de negócio criada.

### Para Técnicos

**P: Posso usar outro modelo de IA?**
R: Sim, os modelos são configuráveis nas Edge Functions. O GPT-4 é usado para análise complexa, GPT-4o para mescla, e GPT-4o-mini para tarefas mais simples.

**P: Como funciona o autofix?**
R: Se a validação do grafo falhar na Etapa 8, o sistema chama o LLM novamente com um prompt de correção, explicando os erros detectados.

**P: Por que o Flow Generator não usa IA?**
R: Para garantir consistência e determinismo. Mesmo input sempre gera mesmo output. Isso evita variações indesejadas no layout.

**P: Como adicionar um novo tipo de nó?**
R: 1) Adicionar ao schema Zod, 2) Atualizar os tipos TypeScript, 3) Atualizar a engine de layout, 4) Criar o componente visual.

---

## 📞 Suporte

Para dúvidas sobre esta documentação ou sugestões:
- Abra uma issue no repositório
- Entre em contato com a equipe de desenvolvimento

---

*Documentação gerada em Dezembro 2024 - Versão 3.1*
*Arquitetura: 6 Agentes, 12 Etapas, Pipeline v3.0*













