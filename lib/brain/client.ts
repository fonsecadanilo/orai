/**
 * Brain Client v1.0
 * 
 * Cliente para comunicação com as Edge Functions do Brain.
 * Suporta streaming via Server-Sent Events (SSE).
 */

import { SUPABASE_FUNCTIONS_URL } from "@/lib/supabase/client";
import type {
  BrainThread,
  BrainMessage,
  BrainOutput,
  BrainMode,
  BrainModel,
  BrainStreamEvent,
  BrainThreadCreateRequest,
  BrainThreadCreateResponse,
  BrainMessageSendRequest,
  BrainMessageSendResponse,
  BrainThreadGetRequest,
  BrainThreadGetResponse,
  BrainActionsApplyRequest,
  BrainActionsApplyResponse,
  BrainActionResult,
  EditorContext,
} from "./types";

// ========================================
// TIPOS DE RESPOSTA
// ========================================

export interface BrainClientOptions {
  /** URL base das Edge Functions (default: SUPABASE_FUNCTIONS_URL) */
  baseUrl?: string;
  /** Headers adicionais para autenticação */
  headers?: Record<string, string>;
  /** Timeout em ms (default: 60000) */
  timeout?: number;
}

// ========================================
// CLIENTE PRINCIPAL
// ========================================

/**
 * Cria um novo thread de conversa
 */
export async function createThread(
  request: BrainThreadCreateRequest,
  options?: BrainClientOptions
): Promise<BrainThreadCreateResponse> {
  const baseUrl = options?.baseUrl || SUPABASE_FUNCTIONS_URL;
  
  const response = await fetch(`${baseUrl}/brain-thread-create`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to create thread: ${error}`);
  }

  return response.json();
}

/**
 * Busca um thread e suas mensagens
 */
export async function getThread(
  request: BrainThreadGetRequest,
  options?: BrainClientOptions
): Promise<BrainThreadGetResponse> {
  const baseUrl = options?.baseUrl || SUPABASE_FUNCTIONS_URL;
  
  const response = await fetch(`${baseUrl}/brain-thread-get`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to get thread: ${error}`);
  }

  return response.json();
}

/**
 * Envia mensagem para o Brain (sem streaming)
 */
export async function sendMessage(
  request: BrainMessageSendRequest,
  options?: BrainClientOptions
): Promise<BrainMessageSendResponse> {
  const baseUrl = options?.baseUrl || SUPABASE_FUNCTIONS_URL;
  
  const response = await fetch(`${baseUrl}/brain-message-send`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to send message: ${error}`);
  }

  // Parse SSE events and return the final result
  const events = await parseSSEResponse(response);
  const completeEvent = events.find(e => e.type === "complete");
  
  if (!completeEvent || completeEvent.type !== "complete") {
    throw new Error("No complete event received");
  }

  return {
    success: true,
    thread_id: completeEvent.message.thread_id,
    message: completeEvent.message,
    output: completeEvent.output,
  };
}

/**
 * Envia mensagem para o Brain com streaming
 * Retorna um AsyncGenerator que emite eventos de streaming
 */
export async function* sendMessageStreaming(
  request: BrainMessageSendRequest,
  options?: BrainClientOptions
): AsyncGenerator<BrainStreamEvent, void, unknown> {
  const baseUrl = options?.baseUrl || SUPABASE_FUNCTIONS_URL;
  
  const response = await fetch(`${baseUrl}/brain-message-send`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const error = await response.text();
    yield {
      type: "error",
      error: `Failed to send message: ${error}`,
    };
    return;
  }

  if (!response.body) {
    yield {
      type: "error",
      error: "No response body",
    };
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      
      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      
      // Parse SSE events from buffer
      const lines = buffer.split("\n\n");
      buffer = lines.pop() || ""; // Keep incomplete line in buffer
      
      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const jsonStr = line.slice(6);
          try {
            const event = JSON.parse(jsonStr) as BrainStreamEvent;
            yield event;
          } catch {
            console.warn("[Brain Client] Failed to parse SSE event:", jsonStr);
          }
        }
      }
    }
    
    // Process any remaining buffer
    if (buffer.startsWith("data: ")) {
      const jsonStr = buffer.slice(6);
      try {
        const event = JSON.parse(jsonStr) as BrainStreamEvent;
        yield event;
      } catch {
        // Ignore incomplete final event
      }
    }
  } finally {
    reader.releaseLock();
  }
}

/**
 * Aplica ações do Brain
 */
export async function applyActions(
  request: BrainActionsApplyRequest,
  options?: BrainClientOptions
): Promise<BrainActionsApplyResponse> {
  const baseUrl = options?.baseUrl || SUPABASE_FUNCTIONS_URL;
  
  const response = await fetch(`${baseUrl}/brain-actions-apply`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to apply actions: ${error}`);
  }

  return response.json();
}

