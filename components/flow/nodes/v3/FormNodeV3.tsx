"use client";

import { memo, useState } from "react";
import { Handle, Position } from "reactflow";
import {
  FileInput,
  ChevronDown,
  ChevronRight,
  AlertCircle,
  CheckCircle2,
  Type,
  Mail,
  Lock,
  Calendar,
  Hash,
  List,
  ToggleLeft,
  FileText
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ImpactLevel, SubNodeType } from "@/lib/agents/v3/types";
import { ReuseIndicator } from "./ReuseIndicator";
import { CollapsibleSubnodes } from "./CollapsibleSubnodes";

interface FormField {
  field_name: string;
  field_type: string;
  label: string;
  required: boolean;
  validation_rules?: string[];
  placeholder?: string;
}

interface SubNode {
  subnode_id: string;
  subnode_type: SubNodeType;
  label: string;
  description?: string;
  required?: boolean;
  validation_rules?: string[];
  field_type?: string;
  order_index: number;
  children?: SubNode[];
}

interface ReuseInfo {
  is_reused: boolean;
  reuse_type?: "reference" | "clone";
  source_flow_id?: string;
  source_flow_name?: string;
  referenced_in_flows?: { flow_id: string; flow_name: string }[];
}

interface FormNodeV3Props {
  data: {
    label: string;
    title?: string;
    description?: string;
    inputs?: FormField[];
    impact_level?: ImpactLevel;
    role_scope?: string;
    group_label?: string;
    collapsed?: boolean;
    validation_count?: number;
    // V3.1 fields
    subnodes?: SubNode[];
    reuse_info?: ReuseInfo;
    children?: SubNode[];
    actions?: { action_id: string; label: string; action_type: string }[];
  };
  selected?: boolean;
}

const IMPACT_COLORS: Record<ImpactLevel, string> = {
  low: "border-slate-300 dark:border-slate-400",
  medium: "border-blue-400 dark:border-blue-400",
  high: "border-orange-500 dark:border-orange-400",
};

