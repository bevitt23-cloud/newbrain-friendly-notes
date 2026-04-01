import { useState, useCallback, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Map, GitBranch, Layers, FileText, MessageCircle,
  Loader2, Tag, Plus, X, ChevronUp,
} from "lucide-react";
import { useStudyToolGeneration } from "@/hooks/useStudyToolGeneration";
import type { StudyToolType } from "@/hooks/useStudyToolGeneration";
import { useAuth } from "@/hooks/useAuth";
import { useCognitiveProfile } from "@/hooks/useCognitiveProfile";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import FlashcardDeck from "@/components/study-tools/FlashcardDeck";
import ClozeNotes from "@/components/study-tools/ClozeNotes";

import SocraticDebate from "@/components/study-tools/SocraticDebate";
import Visualizer from "@/components/study-tools/Visualizer";
import StickyNoteButton from "@/components/study-tools/StickyNoteButton";
import FunFactLink from "@/components/study-tools/FunFactLink";

const allStudyTools = [
  { id: "mindmap" as StudyToolType, label: "Mind Map", icon: Map, color: "text-sage-600 dark:text-sage-300", bg: "from-sage-50 to-sage-100 dark:from-sage-500/10 dark:to-sage-500/5", border: "border-sage-200 dark:border-sage-200/30" },
  { id: "flowchart" as StudyToolType, label: "Flow Chart", icon: GitBranch, color: "text-lavender-500 dark:text-lavender-300", bg: "from-lavender-50 to-lavender-100 dark:from-lavender-500/10 dark:to-lavender-500/5", border: "border-lavender-200 dark:border-lavender-200/30" },
  { id: "flashcard" as StudyToolType, label: "Flash Cards", icon: Layers, color: "text-peach-500 dark:text-peach-300", bg: "from-peach-50 to-peach-100 dark:from-peach-500/10 dark:to-peach-500/5", border: "border-peach-200 dark:border-peach-200/30" },
  { id: "cloze" as StudyToolType, label: "Fill-in-the-Blank", icon: FileText, color: "text-amber-500 dark:text-amber-400", bg: "from-amber-50 to-amber-100 dark:from-amber-400/10 dark:to-amber-400/5", border: "border-amber-200 dark:border-amber-400/30" },
  { id: "socratic" as StudyToolType, label: "Argue With Me", icon: MessageCircle, color: "text-lavender-500 dark:text-lavender-300", bg: "from-lavender-50 to-peach-50 dark:from-lavender-500/10 dark:to-peach-500/5", border: "border-lavender-200 dark:border-lavender-200/30" },
];

interface GeneratedTab {
  id: string;
  toolId: StudyToolType;
  label: string;
  result: string | null;
  generating: boolean;
  saved: boolean;
}

interface StudyToolsInlineProps {
  notesHtml: string;
  linkedNoteId?: string | null;
  noteTitle?: string;
}

