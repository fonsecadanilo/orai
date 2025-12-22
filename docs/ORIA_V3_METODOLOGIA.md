# 📘 Metodologia Oria v3.1: Construção de User Flows Inteligentes

> **Versão:** 3.1  
> **Data:** Dezembro 2024  
> **Status:** Implementado

---

## 🏗️ Arquitetura Implementada

### Nova Cadeia de 6 Agentes

A arquitetura v3.1 substitui os agentes anteriores (`rules_master`, `subrules_decomposer`, `journey_builder`) por uma cadeia de 6 agentes especializados:

```
┌─────────────────────────────────────────────────────────────────┐
│                      USER PROMPT                                  │
└─────────────────────────────┬─────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  Agent 1: Product & Role Mapper                                   │
│  ├── Analisa contexto do produto (SaaS, Fintech, etc.)           │
│  ├── Identifica papéis/roles (admin, member, guest)              │
│  └── Define papel principal para o fluxo                         │
│  📁 lib/agents/v3/product-role-mapper.ts                          │
└─────────────────────────────┬─────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  Agent 2: Flow Synthesizer                                        │
│  ├── Sintetiza fluxo com steps, decisions, failures              │
│  ├── Detecta padrões reutilizáveis                               │
│  └── Calcula complexidade do fluxo                               │
│  📁 lib/agents/v3/flow-synthesizer.ts                             │
└─────────────────────────────┬─────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  Agent 3: Archetype Modeler                                       │
│  ├── Aplica arquétipos (UX, Segurança, Compliance)               │
│  ├── Mapeia padrões para cada passo                              │
│  └── Enriquece fluxo com recomendações                           │
│  📁 lib/agents/v3/archetype-modeler.ts                            │
└─────────────────────────────┬─────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  Agent 4: Flow Critic                                             │
│  ├── Valida completude e consistência                            │
│  ├── Calcula Score de Integridade (0-100)                        │
│  ├── Aplica auto-fixes quando possível                           │
│  └── Lista problemas por severidade                              │
│  📁 lib/agents/v3/flow-critic.ts                                  │
└─────────────────────────────┬─────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  Agent 5: UX Block Composer (Adaptativo)                          │
│  ├── Consulta biblioteca ux_blocks                               │
│  ├── NUNCA copia blocos - sempre adapta                          │
│  ├── Aplica regras de adaptação (persona, page_key, intent)      │
│  └── Gera subnós hierárquicos                                    │
│  📁 lib/agents/v3/ux-block-composer-v3.ts                         │
│  📁 lib/ux-library/index.ts                                       │
└─────────────────────────────┬─────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  Agent 6: Flow Connector & Reusability Tracker                    │
│  ├── Cria conexões (edges) entre nós                             │
│  ├── Rastreia reuso entre fluxos                                 │
│  ├── Detecta referências cruzadas                                │
│  └── Gera grafo de dependências                                  │
│  📁 lib/agents/v3/flow-connector.ts                               │
│  📁 lib/reuse/index.ts                                            │
└─────────────────────────────┬─────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      RESULTADO FINAL                              │
│  ├── flow_id, master_rule_id                                     │
│  ├── final_nodes (V3FlowNode[])                                  │
│  ├── final_connections (NodeConnection[])                        │
│  ├── integrity_score (0-100)                                     │
│  └── reusability_info                                            │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🎨 Tipos de Nós Expandidos (PR2)

### Tipos Principais

| Tipo | Descrição | Ícone | Cor |
|------|-----------|-------|-----|
| `form` | Formulário para entrada de dados | FileInput | #3b82f6 |
| `choice` | Escolha entre opções | ListChecks | #8b5cf6 |
| `action` | Ação executada pelo sistema | Zap | #f59e0b |
| `feedback_success` | Feedback positivo | CheckCircle | #22c55e |
| `feedback_error` | Feedback de erro | XCircle | #ef4444 |
| `condition` | Condição/decisão | GitBranch | #6366f1 |
| `end_success` | Término bem-sucedido | CheckCircle2 | #22c55e |
| `end_error` | Término com erro | XOctagon | #ef4444 |
| `end_neutral` | Término neutro | Circle | #6b7280 |
| `retry` | Tentativa novamente | RotateCcw | #f97316 |
| `fallback` | Caminho alternativo | ArrowLeftRight | #eab308 |
| `loopback` | Retorno a passo anterior | Undo2 | #14b8a6 |
| `background_action` | Ação em background | Server | #64748b |
| `delayed_action` | Ação com delay | Clock | #06b6d4 |
| `configuration_matrix` | Matriz de configuração | Table2 | #a855f7 |
| `insight_branch` | Ramificação por dados | Lightbulb | #ec4899 |

### Tipos de Subnós

| Tipo | Descrição |
|------|-----------|
| `input_field` | Campo de entrada individual |
| `modal_step` | Passo dentro de modal |
| `field_group` | Grupo de campos relacionados |
| `validation_rule` | Regra de validação |
| `interactive_component` | Componente interativo |
| `option_choice` | Opção de escolha |
| `button` | Botão de ação |
| `condition_branch` | Ramo de condição |

### Atributos Adicionais

```typescript
interface V3FlowNode {
  // Identificação
  id: string;
  flow_id: string;
  type: MainNodeType;
  
