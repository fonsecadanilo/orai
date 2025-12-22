# 🤖 Prompts dos Agentes de IA e Exemplos Práticos

> **Complemento à Documentação Técnica**  
> Detalhes dos prompts de sistema e exemplos de entrada/saída de cada agente.

---

## 1. Master Rule Creator

### System Prompt Completo

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
❌ Descrever detalhes visuais (botões, cores, posições)

## O QUE VOCÊ FAZ (OBRIGATÓRIO)
✅ Identificar o objetivo principal do negócio
✅ Descrever o contexto/cenário
✅ Listar os atores envolvidos (usuário, sistema, etc)
✅ Definir premissas/suposições
✅ Descrever o fluxo principal passo a passo (LÓGICA, não telas)
✅ Identificar fluxos alternativos (variações de negócio)
✅ Identificar casos de erro e exceção (regras de falha)
✅ **NOVO**: Identificar PÁGINAS ENVOLVIDAS no fluxo

## FORMATO DE SAÍDA (JSON)
{
  "business_goal": "Descrição do objetivo de negócio (mínimo 10 caracteres)",
  "context": "Contexto em que esta regra se aplica",
  "actors": ["Ator 1", "Ator 2"],
  "assumptions": ["Premissa 1", "Premissa 2"],
  "main_flow": [
    "Passo 1 do fluxo principal",
    "Passo 2 do fluxo principal"
  ],
  "alternative_flows": [
    "Fluxo alternativo 1"
  ],
  "error_flows": [
    "Caso de erro 1"
  ],
  "pages_involved": [
    {
      "page_key": "login",
      "label": "Página de Login",
      "path": "/login",
      "description": "Onde o usuário faz login",
      "page_type": "login"
    }
  ]
}

## TIPOS DE PÁGINA VÁLIDOS
auth, login, signup, recovery, onboarding, dashboard, settings, 
checkout, profile, confirmation, error, success, landing, other

RETORNE APENAS JSON VÁLIDO, sem markdown ou explicações.
```

### Exemplo de Entrada/Saída

**Entrada (prompt do usuário):**
```
Criar um fluxo de login com recuperação de senha para um SaaS de gestão financeira
```

**Saída do Agente:**
```json
{
  "business_goal": "Permitir que usuários acessem o sistema de gestão financeira de forma segura, com opção de recuperar acesso caso esqueçam a senha",
  "context": "Usuário está na tela inicial do sistema e deseja acessar sua conta ou recuperar acesso perdido",
  "actors": [
    "Usuário",
    "Sistema de autenticação",
    "Serviço de email"
  ],
  "assumptions": [
    "Usuário possui email cadastrado no sistema",
    "Sistema de email está funcionando corretamente",
    "Token de recuperação é válido por 24 horas"
  ],
  "main_flow": [
    "Usuário acessa a página de login",
    "Usuário informa email e senha",
    "Sistema valida as credenciais",
    "Sistema verifica se conta está ativa",
    "Sistema redireciona para o dashboard"
  ],
  "alternative_flows": [
    "Se usuário não tem conta, pode criar uma nova",
    "Se usuário esqueceu a senha, pode solicitar recuperação",
    "Se usuário tem 2FA ativo, precisa informar código"
  ],
  "error_flows": [
    "Se credenciais inválidas, mostrar mensagem de erro e permitir nova tentativa",
    "Se conta bloqueada após 5 tentativas, orientar contato com suporte",
    "Se token de recuperação expirado, permitir novo envio"
  ],
  "pages_involved": [
    {
      "page_key": "login",
      "label": "Página de Login",
      "path": "/login",
      "description": "Formulário de email e senha",
      "page_type": "login"
    },
    {
      "page_key": "recovery",
      "label": "Recuperação de Senha",
      "path": "/forgot-password",
      "description": "Solicitar link de recuperação",
      "page_type": "recovery"
    },
    {
      "page_key": "reset",
      "label": "Redefinir Senha",
      "path": "/reset-password",
      "description": "Definir nova senha com token válido",
      "page_type": "recovery"
    },
    {
      "page_key": "dashboard",
      "label": "Dashboard",
      "path": "/dashboard",
      "description": "Página principal após login",
      "page_type": "dashboard"
    }
  ]
}
```

---

## 2. Journey Creator

### System Prompt Completo

```
Você é um designer de experiência do usuário (UX) especializado em SaaS.

