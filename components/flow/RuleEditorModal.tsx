"use client";

import { X, Save, Trash2, FileText } from "lucide-react";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";

interface RuleEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  ruleData?: {
    title: string;
    content: string;
  };
  flowName?: string;
  onSave?: (data: { title: string; content: string }) => void;
  onDelete?: () => void;
}

export function RuleEditorModal({
  isOpen,
  onClose,
  ruleData,
  flowName = "Current Flow",
  onSave,
  onDelete,
}: RuleEditorModalProps) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const isNewRule = !ruleData?.title;

  useEffect(() => {
    if (ruleData) {
      setTitle(ruleData.title || "");
      setContent(ruleData.content || "");
    }
  }, [ruleData]);

  const handleSave = () => {
    if (!title.trim()) return;
    onSave?.({ title: title.trim(), content: content.trim() });
    onClose();
  };

  const handleDelete = () => {
    onDelete?.();
    onClose();
  };

  const handleClose = () => {
    setTitle("");
    setContent("");
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-2xl bg-card rounded-2xl shadow-2xl border border-border animate-in fade-in zoom-in-95 duration-300">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center">
              <FileText className="w-5 h-5 text-muted-foreground" />
            </div>
            <div>
              <h2 className="font-semibold text-lg text-card-foreground">
                {isNewRule ? "Nova Regra" : "Editar Regra"}
              </h2>
              <p className="text-xs text-muted-foreground">
                Fluxo: {flowName}
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="w-8 h-8 rounded-full hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Title Input */}
          <div>
            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              Nome da Regra *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Validação de Email Único"
              className="w-full px-4 py-3 bg-muted/50 border border-border rounded-xl text-sm text-card-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
              autoFocus
            />
          </div>

          {/* Content Input */}
          <div>
            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              Descrição da Regra
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Descreva a regra de negócio em detalhes. Inclua condições, exceções e comportamento esperado..."
              rows={6}
              className="w-full px-4 py-3 bg-muted/50 border border-border rounded-xl text-sm text-card-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all resize-none"
            />
          </div>

          {/* Tips */}
          <div className="p-3 bg-muted/30 rounded-lg border border-border">
            <p className="text-xs text-muted-foreground">
              <span className="font-semibold">💡 Dica:</span> Seja específico na descrição. 
              Quanto mais detalhada a regra, melhor a IA poderá aplicá-la ao gerar ou modificar fluxos.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border flex items-center justify-between">
          <div>
            {!isNewRule && (
              <button
                onClick={handleDelete}
                className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-lg transition-colors cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                Excluir
              </button>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleClose}
              className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={!title.trim()}
              className={cn(
                "flex items-center gap-2 px-5 py-2 text-sm font-semibold rounded-xl transition-all cursor-pointer",
                title.trim()
                  ? "bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm"
                  : "bg-muted text-muted-foreground cursor-not-allowed"
              )}
            >
              <Save className="w-4 h-4" />
              Salvar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
