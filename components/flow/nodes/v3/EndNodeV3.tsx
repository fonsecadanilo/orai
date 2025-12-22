"use client";

import { memo } from "react";
import { Handle, Position } from "reactflow";
import { CheckCircle2, XOctagon, Circle, Flag } from "lucide-react";
import { cn } from "@/lib/utils";

type EndType = "success" | "error" | "neutral";

interface EndNodeV3Props {
  data: {
    label: string;
    title?: string;
    description?: string;
    end_type?: EndType;
    next_action?: string;
    redirect_url?: string;
  };
  selected?: boolean;
}

const END_CONFIG: Record<EndType, {
  icon: React.ElementType;
  bgColor: string;
  borderColor: string;
  iconColor: string;
  label: string;
}> = {
  success: {
    icon: CheckCircle2,
    bgColor: "bg-green-50",
    borderColor: "border-green-500",
    iconColor: "text-green-600",
    label: "Sucesso",
  },
  error: {
    icon: XOctagon,
    bgColor: "bg-red-50",
    borderColor: "border-red-500",
    iconColor: "text-red-600",
    label: "Erro",
  },
  neutral: {
    icon: Circle,
    bgColor: "bg-slate-50",
    borderColor: "border-slate-400",
    iconColor: "text-slate-500",
    label: "Neutro",
  },
};

export const EndNodeV3 = memo(function EndNodeV3({ data, selected }: EndNodeV3Props) {
  const endType = data.end_type || "success";
  const config = END_CONFIG[endType];
  const Icon = config.icon;

  return (
    <div
      className={cn(
        "rounded-xl shadow-sm border-2 p-4 transition-all duration-200 relative w-[180px] group",
        config.bgColor,
        config.borderColor,
        selected && "ring-2 ring-primary ring-offset-2",
        "hover:shadow-lg"
      )}
    >
      {/* Only target handle - end nodes don't have outputs */}
      <Handle
        type="target"
        position={Position.Left}
        className={cn(
          "!w-3 !h-3 !border-2 !border-white !rounded-full z-20 !-left-1.5",
          endType === "success" ? "!bg-green-500" : endType === "error" ? "!bg-red-500" : "!bg-slate-500"
        )}
      />

      {/* Header with Icon */}
      <div className="flex flex-col items-center text-center">
        <div className={cn("p-3 rounded-full mb-2", config.bgColor)}>
          <Icon className={cn("w-8 h-8", config.iconColor)} />
        </div>

        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
          Fim - {config.label}
        </span>

        {/* Title */}
        <h3 className="font-semibold text-sm text-card-foreground leading-tight">
          {data.title || data.label}
        </h3>

        {/* Description */}
        {data.description && (
          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
            {data.description}
          </p>
        )}

        {/* Next Action */}
        {data.next_action && (
          <div className="mt-3 pt-2 border-t border-current/10 w-full">
            <div className="flex items-center justify-center gap-1 text-[10px] text-muted-foreground">
              <Flag className="w-3 h-3" />
              <span>{data.next_action}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
});









