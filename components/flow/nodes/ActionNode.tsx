import { Handle, Position } from "reactflow";
import { 
    CheckCircle2, 
    AlertCircle, 
    Loader2,
    FileInput,
    Layout,
    Globe,
    Database,
    File,
    Play
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ActionNodeData, ActionCategory, OutputState } from "@/types/flow-nodes";

interface ActionNodeProps {
    data: Omit<ActionNodeData, 'id' | 'type'> & {
        // Compatibilidade com estrutura antiga
        type?: "success" | "error";
    };
}

// Ícones para cada categoria de ação
const CATEGORY_ICONS: Record<ActionCategory, React.ElementType> = {
    form: FileInput,
    ui: Layout,
    api: Globe,
    crud: Database,
    file: File,
};

// Cores para cada categoria
const CATEGORY_COLORS: Record<ActionCategory, string> = {
    form: "text-blue-500",
    ui: "text-purple-500",
    api: "text-orange-500",
    crud: "text-green-500",
    file: "text-yellow-500",
};

// Ícones para outputs
const OUTPUT_ICONS: Record<OutputState, React.ElementType> = {
    success: CheckCircle2,
    error: AlertCircle,
    loading: Loader2,
};

// Cores para outputs
const OUTPUT_COLORS: Record<OutputState, string> = {
    success: "text-green-500",
    error: "text-red-500",
    loading: "text-blue-500 animate-spin",
};

export function ActionNode({ data }: ActionNodeProps) {
    // Suporte a estrutura antiga (type: success/error) e nova (category + outputs)
    const category = data.category || 'ui';
    const outputs = data.outputs || (data.type === 'error' ? ['error'] : ['success']);
    const verb = data.verb || data.label;
    
    const CategoryIcon = CATEGORY_ICONS[category] || Play;
    const categoryColor = CATEGORY_COLORS[category] || "text-muted-foreground";
    
    // Determina o estado principal para exibição (primeiro output ou baseado em type legado)
    const primaryOutput = outputs[0] || 'success';
    const PrimaryOutputIcon = OUTPUT_ICONS[primaryOutput];
    const primaryOutputColor = OUTPUT_COLORS[primaryOutput];

    return (
        <div className="bg-card rounded-xl shadow-sm border border-border p-4 transition-shadow hover:shadow-md relative w-[220px] group">
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

            {/* Header com categoria e status */}
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                        Action
                    </span>
                    <span className={cn("text-[9px] px-1.5 py-0.5 rounded-full bg-muted font-medium capitalize", categoryColor)}>
                        {category}
                    </span>
                </div>
                <PrimaryOutputIcon className={cn("w-3.5 h-3.5", primaryOutputColor)} />
            </div>

            {/* Label principal */}
            <h3 className="font-medium text-sm text-card-foreground leading-tight">
                {data.label}
            </h3>

            {/* Descrição */}
            {data.description && (
                <p className="text-xs text-muted-foreground mt-1">{data.description}</p>
            )}

            {/* Verbo da ação */}
            {verb && verb !== data.label && (
                <div className="mt-2 flex items-center gap-1.5">
                    <CategoryIcon className={cn("w-3 h-3", categoryColor)} />
                    <span className="text-[10px] text-muted-foreground font-medium">
                        {verb}
                    </span>
                </div>
            )}

            {/* Outputs disponíveis */}
            {outputs && outputs.length > 1 && (
                <div className="mt-2 pt-2 border-t border-border/50 flex items-center gap-2">
                    <span className="text-[9px] text-muted-foreground uppercase">Outputs:</span>
                    <div className="flex items-center gap-1">
                        {outputs.map((output) => {
                            const Icon = OUTPUT_ICONS[output];
                            return (
                                <Icon 
                                    key={output} 
                                    className={cn("w-3 h-3", OUTPUT_COLORS[output])} 
                                    title={output}
                                />
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}
