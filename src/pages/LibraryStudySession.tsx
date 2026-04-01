import { useState, useCallback, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Map, GitBranch, Layers, ClipboardCheck, FileText, MessageCircle,
  GraduationCap, Loader2, X, ChevronLeft, Plus, Clock, Hash, AlertTriangle,
} from "lucide-react";
import { useStudyToolGeneration } from "@/hooks/useStudyToolGeneration";
import type { StudyToolType } from "@/hooks/useStudyToolGeneration";
import { useCognitiveProfile } from "@/hooks/useCognitiveProfile";
import { toast } from "sonner";
import FlashcardDeck from "@/components/study-tools/FlashcardDeck";
import ClozeNotes from "@/components/study-tools/ClozeNotes";

import SocraticDebate from "@/components/study-tools/SocraticDebate";
import MindMap from "@/components/study-tools/MindMap";
import FlowChart from "@/components/study-tools/FlowChart";
import FinalExam from "@/components/study-tools/FinalExam";
import StickyNoteButton from "@/components/study-tools/StickyNoteButton";
import Layout from "@/components/Layout";

const studyTools = [
  { id: "mindmap" as StudyToolType, label: "Mind Map", icon: Map },
  { id: "flowchart" as StudyToolType, label: "Flow Chart", icon: GitBranch },
  { id: "flashcard" as StudyToolType, label: "Flash Cards", icon: Layers },
  { id: "practice" as StudyToolType, label: "Knowledge Quest", icon: ClipboardCheck },
  { id: "cloze" as StudyToolType, label: "Fill-in-the-Blank", icon: FileText },
  { id: "socratic" as StudyToolType, label: "Argue With Me", icon: MessageCircle },
  { id: "final-exam" as StudyToolType, label: "Final Exam", icon: GraduationCap },
];

interface GeneratedTab {
  id: string;
  toolId: StudyToolType;
  label: string;
  result: string | null;
  generating: boolean;
  timerMinutes?: number;
}

// Exam config for final exam
interface ExamConfig {
  questionCount: number;
  timerMinutes: number;
  mcEnabled: boolean;
  tfEnabled: boolean;
  fibEnabled: boolean;
  essayEnabled: boolean;
}

const DEFAULT_EXAM_CONFIG: ExamConfig = {
  questionCount: 20,
  timerMinutes: 30,
  mcEnabled: true,
  tfEnabled: true,
  fibEnabled: true,
  essayEnabled: false,
};

