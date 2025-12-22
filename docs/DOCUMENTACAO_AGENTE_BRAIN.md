# 🧠 Documentação do Agente Brain

> **Versão:** 1.0
> **Status:** Ativo
> **Localização:** `lib/brain`, `components/brain`, `supabase/functions`

O **Brain Agent** é a interface central de inteligência do Oria, atuando como um orquestrador conversacional capaz de planejar arquiteturas, responder consultas técnicas e executar operações em lote. Ele utiliza um sistema de **Roteamento Inteligente** para selecionar o melhor modelo (GPT-4, GPT-3.5, etc.) e modo de operação para cada tarefa.

---

## 1. Finalidades Principais

O Brain Agent opera principalmente através de três modos distintos, cada um focado em um tipo específico de interação e processo de negócio.

### 🎯 A. Assistente de Planejamento e Arquitetura (Mode: PLAN)

É o "arquiteto" do sistema. Focado em tarefas complexas que exigem raciocínio profundo, estruturação e visão de longo prazo.

*   **Processos de Negócio:**
    *   Criação e modificação de **Regras de Negócio** (`upsert_rule`).
    *   Definição de **Especificações de Fluxo** (`upsert_spec`).
    *   Planejamento de migrações e refatorações de arquitetura.
    *   Resolução de conflitos entre regras existentes.
*   **Benefícios:**
    *   Garante consistência arquitetural ao planejar antes de executar.
    *   Reduz erros em operações críticas (ex: migrações).
    *   Permite "pensar" sobre o problema com modelos mais potentes (GPT-4o/Pro) antes de gerar código.

### 💡 B. Consultor Técnico e de Produto (Mode: CONSULT)

Atua como um especialista disponível 24/7 para tirar dúvidas e explicar o funcionamento do sistema.

*   **Processos de Negócio:**
    *   Onboarding de novos usuários na plataforma.
    *   Explicação de conceitos técnicos e regras existentes.
    *   Busca semântica em documentação e bases de conhecimento.
    *   Sugestões rápidas de melhoria.
*   **Benefícios:**
    *   Reduz a curva de aprendizado da ferramenta.
    *   Fornece respostas imediatas sem necessidade de suporte humano.
    *   Baixo custo operacional (utiliza modelos mais leves como GPT-4o-mini).

### ⚡ C. Processamento em Lote e Transformação (Mode: BATCH)

O "operário" do sistema, focado em tarefas repetitivas e volumosas que exigem consistência mecânica.

*   **Processos de Negócio:**
    *   Normalização e padronização de dados.
    *   Tradução de conteúdos em massa.
    *   Reescrita de descrições e textos de interface.
    *   Geração de variações de testes.
*   **Benefícios:**
    *   Alta velocidade de processamento.
    *   Eliminação de trabalho manual repetitivo.
    *   Garantia de padronização em grandes volumes de dados.

---

## 2. Metodologia de Teste Recomendada

Para garantir a confiabilidade e eficácia do Brain Agent, recomenda-se a seguinte estratégia de testes em camadas:

### 🧪 Testes Unitários (Validação de Componentes)
Focam na lógica determinística e componentes isolados.

*   **Router (`router.test.ts`):** Validar se os prompts estão sendo direcionados para os modos corretos (ex: "criar regra" -> PLAN, "como funciona" -> CONSULT).
*   **Estimadores (`token-estimator.ts`):** Verificar precisão do cálculo de tokens para evitar estouro de contexto.
*   **Parsers:** Garantir que as saídas estruturadas (JSON) dos LLMs sejam corretamente convertidas em objetos TypeScript.

### 🏗️ Testes de Carga e Performance
Avaliam o comportamento sob estresse e limites.

*   **Cenários de Teste:**
    *   **Concorrência:** 50+ usuários enviando mensagens simultaneamente.
    *   **Contexto Longo:** Enviar payloads próximos ao limite (128k tokens) para testar a degradação de performance e a ativação do modo `LONG_CONTEXT`.
    *   **Streaming:** Verificar estabilidade da conexão SSE (Server-Sent Events) sob latência de rede simulada.

### 🅰️/🅱️ Testes A/B (Eficácia Comparativa)
Comparar diferentes configurações em produção.

*   **Variáveis:**
    *   **Modelos:** Comparar `gpt-4o` vs `gpt-4-turbo` para tarefas de planejamento.
    *   **Prompts do Sistema:** Testar diferentes instruções de "persona" para ver qual gera respostas mais úteis.
*   **Métrica de Sucesso:** Qual versão teve maior taxa de "Ações Aplicadas" (usuário aceitou a sugestão) vs "Descartes".

---

## 3. Critérios de Avaliação

Para considerar o Brain Agent "eficaz", ele deve atingir os seguintes patamares:

### 📊 Métricas Quantitativas

| Métrica | Definição | Meta de Eficácia |
|---------|-----------|------------------|
| **TTFT (Time to First Token)** | Tempo entre o envio e o início da resposta na tela. | < 1.5 segundos |
| **Acurácia de Roteamento** | % de vezes que o Router escolheu o modo correto para a intenção. | > 95% |
| **Taxa de Sucesso de Actions** | % de ações sugeridas que foram executadas sem erro técnico. | > 98% |
| **Custo por Sessão** | Média de tokens consumidos por resolução de problema. | Monitorar (Baseline) |

### 🧠 Indicadores Qualitativos

*   **Satisfação do Usuário (CSAT):** Feedback direto (thumbs up/down) nas mensagens. Meta: > 4.5/5.
*   **Reversibilidade:** Capacidade de desfazer ações complexas (ex: "desfazer criação de fluxo"). O sistema deve sempre oferecer caminho de volta.
*   **Clareza do Plano:** O usuário entende o que o agente vai fazer *antes* dele fazer? (Avaliado pela taxa de cancelamento de planos propostos).

### ✅ Requisitos Mínimos para Produção

1.  **Segurança:** O agente nunca deve expor chaves de API ou dados de outros projetos.
2.  **Resiliência:** Deve lidar graciosamente com falhas da API da OpenAI (retries, fallbacks).
3.  **Transparência:** Deve sempre indicar qual modo e modelo está usando (visível nas badges da UI).
