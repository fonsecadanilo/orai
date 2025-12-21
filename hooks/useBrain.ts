/**
 * useBrain Hook v1.0
 * 
 * Hook React para interagir com o Brain Agent.
 * Gerencia estado de streaming, mensagens e metadados.
 */

"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import {
  sendMessageStreaming,
  createThread,
  getThread,
  applyActions,
  type StreamCallbacks,
} from "@/lib/brain/client";
import type {
  BrainMode,
  BrainModel,
  BrainMessage,
  BrainMessageMetadata,
  BrainOutput,
  BrainThread,
  BrainStreamEvent,
  EditorContext,
  BrainActionResult,
} from "@/lib/brain/types";

// ========================================
// TYPES
// ========================================

export interface UseBrainOptions {
  /** ID do projeto */
  projectId: number;
  /** ID do usuário */
  userId: number;
  /** ID do thread existente (opcional) */
  threadId?: string;
  /** Carregar thread existente ao inicializar */
  loadExisting?: boolean;
  /** Callback quando mensagem completa */
  onMessageComplete?: (message: BrainMessage) => void;
  /** Callback quando ocorre erro */
  onError?: (error: string) => void;
}

export interface UseBrainReturn {
  // Estado
  isLoading: boolean;
  isStreaming: boolean;
  error: string | null;
  
  // Thread
  thread: BrainThread | null;
  threadId: string | null;
  messages: BrainMessage[];
  
  // Mensagem atual (durante streaming)
  currentContent: string;
  currentMode: BrainMode | null;
  currentModel: BrainModel | null;
  
  // Metadados da última resposta
  lastMetadata: Partial<BrainMessageMetadata> | null;
  lastOutput: BrainOutput | null;
  
  // Ações
  sendMessage: (prompt: string, options?: SendMessageOptions) => Promise<void>;
  createNewThread: (title?: string) => Promise<BrainThread>;
  loadThread: (threadId: string) => Promise<void>;
  applyPendingActions: (actionIds?: string[]) => Promise<BrainActionResult[]>;
  clearError: () => void;
  reset: () => void;
}

export interface SendMessageOptions {
  /** Contexto do editor */
  editorContext?: EditorContext;
  /** Forçar modo específico */
  forceMode?: BrainMode;
  /** Forçar modelo específico */
  forceModel?: BrainModel;
}

// ========================================
// HOOK
// ========================================

