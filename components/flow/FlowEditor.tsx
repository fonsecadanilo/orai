"use client";

import { useCallback, useState, useRef, useEffect } from "react";
import ReactFlow, {
    Node,
    Edge,
    useNodesState,
    useEdgesState,
    Background,
    MarkerType,
    Connection,
    addEdge,
    ReactFlowInstance,
} from "reactflow";
import "reactflow/dist/style.css";

// Importar todos os tipos de nós
import { TriggerNode } from "./nodes/TriggerNode";
import { ConditionNode, LogicNode } from "./nodes/ConditionNode";
import { ActionNode } from "./nodes/ActionNode";
import { TextNode, TextBlockNode } from "./nodes/TextNode";
import { PostItNode } from "./nodes/PostItNode";
import { SubflowNode } from "./nodes/SubflowNode";
import { FieldGroupNode } from "./nodes/FieldGroupNode";
import { EndNode } from "./nodes/EndNode";
import { BrainChatNode } from "./nodes/BrainChatNode";

// Importar componentes v3.1
import {
    FormNodeV3,
    ChoiceNodeV3,
    FeedbackNodeV3,
    ConditionNodeV3,
    EndNodeV3,
    RetryNodeV3,
    FallbackNodeV3,
    LoopbackNodeV3,
    BackgroundActionNodeV3,
    DelayedActionNodeV3,
    ConfigurationMatrixNodeV3,
    InsightBranchNodeV3,
    ActionNodeV3,
} from "./nodes/v3";

import { AIPrompt } from "./AIPrompt";
import { DetailsSheet } from "./DetailsSheet";
import { ZoomControls } from "./ZoomControls";
import { EditorToolbar, ToolType, NodeType } from "./EditorToolbar";
import { NodeConfigSheet, NodeConfig } from "./NodeConfigSheet";
import { AILoadingOverlay } from "./AILoadingOverlay";
import { IntegrityScorePanel } from "./IntegrityScorePanel";
import type { GeneratedFlow, FlowNode as AgentFlowNode } from "@/lib/agents/types";
import { type SavedFlow, convertSavedFlowToReactFlow } from "@/lib/supabase/flows";

// Registrar todos os tipos de nós disponíveis
const nodeTypes = {
    // Nós principais do fluxo
    trigger: TriggerNode,
    action: ActionNode,
    condition: ConditionNode,
    subflow: SubflowNode,
    field_group: FieldGroupNode,
    fieldGroup: FieldGroupNode, // Alias
    end: EndNode,
    text: TextNode,
    
    // Nós de compatibilidade/legacy
    logic: LogicNode, // Alias para condition
    textblock: TextBlockNode, // Alias para text
    postit: PostItNode,
    
    // Brain Chat Node - IA conversacional
    brain_chat: BrainChatNode,
    
    // ========================================
    // NOVOS TIPOS v3.1 - Metodologia Oria
    // Usando componentes específicos v3
    // ========================================
    
    // Tipos básicos v3
    form: FormNodeV3,                  // Formulário com campos colapsáveis
    choice: ChoiceNodeV3,              // Escolha entre opções
    feedback_success: FeedbackNodeV3,  // Feedback de sucesso
    feedback_error: FeedbackNodeV3,    // Feedback de erro
    
    // Tipos de término v3
    end_success: EndNodeV3,            // Fim com sucesso
    end_error: EndNodeV3,              // Fim com erro
    end_neutral: EndNodeV3,            // Fim neutro
    
    // Tipos de recuperação v3
    retry: RetryNodeV3,                // Retry
    fallback: FallbackNodeV3,          // Fallback
    loopback: LoopbackNodeV3,          // Loopback
    
    // Tipos avançados v3
    background_action: BackgroundActionNodeV3,     // Ação em background
    delayed_action: DelayedActionNodeV3,           // Ação com delay
    configuration_matrix: ConfigurationMatrixNodeV3, // Matriz de configuração
    insight_branch: InsightBranchNodeV3,           // Branch com insight
    
    // Aliases para Flow Synthesizer
    entry_point: TriggerNode,
    user_action: ActionNodeV3,
    system_action: ActionNodeV3,
    form_input: FormNodeV3,
    decision_point: ConditionNodeV3,
    validation: ActionNodeV3,
    api_call: ActionNodeV3,
    data_transform: ActionNodeV3,
    notification: ActionNodeV3,
    redirect: ActionNodeV3,
    success_state: EndNodeV3,
    error_state: EndNodeV3,
    exit_point: EndNodeV3,
};

