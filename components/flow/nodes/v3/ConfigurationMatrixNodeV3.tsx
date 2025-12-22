"use client";

import { memo } from "react";
import { Handle, Position } from "reactflow";
import { Table2, Settings, Grid3X3 } from "lucide-react";
import { cn } from "@/lib/utils";

interface MatrixOption {
  key: string;
  label: string;
  options: string[];
  selected?: string;
}

interface ConfigurationMatrixNodeV3Props {
  data: {
    label: string;
    title?: string;
    description?: string;
    matrix_options?: MatrixOption[];
    columns?: number;
    impact_level?: "low" | "medium" | "high";
  };
  selected?: boolean;
}

export const ConfigurationMatrixNodeV3 = memo(function ConfigurationMatrixNodeV3({ data, selected }: ConfigurationMatrixNodeV3Props) {
  const options = data.matrix_options || [];
  const columns = data.columns || 2;

  return (
    <div
      className={cn(
        "bg-card rounded-xl shadow-sm border-2 border-violet-400 p-4 transition-all duration-200 relative w-[280px] group",
        selected && "ring-2 ring-primary ring-offset-2",
        "hover:shadow-lg"
      )}
    >
      {/* Handles */}
      <Handle
        type="target"
        position={Position.Left}
        className="!w-3 !h-3 !bg-violet-500 !border-2 !border-white !rounded-full z-20 !-left-1.5"
      />
      <Handle
        type="source"
        position={Position.Right}
        className="!w-3 !h-3 !bg-violet-500 !border-2 !border-white !rounded-full z-20 !-right-1.5"
      />

      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <div className="p-1.5 rounded-lg bg-violet-100">
          <Table2 className="w-4 h-4 text-violet-600" />
        </div>
        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
          Matriz de Configuração
        </span>
      </div>

      {/* Title */}
      <h3 className="font-semibold text-sm text-card-foreground leading-tight mb-2">
        {data.title || data.label}
      </h3>

      {/* Description */}
      {data.description && (
        <p className="text-xs text-muted-foreground mb-3 line-clamp-2">
          {data.description}
        </p>
      )}

      {/* Matrix Preview */}
      {options.length > 0 && (
        <div className="mt-3 pt-3 border-t border-border/50">
          <div className="flex items-center gap-1 mb-2 text-[10px] text-muted-foreground">
            <Grid3X3 className="w-3 h-3" />
            <span>{options.length} opções de configuração</span>
          </div>

          <div className={cn("grid gap-1.5", `grid-cols-${Math.min(columns, 3)}`)}>
            {options.slice(0, 6).map((opt, idx) => (
              <div
                key={opt.key || idx}
                className="p-2 bg-violet-50 rounded text-center"
              >
                <div className="text-[9px] text-muted-foreground truncate">{opt.label}</div>
                <div className="text-[10px] font-medium text-violet-700 truncate">
                  {opt.selected || `${opt.options.length} opções`}
                </div>
              </div>
            ))}
          </div>

          {options.length > 6 && (
            <div className="text-[10px] text-muted-foreground text-center mt-2">
              +{options.length - 6} mais configurações
            </div>
          )}
        </div>
      )}

      {/* Impact Badge */}
      {data.impact_level && (
        <div className="absolute top-2 right-2">
          <span className={cn(
            "text-[8px] px-1.5 py-0.5 rounded font-medium",
            data.impact_level === "high" && "bg-red-100 text-red-600",
            data.impact_level === "medium" && "bg-amber-100 text-amber-600",
            data.impact_level === "low" && "bg-green-100 text-green-600"
          )}>
            {data.impact_level === "high" ? "Alto Impacto" : data.impact_level === "medium" ? "Médio" : "Baixo"}
          </span>
        </div>
      )}

      {/* Settings indicator */}
      <div className="absolute bottom-2 right-2 opacity-30">
        <Settings className="w-4 h-4 text-violet-500" />
      </div>
    </div>
  );
});









