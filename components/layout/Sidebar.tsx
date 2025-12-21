"use client";

import {
    LayoutGrid,
    MoreVertical,
    Plus,
    ChevronDown,
    ChevronRight,
    User,
    Settings,
    LogOut,
    HelpCircle,
    CreditCard,
    Loader2,
    ScrollText,
    FileText,
    Circle,
    Layers
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import { getFlows, type FlowListItem } from "@/lib/supabase/flows";
import { getFlowMasterRules } from "@/lib/agents";
import type { RuleWithSubRules, RuleListItem } from "@/lib/agents/types";

interface SidebarProps {
    onOpenGeneralRules?: () => void;
    onOpenRuleEditor?: (rule: RuleListItem) => void;
    onCreateRule?: () => void;
    selectedFlowId?: number | null;
    onSelectFlow?: (flowId: number) => void;
    selectedRuleId?: number | null;
    onSelectRule?: (rule: RuleListItem) => void;
}

// Função helper para cor de prioridade
const getPriorityColor = (priority: string) => {
    switch (priority) {
        case "critical":
            return "bg-red-500";
        case "high":
            return "bg-orange-500";
        case "medium":
            return "bg-yellow-500";
        case "low":
            return "bg-green-500";
        default:
            return "bg-gray-400";
    }
};

// Ícone do tipo de nó sugerido
const getNodeTypeIcon = (type?: string) => {
    switch (type) {
        case "trigger":
            return "⚡";
        case "action":
            return "🎯";
        case "condition":
            return "❓";
        case "input":
            return "📝";
        case "wait":
            return "⏱️";
        case "end":
            return "🏁";
        default:
            return "•";
    }
};

export function Sidebar({ 
    onOpenGeneralRules, 
    onOpenRuleEditor, 
    onCreateRule,
    selectedFlowId, 
    onSelectFlow,
    selectedRuleId,
    onSelectRule
}: SidebarProps) {
    const [isHovered, setIsHovered] = useState(false);
    const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
    const [flows, setFlows] = useState<FlowListItem[]>([]);
    const [isLoadingFlows, setIsLoadingFlows] = useState(true);
    
    // Estados para regras hierárquicas
    const [masterRules, setMasterRules] = useState<RuleWithSubRules[]>([]);
    const [isLoadingRules, setIsLoadingRules] = useState(true);
    const [expandedMasterRules, setExpandedMasterRules] = useState<Set<number>>(new Set());
    const [isRulesSectionExpanded, setIsRulesSectionExpanded] = useState(true);
    
    const profileMenuRef = useRef<HTMLDivElement>(null);

    // Mock user data
    const user = {
        name: "João Silva",
        email: "joao.silva@example.com",
        avatar: null,
    };

    // Fetch flows
    useEffect(() => {
        async function fetchFlows() {
            setIsLoadingFlows(true);
            try {
                const flowsData = await getFlows(1);
                setFlows(flowsData);
            } catch (error) {
                console.error("Erro ao carregar fluxos:", error);
            } finally {
                setIsLoadingFlows(false);
            }
        }
        fetchFlows();
    }, []);

    // Fetch rules (hierárquico)
    useEffect(() => {
        async function fetchRules() {
            setIsLoadingRules(true);
            try {
                const rulesData = await getFlowMasterRules(1, { status: "active" });
                setMasterRules(rulesData);
                
                // Expandir automaticamente a primeira regra
                if (rulesData.length > 0) {
                    setExpandedMasterRules(new Set([rulesData[0].id]));
                }
            } catch (error) {
                console.error("Erro ao carregar regras:", error);
            } finally {
                setIsLoadingRules(false);
            }
        }
        fetchRules();
    }, []);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
                setIsProfileMenuOpen(false);
            }
        };

        if (isProfileMenuOpen) {
            document.addEventListener("mousedown", handleClickOutside);
        }

        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [isProfileMenuOpen]);

    const handleLogout = () => {
        console.log("Logout clicked");
        setIsProfileMenuOpen(false);
    };

    const getInitials = (name: string) => {
        return name
            .split(" ")
            .map((n) => n[0])
            .join("")
            .toUpperCase()
            .slice(0, 2);
    };

    const toggleMasterRule = (ruleId: number) => {
        setExpandedMasterRules(prev => {
            const next = new Set(prev);
            if (next.has(ruleId)) {
                next.delete(ruleId);
            } else {
                next.add(ruleId);
            }
            return next;
        });
    };

    return (
        <div 
            className={cn(
                "absolute top-0 left-0 bottom-0 w-[260px] flex flex-col z-40 pointer-events-auto overflow-hidden transition-shadow duration-500",
                isHovered && "shadow-[4px_0_24px_-4px_rgba(0,0,0,0.08)]"
            )}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            {/* Background */}
            <div 
                className={cn(
                    "absolute inset-0 transition-all duration-500 ease-out",
                    isHovered ? "opacity-100" : "opacity-0"
                )}
            >
                <div 
                    className={cn(
                        "absolute inset-0 bg-gradient-to-b from-background/95 via-background/98 to-background/95 backdrop-blur-sm transition-all duration-500",
                        isHovered ? "scale-100" : "scale-95"
                    )}
                />
            </div>

            {/* Logo and Project Selector */}
            <div className="relative px-4 py-4 shrink-0">
                <div className="flex items-center gap-2.5 mb-3">
                    <Image 
                        src="/simboloria.svg" 
                        alt="Oria" 
                        width={22} 
                        height={22}
                        className="w-[22px] h-[22px] dark:invert"
                    />
                    <span className="font-semibold tracking-tight text-sm text-foreground">
                        ORIA
                    </span>
                </div>
                <button className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-muted/80 hover:bg-muted text-sm font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
                    <span className="truncate">Project Loviq</span>
                    <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                </button>
            </div>

            {/* Content */}
            <div className="relative flex-1 overflow-y-auto py-4 px-3 space-y-6">

                {/* Journeys Section */}
                <div>
                    <div className="flex items-center justify-between px-3 mb-2">
                        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                            Journeys
                        </span>
                        <button className="text-muted-foreground hover:text-foreground transition-colors p-1 hover:bg-muted/50 rounded cursor-pointer">
                            <Plus className="w-3.5 h-3.5" />
                        </button>
                    </div>
                    
                    {isLoadingFlows ? (
                        <div className="flex items-center justify-center py-4">
                            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                        </div>
                    ) : flows.length === 0 ? (
                        <div className="px-3 py-4 text-center">
                            <p className="text-xs text-muted-foreground">
                                Nenhum fluxo encontrado
                            </p>
                        </div>
                    ) : (
                        <ul className="space-y-0.5">
                            {flows.map((flow) => {
                                const isActive = selectedFlowId === flow.id;
                                return (
                                    <li key={flow.id}>
                                        <button
                                            onClick={() => onSelectFlow?.(flow.id)}
                                            className={cn(
                                                "w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all group text-left cursor-pointer",
                                                isActive
                                                    ? "bg-card text-card-foreground shadow-sm ring-1 ring-border"
                                                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                                            )}
                                        >
                                            <LayoutGrid className={cn("w-4 h-4 shrink-0", isActive ? "text-card-foreground" : "text-muted-foreground group-hover:text-foreground")} />
                                            <span className="truncate flex-1">{flow.name}</span>
                                            <MoreVertical className="w-3.5 h-3.5 shrink-0 opacity-0 group-hover:opacity-100 text-muted-foreground" />
                                        </button>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </div>

                {/* Business Rules Section - HIERÁRQUICO */}
                <div>
                    <div className="flex items-center justify-between px-3 mb-2">
                        <button
                            onClick={() => setIsRulesSectionExpanded(!isRulesSectionExpanded)}
                            className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider hover:text-foreground transition-colors"
                        >
                            <ChevronRight className={cn(
                                "w-3 h-3 transition-transform",
                                isRulesSectionExpanded && "rotate-90"
                            )} />
                            Regras de Negócio
                        </button>
                        <button 
                            onClick={onCreateRule}
                            className="text-muted-foreground hover:text-foreground transition-colors p-1 hover:bg-muted/50 rounded cursor-pointer"
                            title="Criar nova regra"
                        >
                            <Plus className="w-3.5 h-3.5" />
                        </button>
                    </div>

                    {isRulesSectionExpanded && (
                        <>
                            {isLoadingRules ? (
                                <div className="flex items-center justify-center py-4">
                                    <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                                </div>
                            ) : masterRules.length === 0 ? (
                                <div className="px-3 py-4 text-center">
                                    <p className="text-xs text-muted-foreground">
                                        Nenhuma regra definida
                                    </p>
                                    <p className="text-[10px] text-muted-foreground/70 mt-1">
                                        Use o Builder para criar regras de negócio
                                    </p>
                                </div>
                            ) : (
                                <div className="space-y-1">
                                    {masterRules.map((masterRule) => {
                                        const isExpanded = expandedMasterRules.has(masterRule.id);
                                        const isSelected = selectedRuleId === masterRule.id;
                                        
                                        // Converter masterRule para RuleListItem para poder abrir no modal
                                        const masterAsRuleListItem: RuleListItem = {
                                            id: masterRule.id,
                                            title: masterRule.title,
                                            description: masterRule.description,
                                            scope: masterRule.scope,
                                            rule_type: masterRule.rule_type,
                                            category: masterRule.category,
                                            priority: masterRule.priority,
                                            status: masterRule.status,
                                            flow_id: masterRule.flow_id,
                                            flow_name: masterRule.flow_name,
                                            created_at: masterRule.created_at,
                                            updated_at: masterRule.updated_at,
                                        };
                                        
                                        return (
                                            <div key={masterRule.id} className="space-y-0.5">
                                                {/* Master Rule (Flow Rule) */}
                                                <div className="flex items-center gap-1">
                                                    {/* Botão de expandir/colapsar */}
                                                    <button
                                                        onClick={() => toggleMasterRule(masterRule.id)}
                                                        className="p-1 rounded hover:bg-muted/50 transition-colors cursor-pointer"
                                                    >
                                                        <ChevronRight className={cn(
                                                            "w-3 h-3 transition-transform text-muted-foreground",
                                                            isExpanded && "rotate-90"
                                                        )} />
                                                    </button>
                                                    
                                                    {/* Botão principal que abre o modal */}
                                                    <button
                                                        onClick={() => onSelectRule?.(masterAsRuleListItem)}
                                                        className={cn(
                                                            "flex-1 flex items-center gap-2 px-2 py-2 rounded-lg text-xs font-medium transition-all group text-left cursor-pointer",
                                                            isSelected
                                                                ? "bg-primary/10 text-primary ring-1 ring-primary/30"
                                                                : "text-foreground hover:bg-muted/50"
                                                        )}
                                                    >
                                                        <Layers className="w-3.5 h-3.5 shrink-0 text-primary" />
                                                        <div className="flex-1 min-w-0">
                                                            <div className="truncate">{masterRule.title}</div>
                                                            <div className="flex items-center gap-2 mt-0.5">
                                                                <span className="text-[10px] text-muted-foreground">
                                                                    {masterRule.sub_rules_count || masterRule.sub_rules?.length || 0} subregras
                                                                </span>
                                                                <div className={cn("w-1.5 h-1.5 rounded-full", getPriorityColor(masterRule.priority))} />
                                                            </div>
                                                        </div>
                                                    </button>
                                                </div>

                                                {/* Subregras (Node Rules) */}
                                                {isExpanded && masterRule.sub_rules && masterRule.sub_rules.length > 0 && (
                                                    <div className="ml-5 pl-3 border-l-2 border-border/50 space-y-0.5">
                                                        {masterRule.sub_rules.map((subRule) => {
                                                            const isSubSelected = selectedRuleId === subRule.id;
                                                            
                                                            return (
                                                                <button
                                                                    key={subRule.id}
                                                                    onClick={() => onSelectRule?.(subRule)}
                                                                    className={cn(
                                                                        "w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-[11px] transition-all group text-left cursor-pointer",
                                                                        isSubSelected
                                                                            ? "bg-card text-card-foreground shadow-sm ring-1 ring-border"
                                                                            : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
                                                                    )}
                                                                >
                                                                    <span className="shrink-0 w-4 text-center">
                                                                        {getNodeTypeIcon(subRule.suggested_node_type)}
                                                                    </span>
                                                                    <span className="flex-1 truncate">
                                                                        {subRule.order_index}. {subRule.title}
                                                                    </span>
                                                                    <div className={cn(
                                                                        "w-1 h-1 rounded-full shrink-0",
                                                                        getPriorityColor(subRule.priority)
                                                                    )} />
                                                                </button>
                                                            );
                                                        })}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </>
                    )}
                </div>

            </div>

            {/* Profile Section */}
            <div className="relative shrink-0 border-t border-border px-3 py-3">
                <div className="relative" ref={profileMenuRef}>
                    <button
                        onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
                        className={cn(
                            "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all group",
                            isProfileMenuOpen
                                ? "bg-card text-card-foreground shadow-sm ring-1 ring-border"
                                : "hover:bg-muted/50 text-muted-foreground hover:text-foreground"
                        )}
                    >
                        <div className="relative shrink-0">
                            {user.avatar ? (
                                <Image
                                    src={user.avatar}
                                    alt={user.name}
                                    width={36}
                                    height={36}
                                    className="w-9 h-9 rounded-full border-2 border-border"
                                />
                            ) : (
                                <div className="w-9 h-9 rounded-full bg-primary border-2 border-border flex items-center justify-center text-xs font-semibold text-primary-foreground">
                                    {getInitials(user.name)}
                                </div>
                            )}
                        </div>
                        <div className="flex-1 min-w-0 text-left">
                            <div className="text-sm font-medium truncate group-hover:text-foreground">
                                {user.name}
                            </div>
                            <div className="text-xs text-muted-foreground truncate">
                                {user.email}
                            </div>
                        </div>
                        <ChevronDown
                            className={cn(
                                "w-3.5 h-3.5 shrink-0 text-muted-foreground transition-transform",
                                isProfileMenuOpen && "rotate-180"
                            )}
                        />
                    </button>

                    {/* Dropdown Menu */}
                    {isProfileMenuOpen && (
                        <div className="absolute bottom-full left-0 right-0 mb-2 bg-popover text-popover-foreground rounded-lg shadow-xl border border-border overflow-hidden py-1 z-[60] animate-in fade-in zoom-in-95 duration-200">
                            <button
                                onClick={() => {
                                    console.log("Profile clicked");
                                    setIsProfileMenuOpen(false);
                                }}
                                className="w-full text-left px-3 py-2 text-sm font-medium flex items-center gap-2.5 hover:bg-accent transition-colors"
                            >
                                <User className="w-4 h-4 text-muted-foreground" />
                                <span>Meu Perfil</span>
                            </button>
                            <button
                                onClick={() => {
                                    console.log("Settings clicked");
                                    setIsProfileMenuOpen(false);
                                }}
                                className="w-full text-left px-3 py-2 text-sm font-medium flex items-center gap-2.5 hover:bg-accent transition-colors"
                            >
                                <Settings className="w-4 h-4 text-muted-foreground" />
                                <span>Configurações</span>
                            </button>
                            <button
                                onClick={() => {
                                    console.log("Billing clicked");
                                    setIsProfileMenuOpen(false);
                                }}
                                className="w-full text-left px-3 py-2 text-sm font-medium flex items-center gap-2.5 hover:bg-accent transition-colors"
                            >
                                <CreditCard className="w-4 h-4 text-muted-foreground" />
                                <span>Assinatura</span>
                            </button>
                            <button
                                onClick={() => {
                                    console.log("Help clicked");
                                    setIsProfileMenuOpen(false);
                                }}
                                className="w-full text-left px-3 py-2 text-sm font-medium flex items-center gap-2.5 hover:bg-accent transition-colors"
                            >
                                <HelpCircle className="w-4 h-4 text-muted-foreground" />
                                <span>Ajuda</span>
                            </button>
                            <div className="h-px bg-border my-1" />
                            <button
                                onClick={handleLogout}
                                className="w-full text-left px-3 py-2 text-sm font-medium flex items-center gap-2.5 hover:bg-destructive/10 hover:text-destructive transition-colors"
                            >
                                <LogOut className="w-4 h-4" />
                                <span>Sair</span>
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