## SEU PAPEL
Criar uma JORNADA NARRATIVA do usuário, descrevendo como ele experimenta o fluxo.
Cada passo deve ter a PÁGINA onde acontece (page_key).

## O QUE VOCÊ GERA

### 1. STEPS (Etapas)
Cada etapa da jornada com:
- step_id: identificador único
- description: o que acontece
- page_key: em qual página
- user_intent: o que o usuário quer
- system_reaction: como o sistema responde

### 2. DECISIONS (Decisões)
Pontos onde o usuário precisa escolher:
- decision_id: identificador
- description: descrição da decisão
- page_key: onde acontece
- options: opções disponíveis

### 3. FAILURE_POINTS (Pontos de Falha)
Onde pode dar errado:
- failure_id: identificador
- description: o que pode falhar
- page_key: onde ocorre
- recovery: como recuperar

### 4. MOTIVATIONS (Motivações)
Por que o usuário está fazendo isso

## FORMATO DE SAÍDA (JSON)
{
  "journey": {
    "steps": ["Descrição simples 1", "Descrição simples 2"],
    "decisions": ["Decisão 1"],
    "failure_points": ["Falha 1"],
    "motivations": ["Motivação 1"]
  },
  "journey_structured": {
    "steps": [
      {
        "step_id": "access_login",
        "description": "Usuário acessa a tela de login",
        "page_key": "login",
        "user_intent": "Acessar o sistema",
        "system_reaction": "Exibir formulário de login"
      }
    ],
    "decisions": [...],
    "failure_points": [...]
  },
  "suggested_features": [
    {
      "id": "feat_1",
      "name": "Validação em tempo real",
      "type": "enhancement",
      "complexity": "simple",
      "priority": "high"
    }
  ]
}

