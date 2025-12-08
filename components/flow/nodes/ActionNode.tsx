import { Handle, Position } from "reactflow";
import { CheckCircle2, AlertCircle } from "lucide-react";

export function ActionNode({ data }: { data: { label: string; description?: string; type: "success" | "error" } }) {
    const isSuccess = data.type === "success";

    return (
        <div className="bg-card rounded-xl shadow-sm border border-border p-4 transition-shadow hover:shadow-md relative w-[200px] group">
            {/* Handles - All directions for flexible connections */}
            <Handle
                type="target"
                position={Position.Left}
                className="!w-3 !h-3 !bg-border !border !border-border !rounded-full z-20 !-left-1.5"
            />
            <Handle
                type="source"
                position={Position.Right}
                className="!w-3 !h-3 !bg-card !border !border-border !rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:!bg-primary hover:!border-primary cursor-crosshair z-20 !-right-1.5"
            />
            <Handle
                type="target"
                position={Position.Top}
                id="top"
                className="!w-3 !h-3 !bg-border !border !border-border !rounded-full opacity-0 group-hover:opacity-100 transition-opacity z-20 !-top-1.5"
            />
            <Handle
                type="source"
                position={Position.Bottom}
                id="bottom"
                className="!w-3 !h-3 !bg-card !border !border-border !rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:!bg-primary hover:!border-primary cursor-crosshair z-20 !-bottom-1.5"
            />

            <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                    Action
                </span>
                {isSuccess ? (
                    <CheckCircle2 className="text-green-500 w-3.5 h-3.5" />
                ) : (
                    <AlertCircle className="text-red-500 w-3.5 h-3.5" />
                )}
            </div>
            <h3 className="font-medium text-sm text-card-foreground leading-tight">
                {data.label}
            </h3>
            {data.description && (
                <p className="text-xs text-muted-foreground mt-1">{data.description}</p>
            )}
        </div>
    );
}
