"use client";

import { X, Zap, GitBranch, Play, CheckCircle2, AlertCircle } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

type NodeType = "trigger" | "logic" | "action";
type ActionType = "success" | "error";

interface NodeConfigSheetProps {
    isOpen: boolean;
    onClose: () => void;
    nodeType: NodeType | null;
    onConfirm: (config: NodeConfig) => void;
}

export interface NodeConfig {
    type: NodeType;
    label: string;
    description?: string;
    tag?: string;
    actionType?: ActionType;
}

export function NodeConfigSheet({ isOpen, onClose, nodeType, onConfirm }: NodeConfigSheetProps) {
    const [label, setLabel] = useState("");
    const [description, setDescription] = useState("");
    const [tag, setTag] = useState("");
    const [actionType, setActionType] = useState<ActionType>("success");

    const handleConfirm = () => {
        if (!label.trim() || !nodeType) return;

        const config: NodeConfig = {
            type: nodeType,
            label: label.trim(),
            description: description.trim() || undefined,
        };

        if (nodeType === "logic") {
            config.tag = tag.trim() || undefined;
        }

        if (nodeType === "action") {
            config.actionType = actionType;
        }

        onConfirm(config);
        resetForm();
        onClose();
    };

    const resetForm = () => {
        setLabel("");
        setDescription("");
        setTag("");
        setActionType("success");
    };

    const handleClose = () => {
        resetForm();
        onClose();
    };

    const getNodeIcon = () => {
        switch (nodeType) {
            case "trigger":
                return <Zap className="w-5 h-5 text-blue-500" />;
            case "logic":
                return <GitBranch className="w-5 h-5 text-purple-500" />;
            case "action":
                return <Play className="w-5 h-5 text-green-500" />;
            default:
                return null;
        }
    };

    const getNodeTitle = () => {
        switch (nodeType) {
            case "trigger":
                return "Novo Trigger";
            case "logic":
                return "Nova Condição";
            case "action":
                return "Nova Ação";
            default:
                return "Novo Nó";
        }
    };

    const getNodeDescription = () => {
        switch (nodeType) {
            case "trigger":
                return "Um trigger inicia o fluxo quando um evento específico ocorre.";
            case "logic":
                return "Uma condição avalia dados e direciona o fluxo com base em regras.";
            case "action":
                return "Uma ação executa uma tarefa específica no fluxo.";
            default:
                return "";
        }
    };

    return (
        <div
            className={cn(
                "fixed inset-0 z-[70] flex items-end justify-center sm:items-center transition-all duration-300",
                isOpen ? "pointer-events-auto" : "pointer-events-none"
            )}
        >
            {/* Backdrop */}
            <div
                className={cn(
                    "absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity duration-300",
                    isOpen ? "opacity-100" : "opacity-0"
                )}
                onClick={handleClose}
            />

            {/* Sheet */}
            <div
                className={cn(
                    "relative w-full max-w-md bg-card rounded-t-3xl sm:rounded-2xl shadow-2xl border border-border transition-all duration-500 ease-out transform",
                    isOpen ? "translate-y-0 opacity-100" : "translate-y-full sm:translate-y-8 opacity-0"
                )}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-5 border-b border-border">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center">
                            {getNodeIcon()}
                        </div>
                        <div>
                            <h2 className="font-semibold text-lg text-card-foreground">{getNodeTitle()}</h2>
                            <p className="text-xs text-muted-foreground mt-0.5">{getNodeDescription()}</p>
                        </div>
                    </div>
                    <button
                        onClick={handleClose}
                        className="w-8 h-8 rounded-full hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Content */}
                <div className="px-6 py-5 space-y-4">
                    {/* Label Input */}
                    <div>
                        <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                            Nome *
                        </label>
                        <input
                            type="text"
                            value={label}
                            onChange={(e) => setLabel(e.target.value)}
                            placeholder={
                                nodeType === "trigger"
                                    ? "Ex: Novo Cadastro"
                                    : nodeType === "logic"
                                        ? "Ex: Validar Email"
                                        : "Ex: Enviar Notificação"
                            }
                            className="w-full px-4 py-3 bg-muted/50 border border-border rounded-xl text-sm text-card-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                            autoFocus
                        />
                    </div>

                    {/* Description Input */}
                    <div>
                        <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                            Descrição
                        </label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Uma breve descrição do que este nó faz..."
                            rows={2}
                            className="w-full px-4 py-3 bg-muted/50 border border-border rounded-xl text-sm text-card-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all resize-none"
                        />
                    </div>

                    {/* Logic-specific: Tag */}
                    {nodeType === "logic" && (
                        <div>
                            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                                Tag / Condição
                            </label>
                            <input
                                type="text"
                                value={tag}
                                onChange={(e) => setTag(e.target.value)}
                                placeholder="Ex: É válido?"
                                className="w-full px-4 py-3 bg-muted/50 border border-border rounded-xl text-sm text-card-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                            />
                        </div>
                    )}

                    {/* Action-specific: Type */}
                    {nodeType === "action" && (
                        <div>
                            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                                Tipo de Ação
                            </label>
                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    onClick={() => setActionType("success")}
                                    className={cn(
                                        "flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 transition-all cursor-pointer",
                                        actionType === "success"
                                            ? "border-green-500 bg-green-500/10 text-green-600"
                                            : "border-border bg-muted/50 text-muted-foreground hover:border-green-500/50"
                                    )}
                                >
                                    <CheckCircle2 className="w-4 h-4" />
                                    <span className="text-sm font-medium">Sucesso</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setActionType("error")}
                                    className={cn(
                                        "flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 transition-all cursor-pointer",
                                        actionType === "error"
                                            ? "border-red-500 bg-red-500/10 text-red-600"
                                            : "border-border bg-muted/50 text-muted-foreground hover:border-red-500/50"
                                    )}
                                >
                                    <AlertCircle className="w-4 h-4" />
                                    <span className="text-sm font-medium">Erro</span>
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-border flex items-center justify-end gap-3">
                    <button
                        onClick={handleClose}
                        className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleConfirm}
                        disabled={!label.trim()}
                        className={cn(
                            "px-6 py-2 text-sm font-semibold rounded-xl transition-all cursor-pointer",
                            label.trim()
                                ? "bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm"
                                : "bg-muted text-muted-foreground cursor-not-allowed"
                        )}
                    >
                        Criar Nó
                    </button>
                </div>
            </div>
        </div>
    );
}


