// ========================================
// HELPERS
// ========================================

/**
 * Parse full SSE response (não streaming)
 */
async function parseSSEResponse(response: Response): Promise<BrainStreamEvent[]> {
  const text = await response.text();
  const events: BrainStreamEvent[] = [];
  
  const lines = text.split("\n\n");
  for (const line of lines) {
    if (line.startsWith("data: ")) {
      const jsonStr = line.slice(6);
      try {
        events.push(JSON.parse(jsonStr));
      } catch {
        // Skip invalid JSON
      }
    }
  }
  
  return events;
}

/**
 * Cria callbacks para processar eventos de streaming
 */
export interface StreamCallbacks {
  onStart?: (event: Extract<BrainStreamEvent, { type: "start" }>) => void;
  onDelta?: (event: Extract<BrainStreamEvent, { type: "delta" }>) => void;
  onMetadata?: (event: Extract<BrainStreamEvent, { type: "metadata" }>) => void;
  onComplete?: (event: Extract<BrainStreamEvent, { type: "complete" }>) => void;
  onError?: (event: Extract<BrainStreamEvent, { type: "error" }>) => void;
}

/**
 * Envia mensagem com callbacks (wrapper conveniente)
 */
export async function sendMessageWithCallbacks(
  request: BrainMessageSendRequest,
  callbacks: StreamCallbacks,
  options?: BrainClientOptions
): Promise<BrainMessage | null> {
  let finalMessage: BrainMessage | null = null;

  for await (const event of sendMessageStreaming(request, options)) {
    switch (event.type) {
      case "start":
        callbacks.onStart?.(event);
        break;
      case "delta":
        callbacks.onDelta?.(event);
        break;
      case "metadata":
        callbacks.onMetadata?.(event);
        break;
      case "complete":
        callbacks.onComplete?.(event);
        finalMessage = event.message;
        break;
      case "error":
        callbacks.onError?.(event);
        break;
    }
  }

  return finalMessage;
}

// ========================================
// CONVENIENCE FUNCTIONS
// ========================================

/**
 * Envia uma pergunta rápida (cria thread se necessário)
 */
export async function askBrain(
  projectId: number,
  prompt: string,
  options?: {
    threadId?: string;
    editorContext?: EditorContext;
    forceMode?: BrainMode;
    forceModel?: BrainModel;
    onDelta?: (content: string, total: string) => void;
  }
): Promise<{
  threadId: string;
  message: BrainMessage;
  output?: BrainOutput;
}> {
  let totalContent = "";

  const callbacks: StreamCallbacks = {
    onDelta: (event) => {
      totalContent += event.content;
      options?.onDelta?.(event.content, totalContent);
    },
  };

  const message = await sendMessageWithCallbacks(
    {
      project_id: projectId,
      thread_id: options?.threadId,
      user_prompt: prompt,
      editor_context: options?.editorContext,
      force_mode: options?.forceMode,
      force_model: options?.forceModel,
    },
    callbacks
  );

  if (!message) {
    throw new Error("No message received from Brain");
  }

  return {
    threadId: message.thread_id,
    message,
    output: message.structured_output || undefined,
  };
}

// ========================================
// EXPORTS
// ========================================

export type {
  BrainThread,
  BrainMessage,
  BrainOutput,
  BrainMode,
  BrainModel,
  BrainStreamEvent,
  EditorContext,
  BrainActionResult,
};