  // Atributos v3.1
  impact_level: "low" | "medium" | "high";
  role_scope?: "admin" | "member" | "guest" | ...;
  group_label?: string;
  
  // Reuso
  reused: boolean;
  source_flow_id?: string;
  referenced_in?: string[];
  subpages?: string[];
  
  // Hierarquia
  parent_node_id?: string;
  children?: SubNode[];
  
  // UX
  inputs?: InputField[];
  actions?: NodeAction[];
  feedback_messages?: FeedbackMessage[];
}
```

**Arquivos:**
- `lib/schemas/nodeTypesV3.ts` - Schemas Zod
- `types/flow-nodes.ts` - Tipos TypeScript

---

## 🧩 Biblioteca UX Adaptativa (PR3)

### Princípio Fundamental

> **O agente NUNCA copia blocos da biblioteca literalmente.**
> Sempre adapta conforme: `persona`, `page_key`, `intent`, `stage`, `inputs`.

### Regras de Adaptação

```typescript
const ADAPTATION_RULES = [
  // Em fintech, emails devem ter validação extra
  {
    id: "fintech_email_validation",
    condition: (ctx) => ctx.product_type === "fintech",
    apply: (inputs) => inputs.map(i => 
      i.field_type === "email" 
        ? { ...i, validation_rules: [...i.validation_rules, "corporate_email_preferred"] }
        : i
    ),
  },
  
  // Para admins, mostrar campos adicionais
  {
    id: "admin_extra_fields",
    condition: (ctx) => ctx.role_scope === "admin",
    // ...
  },
  
  // Em checkout, validação em tempo real obrigatória
  {
    id: "checkout_realtime_validation",
    condition: (ctx) => ctx.page_key?.includes("checkout"),
    // ...
  },
];
```

### Output de Bloco Adaptado

```json
{
  "block_id": "invite_user_block",
  "adapted": true,
  "input_fields": [
    { "label": "Email", "type": "email", "required": true },
    { "label": "Permissão", "type": "select", "options": ["admin", "member"] }
  ],
  "tooltip": "Insira um email válido do time."
}
```

**Arquivos:**
- `lib/ux-library/index.ts` - Sistema de adaptação
- `lib/agents/v3/ux-block-composer-v3.ts` - Agent 5

---

## 🔁 Reuso e Referência Cruzada (PR4)

### Dados Salvos no Nó

```typescript
interface ReuseMetadata {
  reused: boolean;
  reuse_type: "reference" | "clone";
  source_flow_id: number;
  primary_flow_id: number;
  referenced_in: number[];
  subpages: string[];
  last_synced_at: string;
}
```

### Funcionalidades

```typescript
// Marcar nó como reutilizado
await markNodeAsReused(nodeId, sourceFlowId, "reference");

// Clonar nó de outro fluxo
const clonedId = await cloneNodeFromFlow(sourceNodeId, targetFlowId, x, y);

// Obter grafo de dependências
const graph = await getFlowDependencyGraph(flowId);

// Sugerir nós similares para reuso
const suggestions = await suggestSimilarNodes(title, type, projectId);
```

**Arquivos:**
- `lib/reuse/index.ts` - Sistema de reuso completo

---

## 🧱 Subnós e Hierarquia (PR5)

### Estrutura Hierárquica

```
form → field_group → input_field
     └─ validation_rule
     └─ button
```

### Operações de Hierarquia

```typescript
// Criar subnó
await createSubNode(parentNodeId, {
  subtype: "input_field",
  title: "Email",
  content: { field_type: "email" },
});

// Reordenar subnós
await reorderSubNodes(parentNodeId, ["sub_1", "sub_3", "sub_2"]);

