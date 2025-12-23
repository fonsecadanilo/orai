"use client";

import { memo } from "react";
import { Handle, Position } from "reactflow";
import { GitBranch, ArrowRight, CheckCircle2, XCircle, HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface ConditionBranch {
  branch_id: string;
  label: string;
  is_default?: boolean;
}

interface ConditionNodeV3Props {
  data: {
    label: string;
    title?: string;
    description?: string;
    expression?: string;
    condition_expression?: string;
    branches?: ConditionBranch[];
    paths?: { yes?: string; no?: string };
    impact_level?: "low" | "medium" | "high";
    role_scope?: string;
  };
  selected?: boolean;
}

export const ConditionNodeV3 = memo(function ConditionNodeV3({ data, selected }: ConditionNodeV3Props) {
  // Build branches from paths or use default
  const branches = data.branches || [
    { branch_id: "yes", label: "Yes", is_default: false },
    { branch_id: "no", label: "No", is_default: true },
  ];

  const expression = data.expression || data.condition_expression;

  return (
    <div
      className={cn(
        "bg-card rounded-xl shadow-md border-2 border-indigo-400 dark:border-indigo-400 transition-all duration-200 relative w-[240px] group",
        selected && "ring-2 ring-primary ring-offset-2",
        "hover:shadow-xl hover:scale-[1.02]"
      )}
    >
      {/* Handles */}
      <Handle
        type="target"
        position={Position.Left}
        className="!w-4 !h-4 !bg-indigo-500 !border-2 !border-white !rounded-full z-20 !-left-2 shadow-md"
      />

      {/* Single output handle - let ReactFlow connect edges */}
      <Handle
        type="source"
        position={Position.Right}
        className="!w-4 !h-4 !bg-indigo-500 !border-2 !border-white !rounded-full z-20 !-right-2 shadow-md"
      />

      {/* Header with gradient */}
      <div className="px-4 pt-3 pb-2 bg-gradient-to-r from-indigo-50 to-purple-100/50 dark:from-indigo-950/30 dark:to-purple-900/20 rounded-t-xl border-b border-indigo-200/50 dark:border-indigo-800/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-indigo-500 shadow-sm">
              <GitBranch className="w-4 h-4 text-white" />
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
                Condition
              </span>
              {data.role_scope && (
                <span className="text-[8px] text-muted-foreground">
                  @{data.role_scope}
                </span>
              )}
            </div>
          </div>
          <HelpCircle className="w-4 h-4 text-indigo-400" />
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        {/* Title/Question */}
        <h3 className="font-bold text-sm text-card-foreground leading-tight mb-2">
          {data.title || data.label}
        </h3>

        {/* Description */}
        {data.description && (
          <p className="text-xs text-muted-foreground mb-2 line-clamp-2">
            {data.description}
          </p>
        )}

        {/* Condition Expression */}
        {expression && (
          <div className="mb-3 p-2 bg-indigo-50 dark:bg-indigo-900/30 rounded-lg border border-indigo-200 dark:border-indigo-700">
            <code className="text-[10px] text-indigo-700 dark:text-indigo-300 font-mono break-words">
              {expression}
            </code>
          </div>
        )}

        {/* Branches */}
        <div className="space-y-1.5 border-t border-border/50 pt-3">
          <span className="text-[9px] font-medium text-muted-foreground uppercase tracking-wide">
            Branches
          </span>
          {branches.map((branch) => (
            <div
              key={branch.branch_id}
              className={cn(
                "flex items-center justify-between text-[10px] py-1.5 px-2.5 rounded-md transition-colors",
                branch.branch_id === "yes" || (!branch.is_default && branch.branch_id !== "no")
                  ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                  : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
              )}
            >
              <span className="flex items-center gap-1.5 font-medium">
                {branch.branch_id === "yes" || (!branch.is_default && branch.branch_id !== "no") ? (
                  <CheckCircle2 className="w-3 h-3" />
                ) : (
                  <XCircle className="w-3 h-3" />
                )}
                {branch.label}
              </span>
              <ArrowRight className="w-3 h-3" />
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="px-4 py-2 bg-muted/30 rounded-b-xl border-t border-border/30">
        <div className="text-[9px] text-center text-muted-foreground">
          Decision point
        </div>
      </div>
    </div>
  );
});


