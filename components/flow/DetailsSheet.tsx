import { X, PanelRightClose, CheckCircle2, Circle, Zap, GitBranch, AlertCircle } from "lucide-react";
import { useState, useEffect } from "react";
import type { Node } from "reactflow";

// Tipos para os dados dos nodes
interface TriggerNodeData {
    label: string;
    description?: string;
}

interface LogicNodeData {
    label: string;
    tag?: string;
}

interface ActionNodeData {
    label: string;
    description?: string;
    type: "success" | "error";
}

type NodeData = TriggerNodeData | LogicNodeData | ActionNodeData;

interface DetailsSheetProps {
    isOpen: boolean;
    onClose: () => void;
    selectedNode: Node<NodeData> | null;
}

// Mapeamento de tipo para label legível
const nodeTypeLabels: Record<string, string> = {
    trigger: "Trigger Node",
    logic: "Condition Node",
    action: "Action Node",
};

// Ícone baseado no tipo do node
function NodeTypeIcon({ type }: { type: string }) {
    switch (type) {
        case "trigger":
            return <Zap className="w-3.5 h-3.5 text-muted-foreground" />;
        case "logic":
            return <GitBranch className="w-3.5 h-3.5 text-muted-foreground" />;
        case "action":
            return <CheckCircle2 className="w-3.5 h-3.5 text-muted-foreground" />;
        default:
            return <Circle className="w-3.5 h-3.5 text-muted-foreground" />;
    }
}

