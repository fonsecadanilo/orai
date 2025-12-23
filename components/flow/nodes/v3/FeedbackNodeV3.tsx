"use client";

import { memo } from "react";
import { Handle, Position } from "reactflow";
import { CheckCircle2, XCircle, Info, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

type FeedbackType = "success" | "error" | "info" | "warning";

interface FeedbackNodeV3Props {
  data: {
    label: string;
    title?: string;
    description?: string;
    feedback_type?: FeedbackType;
    message?: string;
    duration_ms?: number;
    auto_dismiss?: boolean;
    action_label?: string;
  };
  selected?: boolean;
}

const FEEDBACK_CONFIG: Record<FeedbackType, {
  icon: React.ElementType;
  bgColor: string;
  borderColor: string;
  iconColor: string;
  label: string;
}> = {
  success: {
    icon: CheckCircle2,
    bgColor: "bg-green-50 dark:bg-green-950/30",
    borderColor: "border-green-400 dark:border-green-400",
    iconColor: "text-green-500 dark:text-green-400",
    label: "Sucesso",
  },
  error: {
    icon: XCircle,
    bgColor: "bg-red-50 dark:bg-red-950/30",
    borderColor: "border-red-400 dark:border-red-400",
    iconColor: "text-red-500 dark:text-red-400",
    label: "Erro",
  },
  info: {
    icon: Info,
    bgColor: "bg-blue-50 dark:bg-blue-950/30",
    borderColor: "border-blue-400 dark:border-blue-400",
    iconColor: "text-blue-500 dark:text-blue-400",
    label: "Informação",
  },
  warning: {
    icon: AlertTriangle,
    bgColor: "bg-amber-50 dark:bg-amber-950/30",
    borderColor: "border-amber-400 dark:border-amber-400",
    iconColor: "text-amber-500 dark:text-amber-400",
    label: "Aviso",
  },
};

export const FeedbackNodeV3 = memo(function FeedbackNodeV3({ data, selected }: FeedbackNodeV3Props) {
  const feedbackType = data.feedback_type || "success";
  const config = FEEDBACK_CONFIG[feedbackType];
  const Icon = config.icon;

  return (
    <div
      className={cn(
        "rounded-xl shadow-sm border-2 p-4 transition-all duration-200 relative w-[220px] group",
        config.bgColor,
        config.borderColor,
        selected && "ring-2 ring-primary ring-offset-2",
        "hover:shadow-lg"
      )}
    >
      {/* Handles */}
      <Handle
        type="target"
        position={Position.Left}
        className={cn(
          "!w-3 !h-3 !border-2 !border-white !rounded-full z-20 !-left-1.5",
          feedbackType === "success" ? "!bg-green-500" : "!bg-red-500"
        )}
      />
      <Handle
        type="source"
        position={Position.Right}
        className={cn(
          "!w-3 !h-3 !border-2 !border-white !rounded-full z-20 !-right-1.5",
          feedbackType === "success" ? "!bg-green-500" : "!bg-red-500"
        )}
      />

      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <div className={cn("p-1.5 rounded-lg", config.bgColor)}>
          <Icon className={cn("w-5 h-5", config.iconColor)} />
        </div>
        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
          {config.label}
        </span>
      </div>

      {/* Title */}
      <h3 className="font-semibold text-sm text-card-foreground leading-tight mb-1">
        {data.title || data.label}
      </h3>

      {/* Message */}
      {(data.message || data.description) && (
        <p className="text-xs text-muted-foreground mb-2 line-clamp-3">
          {data.message || data.description}
        </p>
      )}

      {/* Meta info */}
      <div className="flex items-center gap-2 mt-3 pt-2 border-t border-current/10">
        {data.auto_dismiss && data.duration_ms && (
          <span className="text-[9px] text-muted-foreground">
            Fecha em {data.duration_ms / 1000}s
          </span>
        )}
        {data.action_label && (
          <span className={cn(
            "text-[10px] px-2 py-0.5 rounded font-medium",
            feedbackType === "success"
              ? "bg-green-200 text-green-700"
              : feedbackType === "error"
                ? "bg-red-200 text-red-700"
                : "bg-blue-200 text-blue-700"
          )}>
            {data.action_label}
          </span>
        )}
      </div>
    </div>
  );
});









