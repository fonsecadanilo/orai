"use client";

/**
 * BrainChat v1.0
 * 
 * Interface de chat para interagir com o Brain Agent.
 * Suporta streaming, badges de mode/model e aplicação de ações.
 */

import { useState, useRef, useEffect, useCallback } from "react";
import { 
  Brain, 
  Send, 
  Sparkles, 
  Zap, 
  Clock, 
  MessageSquare,
  ChevronDown,
  AlertCircle,
  CheckCircle2,
  Loader2,
  X,
  Play,
  RotateCcw,
} from "lucide-react";
import { useBrain } from "@/hooks/useBrain";
import type { BrainMode, BrainModel, BrainMessage, BrainAction } from "@/lib/brain/types";

// ========================================
// TYPES
// ========================================

interface BrainChatProps {
  projectId: number;
  userId: number;
  threadId?: string;
  className?: string;
  /** Callback quando thread muda */
  onThreadChange?: (threadId: string) => void;
  /** Callback quando ações são aplicadas */
  onActionsApplied?: (results: { action_id: string; success: boolean }[]) => void;
}

// ========================================
// MODE CONFIG
// ========================================

const MODE_CONFIG: Record<BrainMode, { 
  label: string; 
  icon: typeof Brain; 
  color: string;
  bgColor: string;
  borderColor: string;
}> = {
  PLAN: {
    label: "Plan",
    icon: Sparkles,
    color: "text-violet-600 dark:text-violet-400",
    bgColor: "bg-violet-50 dark:bg-violet-950/50",
    borderColor: "border-violet-200 dark:border-violet-800",
  },
  CONSULT: {
    label: "Consult",
    icon: MessageSquare,
    color: "text-blue-600 dark:text-blue-400",
    bgColor: "bg-blue-50 dark:bg-blue-950/50",
    borderColor: "border-blue-200 dark:border-blue-800",
  },
  BATCH: {
    label: "Batch",
    icon: Zap,
    color: "text-amber-600 dark:text-amber-400",
    bgColor: "bg-amber-50 dark:bg-amber-950/50",
    borderColor: "border-amber-200 dark:border-amber-800",
  },
  LONG_CONTEXT: {
    label: "Long",
    icon: Clock,
    color: "text-emerald-600 dark:text-emerald-400",
    bgColor: "bg-emerald-50 dark:bg-emerald-950/50",
    borderColor: "border-emerald-200 dark:border-emerald-800",
  },
};

// ========================================
// MAIN COMPONENT
// ========================================

