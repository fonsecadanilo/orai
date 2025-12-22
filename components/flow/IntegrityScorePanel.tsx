"use client";

import { memo, useState } from "react";
import { 
  Shield, 
  ShieldCheck, 
  ShieldAlert, 
  ShieldX,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  CheckCircle2,
  Info,
  AlertTriangle,
  RefreshCw,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface IntegrityFinding {
  finding_id: string;
  severity: "critical" | "major" | "minor" | "suggestion";
  category: string;
  title: string;
  description: string;
  recommendation: string;
  auto_fixable: boolean;
  affected_element_id?: string;
}

interface IntegrityScorePanelProps {
  score: number;
  isValid: boolean;
  findings?: IntegrityFinding[];
  onFindingClick?: (finding: IntegrityFinding) => void;
  onAutoFix?: (findings: IntegrityFinding[]) => void;
  onClose?: () => void;
  className?: string;
}

const getScoreConfig = (score: number) => {
  if (score >= 90) {
    return {
      icon: ShieldCheck,
      color: "text-green-500",
      bgColor: "bg-green-500/10",
      borderColor: "border-green-500/30",
      label: "Excelente",
      description: "Fluxo robusto e bem estruturado",
    };
  }
  if (score >= 70) {
    return {
      icon: Shield,
      color: "text-blue-500",
      bgColor: "bg-blue-500/10",
      borderColor: "border-blue-500/30",
      label: "Bom",
      description: "Pequenos ajustes recomendados",
    };
  }
  if (score >= 50) {
    return {
      icon: ShieldAlert,
      color: "text-amber-500",
      bgColor: "bg-amber-500/10",
      borderColor: "border-amber-500/30",
      label: "Regular",
      description: "Melhorias necessárias",
    };
  }
  return {
    icon: ShieldX,
    color: "text-red-500",
    bgColor: "bg-red-500/10",
    borderColor: "border-red-500/30",
    label: "Crítico",
    description: "Requer atenção imediata",
  };
};

const getSeverityConfig = (severity: IntegrityFinding["severity"]) => {
  switch (severity) {
    case "critical":
      return {
        icon: AlertCircle,
        color: "text-red-500",
        bgColor: "bg-red-100",
        label: "Crítico",
      };
    case "major":
      return {
        icon: AlertTriangle,
        color: "text-orange-500",
        bgColor: "bg-orange-100",
        label: "Importante",
      };
    case "minor":
      return {
        icon: Info,
        color: "text-blue-500",
        bgColor: "bg-blue-100",
        label: "Menor",
      };
    case "suggestion":
      return {
        icon: CheckCircle2,
        color: "text-green-500",
        bgColor: "bg-green-100",
        label: "Sugestão",
      };
  }
};

export const IntegrityScorePanel = memo(function IntegrityScorePanel({
  score,
  isValid,
  findings = [],
  onFindingClick,
  onAutoFix,
  onClose,
  className,
}: IntegrityScorePanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const scoreConfig = getScoreConfig(score);
  const Icon = scoreConfig.icon;
  
  const criticalCount = findings.filter(f => f.severity === "critical").length;
  const majorCount = findings.filter(f => f.severity === "major").length;
  const minorCount = findings.filter(f => f.severity === "minor").length;
  const suggestionCount = findings.filter(f => f.severity === "suggestion").length;
  const autoFixableCount = findings.filter(f => f.auto_fixable).length;

  return (
    <div
      className={cn(
        "bg-card/95 backdrop-blur-md border rounded-xl shadow-xl transition-all duration-300",
        scoreConfig.borderColor,
        isExpanded ? "w-80" : "w-auto",
        className
      )}
    >
      {/* Header */}
      <div 
        className="flex items-center gap-3 px-4 py-3 cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        {/* Score Circle */}
        <div className={cn(
          "relative w-12 h-12 rounded-full flex items-center justify-center",
          scoreConfig.bgColor
        )}>
          <Icon className={cn("w-5 h-5", scoreConfig.color)} />
          <div className="absolute -bottom-1 -right-1 bg-card rounded-full px-1.5 py-0.5 text-[10px] font-bold border shadow-sm">
            {score}%
          </div>
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm text-card-foreground">
              Score de Integridade
            </span>
            <span className={cn(
              "text-[10px] font-medium px-1.5 py-0.5 rounded",
              scoreConfig.bgColor,
              scoreConfig.color
            )}>
              {scoreConfig.label}
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground truncate">
            {findings.length === 0 
              ? scoreConfig.description
              : `${findings.length} itens encontrados`
            }
          </p>
        </div>

        {/* Toggle */}
        <div className="flex items-center gap-1">
          {isExpanded ? (
            <ChevronUp className="w-4 h-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          )}
          {onClose && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onClose();
              }}
              className="p-1 hover:bg-muted rounded"
            >
              <X className="w-3 h-3 text-muted-foreground" />
            </button>
          )}
        </div>
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="px-4 pb-4 border-t border-border/50">
          {/* Summary Stats */}
          <div className="grid grid-cols-4 gap-2 py-3 border-b border-border/50">
            <div className="text-center">
              <div className="text-lg font-bold text-red-500">{criticalCount}</div>
              <div className="text-[9px] text-muted-foreground">Críticos</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-orange-500">{majorCount}</div>
              <div className="text-[9px] text-muted-foreground">Importantes</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-blue-500">{minorCount}</div>
              <div className="text-[9px] text-muted-foreground">Menores</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-green-500">{suggestionCount}</div>
              <div className="text-[9px] text-muted-foreground">Sugestões</div>
            </div>
          </div>

          {/* Auto-fix button */}
          {autoFixableCount > 0 && onAutoFix && (
            <button
              onClick={() => onAutoFix(findings.filter(f => f.auto_fixable))}
              className="w-full mt-3 flex items-center justify-center gap-2 py-2 px-3 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Corrigir {autoFixableCount} automaticamente
            </button>
          )}

          {/* Findings List */}
          <div className="mt-3 space-y-2 max-h-60 overflow-y-auto">
            {findings.length === 0 ? (
              <div className="text-center py-4 text-muted-foreground text-sm">
                <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-green-500" />
                Nenhum problema encontrado!
              </div>
            ) : (
              findings.map((finding) => {
                const severityConfig = getSeverityConfig(finding.severity);
                const SeverityIcon = severityConfig.icon;
                
                return (
                  <div
                    key={finding.finding_id}
                    onClick={() => onFindingClick?.(finding)}
                    className={cn(
                      "p-2.5 rounded-lg border cursor-pointer transition-all hover:shadow-sm",
                      severityConfig.bgColor,
                      "hover:border-current/30"
                    )}
                  >
                    <div className="flex items-start gap-2">
                      <SeverityIcon className={cn("w-4 h-4 mt-0.5 shrink-0", severityConfig.color)} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-xs text-card-foreground truncate">
                            {finding.title}
                          </span>
                          {finding.auto_fixable && (
                            <span className="text-[8px] px-1 py-0.5 bg-primary/10 text-primary rounded">
                              auto-fix
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-muted-foreground line-clamp-2 mt-0.5">
                          {finding.description}
                        </p>
                        <p className="text-[9px] text-primary mt-1 font-medium">
                          💡 {finding.recommendation}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Valid badge */}
          <div className={cn(
            "mt-3 py-2 px-3 rounded-lg text-center text-xs font-medium",
            isValid
              ? "bg-green-100 text-green-700"
              : "bg-red-100 text-red-700"
          )}>
            {isValid 
              ? "✓ Fluxo válido para produção"
              : "⚠ Fluxo com problemas críticos"
            }
          </div>
        </div>
      )}
    </div>
  );
});