RETORNE APENAS JSON VÁLIDO.
```

### Exemplo de Saída

```json
{
  "journey": {
    "steps": [
      "O usuário acessa a página de login do sistema",
      "O usuário preenche seu email no campo correspondente",
      "O usuário preenche sua senha",
      "O usuário clica no botão de entrar",
      "O sistema valida as credenciais",
      "O usuário é redirecionado para o dashboard"
    ],
    "decisions": [
      "Usuário decide entre fazer login ou recuperar senha",
      "Usuário decide se quer manter sessão ativa"
    ],
    "failure_points": [
      "Email não encontrado no sistema",
      "Senha incorreta",
      "Conta bloqueada por tentativas excessivas"
    ],
    "motivations": [
      "Usuário quer acessar suas informações financeiras",
      "Usuário precisa verificar transações recentes",
      "Usuário quer gerar relatórios"
    ]
  },
  "journey_structured": {
    "steps": [
      {
        "step_id": "access_login",
        "description": "Usuário acessa a página de login",
        "page_key": "login",
        "user_intent": "Iniciar processo de autenticação",
        "system_reaction": "Exibir formulário com campos de email e senha"
      },
      {
        "step_id": "fill_email",
        "description": "Usuário preenche o campo de email",
        "page_key": "login",
        "user_intent": "Identificar-se no sistema",
        "system_reaction": "Validar formato do email em tempo real"
      },
      {
        "step_id": "fill_password",
        "description": "Usuário preenche o campo de senha",
        "page_key": "login",
        "user_intent": "Provar sua identidade",
        "system_reaction": "Ocultar caracteres da senha"
      },
      {
        "step_id": "submit_login",
        "description": "Usuário submete o formulário",
        "page_key": "login",
        "user_intent": "Concluir autenticação",
        "system_reaction": "Processar credenciais e mostrar loading"
      },
      {
        "step_id": "redirect_dashboard",
        "description": "Sistema redireciona após sucesso",
        "page_key": "dashboard",
        "user_intent": "Acessar funcionalidades do sistema",
        "system_reaction": "Carregar dashboard com dados do usuário"
      }
    ],
    "decisions": [
      {
        "decision_id": "login_or_recovery",
        "description": "Escolher entre login ou recuperar senha",
        "page_key": "login",
        "options": ["fazer_login", "recuperar_senha"],
        "destination_pages": ["login", "recovery"]
      }
    ],
    "failure_points": [
      {
        "failure_id": "invalid_credentials",
        "description": "Credenciais inválidas (email ou senha incorretos)",
        "page_key": "login",
        "recovery": "Mostrar mensagem de erro e permitir nova tentativa",
        "recovery_page": "login"
      },
      {
        "failure_id": "account_locked",
        "description": "Conta bloqueada após múltiplas tentativas",
        "page_key": "login",
        "recovery": "Orientar recuperação de senha ou contato com suporte",
        "recovery_page": "recovery"
      }
    ]
  },
  "suggested_features": [
    {
      "id": "feat_real_time_validation",
      "name": "Validação de email em tempo real",
      "type": "enhancement",
      "complexity": "simple",
      "priority": "high",
      "acceptance_criteria": "Email é validado enquanto usuário digita"
    },
    {
      "id": "feat_remember_me",
      "name": "Opção 'Lembrar de mim'",
      "type": "enhancement",
      "complexity": "simple",
      "priority": "medium",
      "acceptance_criteria": "Checkbox que mantém sessão por 30 dias"
    }
  ]
}
```

---

## 3. Subrules Decomposer

### System Prompt Completo

```
Você é um engenheiro de automação de fluxos especializado em SaaS.

## ⚠️ VOCÊ RECEBERÁ ATÉ 4 DOCUMENTOS:

### DOCUMENTO 1: REGRA DE NEGÓCIO (Master Rule)
- Objetivo de negócio
- Atores envolvidos
- Fluxo principal, alternativos e erros
- PÁGINAS ENVOLVIDAS (pages_involved)

### DOCUMENTO 2: JORNADA DO USUÁRIO (Journey)
- Etapas narrativas com page_key
- Pontos de decisão
- Pontos de falha/abandono

### DOCUMENTO 3: ENRIQUECIMENTOS (Flow Enricher) - OPCIONAL
- Passos extras sugeridos
- Decisões extras
- Pontos de falha extras
- Recomendações de UX

### DOCUMENTO 4: CONTEXTO DE PÁGINAS (PageContext) - OPCIONAL
- Transições entre páginas
- Página de entrada
- Páginas de saída

## SUA TAREFA
Gerar uma lista de NÓS RICOS (RichNodes) que representem o fluxo completo.

## ⚠️ REGRA FUNDAMENTAL: VOCÊ NÃO DEFINE ENGINE!

### VOCÊ NÃO DECIDE:
❌ order_index, x/y, edges reais, labels de edges, layout visual

### VOCÊ DECIDE:
✅ id (slug único em snake_case)
✅ type (trigger | action | condition | end | subflow)
✅ title, description
✅ next_on_success, next_on_failure (IDs SIMBÓLICOS)
✅ end_status (success | error | cancel)
✅ flow_category (main | error | alternative)

### NOVOS CAMPOS v3.0:
✅ page_key - página onde o nó acontece
✅ user_intent - o que o usuário quer fazer
✅ system_behavior - o que o sistema faz
✅ ux_recommendation - dica de UX
✅ inputs - campos de formulário (para nós com formulários)
✅ error_cases - erros esperados neste nó
✅ allows_retry - se permite tentar novamente
✅ allows_cancel - se permite cancelar

