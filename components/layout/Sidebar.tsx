"use client";

import {
    LayoutGrid,
    MoreVertical,
    Plus,
    BookOpen,
    FileText,
    ArrowUpRight,
    ChevronDown,
    User,
    Settings,
    LogOut,
    HelpCircle,
    CreditCard
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState, useRef, useEffect } from "react";
import Image from "next/image";

interface SidebarProps {
    onOpenGeneralRules?: () => void;
    onOpenRuleEditor?: (rule: any) => void;
}

export function Sidebar({ onOpenGeneralRules, onOpenRuleEditor }: SidebarProps) {
    const [isHovered, setIsHovered] = useState(false);
    const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
    const profileMenuRef = useRef<HTMLDivElement>(null);

    // Mock user data - substitua com dados reais quando tiver autenticação
    const user = {
        name: "João Silva",
        email: "joao.silva@example.com",
        avatar: null, // URL da foto ou null para usar iniciais
    };

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
        // Implementar lógica de logout aqui
        console.log("Logout clicked");
        setIsProfileMenuOpen(false);
        // Exemplo: router.push("/login");
    };

    const getInitials = (name: string) => {
        return name
            .split(" ")
            .map((n) => n[0])
            .join("")
            .toUpperCase()
            .slice(0, 2);
    };

    const journeys = [
        { name: "Onboarding Flow", active: true },
        { name: "Reset Password", active: false },
        { name: "Checkout Process", active: false },
        { name: "Support Ticket", active: false },
    ];

    const flowRules = [
        { id: 1, name: "Email Uniqueness", content: "Users cannot register with an email that already exists in the `users` table." },
        { id: 2, name: "Password Strength", content: "Passwords must form 8+ chars and contain at least one number and one symbol." },
        { id: 3, name: "Promo Code Validation", content: "Check if code is valid and not expired." },
    ];

    return (
        <div 
            className={cn(
                "absolute top-0 left-0 bottom-0 w-[240px] flex flex-col z-40 pointer-events-auto overflow-hidden transition-shadow duration-500",
                isHovered && "shadow-[4px_0_24px_-4px_rgba(0,0,0,0.08)]"
            )}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            {/* Animated background glow effect */}
            <div 
                className={cn(
                    "absolute inset-0 transition-all duration-500 ease-out",
                    isHovered ? "opacity-100" : "opacity-0"
                )}
            >
                {/* Radial glow from center */}
                <div 
                    className={cn(
                        "absolute inset-0 bg-gradient-to-b from-background/95 via-background/98 to-background/95 backdrop-blur-sm transition-all duration-500",
                        isHovered ? "scale-100" : "scale-95"
                    )}
                />
                {/* Soft light effect */}
                <div 
                    className={cn(
                        "absolute -top-20 -left-20 w-[200%] h-40 bg-gradient-radial from-background/80 via-transparent to-transparent transition-all duration-700 blur-2xl",
                        isHovered ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-10"
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
            <div className="relative flex-1 overflow-y-auto py-4 px-3 space-y-8">

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
                    <ul className="space-y-0.5">
                        {journeys.map((item) => (
                            <li key={item.name}>
                                <a
                                    href="#"
                                    className={cn(
                                        "flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all group",
                                        item.active
                                            ? "bg-card text-card-foreground shadow-sm ring-1 ring-border"
                                            : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                                    )}
                                >
                                    <LayoutGrid className={cn("w-4 h-4", item.active ? "text-card-foreground" : "text-muted-foreground group-hover:text-foreground")} />
                                    {item.name}
                                    <MoreVertical className="w-3.5 h-3.5 ml-auto opacity-0 group-hover:opacity-100 text-muted-foreground" />
                                </a>
                            </li>
                        ))}
                    </ul>
                </div>

                {/* General Rules Section */}
                <div>
                    <div className="flex items-center justify-between px-3 mb-2">
                        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                            Knowledge Base
                        </span>
                    </div>
                    <button
                        onClick={onOpenGeneralRules}
                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all text-left cursor-pointer group"
                    >
                        <BookOpen className="w-4 h-4 text-muted-foreground group-hover:text-foreground" />
                        General Rules
                    </button>
                </div>

                {/* Flow Rules Section */}
                <div>
                    <div className="flex items-center justify-between px-3 mb-2">
                        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                            Flow Rules
                        </span>
                        <button
                            onClick={() => onOpenRuleEditor?.({ title: "", content: "" })}
                            className="text-muted-foreground hover:text-foreground transition-colors p-1 hover:bg-muted/50 rounded cursor-pointer"
                        >
                            <Plus className="w-3.5 h-3.5" />
                        </button>
                    </div>
                    <ul className="space-y-0.5">
                        {flowRules.map((rule) => (
                            <li key={rule.id}>
                                <button
                                    onClick={() => onOpenRuleEditor?.({ title: rule.name, content: rule.content })}
                                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all group text-left cursor-pointer"
                                >
                                    <FileText className="w-4 h-4 text-muted-foreground group-hover:text-foreground shrink-0" />
                                    <span className="truncate flex-1">{rule.name}</span>
                                    <ArrowUpRight className="w-3.5 h-3.5 text-muted-foreground/50 opacity-0 group-hover:opacity-100 group-hover:text-muted-foreground transition-all shrink-0" />
                                </button>
                            </li>
                        ))}
                    </ul>
                </div>

            </div>

            {/* Profile Section - Fixed at bottom */}
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
                        {/* Avatar */}
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

                        {/* User Info */}
                        <div className="flex-1 min-w-0 text-left">
                            <div className="text-sm font-medium truncate group-hover:text-foreground">
                                {user.name}
                            </div>
                            <div className="text-xs text-muted-foreground truncate group-hover:text-muted-foreground">
                                {user.email}
                            </div>
                        </div>

                        {/* Chevron */}
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
