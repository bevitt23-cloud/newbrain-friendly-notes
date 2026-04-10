import { useState, useEffect, useCallback, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, FileText, BookOpen, ChevronRight, Loader2, Sparkles, RefreshCw } from "lucide-react";
import { sanitizeHtml } from "@/lib/sanitize";
import Layout from "@/components/Layout";
import FlashcardDeck from "@/components/study-tools/FlashcardDeck";
import ClozeNotes from "@/components/study-tools/ClozeNotes";

import MindMap from "@/components/study-tools/MindMap";
import FlowChart from "@/components/study-tools/FlowChart";
import SocraticDebate from "@/components/study-tools/SocraticDebate";
import FinalExam from "@/components/study-tools/FinalExam";
import FunFactLink from "@/components/study-tools/FunFactLink";
import TextSelectionMenu from "@/components/TextSelectionMenu";
import JargonTooltip from "@/components/JargonTooltip";
import { useNotesInteractivity } from "@/hooks/useNotesInteractivity";
import { useJargonTooltip } from "@/hooks/useJargonTooltip";
import { useStudyToolGeneration } from "@/hooks/useStudyToolGeneration";
import type { StudyToolType } from "@/hooks/useStudyToolGeneration";
import { useNoteGeneration } from "@/hooks/useNoteGeneration";
import type { NoteFormat } from "@/hooks/useNoteGeneration";
import { useCognitiveProfile } from "@/hooks/useCognitiveProfile";
import { useUserPreferences } from "@/hooks/useUserPreferences";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { LEARNING_MODE } from "@/lib/constants";
import InAppVideoModal from "@/components/InAppVideoModal";
import type { SavedExplainerVideo } from "@/components/InAppVideoModal";
import VideoBar from "@/components/VideoBar";

interface ReviewItem {
  id: string;
  title: string;
  type: "note" | "material";
  materialType?: string;
  content: string;
  rawContent?: Record<string, unknown>;
  noteId?: string; // database id for saving sticky notes
}

interface GeneratedTool {
  id: string;
  toolType: StudyToolType;
  label: string;
  result: string | null;
  generating: boolean;
  noteContent: string;
}

const materialTypeLabel: Record<string, string> = {
  flashcard: "🃏 Flash Cards",
  mindmap: "🗺️ Mind Map",
  flowchart: "📊 Flow Chart",
  cloze: "📝 Fill-in-Blank",
  socratic: "💬 Debate",
  "final-exam": "🎓 Exam",
};

const toolLabel: Record<string, string> = {
  mindmap: "🗺️ Mind Map",
  flowchart: "📊 Flow Chart",
  flashcard: "🃏 Flash Cards",
  cloze: "📝 Fill-in-Blank",
  socratic: "💬 Debate",
};

/* ── Interactive Note Viewer (mirrors GeneratedNotes interactivity) ── */
function InteractiveNoteViewer({ html, noteId }: { html: string; noteId?: string }) {
  const [videoQuery, setVideoQuery] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [stickyNotes, setStickyNotes] = useState<any[]>([]);
  const [savedVideos, setSavedVideos] = useState<SavedExplainerVideo[]>([]);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadedRef = useRef(false);

  useNotesInteractivity(containerRef, html);
  const jargonTooltip = useJargonTooltip(containerRef, html);

  // Load sticky notes from DB
  useEffect(() => {
    if (!noteId || loadedRef.current) return;
    loadedRef.current = true;
    (async () => {
      const { data } = await supabase
        .from("saved_notes")
        .select("sticky_notes, saved_videos")
        .eq("id", noteId)
        .single();
      if (data?.sticky_notes && Array.isArray(data.sticky_notes)) {
        setStickyNotes(data.sticky_notes as any[]);
      }
      if (data?.saved_videos && Array.isArray(data.saved_videos)) {
        setSavedVideos(data.saved_videos as unknown as SavedExplainerVideo[]);
      }
    })();
  }, [noteId]);

  // Debounced auto-save whenever sticky notes or saved videos change
  useEffect(() => {
    if (!noteId || !loadedRef.current) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      await supabase
        .from("saved_notes")
        .update({ sticky_notes: stickyNotes as any, saved_videos: savedVideos as any })
        .eq("id", noteId);
    }, 800);
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
  }, [stickyNotes, savedVideos, noteId]);

  const plainText = (() => {
    const tmp = document.createElement("div");
    tmp.innerHTML = html;
    return tmp.textContent || "";
  })();

  const handleNoteClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    const btn = target.closest("button.watch-explainer") as HTMLElement | null;
    if (btn) {
      e.preventDefault();
      const query = btn.getAttribute("data-query");
      if (query) setVideoQuery(query);
      return;
    }
  };

  return (
    <div className="relative">
      <TextSelectionMenu
        containerRef={containerRef}
        notesContext={plainText}
        stickyNotes={stickyNotes}
        onStickyNotesChange={setStickyNotes}
        onVideoQuery={setVideoQuery}
      />
      <JargonTooltip tooltip={jargonTooltip} />
      <div
        ref={containerRef}
        onClick={handleNoteClick}
        className="generated-notes rounded-2xl border border-border bg-card p-6 md:p-8 shadow-sm select-text cursor-text"
        dangerouslySetInnerHTML={{ __html: sanitizeHtml(html) }}
      />
      {videoQuery && (
        <InAppVideoModal
          searchQuery={videoQuery}
          onClose={() => setVideoQuery(null)}
          savedVideos={savedVideos}
          onSaveVideo={(video) => {
            setSavedVideos((prev) => (prev.some((v) => v.videoId === video.videoId) ? prev : [...prev, video]));
          }}
        />
      )}
      {savedVideos.length > 0 && (
        <VideoBar
          savedVideos={savedVideos}
          onRemoveVideo={(videoId) => {
            setSavedVideos((prev) => prev.filter((v) => v.videoId !== videoId));
          }}
        />
      )}
    </div>
  );
}

