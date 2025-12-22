import { Handle, Position } from "reactflow";
import { GitBranch, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ConditionNodeData } from "@/types/flow-nodes";

interface ConditionNodeProps {
    data: Omit<ConditionNodeData, 'id' | 'type'> & {
        // Compatibilidade com estrutura antiga (LogicNode)
        label?: string;
        tag?: string;
    };
}

export function ConditionNode({ data }: ConditionNodeProps) {
    // Suporte a estrutura antiga (label + tag) e nova (expression + paths)
    const expression = data.expression || data.label || "Condição";
    const hasLabel = data.label && data.label !== data.expression;
    const hasPaths = data.paths && (data.paths.yes || data.paths.no);

    return (
        <div className="bg-card rounded-xl shadow-xl border border-primary p-4 relative ring-4 ring-border transition-all transform scale-[1.02] w-[220px] group">
            {/* Handles - All directions for flexible connections */}
            <Handle
                type="target"
                position={Position.Left}
                className="!w-3 !h-3 !bg-primary !border !border-primary !rounded-full z-20 !-left-1.5"
            />
            
            {/* Handle de saída para "Sim" (direita superior) */}
            <Handle
                type="source"
                position={Position.Right}
                id="yes"
                className="!w-3 !h-3 !bg-green-500 !border !border-green-600 !rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-crosshair z-20 !-right-1.5 !top-[35%]"
                title="Sim"
            />
            
            {/* Handle de saída para "Não" (direita inferior) */}
            <Handle
                type="source"
                position={Position.Right}
                id="no"
                className="!w-3 !h-3 !bg-red-500 !border !border-red-600 !rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-crosshair z-20 !-right-1.5 !top-[65%]"
                title="Não"
            />
            
            <Handle
                type="target"
                position={Position.Top}
                id="top"
                className="!w-3 !h-3 !bg-primary !border !border-primary !rounded-full opacity-0 group-hover:opacity-100 transition-opacity z-20 !-top-1.5"
            />
            <Handle
                type="source"
                position={Position.Bottom}
                id="bottom"
                className="!w-3 !h-3 !bg-card !border !border-border !rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:!bg-primary hover:!border-primary cursor-crosshair z-20 !-bottom-1.5"
            />

            {/* Header */}
            <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                    Condition
                </span>
                <GitBranch className="text-primary/70 w-3.5 h-3.5" />
            </div>

            {/* Label (se diferente da expression) */}
            {hasLabel && (
                <h3 className="font-medium text-sm text-card-foreground leading-tight">
                    {data.label}
                </h3>
            )}

            {/* Expression - A condição em si */}
            <div className={cn(
                "px-2.5 py-1.5 rounded bg-muted border border-border",
                hasLabel ? "mt-2" : ""
            )}>
                <span className="text-xs text-card-foreground font-medium">
                    {expression}
                </span>
            </div>

            {/* Indicadores de caminho Yes/No */}
            <div className="mt-3 flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 text-green-600">
                    <Check className="w-3 h-3" />
                    <span className="text-[10px] font-medium">Sim</span>
                </div>
                <div className="flex items-center gap-1.5 text-red-500">
                    <X className="w-3 h-3" />
                    <span className="text-[10px] font-medium">Não</span>
                </div>
            </div>

            {/* Tag de compatibilidade (estrutura antiga) */}
            {data.tag && !hasPaths && (
                <div className="mt-3 flex gap-2">
                    <span className="inline-flex items-center px-2 py-1 rounded bg-muted border border-border text-[10px] text-muted-foreground">
                        {data.tag}
                    </span>
                </div>
            )}
        </div>
    );
}

// Exportar também como LogicNode para compatibilidade
export { ConditionNode as LogicNode };
















