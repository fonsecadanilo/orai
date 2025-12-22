import { Handle, Position } from "reactflow";
import { Workflow, ExternalLink } from "lucide-react";
import type { SubflowNodeData } from "@/types/flow-nodes";

interface SubflowNodeProps {
    data: Omit<SubflowNodeData, 'id' | 'type'> & {
        targetFlowName?: string; // Nome do fluxo para exibição
    };
}

export function SubflowNode({ data }: SubflowNodeProps) {
    const flowName = data.targetFlowName || data.label || "Subfluxo";
    const hasTarget = !!data.targetFlowId;

    return (
        <div className="bg-card rounded-xl shadow-sm border-2 border-dashed border-indigo-300 dark:border-indigo-700 p-4 transition-shadow hover:shadow-md relative w-[200px] group hover:border-indigo-400 dark:hover:border-indigo-600">
            {/* Handles - All directions for flexible connections */}
            <Handle
                type="target"
                position={Position.Left}
                className="!w-3 !h-3 !bg-indigo-400 !border !border-indigo-500 !rounded-full z-20 !-left-1.5"
            />
            <Handle
                type="source"
                position={Position.Right}
                className="!w-3 !h-3 !bg-card !border !border-indigo-300 !rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:!bg-indigo-400 hover:!border-indigo-500 cursor-crosshair z-20 !-right-1.5"
            />
            <Handle
                type="target"
                position={Position.Top}
                id="top"
                className="!w-3 !h-3 !bg-indigo-400 !border !border-indigo-500 !rounded-full opacity-0 group-hover:opacity-100 transition-opacity z-20 !-top-1.5"
            />
            <Handle
                type="source"
                position={Position.Bottom}
                id="bottom"
                className="!w-3 !h-3 !bg-card !border !border-indigo-300 !rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:!bg-indigo-400 hover:!border-indigo-500 cursor-crosshair z-20 !-bottom-1.5"
            />

            {/* Header */}
            <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-semibold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
                    Subflow
                </span>
                <Workflow className="text-indigo-500/60 w-3.5 h-3.5" />
            </div>

            {/* Nome do fluxo referenciado */}
            <div className="flex items-center gap-1.5">
                <h3 className="font-medium text-sm text-card-foreground leading-tight flex-1 truncate">
                    {flowName}
                </h3>
                {hasTarget && (
                    <ExternalLink className="w-3 h-3 text-indigo-400 flex-shrink-0" />
                )}
            </div>

            {/* Indicador de fluxo referenciado */}
            {hasTarget ? (
                <div className="mt-2 px-2 py-1 bg-indigo-50 dark:bg-indigo-950/30 rounded text-[10px] text-indigo-600 dark:text-indigo-400 truncate">
                    → {data.targetFlowId}
                </div>
            ) : (
                <div className="mt-2 px-2 py-1 bg-amber-50 dark:bg-amber-950/30 rounded text-[10px] text-amber-600 dark:text-amber-400">
                    Nenhum fluxo vinculado
                </div>
            )}
        </div>
    );
}
