const initialNodes: Node[] = [
    {
        id: "trigger-1",
        type: "trigger",
        position: { x: 440, y: 260 },
        data: { label: "New Registration", description: "User visits landing page" },
    },
    {
        id: "condition-1",
        type: "condition",
        position: { x: 780, y: 260 },
        data: { expression: "Email válido?", paths: { yes: "action-1", no: "action-2" } },
    },
    {
        id: "action-1",
        type: "action",
        position: { x: 1100, y: 140 },
        data: { 
            label: "Welcome", 
            description: "Send welcome email", 
            category: "api",
            verb: "enviar",
            outputs: ["success", "error"]
        },
    },
    {
        id: "action-2",
        type: "action",
        position: { x: 1100, y: 380 },
        data: { 
            label: "Show Error", 
            description: "Request email correction", 
            category: "ui",
            verb: "exibir",
            outputs: ["error"]
        },
    },
];

// Mapeamento dos tipos do agente para os tipos do ReactFlow
// Atualizado para suportar tipos v3.1 da Metodologia Oria
const agentTypeToReactFlowType: Record<string, string> = {
    // Tipos principais
    trigger: "trigger",
    action: "action",
    condition: "condition",
    subflow: "subflow",
    field_group: "fieldGroup",
    end: "end",
    text: "text",
    
    // Tipos legacy/compatibilidade
    input: "action",
    wait: "action",
    note: "text",
    logic: "condition",
    
    // ========================================
    // TIPOS v3.1 - Metodologia Oria
    // ========================================
    
    // Tipos básicos v3
    form: "form",
    choice: "choice",
    feedback_success: "feedback_success",
    feedback_error: "feedback_error",
    
    // Tipos de término v3
    end_success: "end_success",
    end_error: "end_error",
    end_neutral: "end_neutral",
    
    // Tipos de recuperação v3
    retry: "retry",
    fallback: "fallback",
    loopback: "loopback",
    
    // Tipos avançados v3
    background_action: "background_action",
    delayed_action: "delayed_action",
    configuration_matrix: "configuration_matrix",
    insight_branch: "insight_branch",
    
    // Tipos do Flow Synthesizer
    entry_point: "trigger",
    user_action: "action",
    system_action: "action",
    form_input: "form",
    decision_point: "condition",
    validation: "action",
    api_call: "action",
    data_transform: "action",
    notification: "action",
    redirect: "action",
    success_state: "end_success",
    error_state: "end_error",
    exit_point: "end",
};

// Cores para edges
const EDGE_COLORS = {
    default: "#e4e4e7", // zinc-200
    success: "#22c55e", // green-500
    error: "#ef4444",   // red-500
    rule: "#3b82f6",    // blue-500
};

