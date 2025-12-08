import { X, PanelRightClose, CheckCircle2, Circle } from "lucide-react";
import { useState } from "react";

export function DetailsSheet({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
    const [activeTab, setActiveTab] = useState<"details" | "tasks">("details");

    return (
        <aside
            className={`fixed top-4 right-4 bottom-4 w-[480px] z-[60] flex flex-col transition-transform duration-500 ease-[cubic-bezier(0.25,1,0.5,1)] font-sans pointer-events-auto ${isOpen ? "translate-x-0" : "translate-x-[120%]"
                }`}
        >
            <div className="relative w-full h-full bg-card text-card-foreground shadow-2xl rounded-3xl border border-border flex flex-col overflow-hidden">
                {/* Header */}
                <div className="px-6 pt-5 pb-0 bg-card/50 backdrop-blur-sm z-10 shrink-0 border-b border-border">
                    <div className="flex items-center justify-between mb-4">
                        <button
                            onClick={onClose}
                            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-muted text-muted-foreground hover:text-muted-foreground transition-colors group cursor-pointer"
                        >
                            <X className="w-[18px] h-[18px] group-hover:scale-90 transition-transform" />
                        </button>
                        <div className="flex items-center gap-2">
                            <PanelRightClose className="w-3.5 h-3.5 text-muted-foreground" />
                            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                Node Details
                            </span>
                        </div>
                    </div>

                    {/* Tabs */}
                    <div className="flex gap-6">
                        <button
                            onClick={() => setActiveTab("details")}
                            className={`pb-3 text-sm transition-all cursor-pointer ${activeTab === "details"
                                ? "font-semibold border-b-2 border-primary text-card-foreground"
                                : "font-medium border-b-2 border-transparent text-muted-foreground hover:text-card-foreground"
                                }`}
                        >
                            Details
                        </button>
                        <button
                            onClick={() => setActiveTab("tasks")}
                            className={`pb-3 text-sm flex items-center gap-2 transition-all cursor-pointer ${activeTab === "tasks"
                                ? "font-semibold border-b-2 border-primary text-card-foreground"
                                : "font-medium border-b-2 border-transparent text-muted-foreground hover:text-card-foreground"
                                }`}
                        >
                            Tasks
                            <span className="bg-muted text-muted-foreground text-[10px] px-1.5 py-0.5 rounded-full font-bold">
                                3
                            </span>
                        </button>
                    </div>
                </div>

                {/* Content Container */}
                <div className="flex-1 relative overflow-hidden bg-card">
                    {/* Details Tab */}
                    <div
                        className={`absolute inset-0 overflow-y-auto p-8 transition-all duration-300 ease-out transform ${activeTab === "details"
                            ? "translate-x-0 opacity-100"
                            : "-translate-x-8 opacity-0 pointer-events-none"
                            }`}
                    >
                        {/* Metadata */}
                        <div className="flex items-center justify-between mb-6">
                            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest border border-border px-2 py-1 rounded-md">
                                Logic Node
                            </span>
                            <span className="text-[10px] font-mono text-muted-foreground">
                                ID: LOGIC-02
                            </span>
                        </div>

                        {/* Title */}
                        <h2 className="font-semibold text-3xl text-card-foreground leading-tight mb-3 tracking-tight">
                            Email Validation
                        </h2>
                        <p className="text-sm text-muted-foreground mb-8 leading-relaxed">
                            Verifies syntactic integrity and domain existence of the address
                            provided by the user.
                        </p>

                        {/* Rules */}
                        <div className="mb-8">
                            <h3 className="text-[10px] font-bold uppercase tracking-widest text-card-foreground mb-4">
                                Business Rules
                            </h3>
                            <ul className="space-y-3">
                                <li className="flex gap-3 text-sm text-muted-foreground items-start">
                                    <span className="text-muted-foreground/50 font-medium text-xs mt-0.5 select-none">
                                        01
                                    </span>
                                    <span>Validate domain to ensure delivery.</span>
                                </li>
                                <li className="flex gap-3 text-sm text-muted-foreground items-start">
                                    <span className="text-muted-foreground/50 font-medium text-xs mt-0.5 select-none">
                                        02
                                    </span>
                                    <span>Block disposable providers (blocklist v2).</span>
                                </li>
                                <li className="flex gap-3 text-sm text-muted-foreground items-start">
                                    <span className="text-muted-foreground/50 font-medium text-xs mt-0.5 select-none">
                                        03
                                    </span>
                                    <span>Normalize input (lowercase + trim).</span>
                                </li>
                            </ul>
                        </div>

                        {/* Dependencies */}
                        <div className="mb-10 p-4 bg-muted/50 rounded-xl border border-border">
                            <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3">
                                Dependencies
                            </h3>
                            <div className="space-y-2">
                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-muted-foreground font-medium">
                                        Registration Flow
                                    </span>
                                    <span className="text-[9px] font-bold text-muted-foreground bg-card border border-border px-1.5 py-0.5 rounded shadow-sm">
                                        INPUT
                                    </span>
                                </div>
                                <div className="h-px w-full bg-muted"></div>
                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-muted-foreground font-medium">
                                        Anti-Fraud Check
                                    </span>
                                    <span className="text-[9px] font-bold text-muted-foreground bg-card border border-border px-1.5 py-0.5 rounded shadow-sm">
                                        SYNC
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Minimal Footer */}
                        <div className="mt-auto pt-6 border-t border-border flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold text-muted-foreground">
                                    AM
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-[11px] font-semibold text-card-foreground">
                                        Ana M.
                                    </span>
                                    <span className="text-[9px] text-muted-foreground">
                                        Última revisão hoje
                                    </span>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100/50">
                                    <div className="w-1 h-1 rounded-full bg-emerald-500"></div>
                                    <span className="text-[10px] font-semibold">Approved</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Tasks Tab */}
                    <div
                        className={`absolute inset-0 overflow-y-auto p-8 transition-all duration-300 ease-out transform ${activeTab === "tasks"
                            ? "translate-x-0 opacity-100"
                            : "translate-x-8 opacity-0 pointer-events-none"
                            }`}
                    >
                        {/* Logic for tasks tab content same as HTML */}
                        <div className="flex flex-col h-full">
                            <div className="mb-8">
                                <h2 className="font-semibold text-2xl text-card-foreground mb-2 tracking-tight">
                                    Implementation Tasks
                                </h2>
                                <div className="flex items-center gap-4 mt-4">
                                    <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                                        <div className="h-full bg-primary w-[65%] rounded-full"></div>
                                    </div>
                                    <span className="text-xs font-medium text-muted-foreground">65%</span>
                                </div>
                            </div>

                            <div className="space-y-3">
                                {/* Task Item 1 */}
                                <div className="p-4 rounded-xl border border-border bg-card hover:border-border transition-colors group/task cursor-pointer">
                                    <div className="flex items-start justify-between mb-2">
                                        <span className="px-2 py-1 rounded bg-emerald-50 text-emerald-700 text-[10px] font-semibold border border-emerald-100">
                                            Done
                                        </span>
                                        <div className="w-6 h-6 rounded-full bg-muted border border-border flex items-center justify-center text-[10px] font-bold text-muted-foreground">
                                            JP
                                        </div>
                                    </div>
                                    <h3 className="text-sm font-medium text-card-foreground line-through text-muted-foreground">
                                        Design Validation
                                    </h3>
                                    <p className="text-xs text-muted-foreground mt-1">
                                        Verify logic with product team
                                    </p>
                                </div>

                                {/* Task Item 2 */}
                                <div className="p-4 rounded-xl border border-border bg-card shadow-sm group/task cursor-pointer">
                                    <div className="flex items-start justify-between mb-2">
                                        <span className="px-2 py-1 rounded bg-amber-50 text-amber-700 text-[10px] font-semibold border border-amber-100 flex items-center gap-1">
                                            <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></div>
                                            In Progress
                                        </span>
                                        <div className="w-6 h-6 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center text-[10px] font-bold text-indigo-600">
                                            AM
                                        </div>
                                    </div>
                                    <h3 className="text-sm font-medium text-card-foreground">
                                        API Integration
                                    </h3>
                                    <p className="text-xs text-muted-foreground mt-1">
                                        Connect with SendGrid validation endpoint
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </aside>
    );
}
