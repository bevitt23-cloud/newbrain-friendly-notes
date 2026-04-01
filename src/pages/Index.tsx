import { useState, useCallback, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "@/components/Layout";
import ContentUploader from "@/components/ContentUploader";

import NoteExtras from "@/components/NoteExtras";
import FloatingStudyBar from "@/components/FloatingStudyBar";
import StudyToolsInline from "@/components/StudyToolsInline";
import GeneratedNotes from "@/components/GeneratedNotes";
import type { StickyNoteData } from "@/components/TextSelectionMenu";
import type { SavedExplainerVideo } from "@/components/InAppVideoModal";
import DyslexiaSettings from "@/components/DyslexiaSettings";
import { useCognitiveProfile } from "@/hooks/useCognitiveProfile";
import { useAuth } from "@/hooks/useAuth";
import { useUserPreferences } from "@/hooks/useUserPreferences";
import { useNotesContext } from "@/hooks/useNotesContext";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import { Brain, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import logo from "@/assets/logo.jpeg";

const Index = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { preferences } = useUserPreferences();
  const { profile, loading: profileLoading } = useCognitiveProfile();
  const {
    generatedHtml, isGenerating, error, uploadProgress, generate, reset,
    quizQuestions, isGeneratingQuiz,
    savedNoteId, savedNoteTitle, setSavedNoteId, setSavedNoteTitle, autoSavedRef,
  } = useNotesContext();

  const learningMode = preferences.dyslexia_font ? "dyslexia" : "adhd";
  const bionicEnabled = preferences.bionic_reading;
  const pendingMetaRef = useRef<{ folder: string; tags: string[]; shouldSaveToLibrary: boolean }>({ folder: "Unsorted", tags: [], shouldSaveToLibrary: true });
  const [activeExtras, setActiveExtras] = useState<string[]>([]);
  const [stickyNotes, setStickyNotes] = useState<StickyNoteData[]>([]);
  const [savedVideos, setSavedVideos] = useState<SavedExplainerVideo[]>([]);
  const [dyslexiaSettings, setDyslexiaSettings] = useState({
    lineSpacing: 1.8,
    fontSize: 1.1,
    letterSpacing: 0.04,
    wordSpacing: 0.2,
  });

  // Derive activeExtras purely from saved preferences (source of truth)
  useEffect(() => {
    const prefMap: Array<[boolean, string]> = [
      [preferences.tldr_default, "tldr"],
      [preferences.retention_quiz_default, "retention_quiz"],
      
      [preferences.feynman_default, "feynman"],
      [preferences.recall_prompts_default, "recall"],
      [preferences.simplify_default, "simplify"],
      [preferences.why_care_default, "why_care"],
      [preferences.jargon_default, "jargon"],
      [preferences.mindmap_default, "mindmap"],
      [preferences.flowchart_default, "flowchart"],
    ];
    // Note: mindmap & flowchart are Study Tools but still sent as extras to the AI
    const extras: string[] = [];
    for (const [enabled, key] of prefMap) {
      if (enabled) extras.push(key);
    }
    setActiveExtras(extras);
  }, [
    preferences.tldr_default, preferences.retention_quiz_default,
    preferences.feynman_default,
    preferences.recall_prompts_default, preferences.simplify_default,
    preferences.why_care_default, preferences.jargon_default,
    preferences.mindmap_default, preferences.flowchart_default,
  ]);

  const handleGenerate = useCallback(
    (data: { textContent?: string; files?: File[]; youtubeUrl?: string; websiteUrl?: string; instructions: string; folder: string; tags: string[]; shouldSaveToLibrary: boolean }) => {
      autoSavedRef.current = false;
      setSavedNoteId(null);
      setSavedNoteTitle("");
      setStickyNotes([]);
      setSavedVideos([]);
      pendingMetaRef.current = { folder: data.folder, tags: data.tags, shouldSaveToLibrary: data.shouldSaveToLibrary };
      generate({
        ...data,
        learningMode: learningMode,
        extras: activeExtras,
        profilePrompt: profile.promptAppend || undefined,
        age: profile.age,
      });
    },
    [generate, learningMode, activeExtras, profile.promptAppend, profile.age]
  );

  // Auto-save notes when generated
  useEffect(() => {
    if (!generatedHtml || !user || autoSavedRef.current || isGenerating) return;
    autoSavedRef.current = true;

    const titleMatch = generatedHtml.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i) || generatedHtml.match(/<h2[^>]*>([\s\S]*?)<\/h2>/i);
    const tmpDiv = document.createElement("div");
    tmpDiv.innerHTML = titleMatch?.[1] || "";
    const title = tmpDiv.textContent?.trim() || "Study Notes";

    setSavedNoteTitle(title);

    // Skip DB save if user opted out
    if (!pendingMetaRef.current.shouldSaveToLibrary) {
      console.log("Skipping auto-save — user chose not to save to Library");
      return;
    }

    (async () => {
      const meta = pendingMetaRef.current;
      const { data: savedData, error: saveErr } = await supabase.from("saved_notes").insert({
        user_id: user.id,
        title,
        content: generatedHtml,
        source_type: "generated",
        learning_mode: learningMode,
        folder: meta.folder,
        tags: meta.tags,
        sticky_notes: [],
        saved_videos: [],
      }).select("id").single();

      if (saveErr) {
        console.error("Auto-save failed:", saveErr);
      } else {
        setSavedNoteId(savedData.id);
        toast.success("Notes auto-saved to Library!");
      }
    })();
  }, [generatedHtml, user, isGenerating, learningMode]);

  // Auto-save sticky notes + saved explainer videos to the corresponding library note.
  useEffect(() => {
    if (!savedNoteId) return;
    const timer = setTimeout(async () => {
      await supabase
        .from("saved_notes")
        .update({
          sticky_notes: stickyNotes,
          saved_videos: savedVideos,
        })
        .eq("id", savedNoteId);
    }, 800);
    return () => clearTimeout(timer);
  }, [stickyNotes, savedVideos, savedNoteId]);

  if (error) {
    toast.error(error);
  }

  const notesGenerated = generatedHtml.length > 0;
  const showWizardBanner = user && !profileLoading && !profile.wizardCompleted;

  return (
    <Layout>
      {/* Hero */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-sage-100/70 via-sky-100/50 to-lavender-100/30 dark:from-sage-500/10 dark:via-sky-500/10 dark:to-lavender-500/10" />
        <div className="absolute inset-0 dark:hidden">
          <div className="absolute -top-24 -right-24 h-72 w-72 rounded-full bg-gradient-to-br from-sky-200/30 to-sage-200/20 blur-3xl" />
          <div className="absolute -bottom-16 -left-16 h-60 w-60 rounded-full bg-gradient-to-tr from-sage-200/30 to-sky-200/20 blur-3xl" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-48 w-96 rounded-full bg-gradient-to-r from-sage-300/15 via-sky-200/15 to-lavender-300/10 blur-3xl" />
        </div>
        {/* Watermark logo */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <img src={logo} alt="" className="h-64 w-64 md:h-80 md:w-80 rounded-[2rem] opacity-[0.10] dark:opacity-[0.07] select-none" />
        </div>
        <div className="container relative max-w-3xl py-6 md:py-10">
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="text-center">
            <motion.div
              className="mx-auto mb-5 relative w-fit"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.1, type: "spring", stiffness: 300, damping: 20 }}
            >
              <img
                src={logo}
                alt="Brain-Friendly Notes"
                className="h-28 w-28 md:h-36 md:w-36 rounded-[1.5rem] shadow-[0_12px_50px_-8px_hsl(var(--primary)/0.45),0_4px_16px_-4px_hsl(var(--primary)/0.25)] ring-[3px] ring-primary/30 relative z-10"
              />
              {/* Layered depth auras */}
              <div className="absolute -inset-2 rounded-[1.8rem] bg-gradient-to-br from-sage-500/25 via-lavender-400/20 to-peach-400/15 blur-lg -z-10" />
              <div className="absolute -inset-5 rounded-[2.5rem] bg-gradient-to-br from-sage-400/15 via-sky-300/10 to-lavender-400/10 blur-2xl -z-20" />
              <div className="absolute -inset-8 rounded-[3rem] bg-gradient-to-tr from-primary/10 via-transparent to-lavender-500/8 blur-3xl -z-30" />
            </motion.div>
            <div className="mx-auto mb-3 inline-flex items-center gap-2 rounded-full bg-sage-500/10 px-4 py-1.5 text-xs font-semibold text-sage-700 dark:text-sage-300 ring-1 ring-sage-500/20 backdrop-blur-sm">
              🧠 Built for every kind of mind
            </div>
            <h1 className="text-2xl font-extrabold tracking-tight text-foreground/90 dark:text-foreground/75 md:text-3xl lg:text-4xl">
              Study notes that work{" "}
              <span className="bg-gradient-to-r from-sage-600 via-lavender-500 to-peach-500 bg-clip-text text-transparent">
                with your brain
              </span>
            </h1>
            <p className="mx-auto mt-3 max-w-lg text-sm text-muted-foreground md:text-base">
              Upload anything. Get notes tailored to how you actually learn.
            </p>

            {showWizardBanner && (
              <motion.button
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                onClick={() => navigate("/setup")}
                className="mt-3 inline-flex items-center gap-2 rounded-xl border border-lavender-200 dark:border-lavender-400/20 bg-gradient-to-r from-lavender-50 to-peach-50 dark:from-lavender-500/10 dark:to-peach-500/10 px-5 py-2 text-sm font-semibold text-foreground shadow-sm transition-all hover:shadow-md hover:scale-[1.02]"
              >
                <Brain className="h-4 w-4 text-lavender-500" />
                Set up your learning profile
                <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
              </motion.button>
            )}

            <div className="mt-4 flex items-center justify-center gap-3">
              {learningMode === "dyslexia" && (
                <DyslexiaSettings settings={dyslexiaSettings} onChange={setDyslexiaSettings} />
              )}
            </div>
          </motion.div>
        </div>
      </div>

      <div className="container max-w-4xl py-8 space-y-6">
        {!notesGenerated && (
          <>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="overflow-hidden rounded-2xl border border-border bg-card shadow-xl shadow-sage-200/20 dark:shadow-none"
            >
              <div className="h-1.5 bg-gradient-to-r from-sage-400 via-lavender-400 to-peach-400" />
              <div className="p-5 md:p-8 bg-teal-50 dark:bg-muted/30">
                <ContentUploader onGenerate={handleGenerate} isGenerating={isGenerating} uploadProgress={uploadProgress} />
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="rounded-2xl border border-border bg-card/60 backdrop-blur-sm p-4 md:p-5"
            >
              <NoteExtras activeExtras={activeExtras} onExtrasChange={setActiveExtras} />
            </motion.div>
          </>
        )}

        {(notesGenerated || isGenerating) && (
          <GeneratedNotes
            html={generatedHtml}
            isGenerating={isGenerating}
            bionicEnabled={bionicEnabled}
            dyslexiaMode={learningMode === "dyslexia"}
            dyslexiaSettings={dyslexiaSettings}
            onReset={reset}
            quizQuestions={quizQuestions}
            isGeneratingQuiz={isGeneratingQuiz}
            stickyNotes={stickyNotes}
            onStickyNotesChange={setStickyNotes}
            savedVideos={savedVideos}
            onSaveVideo={(video) => {
              setSavedVideos((prev) => (prev.some((v) => v.videoId === video.videoId) ? prev : [...prev, video]));
            }}
          />
        )}

        {notesGenerated && (
          <StudyToolsInline notesHtml={generatedHtml} linkedNoteId={savedNoteId} noteTitle={savedNoteTitle} />
        )}
      </div>

      <FloatingStudyBar />
    </Layout>
  );
};

export default Index;
