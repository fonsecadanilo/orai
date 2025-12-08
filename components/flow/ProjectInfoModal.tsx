import { X, CheckCircle2, Circle, FileText, ClipboardList, BookOpen, Minimize2, Maximize2, Search, Filter } from "lucide-react";
import { useState, useRef } from "react";
import { cn } from "@/lib/utils";

export function ProjectInfoModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
    const [activeTab, setActiveTab] = useState<"rules" | "tasks">("rules");
    const [rulesView, setRulesView] = useState<"flow" | "general">("flow");
    const [isExpanded, setIsExpanded] = useState(false);
    const contentRef = useRef<HTMLDivElement>(null);

    const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
        if (!isExpanded && e.currentTarget.scrollTop > 50) {
            setIsExpanded(true);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 transition-all duration-500 ease-in-out">
            <div
                className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity"
                onClick={onClose}
            ></div>

            <div
                className={cn(
                    "relative bg-card shadow-2xl overflow-hidden flex flex-col transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] pointer-events-auto",
                    isExpanded ? "w-full h-full rounded-none" : "w-full max-w-6xl h-[70vh] rounded-3xl"
                )}
            >
                {/* Header */}
                <div className="px-8 py-6 border-b border-border flex items-center justify-between shrink-0 bg-card z-10">
                    <div>
                        <h2 className="text-2xl font-bold text-card-foreground">Project Information</h2>
                        <p className="text-sm text-muted-foreground mt-1">Manage rules and track progress</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setIsExpanded(!isExpanded)}
                            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-muted text-muted-foreground hover:text-muted-foreground transition-colors cursor-pointer"
                            title={isExpanded ? "Minimize" : "Maximize"}
                        >
                            {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                        </button>
                        <button
                            onClick={onClose}
                            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-muted text-muted-foreground hover:text-muted-foreground transition-colors cursor-pointer"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Tabs & Content */}
                <div className="flex flex-1 overflow-hidden">
                    {/* Sidebar Navigation */}
                    <div className="w-72 bg-muted/50 border-r border-border p-6 flex flex-col gap-2 shrink-0">
                        <button
                            onClick={() => setActiveTab("rules")}
                            className={cn(
                                "flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all text-left",
                                activeTab === "rules"
                                    ? "bg-card text-card-foreground shadow-sm border border-border"
                                    : "text-muted-foreground hover:text-card-foreground hover:bg-muted/50"
                            )}
                        >
                            <BookOpen className="w-4 h-4" />
                            Business Rules
                        </button>
                        <button
                            onClick={() => setActiveTab("tasks")}
                            className={cn(
                                "flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all text-left",
                                activeTab === "tasks"
                                    ? "bg-card text-card-foreground shadow-sm border border-border"
                                    : "text-muted-foreground hover:text-card-foreground hover:bg-muted/50"
                            )}
                        >
                            <ClipboardList className="w-4 h-4" />
                            Project Tasks
                            <span className="ml-auto bg-muted text-muted-foreground text-[10px] px-1.5 py-0.5 rounded-full font-bold">5</span>
                        </button>
                    </div>

                    {/* Main Content Area */}
                    <div
                        ref={contentRef}
                        onScroll={handleScroll}
                        className="flex-1 overflow-y-auto bg-card p-8 scroll-smooth"
                    >
                        {activeTab === "rules" && (
                            <div className="space-y-6 max-w-4xl mx-auto">
                                {/* Rules Toggle */}
                                <div className="flex items-center justify-between">
                                    <div className="flex bg-muted p-1 rounded-lg w-fit">
                                        <button
                                            onClick={() => setRulesView("flow")}
                                            className={cn(
                                                "px-4 py-1.5 rounded-md text-xs font-medium transition-all",
                                                rulesView === "flow" ? "bg-card text-card-foreground shadow-sm" : "text-muted-foreground hover:text-card-foreground"
                                            )}
                                        >
                                            Current Flow
                                        </button>
                                        <button
                                            onClick={() => setRulesView("general")}
                                            className={cn(
                                                "px-4 py-1.5 rounded-md text-xs font-medium transition-all",
                                                rulesView === "general" ? "bg-card text-card-foreground shadow-sm" : "text-muted-foreground hover:text-card-foreground"
                                            )}
                                        >
                                            General Rules
                                        </button>
                                    </div>

                                    {/* Search & Filters */}
                                    <div className="flex items-center gap-2">
                                        <div className="relative">
                                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                                            <input
                                                type="text"
                                                placeholder="Search rules..."
                                                className="pl-8 pr-3 py-1.5 bg-muted border border-border rounded-md text-xs text-card-foreground placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-300 w-48"
                                            />
                                        </div>
                                        <button className="p-1.5 rounded-md text-muted-foreground hover:text-muted-foreground hover:bg-muted border border-transparent hover:border-border transition-all cursor-pointer" title="Filter">
                                            <Filter className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                </div>

                                {/* Filter Tags */}
                                <div className="flex gap-2 -mt-2">
                                    {["Security", "Validation", "Business Logic", "Compliance"].map(tag => (
                                        <button key={tag} className="px-2.5 py-1 rounded-full border border-border text-muted-foreground text-[10px] font-medium hover:bg-muted hover:text-card-foreground transition-colors cursor-pointer">
                                            {tag}
                                        </button>
                                    ))}
                                </div>
                                {rulesView === "flow" ? (
                                    <div className="animate-in fade-in slide-in-from-right-4 duration-300 pb-20">
                                        <h3 className="text-lg font-semibold text-card-foreground mb-4">Onboarding Flow Rules</h3>
                                        <ul className="space-y-4">
                                            <li className="flex gap-4 p-5 rounded-2xl border border-border hover:border-border transition-colors bg-muted/30">
                                                <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center text-sm font-bold shrink-0">1</div>
                                                <div>
                                                    <p className="font-semibold text-card-foreground">Email Uniqueness</p>
                                                    <p className="text-base text-muted-foreground mt-1 leading-relaxed">Users cannot register with an email that already exists in the `users` table. This check must happen before any insert operation to ensure data integrity.</p>
                                                </div>
                                            </li>
                                            <li className="flex gap-4 p-5 rounded-2xl border border-border hover:border-border transition-colors bg-muted/30">
                                                <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center text-sm font-bold shrink-0">2</div>
                                                <div>
                                                    <p className="font-semibold text-card-foreground">Password Strength</p>
                                                    <p className="text-base text-muted-foreground mt-1 leading-relaxed">Passwords must be at least 8 characters long and contain a mix of uppercase letters, lowercase letters, numbers, and special symbols to meet security standards.</p>
                                                </div>
                                            </li>
                                            {/* Dummy items to force scroll for testing expansion */}
                                            {Array.from({ length: 5 }).map((_, i) => (
                                                <li key={i} className="flex gap-4 p-5 rounded-2xl border border-border hover:border-border transition-colors bg-muted/30">
                                                    <div className="w-8 h-8 rounded-full bg-muted text-muted-foreground flex items-center justify-center text-sm font-bold shrink-0">{i + 3}</div>
                                                    <div>
                                                        <p className="font-semibold text-card-foreground">Additional Rule #{i + 1}</p>
                                                        <p className="text-base text-muted-foreground mt-1 leading-relaxed">This rule exists to demonstrate the scrolling behavior. When you scroll down, the modal will expand to full screen to provide a better reading experience.</p>
                                                    </div>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                ) : (
                                    <div className="animate-in fade-in slide-in-from-right-4 duration-300 pb-20">
                                        <h3 className="text-lg font-semibold text-card-foreground mb-4">General Project Rules</h3>
                                        <ul className="space-y-4">
                                            <li className="flex gap-4 p-5 rounded-2xl border border-border hover:border-border transition-colors bg-muted/30">
                                                <div className="w-8 h-8 rounded-full bg-purple-50 text-purple-600 flex items-center justify-center text-sm font-bold shrink-0">1</div>
                                                <div>
                                                    <p className="font-semibold text-card-foreground">Data Privacy (GDPR)</p>
                                                    <p className="text-base text-muted-foreground mt-1 leading-relaxed">All Personally Identifiable Information (PII) must be encrypted at rest using AES-256. User deletion requests must cascade to all related tables and logs within 30 days.</p>
                                                </div>
                                            </li>
                                            <li className="flex gap-4 p-5 rounded-2xl border border-border hover:border-border transition-colors bg-muted/30">
                                                <div className="w-8 h-8 rounded-full bg-purple-50 text-purple-600 flex items-center justify-center text-sm font-bold shrink-0">2</div>
                                                <div>
                                                    <p className="font-semibold text-card-foreground">API Rate Limiting</p>
                                                    <p className="text-base text-muted-foreground mt-1 leading-relaxed">Public API endpoints are strictly limited to 100 requests per minute per IP address. Authenticated endpoints have a higher limit of 1000 requests per minute.</p>
                                                </div>
                                            </li>
                                        </ul>
                                    </div>
                                )}
                            </div>
                        )}

                        {activeTab === "tasks" && (
                            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300 max-w-4xl mx-auto pb-20">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-lg font-semibold text-card-foreground">Tasks for "Onboarding"</h3>
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-medium text-muted-foreground">Progress</span>
                                        <div className="w-32 h-2.5 bg-muted rounded-full overflow-hidden">
                                            <div className="h-full bg-green-500 w-[60%] rounded-full"></div>
                                        </div>
                                        <span className="text-xs font-bold text-card-foreground">60%</span>
                                    </div>
                                </div>

                                {/* Task List - Added more items for scroll */}
                                <div className="p-5 rounded-xl border border-border bg-muted/50 opacity-60">
                                    <div className="flex items-start justify-between mb-2">
                                        <span className="px-2.5 py-1 rounded bg-green-100 text-green-700 text-[10px] font-bold uppercase tracking-wider">Done</span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
                                        <span className="text-base font-medium text-muted-foreground line-through">Design Database Schema</span>
                                    </div>
                                </div>

                                <div className="p-5 rounded-xl border border-border hover:shadow-lg transition-all bg-card cursor-pointer group">
                                    <div className="flex items-start justify-between mb-2">
                                        <span className="px-2.5 py-1 rounded bg-amber-100 text-amber-700 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5">
                                            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
                                            In Progress
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <Circle className="w-5 h-5 text-amber-500 shrink-0" />
                                        <span className="text-base font-medium text-card-foreground group-hover:text-blue-600 transition-colors">Implement Auth API Routes</span>
                                    </div>
                                    <p className="text-sm text-muted-foreground mt-2 pl-8 leading-relaxed">Use NextAuth.js for handling JWT sessions and callbacks. Configure providers for Google and GitHub.</p>
                                </div>

                                <div className="p-5 rounded-xl border border-dashed border-border hover:border-border hover:bg-muted transition-all cursor-pointer">
                                    <div className="flex items-start justify-between mb-2">
                                        <span className="px-2.5 py-1 rounded bg-muted text-muted-foreground text-[10px] font-bold uppercase tracking-wider">To Do</span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <Circle className="w-5 h-5 text-muted-foreground/50 shrink-0" />
                                        <span className="text-base font-medium text-muted-foreground">Setup Email Templates (Resend)</span>
                                    </div>
                                </div>

                                {/* Dummy tasks for scroll */}
                                {Array.from({ length: 4 }).map((_, i) => (
                                    <div key={i} className="p-5 rounded-xl border border-dashed border-border hover:border-border hover:bg-muted transition-all cursor-pointer">
                                        <div className="flex items-start justify-between mb-2">
                                            <span className="px-2.5 py-1 rounded bg-muted text-muted-foreground text-[10px] font-bold uppercase tracking-wider">To Do</span>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <Circle className="w-5 h-5 text-muted-foreground/50 shrink-0" />
                                            <span className="text-base font-medium text-muted-foreground">Future Task Item #{i + 1}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