// Obter hierarquia para exibição
const hierarchy = getNodeHierarchy(node);
const flattened = flattenHierarchy(hierarchy);
```

### Serialização no Banco

Subnós são serializados no campo `metadata.children` do nó pai:

```json
{
  "children": [
    {
      "subnode_id": "123_sub_1",
      "subnode_type": "input_field",
      "parent_node_id": "123",
      "order_index": 0,
      "title": "Email",
      "content": { "field_type": "email" }
    }
  ],
  "has_children": true
}
```

**Arquivos:**
- `lib/hierarchy/index.ts` - Sistema de hierarquia

---

## ✅ Validador e Score de Integridade (PR6)

### Regras de Validação

| Código | Categoria | Severidade | Descrição |
|--------|-----------|------------|-----------|
| STRUCT_001 | structure | error | Ponto de entrada único |
| STRUCT_002 | structure | error | Término de sucesso |
| STRUCT_003 | structure | error | Conditions com 2 caminhos |
| STRUCT_004 | structure | error | End nodes sem saídas |
| COMP_001 | completeness | warning | Fallback para ações sensíveis |
| COMP_002 | completeness | warning | Feedback após erros |
| UX_001 | ux | suggestion | Formulários curtos |
| SEC_001 | security | warning | Rate limiting em auth |

### Score de Integridade

```typescript
const result = validateFlow(nodes, connections);

console.log(result.integrity_score); // 85
console.log(result.is_valid);        // true
console.log(result.summary);         // { errors: 0, warnings: 2, ... }
```

### Exibição no Canvas

```typescript
const display = formatIntegrityScore(score);
// { value: 85, label: "Bom", color: "#84cc16", icon: "ThumbsUp" }
```

| Score | Label | Cor |
|-------|-------|-----|
| 90-100 | Excelente | Verde |
| 70-89 | Bom | Verde-limão |
| 50-69 | Atenção | Amarelo |
| 30-49 | Problemas | Laranja |
| 0-29 | Crítico | Vermelho |

### Auto-Fix

```typescript
const { nodes, connections, fixes_applied } = autoFixFlow(nodes, connections);
// fixes_applied: ["Ponto de Entrada Único", "Término de Sucesso"]
```

**Arquivos:**
- `lib/validation/flow-integrity.ts` - Sistema completo

---

## 📁 Estrutura de Arquivos

```
lib/
├── agents/
│   ├── v3/
│   │   ├── index.ts                    # Exportações v3
│   │   ├── types.ts                    # Tipos da pipeline
│   │   ├── product-role-mapper.ts      # Agent 1
│   │   ├── flow-synthesizer.ts         # Agent 2
│   │   ├── archetype-modeler.ts        # Agent 3
│   │   ├── flow-critic.ts              # Agent 4
│   │   ├── ux-block-composer-v3.ts     # Agent 5
│   │   ├── flow-connector.ts           # Agent 6
│   │   └── orchestrator-v3.ts          # Pipeline integrada
│   └── index.ts                        # Re-exporta v3
├── schemas/
│   ├── nodeTypesV3.ts                  # Tipos de nós v3.1
│   └── index.ts                        # Exporta tudo
├── ux-library/
│   └── index.ts                        # Biblioteca UX adaptativa
├── reuse/
│   └── index.ts                        # Sistema de reuso
├── hierarchy/
│   └── index.ts                        # Subnós e hierarquia
└── validation/
    └── flow-integrity.ts               # Validador + Score
```

---

## 🚀 Uso da Pipeline v3.1

```typescript
import { executeV3Pipeline } from "@/lib/agents/v3";

const result = await executeV3Pipeline({
  prompt: "Crie um fluxo de login com recuperação de senha",
  project_id: 1,
  user_id: 1,
  options: {
    validation_level: "standard",
    include_reuse_analysis: true,
    include_archetype_modeling: true,
    auto_fix_issues: true,
  },
}, (progress) => {
  console.log(`${progress.step}: ${progress.message} (${progress.percentage}%)`);
});

console.log("Flow ID:", result.flow_id);
console.log("Score:", result.summary.integrity_score);
console.log("Nós:", result.final_nodes.length);
```

---

## 📋 Resultado Esperado

- ✅ Fluxos construídos com contexto real de produto
- ✅ Tipos e subnós ricos em semântica
- ✅ Blocos UX reutilizados com adaptação inteligente
- ✅ Fluxos com caminhos completos, consistentes e rastreáveis
- ✅ Score de integridade visível no canvas
- ✅ Sistema de reuso entre fluxos funcionando

---

> **Documento gerado para a equipe técnica da Oria**  
> Para dúvidas, consulte o código-fonte em `/lib/agents/v3/` e arquivos relacionados.









