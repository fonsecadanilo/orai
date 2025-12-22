# 🚀 Resumo Simplificado do Funcionamento - Oria

Este documento explica de forma direta como o Oria funciona, transformando suas ideias em fluxogramas completos através de Agentes de IA.

## 🎯 O Que é o Oria?

O Oria é um sistema que **converte descrições em texto** (ex: "Quero um fluxo de login") em **diagramas visuais interativos** (User Flows), além de gerar documentação de produto completa automaticamente.

---

## 🤖 Como Funciona (O Pipeline dos 4 Agentes)

O processo acontece em etapas, coordenadas por um **Orquestrador**. Imagine uma linha de produção onde cada "funcionário" (Agente) é especialista em uma tarefa:

### 1. 📋 Agente 1: Master Rule Creator (Analista de Negócios)
*   **Entrada:** Sua descrição ("Quero um fluxo de cadastro...").
*   **O que faz:** Entende o objetivo, define quem participa (usuário, sistema) e escreve as regras de negócio em texto.
*   **Saída:** Um documento estruturado com o "caminho feliz", erros possíveis e regras.

### 2. 🧩 Agente 2: Subrules Decomposer (Arquiteto Lógico)
*   **Entrada:** As regras criadas pelo Agente 1.
*   **O que faz:** Quebra as regras em passos lógicos individuais (nós simbólicos).
*   **Saída:** Uma lista de passos como "Digitar Email", "Validar Senha", "Erro de Login", sem se preocupar com o desenho visual.

### 3. 📐 Agente 3: Flow Generator (Designer Automático)
*   **Entrada:** Os passos lógicos do Agente 2.
*   **O que faz:** Este é o único agente que **NÃO é IA**. Ele é puro código matemático. Ele calcula onde colocar cada caixinha na tela e desenha as setas para garantir que o diagrama fique organizado e legível.
*   **Saída:** O diagrama visual pronto com posições X e Y.

### 4. 🗺️ Agente 4: Journey & Features (Product Designer)
*   **Entrada:** As regras do Agente 1 (roda em paralelo com o Agente 2).
*   **O que faz:** Cria uma história (jornada do usuário) e lista as funcionalidades técnicas necessárias para o desenvolvimento.
*   **Saída:** Documentação de produto e lista de features.

---

## 🎨 O Resultado Final

Ao final, você recebe:
1.  Um **Diagrama Visual** interativo e editável.
2.  Uma **Documentação de Negócio** completa.
3.  Uma **Lista de Funcionalidades** para os desenvolvedores.

Tudo isso gerado a partir de uma simples frase!
