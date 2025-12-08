"use client";

import { Type, StickyNote, Boxes, ChevronDown } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

export type ToolType = "none" | "text" | "postit" | "node";
export type NodeType = "trigger" | "logic" | "action";

interface EditorToolbarProps {
    activeTool: ToolType;
    onToolSelect: (tool: ToolType) => void;
    selectedNodeType: NodeType | null;
    onNodeTypeSelect: (type: NodeType) => void;
}

export function EditorToolbar({
    activeTool,
    onToolSelect,
    selectedNodeType,
    onNodeTypeSelect,
}: EditorToolbarProps) {
    const [isNodeMenuOpen, setIsNodeMenuOpen] = useState(false);

    const handleToolClick = (tool: ToolType) => {
        if (activeTool === tool) {
            onToolSelect("none");
        } else {
            onToolSelect(tool);
        }
    };

    const handleNodeTypeSelect = (type: NodeType) => {
        onNodeTypeSelect(type);
        setIsNodeMenuOpen(false);
        onToolSelect("node");
    };

    return (
        <div className="flex items-center gap-1 bg-card/95 backdrop-blur-sm rounded-xl shadow-lg border border-border p-1.5 pointer-events-auto">
            {/* Text Block Tool */}
            <button
                onClick={() => handleToolClick("text")}
                className={cn(
                    "flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all cursor-pointer",
                    activeTool === "text"
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted"
                )}
                title="Adicionar bloco de texto"
            >
                <Type className="w-4 h-4" />
                <span className="hidden sm:inline">Texto</span>
            </button>

            {/* Post-it Tool */}
            <button
                onClick={() => handleToolClick("postit")}
                className={cn(
                    "flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all cursor-pointer",
                    activeTool === "postit"
                        ? "bg-amber-500 text-white shadow-sm"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted"
                )}
                title="Adicionar post-it"
            >
                <StickyNote className="w-4 h-4" />
                <span className="hidden sm:inline">Post-it</span>
            </button>

            {/* Divider */}
            <div className="h-6 w-px bg-border mx-1"></div>

            {/* Node Tool with Dropdown */}
            <div className="relative">
                <button
                    onClick={() => setIsNodeMenuOpen(!isNodeMenuOpen)}
                    className={cn(
                        "flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all cursor-pointer",
                        activeTool === "node"
                            ? "bg-primary text-primary-foreground shadow-sm"
                            : "text-muted-foreground hover:text-foreground hover:bg-muted"
                    )}
                    title="Adicionar nó"
                >
                    <Boxes className="w-4 h-4" />
                    <span className="hidden sm:inline">
                        {activeTool === "node" && selectedNodeType
                            ? selectedNodeType === "trigger"
                                ? "Trigger"
                                : selectedNodeType === "logic"
                                    ? "Condição"
                                    : "Ação"
                            : "Blocos"}
                    </span>
                    <ChevronDown className={cn("w-3 h-3 transition-transform", isNodeMenuOpen && "rotate-180")} />
                </button>

                {/* Node Type Dropdown */}
                {isNodeMenuOpen && (
                    <div className="absolute bottom-full left-0 mb-2 w-48 bg-popover text-popover-foreground rounded-lg shadow-xl border border-border overflow-hidden py-1 z-[60] animate-in fade-in zoom-in-95 duration-200">
                        <button
                            onClick={() => handleNodeTypeSelect("trigger")}
                            className={cn(
                                "w-full text-left px-3 py-2.5 text-xs font-medium flex items-center gap-3 hover:bg-accent transition-colors",
                                selectedNodeType === "trigger" && activeTool === "node" && "bg-accent"
                            )}
                        >
                            <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                                <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                            </div>
                            <div>
                                <div className="text-popover-foreground font-semibold">Trigger</div>
                                <div className="text-[10px] text-muted-foreground">Inicia um fluxo</div>
                            </div>
                        </button>
                        <button
                            onClick={() => handleNodeTypeSelect("logic")}
                            className={cn(
                                "w-full text-left px-3 py-2.5 text-xs font-medium flex items-center gap-3 hover:bg-accent transition-colors",
                                selectedNodeType === "logic" && activeTool === "node" && "bg-accent"
                            )}
                        >
                            <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center">
                                <div className="w-3 h-3 rounded bg-purple-500"></div>
                            </div>
                            <div>
                                <div className="text-popover-foreground font-semibold">Condição</div>
                                <div className="text-[10px] text-muted-foreground">Lógica condicional</div>
                            </div>
                        </button>
                        <button
                            onClick={() => handleNodeTypeSelect("action")}
                            className={cn(
                                "w-full text-left px-3 py-2.5 text-xs font-medium flex items-center gap-3 hover:bg-accent transition-colors",
                                selectedNodeType === "action" && activeTool === "node" && "bg-accent"
                            )}
                        >
                            <div className="w-8 h-8 rounded-lg bg-green-500/10 flex items-center justify-center">
                                <div className="w-3 h-3 rounded-sm bg-green-500"></div>
                            </div>
                            <div>
                                <div className="text-popover-foreground font-semibold">Ação</div>
                                <div className="text-[10px] text-muted-foreground">Executa uma tarefa</div>
                            </div>
                        </button>
                    </div>
                )}
            </div>

            {/* Active Tool Indicator */}
            {activeTool !== "none" && (
                <div className="ml-2 flex items-center gap-2 px-2 py-1 bg-muted/50 rounded-md">
                    <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></div>
                    <span className="text-[10px] font-medium text-muted-foreground">
                        Clique no canvas
                    </span>
                </div>
            )}
        </div>
    );
}