const StudyToolsInline = ({ notesHtml, linkedNoteId, noteTitle }: StudyToolsInlineProps) => {
  const { user } = useAuth();
  const { generate } = useStudyToolGeneration();
  const { profile } = useCognitiveProfile();

  // Gate Socratic tool for under-13
  const isUnder13 = profile.age !== null && profile.age !== undefined && profile.age < 13;
  const studyTools = isUnder13 ? allStudyTools.filter(t => t.id !== "socratic") : allStudyTools;

  const [tabs, setTabs] = useState<GeneratedTab[]>([]);
  const [activeTab, setActiveTab] = useState("picker");
  const [selected, setSelected] = useState<Set<StudyToolType>>(new Set());

  const toggleTool = (id: StudyToolType) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
      return next;
    });
  };

  // Auto-save generated material
  const autoSave = useCallback(async (tab: GeneratedTab, result: string) => {
    if (!user) return;
    const title = `${tab.label}${noteTitle ? ` — ${noteTitle}` : ""} — ${new Date().toLocaleDateString()}`;
    const { error } = await supabase.from("saved_study_materials").insert({
      user_id: user.id,
      title,
      material_type: tab.toolId,
      content: { raw: result },
      note_id: linkedNoteId || null,
      tags: [],
    });
    if (!error) {
      setTabs((prev) => prev.map((t) => t.id === tab.id ? { ...t, saved: true } : t));
    }
  }, [user, linkedNoteId, noteTitle]);

  const handleGenerate = useCallback(async () => {
    if (selected.size === 0) return;
    const toGenerate = Array.from(selected);

    const newTabs: GeneratedTab[] = toGenerate.map((toolId) => ({
      id: `${toolId}-${Date.now()}`,
      toolId,
      label: studyTools.find((t) => t.id === toolId)?.label || toolId,
      result: null,
      generating: toolId !== "socratic",
      saved: false,
    }));
    setTabs((prev) => [...prev, ...newTabs]);
    setActiveTab(newTabs[0].id);
    setSelected(new Set());

    await Promise.all(
      newTabs
        .filter((t) => t.toolId !== "socratic")
        .map(async (tab) => {
          try {
            const res = await generate(tab.toolId, notesHtml, profile.promptAppend || undefined);
            setTabs((prev) =>
              prev.map((t) => (t.id === tab.id ? { ...t, result: res, generating: false } : t))
            );
            // Auto-save
            if (res) autoSave(tab, res);
          } catch {
            setTabs((prev) =>
              prev.map((t) => (t.id === tab.id ? { ...t, generating: false } : t))
            );
            toast.error(`Failed to generate ${tab.label}`);
          }
        })
    );
  }, [selected, notesHtml, generate, profile.promptAppend, autoSave]);

  const closeTab = (tabId: string) => {
    setTabs((prev) => {
      const remaining = prev.filter((t) => t.id !== tabId);
      if (activeTab === tabId) {
        setActiveTab(remaining.length > 0 ? remaining[remaining.length - 1].id : "picker");
      }
      return remaining;
    });
  };

  const renderToolResult = (tab: GeneratedTab) => {
    if (tab.generating) {
      return (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm font-medium text-muted-foreground">Generating {tab.label}...</p>
        </div>
      );
    }

    const toolContent = (() => {
      if (tab.toolId === "socratic") return <SocraticDebate notesHtml={notesHtml} />;
      if (!tab.result) return <p className="text-sm text-muted-foreground py-10 text-center">No result generated.</p>;

      switch (tab.toolId) {
        case "flashcard": return <FlashcardDeck data={tab.result} />;
        case "cloze": return <ClozeNotes data={tab.result} />;
        case "mindmap":
        case "flowchart": return <Visualizer data={tab.result} notesContext={notesHtml} />;
        default: return <pre className="text-xs whitespace-pre-wrap">{tab.result}</pre>;
      }
    })();

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <FunFactLink topic={tab.label} context={notesHtml} />
          <StickyNoteButton />
        </div>
        {toolContent}
      </div>
    );
  };

  const scrollToNotes = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="mt-8 rounded-2xl border border-border bg-card shadow-xl shadow-lavender-200/20 overflow-hidden"
    >
      <div className="h-1.5 bg-gradient-to-r from-lavender-400 via-peach-400 to-sage-400" />

      <div className="p-5 md:p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-foreground">📚 Study Tools</h2>
          {tabs.length > 0 && (
            <button
              onClick={scrollToNotes}
              className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              <ChevronUp className="h-3.5 w-3.5" />
              Back to Notes
            </button>
          )}
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          {tabs.length > 0 && (
            <TabsList className="mb-4 flex-wrap h-auto gap-1 bg-muted/50 p-1.5 rounded-2xl">
              <TabsTrigger value="picker" className="rounded-xl text-xs font-semibold data-[state=active]:bg-background">
                <Plus className="h-3.5 w-3.5 mr-1" />
                Add
              </TabsTrigger>
              {tabs.map((tab) => (
                <TabsTrigger key={tab.id} value={tab.id} className="rounded-xl text-xs font-semibold data-[state=active]:bg-background gap-1.5">
                  {tab.generating && <Loader2 className="h-3 w-3 animate-spin" />}
                  {tab.label}
                  {tab.saved && <span className="text-sage-500 text-[10px]">✓</span>}
                  <button
                    onClick={(e) => { e.stopPropagation(); closeTab(tab.id); }}
                    className="ml-1 rounded-full p-0.5 hover:bg-muted-foreground/20 transition-colors"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </TabsTrigger>
              ))}
            </TabsList>
          )}

          {/* Picker */}
          <TabsContent value="picker">
            <div className="space-y-4">
              {!notesHtml && (
                <p className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-400/10 border border-amber-200 dark:border-amber-400/30 rounded-xl px-3 py-2">
                  ⚠️ Generate notes first — study tools use your notes as source material.
                </p>
              )}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {studyTools.map((tool) => {
                  const isSelected = selected.has(tool.id);
                  return (
                    <button
                      key={tool.id}
                      onClick={() => toggleTool(tool.id)}
                      className={`group rounded-2xl border ${tool.border} bg-gradient-to-br ${tool.bg} p-4 text-left transition-all duration-200 hover:shadow-md ${
                        isSelected ? "ring-2 ring-primary/30 shadow-md" : ""
                      }`}
                    >
                      <tool.icon className={`h-5 w-5 ${tool.color} mb-2`} />
                      <p className="text-sm font-semibold text-foreground">{tool.label}</p>
                    </button>
                  );
                })}
              </div>
              <button
                disabled={selected.size === 0 || (!notesHtml && !selected.has("socratic"))}
                onClick={handleGenerate}
                className="w-full rounded-2xl bg-gradient-to-r from-sage-600 to-sage-500 py-3 text-sm font-semibold text-white shadow-md transition-all hover:shadow-lg disabled:opacity-40"
              >
                Generate {selected.size > 0 ? `${selected.size} Tool${selected.size > 1 ? "s" : ""}` : "Tools"}
              </button>
            </div>
          </TabsContent>

          {/* Generated tool tabs */}
          {tabs.map((tab) => (
            <TabsContent key={tab.id} value={tab.id}>
              <AnimatePresence mode="wait">
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                  {renderToolResult(tab)}
                </motion.div>
              </AnimatePresence>
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </motion.div>
  );
};

export default StudyToolsInline;
