"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { NodeProps, Handle, Position } from "reactflow";
import { Trash2, GripVertical, MessageSquare, BookOpen, Link2 } from "lucide-react";
import { TextFormatToolbar } from "../TextFormatToolbar";
import { cn } from "@/lib/utils";
import type { TextNodeData, TextSubtype } from "@/types/flow-nodes";

// Size constraints
const MIN_WIDTH = 150;
const MAX_WIDTH = 500;
const MIN_HEIGHT = 80;
const MAX_HEIGHT = 400;

interface TextNodeReactFlowData extends Omit<TextNodeData, 'id' | 'type'> {
    // Campos adicionais para React Flow
    width?: number;
    height?: number;
    onDelete?: (id: string) => void;
    onResize?: (id: string, width: number, height: number) => void;
    // Compatibilidade com estrutura antiga (TextBlockNode)
    text?: string;
}

type ResizeDirection = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw" | null;

// Cores padrão para cada subtipo
const SUBTYPE_COLORS: Record<TextSubtype, { bg: string; border: string; text: string }> = {
    comment: {
        bg: "bg-amber-50 dark:bg-amber-950/30",
        border: "border-amber-200 dark:border-amber-800",
        text: "text-amber-800 dark:text-amber-200",
    },
    rule: {
        bg: "bg-blue-50 dark:bg-blue-950/30",
        border: "border-blue-200 dark:border-blue-800",
        text: "text-blue-800 dark:text-blue-200",
    },
};

// Ícones para cada subtipo
const SUBTYPE_ICONS: Record<TextSubtype, React.ElementType> = {
    comment: MessageSquare,
    rule: BookOpen,
};

// Labels para cada subtipo
const SUBTYPE_LABELS: Record<TextSubtype, string> = {
    comment: "Comentário",
    rule: "Regra de Negócio",
};

