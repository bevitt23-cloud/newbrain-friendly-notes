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
    (data: { chapters: Array<{ id: string; title: string; text: string }>; youtubeUrl?: string; websiteUrl?: string; saveYouTubeVideo?: boolean; instructions: string; folder: string; tags: string[]; shouldSaveToLibrary: boolean; backgroundProcessingEnabled?: boolean; images?: Array<{ data: string; mimeType: string } | File | Blob> }) => {
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
    [generate, learningMode, activeExtras, profile.promptAppend, profile.age, autoSavedRef, setSavedNoteId, setSavedNoteTitle]
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
        sticky_notes: [] as unknown as import("@/integrations/supabase/types").Json,
        saved_videos: [] as unknown as import("@/integrations/supabase/types").Json,
      }).select("id").single();

      if (saveErr) {
        console.error("Auto-save failed:", saveErr);
      } else {
        setSavedNoteId(savedData.id);
        toast.success("Notes auto-saved to Library!");
      }
    })();
  }, [generatedHtml, user, isGenerating, learningMode, autoSavedRef, setSavedNoteId, setSavedNoteTitle]);

  // Auto-save sticky notes + saved explainer videos to the corresponding library note.
  useEffect(() => {
    if (!savedNoteId) return;
    const timer = setTimeout(async () => {
      await supabase
        .from("saved_notes")
        .update({
          sticky_notes: stickyNotes as unknown as import("@/integrations/supabase/types").Json,
          saved_videos: savedVideos as unknown as import("@/integrations/supabase/types").Json,
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
      <div className="relative overflow-hidden bg-gradient-to-b from-muted/40 to-transparent dark:from-muted/20">
        <div className="container relative max-w-3xl py-8 md:py-12">
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="text-center">
            <motion.div
              className="mx-auto mb-5 relative w-fit"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.1, type: "spring", stiffness: 300, damping: 24 }}
            >
              <img
                src={logo}
                alt="Brain-Friendly Notes"
                className="h-20 w-20 md:h-24 md:w-24 rounded-2xl shadow-elevated ring-1 ring-border/40 relative z-10"
              />
            </motion.div>
            <div className="mx-auto mb-3 inline-flex items-center gap-2 rounded-full bg-primary/8 px-4 py-1.5 text-xs font-semibold text-primary ring-1 ring-primary/15">
              Built for every kind of mind
            </div>
            <h1 className="text-2xl font-extrabold tracking-tight text-foreground md:text-3xl lg:text-4xl">
              Study notes that work{" "}
              <span className="text-primary">
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
                className="mt-4 inline-flex items-center gap-2 rounded-xl border border-border bg-card px-5 py-2.5 text-sm font-semibold text-foreground shadow-soft transition-all hover:shadow-elevated"
              >
                <Brain className="h-4 w-4 text-primary" />
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
              className="overflow-hidden rounded-2xl border border-border/60 bg-card shadow-elevated"
            >
              <div className="h-1 bg-gradient-to-r from-primary/60 via-primary/40 to-primary/20" />
              <div className="p-5 md:p-8">
                <ContentUploader onGenerate={handleGenerate} isGenerating={isGenerating} uploadProgress={uploadProgress} />
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="rounded-2xl border border-border/60 bg-card p-4 md:p-5 shadow-soft"
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