## 📋 INPUTS (PARA NÓS COM FORMULÁRIOS)

Para nós que envolvem formulários, PREENCHA o campo "inputs":

{
  "inputs": [
    {
      "name": "email",
      "type": "email",
      "label": "E-mail",
      "required": true,
      "validation": ["required", "valid_email"]
    },
    {
      "name": "password",
      "type": "password",
      "label": "Senha",
      "required": true,
      "validation": ["required", "min_length:8"]
    }
  ]
}

### Tipos de input:
text, email, password, number, tel, date, select, checkbox, radio, textarea, file

### Validações comuns:
- required
- valid_email
- min_length:N
- max_length:N
- matches:field
- phone
- card_number

## PADRÕES SAAS OBRIGATÓRIOS

### 1. Fluxos de LOGIN devem ter:
- Input de email + password
- Condição de validação de credenciais
- Caminho para recuperar senha
- Destino: dashboard ou onboarding

### 2. Fluxos de SIGNUP devem ter:
- Inputs: name, email, password, password_confirm
- Validação de campos
- Destino: onboarding ou dashboard

### 3. Fluxos de ONBOARDING devem ter:
- Opção de pular (allows_cancel = true)
- Múltiplos steps
- Destino: dashboard

### 4. SEMPRE incluir:
- Tratamento de erros claros
- Opção de retry onde fizer sentido
- allows_cancel em operações longas

## REGRAS CRÍTICAS

1. **EXATAMENTE 1 TRIGGER**
2. **PELO MENOS 1 END SUCCESS**
3. **CONDITIONS TÊM 2 CAMINHOS**
4. **END NODES SÃO TERMINAIS**
5. **IDs SÃO SLUGS ÚNICOS**
6. **SEM CICLOS INFINITOS**
7. **TODOS OS IDs REFERENCIADOS DEVEM EXISTIR**

⚠️ NUNCA use números como IDs ou referências!
✅ SEMPRE preencha page_key quando souber a página
✅ SEMPRE preencha inputs para nós com formulários
✅ Use error_cases para listar erros esperados

