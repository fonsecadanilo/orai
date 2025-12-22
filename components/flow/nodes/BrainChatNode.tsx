"use client";

/**
 * BrainChatNode v2.0
 * 
 * Componente ReactFlow para exibir conversas do Brain no canvas.
 * Agora com 3 abas: Chat, Plan, Actions
 * 
 * Features:
 * - Streaming em tempo real
 * - Badges de mode/model
 * - Visualização de plano com versioning
 * - Ações de Review/Approve/Build
 */

import { memo, useEffect, useState, useCallback } from "react";
import { Handle, Position, type NodeProps } from "reactflow";
import { 
  Brain, 
  Sparkles, 
  Zap, 
  Clock, 
  MessageSquare,
  FileText,
  Play,
  RotateCcw,
  X,
  Check,
  AlertTriangle,
  Loader2,
  Send,
  ChevronDown,
  History,
  ExternalLink,
} from "lucide-react";
import { supabase, SUPABASE_FUNCTIONS_URL, SUPABASE_ANON_KEY } from "@/lib/supabase/client";
import type { 
  BrainMode, 
  BrainModel, 
  BrainFlowPlan, 
  BrainFlowPlanStatus,
  BrainMessage,
} from "@/lib/brain/types";

// ========================================
// TYPES
// ========================================

export interface BrainChatNodeData {
  id: string;
  thread_id: string;
  content: string;
  streaming: boolean;
  mode?: BrainMode;
  model?: BrainModel;
  plan_id?: string;
  created_at?: string;
  project_id?: number;
  user_id?: number;
}

type TabType = "chat" | "plan" | "actions";

// ========================================
// MODE CONFIG
// ========================================

const MODE_CONFIG: Record<BrainMode, { 
  label: string; 
  icon: typeof Brain; 
  color: string;
  bgColor: string;
}> = {
  PLAN: {
    label: "Plan",
    icon: Sparkles,
    color: "text-violet-600 dark:text-violet-400",
    bgColor: "bg-violet-100 dark:bg-violet-900/30",
  },
  CONSULT: {
    label: "Consult",
    icon: MessageSquare,
    color: "text-blue-600 dark:text-blue-400",
    bgColor: "bg-blue-100 dark:bg-blue-900/30",
  },
  BATCH: {
    label: "Batch",
    icon: Zap,
    color: "text-amber-600 dark:text-amber-400",
    bgColor: "bg-amber-100 dark:bg-amber-900/30",
  },
  LONG_CONTEXT: {
    label: "Long",
    icon: Clock,
    color: "text-emerald-600 dark:text-emerald-400",
    bgColor: "bg-emerald-100 dark:bg-emerald-900/30",
  },
};

const STATUS_CONFIG: Record<BrainFlowPlanStatus, {
  label: string;
  color: string;
  bgColor: string;
  icon: typeof Check;
}> = {
  draft: { label: "Rascunho", color: "text-gray-600", bgColor: "bg-gray-100", icon: FileText },
  revised: { label: "Revisado", color: "text-blue-600", bgColor: "bg-blue-100", icon: RotateCcw },
  approved: { label: "Aprovado", color: "text-green-600", bgColor: "bg-green-100", icon: Check },
  building: { label: "Construindo...", color: "text-amber-600", bgColor: "bg-amber-100", icon: Loader2 },
  built: { label: "Construído", color: "text-emerald-600", bgColor: "bg-emerald-100", icon: Check },
  cancelled: { label: "Cancelado", color: "text-red-600", bgColor: "bg-red-100", icon: X },
};

// ========================================
// COMPONENT
// ========================================