export function BrainChat({
  projectId,
  userId,
  threadId: initialThreadId,
  className = "",
  onThreadChange,
  onActionsApplied,
}: BrainChatProps) {
  const [input, setInput] = useState("");
  const [isExpanded, setIsExpanded] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const {
    isLoading,
    isStreaming,
    error,
    thread,
    threadId,
    messages,
    currentContent,
    currentMode,
    currentModel,
    lastMetadata,
    lastOutput,
    sendMessage,
    createNewThread,
    applyPendingActions,
    clearError,
    reset,
  } = useBrain({
    projectId,
    userId,
    threadId: initialThreadId,
    loadExisting: !!initialThreadId,
    onMessageComplete: (message) => {
      // Scroll to bottom
      scrollToBottom();
    },
  });

  // Notificar mudança de thread
  useEffect(() => {
    if (threadId && onThreadChange) {
      onThreadChange(threadId);
    }
  }, [threadId, onThreadChange]);

  // Auto-scroll
  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 100);
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, currentContent, scrollToBottom]);

  // Submit message
  const handleSubmit = useCallback(async () => {
    if (!input.trim() || isStreaming) return;

    const prompt = input.trim();
    setInput("");
    await sendMessage(prompt);
  }, [input, isStreaming, sendMessage]);

  // Handle key press
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  // Apply actions
  const handleApplyActions = async () => {
    try {
      const results = await applyPendingActions();
      onActionsApplied?.(results);
    } catch (err) {
      console.error("Failed to apply actions:", err);
    }
  };

  // New thread
  const handleNewThread = async () => {
    reset();
    await createNewThread();
  };

  return (
    <div className={`flex flex-col h-full bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-lg overflow-hidden ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-800 bg-gradient-to-r from-violet-50 to-purple-50 dark:from-violet-950/30 dark:to-purple-950/30">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-violet-100 dark:bg-violet-900/50">
            <Brain className="w-5 h-5 text-violet-600 dark:text-violet-400" />
          </div>
          <div>
            <h2 className="font-semibold text-gray-900 dark:text-gray-100">Brain</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {thread?.title || "Nova conversa"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Current mode/model badges */}
          {isStreaming && currentMode && (
            <ModeBadge mode={currentMode} />
          )}
          {isStreaming && currentModel && (
            <ModelBadge model={currentModel} />
          )}

          {/* Actions */}
          <button
            onClick={handleNewThread}
            disabled={isLoading || isStreaming}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 transition-colors disabled:opacity-50"
            title="Nova conversa"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 transition-colors"
          >
            <ChevronDown className={`w-4 h-4 transition-transform ${isExpanded ? "" : "rotate-180"}`} />
          </button>
        </div>
      </div>

      {isExpanded && (
        <>
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 && !isStreaming && (
              <div className="flex flex-col items-center justify-center h-full text-center py-12">
                <div className="p-4 rounded-full bg-violet-100 dark:bg-violet-900/30 mb-4">
                  <Brain className="w-8 h-8 text-violet-500" />
                </div>
                <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-2">
                  Olá! Sou o Brain.
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 max-w-xs">
                  Posso ajudar com arquitetura de fluxos, regras de negócio, e responder suas perguntas sobre o projeto.
                </p>
              </div>
            )}

            {messages.map((message) => (
              <MessageBubble key={message.id} message={message} />
            ))}

            {/* Streaming message */}
            {isStreaming && (
              <StreamingBubble
                content={currentContent}
                mode={currentMode}
                model={currentModel}
              />
            )}

            {/* Actions panel */}
            {lastOutput && lastOutput.actions.length > 0 && !isStreaming && (
              <ActionsPanel
                actions={lastOutput.actions}
                onApply={handleApplyActions}
                isLoading={isLoading}
              />
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Error */}
          {error && (
            <div className="mx-4 mb-2 p-3 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
              <span className="text-sm text-red-600 dark:text-red-400 flex-1">{error}</span>
              <button onClick={clearError} className="p-1 hover:bg-red-100 dark:hover:bg-red-900/30 rounded">
                <X className="w-4 h-4 text-red-500" />
              </button>
            </div>
          )}

          {/* Input */}
          <div className="p-4 border-t border-gray-200 dark:border-gray-800">
            <div className="flex gap-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Pergunte ao Brain..."
                disabled={isStreaming}
                rows={1}
                className="flex-1 px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 
                  bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100
                  placeholder-gray-400 dark:placeholder-gray-500
                  focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent
                  resize-none disabled:opacity-50
                  text-sm"
                style={{ minHeight: "48px", maxHeight: "120px" }}
              />
              <button
                onClick={handleSubmit}
                disabled={!input.trim() || isStreaming}
                className="px-4 py-3 rounded-xl bg-violet-600 hover:bg-violet-700 
                  disabled:bg-gray-300 dark:disabled:bg-gray-700
                  text-white font-medium transition-colors
                  flex items-center gap-2 disabled:cursor-not-allowed"
              >
                {isStreaming ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Send className="w-5 h-5" />
                )}
              </button>
            </div>

            {/* Metadata hint */}
            {lastMetadata && !isStreaming && (
              <div className="mt-2 text-xs text-gray-400 flex items-center gap-4">
                <span>Latência: {lastMetadata.latency_ms}ms</span>
                {lastMetadata.input_tokens !== undefined && (
                  <span>Tokens: {lastMetadata.input_tokens} → {lastMetadata.output_tokens}</span>
                )}
                {lastMetadata.routing_reason && (
                  <span className="truncate" title={lastMetadata.routing_reason}>
                    {lastMetadata.routing_reason}
                  </span>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ========================================
// SUB-COMPONENTS
// ========================================

function ModeBadge({ mode }: { mode: BrainMode }) {
  const config = MODE_CONFIG[mode];
  const Icon = config.icon;

  return (
    <div className={`
      flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium
      ${config.bgColor} ${config.color} border ${config.borderColor}
    `}>
      <Icon className="w-3 h-3" />
      {config.label}
    </div>
  );
}

function ModelBadge({ model }: { model: BrainModel }) {
  const displayName = model.replace("gpt-", "").replace("-mini", " Mini").toUpperCase();
  
  return (
    <div className="px-2 py-1 rounded-full text-xs font-mono
      bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400
      border border-gray-200 dark:border-gray-700">
      {displayName}
    </div>
  );
}

function MessageBubble({ message }: { message: BrainMessage }) {
  const isUser = message.role === "user";
  const mode = message.metadata?.mode;
  const model = message.metadata?.model;

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div className={`
        max-w-[80%] rounded-2xl px-4 py-3
        ${isUser 
          ? "bg-violet-600 text-white" 
          : "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100"
        }
      `}>
        {/* Header for assistant messages */}
        {!isUser && mode && (
          <div className="flex items-center gap-2 mb-2 pb-2 border-b border-gray-200 dark:border-gray-700">
            <ModeBadge mode={mode} />
            {model && model !== "user" && <ModelBadge model={model} />}
          </div>
        )}

        {/* Content */}
        <div className="text-sm whitespace-pre-wrap break-words">
          {message.content}
        </div>

        {/* Warnings */}
        {message.structured_output?.warnings && message.structured_output.warnings.length > 0 && (
          <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
            {message.structured_output.warnings.map((warning, i) => (
              <div key={i} className="flex items-start gap-1 text-xs text-amber-600 dark:text-amber-400">
                <AlertCircle className="w-3 h-3 mt-0.5 flex-shrink-0" />
                {warning}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StreamingBubble({ 
  content, 
  mode, 
  model 
}: { 
  content: string; 
  mode: BrainMode | null;
  model: BrainModel | null;
}) {
  return (
    <div className="flex justify-start">
      <div className="max-w-[80%] rounded-2xl px-4 py-3 bg-gray-100 dark:bg-gray-800">
        {/* Header */}
        {mode && (
          <div className="flex items-center gap-2 mb-2 pb-2 border-b border-gray-200 dark:border-gray-700">
            <ModeBadge mode={mode} />
            {model && <ModelBadge model={model} />}
            <span className="relative flex h-2 w-2 ml-auto">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-violet-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-violet-500" />
            </span>
          </div>
        )}

        {/* Content */}
        <div className="text-sm text-gray-900 dark:text-gray-100 whitespace-pre-wrap">
          {content || (
            <div className="flex items-center gap-2 text-gray-400">
              <Loader2 className="w-4 h-4 animate-spin" />
              Pensando...
            </div>
          )}
          {content && <span className="inline-block w-1.5 h-4 bg-violet-500 animate-pulse ml-0.5" />}
        </div>
      </div>
    </div>
  );
}

function ActionsPanel({
  actions,
  onApply,
  isLoading,
}: {
  actions: BrainAction[];
  onApply: () => void;
  isLoading: boolean;
}) {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <div className="rounded-xl border border-violet-200 dark:border-violet-800 bg-violet-50 dark:bg-violet-950/30 overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-violet-100 dark:hover:bg-violet-900/30 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Play className="w-4 h-4 text-violet-600 dark:text-violet-400" />
          <span className="font-medium text-sm text-violet-700 dark:text-violet-300">
            {actions.length} {actions.length === 1 ? "ação" : "ações"} disponíveis
          </span>
        </div>
        <ChevronDown className={`w-4 h-4 text-violet-500 transition-transform ${isOpen ? "" : "rotate-180"}`} />
      </button>

      {isOpen && (
        <div className="px-4 pb-4 space-y-2">
          {actions.map((action) => (
            <div
              key={action.action_id}
              className="flex items-start gap-3 p-3 rounded-lg bg-white dark:bg-gray-900 border border-violet-200 dark:border-violet-800"
            >
              <div className={`
                p-1.5 rounded-md
                ${action.reversible 
                  ? "bg-green-100 dark:bg-green-900/30 text-green-600" 
                  : "bg-amber-100 dark:bg-amber-900/30 text-amber-600"
                }
              `}>
                {action.reversible ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    {action.description}
                  </span>
                  <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-500 font-mono">
                    {action.action_type}
                  </span>
                </div>
                {!action.reversible && (
                  <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                    ⚠️ Esta ação não pode ser desfeita
                  </p>
                )}
              </div>
            </div>
          ))}

          <button
            onClick={onApply}
            disabled={isLoading}
            className="w-full mt-2 py-2.5 rounded-lg bg-violet-600 hover:bg-violet-700 
              disabled:bg-violet-400 text-white font-medium text-sm
              flex items-center justify-center gap-2 transition-colors"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <Play className="w-4 h-4" />
                Aplicar todas as ações
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}

// ========================================
// EXPORT
// ========================================

export default BrainChat;

