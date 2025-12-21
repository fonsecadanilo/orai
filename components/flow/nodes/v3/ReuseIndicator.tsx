"use client";

import { memo, useState } from "react";
import { 
  Link2, 
  Copy, 
  ExternalLink, 
  GitFork, 
  FileSymlink,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ReuseInfo {
  is_reused: boolean;
  reuse_type?: "reference" | "clone";
  source_flow_id?: string;
  source_flow_name?: string;
  primary_flow_id?: string;
  referenced_in_flows?: { flow_id: string; flow_name: string }[];
  subpages?: string[];
  last_synced_at?: string;
}

interface ReuseIndicatorProps {
  reuseInfo?: ReuseInfo;
  onNavigateToSource?: () => void;
  onViewReferences?: () => void;
  className?: string;
}

export const ReuseIndicator = memo(function ReuseIndicator({
  reuseInfo,
  onNavigateToSource,
  onViewReferences,
  className,
}: ReuseIndicatorProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!reuseInfo?.is_reused && (!reuseInfo?.referenced_in_flows?.length)) {
    return null;
  }

  const isReference = reuseInfo.reuse_type === "reference";
  const isClone = reuseInfo.reuse_type === "clone";
  const hasReferences = reuseInfo.referenced_in_flows && reuseInfo.referenced_in_flows.length > 0;

  return (
    <div
      className={cn(
        "absolute -top-2 -right-2 z-30",
        className
      )}
    >
      {/* Badge Principal */}
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        className={cn(
          "flex items-center gap-1 px-2 py-1 rounded-full text-[9px] font-semibold cursor-pointer transition-all shadow-md border",
          isReference && "bg-blue-500 text-white border-blue-600",
          isClone && "bg-purple-500 text-white border-purple-600",
          hasReferences && !reuseInfo.is_reused && "bg-green-500 text-white border-green-600",
          "hover:scale-105"
        )}
      >
        {isReference && (
          <>
            <Link2 className="w-3 h-3" />
            <span>Referência</span>
          </>
        )}
        {isClone && (
          <>
            <Copy className="w-3 h-3" />
            <span>Clone</span>
          </>
        )}
        {hasReferences && !reuseInfo.is_reused && (
          <>
            <GitFork className="w-3 h-3" />
            <span>{reuseInfo.referenced_in_flows!.length}x</span>
          </>
        )}
        {isExpanded ? (
          <ChevronUp className="w-2.5 h-2.5" />
        ) : (
          <ChevronDown className="w-2.5 h-2.5" />
        )}
      </div>

      {/* Expanded Info */}
      {isExpanded && (
        <div className="absolute top-full right-0 mt-1 w-52 bg-popover border border-border rounded-lg shadow-xl p-3 animate-in fade-in slide-in-from-top-1 duration-200">
          <div className="text-[10px] font-semibold text-popover-foreground mb-2">
            {isReference ? "Nó Referenciado" : isClone ? "Nó Clonado" : "Usado em Outros Fluxos"}
          </div>

          {/* Source Info */}
          {reuseInfo.source_flow_name && (
            <div className="mb-2 pb-2 border-b border-border/50">
              <div className="text-[9px] text-muted-foreground mb-1">Origem:</div>
              <button
                onClick={onNavigateToSource}
                className="flex items-center gap-1.5 text-[10px] text-primary hover:underline"
              >
                <FileSymlink className="w-3 h-3" />
                {reuseInfo.source_flow_name}
                <ExternalLink className="w-2.5 h-2.5" />
              </button>
            </div>
          )}

          {/* Referenced In */}
          {hasReferences && (
            <div className="mb-2">
              <div className="text-[9px] text-muted-foreground mb-1">
                Usado em {reuseInfo.referenced_in_flows!.length} fluxo(s):
              </div>
              <div className="space-y-1 max-h-24 overflow-y-auto">
                {reuseInfo.referenced_in_flows!.slice(0, 5).map((ref, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-1.5 text-[10px] text-popover-foreground bg-muted/50 rounded px-2 py-1"
                  >
                    <Link2 className="w-3 h-3 text-muted-foreground" />
                    <span className="truncate">{ref.flow_name}</span>
                  </div>
                ))}
                {reuseInfo.referenced_in_flows!.length > 5 && (
                  <div className="text-[9px] text-muted-foreground text-center">
                    +{reuseInfo.referenced_in_flows!.length - 5} mais
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Subpages */}
          {reuseInfo.subpages && reuseInfo.subpages.length > 0 && (
            <div className="mb-2 pb-2 border-b border-border/50">
              <div className="text-[9px] text-muted-foreground mb-1">Subpáginas:</div>
              <div className="flex flex-wrap gap-1">
                {reuseInfo.subpages.map((page, idx) => (
                  <span
                    key={idx}
                    className="text-[9px] px-1.5 py-0.5 bg-muted rounded text-muted-foreground"
                  >
                    {page}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Last Synced */}
          {reuseInfo.last_synced_at && (
            <div className="text-[9px] text-muted-foreground">
              Sincronizado: {new Date(reuseInfo.last_synced_at).toLocaleDateString()}
            </div>
          )}

          {/* Actions */}
          {onViewReferences && hasReferences && (
            <button
              onClick={onViewReferences}
              className="w-full mt-2 py-1.5 text-[10px] font-medium bg-muted text-muted-foreground rounded hover:bg-muted/80 transition-colors"
            >
              Ver todas as referências
            </button>
          )}
        </div>
      )}
    </div>
  );
});

// Componente simplificado para uso inline
export const ReuseIndicatorBadge = memo(function ReuseIndicatorBadge({
  isReused,
  reuseType,
  referencesCount,
  className,
}: {
  isReused?: boolean;
  reuseType?: "reference" | "clone";
  referencesCount?: number;
  className?: string;
}) {
  if (!isReused && !referencesCount) return null;

  return (
    <div
      className={cn(
        "inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[8px] font-semibold",
        reuseType === "reference" && "bg-blue-100 text-blue-600",
        reuseType === "clone" && "bg-purple-100 text-purple-600",
        referencesCount && !isReused && "bg-green-100 text-green-600",
        className
      )}
    >
      {reuseType === "reference" && <Link2 className="w-2.5 h-2.5" />}
      {reuseType === "clone" && <Copy className="w-2.5 h-2.5" />}
      {referencesCount && !isReused && (
        <>
          <GitFork className="w-2.5 h-2.5" />
          <span>{referencesCount}x</span>
        </>
      )}
    </div>
  );
});







