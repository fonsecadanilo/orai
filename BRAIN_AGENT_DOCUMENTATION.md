# 🧠 Brain Agent - Documentação Técnica Completa

> **Versão:** 1.0.0  
> **Data:** Dezembro 2024  
> **Status:** Em desenvolvimento (integração OpenAI pendente na versão de produção)

---

## 📋 Índice

1. [Visão Geral](#visão-geral)
2. [Arquitetura](#arquitetura)
3. [Edge Functions](#edge-functions)
4. [Sistema de Roteamento](#sistema-de-roteamento)
5. [Modos de Operação](#modos-de-operação)
6. [Schema do Banco de Dados](#schema-do-banco-de-dados)
7. [Flow de Mensagens](#flow-de-mensagens)
8. [Sistema de Planos](#sistema-de-planos)
9. [Componentes Frontend](#componentes-frontend)
10. [Configuração e Deploy](#configuração-e-deploy)
11. [Pendências e Roadmap](#pendências-e-roadmap)

---

## 🎯 Visão Geral

O **Brain** é o agente de inteligência do Oria, responsável por:

- 💬 **Consultas rápidas** sobre o projeto (modo CONSULT)
- 📐 **Planejamento e arquitetura** de flows (modo PLAN)
- 🔄 **Transformações em lote** (modo BATCH)
- 📚 **Processamento de contextos grandes** (modo LONG_CONTEXT)

### Principais Características

| Característica | Descrição |
|----------------|-----------|
| **Roteamento Inteligente** | Seleciona automaticamente o melhor modelo LLM baseado no prompt |
| **Streaming** | Respostas em tempo real via Server-Sent Events (SSE) |
| **Ações Estruturadas** | Pode executar ações como criar regras, specs, flows |
| **Multi-modelo** | Suporta fallback chain para garantir disponibilidade |
| **Planos de Flow** | Sistema completo de planejamento com aprovação manual |

---

## 🏗 Arquitetura

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND                                 │
├─────────────────────────────────────────────────────────────────┤
│  BrainChat.tsx  │  useBrain.ts  │  lib/brain/client.ts          │
└────────┬────────────────┬───────────────────┬───────────────────┘
         │                │                   │
         │  HTTP/SSE      │                   │
         ▼                ▼                   ▼
┌─────────────────────────────────────────────────────────────────┐
│                    SUPABASE EDGE FUNCTIONS                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────────┐  ┌──────────────────────┐             │
│  │  brain-message-send  │  │  brain-thread-create │             │
│  │  (Streaming + OpenAI)│  │                      │             │
│  └──────────┬───────────┘  └──────────────────────┘             │
│             │                                                    │
│  ┌──────────▼───────────┐  ┌──────────────────────┐             │
│  │   brain-router.ts    │  │  brain-thread-get    │             │
│  │   (Roteamento)       │  │                      │             │
│  └──────────┬───────────┘  └──────────────────────┘             │
│             │                                                    │
│  ┌──────────▼───────────┐  ┌──────────────────────┐             │
│  │   brain-configs.ts   │  │  brain-plan-*        │             │
│  │   (System Prompts)   │  │  (Planos de Flow)    │             │
│  └──────────────────────┘  └──────────────────────┘             │
│                                                                  │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                         OPENAI API                               │
│                   (gpt-4o, gpt-4o-mini, o1)                      │
└─────────────────────────────────────────────────────────────────┘
```

### Arquivos Principais

```
supabase/functions/
├── _shared/
│   ├── brain-types.ts       # Tipos compartilhados (Deno)
│   ├── brain-configs.ts     # Configurações e system prompts
│   └── brain-router.ts      # Lógica de roteamento
├── brain-message-send/      # Principal - envia mensagens
├── brain-thread-create/     # Cria threads
├── brain-thread-get/        # Busca threads
├── brain-plan-get/          # Busca planos
├── brain-plan-upsert/       # Cria/atualiza planos
├── brain-plan-approve-build/# Aprova e dispara build
├── brain-actions-apply/     # Aplica ações
└── editor-add-brain-block/  # Adiciona block no canvas

lib/brain/
├── types.ts                 # Tipos TypeScript (Next.js)
├── client.ts                # Cliente HTTP/SSE
├── router.ts                # Roteamento (mirror)
├── configs.ts               # Configs (mirror)
├── classifier.ts            # Classificador LLM
├── token-estimator.ts       # Estimador de tokens
└── schemas.ts               # Schemas Zod

components/brain/
├── BrainChat.tsx            # Interface de chat
└── index.ts                 # Exports

hooks/
└── useBrain.ts              # Hook React
```

---

## ⚡ Edge Functions

### 1. `brain-message-send` (Principal)

**Endpoint:** `POST /brain-message-send`

**Responsabilidades:**
- Receber prompt do usuário
- Carregar contexto do projeto
- Rotear para modelo adequado
- Chamar OpenAI com streaming
- Salvar mensagens no banco
- Executar ações estruturadas

**Request:**
```typescript
interface BrainMessageSendRequest {
  project_id: number;
  thread_id?: string;        // Se vazio, cria novo thread
  user_prompt: string;
  editor_context?: {
    selected_node_ids?: string[];
    viewport?: { x: number; y: number; zoom: number };
    current_flow_id?: string;
    editor_mode?: "view" | "edit" | "comment";
  };
  force_mode?: "PLAN" | "CONSULT" | "BATCH" | "LONG_CONTEXT";
  force_model?: string;
}
```

**Response:** Stream de eventos SSE

```typescript
// Evento de início
{ type: "start", thread_id: string, message_id: string, mode: BrainMode, model: BrainModel }

// Eventos de conteúdo (streaming)
{ type: "delta", content: string, index: number }

// Metadados
{ type: "metadata", metadata: Partial<BrainMessageMetadata> }

// Conclusão
{ type: "complete", message: BrainMessage, output?: BrainOutput }

// Ações executadas
{ type: "actions", actions: BrainAction[], results: ActionResult[] }

// Erro
{ type: "error", error: string, failed_model?: string, fallback_model?: string }
```

**⚠️ STATUS ATUAL:** A versão em produção está **simplificada para teste** e retorna resposta estática. A versão completa está em `index.ts.backup`.

---

### 2. `brain-thread-create`

**Endpoint:** `POST /brain-thread-create`

```typescript
// Request
{
  project_id: number,
  user_id: number,
  title?: string,
  initial_message?: string
}

// Response
{
  success: boolean,
  thread: BrainThread,
  message: string
}
```

---

### 3. `brain-thread-get`

**Endpoint:** `POST /brain-thread-get`

```typescript
// Request
{
  thread_id: string,
  include_messages?: boolean,  // default: true
  messages_limit?: number      // default: 50
}

// Response
{
  success: boolean,
  thread: BrainThread,
  messages?: BrainMessage[],
  message: string
}
```

---

### 4. `brain-plan-upsert`

**Endpoint:** `POST /brain-plan-upsert`

Cria ou atualiza um plano de flow. Mantém versionamento automático.

```typescript
// Request
{
  project_id: number,
  thread_id: string,
  canvas_block_id: string,
  plan_md: string,           // Plano em Markdown
  plan_json: {               // Estrutura do plano
    flow_goal: string,
    actors: string[],
    steps: [...],
    decision_points: [...],
    failure_points: [...],
    inputs: [...],
    rules_refs: string[],
    assumptions: [...],
    acceptance_checklist: string[]
  },
  flow_key?: string,
  change_summary?: string
}
```

**Regras de Versionamento:**
- Não permite atualizar planos com status `approved`, `building`, `built`
- Salva versão anterior em `brain_flow_plan_versions`
- Incrementa `plan_version` automaticamente

---

### 5. `brain-plan-approve-build`

**Endpoint:** `POST /brain-plan-approve-build`

**⚠️ SERVER GATE:** Este é o ÚNICO ponto de entrada para aprovação e construção de flows.

```typescript
// Request
{
  project_id: number,
  plan_id: string,
  approved_by: string
}

// Response
{
  success: boolean,
  plan: BrainFlowPlan,
  build_job_id?: string,
  message: string
}
```

**Flow de Aprovação:**
```
draft → approved → building → built
                     ↓
                  (erro) → revised (permite retry)
```

---

### 6. `brain-actions-apply`

**Endpoint:** `POST /brain-actions-apply`

Aplica ações geradas pelo Brain de forma idempotente.

**Tipos de Ações Suportadas:**

| Tipo | Descrição |
|------|-----------|
| `upsert_rule` | Criar/atualizar regra de negócio |
| `upsert_spec` | Criar/atualizar spec de flow |
| `upsert_flow` | Criar/atualizar flow |
| `update_registry` | Atualizar registry |
| `create_persona` | Criar persona |
| `update_product_profile` | Atualizar perfil do produto |
| `create_migration` | Criar migration SQL |
| `notify_user` | Notificar usuário |

---

## 🎯 Sistema de Roteamento

O roteamento é feito em **dois gates**:

### Gate 1: Determinístico (Sem custo LLM)

Baseado em regex patterns para detectar intenção:

```typescript
// PLAN patterns
/criar\s*(nova?)?\s*(arquitetura|estrutura|pipeline)/i
/refatorar/i
/criar\s*(nova?)?\s*regra/i
/conflito/i

// CONSULT patterns
/^(o\s*que|what)\s+(é|is|são|are)/i
/\?$/
/explic(ar|a|ação)/i

// BATCH patterns
/reescrever\s*(todos?|todas?)?/i
/traduzir\s*(para|to)?/i
/normalizar/i
```

### Gate 2: Classifier (Opcional, se incerto)

Usa `gpt-4o-mini` para classificar prompts ambíguos:

```typescript
// Entrada
{ prompt: string, context_stats: ContextStats }

// Saída
{ 
  mode: BrainMode, 
  complexity: 0-1, 
  risk_level: "low" | "medium" | "high",
  confidence: 0-1 
}
```

### Fallback Chain

Cada modo tem uma cadeia de fallback para garantir disponibilidade:

```typescript
{
  PLAN: ["gpt-4o", "gpt-4o-mini"],
  PLAN_PRO: ["o1", "gpt-4o", "gpt-4o-mini"],
  CONSULT: ["gpt-4o-mini", "gpt-4o"],
  BATCH: ["gpt-4o-mini", "gpt-4o"],
  LONG_CONTEXT: ["gpt-4o", "gpt-4o-mini"]
}
```

---

## 🎨 Modos de Operação

### PLAN
- **Uso:** Arquitetura, regras, specs, refatoração, resolução de conflitos
- **Modelo padrão:** `gpt-4o`
- **Modelo alto risco:** `o1`
- **Output:** Estruturado (JSON)
- **Max tokens:** 16,000 (32,000 para PRO)
- **Temperature:** 0.3

### CONSULT
- **Uso:** Perguntas rápidas, explicações, sugestões
- **Modelo padrão:** `gpt-4o-mini`
- **Output:** Texto livre ou JSON
- **Max tokens:** 4,000
- **Temperature:** 0.5

### BATCH
- **Uso:** Transformações em lote, normalização, tradução
- **Modelo padrão:** `gpt-4o-mini`
- **Output:** Estruturado (JSON)
- **Max tokens:** 8,000
- **Temperature:** 0.2

### LONG_CONTEXT
- **Uso:** Contexto > 250k tokens
- **Modelo padrão:** `gpt-4o`
- **Output:** Estruturado (JSON)
- **Max tokens:** 16,000
- **Temperature:** 0.3

---

## 🗄 Schema do Banco de Dados

### Tabelas Necessárias

```sql
-- Threads de conversa
CREATE TABLE brain_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  title TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  messages_count INTEGER DEFAULT 0,
  last_message_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Mensagens
CREATE TABLE brain_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID REFERENCES brain_threads(id) ON DELETE CASCADE,
  project_id INTEGER NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  structured_output JSONB,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Blocos no canvas
CREATE TABLE brain_canvas_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id INTEGER NOT NULL,
  thread_id UUID REFERENCES brain_threads(id) ON DELETE CASCADE,
  block_type TEXT DEFAULT 'brain_chat',
  position_x REAL DEFAULT 0,
  position_y REAL DEFAULT 0,
  width REAL DEFAULT 400,
  height REAL DEFAULT 300,
  streaming BOOLEAN DEFAULT FALSE,
  content TEXT DEFAULT '',
  mode TEXT,
  model TEXT,
  plan_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Planos de flow
CREATE TABLE brain_flow_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id INTEGER NOT NULL,
  thread_id UUID REFERENCES brain_threads(id),
  canvas_block_id UUID,
  flow_key TEXT,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'revised', 'approved', 'building', 'built', 'cancelled')),
  plan_version INTEGER DEFAULT 1,
  plan_md TEXT NOT NULL,
  plan_json JSONB NOT NULL,
  approved_at TIMESTAMPTZ,
  approved_by TEXT,
  build_job_id UUID,
  result_flow_id INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Histórico de versões
CREATE TABLE brain_flow_plan_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID REFERENCES brain_flow_plans(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  plan_md TEXT NOT NULL,
  plan_json JSONB NOT NULL,
  change_summary TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX idx_brain_threads_project ON brain_threads(project_id);
CREATE INDEX idx_brain_messages_thread ON brain_messages(thread_id);
CREATE INDEX idx_brain_canvas_blocks_thread ON brain_canvas_blocks(thread_id);
CREATE INDEX idx_brain_flow_plans_project ON brain_flow_plans(project_id);
```

### Tabelas de Contexto (Opcionais, para carregar no prompt)

```sql
-- Perfil do produto
CREATE TABLE product_profiles (
  id SERIAL PRIMARY KEY,
  project_id INTEGER NOT NULL UNIQUE,
  product_name TEXT NOT NULL,
  product_type TEXT,
  industry TEXT,
  business_model TEXT,
  main_value_proposition TEXT,
  key_features TEXT[],
  target_audience TEXT,
  maturity_stage TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Personas
CREATE TABLE personas (
  id SERIAL PRIMARY KEY,
  project_id INTEGER NOT NULL,
  role_id TEXT NOT NULL,
  role_name TEXT NOT NULL,
  role_scope TEXT,
  permissions TEXT[],
  restrictions TEXT[],
  typical_goals TEXT[],
  pain_points TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Regras de negócio
CREATE TABLE business_rules (
  id SERIAL PRIMARY KEY,
  project_id INTEGER NOT NULL,
  rule_key TEXT,
  rule_name TEXT NOT NULL,
  rule_type TEXT DEFAULT 'business',
  description TEXT,
  conditions JSONB DEFAULT '{}',
  actions JSONB DEFAULT '{}',
  status TEXT DEFAULT 'draft',
  version INTEGER DEFAULT 1,
  priority INTEGER DEFAULT 50,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(project_id, rule_key)
);

-- Registry de flows
CREATE TABLE flow_registry (
  id SERIAL PRIMARY KEY,
  project_id INTEGER NOT NULL,
  flow_id TEXT NOT NULL,
  flow_name TEXT NOT NULL,
  flow_type TEXT,
  entry_node_id TEXT,
  exit_node_ids TEXT[],
  node_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Specs de flow
CREATE TABLE flow_specs (
  id SERIAL PRIMARY KEY,
  project_id INTEGER NOT NULL,
  spec_key TEXT,
  spec_name TEXT NOT NULL,
  spec_content JSONB NOT NULL,
  spec_type TEXT DEFAULT 'flow',
  version INTEGER DEFAULT 1,
  is_latest BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 🔄 Flow de Mensagens

```
┌─────────────────────────────────────────────────────────────────────┐
│  1. Usuário digita mensagem no BrainChat                            │
└─────────────────────────────┬───────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│  2. useBrain.sendMessage() envia para brain-message-send            │
└─────────────────────────────┬───────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│  3. Edge Function:                                                   │
│     a) Carrega contexto do projeto (product_profile, rules, etc.)   │
│     b) Carrega histórico do thread                                  │
│     c) Calcula estatísticas de contexto                             │
└─────────────────────────────┬───────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│  4. Roteamento:                                                      │
│     a) Gate determinístico (regex patterns)                         │
│     b) Se incerto → Gate classifier (gpt-4o-mini)                   │
│     c) Resolve modelo e parâmetros                                  │
└─────────────────────────────┬───────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│  5. Salva mensagem do usuário no banco                              │
└─────────────────────────────┬───────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│  6. Chama OpenAI com streaming:                                      │
│     - Envia event "start"                                           │
│     - Envia events "delta" conforme tokens chegam                   │
│     - Tenta fallback se modelo falhar                               │
└─────────────────────────────┬───────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│  7. Processa output:                                                 │
│     - Parseia JSON se modo estruturado                              │
│     - Executa ações (upsert_rule, etc.)                             │
│     - Salva mensagem do assistente                                  │
└─────────────────────────────┬───────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│  8. Envia events finais:                                             │
│     - "complete" com mensagem final                                 │
│     - "actions" com resultados das ações                            │
│     - "metadata" com métricas                                       │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 📋 Sistema de Planos

### Ciclo de Vida do Plano

```
                    ┌─────────┐
                    │  draft  │ ← Brain cria plano inicial
                    └────┬────┘
                         │
        ┌────────────────┼────────────────┐
        │                │                │
        ▼                ▼                ▼
   (usuário        (Brain           (usuário
    cancela)       revisa)           aprova)
        │                │                │
        ▼                ▼                ▼
┌───────────┐     ┌───────────┐    ┌──────────┐
│ cancelled │     │  revised  │    │ approved │
└───────────┘     └───────────┘    └────┬─────┘
                                        │
                                        ▼
                                 ┌───────────┐
                                 │ building  │ ← v3-flow-synthesizer
                                 └─────┬─────┘
                                       │
                         ┌─────────────┼─────────────┐
                         │                           │
                         ▼                           ▼
                  ┌───────────┐               ┌───────────┐
                  │   built   │               │  revised  │ ← erro
                  │           │               │ (retry)   │
                  └───────────┘               └───────────┘
```

### Estrutura do Plano JSON

```typescript
interface BrainFlowPlanJson {
  // Objetivo do flow
  flow_goal: "Permitir que usuário faça checkout em 3 passos";
  
  // Atores envolvidos
  actors: ["customer", "admin"];
  
  // Passos agrupados
  steps: [
    { order: 1, group: "Carrinho", title: "Revisar itens", description: "..." },
    { order: 2, group: "Pagamento", title: "Selecionar método", description: "..." }
  ];
  
  // Pontos de decisão
  decision_points: [
    { step_ref: 2, condition: "Cartão aprovado?", branches: ["sim", "não"] }
  ];
  
  // Pontos de falha
  failure_points: [
    { step_ref: 2, failure_type: "payment_declined", handling: "Mostrar erro e retry" }
  ];
  
  // Inputs necessários
  inputs: [
    { step_ref: 2, field_name: "card_number", field_type: "text", required: true }
  ];
  
  // Referências a regras
  rules_refs: ["rule_min_cart_value", "rule_payment_methods"];
  
  // Suposições
  assumptions: [
    { assumption: "Usuário já está logado", confidence: "high" }
  ];
  
  // Checklist para builders
  acceptance_checklist: [
    "Todos os passos têm feedback visual",
    "Erros são tratados graciosamente"
  ];
}
```

---

## 🖥 Componentes Frontend

### BrainChat

```tsx
import { BrainChat } from "@/components/brain";

<BrainChat
  projectId={123}
  userId={1}
  threadId={existingThreadId}  // opcional
  onThreadChange={(newId) => {}}
  onActionsApplied={(results) => {}}
/>
```

**Features:**
- Interface de chat responsiva
- Badges de mode/model em tempo real
- Streaming de respostas
- Painel de ações com botão "Aplicar"
- Indicador de loading animado
- Suporte a dark mode

### useBrain Hook

```tsx
import { useBrain } from "@/hooks/useBrain";

const {
  // Estado
  isLoading,
  isStreaming,
  error,
  
  // Thread
  thread,
  threadId,
  messages,
  
  // Streaming
  currentContent,
  currentMode,
  currentModel,
  
  // Metadados
  lastMetadata,
  lastOutput,
  
  // Ações
  sendMessage,
  createNewThread,
  loadThread,
  applyPendingActions,
  clearError,
  reset,
} = useBrain({
  projectId: 123,
  userId: 1,
  threadId: "...",
  loadExisting: true,
  onMessageComplete: (msg) => {},
  onError: (err) => {},
});
```

### Hook Simplificado

```tsx
import { useBrainQuickAsk } from "@/hooks/useBrain";

const { ask, isLoading, response, error } = useBrainQuickAsk(projectId);

// Uso
const answer = await ask("O que é o Oria?");
```

---

## ⚙️ Configuração e Deploy

### Variáveis de Ambiente Necessárias

```env
# Obrigatórias
OPENAI_API_KEY=sk-...
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Opcionais (com defaults)
BRAIN_MODEL_PLAN=gpt-4o
BRAIN_MODEL_PLAN_PRO=o1
BRAIN_MODEL_CONSULT=gpt-4o-mini
BRAIN_MODEL_BATCH=gpt-4o-mini
BRAIN_MODEL_LONG=gpt-4o
BRAIN_LONG_CONTEXT_THRESHOLD=250000
BRAIN_CLASSIFIER_ENABLED=true
BRAIN_HIGH_COMPLEXITY_THRESHOLD=0.6
```

### Deploy das Edge Functions

```bash
# Todas as funções
supabase functions deploy

# Função específica
supabase functions deploy brain-message-send

# Com secrets
supabase secrets set OPENAI_API_KEY=sk-...
```

### Migrations SQL

Execute o script em `scripts/brain-migration.sql` ou rode manualmente:

```bash
supabase db push
```

---

## 🚧 Pendências e Roadmap

### ⚠️ CRÍTICO: Integração OpenAI

**Status Atual:** A edge function `brain-message-send` está usando uma **versão simplificada para teste** que retorna resposta estática.

**Para Ativar:**
1. Renomear `index.ts` para `index.ts.test`
2. Renomear `index.ts.backup` para `index.ts`
3. Configurar `OPENAI_API_KEY` no Supabase secrets
4. Deploy da função

### Checklist de Implementação

| Item | Status | Descrição |
|------|--------|-----------|
| Edge Functions criadas | ✅ | Todas as 8 funções |
| Sistema de tipos | ✅ | Completo com Zod validation |
| Roteamento inteligente | ✅ | 2 gates + fallback chain |
| Cliente frontend | ✅ | SSE streaming support |
| Componente BrainChat | ✅ | UI completa |
| Hook useBrain | ✅ | Gerenciamento de estado |
| **Integração OpenAI** | ⏳ | Backup pronto, não ativado |
| **Migrations SQL** | ⏳ | Script pronto, não executado |
| Sistema de Planos | ✅ | CRUD + aprovação |
| Aplicação de Ações | ✅ | 8 action handlers |
| Testes automatizados | ❌ | A implementar |
| Rate limiting | ❌ | A implementar |
| Métricas/Analytics | ❌ | A implementar |

### Roadmap v1.1

- [ ] Ativar integração OpenAI em produção
- [ ] Implementar RAG para contextos grandes
- [ ] Adicionar suporte a imagens (vision)
- [ ] Implementar cache de respostas frequentes
- [ ] Dashboard de métricas
- [ ] Testes E2E automatizados

---

## 📞 Contato

Para dúvidas sobre a implementação do Brain Agent, entre em contato com a equipe de desenvolvimento.

---

*Documento gerado em Dezembro 2024*

