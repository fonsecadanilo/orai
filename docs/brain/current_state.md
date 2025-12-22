# Brain Agent - Current State Audit
> **Data:** 22 Dezembro 2025  
> **Versão:** v1.0.0  
> **Status:** Auditoria Completa

---

## 📊 TABELAS DO EDITOR (EXISTENTES - REAPROVEITAR)

| Tabela | Rows | Status | Notas |
|--------|------|--------|-------|
| `flows` | 38 | ✅ Reaproveitar | Com metadata jsonb |
| `nodes` | 389 | ✅ Reaproveitar | Suporta tipos v3.1 (trigger, form, choice, condition, end_success, etc.) |
| `connections` | 290 | ✅ Reaproveitar | Com label, connection_type, metadata |
| `rules` | 137 | ✅ Reaproveitar | Suporta global, flow_master, node_rule |
| `user_journeys` | 18 | ✅ Reaproveitar | |
| `suggested_features` | 52 | ✅ Reaproveitar | |

---

## 🧠 TABELAS DO BRAIN (JÁ EXISTEM)

| Tabela | Rows | RLS | Status |
|--------|------|-----|--------|
| `brain_threads` | 9 | ❌ | ✅ Existe |
| `brain_messages` | 8 | ❌ | ✅ Existe |
| `brain_canvas_blocks` | 10 | ❌ | ✅ Existe (inclui plan_id) |
| `brain_flow_plans` | 0 | ❌ | ✅ Existe |
| `brain_flow_plan_versions` | 0 | ❌ | ✅ Existe |
| `brain_migrations` | 0 | ❌ | ✅ Existe |
| `product_profiles` | 0 | ❌ | ✅ Existe |
| `personas` | 0 | ❌ | ✅ Existe |
| `business_rules` | 0 | ❌ | ✅ Existe (diferente de rules) |
| `flow_registry` | 0 | ❌ | ✅ Existe |
| `flow_specs` | 0 | ❌ | ✅ Existe |

---

## ⚡ EDGE FUNCTIONS DO BRAIN (DEPLOYADAS)

| Função | Version | Status | OpenAI | Streaming |
|--------|---------|--------|--------|-----------|
| `brain-message-send` | v3 | ✅ ACTIVE | ✅ Real | ✅ SSE |
| `brain-thread-create` | v1 | ✅ ACTIVE | - | - |
| `brain-thread-get` | v1 | ✅ ACTIVE | - | - |
| `brain-plan-get` | v1 | ✅ ACTIVE | - | - |
| `brain-plan-upsert` | v1 | ✅ ACTIVE | - | - |
| `brain-plan-approve-build` | v1 | ✅ ACTIVE | - | - |
| `brain-actions-apply` | v1 | ✅ ACTIVE | - | - |
| `editor-add-brain-block` | v1 | ✅ ACTIVE | - | - |

### Builders v3.1 (DEPLOYADOS)

| Função | Version | Status |
|--------|---------|--------|
| `v3-flow-synthesizer` | v8 | ✅ ACTIVE |
| `v3-product-role-mapper` | v4 | ✅ ACTIVE |
| `v3-archetype-modeler` | v5 | ✅ ACTIVE |
| `v3-flow-critic` | v3 | ✅ ACTIVE |
| `v3-ux-block-composer` | v3 | ✅ ACTIVE |
| `v3-flow-connector` | v10 | ✅ ACTIVE |
| `v3-ux-block-composer-v3` | v6 | ✅ ACTIVE |

---

## 🖥️ FRONTEND (IMPLEMENTADO)

### Componentes

| Arquivo | Status | Notas |
|---------|--------|-------|
| `EditorToolbar.tsx` | ✅ Implementado | Botão Brain 🧠 com fallback local |
| `BrainChatNode.tsx` | ✅ Implementado | 3 abas (Chat, Plan, Actions) |
| `FlowEditor.tsx` | ✅ Implementado | Registra `brain_chat` como nodeType |
| `nodes/index.ts` | ✅ Exporta | BrainChatNode + BrainChatNodeData |

### NodeTypes Registrados

```typescript
const nodeTypes = {
  // ...
  brain_chat: BrainChatNode,
  // ...
};
```

### Handler de Criação

```typescript
handleBrainBlockCreate: (data) => {
  // Cria node ReactFlow para Brain Block
  // Faz pan/zoom para o novo bloco
}
```

---

