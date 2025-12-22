"use client";

import { useState, useCallback, useEffect } from "react";
import {
  createHierarchicalRules,
  getFlowMasterRules,
  getFlowMasterWithSubRules,
  getSubRules,
  getProjectRules,
  getRuleWithReferences,
  archiveRule,
  archiveFlowMasterWithSubRules,
  deleteRule,
  getRuleCategories,
} from "@/lib/agents";
import type {
  BusinessRulesResponse,
  AgentError,
  RuleListItem,
  RuleWithReferences,
  RuleWithSubRules,
} from "@/lib/agents/types";

interface UseBusinessRulesOptions {
  projectId: number;
  userId: number;
  flowId?: number;
  autoLoad?: boolean;
  onSuccess?: (response: BusinessRulesResponse) => void;
  onError?: (error: AgentError) => void;
}

interface UseBusinessRulesReturn {
  // Actions - Criar regras hierárquicas
  createRules: (prompt: string, options?: { flowId?: number }) => Promise<BusinessRulesResponse | null>;
  
  // Actions - Gerenciar regras
  archiveMasterWithSubRules: (masterRuleId: number) => Promise<boolean>;
  archiveSingleRule: (ruleId: number) => Promise<boolean>;
  remove: (ruleId: number) => Promise<boolean>;
  
  // Buscar dados
  getRule: (ruleId: number) => Promise<RuleWithReferences | null>;
  getMasterWithSubRules: (masterRuleId: number) => Promise<RuleWithSubRules | null>;
  refreshRules: () => Promise<void>;
  
  // State
  isLoading: boolean;
  isLoadingRules: boolean;
  error: AgentError | null;
  lastResponse: BusinessRulesResponse | null;
  conversationId: string | null;
  
  // Data - Hierárquico
  flowMasterRules: RuleWithSubRules[];
  allRules: RuleListItem[];
  categories: string[];
  
  // Filtros
  filterByCategory: (category: string | null) => void;
  currentCategory: string | null;
  
  // Reset
  reset: () => void;
}

export function useBusinessRules({
  projectId,
  userId,
  flowId,
  autoLoad = true,
  onSuccess,
  onError,
}: UseBusinessRulesOptions): UseBusinessRulesReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingRules, setIsLoadingRules] = useState(false);
  const [error, setError] = useState<AgentError | null>(null);
  const [lastResponse, setLastResponse] = useState<BusinessRulesResponse | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  
  // Data hierárquico
  const [flowMasterRules, setFlowMasterRules] = useState<RuleWithSubRules[]>([]);
  const [allRules, setAllRules] = useState<RuleListItem[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  
  // Filtros
  const [currentCategory, setCurrentCategory] = useState<string | null>(null);

  // Carregar regras do projeto (hierárquico)
  const loadRules = useCallback(async () => {
    setIsLoadingRules(true);
    try {
      const [masterRulesData, allRulesData, categoriesData] = await Promise.all([
        getFlowMasterRules(projectId, { status: "active" }),
        getProjectRules(projectId, {
          status: "active",
          category: currentCategory || undefined,
        }),
        getRuleCategories(projectId),
      ]);
      
      setFlowMasterRules(masterRulesData);
      setAllRules(allRulesData);
      setCategories(categoriesData);
    } catch (err) {
      console.error("Erro ao carregar regras:", err);
    } finally {
      setIsLoadingRules(false);
    }
  }, [projectId, currentCategory]);

  // Auto load
  useEffect(() => {
    if (autoLoad && projectId) {
      loadRules();
    }
  }, [autoLoad, projectId, loadRules]);

  // Criar regras hierárquicas (Master + Subregras)
  const createRules = useCallback(
    async (prompt: string, options?: { flowId?: number }) => {
      if (!prompt.trim()) {
        const err: AgentError = {
          code: "EMPTY_PROMPT",
          message: "O prompt não pode estar vazio",
        };
        setError(err);
        onError?.(err);
        return null;
      }

      setIsLoading(true);
      setError(null);

      try {
        const response = await createHierarchicalRules(prompt, projectId, userId, {
          flowId: options?.flowId || flowId,
          conversationId: conversationId || undefined,
        });
        
        setLastResponse(response);
        setConversationId(response.conversation_id || null);
        onSuccess?.(response);
        
        // Recarregar lista de regras
        await loadRules();
        
        return response;
      } catch (err) {
        const agentError = err as AgentError;
        setError(agentError);
        onError?.(agentError);
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [projectId, userId, flowId, conversationId, onSuccess, onError, loadRules]
  );

  // Arquivar regra master com todas as subregras
  const archiveMasterWithSubRules = useCallback(
    async (masterRuleId: number) => {
      const success = await archiveFlowMasterWithSubRules(masterRuleId);
      if (success) {
        await loadRules();
      }
      return success;
    },
    [loadRules]
  );

  // Arquivar uma única regra
  const archiveSingleRule = useCallback(
    async (ruleId: number) => {
      const success = await archiveRule(ruleId);
      if (success) {
        await loadRules();
      }
      return success;
    },
    [loadRules]
  );

  // Deletar regra permanentemente
  const remove = useCallback(
    async (ruleId: number) => {
      const success = await deleteRule(ruleId);
      if (success) {
        await loadRules();
      }
      return success;
    },
    [loadRules]
  );

  // Obter regra com referências
  const getRule = useCallback(
    async (ruleId: number) => {
      return getRuleWithReferences(ruleId);
    },
    []
  );

  // Obter master com subregras
  const getMasterWithSubRules = useCallback(
    async (masterRuleId: number) => {
      return getFlowMasterWithSubRules(masterRuleId);
    },
    []
  );

  // Filtros
  const filterByCategory = useCallback((category: string | null) => {
    setCurrentCategory(category);
  }, []);

  // Reset
  const reset = useCallback(() => {
    setError(null);
    setLastResponse(null);
    setConversationId(null);
    setCurrentCategory(null);
  }, []);

  return {
    // Actions
    createRules,
    archiveMasterWithSubRules,
    archiveSingleRule,
    remove,
    getRule,
    getMasterWithSubRules,
    refreshRules: loadRules,
    
    // State
    isLoading,
    isLoadingRules,
    error,
    lastResponse,
    conversationId,
    
    // Data
    flowMasterRules,
    allRules,
    categories,
    
    // Filters
    filterByCategory,
    currentCategory,
    
    // Reset
    reset,
  };
}

















