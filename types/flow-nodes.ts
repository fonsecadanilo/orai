// ========================================
// TIPOS DE NÓS DO FLUXO - Baseado no Schema Zod
// ========================================
// Este arquivo define a estrutura de tipos para os nós do editor de fluxo.
// Extraído e adaptado do schema Zod fornecido.
//
// NOTA v3.1: Para os novos tipos expandidos, veja:
// - lib/schemas/nodeTypesV3.ts (schema Zod completo)
// - lib/agents/v3/types.ts (tipos da pipeline v3)

// ========================================
// ENUMS E TIPOS BASE
// ========================================

/**
 * Tipos de nós disponíveis no editor de fluxo (v2 - legado)
 */
export type NodeType = 
  | 'trigger'      // Gatilho inicial do fluxo
  | 'action'       // Ação executada pelo sistema
  | 'condition'    // Condição/decisão com bifurcação
  | 'subflow'      // Referência a outro fluxo
  | 'field_group'  // Grupo de campos de formulário
  | 'end'          // Nó de término do fluxo
  | 'text';        // Nó de texto (comentário ou regra)

/**
 * Tipos de nós expandidos v3.1
 * Importar de @/lib/schemas/nodeTypesV3 para uso com validação Zod
 */
export type NodeTypeV3 = 
  // Interação com Usuário
  | 'form'                 // Formulário para entrada de dados
  | 'choice'               // Escolha entre opções
  | 'action'               // Ação executada pelo sistema
  // Feedback
  | 'feedback_success'     // Feedback positivo
  | 'feedback_error'       // Feedback de erro
  // Condições
  | 'condition'            // Condição/decisão com bifurcação
  // Término
  | 'end_success'          // Término bem-sucedido
  | 'end_error'            // Término com erro
  | 'end_neutral'          // Término neutro (cancelamento)
  // Recuperação
  | 'retry'                // Tentativa novamente
  | 'fallback'             // Caminho alternativo
  | 'loopback'             // Retorno a passo anterior
  // Ações Especiais
  | 'background_action'    // Ação em segundo plano
  | 'delayed_action'       // Ação com delay
  | 'configuration_matrix' // Matriz de configuração
  | 'insight_branch'       // Ramificação por dados
  // Legacy
  | 'trigger'
  | 'end'
  | 'subflow'
  | 'field_group'
  | 'text'
  | 'note';

/**
 * Categorias de ações disponíveis
 */
export type ActionCategory = 
  | 'form'   // Ações relacionadas a formulários
  | 'ui'     // Ações de interface do usuário
  | 'api'    // Chamadas de API
  | 'crud'   // Operações de banco de dados
  | 'file';  // Operações com arquivos

/**
 * Estados de saída para nós de ação
 */
export type OutputState = 'success' | 'error' | 'loading';

/**
 * Subtipos do nó de texto
 * - comment: Comentários explicativos no meio do fluxo (uso: IA adiciona quando necessário para clareza)
 * - rule: Blocos visuais representando regras de negócio (conectados aos nós do user flow)
 */
export type TextSubtype = 'comment' | 'rule';

/**
 * Tipos de campos disponíveis no FieldGroupNode
 */
export type FieldType = 
  | 'text' 
  | 'email' 
  | 'number' 
  | 'date' 
  | 'select' 
  | 'boolean' 
  | 'textarea';

/**
 * Modos de exibição do FieldGroupNode
 */
export type FieldGroupMode = 'all_in_one' | 'step_by_step';

// ========================================
// INTERFACES DOS NÓS
// ========================================

/**
 * Interface base para todos os nós
 */
interface BaseNode {
  id: string;
}

/**
 * Nó Trigger - Gatilho inicial do fluxo
 * Representa o ponto de entrada ou evento que inicia o fluxo
 */
export interface TriggerNodeData extends BaseNode {
  type: 'trigger';
  label: string;
  description?: string;
}

/**
 * Nó Action - Ação executada pelo sistema
 * Representa uma ação específica categorizada
 */
export interface ActionNodeData extends BaseNode {
  type: 'action';
  label: string;
  description?: string;
  category: ActionCategory;
  verb: string; // Verbo da ação (ex: "enviar", "criar", "validar")
  outputs?: OutputState[];
}

/**
 * Nó Condition - Condição/decisão
 * Representa um ponto de decisão com caminhos yes/no
 */
export interface ConditionNodeData extends BaseNode {
  type: 'condition';
  label?: string;
  expression: string; // Expressão da condição (ex: "email válido?")
  paths: {
    yes: string; // ID do próximo nó se verdadeiro
    no: string;  // ID do próximo nó se falso
  };
}

/**
 * Nó Subflow - Referência a outro fluxo
 * Permite encapsular e reutilizar fluxos existentes
 */
export interface SubflowNodeData extends BaseNode {
  type: 'subflow';
  label?: string;
  targetFlowId: string; // ID do fluxo referenciado
}

