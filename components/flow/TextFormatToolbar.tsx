"use client";

import { useState } from "react";
import { 
    Bold, 
    Strikethrough, 
    Link2, 
    List, 
    ChevronDown,
    Sparkles,
    Type
} from "lucide-react";
import { cn } from "@/lib/utils";

// Cores disponíveis para o elemento
const ELEMENT_COLORS = [
    { name: "Branco", value: "#FFFFFF", textColor: "text-gray-800", hasBorder: true },
    { name: "Coral", value: "#F4A69A", textColor: "text-gray-800" },
    { name: "Amarelo", value: "#FDE68A", textColor: "text-gray-800" },
    { name: "Verde", value: "#86EFAC", textColor: "text-gray-800" },
    { name: "Azul", value: "#93C5FD", textColor: "text-gray-800" },
    { name: "Roxo", value: "#C4B5FD", textColor: "text-gray-800" },
    { name: "Rosa", value: "#F9A8D4", textColor: "text-gray-800" },
];

const FONT_SIZES = [
    { label: "Small", value: "text-xs" },
    { label: "Medium", value: "text-sm" },
    { label: "Large", value: "text-base" },
    { label: "XL", value: "text-lg" },
];

interface TextFormatToolbarProps {
    selectedColor: string;
    onColorChange: (color: string) => void;
    fontSize: string;
    onFontSizeChange: (size: string) => void;
    isBold: boolean;
    onBoldToggle: () => void;
    isStrikethrough: boolean;
    onStrikethroughToggle: () => void;
    hasLink: boolean;
    onLinkToggle: () => void;
    isList: boolean;
    onListToggle: () => void;
    onAIAssist?: () => void;
    className?: string;
}

export function TextFormatToolbar({
    selectedColor,
    onColorChange,
    fontSize,
    onFontSizeChange,
    isBold,
    onBoldToggle,
    isStrikethrough,
    onStrikethroughToggle,
    hasLink,
    onLinkToggle,
    isList,
    onListToggle,
    onAIAssist,
    className,
}: TextFormatToolbarProps) {
    const [isColorMenuOpen, setIsColorMenuOpen] = useState(false);
    const [isSizeMenuOpen, setIsSizeMenuOpen] = useState(false);

    const currentSize = FONT_SIZES.find(s => s.value === fontSize) || FONT_SIZES[0];

    return (
        <div 
            className={cn(
                "flex items-center gap-0.5 bg-card/95 backdrop-blur-sm rounded-full shadow-lg border border-border px-1.5 py-1 pointer-events-auto",
                className
            )}
            onClick={(e) => e.stopPropagation()}
        >
            {/* Color Picker */}
            <div className="relative">
                <button
                    onClick={() => {
                        setIsColorMenuOpen(!isColorMenuOpen);
                        setIsSizeMenuOpen(false);
                    }}
                    className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-muted transition-colors cursor-pointer"
                    title="Cor"
                >
                    <div 
                        className="w-4 h-4 rounded-full border-2 border-white shadow-sm"
                        style={{ backgroundColor: selectedColor }}
                    />
                    <ChevronDown className="w-2.5 h-2.5 text-muted-foreground absolute -bottom-0.5 -right-0.5" />
                </button>

                {isColorMenuOpen && (
                    <div className="absolute top-full left-0 mt-2 p-2 bg-popover rounded-lg shadow-xl border border-border z-[100] animate-in fade-in zoom-in-95 duration-150">
                        <div className="grid grid-cols-4 gap-1.5">
                            {ELEMENT_COLORS.map((color) => (
                                <button
                                    key={color.value}
                                    onClick={() => {
                                        onColorChange(color.value);
                                        setIsColorMenuOpen(false);
                                    }}
                                    className={cn(
                                        "w-7 h-7 rounded-full border-2 transition-all cursor-pointer hover:scale-110",
                                        selectedColor === color.value 
                                            ? "border-primary ring-2 ring-primary/30" 
                                            : color.value === "#FFFFFF" 
                                                ? "border-gray-300 hover:border-gray-400"
                                                : "border-white/50 hover:border-white"
                                    )}
                                    style={{ backgroundColor: color.value }}
                                    title={color.name}
                                />
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Divider */}
            <div className="h-5 w-px bg-border mx-1" />

            {/* Font/Size Picker */}
            <div className="relative">
                <button
                    onClick={() => {
                        setIsSizeMenuOpen(!isSizeMenuOpen);
                        setIsColorMenuOpen(false);
                    }}
                    className="flex items-center gap-1 px-2 py-1 rounded-md hover:bg-muted transition-colors cursor-pointer text-xs font-medium text-muted-foreground"
                    title="Tamanho"
                >
                    <Type className="w-3.5 h-3.5" />
                    <span>{currentSize.label}</span>
                    <ChevronDown className="w-3 h-3" />
                </button>

                {isSizeMenuOpen && (
                    <div className="absolute top-full left-0 mt-2 py-1 bg-popover rounded-lg shadow-xl border border-border z-[100] min-w-[100px] animate-in fade-in zoom-in-95 duration-150">
                        {FONT_SIZES.map((size) => (
                            <button
                                key={size.value}
                                onClick={() => {
                                    onFontSizeChange(size.value);
                                    setIsSizeMenuOpen(false);
                                }}
                                className={cn(
                                    "w-full text-left px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer",
                                    fontSize === size.value 
                                        ? "bg-accent text-accent-foreground" 
                                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                                )}
                            >
                                {size.label}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* Divider */}
            <div className="h-5 w-px bg-border mx-1" />

            {/* Bold */}
            <button
                onClick={onBoldToggle}
                className={cn(
                    "w-7 h-7 rounded-md flex items-center justify-center transition-colors cursor-pointer",
                    isBold 
                        ? "bg-primary text-primary-foreground" 
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
                title="Negrito"
            >
                <Bold className="w-3.5 h-3.5" />
            </button>

            {/* Strikethrough */}
            <button
                onClick={onStrikethroughToggle}
                className={cn(
                    "w-7 h-7 rounded-md flex items-center justify-center transition-colors cursor-pointer",
                    isStrikethrough 
                        ? "bg-primary text-primary-foreground" 
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
                title="Tachado"
            >
                <Strikethrough className="w-3.5 h-3.5" />
            </button>

            {/* Link */}
            <button
                onClick={onLinkToggle}
                className={cn(
                    "w-7 h-7 rounded-md flex items-center justify-center transition-colors cursor-pointer",
                    hasLink 
                        ? "bg-primary text-primary-foreground" 
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
                title="Link"
            >
                <Link2 className="w-3.5 h-3.5" />
            </button>

            {/* List */}
            <button
                onClick={onListToggle}
                className={cn(
                    "w-7 h-7 rounded-md flex items-center justify-center transition-colors cursor-pointer",
                    isList 
                        ? "bg-primary text-primary-foreground" 
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
                title="Lista"
            >
                <List className="w-3.5 h-3.5" />
            </button>

            {/* Divider */}
            <div className="h-5 w-px bg-border mx-1" />

            {/* AI Assist Button */}
            {onAIAssist && (
                <button
                    onClick={onAIAssist}
                    className="w-7 h-7 rounded-md flex items-center justify-center bg-violet-500 hover:bg-violet-600 text-white transition-colors cursor-pointer"
                    title="Assistente IA"
                >
                    <Sparkles className="w-3.5 h-3.5" />
                </button>
            )}
        </div>
    );
}

// Export colors for use in other components
export { ELEMENT_COLORS };

