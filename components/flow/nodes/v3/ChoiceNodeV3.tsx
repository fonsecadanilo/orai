"use client";

import { memo } from "react";
import { Handle, Position } from "reactflow";
import { ListChecks, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ImpactLevel } from "@/lib/agents/v3/types";

interface ChoiceOption {
  option_id: string;
  label: string;
  is_default?: boolean;
}

interface ChoiceNodeV3Props {
  data: {
    label: string;
    title?: string;
    description?: string;
    options?: ChoiceOption[];
    impact_level?: ImpactLevel;
    group_label?: string;
    multiple?: boolean;
  };
  selected?: boolean;
}

export const ChoiceNodeV3 = memo(function ChoiceNodeV3({ data, selected }: ChoiceNodeV3Props) {
  const impactLevel = data.impact_level || "low";

  return (
    <div
      className={cn(
        "bg-card rounded-xl shadow-sm border-2 border-purple-400 p-4 transition-all duration-200 relative w-[240px] group",
        selected && "ring-2 ring-primary ring-offset-2",
        "hover:shadow-lg"
      )}
    >
      {/* Handles */}
      <Handle
        type="target"
        position={Position.Left}
        className="!w-3 !h-3 !bg-purple-500 !border-2 !border-white !rounded-full z-20 !-left-1.5"
      />
      <Handle
        type="source"
        position={Position.Right}
        className="!w-3 !h-3 !bg-purple-500 !border-2 !border-white !rounded-full z-20 !-right-1.5"
      />

      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <div className="p-1.5 rounded-lg bg-purple-100">
          <ListChecks className="w-4 h-4 text-purple-600" />
        </div>
        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
          {data.multiple ? "Múltipla Escolha" : "Escolha Única"}
        </span>
      </div>

      {/* Title */}
      <h3 className="font-semibold text-sm text-card-foreground leading-tight mb-1">
        {data.title || data.label}
      </h3>

      {/* Description */}
      {data.description && (
        <p className="text-xs text-muted-foreground mb-3 line-clamp-2">
          {data.description}
        </p>
      )}

      {/* Options */}
      {data.options && data.options.length > 0 && (
        <div className="mt-3 pt-3 border-t border-border/50 space-y-1.5">
          {data.options.slice(0, 4).map((option, idx) => (
            <div
              key={option.option_id || idx}
              className={cn(
                "flex items-center gap-2 text-[11px] py-1.5 px-2 rounded transition-colors",
                option.is_default
                  ? "bg-purple-100 text-purple-700"
                  : "bg-muted/30 text-muted-foreground hover:bg-muted/50"
              )}
            >
              <div
                className={cn(
                  "w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center",
                  option.is_default
                    ? "border-purple-500 bg-purple-500"
                    : "border-muted-foreground/50"
                )}
              >
                {option.is_default && <Check className="w-2 h-2 text-white" />}
              </div>
              <span className="truncate">{option.label}</span>
            </div>
          ))}

          {data.options.length > 4 && (
            <div className="text-[10px] text-muted-foreground text-center pt-1">
              +{data.options.length - 4} mais opções
            </div>
          )}
        </div>
      )}

      {/* Group Label */}
      {data.group_label && (
        <div className="absolute top-2 right-2">
          <span className="text-[8px] px-1.5 py-0.5 rounded bg-purple-100 text-purple-600 font-medium">
            {data.group_label}
          </span>
        </div>
      )}
    </div>
  );
});