// Convert AI-generated flow to ReactFlow format
function convertGeneratedFlowToReactFlow(
    generatedFlow: GeneratedFlow
): { nodes: Node[]; edges: Edge[] } {
    // Create ID mapping from agent IDs to ReactFlow IDs
    const idMap = new Map<string, string>();
    const timestamp = Date.now();
    
    console.log("🔄 [convertGeneratedFlowToReactFlow] Received:", {
        nodes: generatedFlow.nodes.length,
        connections: generatedFlow.connections.length,
    });
    
    const nodes: Node[] = generatedFlow.nodes.map((node, index) => {
        const reactFlowId = `ai-${node.type}-${timestamp}-${index}`;
        
        // Map by multiple possible keys
        idMap.set(node.id, reactFlowId);
        if (node.db_id) {
            idMap.set(String(node.db_id), reactFlowId);
        }
        // Also map by index as fallback
        idMap.set(String(index), reactFlowId);
        
        console.log(`  📦 Node ${index}: id="${node.id}", type="${node.type}", reactFlowId="${reactFlowId}"`);
        
        // IMPORTANT: Use the exact V3 type from the node - don't remap to legacy types
        const reactFlowType = agentTypeToReactFlowType[node.type] || node.type;
        
        // Build node data based on type
        const nodeData: Record<string, unknown> = {
            label: node.title,
            title: node.title,
            description: node.description,
            // V3 fields - always include for proper rendering
            impact_level: (node as any).impact_level || 'medium',
            role_scope: (node as any).role_scope,
            group_label: (node as any).group_label,
            inputs: (node as any).inputs,
            actions: (node as any).actions,
            feedback_messages: (node as any).feedback_messages,
            subnodes: (node as any).subnodes || (node as any).children,
            reuse_info: (node as any).reuse_info,
            column: (node as any).column,
        };
        
        // Add type-specific fields
        switch (node.type) {
            case 'action':
            case 'user_action':
            case 'system_action':
            case 'api_call':
            case 'data_transform':
            case 'validation':
            case 'notification':
            case 'redirect':
            case 'retry':
            case 'fallback':
            case 'loopback':
            case 'background_action':
            case 'delayed_action':
                nodeData.action_category = mapCategoryToActionCategory(node.category);
                nodeData.category = node.category || 'api';
                nodeData.verb = node.verb || node.title;
                nodeData.outputs = node.outputs || ['success', 'error'];
                break;
            case 'condition':
            case 'choice':
            case 'decision_point':
            case 'insight_branch':
                nodeData.expression = node.expression || node.title;
                nodeData.paths = node.paths || { yes: '', no: '' };
                nodeData.tag = "Condition";
                break;
            case 'end':
            case 'end_success':
            case 'success_state':
            case 'exit_point':
                nodeData.status = 'success';
                nodeData.end_status = 'success';
                break;
            case 'end_error':
            case 'error_state':
                nodeData.status = 'error';
                nodeData.end_status = 'error';
                break;
            case 'end_neutral':
                nodeData.status = 'neutral';
                nodeData.end_status = 'neutral';
                break;
            case 'feedback_success':
                nodeData.status = 'success';
                nodeData.feedbackType = 'success';
                break;
            case 'feedback_error':
                nodeData.status = 'error';
                nodeData.feedbackType = 'error';
                break;
            case 'text':
            case 'note':
                nodeData.subtype = node.subtype || 'comment';
                nodeData.content = node.content || node.description || '';
                break;
            case 'subflow':
                nodeData.targetFlowId = node.target_flow_id || '';
                break;
            case 'field_group':
            case 'form':
            case 'form_input':
            case 'configuration_matrix':
                nodeData.mode = node.mode || 'all_in_one';
                nodeData.fields = node.fields || (node as any).inputs || [];
                break;
            case 'trigger':
            case 'entry_point':
                nodeData.triggerType = 'user_action';
                break;
        }
        
        return {
            id: reactFlowId,
            type: reactFlowType,
            position: { x: node.position_x, y: node.position_y },
            data: nodeData,
        };
    });

    console.log(`📊 idMap created with ${idMap.size} entries`);

    // Build edges with proper handle mapping
    const edges: Edge[] = generatedFlow.connections
        .map((conn, index) => {
            // Get source and target IDs with multiple fallbacks
            const sourceKey = conn.source_id || String(conn.source_node_id) || "";
            const targetKey = conn.target_id || String(conn.target_node_id) || "";
            
            // Find in map with fallbacks
            let sourceId = idMap.get(sourceKey) || idMap.get(String(conn.source_node_id)) || sourceKey;
            let targetId = idMap.get(targetKey) || idMap.get(String(conn.target_node_id)) || targetKey;
            
            // Skip edge if source or target not found
            if (!sourceId || !targetId) {
                console.warn(`  ⚠️ Edge ${index}: Missing source or target, skipping`);
                return null;
            }
            
            console.log(`  🔗 Edge ${index}: "${sourceKey}" → "${targetKey}" (type: ${(conn as any).connection_type || conn.label || 'default'})`);
            
            // Determine edge style based on connection type
            const connType = ((conn as any).connection_type || (conn as any).type || "").toLowerCase();
            const label = (conn.label || "").toLowerCase();
            
            // Classify connection
            const isErrorPath = 
                connType === "failure" || 
                connType === "fallback" || 
                connType === "error" ||
                label === "no" || 
                label === "não" || 
                label === "error" ||
                label === "erro";
            
            const isSuccessPath = 
                connType === "success" || 
                connType === "default" ||
                label === "yes" || 
                label === "sim" || 
                label === "success" ||
                label === "sucesso";
            
            let strokeColor = EDGE_COLORS.default;
            let sourceHandle: string | undefined = undefined;
            
            if (isErrorPath) {
                strokeColor = EDGE_COLORS.error;
                // Don't set sourceHandle for error - let ReactFlow use default
            } else if (isSuccessPath) {
                strokeColor = EDGE_COLORS.success;
                // Don't set sourceHandle for success - let ReactFlow use default
            }
            
            return {
                id: `ai-edge-${timestamp}-${index}`,
                source: sourceId,
                target: targetId,
                // Remove sourceHandle to avoid "Couldn't create edge" errors
                // ReactFlow will connect to the default handle
                label: conn.label || undefined,
                style: { stroke: strokeColor, strokeWidth: 2 },
                markerEnd: {
                    type: MarkerType.ArrowClosed,
                    color: strokeColor,
                },
                animated: connType === "conditional",
            };
        })
        .filter((edge): edge is Edge => edge !== null);

    console.log(`✅ Conversion complete: ${nodes.length} nodes, ${edges.length} edges`);

    return { nodes, edges };
}