const STUDY_TOOL_OPTIONS: { id: StudyToolType; label: string; emoji: string }[] = [
  { id: "mindmap", label: "Mind Map", emoji: "🗺️" },
  { id: "flowchart", label: "Flow Chart", emoji: "📊" },
  { id: "flashcard", label: "Flash Cards", emoji: "🃏" },
  { id: "cloze", label: "Fill-in-Blank", emoji: "📝" },
  { id: "socratic", label: "Argue With Me", emoji: "💬" },
  { id: "final-exam", label: "Final Exam", emoji: "🎓" },
];

const NOTE_FORMAT_OPTIONS: { value: NoteFormat; label: string }[] = [
  { value: "auto", label: "Auto Detect" },
  { value: "outline", label: "Outline" },
  { value: "cornell", label: "Cornell Notes" },
  { value: "concept_map", label: "Concept Map" },
  { value: "flow", label: "Flow" },
];

export default function StudyReview() {
  const location = useLocation();
  const navigate = useNavigate();
  const { generate } = useStudyToolGeneration();
  const { generate: generateNotes, isGenerating: isReformatting, generatedHtml: reformattedHtml } = useNoteGeneration();
  const { profile } = useCognitiveProfile();
  const { preferences } = useUserPreferences();
  const { user } = useAuth();

  const state = location.state as { items: ReviewItem[]; toolsToGenerate?: string[] } | null;
  const [items, setItems] = useState<ReviewItem[]>(state?.items || []);
  const toolsToGenerate = state?.toolsToGenerate || [];

  const [activeIndex, setActiveIndex] = useState(0);
  const [generatedTools, setGeneratedTools] = useState<GeneratedTool[]>([]);
  const hasStartedGeneration = useRef(false);

  // ── Study tool inline generation state ──
  const [showToolPicker, setShowToolPicker] = useState(false);
  const [selectedTools, setSelectedTools] = useState<Set<StudyToolType>>(new Set());
  const [isGeneratingTools, setIsGeneratingTools] = useState(false);

  // ── Reformat state ──
  const [isReformatMenuOpen, setIsReformatMenuOpen] = useState(false);

  const learningMode = preferences.dyslexia_font ? LEARNING_MODE.DYSLEXIA : preferences.adhd_font ? LEARNING_MODE.ADHD : LEARNING_MODE.NEUROTYPICAL;

  const toggleTool = (id: StudyToolType) => {
    setSelectedTools((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleGenerateSelectedTools = async () => {
    if (selectedTools.size === 0 || !allNotesHtml) return;
    setIsGeneratingTools(true);

    const toolIds = Array.from(selectedTools);
    const tools: GeneratedTool[] = toolIds.map((toolType) => ({
      id: `gen-${toolType}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      toolType,
      label: toolLabel[toolType] || toolType,
      result: null,
      generating: toolType !== "socratic",
      noteContent: allNotesHtml,
    }));
    setGeneratedTools((prev) => [...prev, ...tools]);
    setShowToolPicker(false);
    setSelectedTools(new Set());

    // Switch to the first new tool tab
    const firstNewTabIndex = items.length + generatedTools.length;
    setActiveIndex(firstNewTabIndex);

    await Promise.all(
      tools.filter((t) => t.toolType !== "socratic").map(async (tool) => {
        try {
          const res = await generate(tool.toolType, allNotesHtml, profile.promptAppend || undefined);
          setGeneratedTools((prev) =>
            prev.map((t) => (t.id === tool.id ? { ...t, result: res, generating: false } : t))
          );
          if (res && user) {
            const title = `${tool.label} — ${items[0]?.title || "Notes"} — ${new Date().toLocaleDateString()}`;
            await supabase.from("saved_study_materials").insert({
              user_id: user.id,
              title,
              material_type: tool.toolType,
              content: { raw: res },
              note_id: items[0]?.noteId || null,
              tags: [],
            });
          }
        } catch {
          setGeneratedTools((prev) =>
            prev.map((t) => (t.id === tool.id ? { ...t, generating: false } : t))
          );
          toast.error(`Failed to generate ${tool.label}`);
        }
      })
    );
    setIsGeneratingTools(false);
  };

  const handleReformat = (format: NoteFormat) => {
    const currentNote = items.find((i) => i.type === "note");
    if (!currentNote) return;
    setIsReformatMenuOpen(false);

    // Strip HTML to get plain text for regeneration
    const tmp = document.createElement("div");
    tmp.innerHTML = currentNote.content;
    const plainText = tmp.textContent || tmp.innerText || "";
    if (!plainText.trim()) {
      toast.error("Could not extract text from note to reformat.");
      return;
    }

    generateNotes({
      textContent: plainText,
      learningMode,
      extras: [],
      profilePrompt: profile.promptAppend || undefined,
      age: profile.age,
      noteFormat: format,
      energyMode: preferences.energy_mode || "full",
    });
  };

  // When reformat completes, update the note in state and save to DB
  useEffect(() => {
    if (!reformattedHtml || isReformatting) return;
    const noteIndex = items.findIndex((i) => i.type === "note");
    if (noteIndex < 0) return;

    const updatedItems = [...items];
    updatedItems[noteIndex] = { ...updatedItems[noteIndex], content: reformattedHtml };
    setItems(updatedItems);
    setActiveIndex(noteIndex);

    // Save reformatted content to DB
    const noteId = items[noteIndex].noteId;
    if (noteId && user) {
      supabase
        .from("saved_notes")
        .update({ content: reformattedHtml })
        .eq("id", noteId)
        .eq("user_id", user.id)
        .then(({ error }) => {
          if (error) toast.error("Failed to save reformatted notes.");
          else toast.success("Notes reformatted and saved!");
        });
    }
  }, [reformattedHtml, isReformatting]);

  // Combine notes content for tool generation
  const allNotesHtml = items
    .filter((i) => i.type === "note")
    .map((i) => i.content)
    .join("\n\n");

  // Generate tools on mount
  useEffect(() => {
    if (hasStartedGeneration.current || toolsToGenerate.length === 0 || !allNotesHtml) return;
    hasStartedGeneration.current = true;

    const tools: GeneratedTool[] = toolsToGenerate.map((toolType) => ({
      id: `gen-${toolType}-${Date.now()}`,
      toolType: toolType as StudyToolType,
      label: toolLabel[toolType] || toolType,
      result: null,
      generating: toolType !== "socratic",
      noteContent: allNotesHtml,
    }));
    setGeneratedTools(tools);

    tools
      .filter((t) => t.toolType !== "socratic")
      .forEach(async (tool) => {
        try {
          const res = await generate(tool.toolType, allNotesHtml, profile.promptAppend || undefined);
          setGeneratedTools((prev) =>
            prev.map((t) => (t.id === tool.id ? { ...t, result: res, generating: false } : t))
          );
          if (res && user) {
            const title = `${tool.label} — Study Session — ${new Date().toLocaleDateString()}`;
            await supabase.from("saved_study_materials").insert({
              user_id: user.id,
              title,
              material_type: tool.toolType,
              content: { raw: res },
              tags: [],
            });
          }
        } catch {
          setGeneratedTools((prev) =>
            prev.map((t) => (t.id === tool.id ? { ...t, generating: false } : t))
          );
          toast.error(`Failed to generate ${tool.label}`);
        }
      });
  }, [toolsToGenerate, allNotesHtml]);

  useEffect(() => {
    if (!items.length) {
      toast.error("No items selected. Go back to Library.");
    }
  }, [items.length]);

  if (!items.length) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center py-32 gap-4">
          <p className="text-muted-foreground">No items to review.</p>
          <button onClick={() => navigate("/library")} className="text-sm font-semibold text-primary hover:underline">
            ← Back to Library
          </button>
        </div>
      </Layout>
    );
  }

  const allTabs = [
    ...items.map((item, i) => ({
      key: item.id,
      label: item.title,
      type: item.type as string,
      index: i,
      isGenerated: false,
    })),
    ...generatedTools.map((tool) => ({
      key: tool.id,
      label: tool.label,
      type: "generated-tool",
      index: -1,
      isGenerated: true,
      generating: tool.generating,
    })),
  ];

  const activeTab = allTabs[activeIndex] || allTabs[0];
  const goPrev = () => setActiveIndex((i) => Math.max(0, i - 1));
  const goNext = () => setActiveIndex((i) => Math.min(allTabs.length - 1, i + 1));

  const renderMaterial = (item: ReviewItem) => {
    const raw = item.rawContent
      ? typeof item.rawContent.raw === "string"
        ? item.rawContent.raw
        : JSON.stringify(item.rawContent)
      : item.content;

    switch (item.materialType) {
      case "flashcard": return <FlashcardDeck data={raw} />;
      case "cloze": return <ClozeNotes data={raw} />;
      case "mindmap": return <div className="h-[500px]"><MindMap data={raw} /></div>;
      case "flowchart": return <div className="h-[500px]"><FlowChart data={raw} /></div>;
      case "final-exam": return <FinalExam data={raw} />;
      case "socratic": return <SocraticDebate notesHtml={item.content} />;
      default: return <pre className="text-xs whitespace-pre-wrap bg-muted/50 rounded-lg p-3">{raw}</pre>;
    }
  };

  const renderGeneratedTool = (tool: GeneratedTool) => {
    if (tool.generating) {
      return (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm font-medium text-muted-foreground">Generating {tool.label}...</p>
        </div>
      );
    }

    if (tool.toolType === "socratic") return <SocraticDebate notesHtml={tool.noteContent} />;
    if (!tool.result) return <p className="text-sm text-muted-foreground py-10 text-center">No result generated.</p>;

    const content = (() => {
      switch (tool.toolType) {
        case "flashcard": return <FlashcardDeck data={tool.result} />;
        case "cloze": return <ClozeNotes data={tool.result} />;
        case "mindmap": return <div className="h-[500px]"><MindMap data={tool.result} /></div>;
        case "flowchart": return <div className="h-[500px]"><FlowChart data={tool.result} /></div>;
        default: return <pre className="text-xs whitespace-pre-wrap">{tool.result}</pre>;
      }
    })();

    return (
      <div className="space-y-4">
        <FunFactLink topic={tool.label} context={tool.noteContent} />
        {content}
      </div>
    );
  };

  const renderActiveContent = () => {
    if (!activeTab) return null;

    if (activeTab.isGenerated) {
      const tool = generatedTools.find((t) => t.id === activeTab.key);
      if (!tool) return null;
      return renderGeneratedTool(tool);
    }

    const item = items[activeTab.index];
    if (!item) return null;

    if (item.type === "note") {
      return (
        <div className="space-y-5">
          {isReformatting && (
            <div className="flex items-center gap-3 rounded-xl border border-lavender-200 dark:border-lavender-500/30 bg-lavender-50 dark:bg-lavender-500/10 p-4">
              <Loader2 className="h-4 w-4 animate-spin text-lavender-500" />
              <span className="text-sm font-medium text-lavender-600 dark:text-lavender-300">Reformatting notes...</span>
            </div>
          )}

          <InteractiveNoteViewer html={item.content} noteId={item.noteId} />

          {/* ── Action bar: Reformat + Generate Study Tools ── */}
          <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 shadow-sm">
            {/* Reformat row */}
            <div className="flex items-center gap-2 flex-wrap">
              <RefreshCw className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
              <span className="text-xs font-medium text-muted-foreground">Reformat as:</span>
              {NOTE_FORMAT_OPTIONS.filter((f) => f.value !== "auto").map((fmt) => (
                <button
                  key={fmt.value}
                  onClick={() => handleReformat(fmt.value)}
                  disabled={isReformatting}
                  className="rounded-lg bg-lavender-100 dark:bg-lavender-500/15 px-2.5 py-1 text-[11px] font-medium text-lavender-600 dark:text-lavender-300 hover:bg-lavender-200 dark:hover:bg-lavender-500/25 transition-colors disabled:opacity-50"
                >
                  {fmt.label}
                </button>
              ))}
            </div>

            {/* Study tools row */}
            <div className="flex items-center gap-2 flex-wrap">
              <Sparkles className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
              <span className="text-xs font-medium text-muted-foreground">Generate study tools:</span>
              {!showToolPicker ? (
                <button
                  onClick={() => setShowToolPicker(true)}
                  className="rounded-lg bg-sage-100 dark:bg-sage-500/15 px-3 py-1 text-[11px] font-semibold text-sage-600 dark:text-sage-300 hover:bg-sage-200 dark:hover:bg-sage-500/25 transition-colors"
                >
                  Choose Tools
                </button>
              ) : (
                <div className="flex items-center gap-1.5 flex-wrap">
                  {STUDY_TOOL_OPTIONS.map((tool) => (
                    <button
                      key={tool.id}
                      onClick={() => toggleTool(tool.id)}
                      className={`rounded-lg px-2.5 py-1 text-[11px] font-medium transition-colors ${
                        selectedTools.has(tool.id)
                          ? "bg-primary/15 text-primary ring-1 ring-primary/30"
                          : "bg-muted text-muted-foreground hover:bg-muted/80"
                      }`}
                    >
                      {tool.emoji} {tool.label}
                    </button>
                  ))}
                  <button
                    onClick={handleGenerateSelectedTools}
                    disabled={selectedTools.size === 0 || isGeneratingTools}
                    className="rounded-lg bg-sage-200 dark:bg-sage-500/20 px-3 py-1 text-[11px] font-bold text-sage-700 dark:text-sage-300 hover:bg-sage-300 dark:hover:bg-sage-500/30 transition-colors disabled:opacity-40"
                  >
                    {isGeneratingTools ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      `Generate ${selectedTools.size > 0 ? selectedTools.size : ""}`
                    )}
                  </button>
                  <button
                    onClick={() => { setShowToolPicker(false); setSelectedTools(new Set()); }}
                    className="text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      );
    }
    return renderMaterial(item);
  };

  return (
    <Layout>
      <div className="min-h-screen flex flex-col">
        {/* Sticky top bar */}
        <div className="sticky top-14 z-30 border-b border-border bg-card/95 backdrop-blur-sm">
          <div className="container max-w-6xl flex items-center gap-3 py-2.5">
            <button
              onClick={() => navigate("/library")}
              className="rounded-lg border border-border p-2 text-muted-foreground hover:bg-muted transition-colors shrink-0"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            {/* Tab strip */}
            <div className="flex-1 overflow-x-auto scrollbar-none">
              <div className="flex gap-1">
                {allTabs.map((tab, i) => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveIndex(i)}
                    className={`shrink-0 flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-all whitespace-nowrap ${
                      i === activeIndex
                        ? "bg-primary/10 text-primary shadow-sm"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    }`}
                  >
                    {tab.type === "note" ? (
                      <FileText className="h-3.5 w-3.5" />
                    ) : tab.type === "generated-tool" ? (
                      (tab as any).generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <BookOpen className="h-3.5 w-3.5" />
                    ) : (
                      <BookOpen className="h-3.5 w-3.5" />
                    )}
                    <span className="max-w-[140px] truncate">{tab.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Prev / Next */}
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={goPrev}
                disabled={activeIndex === 0}
                className="rounded-lg border border-border p-1.5 text-muted-foreground hover:bg-muted disabled:opacity-30 transition-colors"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-xs font-medium text-muted-foreground px-1 tabular-nums">
                {activeIndex + 1}/{allTabs.length}
              </span>
              <button
                onClick={goNext}
                disabled={activeIndex === allTabs.length - 1}
                className="rounded-lg border border-border p-1.5 text-muted-foreground hover:bg-muted disabled:opacity-30 transition-colors"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Content area */}
        <div className="flex-1 container max-w-4xl py-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab?.key}
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            >
              {/* Item header */}
              <div className="mb-5 flex items-center gap-2">
                {activeTab?.type === "note" ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-sage-100 dark:bg-sage-700/20 px-2.5 py-1 text-xs font-semibold text-sage-700 dark:text-sage-300">
                    <FileText className="h-3 w-3" /> Note
                  </span>
                ) : activeTab?.type === "generated-tool" ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-peach-100 dark:bg-peach-400/15 px-2.5 py-1 text-xs font-semibold text-peach-600 dark:text-peach-300">
                    <BookOpen className="h-3 w-3" /> Generated
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-lavender-100 dark:bg-lavender-400/15 px-2.5 py-1 text-xs font-semibold text-lavender-500 dark:text-lavender-300">
                    <BookOpen className="h-3 w-3" /> {materialTypeLabel[items[activeTab?.index || 0]?.materialType || ""] || "Material"}
                  </span>
                )}
                <h2 className="text-lg font-bold text-foreground truncate">{activeTab?.label}</h2>
              </div>

              {renderActiveContent()}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </Layout>
  );
}
