"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { NodeProps, Handle, Position } from "reactflow";
import { Trash2, GripVertical } from "lucide-react";
import { TextFormatToolbar, ELEMENT_COLORS } from "../TextFormatToolbar";
import { cn } from "@/lib/utils";

// Size constraints
const MIN_WIDTH = 150;
const MAX_WIDTH = 500;
const MIN_HEIGHT = 80;
const MAX_HEIGHT = 400;

interface TextBlockData {
    text: string;
    width?: number;
    height?: number;
    onDelete?: (id: string) => void;
    onResize?: (id: string, width: number, height: number) => void;
}

type ResizeDirection = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw" | null;

export function TextBlockNode({ id, data, selected }: NodeProps<TextBlockData>) {
    const [isEditing, setIsEditing] = useState(true);
    const [text, setText] = useState(data.text || "");
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // Size state
    const [size, setSize] = useState({ 
        width: data.width || 220, 
        height: data.height || 100 
    });
    const [isResizing, setIsResizing] = useState(false);
    const [resizeDir, setResizeDir] = useState<ResizeDirection>(null);
    const resizeStartRef = useRef({ x: 0, y: 0, width: 0, height: 0 });

    // Format states
    const [bgColor, setBgColor] = useState("#FFFFFF");
    const [fontSize, setFontSize] = useState("text-sm");
    const [isBold, setIsBold] = useState(false);
    const [isStrikethrough, setIsStrikethrough] = useState(false);
    const [hasLink, setHasLink] = useState(false);
    const [isList, setIsList] = useState(false);

    const hasCustomBg = bgColor !== "#FFFFFF";

    useEffect(() => {
        if (isEditing && textareaRef.current) {
            textareaRef.current.focus();
            textareaRef.current.select();
        }
    }, [isEditing]);

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
                if (text.trim()) {
                    setIsEditing(false);
                }
            }
        }, 100);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            if (text.trim()) {
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

    const getTextColor = () => {
        if (hasCustomBg) {
            return "text-gray-800";
        }
        return "text-card-foreground";
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
                        selectedColor={bgColor}
                        onColorChange={setBgColor}
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

            {/* Text Block Container */}
            <div
                className={cn(
                    "rounded-xl shadow-sm border transition-all group relative overflow-visible",
                    selected ? "ring-2 ring-blue-500" : "border-border hover:border-border/80",
                    !hasCustomBg && "bg-card",
                    isResizing && "select-none"
                )}
                style={{
                    ...(hasCustomBg ? { backgroundColor: bgColor } : {}),
                    width: size.width,
                    height: size.height,
                }}
                onDoubleClick={handleDoubleClick}
            >
                {/* Connection Handles */}
                <Handle
                    type="target"
                    position={Position.Left}
                    className="!w-3 !h-3 !bg-border !border-2 !border-white !rounded-full opacity-0 group-hover:opacity-100 transition-opacity z-30 !-left-1.5 hover:!bg-primary"
                />
                <Handle
                    type="source"
                    position={Position.Right}
                    className="!w-3 !h-3 !bg-card !border-2 !border-border !rounded-full opacity-0 group-hover:opacity-100 transition-opacity z-30 !-right-1.5 hover:!bg-primary hover:!border-primary cursor-crosshair"
                />
                <Handle
                    type="target"
                    position={Position.Top}
                    id="top"
                    className="!w-3 !h-3 !bg-border !border-2 !border-white !rounded-full opacity-0 group-hover:opacity-100 transition-opacity z-30 !-top-1.5 hover:!bg-primary"
                />
                <Handle
                    type="source"
                    position={Position.Bottom}
                    id="bottom"
                    className="!w-3 !h-3 !bg-card !border-2 !border-border !rounded-full opacity-0 group-hover:opacity-100 transition-opacity z-30 !-bottom-1.5 hover:!bg-primary hover:!border-primary cursor-crosshair"
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

                {/* Header - Only show when not using custom bg */}
                {!hasCustomBg && (
                    <div className="flex items-center justify-between px-3 py-2 border-b border-border/50 bg-muted/30">
                        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                            Texto
                        </span>
                        <button
                            onClick={() => data.onDelete?.(id)}
                            className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-red-500 transition-colors cursor-pointer opacity-0 group-hover:opacity-100"
                            title="Excluir"
                        >
                            <Trash2 className="w-3 h-3" />
                        </button>
                    </div>
                )}

                {/* Delete Button for colored blocks */}
                {hasCustomBg && (
                    <button
                        onClick={() => data.onDelete?.(id)}
                        className="absolute top-2 right-2 p-1.5 rounded-md hover:bg-black/10 text-gray-700/60 hover:text-red-600 transition-all cursor-pointer opacity-0 group-hover:opacity-100 z-10"
                        title="Excluir"
                    >
                        <Trash2 className="w-3.5 h-3.5" />
                    </button>
                )}

                {/* Content */}
                <div className={cn(
                    "p-3 h-full flex flex-col",
                    hasCustomBg && "pt-8",
                    !hasCustomBg && "h-[calc(100%-36px)]"
                )}>
                    {isEditing ? (
                        <textarea
                            ref={textareaRef}
                            value={text}
                            onChange={(e) => {
                                setText(e.target.value);
                                data.text = e.target.value;
                            }}
                            onBlur={handleBlur}
                            onKeyDown={handleKeyDown}
                            placeholder="Digite seu texto aqui..."
                            className={cn(
                                "w-full flex-1 bg-transparent border-none focus:outline-none focus:ring-0 resize-none",
                                getTextStyles(),
                                getTextColor(),
                                hasCustomBg ? "placeholder:text-gray-600/50" : "placeholder:text-muted-foreground/50"
                            )}
                        />
                    ) : (
                        <p className={cn(
                            "whitespace-pre-wrap break-words flex-1 overflow-auto",
                            getTextStyles(),
                            getTextColor(),
                            !text && (hasCustomBg ? "text-gray-600/50" : "text-muted-foreground/50")
                        )}>
                            {text || "Clique duas vezes para editar..."}
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


