"use client";

import { memo } from "react";
import { Handle, Position } from "reactflow";
import { ArrowLeftRight, AlertTriangle, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface FallbackNodeV3Props {
  data: {
    label: string;
    title?: string;
    description?: string;
    fallback_strategy?: "redirect" | "alternative" | "graceful_degradation";
    target_step_id?: string;
    message?: string;
  };
  selected?: boolean;
}

const STRATEGY_CONFIG: Record<string, { label: string; color: string }> = {
  redirect: { label: "Redirecionar", color: "bg-yellow-100 text-yellow-700" },
  alternative: { label: "Alternativo", color: "bg-amber-100 text-amber-700" },
  graceful_degradation: { label: "Degradação Suave", color: "bg-orange-100 text-orange-700" },
};

export const FallbackNodeV3 = memo(function FallbackNodeV3({ data, selected }: FallbackNodeV3Props) {
  const strategy = data.fallback_strategy || "alternative";
  const strategyConfig = STRATEGY_CONFIG[strategy] || STRATEGY_CONFIG.alternative;

  return (
    <div
      className={cn(
        "bg-card rounded-xl shadow-sm border-2 border-yellow-500 p-4 transition-all duration-200 relative w-[200px] group",
        selected && "ring-2 ring-primary ring-offset-2",
        "hover:shadow-lg"
      )}
    >
      {/* Handles */}
      <Handle
        type="target"
        position={Position.Left}
        className="!w-3 !h-3 !bg-yellow-500 !border-2 !border-white !rounded-full z-20 !-left-1.5"
      />
      <Handle
        type="source"
        position={Position.Right}
        className="!w-3 !h-3 !bg-yellow-500 !border-2 !border-white !rounded-full z-20 !-right-1.5"
      />

      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <div className="p-1.5 rounded-lg bg-yellow-100">
          <ArrowLeftRight className="w-4 h-4 text-yellow-600" />
        </div>
        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
          Fallback
        </span>
      </div>

      {/* Title */}
      <h3 className="font-semibold text-sm text-card-foreground leading-tight mb-2">
        {data.title || data.label}
      </h3>

      {/* Description */}
      {data.description && (
        <p className="text-xs text-muted-foreground mb-2 line-clamp-2">
          {data.description}
        </p>
      )}

      {/* Strategy Badge */}
      <div className="mt-3 pt-3 border-t border-border/50">
        <div className={cn("text-[10px] px-2 py-1 rounded font-medium inline-flex items-center gap-1", strategyConfig.color)}>
          <AlertTriangle className="w-3 h-3" />
          {strategyConfig.label}
        </div>
      </div>

      {/* Target */}
      {data.target_step_id && (
        <div className="flex items-center gap-1 mt-2 text-[10px] text-muted-foreground">
          <ArrowRight className="w-3 h-3" />
          <span>Vai para: {data.target_step_id}</span>
        </div>
      )}

      {/* Message */}
      {data.message && (
        <div className="mt-2 p-2 bg-yellow-50 rounded text-[10px] text-yellow-700">
          {data.message}
        </div>
      )}
    </div>
  );
});









