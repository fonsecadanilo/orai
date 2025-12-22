"use client";

import { memo } from "react";
import { Handle, Position } from "reactflow";
import { RotateCcw, Clock, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface RetryNodeV3Props {
  data: {
    label: string;
    title?: string;
    description?: string;
    max_retries?: number;
    delay_ms?: number;
    backoff_multiplier?: number;
    target_step_id?: string;
  };
  selected?: boolean;
}

export const RetryNodeV3 = memo(function RetryNodeV3({ data, selected }: RetryNodeV3Props) {
  const maxRetries = data.max_retries || 3;
  const delayMs = data.delay_ms || 1000;

  return (
    <div
      className={cn(
        "bg-card rounded-xl shadow-sm border-2 border-orange-400 p-4 transition-all duration-200 relative w-[200px] group",
        selected && "ring-2 ring-primary ring-offset-2",
        "hover:shadow-lg"
      )}
    >
      {/* Handles */}
      <Handle
        type="target"
        position={Position.Left}
        className="!w-3 !h-3 !bg-orange-500 !border-2 !border-white !rounded-full z-20 !-left-1.5"
      />
      <Handle
        type="source"
        position={Position.Right}
        id="success"
        className="!w-3 !h-3 !bg-green-500 !border-2 !border-white !rounded-full z-20 !-right-1.5"
        style={{ top: "35%" }}
      />
      <Handle
        type="source"
        position={Position.Right}
        id="exhausted"
        className="!w-3 !h-3 !bg-red-500 !border-2 !border-white !rounded-full z-20 !-right-1.5"
        style={{ top: "65%" }}
      />
      {/* Loop back handle */}
      <Handle
        type="source"
        position={Position.Bottom}
        id="retry"
        className="!w-3 !h-3 !bg-orange-500 !border-2 !border-white !rounded-full z-20 !-bottom-1.5"
      />

      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <div className="p-1.5 rounded-lg bg-orange-100">
          <RotateCcw className="w-4 h-4 text-orange-600" />
        </div>
        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
          Retry
        </span>
      </div>

      {/* Title */}
      <h3 className="font-semibold text-sm text-card-foreground leading-tight mb-2">
        {data.title || data.label}
      </h3>

      {/* Configuration */}
      <div className="space-y-1.5 mt-3 pt-3 border-t border-border/50">
        <div className="flex items-center justify-between text-[10px]">
          <span className="text-muted-foreground flex items-center gap-1">
            <RotateCcw className="w-3 h-3" />
            Tentativas
          </span>
          <span className="font-medium text-orange-600">{maxRetries}x</span>
        </div>
        <div className="flex items-center justify-between text-[10px]">
          <span className="text-muted-foreground flex items-center gap-1">
            <Clock className="w-3 h-3" />
            Intervalo
          </span>
          <span className="font-medium">{delayMs}ms</span>
        </div>
        {data.backoff_multiplier && data.backoff_multiplier > 1 && (
          <div className="flex items-center justify-between text-[10px]">
            <span className="text-muted-foreground">Backoff</span>
            <span className="font-medium">{data.backoff_multiplier}x</span>
          </div>
        )}
      </div>

      {/* Output labels */}
      <div className="absolute right-0 top-0 h-full flex flex-col justify-center pr-6 text-[8px]">
        <span className="text-green-600" style={{ marginTop: "-20px" }}>OK</span>
        <span className="text-red-600" style={{ marginTop: "35px" }}>Esgotou</span>
      </div>
    </div>
  );
});









