import { Handle, Position } from "reactflow";
import { 
    FormInput, 
    ListChecks, 
    Type, 
    Mail, 
    Hash, 
    Calendar, 
    ChevronDown, 
    ToggleLeft,
    AlignLeft
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { FieldGroupNodeData, FieldType, FieldDefinition } from "@/types/flow-nodes";

interface FieldGroupNodeProps {
    data: Omit<FieldGroupNodeData, 'id' | 'type'>;
}

// Ícones para cada tipo de campo
const FIELD_TYPE_ICONS: Record<FieldType, React.ElementType> = {
    text: Type,
    email: Mail,
    number: Hash,
    date: Calendar,
    select: ChevronDown,
    boolean: ToggleLeft,
    textarea: AlignLeft,
};

// Cores para cada tipo de campo
const FIELD_TYPE_COLORS: Record<FieldType, string> = {
    text: "text-slate-500",
    email: "text-blue-500",
    number: "text-emerald-500",
    date: "text-orange-500",
    select: "text-purple-500",
    boolean: "text-pink-500",
    textarea: "text-cyan-500",
};

function FieldItem({ field }: { field: FieldDefinition }) {
    const Icon = FIELD_TYPE_ICONS[field.type];
    const color = FIELD_TYPE_COLORS[field.type];

    return (
        <div className="flex items-center gap-2 px-2 py-1.5 bg-muted/50 rounded">
            <Icon className={cn("w-3 h-3 flex-shrink-0", color)} />
            <span className="text-[11px] text-card-foreground truncate flex-1">
                {field.label}
            </span>
            {field.required && (
                <span className="text-red-500 text-[10px]">*</span>
            )}
        </div>
    );
}

export function FieldGroupNode({ data }: FieldGroupNodeProps) {
    const isStepByStep = data.mode === 'step_by_step';
    const fieldsToShow = data.fields?.slice(0, 4) || [];
    const hasMoreFields = (data.fields?.length || 0) > 4;

    return (
        <div className="bg-card rounded-xl shadow-sm border border-border p-4 transition-shadow hover:shadow-md relative w-[240px] group">
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

            {/* Header */}
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                        Fields
                    </span>
                    <span className={cn(
                        "text-[9px] px-1.5 py-0.5 rounded-full font-medium",
                        isStepByStep 
                            ? "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400" 
                            : "bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-400"
                    )}>
                        {isStepByStep ? 'Step by Step' : 'All in One'}
                    </span>
                </div>
                {isStepByStep ? (
                    <ListChecks className="text-amber-500/60 w-3.5 h-3.5" />
                ) : (
                    <FormInput className="text-blue-500/60 w-3.5 h-3.5" />
                )}
            </div>

            {/* Label */}
            <h3 className="font-medium text-sm text-card-foreground leading-tight mb-2">
                {data.label}
            </h3>

            {/* Lista de campos */}
            {fieldsToShow.length > 0 ? (
                <div className="space-y-1.5">
                    {fieldsToShow.map((field) => (
                        <FieldItem key={field.id} field={field} />
                    ))}
                    {hasMoreFields && (
                        <div className="text-[10px] text-muted-foreground text-center py-1">
                            + {(data.fields?.length || 0) - 4} mais campos
                        </div>
                    )}
                </div>
            ) : (
                <div className="px-2 py-3 bg-muted/30 rounded text-[11px] text-muted-foreground text-center">
                    Nenhum campo definido
                </div>
            )}

            {/* Footer com contagem */}
            <div className="mt-2 pt-2 border-t border-border/50 flex items-center justify-between">
                <span className="text-[10px] text-muted-foreground">
                    {data.fields?.length || 0} campo(s)
                </span>
                <span className="text-[10px] text-muted-foreground">
                    {data.fields?.filter(f => f.required).length || 0} obrigatório(s)
                </span>
            </div>
        </div>
    );
}
