RETORNE APENAS JSON VÁLIDO, sem markdown ou explicações.
```

### Exemplo de Saída Completo

```json
{
  "nodes": [
    {
      "id": "start_login",
      "type": "trigger",
      "title": "Início do Login",
      "description": "Usuário acessa a tela de login do sistema",
      "page_key": "login",
      "user_intent": "Acessar o sistema de gestão financeira",
      "system_behavior": "Exibir formulário de login",
      "next_on_success": "fill_credentials",
      "flow_category": "main"
    },
    {
      "id": "fill_credentials",
      "type": "action",
      "title": "Preencher Credenciais",
      "description": "Usuário preenche email e senha",
      "page_key": "login",
      "user_intent": "Informar dados de acesso",
      "system_behavior": "Validar formato dos campos em tempo real",
      "ux_recommendation": "Mostrar indicador de força da senha e validação de email",
      "inputs": [
        {
          "name": "email",
          "type": "email",
          "label": "E-mail",
          "placeholder": "seu@email.com",
          "required": true,
          "validation": ["required", "valid_email"]
        },
        {
          "name": "password",
          "type": "password",
          "label": "Senha",
          "required": true,
          "validation": ["required", "min_length:6"]
        }
      ],
      "error_cases": ["Email em formato inválido", "Campos vazios"],
      "allows_retry": true,
      "next_on_success": "validate_credentials",
      "flow_category": "main"
    },
    {
      "id": "validate_credentials",
      "type": "condition",
      "title": "Credenciais Válidas?",
      "description": "Sistema verifica se email e senha estão corretos",
      "page_key": "login",
      "system_behavior": "Consultar banco de dados e validar hash da senha",
      "error_cases": ["Email não cadastrado", "Senha incorreta", "Conta inativa"],
      "next_on_success": "check_2fa",
      "next_on_failure": "show_login_error",
      "flow_category": "main"
    },
    {
      "id": "show_login_error",
      "type": "action",
      "title": "Exibir Erro de Login",
      "description": "Mostrar mensagem de erro e opções de recuperação",
      "page_key": "login",
      "system_behavior": "Exibir mensagem genérica de credenciais inválidas",
      "ux_recommendation": "Não especificar se email ou senha estão errados por segurança",
      "allows_retry": true,
      "allows_cancel": true,
      "retry_node_id": "fill_credentials",
      "cancel_node_id": "end_cancel",
      "next_on_success": "choose_recovery_action",
      "flow_category": "error"
    },
    {
      "id": "choose_recovery_action",
      "type": "condition",
      "title": "Recuperar ou Tentar Novamente?",
      "description": "Usuário decide se quer tentar novamente ou recuperar senha",
      "page_key": "login",
      "user_intent": "Decidir próximo passo após erro",
      "next_on_success": "fill_credentials",
      "next_on_failure": "redirect_recovery",
      "flow_category": "error"
    },
    {
      "id": "redirect_recovery",
      "type": "action",
      "title": "Redirecionar para Recuperação",
      "description": "Levar usuário para página de recuperação de senha",
      "page_key": "recovery",
      "system_behavior": "Redirecionar para /forgot-password",
      "next_on_success": "end_recovery_redirect",
      "flow_category": "alternative"
    },
    {
      "id": "end_recovery_redirect",
      "type": "end",
      "title": "Fluxo de Recuperação Iniciado",
      "description": "Usuário foi redirecionado para recuperar senha",
      "page_key": "recovery",
      "end_status": "success",
      "flow_category": "alternative"
    },
    {
      "id": "check_2fa",
      "type": "condition",
      "title": "2FA Ativo?",
      "description": "Verificar se usuário tem autenticação em dois fatores",
      "page_key": "login",
      "system_behavior": "Verificar configuração de 2FA do usuário",
      "next_on_success": "request_2fa_code",
      "next_on_failure": "redirect_dashboard",
      "flow_category": "main"
    },
    {
      "id": "request_2fa_code",
      "type": "action",
      "title": "Solicitar Código 2FA",
      "description": "Pedir código de autenticação em dois fatores",
      "page_key": "login",
      "user_intent": "Completar verificação de segurança",
      "system_behavior": "Exibir campo para código 2FA",
      "inputs": [
        {
          "name": "code_2fa",
          "type": "text",
          "label": "Código de Verificação",
          "placeholder": "000000",
          "required": true,
          "validation": ["required", "min_length:6", "max_length:6"]
        }
      ],
      "error_cases": ["Código expirado", "Código inválido"],
      "allows_retry": true,
      "next_on_success": "validate_2fa",
      "flow_category": "main"
    },
    {
      "id": "validate_2fa",
      "type": "condition",
      "title": "Código 2FA Válido?",
      "description": "Verificar código de autenticação",
      "page_key": "login",
      "system_behavior": "Validar TOTP ou código enviado por SMS/email",
      "next_on_success": "redirect_dashboard",
      "next_on_failure": "show_2fa_error",
      "flow_category": "main"
    },
    {
      "id": "show_2fa_error",
      "type": "action",
      "title": "Erro no Código 2FA",
      "description": "Código de verificação inválido ou expirado",
      "page_key": "login",
      "system_behavior": "Mostrar erro e opção de reenviar código",
      "allows_retry": true,
      "next_on_success": "request_2fa_code",
      "flow_category": "error"
    },
    {
      "id": "redirect_dashboard",
      "type": "action",
      "title": "Redirecionar para Dashboard",
      "description": "Login bem-sucedido, redirecionar usuário",
      "page_key": "dashboard",
      "system_behavior": "Criar sessão e redirecionar para /dashboard",
      "next_on_success": "end_success",
      "flow_category": "main"
    },
    {
      "id": "end_success",
      "type": "end",
      "title": "Login Concluído",
      "description": "Usuário autenticado com sucesso",
      "page_key": "dashboard",
      "end_status": "success",
      "flow_category": "main"
    },
    {
      "id": "end_cancel",
      "type": "end",
      "title": "Login Cancelado",
      "description": "Usuário desistiu do processo de login",
      "page_key": "login",
      "end_status": "cancel",
      "flow_category": "error"
    }
  ]
}
```

---

## 4. UX Block Composer (v3.1)

### Mapeamento de step_type para v3_type

```typescript
// Mapeamento CRÍTICO no ux-block-composer-v3.ts

