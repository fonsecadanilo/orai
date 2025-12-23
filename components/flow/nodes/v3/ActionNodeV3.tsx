"use client";

import { memo } from "react";
import { Handle, Position } from "reactflow";
import {
  Zap,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Send,
  Save,
  Trash2,
  Edit,
  Download,
  Upload,
  ExternalLink,
  ArrowRight,
  XCircle,
  ShieldAlert
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ImpactLevel } from "@/lib/agents/v3/types";

type ActionCategory = "create" | "update" | "delete" | "send" | "fetch" | "process" | "navigate";
type ActionStatus = "idle" | "loading" | "success" | "error";

interface ActionNodeV3Props {
  data: {
    label: string;
    title?: string;
    description?: string;
    action_category?: ActionCategory;
    category?: string;
    impact_level?: ImpactLevel;
    status?: ActionStatus;
    verb?: string;
    requires_confirmation?: boolean;
    is_destructive?: boolean;
    outputs?: string[];
    role_scope?: string;
  };
  selected?: boolean;
}

const CATEGORY_CONFIG: Record<ActionCategory, {
  icon: React.ElementType;
  color: string;
  bgColor: string;
  borderColor: string;
  label: string;
}> = {
  create: { icon: Save, color: "text-green-600", bgColor: "bg-green-500", borderColor: "border-green-400", label: "Create" },
  update: { icon: Edit, color: "text-blue-600", bgColor: "bg-blue-500", borderColor: "border-blue-400", label: "Update" },
  delete: { icon: Trash2, color: "text-red-600", bgColor: "bg-red-500", borderColor: "border-red-400", label: "Delete" },
  send: { icon: Send, color: "text-purple-600", bgColor: "bg-purple-500", borderColor: "border-purple-400", label: "Send" },
  fetch: { icon: Download, color: "text-cyan-600", bgColor: "bg-cyan-500", borderColor: "border-cyan-400", label: "Fetch" },
  process: { icon: Zap, color: "text-amber-600", bgColor: "bg-amber-500", borderColor: "border-amber-400", label: "Process" },
  navigate: { icon: ExternalLink, color: "text-indigo-600", bgColor: "bg-indigo-500", borderColor: "border-indigo-400", label: "Navigate" },
};

const STATUS_CONFIG: Record<ActionStatus, { icon: React.ElementType; color: string }> = {
  idle: { icon: Zap, color: "text-muted-foreground" },
  loading: { icon: Loader2, color: "text-blue-500 animate-spin" },
  success: { icon: CheckCircle2, color: "text-green-500" },
  error: { icon: AlertCircle, color: "text-red-500" },
};

const IMPACT_STYLES: Record<ImpactLevel, { border: string; badge: string; badgeText: string }> = {
  low: {
    border: "border-slate-300 dark:border-slate-400",
    badge: "bg-slate-100 dark:bg-slate-800",
    badgeText: "text-slate-600 dark:text-slate-300"
  },
  medium: {
    border: "border-amber-400 dark:border-amber-400",
    badge: "bg-amber-100 dark:bg-amber-900/50",
    badgeText: "text-amber-700 dark:text-amber-300"
  },
  high: {
    border: "border-red-400 dark:border-red-400",
    badge: "bg-red-100 dark:bg-red-900/50",
    badgeText: "text-red-700 dark:text-red-300"
  },
};