export function DetailsSheet({ isOpen, onClose, selectedNode }: DetailsSheetProps) {
    const [activeTab, setActiveTab] = useState<"details" | "tasks">("details");

    // Reset para a aba de detalhes quando um novo node é selecionado
    useEffect(() => {
        if (selectedNode) {
            setActiveTab("details");
        }
    }, [selectedNode?.id]);

    const nodeType = selectedNode?.type || "unknown";
    const nodeData = selectedNode?.data;
    const nodeLabel = nodeData?.label || "Untitled Node";
    const nodeDescription = (nodeData as TriggerNodeData | ActionNodeData)?.description;
    const nodeTag = (nodeData as LogicNodeData)?.tag;
    const actionType = (nodeData as ActionNodeData)?.type;

    return (
        <aside
            className={`fixed top-4 right-4 bottom-4 w-[480px] z-[60] flex flex-col transition-transform duration-500 ease-[cubic-bezier(0.25,1,0.5,1)] font-sans pointer-events-auto ${isOpen ? "translate-x-0" : "translate-x-[120%]"
                }`}
        >
            <div className="relative w-full h-full bg-card text-card-foreground shadow-2xl rounded-3xl border border-border flex flex-col overflow-hidden">
                {/* Header */}
                <div className="px-6 pt-5 pb-0 bg-card/50 backdrop-blur-sm z-10 shrink-0 border-b border-border">
                    <div className="flex items-center justify-between mb-4">
                        <button
                            onClick={onClose}
                            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-muted text-muted-foreground hover:text-muted-foreground transition-colors group cursor-pointer"
                        >
                            <X className="w-[18px] h-[18px] group-hover:scale-90 transition-transform" />
                        </button>
                        <div className="flex items-center gap-2">
                            <PanelRightClose className="w-3.5 h-3.5 text-muted-foreground" />
                            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                Node Details
                            </span>
                        </div>
                    </div>

                    {/* Tabs */}
                    <div className="flex gap-6">
                        <button
                            onClick={() => setActiveTab("details")}
                            className={`pb-3 text-sm transition-all cursor-pointer ${activeTab === "details"
                                ? "font-semibold border-b-2 border-primary text-card-foreground"
                                : "font-medium border-b-2 border-transparent text-muted-foreground hover:text-card-foreground"
                                }`}
                        >
                            Details
                        </button>
                        <button
                            onClick={() => setActiveTab("tasks")}
                            className={`pb-3 text-sm flex items-center gap-2 transition-all cursor-pointer ${activeTab === "tasks"
                                ? "font-semibold border-b-2 border-primary text-card-foreground"
                                : "font-medium border-b-2 border-transparent text-muted-foreground hover:text-card-foreground"
                                }`}
                        >
                            Tasks
                            <span className="bg-muted text-muted-foreground text-[10px] px-1.5 py-0.5 rounded-full font-bold">
                                0
                            </span>
                        </button>
                    </div>
                </div>

                {/* Content Container */}
                <div className="flex-1 relative overflow-hidden bg-card">
                    {/* Details Tab */}
                    <div
                        className={`absolute inset-0 overflow-y-auto p-8 transition-all duration-300 ease-out transform ${activeTab === "details"
                            ? "translate-x-0 opacity-100"
                            : "-translate-x-8 opacity-0 pointer-events-none"
                            }`}
                    >
                        {/* Metadata */}
                        <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center gap-2">
                                <NodeTypeIcon type={nodeType} />
                                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest border border-border px-2 py-1 rounded-md">
                                    {nodeTypeLabels[nodeType] || "Node"}
                                </span>
                            </div>
                            <span className="text-[10px] font-mono text-muted-foreground">
                                ID: {selectedNode?.id?.toUpperCase() || "N/A"}
                            </span>
                        </div>

                        {/* Title */}
                        <h2 className="font-semibold text-3xl text-card-foreground leading-tight mb-3 tracking-tight">
                            {nodeLabel}
                        </h2>
                        
                        {/* Description */}
                        {nodeDescription && (
                            <p className="text-sm text-muted-foreground mb-8 leading-relaxed">
                                {nodeDescription}
                            </p>
                        )}

                        {/* Tag (para Logic Nodes) */}
                        {nodeTag && (
                            <div className="mb-8">
                                <h3 className="text-[10px] font-bold uppercase tracking-widest text-card-foreground mb-4">
                                    Condition Tag
                                </h3>
                                <span className="inline-flex items-center px-3 py-1.5 rounded-lg bg-muted border border-border text-sm text-muted-foreground">
                                    {nodeTag}
                                </span>
                            </div>
                        )}

                        {/* Action Type (para Action Nodes) */}
                        {nodeType === "action" && actionType && (
                            <div className="mb-8">
                                <h3 className="text-[10px] font-bold uppercase tracking-widest text-card-foreground mb-4">
                                    Action Type
                                </h3>
                                <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border ${
                                    actionType === "success" 
                                        ? "bg-emerald-50 border-emerald-200 text-emerald-700" 
                                        : "bg-red-50 border-red-200 text-red-700"
                                }`}>
                                    {actionType === "success" ? (
                                        <CheckCircle2 className="w-4 h-4" />
                                    ) : (
                                        <AlertCircle className="w-4 h-4" />
                                    )}
                                    <span className="text-sm font-medium capitalize">{actionType}</span>
                                </div>
                            </div>
                        )}

                        {/* Node Position Info */}
                        <div className="mb-8 p-4 bg-muted/50 rounded-xl border border-border">
                            <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3">
                                Position
                            </h3>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="flex flex-col">
                                    <span className="text-[10px] text-muted-foreground mb-1">X</span>
                                    <span className="text-sm font-mono text-card-foreground">
                                        {Math.round(selectedNode?.position?.x || 0)}px
                                    </span>
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-[10px] text-muted-foreground mb-1">Y</span>
                                    <span className="text-sm font-mono text-card-foreground">
                                        {Math.round(selectedNode?.position?.y || 0)}px
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Minimal Footer */}
                        <div className="mt-auto pt-6 border-t border-border flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold text-muted-foreground">
                                    U
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-[11px] font-semibold text-card-foreground">
                                        User
                                    </span>
                                    <span className="text-[9px] text-muted-foreground">
                                        Criado agora
                                    </span>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-100/50">
                                    <div className="w-1 h-1 rounded-full bg-blue-500"></div>
                                    <span className="text-[10px] font-semibold">Draft</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Tasks Tab */}
                    <div
                        className={`absolute inset-0 overflow-y-auto p-8 transition-all duration-300 ease-out transform ${activeTab === "tasks"
                            ? "translate-x-0 opacity-100"
                            : "translate-x-8 opacity-0 pointer-events-none"
                            }`}
                    >
                        <div className="flex flex-col h-full">
                            <div className="mb-8">
                                <h2 className="font-semibold text-2xl text-card-foreground mb-2 tracking-tight">
                                    Implementation Tasks
                                </h2>
                                <p className="text-sm text-muted-foreground">
                                    Tasks for "{nodeLabel}"
                                </p>
                                <div className="flex items-center gap-4 mt-4">
                                    <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                                        <div className="h-full bg-primary w-[0%] rounded-full"></div>
                                    </div>
                                    <span className="text-xs font-medium text-muted-foreground">0%</span>
                                </div>
                            </div>

                            {/* Empty state */}
                            <div className="flex-1 flex flex-col items-center justify-center text-center py-12">
                                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                                    <CheckCircle2 className="w-8 h-8 text-muted-foreground/50" />
                                </div>
                                <h3 className="text-sm font-medium text-card-foreground mb-2">
                                    No tasks yet
                                </h3>
                                <p className="text-xs text-muted-foreground max-w-[200px]">
                                    Tasks for this node will appear here when created.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </aside>
    );
}