const IMPACT_BADGES: Record<ImpactLevel, { label: string; color: string }> = {
  low: { label: "Low", color: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300" },
  medium: { label: "Medium", color: "bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-300" },
  high: { label: "High", color: "bg-orange-100 text-orange-600 dark:bg-orange-900/50 dark:text-orange-300" },
};

// Field type icons
const FIELD_ICONS: Record<string, React.ElementType> = {
  text: Type,
  email: Mail,
  password: Lock,
  date: Calendar,
  datetime: Calendar,
  number: Hash,
  tel: Hash,
  select: List,
  checkbox: ToggleLeft,
  radio: ToggleLeft,
  textarea: FileText,
  file: FileText,
};

export const FormNodeV3 = memo(function FormNodeV3({ data, selected }: FormNodeV3Props) {
  const [isFieldsCollapsed, setIsFieldsCollapsed] = useState(data.collapsed ?? true);
  const impactLevel = data.impact_level || "medium";
  const impactBadge = IMPACT_BADGES[impactLevel];
  const fieldsCount = data.inputs?.length || 0;
  const requiredCount = data.inputs?.filter(f => f.required).length || 0;
  const subnodes = data.subnodes || data.children || [];
  const validationCount = data.validation_count ||
    data.inputs?.reduce((acc, f) => acc + (f.validation_rules?.length || 0), 0) || 0;

  return (
    <div
      className={cn(
        "bg-card rounded-xl shadow-md border-2 transition-all duration-200 relative w-[280px] group",
        IMPACT_COLORS[impactLevel],
        selected && "ring-2 ring-primary ring-offset-2",
        "hover:shadow-xl hover:scale-[1.02]"
      )}
    >
      {/* Reuse Indicator */}
      {data.reuse_info?.is_reused && (
        <ReuseIndicator reuseInfo={data.reuse_info} />
      )}

      {/* Handles - Improved visibility */}
      <Handle
        type="target"
        position={Position.Left}
        className="!w-4 !h-4 !bg-blue-500 !border-2 !border-white !rounded-full z-20 !-left-2 shadow-md"
      />
      <Handle
        type="source"
        position={Position.Right}
        className="!w-4 !h-4 !bg-green-500 !border-2 !border-white !rounded-full z-20 !-right-2 shadow-md"
      />

      {/* Header with gradient */}
      <div className="px-4 pt-3 pb-2 bg-gradient-to-r from-blue-50 to-blue-100/50 dark:from-blue-950/30 dark:to-blue-900/20 rounded-t-xl border-b border-blue-200/50 dark:border-blue-800/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-blue-500 shadow-sm">
              <FileInput className="w-4 h-4 text-white" />
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">
                Form
              </span>
              {data.role_scope && (
                <span className="text-[8px] text-muted-foreground">
                  @{data.role_scope}
                </span>
              )}
            </div>
          </div>
          <span className={cn("text-[9px] px-2 py-0.5 rounded-full font-semibold", impactBadge.color)}>
            {impactBadge.label}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        {/* Title */}
        <h3 className="font-bold text-sm text-card-foreground leading-tight mb-1">
          {data.title || data.label}
        </h3>

        {/* Description */}
        {data.description && (
          <p className="text-xs text-muted-foreground mb-3 line-clamp-2">
            {data.description}
          </p>
        )}

        {/* Group Label */}
        {data.group_label && (
          <div className="mb-3">
            <span className="text-[9px] px-2 py-0.5 rounded-full bg-purple-100 text-purple-600 dark:bg-purple-900/50 dark:text-purple-300 font-medium">
              📁 {data.group_label}
            </span>
          </div>
        )}

        {/* Fields Stats Bar */}
        {fieldsCount > 0 && (
          <div className="flex items-center justify-between text-[10px] py-2 px-2.5 rounded-lg bg-muted/50 mb-2">
            <span className="font-medium text-muted-foreground">
              {fieldsCount} {fieldsCount === 1 ? 'field' : 'fields'}
            </span>
            <div className="flex items-center gap-2">
              {requiredCount > 0 && (
                <span className="text-orange-500 font-semibold">
                  {requiredCount} required
                </span>
              )}
              {validationCount > 0 && (
                <span className="flex items-center gap-0.5 text-amber-600">
                  <AlertCircle className="w-3 h-3" />
                  {validationCount}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Fields Preview - Collapsible */}
        {fieldsCount > 0 && (
          <div className="border-t border-border/50 pt-2">
            <button
              onClick={() => setIsFieldsCollapsed(!isFieldsCollapsed)}
              className="flex items-center gap-1 text-[10px] text-muted-foreground mb-2 w-full hover:text-foreground transition-colors"
            >
              {isFieldsCollapsed ? (
                <ChevronRight className="w-3 h-3" />
              ) : (
                <ChevronDown className="w-3 h-3" />
              )}
              <span className="font-medium">Input Fields</span>
            </button>

            {!isFieldsCollapsed && data.inputs && (
              <div className="space-y-1">
                {data.inputs.slice(0, 4).map((field, idx) => {
                  const FieldIcon = FIELD_ICONS[field.field_type] || Type;
                  return (
                    <div
                      key={idx}
                      className="flex items-center gap-2 text-[10px] py-1.5 px-2 rounded-md bg-muted/30 hover:bg-muted/50 transition-colors"
                    >
                      <FieldIcon className="w-3 h-3 text-muted-foreground shrink-0" />
                      <span className="font-medium truncate flex-1">{field.label}</span>
                      <span className="text-[8px] text-muted-foreground px-1 py-0.5 rounded bg-background">
                        {field.field_type}
                      </span>
                      {field.required && (
                        <span className="text-orange-500 font-bold">*</span>
                      )}
                    </div>
                  );
                })}
                {data.inputs.length > 4 && (
                  <div className="text-[10px] text-muted-foreground text-center py-1">
                    +{data.inputs.length - 4} more fields
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Subnodes */}
        {subnodes.length > 0 && (
          <CollapsibleSubnodes
            subnodes={subnodes}
            defaultExpanded={false}
            maxVisible={3}
          />
        )}

        {/* Actions Preview */}
        {data.actions && data.actions.length > 0 && (
          <div className="mt-3 pt-2 border-t border-border/30">
            <div className="flex items-center gap-1.5 flex-wrap">
              {data.actions.slice(0, 2).map((action, idx) => (
                <span
                  key={idx}
                  className={cn(
                    "text-[9px] px-2 py-1 rounded-md font-medium",
                    action.action_type === "primary"
                      ? "bg-blue-500 text-white"
                      : action.action_type === "danger"
                        ? "bg-red-100 text-red-600 dark:bg-red-900/50 dark:text-red-300"
                        : "bg-muted text-muted-foreground"
                  )}
                >
                  {action.label}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Footer with output indicator */}
      <div className="px-4 py-2 bg-muted/30 rounded-b-xl border-t border-border/30 flex items-center justify-between">
        <div className="flex items-center gap-1 text-[9px] text-muted-foreground">
          <CheckCircle2 className="w-3 h-3 text-green-500" />
          <span>Submit</span>
        </div>
        <div className="text-[8px] text-muted-foreground">
          → Next step
        </div>
      </div>
    </div>
  );
});

