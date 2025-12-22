"use client";

import { memo, useState } from "react";
import { 
  ChevronDown, 
  ChevronRight, 
  Layers,
  FormInput,
  ToggleLeft,
  ListOrdered,
  CheckSquare,
  Type,
  Calendar,
  Upload,
  Hash,
  Mail,
  Lock,
  FileText,
  Settings,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { SubNodeType } from "@/lib/agents/v3/types";

interface SubNode {
  subnode_id: string;
  subnode_type: SubNodeType;
  label: string;
  description?: string;
  required?: boolean;
  validation_rules?: string[];
  field_type?: string;
  content?: Record<string, unknown>;
  order_index: number;
  children?: SubNode[];
}

interface CollapsibleSubnodesProps {
  subnodes: SubNode[];
  defaultExpanded?: boolean;
  maxVisible?: number;
  onSubnodeClick?: (subnode: SubNode) => void;
  className?: string;
}

const SUBNODE_ICONS: Record<SubNodeType, React.ElementType> = {
  input_field: FormInput,
  modal_step: Layers,
  field_group: ListOrdered,
  validation_rule: AlertCircle,
  interactive_component: ToggleLeft,
  option_choice: CheckSquare,
  button: Settings,
  condition_branch: Layers,
};

const FIELD_TYPE_ICONS: Record<string, React.ElementType> = {
  text: Type,
  email: Mail,
  password: Lock,
  number: Hash,
  date: Calendar,
  file: Upload,
  textarea: FileText,
  checkbox: CheckSquare,
  select: ListOrdered,
  radio: CheckSquare,
};

interface SubnodeItemProps {
  subnode: SubNode;
  depth?: number;
  onSubnodeClick?: (subnode: SubNode) => void;
}

const SubnodeItem = memo(function SubnodeItem({ 
  subnode, 
  depth = 0,
  onSubnodeClick,
}: SubnodeItemProps) {
  const [isExpanded, setIsExpanded] = useState(depth === 0);
  const hasChildren = subnode.children && subnode.children.length > 0;
  
  const Icon = subnode.field_type 
    ? FIELD_TYPE_ICONS[subnode.field_type] || FormInput
    : SUBNODE_ICONS[subnode.subnode_type] || FormInput;

  return (
    <div className="w-full">
      {/* Subnode Header */}
      <div
        onClick={() => hasChildren ? setIsExpanded(!isExpanded) : onSubnodeClick?.(subnode)}
        className={cn(
          "flex items-center gap-2 py-1.5 px-2 rounded cursor-pointer transition-colors",
          "hover:bg-muted/50",
          depth > 0 && "ml-3"
        )}
        style={{ paddingLeft: depth * 8 + 8 }}
      >
        {/* Expand/Collapse */}
        {hasChildren && (
          <button 
            onClick={(e) => {
              e.stopPropagation();
              setIsExpanded(!isExpanded);
            }}
            className="p-0.5 hover:bg-muted rounded"
          >
            {isExpanded ? (
              <ChevronDown className="w-3 h-3 text-muted-foreground" />
            ) : (
              <ChevronRight className="w-3 h-3 text-muted-foreground" />
            )}
          </button>
        )}

        {/* Icon */}
        <Icon className="w-3.5 h-3.5 text-muted-foreground shrink-0" />

        {/* Label */}
        <span className="text-[11px] font-medium text-card-foreground truncate flex-1">
          {subnode.label}
        </span>

        {/* Required Indicator */}
        {subnode.required && (
          <span className="text-[9px] text-orange-500 font-bold">*</span>
        )}

        {/* Validation Badge */}
        {subnode.validation_rules && subnode.validation_rules.length > 0 && (
          <span className="text-[8px] px-1 py-0.5 bg-blue-100 text-blue-600 rounded">
            {subnode.validation_rules.length} regras
          </span>
        )}

        {/* Type Badge */}
        {subnode.field_type && (
          <span className="text-[8px] px-1 py-0.5 bg-muted text-muted-foreground rounded">
            {subnode.field_type}
          </span>
        )}
      </div>

      {/* Description */}
      {subnode.description && isExpanded && (
        <p 
          className="text-[9px] text-muted-foreground px-2 mb-1"
          style={{ marginLeft: (depth + 1) * 8 + 8 }}
        >
          {subnode.description}
        </p>
      )}

      {/* Children */}
      {hasChildren && isExpanded && (
        <div className="border-l border-border/50 ml-4">
          {subnode.children!.map((child) => (
            <SubnodeItem
              key={child.subnode_id}
              subnode={child}
              depth={depth + 1}
              onSubnodeClick={onSubnodeClick}
            />
          ))}
        </div>
      )}
    </div>
  );
});

export const CollapsibleSubnodes = memo(function CollapsibleSubnodes({
  subnodes,
  defaultExpanded = false,
  maxVisible = 5,
  onSubnodeClick,
  className,
}: CollapsibleSubnodesProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [showAll, setShowAll] = useState(false);

  if (!subnodes || subnodes.length === 0) {
    return null;
  }

  const sortedSubnodes = [...subnodes].sort((a, b) => a.order_index - b.order_index);
  const visibleSubnodes = showAll ? sortedSubnodes : sortedSubnodes.slice(0, maxVisible);
  const hiddenCount = sortedSubnodes.length - maxVisible;

  return (
    <div className={cn("border-t border-border/50 pt-2 mt-2", className)}>
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center justify-between w-full px-2 py-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
      >
        <span className="flex items-center gap-1.5">
          <Layers className="w-3 h-3" />
          <span className="font-medium">{subnodes.length} subnós</span>
        </span>
        {isExpanded ? (
          <ChevronDown className="w-3 h-3" />
        ) : (
          <ChevronRight className="w-3 h-3" />
        )}
      </button>

      {/* Content */}
      {isExpanded && (
        <div className="mt-1 space-y-0.5 bg-muted/20 rounded-lg py-1">
          {visibleSubnodes.map((subnode) => (
            <SubnodeItem
              key={subnode.subnode_id}
              subnode={subnode}
              onSubnodeClick={onSubnodeClick}
            />
          ))}

          {/* Show More */}
          {hiddenCount > 0 && !showAll && (
            <button
              onClick={() => setShowAll(true)}
              className="w-full py-1.5 text-[10px] text-primary hover:underline"
            >
              +{hiddenCount} mais subnós
            </button>
          )}

          {/* Show Less */}
          {showAll && hiddenCount > 0 && (
            <button
              onClick={() => setShowAll(false)}
              className="w-full py-1.5 text-[10px] text-muted-foreground hover:text-foreground"
            >
              Mostrar menos
            </button>
          )}
        </div>
      )}
    </div>
  );
});

// Componente de preview compacto para subnodes
export const SubnodesPreview = memo(function SubnodesPreview({
  subnodes,
  maxVisible = 3,
  className,
}: {
  subnodes?: SubNode[];
  maxVisible?: number;
  className?: string;
}) {
  if (!subnodes || subnodes.length === 0) {
    return null;
  }

  const visibleSubnodes = subnodes.slice(0, maxVisible);
  const hiddenCount = subnodes.length - maxVisible;

  return (
    <div className={cn("flex items-center gap-1 flex-wrap", className)}>
      {visibleSubnodes.map((subnode, idx) => {
        const Icon = subnode.field_type 
          ? FIELD_TYPE_ICONS[subnode.field_type] || FormInput
          : SUBNODE_ICONS[subnode.subnode_type] || FormInput;

        return (
          <div
            key={subnode.subnode_id || idx}
            className="flex items-center gap-1 px-1.5 py-0.5 bg-muted/50 rounded text-[9px] text-muted-foreground"
            title={subnode.label}
          >
            <Icon className="w-2.5 h-2.5" />
            <span className="truncate max-w-16">{subnode.label}</span>
            {subnode.required && <span className="text-orange-500">*</span>}
          </div>
        );
      })}
      {hiddenCount > 0 && (
        <span className="text-[9px] text-muted-foreground">
          +{hiddenCount}
        </span>
      )}
    </div>
  );
});









