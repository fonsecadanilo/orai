import { Paperclip, ArrowUp, X, Bot, Hammer, ChevronDown, Loader2 } from "lucide-react";
import { useState, useRef, useCallback, useEffect } from "react";
import { cn } from "@/lib/utils";
import { EditorToolbar, ToolType, NodeType } from "./EditorToolbar";
import { useFlowCreator } from "@/hooks/useFlowCreator";
import type { GeneratedFlow } from "@/lib/agents/types";

type AgentType = "discuss" | "build";

interface AIPromptProps {
    activeTool: ToolType;
    onToolSelect: (tool: ToolType) => void;
    selectedNodeType: NodeType | null;
    onNodeTypeSelect: (type: NodeType) => void;
    onFlowGenerated?: (flow: GeneratedFlow) => void;
    onLoadingChange?: (isLoading: boolean) => void;
}

export function AIPrompt({ 
    activeTool, 
    onToolSelect, 
    selectedNodeType, 
    onNodeTypeSelect,
    onFlowGenerated,
    onLoadingChange
}: AIPromptProps) {
    const [context, setContext] = useState<string | null>("Onboarding");
    const [agentType, setAgentType] = useState<AgentType>("build");
    const [isAgentMenuOpen, setIsAgentMenuOpen] = useState(false);
    const [promptValue, setPromptValue] = useState("");
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Hook do agente de criação de fluxo
    // IDs fixos para demo - user_id: 1, project_id: 1
    const { create, isLoading, error } = useFlowCreator({
        projectId: 1,
        userId: 1,
        onSuccess: (response) => {
            console.log("✅ Fluxo criado:", response.message);
            if (onFlowGenerated) {
                onFlowGenerated(response.generated_flow);
            }
            setPromptValue("");
            if (textareaRef.current) {
                textareaRef.current.style.height = "auto";
            }
        },
        onError: (err) => {
            console.error("❌ Erro ao criar fluxo:", err.message);
        }
    });

    // Notificar mudanças no estado de loading
    useEffect(() => {
        onLoadingChange?.(isLoading);
    }, [isLoading, onLoadingChange]);

    const handleInput = () => {
        if (textareaRef.current) {
            textareaRef.current.style.height = "auto";
            textareaRef.current.style.height = textareaRef.current.scrollHeight + "px";
        }
    };

    const toggleAgentMenu = () => setIsAgentMenuOpen(!isAgentMenuOpen);

    const selectAgent = (type: AgentType) => {
        setAgentType(type);
        setIsAgentMenuOpen(false);
    };

    const handleAttachmentClick = () => {
        fileInputRef.current?.click();
    };

    // Enviar prompt para o agente
    const handleSubmit = useCallback(async () => {
        if (!promptValue.trim() || isLoading) return;
        
        if (agentType === "build") {
            await create(promptValue.trim());
        } else {
            // Agente de discussão - futura implementação
            console.log("Agente de discussão ainda não implementado");
        }
    }, [promptValue, isLoading, agentType, create]);

    // Enviar com Enter (Shift+Enter para nova linha)
    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSubmit();
        }
    };

    return (
        <div className="fixed bottom-8 left-[calc(50%+8rem)] -translate-x-1/2 z-50 w-full max-w-xl px-4 pointer-events-auto">
            {/* Editor Toolbar - Above the prompt */}
            <div className="flex justify-center mb-3">
                <EditorToolbar
                    activeTool={activeTool}
                    onToolSelect={onToolSelect}
                    selectedNodeType={selectedNodeType}
                    onNodeTypeSelect={onNodeTypeSelect}
                />
            </div>

            <div className="relative group">
                {/* Glow Effect - Slightly subdued to match subtle look */}
                <div className="absolute -inset-0.5 bg-gradient-to-r from-border via-border to-border rounded-2xl opacity-20 group-hover:opacity-40 blur transition duration-500"></div>

                {/* Main Input Container - Removed overflow-hidden to allow dropdown to escape, added rounded-xl manually */}
                <div className="relative bg-card rounded-xl shadow-lg shadow-border/50 border border-border flex flex-col transition-all duration-300">

                    {/* Top Section: Context & Input */}
                    <div className="flex flex-col w-full">
                        {/* Context Chip */}
                        <div className="px-3 pt-3 flex items-center gap-2">
                            {context ? (
                                <div id="ai-context-chip" className="flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2 duration-200">
                                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                                        Running on
                                    </span>
                                    <span className="text-xs font-semibold text-card-foreground bg-muted px-1.5 py-0.5 rounded border border-border">
                                        {context}
                                    </span>
                                    <button
                                        onClick={() => setContext(null)}
                                        className="hover:bg-muted hover:text-foreground transition-colors text-muted-foreground rounded-full -ml-1.5 p-0.5 shrink-0 cursor-pointer"
                                    >
                                        <X className="w-3 h-3" />
                                    </button>
                                </div>
                            ) : (
                                <div className="flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2 duration-200">
                                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                                        Running on
                                    </span>
                                    <span className="text-xs font-semibold text-card-foreground bg-muted px-1.5 py-0.5 rounded border border-border">
                                        Global Project
                                    </span>
                                </div>
                            )}
                        </div>

                        <textarea
                            ref={textareaRef}
                            value={promptValue}
                            onChange={(e) => setPromptValue(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder={agentType === "discuss" ? "Ask something about the project..." : "Descreva o fluxo que deseja criar..."}
                            className="border-none focus:ring-0 focus:outline-none placeholder-muted-foreground transition-all resize-none overflow-hidden min-h-[2.5rem] text-sm font-medium text-card-foreground bg-transparent w-full pr-3 pl-3 py-3"
                            rows={1}
                            onInput={handleInput}
                            disabled={isLoading}
                        ></textarea>
                    </div>

                    {/* Bottom Toolbar: Agent Selector (Left) & Actions (Right) */}
                    <div className="flex items-center justify-between px-3 pb-3 pt-1">

                        {/* Agent Selector - Subtle Pill Style */}
                        <div className="relative">
                            <button
                                onClick={toggleAgentMenu}
                                className="flex items-center gap-1.5 bg-muted hover:bg-muted/80 text-muted-foreground text-xs font-medium px-2 py-1 rounded-md transition-colors cursor-pointer group/selector"
                            >
                                {agentType === "discuss" ? (
                                    <>
                                        <Bot className="w-3.5 h-3.5" />
                                        <span>Agent</span>
                                    </>
                                ) : (
                                    <>
                                        <Hammer className="w-3.5 h-3.5" />
                                        <span>Builder</span>
                                    </>
                                )}
                                <ChevronDown className="w-3 h-3 text-muted-foreground group-hover/selector:text-foreground" />
                            </button>

                            {/* Agent Menu Dropdown - Opens Upwards */}
                            {isAgentMenuOpen && (
                                <div className="absolute bottom-full left-0 mb-2 w-40 bg-popover text-popover-foreground rounded-lg shadow-xl border border-border overflow-hidden py-1 z-[60] animate-in fade-in zoom-in-95 duration-200">
                                    <button
                                        onClick={() => selectAgent("discuss")}
                                        className={cn("w-full text-left px-3 py-2 text-xs font-medium flex items-center gap-2 hover:bg-accent transition-colors", agentType === "discuss" && "bg-accent")}
                                    >
                                        <Bot className="w-3.5 h-3.5 text-muted-foreground" />
                                        <div>
                                            <div className="text-popover-foreground">Agent</div>
                                            <div className="text-[10px] text-muted-foreground">Discussion & Q&A</div>
                                        </div>
                                        {agentType === "discuss" && <div className="ml-auto w-1 h-1 rounded-full bg-popover-foreground" />}
                                    </button>
                                    <button
                                        onClick={() => selectAgent("build")}
                                        className={cn("w-full text-left px-3 py-2 text-xs font-medium flex items-center gap-2 hover:bg-accent transition-colors", agentType === "build" && "bg-accent")}
                                    >
                                        <Hammer className="w-3.5 h-3.5 text-muted-foreground" />
                                        <div>
                                            <div className="text-popover-foreground">Builder</div>
                                            <div className="text-[10px] text-muted-foreground">Create & Modify</div>
                                        </div>
                                        {agentType === "build" && <div className="ml-auto w-1 h-1 rounded-full bg-popover-foreground" />}
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Right Actions */}
                        <div className="flex items-center gap-2">
                            <input
                                type="file"
                                ref={fileInputRef}
                                className="hidden"
                                accept=".pdf,.md,.jpg,.png,.jpeg,.csv"
                                multiple
                            />
                            <button
                                onClick={handleAttachmentClick}
                                className="text-muted-foreground hover:text-foreground p-1.5 rounded-lg transition-colors cursor-pointer hover:bg-muted"
                                title="Attach file"
                                disabled={isLoading}
                            >
                                <Paperclip className="w-4 h-4" />
                            </button>
                            <div className="h-4 w-[1px] bg-border mx-1"></div>
                            <button 
                                onClick={handleSubmit}
                                disabled={isLoading || !promptValue.trim()}
                                className={cn(
                                    "p-1.5 rounded-lg transition-colors cursor-pointer shadow-sm",
                                    isLoading || !promptValue.trim()
                                        ? "bg-muted text-muted-foreground cursor-not-allowed"
                                        : "bg-primary hover:bg-primary/90 text-primary-foreground"
                                )}
                            >
                                {isLoading ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    <ArrowUp className="w-4 h-4" strokeWidth={2} />
                                )}
                            </button>
                        </div>
                    </div>

                    {/* Error indicator */}
                    {error && !isLoading && (
                        <div className="px-3 pb-3 text-xs text-red-500">
                            <span>❌ {error.message}</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Suggestions */}
            {!context && (
                <div className="flex justify-center gap-2 mt-3">
                    <span className="text-xs text-muted-foreground">Editing Global Project Settings</span>
                </div>
            )}
            {context && (
                <div className="flex justify-center gap-2 mt-3">
                    <button className="text-[10px] font-medium text-muted-foreground bg-card/80 backdrop-blur border border-border px-3 py-1.5 rounded-full hover:border-border hover:text-foreground transition-all shadow-sm cursor-pointer">
                        + Password recovery flow
                    </button>
                    <button className="text-[10px] font-medium text-muted-foreground bg-card/80 backdrop-blur border border-border px-3 py-1.5 rounded-full hover:border-border hover:text-foreground transition-all shadow-sm cursor-pointer">
                        + Add 2-day delay
                    </button>
                </div>
            )}
        </div>
    );
}
