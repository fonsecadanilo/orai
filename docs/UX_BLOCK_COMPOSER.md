# Agente UX Block Composer v3.0

## Visão Geral

O **UX Block Composer** é o agente responsável por consultar a biblioteca de blocos UX e copiar/adaptar blocos relevantes para o contexto do usuário.

## Arquitetura

### Edge Function
- **Nome**: `v3-ux-block-composer`
- **Localização**: `supabase/functions/v3-ux-block-composer/index.ts`
- **Status**: ✅ Deploy realizado

### Cliente TypeScript
- **Localização**: `lib/agents/ux-block-composer.ts`
- **Exportado em**: `lib/agents/index.ts`

## Funcionalidades

### 1. Consulta Inteligente de Blocos
- Busca blocos na biblioteca `ux_blocks` baseado em:
  - Casos de uso (`use_cases`)
  - Tipo de negócio
  - Query de busca textual
  - Arquétipo do fluxo

### 2. Seleção e Adaptação com IA
- Usa GPT-4o-mini para:
  - Analisar contexto do projeto
  - Selecionar blocos mais relevantes
  - Adaptar blocos para o contexto específico
  - Manter boas práticas de UX

### 3. Retorno de Blocos Adaptados
- Retorna blocos com:
  - `block_id`: ID do bloco original
  - `block_label`: Label do bloco
  - `relevance_score`: Score de relevância (0-1)
  - `adapted_semantic_flow`: Fluxo semântico adaptado
  - `adaptation_notes`: Notas sobre adaptações

## Uso

### Exemplo Básico

```typescript
import { composeUXBlocks } from "@/lib/agents";

const result = await composeUXBlocks(projectId, userId, {
  context: {
    use_cases: ["SaaS", "E-commerce"],
    business_type: "Marketplace",
    target_features: ["Login", "Checkout"],
  },
  searchQuery: "login",
  maxBlocks: 5,
});
```

### Busca Direta (sem IA)

```typescript
import { searchUXBlocks } from "@/lib/agents";

const blocks = await searchUXBlocks({
  useCases: ["SaaS"],
  archetype: "linear_flow",
  limit: 20,
});
```

### Buscar Bloco Específico

```typescript
import { getUXBlockById } from "@/lib/agents";

const block = await getUXBlockById("login-basic");
```

## Estrutura da Biblioteca

### Tabela `ux_blocks`

```sql
CREATE TABLE ux_blocks (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  description TEXT NOT NULL,
  use_cases TEXT[] NOT NULL,
  archetype TEXT NOT NULL,
  semantic_flow JSONB NOT NULL,
  block_references TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Índices
- `idx_ux_blocks_archetype`: Busca por arquétipo
- `idx_ux_blocks_use_cases`: Busca por casos de uso (GIN)
- `idx_ux_blocks_label_search`: Busca full-text (GIN)

## Blocos Disponíveis

A biblioteca contém 50 blocos UX pré-definidos, incluindo:

- **Autenticação**: login-basic, sign-up-basic, social-login, two-factor-auth, etc.
- **Onboarding**: onboarding-wizard, onboarding-tour, onboarding-checklist
- **E-commerce**: checkout, add-to-cart, order-tracking, wishlist
- **Notificações**: push-opt-in, email-prefs, notification-center
- **Erros**: 404-error, maintenance-error, network-error, permission-denied
- **E muito mais...**

## Integração com Outros Agentes

O UX Block Composer pode ser integrado no pipeline de criação de fluxos:

1. **Antes do Subrules Decomposer**: Para sugerir blocos baseados no contexto
2. **Durante o Flow Enricher**: Para enriquecer com padrões UX comprovados
3. **Standalone**: Para consulta direta de blocos

## Boas Práticas

1. **Contexto Rico**: Forneça o máximo de contexto possível (master rule, journey, use cases)
2. **Limite de Blocos**: Use `maxBlocks` para controlar o número de resultados
3. **Validação**: Sempre valide os blocos retornados antes de usar
4. **Adaptação**: Os blocos são adaptados, mas podem precisar de ajustes finos

## Próximos Passos

- [ ] Popular todos os 50 blocos na biblioteca
- [ ] Integrar no orchestrator para uso automático
- [ ] Adicionar métricas de uso dos blocos
- [ ] Criar interface de gerenciamento da biblioteca







