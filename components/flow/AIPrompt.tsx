"use client";

import { Paperclip, ArrowUp, X, Bot, ChevronDown, Loader2, ScrollText, Sparkles, CheckCircle2, Wand2 } from "lucide-react";
import { useState, useRef, useCallback, useEffect } from "react";
import { cn } from "@/lib/utils";
import { EditorToolbar, ToolType, NodeType } from "./EditorToolbar";
import { useFlowCreator } from "@/hooks/useFlowCreator";
import { useBusinessRules } from "@/hooks/useBusinessRules";
import type { GeneratedFlow, BusinessRulesResponse, CreationProgress } from "@/lib/agents/types";

type AgentType = "discuss" | "build" | "rules";

interface AIPromptProps {
    activeTool: ToolType;
    onToolSelect: (tool: ToolType) => void;
    selectedNodeType: NodeType | null;
    onNodeTypeSelect: (type: NodeType) => void;
    onFlowGenerated?: (flow: GeneratedFlow) => void;
    onRulesCreated?: (response: BusinessRulesResponse) => void;
    onLoadingChange?: (isLoading: boolean) => void;
    onBrainBlockCreate?: (data: { canvas_block: unknown; thread: unknown }) => void;
    projectId?: number;
    userId?: number;
}

// Step-by-step progress component for v3.1 pipeline (6 agents)
function CreationSteps({ progress }: { progress: CreationProgress }) {
    const steps = [
        {
            key: "creating_master",
            label: "Mapping product context",
            number: 1,
        },
        {
            key: "decomposing",
            label: "Synthesizing & validating",
            number: 2,
        },
        {
            key: "creating_flow",
            label: "Composing visual flow",
            number: 3,
            alternativeKeys: ["linking"],
        },
    ];

    const getCurrentIndex = () => {
        for (let i = 0; i < steps.length; i++) {
            if (steps[i].key === progress.step) return i;
            if (steps[i].alternativeKeys?.includes(progress.step)) return i;
        }
        if (progress.step === "completed") return steps.length;
        return -1;
    };

    const currentIndex = getCurrentIndex();
    const isCompleted = progress.step === "completed";
    const isError = progress.step === "error";

    return (
        <div className="px-3 pb-3 animate-in fade-in slide-in-from-bottom-1 duration-300">
            {/* Steps in line */}
            <div className="flex items-center justify-between gap-2">
                {steps.map((step, index) => {
                    const isActive = step.key === progress.step || step.alternativeKeys?.includes(progress.step);
                    const isStepCompleted = currentIndex > index || isCompleted;
                    const isPending = currentIndex < index && !isCompleted;

                    return (
                        <div key={step.key} className="flex items-center flex-1">
                            {/* Step indicator */}
                            <div className="flex items-center gap-2 flex-1">
                                <div
                                    className={cn(
                                        "flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-semibold transition-all duration-500",
                                        isActive && !isError && "bg-primary text-primary-foreground scale-110",
                                        isStepCompleted && "bg-primary/20 text-primary",
                                        isPending && "bg-muted text-muted-foreground/50",
                                        isError && isActive && "bg-destructive/20 text-destructive"
                                    )}
                                >
                                    {isStepCompleted ? (
                                        <CheckCircle2 className="w-3 h-3" />
                                    ) : (
                                        <span>{step.number}</span>
                                    )}
                                </div>

                                <span
                                    className={cn(
                                        "text-[11px] font-medium transition-all duration-300 whitespace-nowrap",
                                        isActive && !isError && "text-primary",
                                        isStepCompleted && "text-muted-foreground",
                                        isPending && "text-muted-foreground/50",
                                        isError && isActive && "text-destructive"
                                    )}
                                >
                                    {step.label}
                                </span>

                                {/* Subtle loading indicator */}
                                {isActive && !isCompleted && !isError && (
                                    <div className="flex gap-0.5 ml-1">
                                        <span className="w-1 h-1 rounded-full bg-primary animate-bounce [animation-delay:-0.3s]" />
                                        <span className="w-1 h-1 rounded-full bg-primary animate-bounce [animation-delay:-0.15s]" />
                                        <span className="w-1 h-1 rounded-full bg-primary animate-bounce" />
                                    </div>
                                )}
                            </div>

                            {/* Connector line */}
                            {index < steps.length - 1 && (
                                <div className={cn(
                                    "h-px flex-1 mx-2 transition-all duration-500",
                                    currentIndex > index || isCompleted
                                        ? "bg-primary/30"
                                        : "bg-border"
                                )} />
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Status - only when complete or error */}
            {(isCompleted || isError) && (
                <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-border/50 animate-in fade-in duration-300">
                    <Sparkles className={cn(
                        "w-3 h-3 shrink-0",
                        isCompleted && "text-primary",
                        isError && "text-destructive"
                    )} />
                    <span className={cn(
                        "text-[11px] font-medium",
                        isCompleted && "text-primary",
                        isError && "text-destructive"
                    )}>
                        {isCompleted ? "Flow created successfully!" : progress.message}
                    </span>
                </div>
            )}
        </div>
    );
}

export function AIPrompt({
    activeTool,
    onToolSelect,
    selectedNodeType,
    onNodeTypeSelect,
    onFlowGenerated,
    onRulesCreated,
    onLoadingChange,
    onBrainBlockCreate,
    projectId = 1,
    userId = 1,
}: AIPromptProps) {
    const [context, setContext] = useState<string | null>("Onboarding");
    const [agentType, setAgentType] = useState<AgentType>("build"); // "build" is now v3.1
    const [isAgentMenuOpen, setIsAgentMenuOpen] = useState(false);
    const [promptValue, setPromptValue] = useState("");
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Flow creation hook - v3.1 pipeline (6 agents)
    const {
        createCompleteFlow,
        isLoading: isLoadingFlow,
        progress,
        error: flowError,
        generatedFlow: flowFromHook,
    } = useFlowCreator({
        projectId: 1,
        userId: 1,
        onV3FlowCreated: (v3Response) => {
            console.log("✨ Flow v3.1 created:", v3Response.message);
            console.log("   Integrity Score:", v3Response.summary.integrity_score + "%");
            setPromptValue("");
            if (textareaRef.current) {
                textareaRef.current.style.height = "auto";
            }
        },
        onError: (err) => {
            console.error("❌ Error:", err.message);
        }
    });

    // When generatedFlow changes (v3.1), notify FlowEditor
    useEffect(() => {
        if (flowFromHook && onFlowGenerated) {
            onFlowGenerated(flowFromHook);
        }
    }, [flowFromHook, onFlowGenerated]);

    // Hook for creating rules only
    const {
        createRules,
        isLoading: isLoadingRules,
        error: rulesError,
    } = useBusinessRules({
        projectId: 1,
        userId: 1,
        autoLoad: false,
        onSuccess: (response) => {
            console.log("📋 Rules created:", response.message);
            onRulesCreated?.(response);
            setPromptValue("");
            if (textareaRef.current) {
                textareaRef.current.style.height = "auto";
            }
        },
        onError: (err) => {
            console.error("❌ Error creating rules:", err.message);
        }
    });

    const isLoading = isLoadingFlow || isLoadingRules;
    const error = flowError || rulesError;
    const showProgress = isLoadingFlow && progress.step !== "idle";

    // Notify loading state changes
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

    // Submit prompt to agent
    const handleSubmit = useCallback(async () => {
        if (!promptValue.trim() || isLoading) return;

        if (agentType === "build") {
            // Builder v3.1: 6-agent pipeline (Oria v3.1 methodology)
            console.log("🚀 Starting v3.1 pipeline with 6 agents...");
            await createCompleteFlow(promptValue.trim());
        } else if (agentType === "rules") {
            // Rules: Create hierarchical rules only
            await createRules(promptValue.trim());
        } else {
            console.log("Discussion agent not implemented yet");
        }
    }, [promptValue, isLoading, agentType, createCompleteFlow, createRules]);

    // Submit with Enter (Shift+Enter for newline)
    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSubmit();
        }
    };

    // Placeholder based on selected agent
    const getPlaceholder = () => {
        switch (agentType) {
            case "discuss":
                return "Ask something about the project...";
            case "build":
                return "Describe the flow with product context (e.g., create checkout flow for e-commerce with PIX payment)...";
            case "rules":
                return "Describe the business rules to create (e.g., user authentication rules)...";
            default:
                return "Type your request...";
        }
    };

    return (
        <div className="fixed bottom-8 left-[calc(50%+8rem)] -translate-x-1/2 z-50 w-full max-w-xl px-4 pointer-events-auto">
            {/* Editor Toolbar */}
            <div className="flex justify-center mb-3">
                <EditorToolbar
                    activeTool={activeTool}
                    onToolSelect={onToolSelect}
                    selectedNodeType={selectedNodeType}
                    onNodeTypeSelect={onNodeTypeSelect}
                    onBrainBlockCreate={onBrainBlockCreate}
                    projectId={projectId}
                    userId={userId}
                />
            </div>

            <div className="relative group">
                {/* Glow Effect */}
                <div className={cn(
                    "absolute -inset-0.5 rounded-2xl blur transition duration-500",
                    showProgress
                        ? "bg-gradient-to-r from-primary/40 via-primary/20 to-primary/40 opacity-60"
                        : "bg-gradient-to-r from-border via-border to-border opacity-20 group-hover:opacity-40"
                )}></div>

                {/* Main Input Container */}
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
                            placeholder={isLoading ? "Creating your flow..." : getPlaceholder()}
                            className={cn(
                                "!border-none !ring-0 !focus:ring-0 !focus:outline-none !outline-none placeholder-muted-foreground transition-all resize-none overflow-hidden min-h-[2.5rem] text-sm font-medium bg-transparent w-full pr-3 pl-3 py-3 !shadow-none",
                                isLoading
                                    ? "text-muted-foreground cursor-not-allowed opacity-60"
                                    : "text-card-foreground"
                            )}
                            rows={1}
                            onInput={handleInput}
                            disabled={isLoading}
                            style={{
                                outline: 'none',
                                border: 'none',
                                boxShadow: 'none'
                            }}
                        ></textarea>
                    </div>

                    {/* Step by Step progress (when loading) */}
                    {showProgress && <CreationSteps progress={progress} />}

                    {/* Bottom Toolbar */}
                    <div className="flex items-center justify-between px-3 pb-3 pt-1">

                        {/* Agent Selector */}
                        <div className="relative">
                            <button
                                onClick={toggleAgentMenu}
                                disabled={isLoading}
                                className={cn(
                                    "flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-md transition-colors cursor-pointer group/selector",
                                    isLoading
                                        ? "bg-muted/50 text-muted-foreground cursor-not-allowed"
                                        : "bg-muted hover:bg-muted/80 text-muted-foreground"
                                )}
                            >
                                {agentType === "discuss" ? (
                                    <>
                                        <Bot className="w-3.5 h-3.5" />
                                        <span>Agent</span>
                                    </>
                                ) : agentType === "rules" ? (
                                    <>
                                        <ScrollText className="w-3.5 h-3.5" />
                                        <span>Rules</span>
                                    </>
                                ) : (
                                    <>
                                        <Wand2 className="w-3.5 h-3.5" />
                                        <span>Builder</span>
                                    </>
                                )}
                                <ChevronDown className="w-3 h-3 text-muted-foreground group-hover/selector:text-foreground" />
                            </button>

                            {/* Agent Menu Dropdown */}
                            {isAgentMenuOpen && (
                                <div className="absolute bottom-full left-0 mb-2 w-56 bg-popover text-popover-foreground rounded-lg shadow-xl border border-border overflow-hidden py-1 z-[60] animate-in fade-in zoom-in-95 duration-200">
                                    {/* Builder v3.1 - Oria Methodology */}
                                    <button
                                        onClick={() => selectAgent("build")}
                                        className={cn("w-full text-left px-3 py-2 text-xs font-medium flex items-center gap-2 hover:bg-accent transition-colors", agentType === "build" && "bg-accent")}
                                    >
                                        <Wand2 className="w-3.5 h-3.5 text-purple-500" />
                                        <div className="flex-1">
                                            <div className="text-popover-foreground flex items-center gap-1.5">
                                                Builder
                                                <span className="text-[9px] font-bold bg-purple-500/10 text-purple-500 px-1 py-0.5 rounded">v3.1</span>
                                            </div>
                                            <div className="text-[10px] text-muted-foreground">6 agents + Integrity Score</div>
                                        </div>
                                        {agentType === "build" && <div className="w-1.5 h-1.5 rounded-full bg-purple-500" />}
                                    </button>
                                    {/* Rules Only */}
                                    <button
                                        onClick={() => selectAgent("rules")}
                                        className={cn("w-full text-left px-3 py-2 text-xs font-medium flex items-center gap-2 hover:bg-accent transition-colors", agentType === "rules" && "bg-accent")}
                                    >
                                        <ScrollText className="w-3.5 h-3.5 text-muted-foreground" />
                                        <div className="flex-1">
                                            <div className="text-popover-foreground">Rules Only</div>
                                            <div className="text-[10px] text-muted-foreground">Hierarchical business rules</div>
                                        </div>
                                        {agentType === "rules" && <div className="w-1.5 h-1.5 rounded-full bg-primary" />}
                                    </button>
                                    <div className="h-px bg-border my-1" />
                                    {/* Agent (Coming soon) */}
                                    <button
                                        onClick={() => selectAgent("discuss")}
                                        className={cn("w-full text-left px-3 py-2 text-xs font-medium flex items-center gap-2 hover:bg-accent transition-colors opacity-50", agentType === "discuss" && "bg-accent")}
                                        disabled
                                    >
                                        <Bot className="w-3.5 h-3.5 text-muted-foreground" />
                                        <div className="flex-1">
                                            <div className="text-popover-foreground">Agent</div>
                                            <div className="text-[10px] text-muted-foreground">Coming soon</div>
                                        </div>
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
            {!isLoading && context && (
                <div className="flex justify-center gap-2 mt-3 flex-wrap">
                    <button
                        onClick={() => setPromptValue("Create login flow with email validation and two-factor authentication")}
                        className="text-[10px] font-medium text-muted-foreground bg-card/80 backdrop-blur border border-border px-3 py-1.5 rounded-full hover:border-border hover:text-foreground transition-all shadow-sm cursor-pointer"
                    >
                        + Login with 2FA
                    </button>
                    <button
                        onClick={() => setPromptValue("Create complete registration flow with data validation and email confirmation")}
                        className="text-[10px] font-medium text-muted-foreground bg-card/80 backdrop-blur border border-border px-3 py-1.5 rounded-full hover:border-border hover:text-foreground transition-all shadow-sm cursor-pointer"
                    >
                        + Complete signup
                    </button>
                    <button
                        onClick={() => setPromptValue("Create password recovery flow with email reset link")}
                        className="text-[10px] font-medium text-muted-foreground bg-card/80 backdrop-blur border border-border px-3 py-1.5 rounded-full hover:border-border hover:text-foreground transition-all shadow-sm cursor-pointer"
                    >
                        + Password recovery
                    </button>
                </div>
            )}
        </div>
    );
}
