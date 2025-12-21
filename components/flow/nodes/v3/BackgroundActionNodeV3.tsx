"use client";

import { memo } from "react";
import { Handle, Position } from "reactflow";
import { Server, Loader2, CheckCircle, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface BackgroundActionNodeV3Props {
  data: {
    label: string;
    title?: string;
    description?: string;
    action_type?: "api_call" | "webhook" | "job" | "notification";
    status?: "pending" | "running" | "completed" | "failed";
    estimated_duration_ms?: number;
    non_blocking?: boolean;
  };
  selected?: boolean;
}

const STATUS_CONFIG: Record<string, { icon: React.ElementType; color: string; label: string }> = {
  pending: { icon: Server, color: "text-slate-400", label: "Pendente" },
  running: { icon: Loader2, color: "text-blue-500 animate-spin", label: "Executando" },
  completed: { icon: CheckCircle, color: "text-green-500", label: "Concluído" },
  failed: { icon: XCircle, color: "text-red-500", label: "Falhou" },
};

const ACTION_TYPES: Record<string, string> = {
  api_call: "Chamada de API",
  webhook: "Webhook",
  job: "Job Assíncrono",
  notification: "Notificação",
};

export const BackgroundActionNodeV3 = memo(function BackgroundActionNodeV3({ data, selected }: BackgroundActionNodeV3Props) {
  const status = data.status || "pending";
  const statusConfig = STATUS_CONFIG[status];
  const StatusIcon = statusConfig.icon;
  const actionType = data.action_type || "api_call";

  return (
    <div
      className={cn(
        "bg-slate-50 rounded-xl shadow-sm border-2 border-slate-400 border-dashed p-4 transition-all duration-200 relative w-[220px] group",
        selected && "ring-2 ring-primary ring-offset-2",
        "hover:shadow-lg"
      )}
    >
      {/* Handles */}
      <Handle
        type="target"
        position={Position.Left}
        className="!w-3 !h-3 !bg-slate-500 !border-2 !border-white !rounded-full z-20 !-left-1.5"
      />
      <Handle
        type="source"
        position={Position.Right}
        id="done"
        className="!w-3 !h-3 !bg-slate-500 !border-2 !border-white !rounded-full z-20 !-right-1.5"
      />

      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-slate-200">
            <Server className="w-4 h-4 text-slate-600" />
          </div>
          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
            Background
          </span>
        </div>
        <StatusIcon className={cn("w-4 h-4", statusConfig.color)} />
      </div>

      {/* Title */}
      <h3 className="font-semibold text-sm text-card-foreground leading-tight mb-1">
        {data.title || data.label}
      </h3>

      {/* Description */}
      {data.description && (
        <p className="text-xs text-muted-foreground mb-2 line-clamp-2">
          {data.description}
        </p>
      )}

      {/* Metadata */}
      <div className="mt-3 pt-3 border-t border-slate-200 space-y-1.5">
        <div className="flex items-center justify-between text-[10px]">
          <span className="text-muted-foreground">Tipo</span>
          <span className="font-medium">{ACTION_TYPES[actionType]}</span>
        </div>
        {data.estimated_duration_ms && (
          <div className="flex items-center justify-between text-[10px]">
            <span className="text-muted-foreground">Duração est.</span>
            <span className="font-medium">{data.estimated_duration_ms}ms</span>
          </div>
        )}
        <div className="flex items-center justify-between text-[10px]">
          <span className="text-muted-foreground">Status</span>
          <span className={cn("font-medium", statusConfig.color.split(" ")[0])}>
            {statusConfig.label}
          </span>
        </div>
      </div>

      {/* Non-blocking badge */}
      {data.non_blocking && (
        <div className="absolute top-2 right-2">
          <span className="text-[8px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-600 font-medium">
            Não-bloqueante
          </span>
        </div>
      )}
    </div>
  );
});







