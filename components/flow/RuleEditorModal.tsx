"use client";

import { X, Save, Trash2, FileText, Globe, GitBranch, Circle, Code, Tag, AlertTriangle, Loader2 } from "lucide-react";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import type { RuleListItem, RuleScope, RulePriority, BusinessRule } from "@/lib/agents/types";
import { getRuleWithReferences, updateRule, deleteRule } from "@/lib/agents";

interface RuleEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  rule?: RuleListItem | null;
  flowId?: number;
  flowName?: string;
  onSave?: (data: Partial<BusinessRule>) => void;
  onDelete?: () => void;
}

const CATEGORIES = [
  "autenticação",
  "validação",
  "pagamento",
  "notificação",
  "navegação",
  "segurança",
  "performance",
  "integração",
  "dados",
  "ui/ux",
];

const SCOPES: { value: RuleScope; label: string; icon: React.ReactNode }[] = [
  { value: "global", label: "Global", icon: <Globe className="w-4 h-4" /> },
  { value: "flow", label: "Fluxo", icon: <GitBranch className="w-4 h-4" /> },
  { value: "node", label: "Nó", icon: <Circle className="w-4 h-4" /> },
];

const PRIORITIES: { value: RulePriority; label: string; color: string }[] = [
  { value: "critical", label: "Crítica", color: "bg-red-500" },
  { value: "high", label: "Alta", color: "bg-orange-500" },
  { value: "medium", label: "Média", color: "bg-yellow-500" },
  { value: "low", label: "Baixa", color: "bg-green-500" },
];