export default function LibraryStudySession() {
  const location = useLocation();
  const navigate = useNavigate();
  const { generate } = useStudyToolGeneration();
  const { profile } = useCognitiveProfile();

  const state = location.state as { notesHtml: string; noteTitle: string } | null;
  const notesHtml = state?.notesHtml || "";
  const noteTitle = state?.noteTitle || "Study Session";

  const [tabs, setTabs] = useState<GeneratedTab[]>([]);
  const [activeTab, setActiveTab] = useState("picker");
  const [selected, setSelected] = useState<Set<StudyToolType>>(new Set());

  // Exam config
  const [examConfig, setExamConfig] = useState<ExamConfig>(DEFAULT_EXAM_CONFIG);
  const [showExamConfig, setShowExamConfig] = useState(false);

  useEffect(() => {
    if (!notesHtml) {
      toast.error("No notes selected. Go back to Library.");
    }
  }, [notesHtml]);

  const toggleTool = (id: StudyToolType) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
      if (id === "final-exam" && !next.has(id)) setShowExamConfig(false);
      if (id === "final-exam" && next.has(id)) setShowExamConfig(true);
      return next;
    });
  };

  const handleGenerate = useCallback(async () => {
    if (selected.size === 0) return;
    const toGenerate = Array.from(selected);

    const newTabs: GeneratedTab[] = toGenerate.map((toolId) => ({
      id: `${toolId}-${Date.now()}`,
      toolId,
      label: studyTools.find((t) => t.id === toolId)?.label || toolId,
      result: null,
      generating: toolId !== "socratic",
      timerMinutes: toolId === "final-exam" ? examConfig.timerMinutes : undefined,
    }));
    setTabs((prev) => [...prev, ...newTabs]);
    setActiveTab(newTabs[0].id);
    setSelected(new Set());
    setShowExamConfig(false);

    await Promise.all(
      newTabs
        .filter((t) => t.toolId !== "socratic")
        .map(async (tab) => {
          try {
            // For final exam, pass exam config as profilePrompt addition
            let extraPrompt = profile.promptAppend || "";
            if (tab.toolId === "final-exam") {
              const types = [];
              if (examConfig.mcEnabled) types.push("multiple-choice");
              if (examConfig.tfEnabled) types.push("true/false");
              if (examConfig.fibEnabled) types.push("fill-in-the-blank");
              if (examConfig.essayEnabled) types.push("essay");
              extraPrompt += `\n\nGENERATE EXACTLY ${examConfig.questionCount} questions. Question types to include: ${types.join(", ")}. ${examConfig.essayEnabled ? "Include 1-2 essay questions (5-paragraph format). " : ""}Distribute question types evenly across the selection. Emphasize topics the student commonly misses.`;
            }
            const res = await generate(tab.toolId as StudyToolType, notesHtml, extraPrompt || undefined);
            setTabs((prev) =>
              prev.map((t) => (t.id === tab.id ? { ...t, result: res, generating: false } : t))
            );
          } catch {
            setTabs((prev) =>
              prev.map((t) => (t.id === tab.id ? { ...t, generating: false } : t))
            );
            toast.error(`Failed to generate ${tab.label}`);
          }
        })
    );
  }, [selected, notesHtml, generate, profile.promptAppend, examConfig]);

  const closeTab = (tabId: string) => {
    setTabs((prev) => {
      const remaining = prev.filter((t) => t.id !== tabId);
      if (activeTab === tabId) setActiveTab(remaining.length > 0 ? remaining[remaining.length - 1].id : "picker");
      return remaining;
    });
  };

  const renderToolResult = (tab: GeneratedTab) => {
    if (tab.generating) {
      return (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <p className="text-sm font-medium text-muted-foreground">Generating {tab.label}...</p>
        </div>
      );
    }
    if (tab.toolId === "socratic") return <SocraticDebate notesHtml={notesHtml} />;
    if (!tab.result) return <p className="text-sm text-muted-foreground py-10 text-center">No result generated.</p>;

    switch (tab.toolId) {
      case "flashcard": return <FlashcardDeck data={tab.result} />;
      case "practice": return <pre className="text-xs whitespace-pre-wrap bg-muted/50 rounded-lg p-3">{tab.result}</pre>;
      case "cloze": return <ClozeNotes data={tab.result} />;
      case "mindmap": return <div className="h-[500px]"><MindMap data={tab.result} /></div>;
      case "flowchart": return <div className="h-[500px]"><FlowChart data={tab.result} /></div>;
      case "final-exam": return <FinalExam data={tab.result} timerMinutes={tab.timerMinutes} />;
      default: return <pre className="text-xs whitespace-pre-wrap">{tab.result}</pre>;
    }
  };

  return (
    <Layout>
      <div className="min-h-screen">
        {/* Top bar */}
        <div className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur-sm">
          <div className="container max-w-6xl flex items-center justify-between py-3">
            <div className="flex items-center gap-3">
              <button onClick={() => navigate("/library")} className="rounded-lg border border-border p-2 text-muted-foreground hover:bg-muted transition-colors">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <div>
                <h1 className="text-lg font-bold text-foreground">📚 Study Session</h1>
                <p className="text-xs text-muted-foreground truncate max-w-xs">{noteTitle}</p>
              </div>
            </div>
            <StickyNoteButton />
          </div>
        </div>

        <div className="container max-w-6xl py-6">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            {tabs.length > 0 && (
              <TabsList className="mb-6 flex-wrap h-auto gap-1 bg-muted/50 p-1.5 rounded-2xl">
                <TabsTrigger value="picker" className="rounded-xl text-xs font-semibold data-[state=active]:bg-background">
                  <Plus className="h-3.5 w-3.5 mr-1" /> Add
                </TabsTrigger>
                {tabs.map((tab) => (
                  <TabsTrigger key={tab.id} value={tab.id} className="rounded-xl text-xs font-semibold data-[state=active]:bg-background gap-1.5">
                    {tab.generating && <Loader2 className="h-3 w-3 animate-spin" />}
                    {tab.label}
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
              <div className="max-w-2xl mx-auto space-y-6">
                {!notesHtml && (
                  <div className="flex items-center gap-2 rounded-xl border border-amber-200 dark:border-amber-400/30 bg-amber-50 dark:bg-amber-400/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-400">
                    <AlertTriangle className="h-4 w-4 shrink-0" /> No notes loaded. Go back and select notes first.
                  </div>
                )}

                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  {studyTools.map((tool) => {
                    const isSelected = selected.has(tool.id);
                    return (
                      <button
                        key={tool.id}
                        onClick={() => toggleTool(tool.id)}
                        className={`group rounded-2xl border bg-card p-5 text-left transition-all duration-200 hover:shadow-md ${
                          isSelected ? "ring-2 ring-primary/30 shadow-md border-primary/20" : "border-border"
                        }`}
                      >
                        <tool.icon className="h-6 w-6 text-primary mb-2" />
                        <p className="text-sm font-semibold text-foreground">{tool.label}</p>
                      </button>
                    );
                  })}
                </div>

                {/* Exam config */}
                <AnimatePresence>
                  {showExamConfig && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                      <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
                        <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                          <GraduationCap className="h-4 w-4 text-primary" /> Exam Configuration
                        </h3>

                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                              <Hash className="h-3 w-3" /> Question Count
                            </label>
                            <input
                              id="exam-question-count"
                              name="examQuestionCount"
                              type="number"
                              min={5}
                              max={100}
                              value={examConfig.questionCount}
                              onChange={(e) => setExamConfig((p) => ({ ...p, questionCount: Number(e.target.value) || 20 }))}
                              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                              <Clock className="h-3 w-3" /> Timer (minutes, 0 = off)
                            </label>
                            <input
                              id="exam-timer-minutes"
                              name="examTimerMinutes"
                              type="number"
                              min={0}
                              max={300}
                              value={examConfig.timerMinutes}
                              onChange={(e) => setExamConfig((p) => ({ ...p, timerMinutes: Number(e.target.value) || 0 }))}
                              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                            />
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-xs font-semibold text-muted-foreground">Question Types</label>
                          <div className="flex flex-wrap gap-2">
                            {[
                              { key: "mcEnabled", label: "Multiple Choice" },
                              { key: "tfEnabled", label: "True / False" },
                              { key: "fibEnabled", label: "Fill in Blank" },
                              { key: "essayEnabled", label: "Essay" },
                            ].map(({ key, label }) => (
                              <button
                                key={key}
                                onClick={() => setExamConfig((p) => ({ ...p, [key]: !(p as any)[key] }))}
                                className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-all ${
                                  (examConfig as any)[key]
                                    ? "border-primary/30 bg-primary/10 text-primary"
                                    : "border-border text-muted-foreground hover:bg-muted"
                                }`}
                              >
                                {label}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <button
                  disabled={selected.size === 0 || !notesHtml}
                  onClick={handleGenerate}
                  className="w-full rounded-2xl bg-gradient-to-r from-sage-600 to-sage-500 py-3.5 text-sm font-semibold text-white shadow-md transition-all hover:shadow-lg disabled:opacity-40"
                >
                  Generate {selected.size > 0 ? `${selected.size} Tool${selected.size > 1 ? "s" : ""}` : "Tools"}
                </button>
              </div>
            </TabsContent>

            {/* Generated tabs - full width */}
            {tabs.map((tab) => (
              <TabsContent key={tab.id} value={tab.id}>
                <div className="max-w-4xl mx-auto">
                  {renderToolResult(tab)}
                </div>
              </TabsContent>
            ))}
          </Tabs>
        </div>
      </div>
    </Layout>
  );
}
