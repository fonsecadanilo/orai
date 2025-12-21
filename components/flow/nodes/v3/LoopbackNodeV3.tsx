"use client";

import { memo } from "react";
import { Handle, Position } from "reactflow";
import { Undo2, CornerUpLeft } from "lucide-react";
import { cn } from "@/lib/utils";

interface LoopbackNodeV3Props {
  data: {
    label: string;
    title?: string;
    description?: string;
    target_step_id?: string;
    target_step_title?: string;
    preserve_data?: boolean;
    reset_fields?: string[];
  };
  selected?: boolean;
}

export const LoopbackNodeV3 = memo(function LoopbackNodeV3({ data, selected }: LoopbackNodeV3Props) {
  return (
    <div
      className={cn(
        "bg-card rounded-xl shadow-sm border-2 border-teal-400 p-4 transition-all duration-200 relative w-[200px] group",
        selected && "ring-2 ring-primary ring-offset-2",
        "hover:shadow-lg"
      )}
    >
      {/* Handles */}
      <Handle
        type="target"
        position={Position.Left}
        className="!w-3 !h-3 !bg-teal-500 !border-2 !border-white !rounded-full z-20 !-left-1.5"
      />
      <Handle
        type="source"
        position={Position.Right}
        className="!w-3 !h-3 !bg-teal-500 !border-2 !border-white !rounded-full z-20 !-right-1.5"
      />
      {/* Loopback arrow indicator */}
      <Handle
        type="source"
        position={Position.Top}
        id="loop"
        className="!w-3 !h-3 !bg-teal-300 !border-2 !border-teal-500 !rounded-full z-20 !-top-1.5"
      />

      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <div className="p-1.5 rounded-lg bg-teal-100">
          <Undo2 className="w-4 h-4 text-teal-600" />
        </div>
        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
          Loopback
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

      {/* Target */}
      {(data.target_step_id || data.target_step_title) && (
        <div className="mt-3 pt-3 border-t border-border/50">
          <div className="flex items-center gap-2 text-[10px]">
            <CornerUpLeft className="w-4 h-4 text-teal-500" />
            <div>
              <span className="text-muted-foreground">Retorna para:</span>
              <div className="font-medium text-teal-700">
                {data.target_step_title || data.target_step_id}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Data handling */}
      <div className="mt-2 flex gap-2">
        {data.preserve_data && (
          <span className="text-[9px] px-1.5 py-0.5 rounded bg-green-100 text-green-600">
            Preserva dados
          </span>
        )}
        {data.reset_fields && data.reset_fields.length > 0 && (
          <span className="text-[9px] px-1.5 py-0.5 rounded bg-red-100 text-red-600">
            Reseta {data.reset_fields.length} campos
          </span>
        )}
      </div>
    </div>
  );
});







