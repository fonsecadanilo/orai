/**
 * Dados dos 50 blocos UX extraídos do JSON fornecido
 */

export const uxBlocks = [
  {
    id: "login-basic",
    label: "Login Básico",
    description: "Fluxo simples de login com e-mail e senha para usuários retornarem ao produto. Uma interface intuitiva de login diminui frustrações e aumenta o engajamento.",
    use_cases: ["SaaS", "E-commerce", "Mobile App"],
    archetype: "linear_flow",
    semantic_flow: [
      {
        semantic_type: "form",
        title: "Tela de Login",
        inputs: ["Email", "Senha"],
        actions: ["Entrar", "Esqueci a Senha"]
      },
      {
        semantic_type: "decision",
        title: "Credenciais Válidas?",
        branches: [
          {
            condition: "Sim (login bem-sucedido)",
            next: "Acesso concedido (dashboard)"
          },
          {
            condition: "Não (credenciais incorretas)",
            next: "Exibir mensagem de erro"
          }
        ]
      },
      {
        semantic_type: "feedback",
        title: "Erro de Login",
        message: "Credenciais inválidas. Tente novamente."
      }
    ],
    block_references: []
  },
  {
    id: "sign-up-basic",
    label: "Cadastro Básico",
    description: "Fluxo de criação de conta pedindo apenas informações essenciais (ex: email e senha) para minimizar abandono. Formulários reduzidos aumentam significativamente a conversão.",
    use_cases: ["SaaS", "E-commerce", "Mobile App"],
    archetype: "linear_flow",
    semantic_flow: [
      {
        semantic_type: "form",
        title: "Formulário de Cadastro",
        inputs: ["Email", "Senha"],
        actions: ["Cadastrar"]
      },
      {
        semantic_type: "confirmation",
        title: "Conta Criada",
        message: "Cadastro realizado com sucesso!",
        next: "Continuar para onboarding ou dashboard"
      }
    ],
    block_references: []
  },
  {
    id: "social-login",
    label: "Login Social (OAuth)",
    description: "Fluxo de autenticação usando contas de terceiros (Google, Apple, etc.) para reduzir atrito. Por exemplo, Slack prioriza botões de login social, eliminando a necessidade de criar senha.",
    use_cases: ["SaaS", "Mobile App", "Web App"],
    archetype: "linear_flow",
    semantic_flow: [
      {
        semantic_type: "choice",
        title: "Opções de Login",
        options: ["Continuar com Google", "Continuar com Apple", "Usar Email/Senha"]
      },
      {
        semantic_type: "external_redirect",
        title: "Consentimento do Provedor",
        message: "Redirecionando para autenticação do provedor escolhido..."
      },
      {
        semantic_type: "confirmation",
        title: "Login Concluído",
        message: "Bem-vindo! Login efetuado com sucesso via provedor externo."
      }
    ],
    block_references: []
  },
  {
    id: "two-factor-auth",
    label: "Verificação em Dois Fatores",
    description: "Fluxo de autenticação que requer um código extra após login (enviado via SMS, email ou app autenticador) para maior segurança. Boas práticas incluem oferecer opção de 'lembrar este dispositivo' e métodos alternativos, reduzindo o incômodo ao usuário.",
    use_cases: ["SaaS", "Fintech", "Enterprise"],
    archetype: "linear_flow",
    semantic_flow: [
      {
        semantic_type: "form",
        title: "Verificação 2FA",
        inputs: ["Código de Verificação (6 dígitos)"],
        actions: ["Verificar"]
      },
      {
        semantic_type: "decision",
        title: "Código Correto?",
        branches: [
          {
            condition: "Sim",
            next: "Acesso concedido"
          },
          {
            condition: "Não/Expirado",
            next: "Exibir erro e opção de reenviar código"
          }
        ]
      },
      {
        semantic_type: "feedback",
        title: "Erro de Verificação",
        message: "Código inválido ou expirado. Enviamos um novo código, por favor tente novamente."
      }
    ],
    block_references: []
  },
  {
    id: "password-reset",
    label: "Recuperação de Senha",
    description: "Fluxo para recuperar acesso quando o usuário esquece a senha. O usuário insere seu email registrado e, se válido, recebe um link de redefinição. Um processo suave de recuperação de senha evita frustração e abandono do produto.",
    use_cases: ["SaaS", "E-commerce", "Mobile App"],
    archetype: "async_flow",
    semantic_flow: [
      {
        semantic_type: "form",
        title: "Solicitar Redefinição",
        inputs: ["Email cadastrado"],
        actions: ["Enviar Link de Redefinição"]
      },
      {
        semantic_type: "process",
        title: "Enviar Email",
        message: "Verificando email e enviando link de recuperação..."
      },
      {
        semantic_type: "confirmation",
        title: "Email Enviado",
        message: "Enviamos um link para redefinir sua senha. Verifique sua caixa de entrada."
      },
      {
        semantic_type: "feedback",
        title: "Email Não Encontrado",
        message: "Não localizamos este email. Verifique e tente novamente ou cadastre-se."
      }
    ],
    block_references: []
  },
  {
    id: "magic-link-login",
    label: "Login via Link Mágico",
    description: "Fluxo de login sem senha: o usuário insere seu email e recebe imediatamente um link seguro para acessar a conta. Esse processo (usado por exemplo no Slack) simplifica a experiência de login, eliminando a necessidade de lembrar senhas.",
    use_cases: ["SaaS", "Web App"],
    archetype: "async_flow",
    semantic_flow: [
      {
        semantic_type: "form",
        title: "Entrar com Email (Link Mágico)",
        inputs: ["Email"],
        actions: ["Enviar Link de Login"]
      },
      {
        semantic_type: "process",
        title: "Gerando Link",
        message: "Gerando link de acesso único e enviando para seu email..."
      },
      {
        semantic_type: "confirmation",
        title: "Verifique seu Email",
        message: "Enviamos um link de login para exemplo@dominio.com. Clique no link no seu email para entrar."
      },
      {
        semantic_type: "external_redirect",
        title: "Autenticando...",
        message: "Redirecionando de volta ao app após validação do link mágico."
      }
    ],
    block_references: []
  },
  {
    id: "phone-otp-login",
    label: "Login via SMS (OTP)",
    description: "Fluxo de login utilizando número de telefone: o usuário informa o celular e recebe um código de verificação (OTP) via SMS. Por exemplo, o Airbnb enfatiza login por telefone de forma amigável, tornando o processo mais conversacional e simplificado.",
    use_cases: ["Mobile App", "Fintech", "Delivery"],
    archetype: "linear_flow",
    semantic_flow: [
      {
        semantic_type: "form",
        title: "Entrar com Telefone",
        inputs: ["Número de Celular"],
        actions: ["Enviar Código"]
      },
      {
        semantic_type: "process",
        title: "Enviando OTP",
        message: "Enviando código SMS para +55 21 ****-****..."
      },
      {
        semantic_type: "form",
        title: "Verificar Código",
        inputs: ["Código SMS (6 dígitos)"],
        actions: ["Verificar"]
      },
      {
        semantic_type: "confirmation",
        title: "Login Efetuado",
        message: "Telefone verificado com sucesso. Bem-vindo!"
      },
      {
        semantic_type: "feedback",
        title: "Código Inválido",
        message: "O código inserido está incorreto ou expirou. Tente novamente."
      }
    ],
    block_references: []
  },
  {
    id: "multi-tenant-login",
    label: "Login Multi-Tenant / Multi-Perfil",
    description: "Fluxo de login adaptado para aplicações com múltiplos tipos de usuário ou workspaces. Pode unificar a entrada e depois direcionar o usuário ao ambiente correto com base em seu perfil, ou permitir que ele escolha previamente. Por exemplo, detectar o papel e enviar ao dashboard adequado é uma abordagem comum para simplificar a experiência.",
    use_cases: ["SaaS B2B", "Marketplaces", "Admin Portals"],
    archetype: "linear_flow",
    semantic_flow: [
      {
        semantic_type: "form",
        title: "Login Único",
        inputs: ["Email/Usuário", "Senha"],
        actions: ["Entrar"]
      },
      {
        semantic_type: "decision",
        title: "Tipo de Usuário?",
        branches: [
          {
            condition: "Perfil A (e.g. Cliente)",
            next: "Redirecionar para Dashboard Cliente"
          },
          {
            condition: "Perfil B (e.g. Vendedor/Admin)",
            next: "Redirecionar para Painel Administrativo"
          }
        ]
      },
      {
        semantic_type: "feedback",
        title: "Acesso Restrito",
        message: "Se você não tem acesso a esta área, por favor verifique suas credenciais ou perfil."
      }
    ],
    block_references: []
  },
  {
    id: "onboarding-wizard",
    label: "Onboarding em Etapas (Wizard)",
    description: "Fluxo de onboarding pós-cadastro guiado por múltiplas etapas sequenciais. Permite ao novo usuário configurar informações iniciais ou preferências passo a passo. Importante oferecer opção de pular essa configuração inicial, já que alguns usuários preferem explorar por conta própria.",
    use_cases: ["SaaS", "Mobile App", "Desktop Software"],
    archetype: "wizard",
    semantic_flow: [
      {
        semantic_type: "step",
        title: "Boas-vindas",
        content: "Mensagem de boas-vindas e o que esperar no setup",
        actions: ["Começar"]
      },
      {
        semantic_type: "step",
        title: "Configurar Perfil",
        content: "Campos básicos (nome, avatar, etc.) para completar perfil",
        actions: ["Próximo"]
      },
      {
        semantic_type: "step",
        title: "Preferências",
        content: "Opções iniciais (ex: notificações, tema) para o usuário escolher",
        actions: ["Concluir"]
      },
      {
        semantic_type: "completion",
        title: "Onboarding Concluído",
        message: "Tudo pronto! Você concluiu as etapas iniciais.",
        next: "Ir para Dashboard"
      }
    ],
    block_references: []
  },
  {
    id: "onboarding-tour",
    label: "Tour Guiado de Produto",
    description: "Fluxo de onboarding interativo que apresenta os principais recursos através de destaques na interface (tooltips, tutoriais in-app). Após o login inicial, o usuário pode optar por seguir um tour com dicas sobre funcionalidades (com possibilidade de pular a qualquer momento).",
    use_cases: ["SaaS", "Web App", "Mobile App"],
    archetype: "guided_tour",
    semantic_flow: [
      {
        semantic_type: "prompt",
        title: "Tour de Boas-vindas",
        message: "Deseja conhecer os principais recursos através de um tour rápido?",
        actions: ["Iniciar Tour", "Pular"]
      },
      {
        semantic_type: "tooltip",
        title: "Funcionalidade X",
        content: "Destaque explicando a funcionalidade X na tela",
        actions: ["Próximo"]
      },
      {
        semantic_type: "tooltip",
        title: "Funcionalidade Y",
        content: "Destaque explicando a funcionalidade Y na tela",
        actions: ["Próximo"]
      },
      {
        semantic_type: "completion",
        title: "Fim do Tour",
        message: "Tour concluído! Agora você já conhece os básicos. Bom uso!"
      }
    ],
    block_references: []
  },
  {
    id: "new-feature-announcement",
    label: "Anúncio de Nova Funcionalidade",
    description: "Fluxo que destaca dentro do produto um recurso recém-lançado. Comum usar um pop-up ou slide-out assim que a nova feature é liberada, explicando seu benefício e oferecendo um botão de ação para saber mais. O usuário pode interagir (abrir detalhes da novidade) ou ignorar/dismiss, encerrando o fluxo.",
    use_cases: ["SaaS", "Mobile App"],
    archetype: "async_flow",
    semantic_flow: [
      {
        semantic_type: "notification",
        title: "Nova Funcionalidade: X",
        message: "Conheça o novo recurso X que acabamos de lançar!",
        actions: ["Ver Detalhes", "Fechar"]
      },
      {
        semantic_type: "decision",
        title: "Interação do Usuário",
        branches: [
          {
            condition: "Clicou em Ver Detalhes",
            next: "Abrir página ou modal com explicação do recurso"
          },
          {
            condition: "Ignorou/Fechou",
            next: "Fechar anúncio e retomar uso normal"
          }
        ]
      },
      {
        semantic_type: "info",
        title: "Detalhes da Funcionalidade X",
        content: "Tela/modal descrevendo como funciona o novo recurso, com imagens ou passos.",
        actions: ["OK"]
      }
    ],
    block_references: [""]
  },
  {
    id: "invite-user",
    label: "Convite de Usuário (Teammate)",
    description: "Fluxo para convidar novos usuários a uma conta ou workspace existente. Por exemplo, convidar colegas para um espaço de trabalho SaaS. O usuário host acessa a seção de convite, insere o email do convidado (e possivelmente define permissões) e envia. O convidado recebe um email de convite e, ao aceitar, é orientado a criar conta e juntar-se ao workspace. Um bom fluxo de convite facilita a expansão de equipes e melhora a colaboração.",
    use_cases: ["SaaS B2B", "Colaboração", "Apps de Equipe"],
    archetype: "async_flow",
    semantic_flow: [
      {
        semantic_type: "form",
        title: "Convidar Membro",
        inputs: ["Email do Convidado", "Permissão/Papel"],
        actions: ["Enviar Convite"]
      },
      {
        semantic_type: "confirmation",
        title: "Convite Enviado",
        message: "Convite enviado para colega@empresa.com. Aguardando aceitação."
      },
      {
        semantic_type: "waiting",
        title: "Convite Pendente",
        message: "Convite em aberto. Você será notificado quando for aceito."
      },
      {
        semantic_type: "completion",
        title: "Convite Aceito",
        message: "O usuário convidado aceitou e agora faz parte do workspace."
      }
    ],
    block_references: []
  },
  {
    id: "role-management",
    label: "Gerenciamento de Papéis/Permissões",
    description: "Fluxo administrativo onde um usuário administrador gerencia as permissões de outros usuários. Tipicamente disponibilizado em uma tela de configurações de equipe, permitindo editar papéis (Admin, Editor, Visualizador, etc). Uma interface clara e intuitiva para gerenciamento de papéis evita fricção para times ao configurar acessos.",
    use_cases: ["SaaS B2B", "Sistemas Corporativos"],
    archetype: "settings_flow",
    semantic_flow: [
      {
        semantic_type: "list",
        title: "Lista de Membros e Papéis",
        content: "Exibe usuários e seus papéis atuais, ex: João (Admin), Maria (Editor)"
      },
      {
        semantic_type: "action",
        title: "Editar Papel",
        actions: ["Alterar papel de Maria para Admin"]
      },
      {
        semantic_type: "confirmation",
        title: "Salvar Alterações",
        message: "Você alterou permissões. Deseja salvar?",
        actions: ["Salvar", "Cancelar"]
      },
      {
        semantic_type: "feedback",
        title: "Permissão Atualizada",
        message: "As permissões de Maria foram atualizadas com sucesso."
      }
    ],
    block_references: []
  },
  {
    id: "profile-setup",
    label: "Completar Perfil do Usuário",
    description: "Fluxo onde o usuário preenche ou atualiza informações do perfil (nome, foto, bio, preferências). Frequentemente ocorre logo após cadastro como parte do onboarding. Por exemplo, o Pinterest adia perguntas pessoais como idade para o final do fluxo de cadastro, mostrando progresso para manter o usuário engajado.",
    use_cases: ["Apps Sociais", "SaaS", "Comunidades"],
    archetype: "linear_flow",
    semantic_flow: [
      {
        semantic_type: "form",
        title: "Informações de Perfil",
        inputs: ["Nome", "Sobrenome", "Foto do Perfil (upload)"],
        actions: ["Salvar"]
      },
      {
        semantic_type: "optional",
        title: "Dados Adicionais (Opcional)",
        inputs: ["Bio/Descrição", "Data de Nascimento"],
        actions: ["Salvar e Continuar"]
      },
      {
        semantic_type: "confirmation",
        title: "Perfil Completo",
        message: "Seu perfil foi atualizado com sucesso."
      }
    ],
    block_references: []
  },
  {
    id: "account-deletion",
    label: "Cancelamento/Exclusão de Conta",
    description: "Fluxo que permite ao usuário encerrar sua conta. Geralmente envolve solicitar confirmação adicional (dada a irreversibilidade) e, muitas vezes, um passo para coletar feedback do motivo de saída. Um fluxo bem projetado pode tentar recuperar o usuário — por exemplo, exibindo uma pesquisa de churn e oferecendo soluções conforme a resposta — mas também facilita a saída caso seja a decisão final.",
    use_cases: ["SaaS", "Apps Mobile", "Serviços Online"],
    archetype: "linear_flow",
    semantic_flow: [
      {
        semantic_type: "action",
        title: "Solicitar Exclusão",
        actions: ["Excluir minha conta"]
      },
      {
        semantic_type: "warning",
        title: "Confirmar Operação",
        message: "Tem certeza? Essa ação não pode ser desfeita.",
        actions: ["Confirmar Exclusão", "Cancelar"]
      },
      {
        semantic_type: "form",
        title: "Motivo do Cancelamento (Opcional)",
        inputs: ["Por que você está saindo? (texto opcional)"],
        actions: ["Enviar Feedback e Continuar"]
      },
      {
        semantic_type: "completion",
        title: "Conta Excluída",
        message: "Sua conta foi cancelada com sucesso. Sentimos sua partida."
      }
    ],
    block_references: []
  },
  {
    id: "browse-filter",
    label: "Busca e Filtro de Listagem",
    description: "Fluxo de navegação por itens com busca e filtros para refinar resultados. Comum em e-commerces ou catálogos: o usuário pode digitar termos ou aplicar filtros (categoria, preço, etc.) para limitar o conjunto de resultados. Esse tipo de busca facetada permite ao usuário ajustar as opções disponíveis para encontrar exatamente o que deseja.",
    use_cases: ["E-commerce", "Catálogos de Produtos", "Bibliotecas de Conteúdo"],
    archetype: "exploratory_flow",
    semantic_flow: [
      {
        semantic_type: "list",
        title: "Listagem de Itens",
        content: "Exibe todos os itens ou resultados iniciais"
      },
      {
        semantic_type: "filter",
        title: "Filtros",
        options: ["Categoria", "Faixa de Preço", "Marca"],
        actions: ["Aplicar Filtros"]
      },
      {
        semantic_type: "search",
        title: "Busca por Termo",
        inputs: ["Digite para buscar..."],
        actions: ["Buscar"]
      },
      {
        semantic_type: "update",
        title: "Atualizar Resultados",
        message: "Exibindo itens correspondentes aos filtros/termo aplicados"
      }
    ],
    block_references: []
  },
  {
    id: "add-to-cart",
    label: "Adicionar ao Carrinho",
    description: "Micro-fluxo em e-commerce ao adicionar um produto no carrinho. Após o usuário clicar em 'Adicionar ao carrinho', o sistema fornece um feedback imediato – por exemplo, exibindo uma confirmação ou mini-carrinho atualizado – para garantir que o item foi adicionado com sucesso.",
    use_cases: ["E-commerce", "Marketplace"],
    archetype: "micro_flow",
    semantic_flow: [
      {
        semantic_type: "action",
        title: "Adicionar Produto",
        actions: ["Adicionar ao Carrinho"]
      },
      {
        semantic_type: "feedback",
        title: "Produto Adicionado",
        message: "O item 'XYZ' foi adicionado ao seu carrinho.",
        actions: ["Ver Carrinho", "Continuar Comprando"]
      },
      {
        semantic_type: "update",
        title: "Carrinho Atualizado",
        message: "Ícone do carrinho exibindo nova contagem de itens (incrementado em +1)."
      }
    ],
    block_references: []
  },
  {
    id: "checkout",
    label: "Fluxo de Checkout (Compra)",
    description: "Fluxo de finalização de compra, dividido em etapas claras para evitar sobrecarregar o usuário. Geralmente consiste em revisar itens do carrinho, inserir informações de entrega, detalhes de pagamento e confirmar o pedido. Boas práticas incluem formular em múltiplas etapas (reduzindo a complexidade apresentada de uma só vez) e permitir checkout como convidado para agilizar compras únicas. Também é essencial oferecer uma etapa de revisão final antes da conclusão.",
    use_cases: ["E-commerce", "Serviços Online"],
    archetype: "wizard",
    semantic_flow: [
      {
        semantic_type: "step",
        title: "Revisar Carrinho",
        content: "Lista de produtos selecionados, quantidades, preços e botão para continuar",
        actions: ["Continuar para Entrega"]
      },
      {
        semantic_type: "step",
        title: "Informações de Entrega",
        content: "Formulário de endereço de entrega e opções de envio",
        actions: ["Continuar para Pagamento"]
      },
      {
        semantic_type: "step",
        title: "Pagamento",
        content: "Formulário de pagamento (cartão, boleto, etc.)",
        actions: ["Revisar Pedido"]
      },
      {
        semantic_type: "step",
        title: "Revisar e Confirmar",
        content: "Resumo final do pedido (itens, entrega, pagamento) para confirmação",
        actions: ["Confirmar Compra"]
      },
      {
        semantic_type: "completion",
        title: "Pedido Realizado",
        message: "Obrigado pela compra! Pedido #12345 confirmado."
      }
    ],
    block_references: []
  },
  {
    id: "payment-info",
    label: "Entrada de Informações de Pagamento",
    description: "Sub-fluxo dedicado à coleta dos dados de pagamento do usuário durante uma compra ou assinatura. O design deve ser otimizado e seguro, suportando vários métodos (cartões, carteiras digitais, etc.) para instilar confiança no usuário. Exibir ícones de métodos de pagamento aceitos e garantir conexão segura ajuda a transmitir segurança e comodidade.",
    use_cases: ["E-commerce", "SaaS (Billing)"],
    archetype: "linear_flow",
    semantic_flow: [
      {
        semantic_type: "form",
        title: "Dados de Pagamento",
        inputs: ["Número do Cartão", "Nome no Cartão", "Validade", "CVV"],
        actions: ["Pagar"]
      },
      {
        semantic_type: "option",
        title: "Métodos Alternativos",
        options: ["PayPal", "Pix", "Boleto"],
        actions: ["Selecionar Método"]
      },
      {
        semantic_type: "validation",
        title: "Validando Pagamento",
        message: "Verificando informações do cartão..."
      },
      {
        semantic_type: "feedback",
        title: "Pagamento Concluído",
        message: "Pagamento aprovado! Prosseguindo com a confirmação do pedido."
      }
    ],
    block_references: []
  },
  {
    id: "order-confirmation",
    label: "Confirmação de Pedido",
    description: "Tela final após concluir um checkout, confirmando que a compra foi realizada com sucesso. Apresenta o resumo do pedido (itens comprados, endereço, método de pagamento) e informações importantes como o número do pedido e estimativa de entrega. Fornecer transparência sobre prazos de entrega e próximos passos, como fazermos ao mostrar a data estimada de chegada, ajuda a gerenciar as expectativas do cliente.",
    use_cases: ["E-commerce"],
    archetype: "end_state",
    semantic_flow: [
      {
        semantic_type: "info",
        title: "Pedido Confirmado",
        content: "Obrigado! Seu pedido #12345 foi realizado com sucesso."
      },
      {
        semantic_type: "details",
        title: "Resumo do Pedido",
        content: "Lista de itens comprados, endereço de entrega e método de pagamento."
      },
      {
        semantic_type: "info",
        title: "Entrega",
        content: "Estimativa de entrega: 5-7 dias úteis. Você receberá atualizações por email."
      },
      {
        semantic_type: "action",
        title: "Ações Finais",
        actions: ["Continuar Comprando", "Ver Detalhes do Pedido"]
      }
    ],
    block_references: []
  },
  {
    id: "order-tracking",
    label: "Rastreamento de Pedido",
    description: "Fluxo que permite ao usuário acompanhar o status de entrega de seu pedido. Após a compra, o usuário pode acessar uma linha do tempo ou lista de etapas do processo de entrega (pedido confirmado, em separação, enviado, em transporte, entregue). Fornecer informações de rastreio claras e atualizadas transmite transparência e melhora a experiência, pois o cliente sabe quando esperar o produto.",
    use_cases: ["E-commerce", "Logística"],
    archetype: "async_flow",
    semantic_flow: [
      {
        semantic_type: "status_tracker",
        title: "Linha do Tempo do Pedido",
        statuses: ["Pedido Confirmado", "Pedido Enviado", "Em Transporte", "Entregue"],
        current_status: "Em Transporte"
      },
      {
        semantic_type: "detail",
        title: "Detalhes de Rastreamento",
        content: "Código de rastreio: AB123456789XX. Transportadora: XPTO Express."
      },
      {
        semantic_type: "action",
        title: "Ações Disponíveis",
        actions: ["Notificar-me sobre atualização", "Relatar um problema"]
      }
    ],
    block_references: []
  },
  {
    id: "wishlist",
    label: "Lista de Desejos (Wishlist)",
    description: "Fluxo que permite ao usuário salvar itens de interesse para consultar ou comprar mais tarde. Ao clicar em 'Adicionar à Wishlist', se não estiver logado, o usuário é convidado a fazer login ou criar conta (já que essas listas normalmente são vinculadas ao usuário). Essa estratégia de **gating** (bloqueio de conteúdo atrás de cadastro) é usada, por exemplo, pelo Pinterest, que exibe prévias e exige cadastro para salvar conteúdo, motivando o usuário a se registrar.",
    use_cases: ["E-commerce", "Apps de Conteúdo"],
    archetype: "async_flow",
    semantic_flow: [
      {
        semantic_type: "action",
        title: "Favoritar Item",
        actions: ["Adicionar à Wishlist"]
      },
      {
        semantic_type: "decision",
        title: "Usuário Logado?",
        branches: [
          {
            condition: "Sim",
            next: "Adicionar item à lista e confirmar"
          },
          {
            condition: "Não",
            next: "Solicitar Login/Cadastro"
          }
        ]
      },
      {
        semantic_type: "confirmation",
        title: "Item Salvo",
        message: "Produto 'XYZ' salvo na sua Wishlist."
      },
      {
        semantic_type: "info",
        title: "Acessar Wishlist",
        message: "Você pode ver todos os seus itens favoritos na sua lista de desejos no perfil."
      }
    ],
    block_references: []
  },
  {
    id: "product-review",
    label: "Solicitação de Avaliação de Produto",
    description: "Fluxo que, após uma compra, solicita que o usuário avalie o produto ou deixe uma resenha. Isso costuma ocorrer via notificação ou email alguns dias depois da entrega. Uma abordagem eficaz é direcionar apenas clientes satisfeitos para avaliações públicas: por exemplo, primeiro exibir uma pesquisa NPS in-app após algumas semanas de uso; se o usuário der nota alta (9 ou 10), então convidá-lo a publicar uma resenha numa plataforma externa (como G2, App Store, etc.).",
    use_cases: ["E-commerce", "SaaS", "Apps Mobile"],
    archetype: "async_flow",
    semantic_flow: [
      {
        semantic_type: "notification",
        title: "Avalie sua Experiência",
        message: "Você recomendaria nosso produto a um amigo? (0-10)",
        actions: ["Responder"]
      },
      {
        semantic_type: "decision",
        title: "Feedback NPS",
        branches: [
          {
            condition: "Nota 9-10 (Promotor)",
            next: "Pedir depoimento: convide a deixar uma resenha pública"
          },
          {
            condition: "Nota 7-8 (Neutro)",
            next: "Agradecer feedback e encerrar"
          },
          {
            condition: "Nota 0-6 (Detrator)",
            next: "Agradecer e perguntar como podemos melhorar (coletar comentário interno)"
          }
        ]
      },
      {
        semantic_type: "external_redirect",
        title: "Publicar Resenha",
        message: "Redirecionando para página de avaliação (ex: loja/app)..."
      },
      {
        semantic_type: "feedback",
        title: "Feedback Recebido",
        message: "Obrigado! Sua opinião é muito importante para nós."
      }
    ],
    block_references: []
  },
  {
    id: "return-refund",
    label: "Devolução/Reembolso de Pedido",
    description: "Fluxo que permite ao cliente solicitar a devolução de um produto ou reembolso de um serviço. Geralmente inicia com o usuário selecionando o pedido ou item que deseja devolver, preenchendo um motivo da devolução e escolhendo a forma de restituição (troca, crédito, dinheiro). Um processo de devolução bem projetado deve ser **sem atritos, empático e transparente**, pois uma experiência de retorno suave pode aumentar a lealdade mesmo após uma compra malsucedida.",
    use_cases: ["E-commerce", "Serviços (assinaturas)"],
    archetype: "wizard",
    semantic_flow: [
      {
        semantic_type: "list",
        title: "Selecionar Pedido",
        content: "Lista de pedidos recentes para o usuário escolher qual deseja devolver"
      },
      {
        semantic_type: "form",
        title: "Motivo da Devolução",
        inputs: ["Motivo (selecionar categoria)", "Comentário opcional"],
        actions: ["Continuar"]
      },
      {
        semantic_type: "option",
        title: "Opção de Reembolso",
        options: ["Reembolso no mesmo método de pagamento", "Crédito na loja", "Troca por outro item"],
        actions: ["Continuar"]
      },
      {
        semantic_type: "confirmation",
        title: "Confirmar Devolução",
        message: "Confirme os detalhes da solicitação de devolução.",
        actions: ["Confirmar Solicitação"]
      },
      {
        semantic_type: "completion",
        title: "Solicitação Registrada",
        message: "Sua devolução foi solicitada com sucesso. Instruções de envio do item foram enviadas ao seu email."
      }
    ],
    block_references: []
  },
  {
    id: "push-opt-in",
    label: "Opt-in de Notificações Push",
    description: "Fluxo onde um aplicativo solicita permissão para enviar notificações push ao usuário (no mobile ou web). O ideal é pedir essa permissão no contexto certo – isto é, quando o usuário vê valor em receber notificações – ao invés de imediatamente na abertura do app. Por exemplo, mostrar um diálogo explicativo antes do prompt nativo garante que o usuário compreenda o benefício e esteja mais inclinado a aceitar.",
    use_cases: ["Mobile Apps", "Web Apps (PWA)"],
    archetype: "async_flow",
    semantic_flow: [
      {
        semantic_type: "prompt",
        title: "Quer Receber Notificações?",
        message: "Ative notificações para saber das atualizações importantes em primeira mão.",
        actions: ["Quero Receber", "Agora Não"]
      },
      {
        semantic_type: "external_prompt",
        title: "Permissão de Sistema",
        message: "iOS/Android exibe diálogo nativo: 'App X deseja enviar notificações: Permitir/Negar'."
      },
      {
        semantic_type: "feedback",
        title: "Permissão Concedida",
        message: "Notificações ativadas! Manteremos você informado :)"
      },
      {
        semantic_type: "feedback",
        title: "Permissão Negada",
        message: "Você optou por não receber notificações. Você pode ativá-las depois nas configurações."
      }
    ],
    block_references: []
  },
  {
    id: "email-prefs",
    label: "Preferências de E-mail (Notificações)",
    description: "Fluxo que permite ao usuário gerenciar quais emails deseja (newsletters, alertas de atividade, recibos, etc.). Geralmente oferecido em uma página de configurações de notificações. Itens comuns incluem toggles ou checkboxes para cada categoria de email. Dar controle granular ao usuário sobre as comunicações aumenta a confiança e evita irritações. Por exemplo, o Basecamp permite configurar horários e dias para receber notificações, dando flexibilidade ao usuário sobre quando e quais notificações deseja.",
    use_cases: ["SaaS", "Apps com muitas notificações"],
    archetype: "settings_flow",
    semantic_flow: [
      {
        semantic_type: "list",
        title: "Categorias de Email",
        content: "Lista de tipos de email com opção de opt-in/out: [ ] Novidades da Plataforma, [x] Avisos de Conta, [ ] Ofertas e Promoções"
      },
      {
        semantic_type: "action",
        title: "Salvar Preferências",
        actions: ["Salvar Alterações"]
      },
      {
        semantic_type: "feedback",
        title: "Preferências Atualizadas",
        message: "Suas preferências de comunicação foram salvas. Você pode alterá-las a qualquer momento."
      }
    ],
    block_references: []
  },
  {
    id: "notification-center",
    label: "Centro de Notificações In-App",
    description: "Fluxo para exibir notificações recentes dentro do aplicativo. Geralmente acessível via um ícone de sino ou similar, que ao ser clicado mostra um painel (dropdown ou página) com a lista de notificações e atividades. Isso ajuda a organizar as notificações e dá fácil acesso a elas sem poluir a interface principal. O usuário pode clicar em uma notificação para ver detalhes relevantes ou marcá-las como lidas/dismiss.",
    use_cases: ["SaaS", "Apps Sociais", "Ferramentas Colaborativas"],
    archetype: "hub_flow",
    semantic_flow: [
      {
        semantic_type: "action",
        title: "Abrir Centro de Notificações",
        actions: ["Clique no ícone de sino"]
      },
      {
        semantic_type: "list",
        title: "Notificações Recentes",
        content: "Lista de notificações com data/hora, ex: '3 novas mensagens no projeto X', 'Sua exportação está pronta'."
      },
      {
        semantic_type: "action",
        title: "Interagir com Notificação",
        actions: ["Clicar para ver detalhe", "Marcar todas como lidas"]
      },
      {
        semantic_type: "feedback",
        title: "Notificação Detalhada",
        message: "Usuário é levado à tela relevante (ex: tela de mensagem ou página do projeto) ao clicar na notificação."
      }
    ],
    block_references: []
  },
  {
    id: "live-chat",
    label: "Chat de Suporte In-App",
    description: "Fluxo de atendimento ao cliente via chat embutido no aplicativo (semelhante ao Intercom ou outros). Inicia quando o usuário clica em 'Ajuda' ou ícone de chat. Pode começar com um chatbot (automação) perguntando qual é a dúvida; se a resposta automática não resolver, o fluxo encaminha para um atendente humano. Muitas empresas usam chatbots para questões repetitivas, melhorando o tempo de resposta e só escalonando para humanos quando necessário, o que aumenta a satisfação e reduz carga da equipe de suporte.",
    use_cases: ["SaaS", "E-commerce", "Fintech"],
    archetype: "async_flow",
    semantic_flow: [
      {
        semantic_type: "action",
        title: "Iniciar Chat de Suporte",
        actions: ["Abrir Chat (botão de ajuda/flutuante)"]
      },
      {
        semantic_type: "bot_message",
        title: "Chatbot Saudação",
        message: "Olá! Em que posso ajudar hoje?",
        options: ["Pergunta sobre faturamento", "Problema técnico", "Falar com humano"]
      },
      {
        semantic_type: "user_message",
        title: "Mensagem do Usuário",
        message: "Tenho um problema no login."
      },
      {
        semantic_type: "bot_message",
        title: "Resposta Automatizada",
        message: "Entendi. Você já tentou redefinir sua senha? [Link para redefinição]",
        actions: ["Isso ajudou", "Ainda preciso de ajuda"]
      },
      {
        semantic_type: "decision",
        title: "Escalonar para Humano?",
        branches: [
          {
            condition: "Usuário clicou 'Ainda preciso de ajuda'",
            next: "Conectar a um agente humano disponível"
          },
          {
            condition: "Usuário resolveu com bot",
            next: "Encerrar chat com agradecimento"
          }
        ]
      },
      {
        semantic_type: "agent_message",
        title: "Atendente Humano",
        message: "Olá, aqui é o suporte. Vi que você tem um problema de login. Vamos resolver isso juntos?"
      },
      {
        semantic_type: "completion",
        title: "Chat Encerrado",
        message: "Obrigado por entrar em contato. Podemos ajudar com algo mais?"
      }
    ],
    block_references: []
  },
  {
    id: "feedback-survey",
    label: "Pesquisa de Satisfação/Feedback In-App",
    description: "Fluxo para coletar feedback do usuário dentro da aplicação. Pode ser acionado após alguma interação chave (ex: conclusão de uma tarefa ou após usar o produto por N dias). O app exibe uma breve pesquisa – por exemplo uma pergunta NPS ou de satisfação com opções – possivelmente seguida de uma pergunta aberta para detalhes. Manter as perguntas simples e diretas, e combinar opção de múltipla escolha com campo aberto, tende a gerar melhores insights e menos abandono.",
    use_cases: ["SaaS", "Apps Mobile", "Plataformas de Serviço"],
    archetype: "async_flow",
    semantic_flow: [
      {
        semantic_type: "prompt",
        title: "Pesquisa Rápida",
        message: "Como tem sido sua experiência até agora? (Responda de 1 a 5)",
        actions: ["Enviar"]
      },
      {
        semantic_type: "decision",
        title: "Avaliação Recebida",
        branches: [
          {
            condition: "Nota alta (4-5)",
            next: "Perguntar comentário positivo ou sugestão"
          },
          {
            condition: "Nota média/baixa (1-3)",
            next: "Perguntar o que podemos melhorar"
          }
        ]
      },
      {
        semantic_type: "form",
        title: "Feedback Adicional",
        inputs: ["Comentário (opcional)"],
        actions: ["Enviar Feedback"]
      },
      {
        semantic_type: "feedback",
        title: "Agradecimento",
        message: "Obrigado! Agradecemos por compartilhar seu feedback."
      }
    ],
    block_references: []
  },
  {
    id: "form-errors",
    label: "Tratamento de Erros em Formulário",
    description: "Padrão de UX para validar entradas de formulário e exibir erros de maneira clara e construtiva. Ao submeter um formulário com problemas (campos obrigatórios vazios, formato inválido etc.), o sistema deve: indicar que ocorreu um erro, explicar exatamente o que está errado em linguagem simples (evitando códigos técnicos) e orientar como corrigir. Por exemplo, destacar o campo em vermelho com um ícone de aviso e mensagem do tipo \"Por favor, insira um email válido\" atende às três regras de Nielsen para erros: avisar que houve um erro, dizer o que foi, e instruir como resolver.",
    use_cases: ["Forms Web/Mobile", "Fluxos de Cadastro/Checkout"],
    archetype: "feedback_flow",
    semantic_flow: [
      {
        semantic_type: "validation",
        title: "Validar Campos",
        message: "Detectar campos vazios ou inválidos ao submeter o formulário"
      },
      {
        semantic_type: "feedback",
        title: "Exibir Erros",
        message: "Destacar campos com erro em vermelho e mensagens específicas (ex: \"Senha muito curta, mínimo 8 caracteres\")"
      },
      {
        semantic_type: "correction",
        title: "Orientar Correção",
        message: "Se possível, fornecer dica ou máscara para o formato correto (ex: 'Inclua @ no email')."
      },
      {
        semantic_type: "success",
        title: "Revalidar e Prosseguir",
        message: "Após correção, permitir nova submissão. Se tudo ok, seguir para o próximo passo."
      }
    ],
    block_references: []
  },
  {
    id: "404-error",
    label: "Página 404 - Não Encontrado",
    description: "Página exibida quando o usuário tenta acessar uma URL ou recurso inexistente. Uma boa página 404 mantém o usuário orientado e oferece caminhos úteis em vez de um beco sem saída. Isso inclui uma mensagem amigável admitindo que a página não foi encontrada, links para voltar à página inicial ou navegar para seções importantes, e até mesmo uma barra de busca. Páginas 404 personalizadas melhoram a usabilidade ao ajudar construtivamente o usuário a achar o que queria, em vez de deixá-lo perdido.",
    use_cases: ["Websites", "Web Apps"],
    archetype: "error_page",
    semantic_flow: [
      {
        semantic_type: "info",
        title: "404 - Página Não Encontrada",
        content: "Ops, não conseguimos encontrar a página que você buscava."
      },
      {
        semantic_type: "suggestion",
        title: "O que você pode fazer:",
        content: "- Verificar se o endereço está correto<br>- Ir para a <a href='/home'>Página Inicial</a><br>- Buscar pelo conteúdo desejado:"
      },
      {
        semantic_type: "search",
        title: "Buscar no site",
        inputs: ["Buscar..."],
        actions: ["Buscar"]
      }
    ],
    block_references: []
  },
  {
    id: "maintenance-error",
    label: "Tela de Erro Genérico / Manutenção",
    description: "Página mostrada quando o sistema enfrenta um erro interno (500) ou está temporariamente fora do ar para manutenção. Deve comunicar em linguagem simples o que houve e o que o usuário pode fazer a seguir. Segundo heurísticas de usabilidade, a mensagem de erro deve evitar códigos técnicos, indicar precisamente o problema e sugerir uma solução. Por exemplo: \"Estamos passando por instabilidade no servidor. Tente novamente mais tarde ou contate suporte.\" acompanhada de um botão de \"Tentar Novamente\".",
    use_cases: ["Web Apps", "Mobile Apps"],
    archetype: "error_page",
    semantic_flow: [
      {
        semantic_type: "info",
        title: "Erro Interno / Manutenção",
        content: "Desculpe, nosso serviço está indisponível no momento."
      },
      {
        semantic_type: "detail",
        title: "Detalhes (amigáveis)",
        content: "Estamos realizando manutenção ou enfrentando problemas técnicos. Código de referência: 500."
      },
      {
        semantic_type: "suggestion",
        title: "Próximos Passos",
        content: "Por favor, tente novamente em alguns minutos. Se o problema persistir, <a href='/suporte'>entre em contato com o suporte</a>."
      },
      {
        semantic_type: "action",
        title: "Tentar Novamente",
        actions: ["Recarregar Página"]
      }
    ],
    block_references: []
  },
  {
    id: "empty-state",
    label: "Estado Vazio (Empty State)",
    description: "Estado da interface quando não há dados para mostrar em determinada seção (por exemplo, um dashboard sem registros, uma lista ainda vazia). Em vez de deixar um espaço em branco, apresenta-se uma mensagem contextual explicando por que está vazio e o que o usuário pode fazer (geralmente um CTA para adicionar ou importar algo). Empty states orientam o usuário e podem ser oportunidades de onboarding. Devem ser concisos, claros e, se possível, incentivar uma ação próxima (ex: botão \"Criar novo item\").",
    use_cases: ["Dashboards", "Listas de Itens", "Aplicativos Recém-Usados"],
    archetype: "static_state",
    semantic_flow: [
      {
        semantic_type: "info",
        title: "Nada por aqui ainda",
        content: "Você ainda não tem nenhum projeto."
      },
      {
        semantic_type: "suggestion",
        title: "Próximos Passos",
        content: "Clique no botão abaixo para criar seu primeiro projeto e começar a usar o produto."
      },
      {
        semantic_type: "action",
        title: "CTA Primário",
        actions: ["+ Criar Projeto"]
      }
    ],
    block_references: []
  },
  {
    id: "search-no-results",
    label: "Resultado de Busca Vazio",
    description: "Estado apresentado quando uma busca do usuário não retorna nenhum resultado. Em vez de simplesmente mostrar '0 resultados', a interface fornece feedback útil: uma mensagem informando que nada foi encontrado para os termos usados e, crucialmente, sugestões do que fazer em seguida. Por exemplo, o sistema pode sugerir revisar a ortografia, tentar palavras-chave diferentes ou remover alguns filtros. Essas orientações ajudam o usuário a refinar sua busca em vez de atingir um beco sem saída.",
    use_cases: ["Busca de Produtos", "Busca em Sites/Apps"],
    archetype: "static_state",
    semantic_flow: [
      {
        semantic_type: "info",
        title: "Nenhum Resultado",
        content: "Não encontramos resultados para \"<termo_busca>\"."
      },
      {
        semantic_type: "suggestion",
        title: "Dicas:",
        content: "• Verifique se não há erros de digitação<br>• Tente usar outros termos semelhantes<br>• Amplie a busca removendo alguns filtros"
      },
      {
        semantic_type: "action",
        title: "Ação Secundária",
        actions: ["Limpar Filtros", "Ir para Página Inicial"]
      }
    ],
    block_references: []
  },
  {
    id: "permission-denied",
    label: "Acesso Negado (Permissão Insuficiente)",
    description: "Fluxo que ocorre quando o usuário tenta acessar uma página ou recurso para o qual não possui permissão. Em vez de simplesmente falhar silenciosamente ou apresentar um erro genérico, o sistema deve comunicar claramente que o acesso é restrito e, se aplicável, orientar sobre como obter acesso. Por exemplo, exibir uma mensagem \"Você não tem permissão para acessar esta seção\" e talvez um link para solicitar acesso ou alternar de conta. É importante que a interface lide graciosamente com esses casos de autorização, informando o usuário ao invés de deixá-lo confuso.",
    use_cases: ["SaaS com níveis de acesso", "Sistemas de Admin"],
    archetype: "error_page",
    semantic_flow: [
      {
        semantic_type: "info",
        title: "Acesso Negado",
        content: "Desculpe, você não possui permissão para acessar este recurso."
      },
      {
        semantic_type: "suggestion",
        title: "O que fazer?",
        content: "Se precisar de acesso, contate o administrador da sua conta ou faça login com um usuário autorizado."
      },
      {
        semantic_type: "action",
        title: "Ir para...",
        actions: ["Página Inicial", "Minhas Permissões"]
      }
    ],
    block_references: []
  },
  {
    id: "network-error",
    label: "Estado Offline / Erro de Conexão",
    description: "Fluxo exibido quando o aplicativo detecta que o usuário está sem internet ou ocorreu uma falha de conexão. Em vez de a aplicação simplesmente não funcionar, é apresentada uma tela ou banner indicando que o dispositivo está offline, geralmente com texto como \"Você está offline\" e um botão de \"Tentar novamente\". Embora o app possa automaticamente reconectar quando possível, oferecer um botão de 'Retry' dá ao usuário senso de controle (mesmo que simbólico) e melhora a experiência, conforme recomendado em diretrizes de design offline.",
    use_cases: ["Mobile Apps", "Web Apps (PWA)"],
    archetype: "static_state",
    semantic_flow: [
      {
        semantic_type: "info",
        title: "Sem Conexão",
        content: "Parece que você está offline no momento."
      },
      {
        semantic_type: "suggestion",
        title: "Aguardando Conexão",
        content: "Verifique sua internet. Continuaremos tentando reconectar automaticamente."
      },
      {
        semantic_type: "action",
        title: "Tentar Novamente",
        actions: ["Recarregar / Tentar Novamente"]
      },
      {
        semantic_type: "feedback",
        title: "Reconectado",
        message: "Conexão restabelecida! Retomando o uso normal do app."
      }
    ],
    block_references: []
  },
  {
    id: "search-autocomplete",
    label: "Autocomplete de Busca (Sugestões)",
    description: "Padrão de experiência onde ao digitar em um campo de busca, o sistema oferece sugestões automáticas de termos ou resultados relacionados antes mesmo da busca final. Isso ajuda o usuário a formular melhor a consulta ou encontrar o item desejado mais rapidamente. Por exemplo, ao começar a digitar \"notebook\", o dropdown de autocomplete pode sugerir \"notebook dell i15\", \"notebook gamer 16GB\" etc. Essas sugestões aparecem logo abaixo do campo de busca, acelerando a interação e reduzindo erros de digitação.",
    use_cases: ["E-commerce", "Busca de Conteúdo", "Apps de Viagem (destinos)"],
    archetype: "assistive_flow",
    semantic_flow: [
      {
        semantic_type: "input",
        title: "Campo de Busca",
        inputs: ["Digite sua busca..."],
        actions: ["Digitar"]
      },
      {
        semantic_type: "dropdown",
        title: "Sugestões",
        content: "Sugestões em tempo real com base no que foi digitado (atualizando a cada caractere digitado)"
      },
      {
        semantic_type: "action",
        title: "Selecionar Sugestão",
        actions: ["Clicar em uma das sugestões"]
      },
      {
        semantic_type: "result",
        title: "Busca com Sugestão",
        message: "Executar busca ou navegar diretamente para o resultado selecionado pelo usuário."
      }
    ],
    block_references: []
  },
  {
    id: "command-palette",
    label: "Paleta de Comandos (Atalho Global)",
    description: "Padrão de interface – popular em apps de produtividade e IDEs – que disponibiliza um prompt de comando universal acionado por atalho de teclado (por exemplo, Cmd/Ctrl+K). Ao invocar a paleta, o usuário pode digitar para buscar qualquer ação ou conteúdo dentro do aplicativo (abrir páginas, executar comandos, navegar para configurações, etc.). Esse elemento dá acesso rápido a funcionalidades sem navegar por menus. Uma paleta de comandos tipicamente se apresenta como um campo de texto livre que filtra uma lista de comandos enquanto se digita.",
    use_cases: ["Aplicações de Alta Produtividade", "Ferramentas para Power Users"],
    archetype: "assistive_flow",
    semantic_flow: [
      {
        semantic_type: "action",
        title: "Atalho de Teclado",
        actions: ["Pressionar Cmd+K (ou outro atalho global)"]
      },
      {
        semantic_type: "modal",
        title: "Paleta Aberta",
        content: "Campo de busca aparece centralizado com placeholder 'Digite um comando...'"
      },
      {
        semantic_type: "input",
        title: "Buscar Comandos",
        inputs: ["Texto do comando desejado"],
        actions: ["Digitar"]
      },
      {
        semantic_type: "list",
        title: "Lista de Comandos Filtrados",
        content: "Mostra comandos correspondentes ao texto (ex: 'Nova Tarefa', 'Navegar para Configurações') atualizando conforme o usuário digita."
      },
      {
        semantic_type: "action",
        title: "Executar Comando",
        actions: ["Selecionar um dos comandos listados (Enter)"]
      },
      {
        semantic_type: "result",
        title: "Ação Executada",
        message: "O aplicativo abre a tela ou realiza a ação escolhida instantaneamente."
      }
    ],
    block_references: []
  },
  {
    id: "schedule-booking",
    label: "Agendamento de Serviço/Reunião",
    description: "Fluxo para agendar um compromisso, reserva ou reunião. O usuário seleciona uma data num calendário, escolhe um horário disponível e confirma a reserva, possivelmente fornecendo informações adicionais (como local ou assunto da reunião). Aplicativos de reserva eficientes guiam o usuário por esse processo de forma fluida e garantindo que ele entenda cada passo. Um fluxo de booking bem desenhado torna o agendamento **suave e eficiente**, aumentando a satisfação e reduzindo desistências.",
    use_cases: ["Agenda de Reuniões", "Reserva de Serviços (médicos, salões)", "Booking de Viagens"],
    archetype: "wizard",
    semantic_flow: [
      {
        semantic_type: "calendar",
        title: "Selecionar Data",
        content: "Calendário exibindo dias disponíveis para agendar",
        actions: ["Escolher Dia"]
      },
      {
        semantic_type: "list",
        title: "Selecionar Horário",
        content: "Lista de horários livres no dia escolhido",
        actions: ["Escolher Horário"]
      },
      {
        semantic_type: "form",
        title: "Detalhes do Agendamento",
        inputs: ["Nome/Identificação", "Notas ou Preferências (opcional)"],
        actions: ["Confirmar Agendamento"]
      },
      {
        semantic_type: "confirmation",
        title: "Reserva Confirmada",
        message: "Seu agendamento para <data e hora> foi confirmado. Você receberá uma confirmação por email."
      }
    ],
    block_references: []
  },
  {
    id: "file-upload",
    label: "Upload de Arquivo com Feedback",
    description: "Fluxo no qual o usuário seleciona um arquivo para enviar (fazer upload) e o sistema fornece retorno visual do progresso. Ao escolher o arquivo (via botão ou arraste-e-solte), uma barra de progresso ou indicador é exibido, informando o andamento do envio (por exemplo, 0% até 100%). Isso mantém o usuário informado de que algo está acontecendo e evita que ele fique incerto. Fornecer esse feedback de progresso – seja via barra ou mensagem de status – é fundamental para uma boa UX em uploads.",
    use_cases: ["Formulários com Anexo", "Uploads de Imagem/Documento", "Envio de Tarefas/Trabalhos"],
    archetype: "async_flow",
    semantic_flow: [
      {
        semantic_type: "action",
        title: "Selecionar Arquivo",
        actions: ["Clique no botão ou arraste um arquivo para a área"]
      },
      {
        semantic_type: "process",
        title: "Upload em Andamento",
        message: "Enviando arquivo: 45% concluído..."
      },
      {
        semantic_type: "feedback",
        title: "Upload Concluído",
        message: "Arquivo enviado com sucesso!"
      },
      {
        semantic_type: "result",
        title: "Disponibilizar Conteúdo",
        message: "Exibir link ou nome do arquivo na interface (ex: listar arquivo anexado ao formulário)."
      }
    ],
    block_references: []
  },
  {
    id: "image-cropper",
    label: "Envio e Corte de Imagem",
    description: "Fluxo para o usuário enviar uma imagem (por ex. foto de perfil) e ajustá-la via ferramenta de corte antes de salvar. Após selecionar a imagem, o usuário vê uma prévia com uma área de seleção (retângulo/quadrado ajustável) para definir o enquadramento desejado. Ele pode ampliar/reduzir ou mover a área de corte. Ao confirmar, a versão recortada é salva. Esse fluxo garante que imagens de perfil ou thumbnails fiquem no tamanho e proporção ideais, dando controle ao usuário sobre a apresentação.",
    use_cases: ["Cadastro/Perfil", "Envio de Imagens (ex: posts)"],
    archetype: "modal_flow",
    semantic_flow: [
      {
        semantic_type: "action",
        title: "Selecionar Imagem",
        actions: ["Upload de imagem do dispositivo"]
      },
      {
        semantic_type: "preview",
        title: "Pré-visualização com Corte",
        content: "Mostra a imagem com uma moldura de corte ajustável (usuário pode arrastar/redimensionar a área marcada)"
      },
      {
        semantic_type: "action",
        title: "Ajustar e Confirmar",
        actions: ["Mover área de corte", "Zoom da imagem", "Aplicar Corte"]
      },
      {
        semantic_type: "result",
        title: "Imagem Salva",
        message: "A imagem recortada foi salva com sucesso."
      }
    ],
    block_references: []
  },
  {
    id: "language-selection",
    label: "Seleção de Idioma da Interface",
    description: "Fluxo que permite ao usuário escolher o idioma de preferência para a interface do aplicativo. Pode ocorrer no primeiro acesso (ex: tela de splash com seleção de idioma) ou estar disponível nas configurações. Uma implementação típica apresenta uma lista de idiomas suportados (nome do idioma escrito na própria língua) para o usuário selecionar. Ao escolher, o app aplica imediatamente a mudança (ou após confirmação) e eventualmente carrega novamente o conteúdo traduzido. Adaptar a interface ao idioma do usuário aumenta a relevância e engajamento, melhorando a experiência de uso em mercados diversos.",
    use_cases: ["Apps Globais", "Softwares Multilíngues"],
    archetype: "settings_flow",
    semantic_flow: [
      {
        semantic_type: "list",
        title: "Idiomas Disponíveis",
        content: "Ex: English, Español, Português, Français..."
      },
      {
        semantic_type: "action",
        title: "Selecionar Idioma",
        actions: ["Selecionar uma das opções"]
      },
      {
        semantic_type: "confirmation",
        title: "Confirmar Troca",
        message: "Mudar o idioma para Português? (Algumas traduções podem requerer recarga da página)",
        actions: ["Sim", "Não"]
      },
      {
        semantic_type: "result",
        title: "Idioma Alterado",
        message: "A interface agora está em Português."
      }
    ],
    block_references: []
  },
  {
    id: "location-permission",
    label: "Solicitação de Permissão de Localização",
    description: "Fluxo em que o app solicita acesso à localização geográfica do dispositivo, necessário para recursos como mapas, check-ins ou recomendações locais. Semelhante ao pedido de notificações, é recomendado enquadrar o contexto antes do prompt nativo – por exemplo, explicar que permitir acesso à localização habilitará funcionalidades úteis (\"Mostrar restaurantes próximos\"). O momento do pedido também deve coincidir com a necessidade, aumentando as chances de concordância do usuário. Pedir permissão exatamente quando o usuário tenta usar um recurso que depende de localização tende a resultar em respostas mais positivas.",
    use_cases: ["Apps de Mapas/Viagem", "Apps de Delivery/Ride-Hailing", "Redes Sociais com Check-in"],
    archetype: "async_flow",
    semantic_flow: [
      {
        semantic_type: "prompt",
        title: "Permitir Localização?",
        message: "Para mostrar conteúdos perto de você, precisamos da sua permissão de localização.",
        actions: ["Entendi, pedir permissão", "Não agora"]
      },
      {
        semantic_type: "external_prompt",
        title: "Prompt do Sistema",
        message: "\"App X\" gostaria de acessar sua localização (Permitir/Negar)"
      },
      {
        semantic_type: "feedback",
        title: "Permissão Concedida",
        message: "Localização habilitada! Exibindo resultados próximos."
      },
      {
        semantic_type: "feedback",
        title: "Permissão Negada",
        message: "Não foi possível acessar localização. Alguns recursos ficarão limitados."
      }
    ],
    block_references: []
  },
  {
    id: "app-rating",
    label: "Solicitar Avaliação do App",
    description: "Fluxo que pede ao usuário para avaliar o aplicativo na loja (App Store/Google Play) após um período de uso ou evento positivo. Tipicamente, o app detecta um 'momento de satisfação' – por exemplo, após o usuário concluir com sucesso uma tarefa importante ou após várias sessões – e então exibe um pop-up amigável: \"Você está gostando do app?\". Se o usuário indicar que sim, o fluxo prossegue para o prompt nativo de avaliação (ou link para a loja). Boas práticas sugerem solicitar avaliações logo após experiências positivas para pegar o usuário no melhor momento, aumentando a probabilidade de avaliações altas.",
    use_cases: ["Apps Mobile", "Games"],
    archetype: "async_flow",
    semantic_flow: [
      {
        semantic_type: "prompt",
        title: "Curtiu o App?",
        message: "Estamos felizes em saber que você está gostando! Que tal avaliar nosso app?",
        actions: ["Avaliar Agora", "Depois"]
      },
      {
        semantic_type: "external_prompt",
        title: "Prompt de Avaliação",
        message: "Diálogo nativo da loja solicitando nota (estrelas) e comentário"
      },
      {
        semantic_type: "feedback",
        title: "Agradecimento",
        message: "Obrigado por avaliar! Sua opinião ajuda muito."
      },
      {
        semantic_type: "fallback",
        title: "Feedback Negativo",
        message: "Se o usuário indicou insatisfação (não), abrir um formulário interno perguntando no que podemos melhorar, em vez de levá-lo à loja."
      }
    ],
    block_references: []
  },
  {
    id: "plan-upgrade",
    label: "Upgrade de Plano (Upsell)",
    description: "Fluxo que incentiva o usuário de um produto SaaS a mudar para um plano pago superior. Pode ser disparado contextualmente (ex: quando o usuário alcança limites do plano grátis ou durante a sessão de um usuário heavy user). Geralmente aparece um modal ou banner com uma mensagem personalizada destacando os benefícios do upgrade. Por exemplo, identificar 'power users' e mostrar um pop-up convidando-os a conhecer planos premium na próxima vez que fizerem login. O usuário pode dispensar o aviso ou seguir para a página de preços para escolher um plano melhor.",
    use_cases: ["SaaS Freemium", "Apps com Planos Gratuitos/Pagos"],
    archetype: "async_flow",
    semantic_flow: [
      {
        semantic_type: "trigger",
        title: "Identificar Oportunidade",
        message: "Usuário atingiu 90% do limite do plano gratuito (sinal para upsell)"
      },
      {
        semantic_type: "notification",
        title: "Sugestão de Upgrade",
        message: "Você está aproveitando bastante! Considere o plano Pro para ter espaço ilimitado e recursos avançados.",
        actions: ["Ver Planos", "Fechar"]
      },
      {
        semantic_type: "decision",
        title: "Interação do Usuário",
        branches: [
          {
            condition: "Clicou em Ver Planos",
            next: "Abrir página de preços/upgrade"
          },
          {
            condition: "Fechou/Ignore",
            next: "Não mostrar novamente por algum tempo"
          }
        ]
      },
      {
        semantic_type: "form",
        title: "Selecionar Novo Plano",
        inputs: ["Opções de plano (Pro, Enterprise, etc.)"],
        actions: ["Upgrade"]
      },
      {
        semantic_type: "completion",
        title: "Upgrade Realizado",
        message: "Parabéns, você agora está no plano Pro! Desfrute dos novos recursos."
      }
    ],
    block_references: []
  },
  {
    id: "referral",
    label: "Programa de Indicação (Referral)",
    description: "Fluxo onde usuários podem indicar outras pessoas em troca de benefícios (crédito, brindes etc.). Inicia normalmente com uma tela explicando as recompensas do programa de indicação e fornecendo um botão/CTA para convidar amigos. Ao clicar, o usuário preenche um formulário com email do amigo ou recebe um link de convite único. Se ele não interagir, muitas vezes o sistema simplesmente fecha o modal e retorna para onde estava (sem saída morta). Se prosseguir e enviar convites, os indicados recebem emails com o convite e instruções para se cadastrarem. O fluxo ideal acompanha se o indicado completou o cadastro e recompensa o indicador adequadamente, fechando o loop.",
    use_cases: ["Apps de Serviços", "Fintech (indicação de clientes)", "SaaS com crescimento por referrals"],
    archetype: "async_flow",
    semantic_flow: [
      {
        semantic_type: "info",
        title: "Tela de Indicação",
        content: "Exposição do programa: 'Convide amigos e ganhe X'. Explica regras e recompensas.",
        actions: ["Convidar Amigos"]
      },
      {
        semantic_type: "form",
        title: "Enviar Convite",
        inputs: ["Email do Amigo"],
        actions: ["Enviar Convite"]
      },
      {
        semantic_type: "link",
        title: "Ou Compartilhar Link",
        content: "Link único de indicação: app.com/invite?codigo=ABC123 (botão para copiar link)"
      },
      {
        semantic_type: "feedback",
        title: "Convites Enviados",
        message: "Convite enviado! Você será notificado quando seu amigo se cadastrar."
      },
      {
        semantic_type: "completion",
        title: "Indicação Convertida",
        message: "Seu amigo se cadastrou – parabéns, você ganhou a recompensa Y!"
      }
    ],
    block_references: []
  },
  {
    id: "oauth-consent",
    label: "Fluxo de Consentimento OAuth (Conectar Conta Externa)",
    description: "Fluxo que ocorre ao integrar o aplicativo com um serviço externo via OAuth (ex: \"Conectar com Google Drive\"). O usuário inicia clicando em um botão de conexão, então é redirecionado para a tela de consentimento do provedor externo (Google, Facebook, etc.) que mostra quem está solicitando acesso e quais dados serão acessados. O usuário pode então aceitar ou recusar. Se aceitar, o provedor retorna um token de acesso ao app e a integração é estabelecida, tipicamente confirmada com uma mensagem de sucesso (\"Conta Google conectada!\"). Se recusar, o app retorna ao estado anterior indicando que a conexão não foi feita.",
    use_cases: ["Integrações de Apps (calendar, drive)", "Login com redes sociais (OAuth)"],
    archetype: "redirect_flow",
    semantic_flow: [
      {
        semantic_type: "action",
        title: "Iniciar Conexão",
        actions: ["Conectar ao <Serviço Externo>"]
      },
      {
        semantic_type: "external_redirect",
        title: "Redirecionar para OAuth",
        message: "Abrindo <Serviço Externo> para autenticação..."
      },
      {
        semantic_type: "consent",
        title: "Tela de Consentimento",
        content: "Externa: exibe app solicitante e lista de permissões que serão concedidas ('Este aplicativo poderá: ler seus contatos, enviar emails em seu nome, ...')",
        actions: ["Permitir", "Negar"]
      },
      {
        semantic_type: "external_redirect",
        title: "Retorno ao App",
        message: "Retornando ao aplicativo com o resultado da autenticação..."
      },
      {
        semantic_type: "feedback",
        title: "Integração Concluída",
        message: "Conta <Serviço Externo> conectada com sucesso! Agora você pode importar/exportar dados."
      },
      {
        semantic_type: "feedback",
        title: "Integração Negada",
        message: "Você não concedeu acesso ao <Serviço Externo>. A conexão não foi realizada."
      }
    ],
    block_references: []
  },
  {
    id: "onboarding-checklist",
    label: "Checklist de Onboarding",
    description: "Padrão de onboarding onde ao novo usuário é apresentada uma lista de tarefas recomendadas para realizar no produto, ajudando-o a alcançar valor rapidamente. Essa checklist (geralmente mostrada em um painel ou modal inicial) inclui itens como 'Complete seu perfil', 'Crie seu primeiro projeto', 'Convide um colega', etc., muitas vezes com indicadores de progresso (% concluído). Cada tarefa completada é marcada na lista, dando senso de avanço e conquista. Um checklist bem feito traz tarefas claras e atingíveis, com fluxo lógico, e celebra quando concluídas – o que orienta o usuário e o motiva durante os primeiros passos.",
    use_cases: ["SaaS Complexos", "Aplicativos com Curva de Aprendizado"],
    archetype: "onboarding_flow",
    semantic_flow: [
      {
        semantic_type: "list",
        title: "Tarefas de Boas-vindas",
        content: "1. Adicionar foto de perfil (✔️)<br>2. Criar projeto inicial (❌)<br>3. Convidar colega (❌)"
      },
      {
        semantic_type: "action",
        title: "Executar Tarefa",
        actions: ["Botão ao lado de cada item da lista, ex: 'Ir para Perfil'"]
      },
      {
        semantic_type: "feedback",
        title: "Marcar Conclusão",
        message: "Ao completar uma tarefa (ex: perfil preenchido), marcar item como concluído na lista e atualizar progresso."
      },
      {
        semantic_type: "completion",
        title: "Onboarding Completo",
        message: "Parabéns, você concluiu 100% do onboarding! 🎉 Aproveite o app."
      }
    ],
    block_references: []
  },
  {
    id: "ai-chat-interface",
    label: "Interface de Chat com Assistente de IA",
    description: "Fluxo de interação em formato de chat entre o usuário e um assistente de Inteligência Artificial dentro do app. A interface apresenta um campo onde o usuário digita uma pergunta ou comando em linguagem natural, e mensagens tipo 'balão' mostram tanto as perguntas do usuário quanto as respostas geradas pela IA. Normalmente, há elementos como avatar do bot, indicador de 'digitando...' enquanto a IA processa, e possivelmente sugestões de perguntas prontas. O design dessa interface define a experiência conversacional inteira – deve ser clara, com mensagens curtas e legíveis, e tornar a conversa com a IA fácil e agradável para o usuário.",
    use_cases: ["Chatbots de Suporte", "Assistentes Pessoais em Apps", "Ferramentas de IA (ex: geração de texto)"],
    archetype: "conversational_flow",
    semantic_flow: [
      {
        semantic_type: "user_message",
        title: "Usuário Pergunta",
        message: "Ex: 'Qual é a previsão do tempo amanhã?'"
      },
      {
        semantic_type: "bot_processing",
        title: "IA Processando",
        message: "Indicador de que a IA está pensando (animação de reticências ou 'digitando...')"
      },
      {
        semantic_type: "bot_message",
        title: "Resposta da IA",
        message: "Ex: 'Amanhã haverá sol, com temperatura em torno de 25°C.' (resposta gerada)"
      },
      {
        semantic_type: "suggestion",
        title: "Sugestões de Prompt",
        content: "Botões ou dicas de perguntas relacionadas que o usuário pode clicar (ex: 'Previsão para próximos 5 dias')"
      },
      {
        semantic_type: "user_message",
        title: "Usuário Continuar",
        message: "Usuário pode fazer outra pergunta ou refinar (ex: 'E depois de amanhã?')"
      }
    ],
    block_references: []
  },
  {
    id: "dark-mode-toggle",
    label: "Alternância Modo Claro/Escuro",
    description: "Fluxo que permite ao usuário alternar o tema da interface entre claro e escuro. Normalmente implementado como um toggle (com ícone de sol/lua) nas configurações ou barra de ferramentas. Ao ativar, a mudança de cores é aplicada imediatamente com uma transição suave, para não cansar a vista do usuário. É importante relembrar a preferência do usuário nas próximas sessões. Usuários apreciam ter essa escolha, pois podem preferir modo escuro em ambientes de baixa luz ou por conforto visual. Recomenda-se um toggle visível e transição suave para a mudança parecer natural, não abrupta.",
    use_cases: ["Apps Mobile e Desktop", "Web Apps"],
    archetype: "settings_flow",
    semantic_flow: [
      {
        semantic_type: "toggle",
        title: "Configuração de Tema",
        options: ["🌞 Claro", "🌙 Escuro"],
        actions: ["Alternar para Escuro"]
      },
      {
        semantic_type: "transition",
        title: "Aplicar Tema",
        message: "Aplicando paleta de cores do modo escuro com animação de transição"
      },
      {
        semantic_type: "confirmation",
        title: "Tema Ativado",
        message: "Modo escuro ativado. A preferência será lembrada."
      },
      {
        semantic_type: "toggle",
        title: "Reverter Tema",
        actions: ["Alternar para Claro"]
      }
    ],
    block_references: []
  }
];