export const ActionNodeV3 = memo(function ActionNodeV3({ data, selected }: ActionNodeV3Props) {
  // Map category string to ActionCategory
  const categoryKey = (data.action_category || data.category || "process") as ActionCategory;
  const category = CATEGORY_CONFIG[categoryKey] ? categoryKey : "process";
  const impactLevel = data.impact_level || "medium";
  const status = data.status || "idle";

  const categoryConfig = CATEGORY_CONFIG[category];
  const statusConfig = STATUS_CONFIG[status];
  const impactStyle = IMPACT_STYLES[impactLevel];
  const CategoryIcon = categoryConfig.icon;
  const StatusIcon = statusConfig.icon;

  return (
    <div
      className={cn(
        "bg-card rounded-xl shadow-md border-2 transition-all duration-200 relative w-[260px] group",
        data.is_destructive ? "border-red-500" : impactStyle.border,
        selected && "ring-2 ring-primary ring-offset-2",
        "hover:shadow-xl hover:scale-[1.02]"
      )}
    >
      {/* Handles */}
      <Handle
        type="target"
        position={Position.Left}
        className="!w-4 !h-4 !bg-amber-500 !border-2 !border-white !rounded-full z-20 !-left-2 shadow-md"
      />
      <Handle
        type="source"
        position={Position.Right}
        className="!w-4 !h-4 !bg-green-500 !border-2 !border-white !rounded-full z-20 !-right-2 shadow-md"
      />

      {/* Header with gradient */}
      <div className={cn(
        "px-4 pt-3 pb-2 rounded-t-xl border-b",
        data.is_destructive
          ? "bg-gradient-to-r from-red-50 to-red-100/50 dark:from-red-950/30 dark:to-red-900/20 border-red-200/50 dark:border-red-800/50"
          : "bg-gradient-to-r from-amber-50 to-amber-100/50 dark:from-amber-950/30 dark:to-amber-900/20 border-amber-200/50 dark:border-amber-800/50"
      )}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={cn("p-1.5 rounded-lg shadow-sm", categoryConfig.bgColor)}>
              <CategoryIcon className="w-4 h-4 text-white" />
            </div>
            <div className="flex flex-col">
              <span className={cn(
                "text-[10px] font-bold uppercase tracking-wider",
                data.is_destructive ? "text-red-600 dark:text-red-400" : "text-amber-600 dark:text-amber-400"
              )}>
                Action
              </span>
              {data.role_scope && (
                <span className="text-[8px] text-muted-foreground">
                  @{data.role_scope}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <span className={cn("text-[9px] px-2 py-0.5 rounded-full font-semibold", impactStyle.badge, impactStyle.badgeText)}>
              {impactLevel === "high" ? "High" : impactLevel === "medium" ? "Medium" : "Low"}
            </span>
            <StatusIcon className={cn("w-4 h-4", statusConfig.color)} />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        {/* Title */}
        <h3 className="font-bold text-sm text-card-foreground leading-tight mb-1">
          {data.title || data.label}
        </h3>

        {/* Verb/Action */}
        {data.verb && data.verb !== data.label && data.verb !== data.title && (
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground mb-2">
            <ArrowRight className="w-3 h-3" />
            <span className="font-medium">{data.verb}</span>
          </div>
        )}

        {/* Description */}
        {data.description && (
          <p className="text-xs text-muted-foreground mb-3 line-clamp-2">
            {data.description}
          </p>
        )}

        {/* Tags */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className={cn(
            "text-[9px] px-2 py-0.5 rounded-md font-semibold text-white",
            categoryConfig.bgColor
          )}>
            {categoryConfig.label}
          </span>

          {data.requires_confirmation && (
            <span className="text-[9px] px-2 py-0.5 rounded-md bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300 font-medium flex items-center gap-1">
              <ShieldAlert className="w-3 h-3" />
              Confirm
            </span>
          )}

          {data.is_destructive && (
            <span className="text-[9px] px-2 py-0.5 rounded-md bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300 font-medium flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />
              Destructive
            </span>
          )}
        </div>
      </div>

      {/* Footer with outputs */}
      <div className="px-4 py-2 bg-muted/30 rounded-b-xl border-t border-border/30">
        <div className="flex items-center justify-between text-[9px]">
          <span className="text-muted-foreground font-medium">Outputs:</span>
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1 text-green-600">
              <CheckCircle2 className="w-3 h-3" />
              Success
            </span>
            <span className="flex items-center gap-1 text-red-500">
              <XCircle className="w-3 h-3" />
              Error
            </span>
          </div>
        </div>
      </div>

      {/* High impact warning icon */}
      {impactLevel === "high" && !data.is_destructive && (
        <div className="absolute top-3 right-3">
          <AlertCircle className="w-4 h-4 text-red-500 animate-pulse" />
        </div>
      )}
    </div>
  );
});