// Helper to map category string to ActionCategory
function mapCategoryToActionCategory(category: string | undefined): string {
    const mapping: Record<string, string> = {
        'api': 'fetch',
        'ui': 'navigate',
        'create': 'create',
        'update': 'update',
        'delete': 'delete',
        'send': 'send',
        'process': 'process',
    };
    return mapping[category || ''] || 'process';
}

const initialEdges: Edge[] = [
    {
        id: "e1-2",
        source: "trigger-1",
        target: "condition-1",
        style: { stroke: EDGE_COLORS.default, strokeWidth: 2 },
        markerEnd: {
            type: MarkerType.ArrowClosed,
            color: EDGE_COLORS.default,
        },
    },
    {
        id: "e2-3",
        source: "condition-1",
        sourceHandle: "yes",
        target: "action-1",
        label: "sim",
        style: { stroke: EDGE_COLORS.success, strokeWidth: 2 },
        markerEnd: {
            type: MarkerType.ArrowClosed,
            color: EDGE_COLORS.success,
        },
    },
    {
        id: "e2-4",
        source: "condition-1",
        sourceHandle: "no",
        target: "action-2",
        label: "não",
        style: { stroke: EDGE_COLORS.error, strokeWidth: 2 },
        markerEnd: {
            type: MarkerType.ArrowClosed,
            color: EDGE_COLORS.error,
        },
    },
];

interface FlowEditorProps {
    onOpenProjectInfo?: () => void;
    selectedFlow?: SavedFlow | null;
    isLoadingFlow?: boolean;
}

// Interface para findings de integridade
interface IntegrityFinding {
    finding_id: string;
    severity: "critical" | "major" | "minor" | "suggestion";
    category: string;
    title: string;
    description: string;
    recommendation: string;
    auto_fixable: boolean;
    affected_element_id?: string;
}