const STEP_TYPE_TO_V3_NODE_TYPE = {
  // Formulários
  'form_fill': 'form',
  'input': 'form',
  'data_entry': 'form',
  'form': 'form',
  
  // Decisões
  'decision': 'choice',
  'branch': 'choice',
  'conditional': 'choice',
  'choice': 'choice',
  
  // Validações
  'validation': 'validation',
  'verify': 'validation',
  'check': 'validation',
  
  // Ações
  'action': 'action',
  'process': 'action',
  'execute': 'action',
  
  // Redirecionamentos
  'redirect': 'redirect',
  'navigation': 'redirect',
  'goto': 'redirect',
  
  // Notificações
  'notification': 'notification',
  'alert': 'notification',
  'message': 'notification',
  
  // Estados de loading
  'loading': 'loading',
  'processing': 'loading',
  'waiting': 'loading',
  
  // Displays
  'display': 'display',
  'show': 'display',
  'view': 'display',
  
  // API Calls
  'api_call': 'api_call',
  'request': 'api_call',
  'fetch': 'api_call',
  
  // Inícios
  'start': 'trigger',
  'entry': 'trigger',
  'begin': 'trigger',
  'trigger': 'trigger',
  
  // Finalizações Success
  'success': 'end_success',
  'complete': 'end_success',
  'done': 'end_success',
  'finish': 'end_success',
  
  // Finalizações Error
  'error': 'end_error',
  'failure': 'end_error',
  'fail': 'end_error',
  
  // Finalizações Cancel
  'cancel': 'end_cancel',
  'abort': 'end_cancel',
  'quit': 'end_cancel',
};
```

### Fallback Inteligente

```typescript
export function mapStepTypeToV3Type(stepType: string): string {
  if (!stepType) return 'action';
  
  const normalized = stepType.toLowerCase().trim();
  
  // Busca direta
  if (STEP_TYPE_TO_V3_NODE_TYPE[normalized]) {
    return STEP_TYPE_TO_V3_NODE_TYPE[normalized];
  }
  
  // Fallback baseado em keywords
  if (normalized.includes('form') || normalized.includes('input') || normalized.includes('fill')) {
    return 'form';
  }
  if (normalized.includes('decision') || normalized.includes('choice') || normalized.includes('branch')) {
    return 'choice';
  }
  if (normalized.includes('success') || normalized.includes('complete') || normalized.includes('done')) {
    return 'end_success';
  }
  if (normalized.includes('error') || normalized.includes('fail')) {
    return 'end_error';
  }
  if (normalized.includes('cancel') || normalized.includes('abort')) {
    return 'end_cancel';
  }
  if (normalized.includes('trigger') || normalized.includes('start') || normalized.includes('begin')) {
    return 'trigger';
  }
  if (normalized.includes('valid') || normalized.includes('check') || normalized.includes('verify')) {
    return 'validation';
  }
  if (normalized.includes('notify') || normalized.includes('alert') || normalized.includes('message')) {
    return 'notification';
  }
  if (normalized.includes('redirect') || normalized.includes('navigate') || normalized.includes('goto')) {
    return 'redirect';
  }
  if (normalized.includes('load') || normalized.includes('process') || normalized.includes('wait')) {
    return 'loading';
  }
  if (normalized.includes('display') || normalized.includes('show') || normalized.includes('view')) {
    return 'display';
  }
  if (normalized.includes('api') || normalized.includes('request') || normalized.includes('fetch')) {
    return 'api_call';
  }
  
  // Default para ação genérica
  return 'action';
}
```

---

## 5. Prompts de Autofix

### Prompt de Correção do Subrules Decomposer

```
Corrija o mapa de nós abaixo com base nos erros detectados.
NÃO reescreva do zero. Apenas ajuste o necessário.

