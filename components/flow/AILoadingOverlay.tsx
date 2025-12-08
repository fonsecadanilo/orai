"use client";

import { Loader2, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface AILoadingOverlayProps {
  isVisible: boolean;
  message?: string;
}

export function AILoadingOverlay({ 
  isVisible, 
  message = "Gerando fluxo com IA..." 
}: AILoadingOverlayProps) {
  if (!isVisible) return null;

  return (
    <div 
      className={cn(
        "fixed inset-0 z-[100] flex items-center justify-center",
        "bg-background/80 backdrop-blur-sm",
        "animate-in fade-in duration-300"
      )}
    >
      <div className="flex flex-col items-center gap-4 p-8 rounded-2xl bg-card border border-border shadow-2xl">
        {/* Animated Icon */}
        <div className="relative">
          <div className="absolute inset-0 animate-ping">
            <Sparkles className="w-12 h-12 text-primary/30" />
          </div>
          <Sparkles className="w-12 h-12 text-primary animate-pulse" />
        </div>

        {/* Loading Spinner */}
        <Loader2 className="w-6 h-6 text-muted-foreground animate-spin" />

        {/* Message */}
        <div className="text-center">
          <p className="text-sm font-medium text-card-foreground">{message}</p>
          <p className="text-xs text-muted-foreground mt-1">
            Isso pode levar alguns segundos...
          </p>
        </div>

        {/* Progress Dots */}
        <div className="flex gap-1.5">
          <div className="w-2 h-2 rounded-full bg-primary animate-bounce [animation-delay:-0.3s]" />
          <div className="w-2 h-2 rounded-full bg-primary animate-bounce [animation-delay:-0.15s]" />
          <div className="w-2 h-2 rounded-full bg-primary animate-bounce" />
        </div>
      </div>
    </div>
  );
}
