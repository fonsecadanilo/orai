"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { NodeProps, Handle, Position } from "reactflow";
import { Trash2 } from "lucide-react";
import { TextFormatToolbar, ELEMENT_COLORS } from "../TextFormatToolbar";
import { cn } from "@/lib/utils";

// Size constraints
const MIN_WIDTH = 150;
const MAX_WIDTH = 400;
const MIN_HEIGHT = 120;
const MAX_HEIGHT = 500;

interface PostItData {
    text: string;
    colorIndex?: number;
    author?: string;
    width?: number;
    height?: number;
    onDelete?: (id: string) => void;
    onResize?: (id: string, width: number, height: number) => void;
}

type ResizeDirection = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw" | null;

export function PostItNode({ id, data, selected }: NodeProps<PostItData>) {
    const [isEditing, setIsEditing] = useState(true);
    const [text, setText] = useState(data.text || "");
    const [colorIndex, setColorIndex] = useState(data.colorIndex ?? 1);
    const [author] = useState(data.author || "Usuário");
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // Size state
    const [size, setSize] = useState({ 
        width: data.width || 200, 
        height: data.height || 180 
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

    const currentColor = ELEMENT_COLORS[colorIndex]?.value || ELEMENT_COLORS[1].value;

    useEffect(() => {
        if (isEditing && textareaRef.current) {
            textareaRef.current.focus();
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

        // Handle horizontal resize
        if (resizeDir.includes("e")) {
            newWidth = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, resizeStartRef.current.width + deltaX));
        } else if (resizeDir.includes("w")) {
            newWidth = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, resizeStartRef.current.width - deltaX));
        }

        // Handle vertical resize
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
                setIsEditing(false);
            }
        }, 100);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Escape") {
            setIsEditing(false);
        }
    };

    const handleColorChange = (color: string) => {
        const index = ELEMENT_COLORS.findIndex(c => c.value === color);
        if (index !== -1) {
            setColorIndex(index);
            data.colorIndex = index;
        }
    };

    const cycleColor = () => {
        const newIndex = (colorIndex + 1) % ELEMENT_COLORS.length;
        setColorIndex(newIndex);
        data.colorIndex = newIndex;
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
                        selectedColor={currentColor}
                        onColorChange={handleColorChange}
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

            {/* Post-it Container */}
            <div
                className={cn(
                    "rounded-xl shadow-lg transition-all group relative overflow-visible",
                    selected && "ring-2 ring-blue-500",
                    isResizing && "select-none"
                )}
                style={{ 
                    backgroundColor: currentColor,
                    width: size.width,
                    height: size.height,
                }}
                onDoubleClick={handleDoubleClick}
            >
                {/* Connection Handles */}
                <Handle
                    type="target"
                    position={Position.Left}
                    className="!w-3 !h-3 !bg-gray-600 !border-2 !border-white !rounded-full opacity-0 group-hover:opacity-100 transition-opacity z-30 !-left-1.5"
                />
                <Handle
                    type="source"
                    position={Position.Right}
                    className="!w-3 !h-3 !bg-gray-600 !border-2 !border-white !rounded-full opacity-0 group-hover:opacity-100 transition-opacity z-30 !-right-1.5"
                />
                <Handle
                    type="target"
                    position={Position.Top}
                    id="top"
                    className="!w-3 !h-3 !bg-gray-600 !border-2 !border-white !rounded-full opacity-0 group-hover:opacity-100 transition-opacity z-30 !-top-1.5"
                />
                <Handle
                    type="source"
                    position={Position.Bottom}
                    id="bottom"
                    className="!w-3 !h-3 !bg-gray-600 !border-2 !border-white !rounded-full opacity-0 group-hover:opacity-100 transition-opacity z-30 !-bottom-1.5"
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

                {/* Delete Button */}
                <button
                    onClick={() => data.onDelete?.(id)}
                    className="absolute top-2 right-2 p-1.5 rounded-md hover:bg-black/10 text-gray-700/60 hover:text-red-600 transition-all cursor-pointer opacity-0 group-hover:opacity-100 z-10"
                    title="Excluir"
                >
                    <Trash2 className="w-3.5 h-3.5" />
                </button>

                {/* Color Cycle Button */}
                <button
                    onClick={cycleColor}
                    className="absolute top-2 left-2 w-5 h-5 rounded-full border-2 border-white/50 hover:border-white shadow-sm cursor-pointer opacity-0 group-hover:opacity-100 transition-all z-10 hover:scale-110"
                    style={{ 
                        backgroundColor: ELEMENT_COLORS[(colorIndex + 1) % ELEMENT_COLORS.length].value 
                    }}
                    title="Mudar cor"
                />

                {/* Content Area */}
                <div className="p-4 pt-8 pb-10 h-full flex flex-col">
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
                            placeholder="Type anything, @mention anyone"
                            className={cn(
                                "w-full flex-1 text-gray-800 bg-transparent border-none focus:outline-none focus:ring-0 resize-none placeholder:text-gray-600/50",
                                getTextStyles()
                            )}
                        />
                    ) : (
                        <p
                            className={cn(
                                "text-gray-800 whitespace-pre-wrap break-words flex-1 overflow-auto",
                                getTextStyles(),
                                !text && "text-gray-600/50"
                            )}
                        >
                            {text || "Type anything, @mention anyone"}
                        </p>
                    )}
                </div>

                {/* Author Footer */}
                <div className="absolute bottom-0 left-0 right-0 px-4 py-2.5 bg-black/5">
                    <span className="text-xs font-medium text-gray-700/80">
                        {author}
                    </span>
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

