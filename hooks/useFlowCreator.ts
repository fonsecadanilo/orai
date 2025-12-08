"use client";

import { useState, useCallback } from "react";
import { createFlow, continueFlowConversation } from "@/lib/agents/flow-creator";
import type { FlowCreatorResponse, AgentError, GeneratedFlow } from "@/lib/agents/types";

interface UseFlowCreatorOptions {
  projectId: number;
  userId: number;
  onSuccess?: (response: FlowCreatorResponse) => void;
  onError?: (error: AgentError) => void;
}

interface UseFlowCreatorReturn {
  create: (prompt: string) => Promise<void>;
  continueConversation: (prompt: string) => Promise<void>;
  isLoading: boolean;
  error: AgentError | null;
  lastResponse: FlowCreatorResponse | null;
  conversationId: string | null;
  generatedFlow: GeneratedFlow | null;
  reset: () => void;
}

export function useFlowCreator({
  projectId,
  userId,
  onSuccess,
  onError,
}: UseFlowCreatorOptions): UseFlowCreatorReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<AgentError | null>(null);
  const [lastResponse, setLastResponse] = useState<FlowCreatorResponse | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [generatedFlow, setGeneratedFlow] = useState<GeneratedFlow | null>(null);

  const create = useCallback(
    async (prompt: string) => {
      if (!prompt.trim()) {
        const err: AgentError = {
          code: "EMPTY_PROMPT",
          message: "O prompt não pode estar vazio",
        };
        setError(err);
        onError?.(err);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const response = await createFlow(prompt, projectId, userId);
        setLastResponse(response);
        setConversationId(response.conversation_id || null);
        setGeneratedFlow(response.generated_flow);
        onSuccess?.(response);
      } catch (err) {
        const agentError = err as AgentError;
        setError(agentError);
        onError?.(agentError);
      } finally {
        setIsLoading(false);
      }
    },
    [projectId, userId, onSuccess, onError]
  );

  const continueConversation = useCallback(
    async (prompt: string) => {
      if (!prompt.trim()) {
        const err: AgentError = {
          code: "EMPTY_PROMPT",
          message: "O prompt não pode estar vazio",
        };
        setError(err);
        onError?.(err);
        return;
      }

      if (!conversationId) {
        // Se não há conversa, criar uma nova
        return create(prompt);
      }

      setIsLoading(true);
      setError(null);

      try {
        const response = await continueFlowConversation(
          conversationId,
          prompt,
          projectId,
          userId
        );
        setLastResponse(response);
        setGeneratedFlow(response.generated_flow);
        onSuccess?.(response);
      } catch (err) {
        const agentError = err as AgentError;
        setError(agentError);
        onError?.(agentError);
      } finally {
        setIsLoading(false);
      }
    },
    [conversationId, projectId, userId, create, onSuccess, onError]
  );

  const reset = useCallback(() => {
    setError(null);
    setLastResponse(null);
    setConversationId(null);
    setGeneratedFlow(null);
  }, []);

  return {
    create,
    continueConversation,
    isLoading,
    error,
    lastResponse,
    conversationId,
    generatedFlow,
    reset,
  };
}