function BrainChatNodeComponent({ data, selected }: NodeProps<BrainChatNodeData>) {
  const [activeTab, setActiveTab] = useState<TabType>("chat");
  const [content, setContent] = useState(data.content || "");
  const [isStreaming, setIsStreaming] = useState(data.streaming || false);
  const [messages, setMessages] = useState<BrainMessage[]>([]);
  const [plan, setPlan] = useState<BrainFlowPlan | null>(null);
  const [versions, setVersions] = useState<{ version: number; created_at: string; change_summary?: string }[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [revisionInput, setRevisionInput] = useState("");
  const [showRevisionInput, setShowRevisionInput] = useState(false);

  const modeConfig = data.mode ? MODE_CONFIG[data.mode] : MODE_CONFIG.CONSULT;
  const ModeIcon = modeConfig.icon;

  // Carregar mensagens do thread
  useEffect(() => {
    if (!data.thread_id) return;

    async function loadMessages() {
      const { data: msgs } = await supabase
        .from("brain_messages")
        .select("*")
        .eq("thread_id", data.thread_id)
        .order("created_at", { ascending: true });
      
      if (msgs) setMessages(msgs as BrainMessage[]);
    }

    loadMessages();
  }, [data.thread_id]);

  // Carregar plano (usando Supabase client diretamente)
  useEffect(() => {
    if (!data.id) return;

    async function loadPlan() {
      try {
        // Buscar plano pelo canvas_block_id
        const { data: planData, error: planError } = await supabase
          .from("brain_flow_plans")
          .select("*")
          .eq("canvas_block_id", data.id)
          .maybeSingle();
        
        if (planError) {
          console.warn("Could not load plan:", planError.message);
          return;
        }

        if (planData) {
          setPlan(planData as BrainFlowPlan);

          // Buscar histórico de versões
          const { data: versionsData } = await supabase
            .from("brain_flow_plan_versions")
            .select("version, created_at, change_summary")
            .eq("plan_id", planData.id)
            .order("version", { ascending: false });

          setVersions(versionsData || []);
        }
      } catch (error) {
        console.warn("Error loading plan:", error);
      }
    }

    loadPlan();
  }, [data.id]);

  // Realtime subscription para streaming updates
  useEffect(() => {
    if (!data.id) return;

    const channel = supabase
      .channel(`brain-block-${data.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "brain_canvas_blocks",
          filter: `id=eq.${data.id}`,
        },
        (payload) => {
          const newData = payload.new as BrainChatNodeData;
          setContent(newData.content || "");
          setIsStreaming(newData.streaming || false);
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "brain_flow_plans",
          filter: `canvas_block_id=eq.${data.id}`,
        },
        (payload) => {
          if (payload.new) {
            setPlan(payload.new as BrainFlowPlan);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [data.id]);

  // Sync com props
  useEffect(() => {
    setContent(data.content || "");
    setIsStreaming(data.streaming || false);
  }, [data.content, data.streaming]);

  // Enviar mensagem via Edge Function
  const handleSendMessage = useCallback(async () => {
    if (!inputValue.trim() || isLoading || !data.thread_id) return;

    const prompt = inputValue.trim();
    setInputValue("");
    setIsLoading(true);

    try {
      // Chamar Edge Function brain-message-send
      const response = await fetch(`${SUPABASE_FUNCTIONS_URL}/brain-message-send`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          project_id: data.project_id || 1,
          thread_id: data.thread_id,
          user_prompt: prompt,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Brain message send failed:", errorText);
        throw new Error("Failed to send message");
      }

      const result = await response.json();
      console.log("💬 Brain response:", result);

      // Recarregar mensagens
      const { data: msgs } = await supabase
        .from("brain_messages")
        .select("*")
        .eq("thread_id", data.thread_id)
        .order("created_at", { ascending: true });
      
      if (msgs) setMessages(msgs as BrainMessage[]);

      console.log("💬 Message sent successfully!");
    } catch (error) {
      console.error("Error sending message:", error);
    } finally {
      setIsLoading(false);
    }
  }, [inputValue, isLoading, data.thread_id, data.project_id]);

  // Request changes via Edge Function
  const handleRequestChanges = useCallback(async () => {
    if (!revisionInput.trim() || isLoading || !data.thread_id) return;

    const prompt = `Revise o plano v${plan?.plan_version || 1}: ${revisionInput.trim()}`;
    setRevisionInput("");
    setShowRevisionInput(false);
    setIsLoading(true);

    try {
      const response = await fetch(`${SUPABASE_FUNCTIONS_URL}/brain-message-send`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          project_id: data.project_id || 1,
          thread_id: data.thread_id,
          user_prompt: prompt,
          force_mode: "PLAN",
        }),
      });

      const result = await response.json();
      console.log("💬 Revision response:", result);

      // Recarregar mensagens
      const { data: msgs } = await supabase
        .from("brain_messages")
        .select("*")
        .eq("thread_id", data.thread_id)
        .order("created_at", { ascending: true });
      
      if (msgs) setMessages(msgs as BrainMessage[]);

      console.log("💬 Revision request sent!");
    } catch (error) {
      console.error("Error requesting changes:", error);
    } finally {
      setIsLoading(false);
    }
  }, [revisionInput, isLoading, data.thread_id, data.project_id, plan?.plan_version]);

  // Approve & Build via Edge Function (hard gate)
  const handleApproveAndBuild = useCallback(async () => {
    if (!plan || isLoading) return;

    const confirmed = confirm(
      `Aprovar e construir o flow baseado no Plano v${plan.plan_version}?\n\nIsso irá disparar os builders v3.1.`
    );
    if (!confirmed) return;

    setIsLoading(true);
    try {
      const response = await fetch(`${SUPABASE_FUNCTIONS_URL}/brain-plan-approve-build`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          project_id: data.project_id || 1,
          plan_id: plan.id,
          approved_by: `user_${data.user_id || 1}`,
        }),
      });

      const result = await response.json();
      
      if (result.success) {
        setPlan(result.plan);
        alert("Plan approved and build initiated! 🚀");
        console.log("✅ Plan approved and builders triggered:", result);
      } else {
        console.error("Approve failed:", result.message);
        alert(`Approve failed: ${result.message}`);
      }
    } catch (error) {
      console.error("Error approving:", error);
      alert("Failed to approve and build. Check console for details.");
    } finally {
      setIsLoading(false);
    }
  }, [plan, isLoading, data.project_id, data.user_id]);

  // Cancel
  const handleCancel = useCallback(async () => {
    if (!plan || isLoading) return;

    setIsLoading(true);
    try {
      await supabase
        .from("brain_flow_plans")
        .update({ status: "cancelled", updated_at: new Date().toISOString() })
        .eq("id", plan.id);
      
      setPlan(prev => prev ? { ...prev, status: "cancelled" } : null);
    } catch (error) {
      console.error("Error cancelling:", error);
    } finally {
      setIsLoading(false);
    }
  }, [plan, isLoading]);

  return (
    <div
      className={`
        relative min-w-[400px] max-w-[550px] rounded-xl border-2 shadow-lg
        transition-all duration-200
        ${selected 
          ? "border-violet-500 shadow-violet-500/20" 
          : "border-gray-200 dark:border-gray-700"
        }
        bg-white dark:bg-gray-900
      `}
    >
      {/* Handle de entrada (top) - para conexões de flow */}
      <Handle
        type="target"
        position={Position.Top}
        id="top"
        className="!w-3 !h-3 !bg-violet-500 !border-2 !border-white"
      />
      
      {/* Handle lateral esquerdo (entrada de referência) - para brain links */}
      <Handle
        type="target"
        position={Position.Left}
        id="in_ref"
        className="!w-2.5 !h-2.5 !bg-blue-500 !border-2 !border-white !top-1/2 !-translate-y-1/2"
        style={{ left: -6 }}
      />

      {/* Header */}
      <div className={`
        flex items-center justify-between px-4 py-2 rounded-t-lg
        border-b border-gray-100 dark:border-gray-800
        ${modeConfig.bgColor}
      `}>
        <div className="flex items-center gap-2">
          <Brain className="w-4 h-4 text-violet-600 dark:text-violet-400" />
          <span className="font-semibold text-sm text-gray-800 dark:text-gray-200">
            Brain
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Mode Badge */}
          {data.mode && (
            <div className={`
              flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium
              ${modeConfig.bgColor} ${modeConfig.color}
            `}>
              <ModeIcon className="w-3 h-3" />
              {modeConfig.label}
            </div>
          )}

          {/* Plan Status Badge */}
          {plan && (
            <StatusBadge status={plan.status} version={plan.plan_version} />
          )}

          {/* Streaming Indicator */}
          {isStreaming && (
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-violet-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-violet-500" />
            </span>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-100 dark:border-gray-800">
        <TabButton 
          active={activeTab === "chat"} 
          onClick={() => setActiveTab("chat")}
          icon={MessageSquare}
          label="Chat"
        />
        <TabButton 
          active={activeTab === "plan"} 
          onClick={() => setActiveTab("plan")}
          icon={FileText}
          label="Plan"
          badge={plan ? `v${plan.plan_version}` : undefined}
        />
        <TabButton 
          active={activeTab === "actions"} 
          onClick={() => setActiveTab("actions")}
          icon={Play}
          label="Actions"
        />
      </div>

      {/* Content */}
      <div className="h-[350px] overflow-hidden flex flex-col">
        {activeTab === "chat" && (
          <ChatTab
            messages={messages}
            isStreaming={isStreaming}
            streamingContent={content}
            inputValue={inputValue}
            setInputValue={setInputValue}
            onSend={handleSendMessage}
            isLoading={isLoading}
          />
        )}
        
        {activeTab === "plan" && (
          <PlanTab
            plan={plan}
            versions={versions}
          />
        )}
        
        {activeTab === "actions" && (
          <ActionsTab
            plan={plan}
            isLoading={isLoading}
            showRevisionInput={showRevisionInput}
            revisionInput={revisionInput}
            setShowRevisionInput={setShowRevisionInput}
            setRevisionInput={setRevisionInput}
            onRequestChanges={handleRequestChanges}
            onApproveAndBuild={handleApproveAndBuild}
            onCancel={handleCancel}
          />
        )}
      </div>

      {/* Handle de saída (bottom) - para conexões de flow */}
      <Handle
        type="source"
        position={Position.Bottom}
        id="bottom"
        className="!w-3 !h-3 !bg-violet-500 !border-2 !border-white"
      />
      
      {/* Handle lateral direito (saída de referência) - para brain links */}
      <Handle
        type="source"
        position={Position.Right}
        id="out_ref"
        className="!w-2.5 !h-2.5 !bg-blue-500 !border-2 !border-white !top-1/2 !-translate-y-1/2"
        style={{ right: -6 }}
      />
    </div>
  );
}

// ========================================
// TAB COMPONENTS
// ========================================

function TabButton({ 
  active, 
  onClick, 
  icon: Icon, 
  label, 
  badge 
}: { 
  active: boolean; 
  onClick: () => void; 
  icon: typeof MessageSquare;
  label: string;
  badge?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`
        flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium
        transition-colors border-b-2 -mb-[2px]
        ${active 
          ? "text-violet-600 border-violet-600 bg-violet-50 dark:bg-violet-950/30" 
          : "text-gray-500 border-transparent hover:text-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800"
        }
      `}
    >
      <Icon className="w-4 h-4" />
      {label}
      {badge && (
        <span className="text-xs px-1.5 py-0.5 rounded bg-violet-100 dark:bg-violet-900/50 text-violet-600">
          {badge}
        </span>
      )}
    </button>
  );
}

function StatusBadge({ status, version }: { status: BrainFlowPlanStatus; version: number }) {
  const config = STATUS_CONFIG[status];
  const Icon = config.icon;

  return (
    <div className={`
      flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium
      ${config.bgColor} ${config.color}
    `}>
      <Icon className={`w-3 h-3 ${status === "building" ? "animate-spin" : ""}`} />
      {config.label}
    </div>
  );
}

function ChatTab({
  messages,
  isStreaming,
  streamingContent,
  inputValue,
  setInputValue,
  onSend,
  isLoading,
}: {
  messages: BrainMessage[];
  isStreaming: boolean;
  streamingContent: string;
  inputValue: string;
  setInputValue: (v: string) => void;
  onSend: () => void;
  isLoading: boolean;
}) {
  return (
    <>
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {messages.length === 0 && !isStreaming && (
          <div className="flex items-center justify-center h-full text-gray-400 text-sm">
            Comece uma conversa...
          </div>
        )}

        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}

        {isStreaming && streamingContent && (
          <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-3">
            <div className="text-sm whitespace-pre-wrap">{streamingContent}</div>
            <span className="inline-block w-1.5 h-4 bg-violet-500 animate-pulse ml-0.5" />
          </div>
        )}
      </div>

      <div className="p-3 border-t border-gray-100 dark:border-gray-800">
        <div className="flex gap-2">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && onSend()}
            placeholder="Pergunte ao Brain..."
            disabled={isLoading}
            className="flex-1 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 
              bg-gray-50 dark:bg-gray-800 text-sm
              focus:outline-none focus:ring-2 focus:ring-violet-500
              disabled:opacity-50"
          />
          <button
            onClick={onSend}
            disabled={!inputValue.trim() || isLoading}
            className="p-2 rounded-lg bg-violet-600 text-white disabled:bg-gray-300 
              hover:bg-violet-700 transition-colors"
          >
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </>
  );
}

function MessageBubble({ message }: { message: BrainMessage }) {
  const isUser = message.role === "user";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div className={`
        max-w-[85%] rounded-lg px-3 py-2 text-sm
        ${isUser 
          ? "bg-violet-600 text-white" 
          : "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100"
        }
      `}>
        <div className="whitespace-pre-wrap break-words">{message.content}</div>
      </div>
    </div>
  );
}

function PlanTab({
  plan,
  versions,
}: {
  plan: BrainFlowPlan | null;
  versions: { version: number; created_at: string; change_summary?: string }[];
}) {
  const [showVersions, setShowVersions] = useState(false);

  if (!plan) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-400 text-sm p-4">
        <div className="text-center">
          <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p>Nenhum plano gerado ainda</p>
          <p className="text-xs mt-1">Peça ao Brain para criar um flow</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Version selector */}
      {versions.length > 0 && (
        <div className="px-4 py-2 border-b border-gray-100 dark:border-gray-800">
          <button
            onClick={() => setShowVersions(!showVersions)}
            className="flex items-center gap-2 text-xs text-gray-500 hover:text-gray-700"
          >
            <History className="w-3 h-3" />
            Versão {plan.plan_version}
            <ChevronDown className={`w-3 h-3 transition-transform ${showVersions ? "rotate-180" : ""}`} />
          </button>
          
          {showVersions && (
            <div className="mt-2 space-y-1">
              {versions.map((v) => (
                <div key={v.version} className="text-xs px-2 py-1 rounded bg-gray-50 dark:bg-gray-800">
                  <span className="font-medium">v{v.version}</span>
                  <span className="text-gray-400 ml-2">
                    {new Date(v.created_at).toLocaleString("pt-BR")}
                  </span>
                  {v.change_summary && (
                    <span className="block text-gray-500 mt-0.5">{v.change_summary}</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Plan content */}
      <div className="p-4 prose prose-sm dark:prose-invert max-w-none"
        style={{ fontSize: "14px", lineHeight: "1.6" }}
      >
        <PlanMarkdown content={plan.plan_md} />
      </div>

      {/* Link para flow gerado */}
      {plan.status === "built" && plan.result_flow_id && (
        <div className="px-4 py-3 border-t border-gray-100 dark:border-gray-800 bg-emerald-50 dark:bg-emerald-950/30">
          <a 
            href={`/flow/${plan.result_flow_id}`}
            className="flex items-center gap-2 text-sm text-emerald-600 hover:text-emerald-700"
          >
            <ExternalLink className="w-4 h-4" />
            Ver flow gerado #{plan.result_flow_id}
          </a>
        </div>
      )}
    </div>
  );
}

function PlanMarkdown({ content }: { content: string }) {
  // Renderização simplificada de markdown
  const lines = content.split("\n");
  
  return (
    <>
      {lines.map((line, i) => {
        if (line.startsWith("## ")) {
          return <h2 key={i} className="text-lg font-semibold mt-4 mb-2 text-violet-700 dark:text-violet-400">{line.slice(3)}</h2>;
        }
        if (line.startsWith("### ")) {
          return <h3 key={i} className="text-base font-semibold mt-3 mb-1">{line.slice(4)}</h3>;
        }
        if (line.startsWith("- ") || line.startsWith("* ")) {
          return <li key={i} className="ml-4 list-disc">{line.slice(2)}</li>;
        }
        if (line.match(/^\d+\.\s/)) {
          return <li key={i} className="ml-4 list-decimal">{line.replace(/^\d+\.\s/, "")}</li>;
        }
        if (line.startsWith("**") && line.endsWith("**")) {
          return <p key={i} className="font-semibold my-1">{line.slice(2, -2)}</p>;
        }
        if (line.startsWith("> ")) {
          return <blockquote key={i} className="border-l-2 border-violet-300 pl-3 italic text-gray-600">{line.slice(2)}</blockquote>;
        }
        if (line.trim()) {
          return <p key={i} className="my-1">{line}</p>;
        }
        return <br key={i} />;
      })}
    </>
  );
}

function ActionsTab({
  plan,
  isLoading,
  showRevisionInput,
  revisionInput,
  setShowRevisionInput,
  setRevisionInput,
  onRequestChanges,
  onApproveAndBuild,
  onCancel,
}: {
  plan: BrainFlowPlan | null;
  isLoading: boolean;
  showRevisionInput: boolean;
  revisionInput: string;
  setShowRevisionInput: (v: boolean) => void;
  setRevisionInput: (v: string) => void;
  onRequestChanges: () => void;
  onApproveAndBuild: () => void;
  onCancel: () => void;
}) {
  const canApprove = plan && ["draft", "revised"].includes(plan.status);
  const canRevise = plan && ["draft", "revised"].includes(plan.status);
  const canCancel = plan && !["built", "cancelled"].includes(plan.status);
  const isBuilding = plan?.status === "building";
  const isBuilt = plan?.status === "built";

  return (
    <div className="flex-1 p-4 space-y-4">
      {!plan ? (
        <div className="text-center text-gray-400 text-sm py-8">
          <AlertTriangle className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p>Nenhum plano disponível</p>
          <p className="text-xs mt-1">Gere um plano primeiro na aba Chat</p>
        </div>
      ) : (
        <>
          {/* Status atual */}
          <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-800">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">Status atual</span>
              <StatusBadge status={plan.status} version={plan.plan_version} />
            </div>
            {plan.approved_at && (
              <div className="text-xs text-gray-500 mt-1">
                Aprovado em {new Date(plan.approved_at).toLocaleString("pt-BR")}
              </div>
            )}
          </div>

          {/* Request Changes */}
          {canRevise && (
            <div className="space-y-2">
              {showRevisionInput ? (
                <div className="space-y-2">
                  <textarea
                    value={revisionInput}
                    onChange={(e) => setRevisionInput(e.target.value)}
                    placeholder="Descreva as mudanças necessárias..."
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 
                      bg-white dark:bg-gray-800 text-sm resize-none h-20
                      focus:outline-none focus:ring-2 focus:ring-violet-500"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={onRequestChanges}
                      disabled={!revisionInput.trim() || isLoading}
                      className="flex-1 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium
                        hover:bg-blue-700 disabled:bg-gray-300 transition-colors
                        flex items-center justify-center gap-2"
                    >
                      {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
                      Solicitar Revisão
                    </button>
                    <button
                      onClick={() => setShowRevisionInput(false)}
                      className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700
                        text-sm hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setShowRevisionInput(true)}
                  className="w-full py-2.5 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600
                    text-gray-600 dark:text-gray-400 text-sm font-medium
                    hover:border-blue-400 hover:text-blue-600 transition-colors
                    flex items-center justify-center gap-2"
                >
                  <RotateCcw className="w-4 h-4" />
                  Solicitar Alterações
                </button>
              )}
            </div>
          )}

          {/* Approve & Build */}
          {canApprove && (
            <button
              onClick={onApproveAndBuild}
              disabled={isLoading}
              className="w-full py-3 rounded-lg bg-gradient-to-r from-emerald-600 to-green-600 
                text-white font-semibold text-sm
                hover:from-emerald-700 hover:to-green-700 disabled:from-gray-400 disabled:to-gray-500
                transition-all shadow-lg shadow-emerald-500/25
                flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Check className="w-5 h-5" />
              )}
              Aprovar & Construir Flow
            </button>
          )}

          {/* Building status */}
          {isBuilding && (
            <div className="p-4 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
              <div className="flex items-center gap-3">
                <Loader2 className="w-5 h-5 text-amber-600 animate-spin" />
                <div>
                  <p className="font-medium text-amber-700 dark:text-amber-400">Construindo flow...</p>
                  <p className="text-xs text-amber-600 mt-0.5">Isso pode levar alguns segundos</p>
                </div>
              </div>
            </div>
          )}

          {/* Built status */}
          {isBuilt && plan.result_flow_id && (
            <div className="p-4 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800">
              <div className="flex items-center gap-3">
                <Check className="w-5 h-5 text-emerald-600" />
                <div>
                  <p className="font-medium text-emerald-700 dark:text-emerald-400">Flow construído!</p>
                  <a 
                    href={`/flow/${plan.result_flow_id}`}
                    className="text-xs text-emerald-600 hover:underline flex items-center gap-1 mt-0.5"
                  >
                    <ExternalLink className="w-3 h-3" />
                    Abrir flow #{plan.result_flow_id}
                  </a>
                </div>
              </div>
            </div>
          )}

          {/* Cancel */}
          {canCancel && (
            <button
              onClick={onCancel}
              disabled={isLoading}
              className="w-full py-2 rounded-lg border border-red-200 dark:border-red-800
                text-red-600 text-sm font-medium
                hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors
                flex items-center justify-center gap-2"
            >
              <X className="w-4 h-4" />
              Cancelar Plano
            </button>
          )}
        </>
      )}
    </div>
  );
}

// ========================================
// EXPORT
// ========================================

export const BrainChatNode = memo(BrainChatNodeComponent);
export default BrainChatNode;