export function FlowEditor({ onOpenProjectInfo, selectedFlow, isLoadingFlow }: FlowEditorProps) {
    const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
    const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
    const [isSheetOpen, setIsSheetOpen] = useState(false);
    const [selectedNode, setSelectedNode] = useState<Node | null>(null);
    
    // Tool states
    const [activeTool, setActiveTool] = useState<ToolType>("none");
    const [selectedNodeType, setSelectedNodeType] = useState<NodeType | null>(null);
    const [isNodeConfigOpen, setIsNodeConfigOpen] = useState(false);
    const [pendingNodePosition, setPendingNodePosition] = useState<{ x: number; y: number } | null>(null);
    
    // AI Loading state
    const [isAILoading, setIsAILoading] = useState(false);
    
    // v3 Integrity Score state
    const [integrityScore, setIntegrityScore] = useState<number | null>(null);
    const [integrityFindings, setIntegrityFindings] = useState<IntegrityFinding[]>([]);
    const [showIntegrityPanel, setShowIntegrityPanel] = useState(false);
    
    // Brain blocks state (para tracking)
    const [brainBlocks, setBrainBlocks] = useState<{ canvas_block: unknown; thread: unknown }[]>([]);
    
    const reactFlowWrapper = useRef<HTMLDivElement>(null);
    const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance | null>(null);

    // Atualizar nodes e edges quando o fluxo selecionado mudar
    useEffect(() => {
        if (selectedFlow && selectedFlow.nodes && selectedFlow.connections) {
            const { nodes: newNodes, edges: newEdges } = convertSavedFlowToReactFlow(selectedFlow);
            setNodes(newNodes);
            setEdges(newEdges);
            
            // Fazer fit view após um pequeno delay para garantir que os nós foram renderizados
            setTimeout(() => {
                reactFlowInstance?.fitView({ padding: 0.2, duration: 500 });
            }, 100);
        }
    }, [selectedFlow, setNodes, setEdges, reactFlowInstance]);

    const onConnect = useCallback(
        (params: Connection) => setEdges((eds) => addEdge(params, eds)),
        [setEdges]
    );

    const onNodeClick = (event: React.MouseEvent, node: Node) => {
        // Open sheet for trigger, condition, and action nodes
        const validTypes = ["trigger", "condition", "logic", "action"];
        if (validTypes.includes(node.type || "")) {
            setSelectedNode(node);
            setIsSheetOpen(true);
        }
    };

    // Delete node handler
    const handleDeleteNode = useCallback((nodeId: string) => {
        setNodes((nds) => nds.filter((node) => node.id !== nodeId));
    }, [setNodes]);

    // Handle canvas click for tool actions
    const onPaneClick = useCallback(
        (event: React.MouseEvent) => {
            if (activeTool === "none" || !reactFlowInstance) return;

            // Get the position where user clicked in flow coordinates
            const bounds = reactFlowWrapper.current?.getBoundingClientRect();
            if (!bounds) return;

            const position = reactFlowInstance.screenToFlowPosition({
                x: event.clientX - bounds.left,
                y: event.clientY - bounds.top,
            });

            if (activeTool === "text") {
                // Create text node (comment type by default)
                const newNode: Node = {
                    id: `text-${Date.now()}`,
                    type: "text",
                    position,
                    data: { 
                        label: "Comentário",
                        subtype: "comment",
                        content: "",
                        onDelete: handleDeleteNode 
                    },
                    draggable: true,
                };
                setNodes((nds) => [...nds, newNode]);
                setActiveTool("none");
            } else if (activeTool === "postit") {
                // Create post-it node
                const newNode: Node = {
                    id: `postit-${Date.now()}`,
                    type: "postit",
                    position,
                    data: { 
                        text: "", 
                        colorIndex: Math.floor(Math.random() * 6) + 1, // Random color, excluding white
                        onDelete: handleDeleteNode 
                    },
                    draggable: true,
                };
                setNodes((nds) => [...nds, newNode]);
                setActiveTool("none");
            } else if (activeTool === "node" && selectedNodeType) {
                // Store position and open config sheet
                setPendingNodePosition(position);
                setIsNodeConfigOpen(true);
            }
        },
        [activeTool, selectedNodeType, reactFlowInstance, setNodes, handleDeleteNode]
    );

    // Handle node configuration confirm
    const handleNodeConfigConfirm = useCallback(
        (config: NodeConfig) => {
            if (!pendingNodePosition) return;

            // Mapear tipos para os novos nomes
            const typeMapping: Record<string, string> = {
                logic: "condition",
            };
            const nodeType = typeMapping[config.type] || config.type;

            const newNode: Node = {
                id: `${nodeType}-${Date.now()}`,
                type: nodeType,
                position: pendingNodePosition,
                data: {
                    label: config.label,
                    description: config.description,
                    ...(nodeType === "condition" && { 
                        expression: config.tag || config.label,
                        paths: { yes: '', no: '' }
                    }),
                    ...(nodeType === "action" && { 
                        category: 'ui',
                        verb: config.label,
                        outputs: config.actionType === 'error' ? ['error'] : ['success', 'error']
                    }),
                },
            };

            setNodes((nds) => [...nds, newNode]);
            setPendingNodePosition(null);
            setActiveTool("none");
            setSelectedNodeType(null);
        },
        [pendingNodePosition, setNodes]
    );

    // Close node config without creating
    const handleNodeConfigClose = useCallback(() => {
        setIsNodeConfigOpen(false);
        setPendingNodePosition(null);
    }, []);

    // Handler para quando um Brain Block é criado via toolbar
    const handleBrainBlockCreate = useCallback((data: { canvas_block: unknown; thread: unknown }) => {
        console.log("🧠 Brain block created:", data);
        setBrainBlocks((prev) => [...prev, data]);

        // Extrair dados do canvas_block
        const block = data.canvas_block as {
            id: string;
            position_x: number;
            position_y: number;
            width: number;
            height: number;
            thread_id: string;
            block_type: string;
        };
        const thread = data.thread as { id: string };

        // Criar node ReactFlow para o Brain Block
        const newNode: Node = {
            id: `brain-${block.id}`,
            type: "brain_chat",
            position: { x: block.position_x, y: block.position_y },
            data: {
                id: block.id,
                thread_id: thread.id,
                content: "",
                streaming: false,
                project_id: 1, // TODO: pegar do contexto
                user_id: 1,    // TODO: pegar do contexto
            },
            style: { width: block.width || 500, height: block.height || 450 },
            draggable: true,
        };

        setNodes((nds) => [...nds, newNode]);

        // Fazer fit view / pan para o novo bloco
        setTimeout(() => {
            if (reactFlowInstance) {
                reactFlowInstance.setCenter(
                    block.position_x + (block.width || 500) / 2,
                    block.position_y + (block.height || 450) / 2,
                    { zoom: 1, duration: 500 }
                );
            }
        }, 100);
    }, [setNodes, reactFlowInstance]);

    // Handler para quando o fluxo é gerado pela IA
    const handleFlowGenerated = useCallback((generatedFlow: GeneratedFlow) => {
        console.log("🎨 Renderizando fluxo gerado pela IA:", generatedFlow.name);
        
        const { nodes: newNodes, edges: newEdges } = convertGeneratedFlowToReactFlow(generatedFlow);
        
        // Substituir nós e edges atuais pelos gerados
        setNodes(newNodes);
        setEdges(newEdges);
        
        // Extrair dados v3 se disponíveis (do metadata do flow)
        const flowAny = generatedFlow as any;
        if (flowAny.integrity_score !== undefined) {
            setIntegrityScore(flowAny.integrity_score);
            setShowIntegrityPanel(true);
        }
        if (flowAny.findings) {
            setIntegrityFindings(flowAny.findings);
        }
        
        // Fazer fit view após um pequeno delay para garantir que os nós foram renderizados
        setTimeout(() => {
            reactFlowInstance?.fitView({ padding: 0.2, duration: 500 });
        }, 100);
    }, [setNodes, setEdges, reactFlowInstance]);

    // Get cursor class based on active tool
    const getCursorClass = () => {
        switch (activeTool) {
            case "text":
                return "cursor-text";
            case "postit":
                return "cursor-copy";
            case "node":
                return "cursor-crosshair";
            default:
                return "";
        }
    };

    return (
        <div className="w-full h-full relative" ref={reactFlowWrapper}>
            <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                nodeTypes={nodeTypes}
                onNodeClick={onNodeClick}
                onPaneClick={onPaneClick}
                onInit={setReactFlowInstance}
                fitView
                proOptions={{ hideAttribution: true }}
                className={getCursorClass()}
            >
                <Background gap={24} size={1} className="dark:[&_svg]:opacity-20" />
                <ZoomControls />
            </ReactFlow>

            {/* Tool Indicator Overlay when a tool is active */}
            {activeTool !== "none" && (
                <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 pointer-events-none">
                    <div className="bg-card/95 backdrop-blur-sm px-4 py-2 rounded-full shadow-lg border border-border flex items-center gap-2 animate-in fade-in slide-in-from-top-2 duration-200">
                        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                        <span className="text-sm font-medium text-card-foreground">
                            {activeTool === "text" && "Clique para adicionar comentário"}
                            {activeTool === "postit" && "Clique para adicionar post-it"}
                            {activeTool === "node" && `Clique para adicionar ${
                                selectedNodeType === "trigger" ? "Trigger" :
                                selectedNodeType === "logic" ? "Condição" : "Ação"
                            }`}
                        </span>
                        <button 
                            onClick={() => {
                                setActiveTool("none");
                                setSelectedNodeType(null);
                            }}
                            className="ml-2 text-xs text-muted-foreground hover:text-foreground pointer-events-auto cursor-pointer"
                        >
                            (ESC para cancelar)
                        </button>
                    </div>
                </div>
            )}

            {/* AI Loading Overlay - Apenas para carregamento de fluxos salvos */}
            {/* Criação via prompt agora usa step-by-step sutil no próprio input */}
            <AILoadingOverlay isVisible={isLoadingFlow ?? false} />

            {/* v3 Integrity Score Panel */}
            {showIntegrityPanel && integrityScore !== null && (
                <div className="fixed top-4 right-4 z-50">
                    <IntegrityScorePanel
                        score={integrityScore}
                        isValid={integrityScore >= 70 && !integrityFindings.some(f => f.severity === "critical")}
                        findings={integrityFindings}
                        onFindingClick={(finding) => {
                            // Navegar para o nó afetado
                            if (finding.affected_element_id) {
                                const node = nodes.find(n => n.id === finding.affected_element_id);
                                if (node && reactFlowInstance) {
                                    reactFlowInstance.setCenter(node.position.x, node.position.y, { zoom: 1.5, duration: 500 });
                                    setSelectedNode(node);
                                    setIsSheetOpen(true);
                                }
                            }
                        }}
                        onAutoFix={(findings) => {
                            console.log("Auto-fixing findings:", findings);
                            // TODO: Implementar auto-fix
                        }}
                        onClose={() => setShowIntegrityPanel(false)}
                    />
                </div>
            )}

            {/* Floating UI */}
            <AIPrompt 
                activeTool={activeTool}
                onToolSelect={setActiveTool}
                selectedNodeType={selectedNodeType}
                onNodeTypeSelect={setSelectedNodeType}
                onFlowGenerated={handleFlowGenerated}
                onLoadingChange={setIsAILoading}
                onBrainBlockCreate={handleBrainBlockCreate}
                projectId={1}
                userId={1}
            />
            <DetailsSheet 
                isOpen={isSheetOpen} 
                onClose={() => {
                    setIsSheetOpen(false);
                    setSelectedNode(null);
                }} 
                selectedNode={selectedNode}
            />
            
            {/* Node Config Sheet */}
            <NodeConfigSheet
                isOpen={isNodeConfigOpen}
                onClose={handleNodeConfigClose}
                nodeType={selectedNodeType}
                onConfirm={handleNodeConfigConfirm}
            />
        </div>
    );
}