export function useBrain(options: UseBrainOptions): UseBrainReturn {
  const { projectId, userId, threadId: initialThreadId, loadExisting, onMessageComplete, onError } = options;

  // Estado principal
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Thread e mensagens
  const [thread, setThread] = useState<BrainThread | null>(null);
  const [threadId, setThreadId] = useState<string | null>(initialThreadId || null);
  const [messages, setMessages] = useState<BrainMessage[]>([]);

  // Estado de streaming
  const [currentContent, setCurrentContent] = useState("");
  const [currentMode, setCurrentMode] = useState<BrainMode | null>(null);
  const [currentModel, setCurrentModel] = useState<BrainModel | null>(null);

  // Metadados
  const [lastMetadata, setLastMetadata] = useState<Partial<BrainMessageMetadata> | null>(null);
  const [lastOutput, setLastOutput] = useState<BrainOutput | null>(null);

  // Ref para último messageId (para aplicar ações)
  const lastMessageIdRef = useRef<string | null>(null);

  // Carregar thread existente
  useEffect(() => {
    if (loadExisting && initialThreadId) {
      loadThread(initialThreadId);
    }
  }, [loadExisting, initialThreadId]);

  // ========================================
  // ACTIONS
  // ========================================

  /**
   * Cria um novo thread
   */
  const createNewThread = useCallback(async (title?: string): Promise<BrainThread> => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await createThread({
        project_id: projectId,
        user_id: userId,
        title,
      });

      if (!response.success) {
        throw new Error(response.message);
      }

      setThread(response.thread);
      setThreadId(response.thread.id);
      setMessages([]);

      return response.thread;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Failed to create thread";
      setError(errorMsg);
      onError?.(errorMsg);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [projectId, userId, onError]);

  /**
   * Carrega um thread existente
   */
  const loadThread = useCallback(async (id: string): Promise<void> => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await getThread({
        thread_id: id,
        include_messages: true,
        messages_limit: 100,
      });

      if (!response.success) {
        throw new Error(response.message);
      }

      setThread(response.thread);
      setThreadId(response.thread.id);
      setMessages(response.messages || []);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Failed to load thread";
      setError(errorMsg);
      onError?.(errorMsg);
    } finally {
      setIsLoading(false);
    }
  }, [onError]);

  /**
   * Envia mensagem para o Brain
   */
  const sendMessage = useCallback(async (
    prompt: string,
    messageOptions?: SendMessageOptions
  ): Promise<void> => {
    // Reset estado
    setIsStreaming(true);
    setError(null);
    setCurrentContent("");
    setCurrentMode(null);
    setCurrentModel(null);
    setLastMetadata(null);
    setLastOutput(null);

    // Adicionar mensagem do usuário à lista
    const userMessage: BrainMessage = {
      id: `temp-${Date.now()}`,
      thread_id: threadId || "",
      project_id: projectId,
      role: "user",
      content: prompt,
      metadata: {
        mode: "CONSULT",
        model: "user" as BrainModel,
        reasoning_effort: "low",
        text_verbosity: "low",
        routing_reason: "User message",
        latency_ms: 0,
        input_tokens: 0,
        output_tokens: 0,
        used_classifier: false,
        was_uncertain: false,
      },
      created_at: new Date().toISOString(),
    };
    setMessages(prev => [...prev, userMessage]);

    try {
      // Stream de eventos
      for await (const event of sendMessageStreaming({
        project_id: projectId,
        thread_id: threadId || undefined,
        user_prompt: prompt,
        editor_context: messageOptions?.editorContext,
        force_mode: messageOptions?.forceMode,
        force_model: messageOptions?.forceModel,
      })) {
        handleStreamEvent(event);
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Failed to send message";
      setError(errorMsg);
      onError?.(errorMsg);
    } finally {
      setIsStreaming(false);
    }
  }, [projectId, threadId, onError, onMessageComplete]);

  /**
   * Processa eventos de streaming
   */
  const handleStreamEvent = useCallback((event: BrainStreamEvent) => {
    switch (event.type) {
      case "start":
        setThreadId(event.thread_id);
        setCurrentMode(event.mode);
        setCurrentModel(event.model);
        lastMessageIdRef.current = event.message_id;
        break;

      case "delta":
        setCurrentContent(prev => prev + event.content);
        break;

      case "metadata":
        setLastMetadata(event.metadata);
        break;

      case "complete":
        // Atualizar thread ID se era novo
        if (event.message.thread_id && event.message.thread_id !== threadId) {
          setThreadId(event.message.thread_id);
        }
        
        // Adicionar mensagem à lista (substituir temp se existir)
        setMessages(prev => {
          // Remove mensagem temporária do user se existir
          const filtered = prev.filter(m => !m.id.startsWith("temp-"));
          return [...filtered, 
            // Re-adicionar mensagem do user com ID real
            ...prev.filter(m => m.id.startsWith("temp-")).map(m => ({
              ...m,
              thread_id: event.message.thread_id,
            })),
            event.message
          ];
        });

        // Atualizar output
        setLastOutput(event.output || null);
        lastMessageIdRef.current = event.message.id;
        
        // Callback
        onMessageComplete?.(event.message);
        break;

      case "error":
        setError(event.error);
        onError?.(event.error);
        break;
    }
  }, [threadId, onMessageComplete, onError]);

  /**
   * Aplica ações pendentes do último output
   */
  const applyPendingActions = useCallback(async (
    actionIds?: string[]
  ): Promise<BrainActionResult[]> => {
    if (!threadId || !lastMessageIdRef.current) {
      throw new Error("No message to apply actions from");
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await applyActions({
        project_id: projectId,
        thread_id: threadId,
        message_id: lastMessageIdRef.current,
        action_ids: actionIds,
      });

      if (!response.success) {
        throw new Error(response.message);
      }

      return response.results;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Failed to apply actions";
      setError(errorMsg);
      onError?.(errorMsg);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [projectId, threadId, onError]);

  /**
   * Limpa erro
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  /**
   * Reset completo
   */
  const reset = useCallback(() => {
    setIsLoading(false);
    setIsStreaming(false);
    setError(null);
    setThread(null);
    setThreadId(null);
    setMessages([]);
    setCurrentContent("");
    setCurrentMode(null);
    setCurrentModel(null);
    setLastMetadata(null);
    setLastOutput(null);
    lastMessageIdRef.current = null;
  }, []);

  // ========================================
  // RETURN
  // ========================================

  return {
    // Estado
    isLoading,
    isStreaming,
    error,

    // Thread
    thread,
    threadId,
    messages,

    // Streaming
    currentContent,
    currentMode,
    currentModel,

    // Metadados
    lastMetadata,
    lastOutput,

    // Ações
    sendMessage,
    createNewThread,
    loadThread,
    applyPendingActions,
    clearError,
    reset,
  };
}

// ========================================
// HOOK SIMPLIFICADO
// ========================================

/**
 * Hook simplificado para perguntas rápidas
 */
export function useBrainQuickAsk(projectId: number) {
  const [isLoading, setIsLoading] = useState(false);
  const [response, setResponse] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  const ask = useCallback(async (prompt: string): Promise<string> => {
    setIsLoading(true);
    setResponse("");
    setError(null);

    try {
      let fullContent = "";
      
      for await (const event of sendMessageStreaming({
        project_id: projectId,
        user_prompt: prompt,
      })) {
        if (event.type === "delta") {
          fullContent += event.content;
          setResponse(fullContent);
        } else if (event.type === "error") {
          throw new Error(event.error);
        }
      }

      return fullContent;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Failed";
      setError(errorMsg);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  return { ask, isLoading, response, error };
}

export default useBrain;