export function TextNode({ id, data, selected }: NodeProps<TextNodeReactFlowData>) {
    // Suporte a estrutura antiga (text) e nova (content)
    const initialContent = data.content || data.text || "";
    const subtype: TextSubtype = data.subtype || 'comment';
    
    const [isEditing, setIsEditing] = useState(!initialContent);
    const [content, setContent] = useState(initialContent);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // Size state
    const [size, setSize] = useState({ 
        width: data.width || 250, 
        height: data.height || 120 
    });
    const [isResizing, setIsResizing] = useState(false);
    const [resizeDir, setResizeDir] = useState<ResizeDirection>(null);
    const resizeStartRef = useRef({ x: 0, y: 0, width: 0, height: 0 });

    // Format states
    const [fontSize, setFontSize] = useState("text-sm");
    const [isBold, setIsBold] = useState(false);
    const [isStrikethrough, setIsStrikethrough] = useState(false);
    const [hasLink, setHasLink] = useState(false);
    const [isList, setIsList] = useState(false);

    const colors = SUBTYPE_COLORS[subtype];
    const Icon = SUBTYPE_ICONS[subtype];
    const label = data.label || SUBTYPE_LABELS[subtype];

    useEffect(() => {
        if (isEditing && textareaRef.current) {
            textareaRef.current.focus();
            if (!content) {
                textareaRef.current.select();
            }
        }
    }, [isEditing, content]);

    // Resize handlers
    const handleResizeStart = useCallback((e: React.MouseEvent, direction: ResizeDirection) => {
        e.preventDefault();
        e.stopPropagation();
        setIsResizing(true);
        setResizeDir(direction);
        resizeStartRef.current = {
            x: e.clientX,
            y: e.clientY,
            width: size.width,
            height: size.height,
        };
    }, [size]);

    const handleResizeMove = useCallback((e: MouseEvent) => {
        if (!isResizing || !resizeDir) return;

        const deltaX = e.clientX - resizeStartRef.current.x;
        const deltaY = e.clientY - resizeStartRef.current.y;

        let newWidth = resizeStartRef.current.width;
        let newHeight = resizeStartRef.current.height;

        if (resizeDir.includes("e")) {
            newWidth = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, resizeStartRef.current.width + deltaX));
        } else if (resizeDir.includes("w")) {
            newWidth = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, resizeStartRef.current.width - deltaX));
        }

        if (resizeDir.includes("s")) {
            newHeight = Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, resizeStartRef.current.height + deltaY));
        } else if (resizeDir.includes("n")) {
            newHeight = Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, resizeStartRef.current.height - deltaY));
        }

        setSize({ width: newWidth, height: newHeight });
    }, [isResizing, resizeDir]);

    const handleResizeEnd = useCallback(() => {
        if (isResizing) {
            setIsResizing(false);
            setResizeDir(null);
            data.onResize?.(id, size.width, size.height);
        }
    }, [isResizing, id, size, data]);

    useEffect(() => {
        if (isResizing) {
            window.addEventListener("mousemove", handleResizeMove);
            window.addEventListener("mouseup", handleResizeEnd);
            return () => {
                window.removeEventListener("mousemove", handleResizeMove);
                window.removeEventListener("mouseup", handleResizeEnd);
            };
        }
    }, [isResizing, handleResizeMove, handleResizeEnd]);

    const handleDoubleClick = () => {
        setIsEditing(true);
    };

    const handleBlur = () => {
        setTimeout(() => {
            const activeElement = document.activeElement;
            if (!activeElement?.closest('[data-toolbar]')) {
                if (content.trim()) {
                    setIsEditing(false);
                }
            }
        }, 100);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            if (content.trim()) {
                setIsEditing(false);
            }
        }
        if (e.key === "Escape") {
            setIsEditing(false);
        }
    };

    const getTextStyles = () => {
        return cn(
            fontSize,
            isBold && "font-bold",
            isStrikethrough && "line-through",
        );
    };

    return (
        <div className="relative" ref={containerRef}>
            {/* Floating Toolbar - Shows when selected or editing */}
            {(selected || isEditing) && !isResizing && (
                <div 
                    className="absolute -top-12 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-bottom-2 duration-200"
                    data-toolbar
                >
                    <TextFormatToolbar
                        selectedColor={colors.bg.includes('amber') ? '#FEF3C7' : '#DBEAFE'}
                        onColorChange={() => {}} // Cor fixa baseada no subtipo
                        fontSize={fontSize}
                        onFontSizeChange={setFontSize}
                        isBold={isBold}
                        onBoldToggle={() => setIsBold(!isBold)}
                        isStrikethrough={isStrikethrough}
                        onStrikethroughToggle={() => setIsStrikethrough(!isStrikethrough)}
                        hasLink={hasLink}
                        onLinkToggle={() => setHasLink(!hasLink)}
                        isList={isList}
                        onListToggle={() => setIsList(!isList)}
                        onAIAssist={() => console.log("AI Assist clicked")}
                    />
                </div>
            )}

            {/* Text Node Container */}
            <div
                className={cn(
                    "rounded-xl shadow-sm border-2 transition-all group relative overflow-visible",
                    colors.bg,
                    colors.border,
                    selected && "ring-2 ring-blue-500",
                    isResizing && "select-none"
                )}
                style={{
                    width: size.width,
                    height: size.height,
                }}
                onDoubleClick={handleDoubleClick}
            >
                {/* Connection Handles - Importante para conectar regras aos nós do fluxo */}
                <Handle
                    type="target"
                    position={Position.Left}
                    className={cn(
                        "!w-3 !h-3 !border-2 !border-white !rounded-full opacity-0 group-hover:opacity-100 transition-opacity z-30 !-left-1.5",
                        subtype === 'rule' ? "!bg-blue-400" : "!bg-amber-400"
                    )}
                />
                <Handle
                    type="source"
                    position={Position.Right}
                    className={cn(
                        "!w-3 !h-3 !border-2 !border-white !rounded-full opacity-0 group-hover:opacity-100 transition-opacity z-30 !-right-1.5 cursor-crosshair",
                        subtype === 'rule' ? "!bg-blue-400 hover:!bg-blue-500" : "!bg-amber-400 hover:!bg-amber-500"
                    )}
                />
                <Handle
                    type="target"
                    position={Position.Top}
                    id="top"
                    className={cn(
                        "!w-3 !h-3 !border-2 !border-white !rounded-full opacity-0 group-hover:opacity-100 transition-opacity z-30 !-top-1.5",
                        subtype === 'rule' ? "!bg-blue-400" : "!bg-amber-400"
                    )}
                />
                <Handle
                    type="source"
                    position={Position.Bottom}
                    id="bottom"
                    className={cn(
                        "!w-3 !h-3 !border-2 !border-white !rounded-full opacity-0 group-hover:opacity-100 transition-opacity z-30 !-bottom-1.5 cursor-crosshair",
                        subtype === 'rule' ? "!bg-blue-400 hover:!bg-blue-500" : "!bg-amber-400 hover:!bg-amber-500"
                    )}
                />

                {/* Resize Handles - Only visible when selected */}
                {selected && (
                    <>
                        {/* Corner handles */}
                        <div 
                            className="absolute -top-1 -left-1 w-2.5 h-2.5 bg-white border-2 border-blue-500 rounded-sm cursor-nw-resize z-40"
                            onMouseDown={(e) => handleResizeStart(e, "nw")}
                        />
                        <div 
                            className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-white border-2 border-blue-500 rounded-sm cursor-ne-resize z-40"
                            onMouseDown={(e) => handleResizeStart(e, "ne")}
                        />
                        <div 
                            className="absolute -bottom-1 -left-1 w-2.5 h-2.5 bg-white border-2 border-blue-500 rounded-sm cursor-sw-resize z-40"
                            onMouseDown={(e) => handleResizeStart(e, "sw")}
                        />
                        <div 
                            className="absolute -bottom-1 -right-1 w-2.5 h-2.5 bg-white border-2 border-blue-500 rounded-sm cursor-se-resize z-40"
                            onMouseDown={(e) => handleResizeStart(e, "se")}
                        />
                        
                        {/* Side handles */}
                        <div 
                            className="absolute top-1/2 -left-1 -translate-y-1/2 w-2.5 h-2.5 bg-white border-2 border-blue-500 rounded-full cursor-w-resize z-40"
                            onMouseDown={(e) => handleResizeStart(e, "w")}
                        />
                        <div 
                            className="absolute top-1/2 -right-1 -translate-y-1/2 w-2.5 h-2.5 bg-white border-2 border-blue-500 rounded-full cursor-e-resize z-40"
                            onMouseDown={(e) => handleResizeStart(e, "e")}
                        />
                        <div 
                            className="absolute -top-1 left-1/2 -translate-x-1/2 w-2.5 h-2.5 bg-white border-2 border-blue-500 rounded-full cursor-n-resize z-40"
                            onMouseDown={(e) => handleResizeStart(e, "n")}
                        />
                        <div 
                            className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2.5 h-2.5 bg-white border-2 border-blue-500 rounded-full cursor-s-resize z-40"
                            onMouseDown={(e) => handleResizeStart(e, "s")}
                        />
                    </>
                )}

                {/* Drag Handle */}
                <div className="absolute -left-7 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing">
                    <div className="p-1 rounded bg-card border border-border shadow-sm">
                        <GripVertical className="w-3.5 h-3.5 text-muted-foreground" />
                    </div>
                </div>

                {/* Header */}
                <div className={cn(
                    "flex items-center justify-between px-3 py-2 border-b",
                    colors.border.replace('border-', 'border-b-')
                )}>
                    <div className="flex items-center gap-1.5">
                        <Icon className={cn("w-3.5 h-3.5", colors.text)} />
                        <span className={cn("text-[10px] font-semibold uppercase tracking-wider", colors.text)}>
                            {label}
                        </span>
                    </div>
                    <div className="flex items-center gap-1">
                        {/* Indicador de regra vinculada */}
                        {subtype === 'rule' && data.linkedRuleId && (
                            <span title={`Regra #${data.linkedRuleId}`}>
                                <Link2 className={cn("w-3 h-3", colors.text)} />
                            </span>
                        )}
                        <button
                            onClick={() => data.onDelete?.(id)}
                            className={cn(
                                "p-1 rounded hover:bg-black/5 transition-colors cursor-pointer opacity-0 group-hover:opacity-100",
                                colors.text,
                                "hover:text-red-500"
                            )}
                            title="Excluir"
                        >
                            <Trash2 className="w-3 h-3" />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="p-3 h-[calc(100%-40px)] flex flex-col">
                    {isEditing ? (
                        <textarea
                            ref={textareaRef}
                            value={content}
                            onChange={(e) => {
                                setContent(e.target.value);
                                // Atualiza tanto content quanto text para compatibilidade
                                data.content = e.target.value;
                                if ('text' in data) {
                                    data.text = e.target.value;
                                }
                            }}
                            onBlur={handleBlur}
                            onKeyDown={handleKeyDown}
                            placeholder={
                                subtype === 'comment' 
                                    ? "Adicione um comentário explicativo..." 
                                    : "Descreva a regra de negócio..."
                            }
                            className={cn(
                                "w-full flex-1 bg-transparent border-none focus:outline-none focus:ring-0 resize-none",
                                getTextStyles(),
                                colors.text,
                                "placeholder:opacity-50"
                            )}
                        />
                    ) : (
                        <p className={cn(
                            "whitespace-pre-wrap break-words flex-1 overflow-auto",
                            getTextStyles(),
                            colors.text,
                            !content && "opacity-50"
                        )}>
                            {content || (
                                subtype === 'comment' 
                                    ? "Clique duas vezes para adicionar comentário..." 
                                    : "Clique duas vezes para descrever a regra..."
                            )}
                        </p>
                    )}
                </div>

                {/* Size indicator while resizing */}
                {isResizing && (
                    <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-blue-500 text-white text-[10px] font-medium rounded">
                        {Math.round(size.width)} × {Math.round(size.height)}
                    </div>
                )}
            </div>
        </div>
    );
}

// Exportar também como TextBlockNode para compatibilidade
export { TextNode as TextBlockNode };
