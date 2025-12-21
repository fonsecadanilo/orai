/**
 * Componentes de Nós React Flow v3.1
 * 
 * Novos tipos de nós para a arquitetura v3.1:
 * - FormNode: Formulários com campos colapsáveis
 * - ChoiceNode: Escolha entre opções
 * - FeedbackNode: Feedback de sucesso/erro
 * - RetryNode: Tentativa novamente
 * - FallbackNode: Caminho alternativo
 * - LoopbackNode: Retorno a passo anterior
 * - BackgroundActionNode: Ação em background
 * - DelayedActionNode: Ação com delay
 * - ConfigurationMatrixNode: Matriz de configuração
 * - InsightBranchNode: Ramificação por dados
 * 
 * Componentes utilitários:
 * - ReuseIndicator: Indicador de nó reutilizado
 * - CollapsibleSubnodes: Subnós colapsáveis
 */

// Nós principais
export { FormNodeV3 } from "./FormNodeV3";
export { ChoiceNodeV3 } from "./ChoiceNodeV3";
export { FeedbackNodeV3 } from "./FeedbackNodeV3";
export { ConditionNodeV3 } from "./ConditionNodeV3";
export { EndNodeV3 } from "./EndNodeV3";
export { RetryNodeV3 } from "./RetryNodeV3";
export { FallbackNodeV3 } from "./FallbackNodeV3";
export { LoopbackNodeV3 } from "./LoopbackNodeV3";
export { BackgroundActionNodeV3 } from "./BackgroundActionNodeV3";
export { DelayedActionNodeV3 } from "./DelayedActionNodeV3";
export { ConfigurationMatrixNodeV3 } from "./ConfigurationMatrixNodeV3";
export { InsightBranchNodeV3 } from "./InsightBranchNodeV3";
export { ActionNodeV3 } from "./ActionNodeV3";

// Componentes utilitários
export { ReuseIndicator, ReuseIndicatorBadge } from "./ReuseIndicator";
export { CollapsibleSubnodes, SubnodesPreview } from "./CollapsibleSubnodes";

// Mapa de tipos para componentes
export const V3_NODE_TYPES = {
  form: "FormNodeV3",
  choice: "ChoiceNodeV3",
  action: "ActionNodeV3",
  feedback_success: "FeedbackNodeV3",
  feedback_error: "FeedbackNodeV3",
  condition: "ConditionNodeV3",
  end_success: "EndNodeV3",
  end_error: "EndNodeV3",
  end_neutral: "EndNodeV3",
  retry: "RetryNodeV3",
  fallback: "FallbackNodeV3",
  loopback: "LoopbackNodeV3",
  background_action: "BackgroundActionNodeV3",
  delayed_action: "DelayedActionNodeV3",
  configuration_matrix: "ConfigurationMatrixNodeV3",
  insight_branch: "InsightBranchNodeV3",
} as const;

