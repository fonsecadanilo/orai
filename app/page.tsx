"use client";

import { useState, useCallback } from "react";
import { Header } from "@/components/layout/Header";
import { Sidebar } from "@/components/layout/Sidebar";
import { FlowEditor } from "@/components/flow/FlowEditor";
import { ProjectInfoModal } from "@/components/flow/ProjectInfoModal";
import { RuleEditorModal } from "@/components/flow/RuleEditorModal";
import { getFlowById, type SavedFlow } from "@/lib/supabase/flows";
import type { RuleListItem } from "@/lib/agents/types";

export default function Home() {
  const [isProjectInfoOpen, setIsProjectInfoOpen] = useState(false);
  const [isRuleEditorOpen, setIsRuleEditorOpen] = useState(false);
  const [selectedRule, setSelectedRule] = useState<RuleListItem | null>(null);
  
  // Estado do fluxo selecionado
  const [selectedFlowId, setSelectedFlowId] = useState<number | null>(null);
  const [selectedFlow, setSelectedFlow] = useState<SavedFlow | null>(null);
  const [isLoadingFlow, setIsLoadingFlow] = useState(false);

  // Abrir modal de edição de regra
  const handleSelectRule = useCallback((rule: RuleListItem) => {
    console.log("[Page] Abrindo regra:", rule);
    setSelectedRule(rule);
    setIsRuleEditorOpen(true);
  }, []);

  // Callback quando regra for salva
  const handleRuleSaved = useCallback(() => {
    // Podemos adicionar refresh do sidebar aqui se necessário
    console.log("[Page] Regra salva");
  }, []);

  // Callback quando regra for deletada
  const handleRuleDeleted = useCallback(() => {
    console.log("[Page] Regra deletada");
    setSelectedRule(null);
  }, []);

  // Carregar o fluxo quando o ID selecionado mudar
  const handleSelectFlow = useCallback(async (flowId: number) => {
    if (flowId === selectedFlowId) return;
    
    setSelectedFlowId(flowId);
    setIsLoadingFlow(true);
    
    try {
      const flow = await getFlowById(flowId);
      setSelectedFlow(flow);
    } catch (error) {
      console.error("Erro ao carregar fluxo:", error);
      setSelectedFlow(null);
    } finally {
      setIsLoadingFlow(false);
    }
  }, [selectedFlowId]);

  return (
    <div className="bg-background text-foreground font-sans antialiased overflow-hidden w-full h-screen relative selection:bg-muted">
      <Header />
      <Sidebar
        onOpenGeneralRules={() => setIsProjectInfoOpen(true)}
        selectedFlowId={selectedFlowId}
        onSelectFlow={handleSelectFlow}
        selectedRuleId={selectedRule?.id || null}
        onSelectRule={handleSelectRule}
      />

      <main className="absolute top-0 right-0 bottom-0 left-0 w-full h-full">
        <FlowEditor 
          onOpenProjectInfo={() => setIsProjectInfoOpen(true)} 
          selectedFlow={selectedFlow}
          isLoadingFlow={isLoadingFlow}
        />
      </main>

      {/* Modals placed here for global context */}
      <ProjectInfoModal isOpen={isProjectInfoOpen} onClose={() => setIsProjectInfoOpen(false)} />
      <RuleEditorModal 
        isOpen={isRuleEditorOpen} 
        onClose={() => {
          setIsRuleEditorOpen(false);
          setSelectedRule(null);
        }} 
        rule={selectedRule}
        flowName={selectedFlow?.name || "Projeto"} 
        onSave={handleRuleSaved}
        onDelete={handleRuleDeleted}
      />
    </div>
  );
}
