import { Handle, Position } from "reactflow";
import { CircleStop, CheckCircle, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { EndNodeData } from "@/types/flow-nodes";

interface EndNodeProps {
    data: Omit<EndNodeData, 'id' | 'type'>;
}

export function EndNode({ data }: EndNodeProps) {
    const status = data.status || 'success';
    const isSuccess = status === 'success';
    const label = data.label || (isSuccess ? 'Fim' : 'Erro');

    return (
        <div className={cn(
            "rounded-full shadow-sm border-2 p-4 transition-all relative w-[120px] h-[120px] flex flex-col items-center justify-center group",
            isSuccess 
                ? "bg-green-50 border-green-300 dark:bg-green-950/30 dark:border-green-800" 
                : "bg-red-50 border-red-300 dark:bg-red-950/30 dark:border-red-800"
        )}>
            {/* Handles - Apenas entrada, é um nó terminal */}
            <Handle
                type="target"
                position={Position.Left}
                className={cn(
                    "!w-3 !h-3 !border !rounded-full z-20 !-left-1.5",
                    isSuccess 
                        ? "!bg-green-400 !border-green-500" 
                        : "!bg-red-400 !border-red-500"
                )}
            />
            <Handle
                type="target"
                position={Position.Top}
                id="top"
                className={cn(
                    "!w-3 !h-3 !border !rounded-full opacity-0 group-hover:opacity-100 transition-opacity z-20 !-top-1.5",
                    isSuccess 
                        ? "!bg-green-400 !border-green-500" 
                        : "!bg-red-400 !border-red-500"
                )}
            />

            {/* Ícone central */}
            {isSuccess ? (
                <CheckCircle className="w-8 h-8 text-green-500 mb-1" />
            ) : (
                <XCircle className="w-8 h-8 text-red-500 mb-1" />
            )}

            {/* Label do tipo */}
            <span className={cn(
                "text-[10px] font-semibold uppercase tracking-wider",
                isSuccess ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
            )}>
                End
            </span>

            {/* Label customizado */}
            <span className={cn(
                "text-xs font-medium mt-0.5 text-center leading-tight",
                isSuccess ? "text-green-700 dark:text-green-300" : "text-red-700 dark:text-red-300"
            )}>
                {label}
            </span>
        </div>
    );
}
















