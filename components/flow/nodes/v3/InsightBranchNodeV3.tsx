"use client";

import { memo } from "react";
import { Handle, Position } from "reactflow";
import { Lightbulb, TrendingUp, TrendingDown, Minus, BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";

interface InsightBranch {
  branch_id: string;
  label: string;
  condition: string;
  trend?: "up" | "down" | "neutral";
}

interface InsightBranchNodeV3Props {
  data: {
    label: string;
    title?: string;
    description?: string;
    data_source?: string;
    metric?: string;
    branches?: InsightBranch[];
    threshold?: number;
  };
  selected?: boolean;
}

const TrendIcons: Record<string, React.ElementType> = {
  up: TrendingUp,
  down: TrendingDown,
  neutral: Minus,
};

export const InsightBranchNodeV3 = memo(function InsightBranchNodeV3({ data, selected }: InsightBranchNodeV3Props) {
  const branches = data.branches || [
    { branch_id: "high", label: "Alto", condition: "> threshold", trend: "up" },
    { branch_id: "low", label: "Baixo", condition: "< threshold", trend: "down" },
  ];

  return (
    <div
      className={cn(
        "bg-card rounded-xl shadow-sm border-2 border-pink-400 p-4 transition-all duration-200 relative w-[220px] group",
        selected && "ring-2 ring-primary ring-offset-2",
        "hover:shadow-lg"
      )}
    >
      {/* Handles */}
      <Handle
        type="target"
        position={Position.Left}
        className="!w-3 !h-3 !bg-pink-500 !border-2 !border-white !rounded-full z-20 !-left-1.5"
      />
      
      {/* Multiple output handles for branches */}
      {branches.map((branch, idx) => {
        const TrendIcon = TrendIcons[branch.trend || "neutral"] || Minus;
        return (
          <Handle
            key={branch.branch_id}
            type="source"
            position={Position.Right}
            id={branch.branch_id}
            className={cn(
              "!w-3 !h-3 !border-2 !border-white !rounded-full z-20 !-right-1.5",
              branch.trend === "up" && "!bg-green-500",
              branch.trend === "down" && "!bg-red-500",
              (!branch.trend || branch.trend === "neutral") && "!bg-pink-400"
            )}
            style={{
              top: `${30 + idx * 30}%`,
            }}
          />
        );
      })}

      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <div className="p-1.5 rounded-lg bg-pink-100">
          <Lightbulb className="w-4 h-4 text-pink-600" />
        </div>
        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
          Insight Branch
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

      {/* Data Source */}
      {data.data_source && (
        <div className="flex items-center gap-1 mb-3 text-[10px]">
          <BarChart3 className="w-3 h-3 text-pink-500" />
          <span className="text-muted-foreground">Fonte:</span>
          <span className="font-medium">{data.data_source}</span>
        </div>
      )}

      {/* Metric & Threshold */}
      {data.metric && (
        <div className="mb-3 p-2 bg-pink-50 rounded-lg text-center">
          <div className="text-[10px] text-muted-foreground">Métrica</div>
          <div className="text-sm font-semibold text-pink-700">{data.metric}</div>
          {data.threshold !== undefined && (
            <div className="text-[10px] text-pink-500 mt-0.5">
              Threshold: {data.threshold}
            </div>
          )}
        </div>
      )}

      {/* Branches */}
      <div className="space-y-1.5 mt-3 pt-3 border-t border-border/50">
        {branches.map((branch) => {
          const TrendIcon = TrendIcons[branch.trend || "neutral"] || Minus;
          return (
            <div
              key={branch.branch_id}
              className={cn(
                "flex items-center justify-between text-[10px] py-1 px-2 rounded",
                branch.trend === "up" && "bg-green-50 text-green-700",
                branch.trend === "down" && "bg-red-50 text-red-700",
                (!branch.trend || branch.trend === "neutral") && "bg-muted/30 text-muted-foreground"
              )}
            >
              <span className="flex items-center gap-1">
                <TrendIcon className="w-3 h-3" />
                {branch.label}
              </span>
              <code className="text-[9px] font-mono opacity-70">{branch.condition}</code>
            </div>
          );
        })}
      </div>
    </div>
  );
});