/**
 * Campo individual dentro de um FieldGroupNode
 */
export interface FieldDefinition {
  id: string;
  label: string;
  type: FieldType;
  required?: boolean;
  options?: string[]; // Para campos do tipo 'select'
}

/**
 * Nó FieldGroup - Grupo de campos de formulário
 * Representa um conjunto de campos de entrada
 */
export interface FieldGroupNodeData extends BaseNode {
  type: 'field_group';
  label: string;
  mode: FieldGroupMode;
  fields: FieldDefinition[];
}

/**
 * Nó End - Término do fluxo
 * Representa o ponto final de um caminho no fluxo
 */
export interface EndNodeData extends BaseNode {
  type: 'end';
  label?: string;
  status?: 'success' | 'error'; // Indica se é um fim bem-sucedido ou de erro
}

/**
 * Nó Text - Texto (Comentário ou Regra)
 * 
 * REGRAS DE USO:
 * 1. subtype: 'comment' - Usado para fazer comentários explicativos no meio do fluxo.
 *    A IA deve criar comentários apenas quando EXTREMAMENTE necessário para clareza.
 * 
 * 2. subtype: 'rule' - Usado para criar VISUALMENTE as regras de negócio no editor.
 *    Esses blocos de texto representam regras e devem estar CONECTADOS aos nós
 *    adequadamente de acordo com a regra que representam.
 */
export interface TextNodeData extends BaseNode {
  type: 'text';
  label: string;
  subtype: TextSubtype;
  content: string; // Conteúdo do texto/regra
  linkedRuleId?: number; // ID da regra de negócio vinculada (para subtype: 'rule')
}

// ========================================
// UNION TYPE - Todos os tipos de nós
// ========================================

/**
 * Union type discriminada para todos os tipos de nós do fluxo
 */
export type FlowNodeData = 
  | TriggerNodeData 
  | ActionNodeData 
  | ConditionNodeData 
  | SubflowNodeData 
  | FieldGroupNodeData 
  | EndNodeData 
  | TextNodeData;

// ========================================
// TIPOS PARA REACT FLOW
// ========================================

/**
 * Mapeamento de tipos de nó para componentes React Flow
 */
export const NODE_TYPE_MAPPING = {
  trigger: 'trigger',
  action: 'action',
  condition: 'condition',
  subflow: 'subflow',
  field_group: 'fieldGroup',
  end: 'end',
  text: 'text',
} as const;

/**
 * Categorias de ação com seus rótulos e ícones
 */
export const ACTION_CATEGORIES: Record<ActionCategory, { label: string; icon: string }> = {
  form: { label: 'Formulário', icon: 'FileInput' },
  ui: { label: 'Interface', icon: 'Layout' },
  api: { label: 'API', icon: 'Globe' },
  crud: { label: 'Banco de Dados', icon: 'Database' },
  file: { label: 'Arquivo', icon: 'File' },
};

/**
 * Subtipos de texto com seus rótulos
 */
export const TEXT_SUBTYPES: Record<TextSubtype, { label: string; description: string }> = {
  comment: { 
    label: 'Comentário', 
    description: 'Comentário explicativo no fluxo (use com moderação)' 
  },
  rule: { 
    label: 'Regra de Negócio', 
    description: 'Bloco visual representando uma regra de negócio' 
  },
};

// ========================================
// HELPERS E VALIDAÇÕES
// ========================================

/**
 * Verifica se um nó é do tipo especificado
 */
export function isNodeType<T extends FlowNodeData['type']>(
  node: FlowNodeData,
  type: T
): node is Extract<FlowNodeData, { type: T }> {
  return node.type === type;
}

/**
 * Cria um novo nó com valores padrão
 */
export function createDefaultNode(type: FlowNodeData['type'], id: string): FlowNodeData {
  const baseNode = { id };
  
  switch (type) {
    case 'trigger':
      return { ...baseNode, type: 'trigger', label: 'Novo Trigger' };
    case 'action':
      return { 
        ...baseNode, 
        type: 'action', 
        label: 'Nova Ação',
        category: 'ui',
        verb: 'executar',
        outputs: ['success', 'error']
      };
    case 'condition':
      return { 
        ...baseNode, 
        type: 'condition', 
        expression: 'Condição?',
        paths: { yes: '', no: '' }
      };
    case 'subflow':
      return { ...baseNode, type: 'subflow', targetFlowId: '' };
    case 'field_group':
      return { 
        ...baseNode, 
        type: 'field_group', 
        label: 'Campos',
        mode: 'all_in_one',
        fields: []
      };
    case 'end':
      return { ...baseNode, type: 'end', label: 'Fim' };
    case 'text':
      return { 
        ...baseNode, 
        type: 'text', 
        label: 'Texto',
        subtype: 'comment',
        content: ''
      };
  }
}








