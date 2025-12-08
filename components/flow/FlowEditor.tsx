"use client";

import { useCallback, useState, useRef } from "react";
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

import { TriggerNode } from "./nodes/TriggerNode";
import { LogicNode } from "./nodes/LogicNode";
import { ActionNode } from "./nodes/ActionNode";
import { TextBlockNode } from "./nodes/TextBlockNode";
import { PostItNode } from "./nodes/PostItNode";
import { AIPrompt } from "./AIPrompt";
import { DetailsSheet } from "./DetailsSheet";
import { ZoomControls } from "./ZoomControls";
import { EditorToolbar, ToolType, NodeType } from "./EditorToolbar";
import { NodeConfigSheet, NodeConfig } from "./NodeConfigSheet";
import { AILoadingOverlay } from "./AILoadingOverlay";
import type { GeneratedFlow, FlowNode as AgentFlowNode } from "@/lib/agents/types";

const nodeTypes = {
    trigger: TriggerNode,
    logic: LogicNode,
    action: ActionNode,
    textblock: TextBlockNode,
    postit: PostItNode,
};

const initialNodes: Node[] = [
    {
        id: "trigger-1",
        type: "trigger",
        position: { x: 440, y: 260 },
        data: { label: "New Registration", description: "User visits landing page" },
    },
    {
        id: "logic-1",
        type: "logic",
        position: { x: 780, y: 260 },
        data: { label: "Email Validation", tag: "Is Valid?" },
    },
    {
        id: "action-1",
        type: "action",
        position: { x: 1100, y: 140 },
        data: { label: "Welcome", description: "Send welcome email", type: "success" },
    },
    {
        id: "action-2",
        type: "action",
        position: { x: 1100, y: 380 },
        data: { label: "Show Error", description: "Request email correction", type: "error" },
    },
];

const edgeColor = "#e4e4e7"; // zinc-200

// Mapeamento dos tipos do agente para os tipos do ReactFlow
const agentTypeToReactFlowType: Record<string, string> = {
    trigger: "trigger",
    action: "action",
    condition: "logic",
    input: "action",
    wait: "action",
    end: "action",
    note: "postit",
    subflow: "action",
    field_group: "action",
};

// Função para converter fluxo gerado pela IA para formato ReactFlow
function convertGeneratedFlowToReactFlow(
    generatedFlow: GeneratedFlow
): { nodes: Node[]; edges: Edge[] } {
    // Criar mapeamento de IDs do agente para IDs do ReactFlow
    const idMap = new Map<string, string>();
    
    const nodes: Node[] = generatedFlow.nodes.map((node, index) => {
        const reactFlowId = `ai-${node.type}-${Date.now()}-${index}`;
        idMap.set(node.id, reactFlowId);
        
        const reactFlowType = agentTypeToReactFlowType[node.type] || "action";
        
        return {
            id: reactFlowId,
            type: reactFlowType,
            position: { x: node.position_x, y: node.position_y },
            data: {
                label: node.title,
                description: node.description,
                ...(reactFlowType === "logic" && { tag: "Condição" }),
                ...(reactFlowType === "action" && { 
                    type: node.type === "end" ? "error" : "success" 
                }),
            },
        };
    });

    const edges: Edge[] = generatedFlow.connections.map((conn, index) => {
        const sourceId = idMap.get(conn.source_node_id) || conn.source_node_id;
        const targetId = idMap.get(conn.target_node_id) || conn.target_node_id;
        
        return {
            id: `ai-edge-${Date.now()}-${index}`,
            source: sourceId,
            target: targetId,
            style: { stroke: edgeColor, strokeWidth: 2 },
            markerEnd: {
                type: MarkerType.ArrowClosed,
                color: edgeColor,
            },
        };
    });

    return { nodes, edges };
}

const initialEdges: Edge[] = [
    {
        id: "e1-2",
        source: "trigger-1",
        target: "logic-1",
        style: { stroke: edgeColor, strokeWidth: 2 },
        markerEnd: {
            type: MarkerType.ArrowClosed,
            color: edgeColor,
        },
    },
    {
        id: "e2-3",
        source: "logic-1",
        target: "action-1",
        style: { stroke: edgeColor, strokeWidth: 2 },
    },
    {
        id: "e2-4",
        source: "logic-1",
        target: "action-2",
        style: { stroke: edgeColor, strokeWidth: 2 },
    },
];

export function FlowEditor({ onOpenProjectInfo }: { onOpenProjectInfo?: () => void }) {
    const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
    const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
    const [isSheetOpen, setIsSheetOpen] = useState(false);
    
    // Tool states
    const [activeTool, setActiveTool] = useState<ToolType>("none");
    const [selectedNodeType, setSelectedNodeType] = useState<NodeType | null>(null);
    const [isNodeConfigOpen, setIsNodeConfigOpen] = useState(false);
    const [pendingNodePosition, setPendingNodePosition] = useState<{ x: number; y: number } | null>(null);
    
    // AI Loading state
    const [isAILoading, setIsAILoading] = useState(false);
    
    const reactFlowWrapper = useRef<HTMLDivElement>(null);
    const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance | null>(null);

    const onConnect = useCallback(
        (params: Connection) => setEdges((eds) => addEdge(params, eds)),
        [setEdges]
    );

    const onNodeClick = (event: React.MouseEvent, node: Node) => {
        // Only open sheet for Logic node as per design demo
        if (node.type === "logic") {
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
                // Create text block node
                const newNode: Node = {
                    id: `textblock-${Date.now()}`,
                    type: "textblock",
                    position,
                    data: { 
                        text: "", 
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

            const newNode: Node = {
                id: `${config.type}-${Date.now()}`,
                type: config.type,
                position: pendingNodePosition,
                data: {
                    label: config.label,
                    description: config.description,
                    ...(config.type === "logic" && { tag: config.tag }),
                    ...(config.type === "action" && { type: config.actionType }),
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

    // Handler para quando o fluxo é gerado pela IA
    const handleFlowGenerated = useCallback((generatedFlow: GeneratedFlow) => {
        console.log("🎨 Renderizando fluxo gerado pela IA:", generatedFlow.name);
        
        const { nodes: newNodes, edges: newEdges } = convertGeneratedFlowToReactFlow(generatedFlow);
        
        // Substituir nós e edges atuais pelos gerados
        setNodes(newNodes);
        setEdges(newEdges);
        
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
                            {activeTool === "text" && "Clique para adicionar texto"}
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

            {/* AI Loading Overlay */}
            <AILoadingOverlay isVisible={isAILoading} />

            {/* Floating UI */}
            <AIPrompt 
                activeTool={activeTool}
                onToolSelect={setActiveTool}
                selectedNodeType={selectedNodeType}
                onNodeTypeSelect={setSelectedNodeType}
                onFlowGenerated={handleFlowGenerated}
                onLoadingChange={setIsAILoading}
            />
            <DetailsSheet isOpen={isSheetOpen} onClose={() => setIsSheetOpen(false)} />
            
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