## ✅ GAPS CORRIGIDOS (22 Dez 2025)

### P0 - Críticos ✅

| Gap | Status | Solução |
|-----|--------|---------|
| **canvas_edges** | ✅ CORRIGIDO | Tabela criada com suporte a 6 edge_types |
| **RLS** | ✅ CORRIGIDO | Todas as tabelas brain_* e editor têm RLS |
| **BrainChatNode handles** | ✅ CORRIGIDO | Adicionados handles laterais (in_ref/out_ref) |

### P1 - Importantes ✅

| Gap | Status | Solução |
|-----|--------|---------|
| Toggle "Show Brain Links" | ✅ CORRIGIDO | Botão no FlowEditor |
| Rate limiting | ⏳ PENDENTE | A implementar |
| Membership validation | ⏳ PARCIAL | Alguns endpoints validam |

### P2 - Nice to Have

| Gap | Descrição |
|-----|-----------|
| Realtime subscriptions | brain_canvas_blocks e canvas_edges têm realtime |
| Auto-fix branching | Stats registrados mas UI não mostra |

---

## 🔄 FLUXO ATUAL DO BRAIN

```
┌─────────────────┐
│  EditorToolbar  │ ───► handleBrainClick
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Supabase Direct │ ───► brain_threads + brain_canvas_blocks
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  FlowEditor     │ ───► handleBrainBlockCreate
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ BrainChatNode   │ ───► Realtime subscription
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ brain-message-  │ ───► OpenAI + Streaming + Actions
│     send        │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ upsert_brain_   │ ───► brain_flow_plans
│   flow_plan     │
└────────┬────────┘
         │ (User clicks Approve & Build)
         ▼
┌─────────────────┐
│ brain-plan-     │ ───► HARD GATE (server-side)
│ approve-build   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ v3-flow-        │ ───► flows + nodes + connections
│ synthesizer     │
└─────────────────┘
```

---

## ✅ O QUE ESTÁ FUNCIONANDO

1. ✅ Brain Block criação via toolbar (com fallback)
2. ✅ OpenAI real + streaming + roteamento (PLAN/CONSULT/BATCH/LONG_CONTEXT)
3. ✅ Actions executam (upsert_brain_flow_plan, upsert_rule, upsert_spec)
4. ✅ Plan versioning (v1, v2, v3...)
5. ✅ Approve & Build gate server-side
6. ✅ v3-flow-synthesizer gera flows
7. ✅ BrainChatNode com 3 abas
8. ✅ Realtime updates durante streaming

---

## 🔧 PRÓXIMOS PASSOS

### Fase 1 - DB Migrations
1. Criar tabela `canvas_edges`
2. Habilitar RLS em todas as tabelas brain_*
3. Criar índices e policies

### Fase 2 - BrainChatNode Handles
1. Adicionar handles laterais (left: in_ref, right: out_ref)
2. Implementar onConnect para canvas_edges

### Fase 3 - Edge UI
1. Persistir canvas_edges no onConnect
2. UI para editar edge_type
3. Toggle "Show Brain Links"

### Fase 4 - Hardening
1. Rate limiting por project_id + user_id
2. Validar membership em todas as Edge Functions
3. Logs detalhados

---

## 📝 NOTAS DE IMPLEMENTAÇÃO

### brain-message-send - OpenAI Integration

```typescript
// Já implementado em supabase/functions/brain-message-send/index.ts

import OpenAI from "https://deno.land/x/openai@v4.68.1/mod.ts";

// Roteamento inteligente
const routeResult = await route(request.user_prompt, contextStats, classifierFn);

// Streaming
const completion = await openai.chat.completions.create({
  model: mapModelName(currentModel),
  messages,
  stream: true,
});

// SSE events: start, delta, metadata, complete, actions, error
```

### brain-plan-approve-build - Hard Gate

```typescript
// Já implementado em supabase/functions/brain-plan-approve-build/index.ts

// Validações OBRIGATÓRIAS antes de aprovar:
// 1. Plan existe e status é draft/revised
// 2. project_id corresponde
// 3. plan_json tem flow_goal e steps

// Depois de aprovado:
// 1. status = approved
// 2. Dispara v3-flow-synthesizer
// 3. status = building
// 4. Ao finalizar: status = built + result_flow_id
// 5. Cria edge generated_from (via metadata no flow)
```

---

*Documento gerado em 22 Dezembro 2025*

