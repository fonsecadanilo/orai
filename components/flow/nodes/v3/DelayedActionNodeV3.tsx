"use client";

import { memo } from "react";
import { Handle, Position } from "reactflow";
import { Clock, Timer, Play } from "lucide-react";
import { cn } from "@/lib/utils";

interface DelayedActionNodeV3Props {
  data: {
    label: string;
    title?: string;
    description?: string;
    delay_ms?: number;
    delay_type?: "fixed" | "scheduled" | "conditional";
    scheduled_time?: string;
    condition?: string;
  };
  selected?: boolean;
}

function formatDelay(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  if (ms < 3600000) return `${(ms / 60000).toFixed(1)}min`;
  return `${(ms / 3600000).toFixed(1)}h`;
}

export const DelayedActionNodeV3 = memo(function DelayedActionNodeV3({ data, selected }: DelayedActionNodeV3Props) {
  const delayType = data.delay_type || "fixed";
  const delayMs = data.delay_ms || 1000;

  return (
    <div
      className={cn(
        "bg-card rounded-xl shadow-sm border-2 border-cyan-400 p-4 transition-all duration-200 relative w-[200px] group",
        selected && "ring-2 ring-primary ring-offset-2",
        "hover:shadow-lg"
      )}
    >
      {/* Handles */}
      <Handle
        type="target"
        position={Position.Left}
        className="!w-3 !h-3 !bg-cyan-500 !border-2 !border-white !rounded-full z-20 !-left-1.5"
      />
      <Handle
        type="source"
        position={Position.Right}
        className="!w-3 !h-3 !bg-cyan-500 !border-2 !border-white !rounded-full z-20 !-right-1.5"
      />

      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <div className="p-1.5 rounded-lg bg-cyan-100">
          <Clock className="w-4 h-4 text-cyan-600" />
        </div>
        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
          Ação com Delay
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

      {/* Delay Info */}
      <div className="mt-3 pt-3 border-t border-border/50">
        <div className="flex items-center justify-center gap-2 p-2 bg-cyan-50 rounded-lg">
          <Timer className="w-5 h-5 text-cyan-600" />
          <div className="text-center">
            {delayType === "fixed" && (
              <span className="text-lg font-bold text-cyan-700">{formatDelay(delayMs)}</span>
            )}
            {delayType === "scheduled" && (
              <span className="text-sm font-medium text-cyan-700">{data.scheduled_time || "Agendado"}</span>
            )}
            {delayType === "conditional" && (
              <span className="text-sm font-medium text-cyan-700">Condicional</span>
            )}
          </div>
        </div>
      </div>

      {/* Type badge */}
      <div className="mt-2 flex justify-center">
        <span className={cn(
          "text-[9px] px-2 py-0.5 rounded-full font-medium",
          delayType === "fixed" && "bg-cyan-100 text-cyan-700",
          delayType === "scheduled" && "bg-purple-100 text-purple-700",
          delayType === "conditional" && "bg-amber-100 text-amber-700"
        )}>
          {delayType === "fixed" && "Delay Fixo"}
          {delayType === "scheduled" && "Agendado"}
          {delayType === "conditional" && "Condicional"}
        </span>
      </div>

      {/* Condition */}
      {delayType === "conditional" && data.condition && (
        <div className="mt-2 p-1.5 bg-muted/50 rounded text-[9px] font-mono text-muted-foreground">
          {data.condition}
        </div>
      )}

      {/* Play indicator */}
      <div className="absolute top-2 right-2 opacity-50">
        <Play className="w-3 h-3 text-cyan-500" />
      </div>
    </div>
  );
});