export function RuleEditorModal({
  isOpen,
  onClose,
  rule,
  flowId,
  flowName = "Fluxo Atual",
  onSave,
  onDelete,
}: RuleEditorModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  // Form fields
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [content, setContent] = useState("");
  const [scope, setScope] = useState<RuleScope>("flow");
  const [category, setCategory] = useState("");
  const [priority, setPriority] = useState<RulePriority>("medium");
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  
  // Full rule data with references
  const [fullRule, setFullRule] = useState<BusinessRule | null>(null);

  const isNewRule = !rule?.id;

  // Load full rule data when editing
  useEffect(() => {
    if (rule?.id && isOpen) {
      setIsLoading(true);
      getRuleWithReferences(rule.id)
        .then((data) => {
          if (data) {
            setFullRule(data);
            setTitle(data.title || "");
            setDescription(data.description || "");
            setContent(data.content || "");
            setScope(data.scope || "flow");
            setCategory(data.category || "");
            setPriority(data.priority || "medium");
            setTags(data.tags || []);
          }
        })
        .finally(() => setIsLoading(false));
    } else if (isOpen) {
      // Reset for new rule
      setTitle("");
      setDescription("");
      setContent("");
      setScope(flowId ? "flow" : "global");
      setCategory("");
      setPriority("medium");
      setTags([]);
      setFullRule(null);
    }
  }, [rule, isOpen, flowId]);

  const handleSave = async () => {
    if (!title.trim()) return;

    setIsSaving(true);

    const ruleData: Partial<BusinessRule> = {
      title: title.trim(),
      description: description.trim(),
      content: content.trim(),
      scope,
      category: category || undefined,
      priority,
      tags,
    };

    if (rule?.id) {
      // Update existing rule
      const success = await updateRule(rule.id, ruleData);
      if (success) {
        onSave?.(ruleData);
        handleClose();
      }
    } else {
      // Create new rule (via callback to parent)
      onSave?.(ruleData);
      handleClose();
    }

    setIsSaving(false);
  };

  const handleDelete = async () => {
    if (!rule?.id) return;
    
    if (confirm("Tem certeza que deseja excluir esta regra? Esta ação não pode ser desfeita.")) {
      const success = await deleteRule(rule.id);
      if (success) {
        onDelete?.();
        handleClose();
      }
    }
  };

  const handleClose = () => {
    setTitle("");
    setDescription("");
    setContent("");
    setScope("flow");
    setCategory("");
    setPriority("medium");
    setTags([]);
    setTagInput("");
    setFullRule(null);
    onClose();
  };

  const addTag = () => {
    const tag = tagInput.trim().toLowerCase();
    if (tag && !tags.includes(tag)) {
      setTags([...tags, tag]);
    }
    setTagInput("");
  };

  const removeTag = (tagToRemove: string) => {
    setTags(tags.filter(t => t !== tagToRemove));
  };

  const handleTagKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addTag();
    }
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
      <div className="relative w-full max-w-3xl max-h-[90vh] bg-card rounded-2xl shadow-2xl border border-border animate-in fade-in zoom-in-95 duration-300 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center">
              <FileText className="w-5 h-5 text-muted-foreground" />
            </div>
            <div>
              <h2 className="font-semibold text-lg text-card-foreground">
                {isNewRule ? "Nova Regra de Negócio" : "Editar Regra"}
              </h2>
              <p className="text-xs text-muted-foreground">
                {flowName && scope === "flow" ? `Fluxo: ${flowName}` : "Regra do projeto"}
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
        <div className="flex-1 overflow-y-auto p-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-5">
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

              {/* Description */}
              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  Descrição Curta
                </label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Resumo em uma frase da regra"
                  className="w-full px-4 py-3 bg-muted/50 border border-border rounded-xl text-sm text-card-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                />
              </div>

              {/* Scope, Category, Priority Row */}
              <div className="grid grid-cols-3 gap-4">
                {/* Scope */}
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                    Escopo
                  </label>
                  <div className="flex gap-1">
                    {SCOPES.map((s) => (
                      <button
                        key={s.value}
                        onClick={() => setScope(s.value)}
                        className={cn(
                          "flex-1 flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg text-xs font-medium transition-all cursor-pointer",
                          scope === s.value
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
                        )}
                        title={s.label}
                      >
                        {s.icon}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Category */}
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                    Categoria
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-3 py-2 bg-muted/50 border border-border rounded-lg text-sm text-card-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all cursor-pointer"
                  >
                    <option value="">Selecione...</option>
                    {CATEGORIES.map((cat) => (
                      <option key={cat} value={cat} className="capitalize">
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Priority */}
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                    Prioridade
                  </label>
                  <div className="flex gap-1">
                    {PRIORITIES.map((p) => (
                      <button
                        key={p.value}
                        onClick={() => setPriority(p.value)}
                        className={cn(
                          "flex-1 flex items-center justify-center gap-1 px-2 py-2 rounded-lg text-xs font-medium transition-all cursor-pointer",
                          priority === p.value
                            ? "ring-2 ring-offset-2 ring-offset-card"
                            : "opacity-60 hover:opacity-100"
                        )}
                        style={{ backgroundColor: priority === p.value ? undefined : "transparent" }}
                        title={p.label}
                      >
                        <div className={cn("w-3 h-3 rounded-full", p.color)} />
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Content (Markdown) */}
              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  Conteúdo da Regra (Markdown)
                </label>
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder={`## Objetivo
Descreva o objetivo da regra...

## Condições
- Condição 1
- Condição 2

## Comportamento Esperado
Descreva o comportamento esperado...

## Exceções
Liste as exceções e casos especiais...

## Exemplos
\`\`\`typescript
// Exemplo de código
\`\`\`

> **Nota:** Observações importantes...`}
                  rows={12}
                  className="w-full px-4 py-3 bg-muted/50 border border-border rounded-xl text-sm text-card-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all resize-none font-mono"
                />
              </div>

              {/* Tags */}
              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  Tags
                </label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {tags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1 px-2 py-1 bg-primary/10 text-primary text-xs font-medium rounded-md"
                    >
                      <Tag className="w-3 h-3" />
                      {tag}
                      <button
                        onClick={() => removeTag(tag)}
                        className="ml-1 hover:text-destructive transition-colors cursor-pointer"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={handleTagKeyDown}
                    placeholder="Adicionar tag..."
                    className="flex-1 px-3 py-2 bg-muted/50 border border-border rounded-lg text-sm text-card-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                  />
                  <button
                    onClick={addTag}
                    disabled={!tagInput.trim()}
                    className="px-3 py-2 bg-muted text-muted-foreground hover:text-foreground rounded-lg text-sm font-medium transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Adicionar
                  </button>
                </div>
              </div>

              {/* Tips */}
              <div className="p-3 bg-muted/30 rounded-lg border border-border">
                <p className="text-xs text-muted-foreground">
                  <span className="font-semibold">💡 Dicas de formatação:</span>
                </p>
                <ul className="text-xs text-muted-foreground mt-2 space-y-1">
                  <li>• Use <code className="px-1 py-0.5 bg-muted rounded text-[10px]">## Título</code> para seções</li>
                  <li>• Use <code className="px-1 py-0.5 bg-muted rounded text-[10px]">**negrito**</code> para destacar termos</li>
                  <li>• Use <code className="px-1 py-0.5 bg-muted rounded text-[10px]">`código`</code> para referências técnicas</li>
                  <li>• Use <code className="px-1 py-0.5 bg-muted rounded text-[10px]">[REF:flow:ID]</code> para referenciar fluxos</li>
                </ul>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border flex items-center justify-between shrink-0">
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
              disabled={!title.trim() || isSaving}
              className={cn(
                "flex items-center gap-2 px-5 py-2 text-sm font-semibold rounded-xl transition-all cursor-pointer",
                title.trim() && !isSaving
                  ? "bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm"
                  : "bg-muted text-muted-foreground cursor-not-allowed"
              )}
            >
              {isSaving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              Salvar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