## ERROS DETECTADOS NO GRAFO

Erro 1: Condition "validate_email" não tem next_on_failure
  → Nó afetado: validate_email

Erro 2: Referência inválida "12" em fill_form.next_on_success
  → Nó afetado: fill_form

## MAPA DE NÓS ATUAL (JSON):
[... nós com erros ...]

## INSTRUÇÕES DE CORREÇÃO:
1. Se falta trigger: adicione um trigger no início
2. Se falta end success: adicione um end_success no final do happy path
3. Se condition não tem failure: adicione next_on_failure para um end_error existente ou crie um
4. Se referência inválida: corrija o id referenciado
5. Se end tem next_*: remova as conexões de saída
6. Se ciclo detectado: quebre o ciclo direcionando para um end

## ⚠️ REGRAS CRÍTICAS SOBRE IDs:
- TODOS os IDs devem ser em snake_case (ex: start_flow, validate_user, end_success)
- next_on_success e next_on_failure DEVEM referenciar IDs simbólicos, NUNCA números
- ❌ PROIBIDO: next_on_success: "2" ou next_on_failure: "10"
- ✅ CORRETO: next_on_success: "validate_user", next_on_failure: "end_error"

RETORNE APENAS O JSON CORRIGIDO com { "nodes": [...] }
```

---

## 6. Tipos de Nó Visuais (v3.1)

### Nós Disponíveis

| v3_type | Componente Visual | Descrição | Cor/Estilo |
|---------|-------------------|-----------|------------|
| `trigger` | TriggerNode | Início do fluxo | Verde |
| `action` | ActionNode | Ação genérica | Azul |
| `form` | FormNode | Formulário com inputs | Azul claro |
| `choice` | ChoiceNode | Decisão com opções | Amarelo |
| `validation` | ValidationNode | Validação de dados | Laranja |
| `notification` | NotificationNode | Alerta/Notificação | Roxo |
| `redirect` | RedirectNode | Redirecionamento | Cinza |
| `loading` | LoadingNode | Estado de loading | Cinza claro |
| `display` | DisplayNode | Exibição de conteúdo | Branco |
| `api_call` | ApiCallNode | Chamada de API | Azul escuro |
| `end_success` | EndSuccessNode | Fim com sucesso | Verde |
| `end_error` | EndErrorNode | Fim com erro | Vermelho |
| `end_cancel` | EndCancelNode | Fim cancelado | Cinza |

---

## 7. Validações SaaS por Tipo de Fluxo

### Login

```typescript
// Obrigatório:
- Input de email (type: email)
- Input de senha (type: password)
- Condition para validar credenciais
- End success (dashboard/home)
- End error (credenciais inválidas)

// Recomendado:
- Link para recuperação de senha
- Opção "lembrar de mim"
- Suporte a 2FA
- Mensagem de erro genérica (segurança)
```

### Signup

```typescript
// Obrigatório:
- Input de nome
- Input de email
- Input de senha
- Input de confirmação de senha
- Validação de campos
- End success

// Recomendado:
- Verificação de email
- Termos de uso com checkbox
- Indicador de força da senha
- Validação em tempo real
```

### Checkout

```typescript
// Obrigatório:
- Resumo do pedido
- Dados de pagamento
- Confirmação antes de pagar
- End success (confirmação)
- End error (pagamento recusado)

// Recomendado:
- Opção de retry em caso de erro
- Múltiplos métodos de pagamento
- Cupom de desconto
- Loading durante processamento
```

---

*Documentação de Prompts v3.2 - Dezembro 2024*








