"use client";

import { useState } from "react";
import { Header } from "@/components/layout/Header";
import { Sidebar } from "@/components/layout/Sidebar";
import { FlowEditor } from "@/components/flow/FlowEditor";
import { ProjectInfoModal } from "@/components/flow/ProjectInfoModal";
import { RuleEditorModal } from "@/components/flow/RuleEditorModal";

export default function Home() {
  const [isProjectInfoOpen, setIsProjectInfoOpen] = useState(false);
  const [isRuleEditorOpen, setIsRuleEditorOpen] = useState(false);
  const [currentRule, setCurrentRule] = useState<{ title: string; content: string } | undefined>(undefined);

  const handleOpenRuleEditor = (rule: any) => {
    setCurrentRule(rule);
    setIsRuleEditorOpen(true);
  };

  return (
    <div className="bg-background text-foreground font-sans antialiased overflow-hidden w-full h-screen relative selection:bg-muted">
      <Header />
      <Sidebar
        onOpenGeneralRules={() => setIsProjectInfoOpen(true)}
        onOpenRuleEditor={handleOpenRuleEditor}
      />

      <main className="absolute top-0 right-0 bottom-0 left-0 w-full h-full">
        <FlowEditor onOpenProjectInfo={() => setIsProjectInfoOpen(true)} />
      </main>

      {/* Modals placed here for global context */}
      <ProjectInfoModal isOpen={isProjectInfoOpen} onClose={() => setIsProjectInfoOpen(false)} />
      <RuleEditorModal isOpen={isRuleEditorOpen} onClose={() => setIsRuleEditorOpen(false)} ruleData={currentRule} flowName="Onboarding Flow" />
    </div>
  );
}
