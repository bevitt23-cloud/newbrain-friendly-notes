import { useState, useCallback, useEffect, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import Layout from "@/components/Layout";
import ContentUploader from "@/components/ContentUploader";
import type { ChapterGenerateData } from "@/components/ContentUploader";
import ChapterGenerationProgress from "@/components/ChapterGenerationProgress";
import NoteExtras from "@/components/NoteExtras";
// FloatingStudyBar is now in Layout.tsx (global, persists across pages)
import StudyToolsInline from "@/components/StudyToolsInline";
import GeneratedNotes from "@/components/GeneratedNotes";
import FirstTimeTutorial, { useFirstTimeTutorial } from "@/components/FirstTimeTutorial";
import type { StickyNoteData } from "@/components/TextSelectionMenu";
import type { SavedExplainerVideo } from "@/components/InAppVideoModal";
import VideoBar from "@/components/VideoBar";
import DyslexiaSettings from "@/components/DyslexiaSettings";
import { useCognitiveProfile } from "@/hooks/useCognitiveProfile";
import { useAuth } from "@/hooks/useAuth";
import { useUserPreferences } from "@/hooks/useUserPreferences";
import { useNotesContext } from "@/hooks/useNotesContext";
import { useChapterGeneration } from "@/hooks/useChapterGeneration";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import {
  Brain, ArrowRight, Upload, Sparkles, BookOpen,
  Eye, MessageCircle, GitBranch, Map, Layers,
  ChevronRight, Sun, Moon, RefreshCw,
} from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import logo from "@/assets/logo.jpeg";
import { LEARNING_MODE, DEFAULT_FOLDER } from "@/lib/constants";
import { extractYouTubeVideoId } from "@/lib/youtube";
import { buildFolderPath } from "@/lib/folderUtils";

/* ═══════════════════════════════════════════════════════════════
   LANDING PAGE — shown to unauthenticated visitors
   ═══════════════════════════════════════════════════════════════ */

const fade = (delay = 0) => ({
  initial: { opacity: 0, y: 20 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-40px" },
  transition: { duration: 0.6, delay, ease: "easeOut" },
});

const LANDING_FONTS = [
  {
    key: "lexend" as const,
    font: "'Lexend', system-ui, sans-serif",
    cls: "font-lexend",
    activeClass: "bg-sage-100 text-sage-700 shadow-sm ring-1 ring-sage-300/50 dark:bg-sage-500/20 dark:text-sage-300 dark:ring-sage-400/30",
    title: "Lexend",
  },
  {
    key: "opendyslexic" as const,
    font: "'OpenDyslexic', sans-serif",
    cls: "font-opendyslexic",
    activeClass: "bg-lavender-100 text-lavender-600 shadow-sm ring-1 ring-lavender-300/50 dark:bg-lavender-500/20 dark:text-lavender-300 dark:ring-lavender-400/30",
    title: "OpenDyslexic",
  },
  {
    key: "arial" as const,
    font: "'Arial', 'Helvetica Neue', sans-serif",
    cls: "font-arial",
    activeClass: "bg-sky-100 text-sky-700 shadow-sm ring-1 ring-sky-300/50 dark:bg-sky-500/20 dark:text-sky-300 dark:ring-sky-400/30",
    title: "Arial",
  },
];

function LandingPage() {
  const { resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const [activeFont, setActiveFont] = useState<string>("lexend");
  const currentFont = LANDING_FONTS.find((f) => f.key === activeFont) || LANDING_FONTS[0];

  // Apply font to body so entire page picks it up (matches Layout.tsx pattern)
  useEffect(() => {
    document.body.style.fontFamily = currentFont.font;
    document.body.classList.toggle("dyslexia-active", currentFont.key === "opendyslexic");
    return () => {
      document.body.style.fontFamily = "";
      document.body.classList.remove("dyslexia-active");
    };
  }, [currentFont]);

  return (
    <div className={`min-h-screen flex flex-col ${currentFont.cls} bg-background text-foreground`}>
      {/* ── Nav ── */}
      <nav className="sticky top-0 z-50 border-b border-border/40 bg-background/80 backdrop-blur-lg">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3">
          <Link to="/" className="flex items-center gap-2.5">
            <img
              src={logo}
              alt="Brain-Friendly Notes"
              className="h-9 w-9 rounded-xl shadow-soft ring-1 ring-border/30"
            />
            <span className="text-base font-bold tracking-tight text-foreground">
              Brain-Friendly Notes
            </span>
          </Link>

          <div className="flex items-center gap-3">
            {/* Font style toggle — matches LearningModeSelector */}
            <div className="flex rounded-xl bg-muted/60 p-1 ring-1 ring-border/40">
              {LANDING_FONTS.map((opt) => (
                <button
                  key={opt.key}
                  onClick={() => setActiveFont(opt.key)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all duration-200 ${
                    activeFont === opt.key
                      ? opt.activeClass
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  style={{ fontFamily: opt.font }}
                  title={opt.title}
                >
                  abc
                </button>
              ))}
            </div>

            {/* Dark mode toggle — matches Header.tsx */}
            <button
              onClick={() => setTheme(isDark ? "light" : "dark")}
              aria-label="Toggle theme"
              className="relative flex h-6 w-11 items-center rounded-full bg-muted p-0.5 transition-colors"
            >
              <motion.div
                className="flex h-5 w-5 items-center justify-center rounded-full bg-card shadow-sm"
                animate={{ x: isDark ? 20 : 0 }}
                transition={{ type: "spring", stiffness: 500, damping: 30 }}
              >
                {isDark ? <Moon className="h-3 w-3 text-lavender-400" /> : <Sun className="h-3 w-3 text-peach-400" />}
              </motion.div>
            </button>

            <div className="h-5 w-px bg-border/60" />

            <Button variant="ghost" size="sm" asChild>
              <Link to="/auth">Log in</Link>
            </Button>
            <Button size="sm" asChild>
              <Link to="/auth">Sign up</Link>
            </Button>
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="relative overflow-hidden">
        {/* Warm cream base with soft sage & sky wash */}
        <div className="absolute inset-0 -z-10 bg-gradient-to-br from-sage-50/80 via-background to-sky-50/60 dark:from-sage-50/20 dark:via-background dark:to-sky-50/15" />
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_70%_50%_at_50%_0%,hsl(var(--sage-200)/0.15),transparent)]" />

        {/* Brain watermark — blend removes white bg */}
        <img
          src={logo}
          alt=""
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 top-1/2 z-0 h-[500px] w-[500px] -translate-x-1/2 -translate-y-1/2 object-contain opacity-[0.18] mix-blend-multiply dark:opacity-[0.14] dark:mix-blend-screen dark:invert"
        />

        <div className="relative z-10 mx-auto max-w-3xl px-5 pb-16 pt-20 md:pb-24 md:pt-28 text-center">
          <motion.div {...fade(0)}>
            <div className="mx-auto mb-5 inline-flex items-center gap-2 rounded-full bg-primary/8 px-4 py-1.5 text-xs font-semibold text-primary ring-1 ring-primary/15">
              <Sparkles className="h-3.5 w-3.5" />
              Built for every kind of mind
            </div>
          </motion.div>

          <motion.h1
            {...fade(0.1)}
            className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl md:text-5xl lg:text-[3.25rem] leading-[1.15] [text-shadow:_1px_1px_0_rgba(255,255,255,0.7),_-1px_-1px_0_rgba(255,255,255,0.7),_1px_-1px_0_rgba(255,255,255,0.7),_-1px_1px_0_rgba(255,255,255,0.7),_0_2px_4px_rgba(0,0,0,0.08),_0_4px_8px_rgba(0,0,0,0.04)]"
          >
            Study smarter. Not harder.{" "}
            <span className="bg-gradient-to-r from-sage-400 via-primary to-sky-300 bg-clip-text text-transparent drop-shadow-[0_2px_3px_rgba(0,0,0,0.1)] [text-shadow:none]">
              Notes designed for how your brain actually works.
            </span>
          </motion.h1>

          <motion.p
            {...fade(0.2)}
            className="mx-auto mt-5 max-w-xl text-base text-muted-foreground md:text-lg leading-relaxed"
          >
            Automatically transform your lectures, PDFs, and YouTube videos into
            personalized, brain-friendly study materials.
          </motion.p>

          <motion.div {...fade(0.3)} className="mt-8">
            <Button size="lg" className="rounded-xl px-8 text-base font-bold shadow-elevated hover:shadow-elevated-hover hover:-translate-y-0.5 transition-all duration-200" asChild>
              <Link to="/auth">
                Start Learning for Free
                <ArrowRight className="ml-1.5 h-4 w-4" />
              </Link>
            </Button>
            <p className="mt-3 text-xs text-muted-foreground/70">
              No credit card required
            </p>
          </motion.div>
        </div>
      </section>

      {/* ── How It Works ── */}
      <section className="border-y border-border/50 bg-card shadow-sm">
        <div className="mx-auto max-w-4xl px-5 py-16 md:py-20">
          <motion.h2
            {...fade(0)}
            className="text-center text-sm font-bold uppercase tracking-widest text-muted-foreground mb-10"
          >
            How It Works
          </motion.h2>

          <div className="grid gap-8 md:grid-cols-3 md:gap-6">
            {[
              {
                step: "1",
                icon: Upload,
                title: "Upload anything",
                desc: "Paste text, drop a PDF, link a YouTube video, or enter any website URL.",
                color: "text-sage-400",
                bg: "bg-sage-50 dark:bg-sage-100",
              },
              {
                step: "2",
                icon: Sparkles,
                title: "AI transforms it",
                desc: "Our AI reformats your material with visual breaks, chunked sections, and your preferred fonts.",
                color: "text-primary",
                bg: "bg-sky-50 dark:bg-sky-100",
              },
              {
                step: "3",
                icon: BookOpen,
                title: "Study your way",
                desc: "Flash cards, mind maps, flow charts, quizzes — generated instantly from your notes.",
                color: "text-sage-400",
                bg: "bg-sage-50 dark:bg-sage-100",
              },
            ].map((item, i) => (
              <motion.div
                key={item.step}
                {...fade(i * 0.1)}
                className="flex flex-col items-center text-center"
              >
                <div className={`mb-4 flex h-14 w-14 items-center justify-center rounded-2xl shadow-elevated ${item.bg}`}>
                  <item.icon className={`h-6 w-6 ${item.color}`} />
                </div>
                <h3 className="text-sm font-bold text-foreground mb-1.5">{item.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed max-w-[260px]">
                  {item.desc}
                </p>
              </motion.div>
            ))}
          </div>

          {/* Connector arrows (desktop only) */}
          <div className="hidden md:flex items-center justify-center gap-[10.5rem] -mt-[7.5rem] mb-12 pointer-events-none">
            <ChevronRight className="h-5 w-5 text-border" />
            <ChevronRight className="h-5 w-5 text-border" />
          </div>
        </div>
      </section>

      {/* ── Features Grid ── */}
      <section className="mx-auto max-w-5xl px-5 py-16 md:py-24">
        <motion.div {...fade(0)} className="text-center mb-12">
          <h2 className="text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">
            Tools that meet your brain where it is
          </h2>
          <p className="mt-3 text-base text-muted-foreground max-w-lg mx-auto">
            Every feature is designed to reduce cognitive load and make studying feel effortless.
          </p>
        </motion.div>

        <div className="grid gap-6 md:grid-cols-3">
          {/* Card 1 — Sage */}
          <motion.div
            {...fade(0)}
            className="group rounded-2xl border border-sage-200/60 dark:border-sage-200/30 bg-gradient-to-br from-sage-50 to-sage-100 dark:from-sage-50/40 dark:to-sage-100/30 p-6 shadow-elevated transition-all duration-300 hover:shadow-elevated-hover hover:-translate-y-1"
          >
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-sage-100 dark:bg-sage-200/60 shadow-soft">
              <Eye className="h-5 w-5 text-sage-500 dark:text-sage-300" />
            </div>
            <h3 className="text-base font-bold text-foreground mb-2">Sensory-Safe UI</h3>
            <ul className="space-y-2 text-sm text-muted-foreground leading-relaxed">
              <li className="flex items-start gap-2">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-sage-400" />
                Adjustable fonts — Lexend, OpenDyslexic, Arial
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-sage-400" />
                Bionic Reading for sustained focus
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-sage-400" />
                Custom letter, word, and line spacing
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-sage-400" />
                Warm color palette with visual breaks
              </li>
            </ul>
          </motion.div>

          {/* Card 2 — Sky */}
          <motion.div
            {...fade(0.1)}
            className="group rounded-2xl border border-sky-200/60 dark:border-sky-200/30 bg-gradient-to-br from-sky-50 to-sky-100 dark:from-sky-50/40 dark:to-sky-100/30 p-6 shadow-elevated transition-all duration-300 hover:shadow-elevated-hover hover:-translate-y-1"
          >
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-sky-100 dark:bg-sky-200/60 shadow-soft">
              <MessageCircle className="h-5 w-5 text-primary dark:text-sky-300" />
            </div>
            <h3 className="text-base font-bold text-foreground mb-2">Active Engagement</h3>
            <ul className="space-y-2 text-sm text-muted-foreground leading-relaxed">
              <li className="flex items-start gap-2">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-sky-300" />
                AI Socratic debates that challenge your thinking
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-sky-300" />
                Interactive flashcards with spaced repetition
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-sky-300" />
                Fill-in-the-blank and retention quizzes
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-sky-300" />
                Recall prompts and Feynman checks
              </li>
            </ul>
          </motion.div>

          {/* Card 3 — Teal */}
          <motion.div
            {...fade(0.15)}
            className="group rounded-2xl border border-teal-200/60 dark:border-teal-200/30 bg-gradient-to-br from-teal-50 to-teal-100 dark:from-teal-50/40 dark:to-teal-100/30 p-6 shadow-elevated transition-all duration-300 hover:shadow-elevated-hover hover:-translate-y-1"
          >
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-teal-100 dark:bg-teal-200/60 shadow-soft">
              <Map className="h-5 w-5 text-teal-400 dark:text-teal-300" />
            </div>
            <h3 className="text-base font-bold text-foreground mb-2">Visual Learning</h3>
            <ul className="space-y-2 text-sm text-muted-foreground leading-relaxed">
              <li className="flex items-start gap-2">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-teal-300" />
                Auto-generated interactive mind maps
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-teal-300" />
                Process flowcharts with click-to-expand detail
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-teal-300" />
                Curated YouTube explainer videos per section
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-teal-300" />
                Color-coded note sections for easy scanning
              </li>
            </ul>
          </motion.div>
        </div>

        {/* Bottom CTA */}
        <motion.div {...fade(0.1)} className="mt-14 text-center">
          <Button size="lg" className="rounded-xl px-8 text-base font-bold shadow-elevated hover:shadow-elevated-hover hover:-translate-y-0.5 transition-all duration-200" asChild>
            <Link to="/auth">
              Get Started — It's Free
              <ArrowRight className="ml-1.5 h-4 w-4" />
            </Link>
          </Button>
        </motion.div>
      </section>

      {/* ── Footer ── */}
      <footer className="mt-auto border-t border-border/40 bg-card/50">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 px-5 py-8 sm:flex-row sm:justify-between">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <img src={logo} alt="" className="h-5 w-5 rounded-md" />
            <span>&copy; {new Date().getFullYear()} Brain-Friendly Notes</span>
          </div>
          <div className="flex items-center gap-6 text-sm text-muted-foreground">
            <Link to="/about" className="hover:text-foreground transition-colors">About</Link>
            <Link to="/privacy" className="hover:text-foreground transition-colors">Privacy</Link>
            <Link to="/support" className="hover:text-foreground transition-colors">Support</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   WORKSPACE — shown to authenticated users (unchanged logic)
   ═══════════════════════════════════════════════════════════════ */

function Workspace() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { preferences } = useUserPreferences();
  const { profile, loading: profileLoading } = useCognitiveProfile();
  const {
    generatedHtml, isGenerating, error, uploadProgress, generate, reset,
    quizQuestions, isGeneratingQuiz,
    savedNoteId, savedNoteTitle, setSavedNoteId, setSavedNoteTitle, autoSavedRef,
  } = useNotesContext();

  const {
    chapterStates, isRunning: isChapterRunning, currentIndex: chapterCurrentIndex,
    completedCount: chapterCompletedCount, failedCount: chapterFailedCount,
    totalCount: chapterTotalCount, startBackgroundGeneration, startBackgroundFileGeneration,
    stopAfterCurrent, resetChapterGeneration,
  } = useChapterGeneration();
  const [chapterBookTitle, setChapterBookTitle] = useState("");

  const learningMode = preferences.dyslexia_font ? LEARNING_MODE.DYSLEXIA : preferences.adhd_font ? LEARNING_MODE.ADHD : LEARNING_MODE.NEUROTYPICAL;
  const bionicEnabled = preferences.bionic_reading;
  const pendingMetaRef = useRef<{ folder: string; tags: string[]; shouldSaveToLibrary: boolean }>({ folder: DEFAULT_FOLDER, tags: [], shouldSaveToLibrary: true });
  const [activeExtras, setActiveExtras] = useState<string[]>(["visual_learner"]);
  const [stickyNotes, setStickyNotes] = useState<StickyNoteData[]>([]);
  const [savedVideos, setSavedVideos] = useState<SavedExplainerVideo[]>([]);
  const [dyslexiaSettings, setDyslexiaSettings] = useState({
    lineSpacing: 1.8,
    fontSize: 1.1,
    letterSpacing: 0.04,
    wordSpacing: 0.2,
  });

  // Extras managed by DB preferences — synced on preference change
  const managedExtras = new Set(["tldr", "retention_quiz", "feynman", "recall", "simplify", "why_care", "jargon", "mindmap", "flowchart"]);
  // Low battery mode: only keep lightweight extras
  const LOW_BATTERY_EXTRAS = new Set(["tldr", "jargon", "simplify"]);
  const isLowBattery = preferences.energy_mode === "low";

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
    setActiveExtras((prev) => {
      const manual = prev.filter((e) => !managedExtras.has(e));
      let fromPrefs: string[] = [];
      for (const [enabled, key] of prefMap) {
        if (enabled) fromPrefs.push(key);
      }
      // Low battery: strip heavy extras
      if (isLowBattery) {
        fromPrefs = fromPrefs.filter((e) => LOW_BATTERY_EXTRAS.has(e));
      }
      return [...fromPrefs, ...manual];
    });
  }, [
    preferences.tldr_default, preferences.retention_quiz_default,
    preferences.feynman_default,
    preferences.recall_prompts_default, preferences.simplify_default,
    preferences.why_care_default, preferences.jargon_default,
    preferences.mindmap_default, preferences.flowchart_default,
    isLowBattery,
  ]);

  const lastGenerateDataRef = useRef<Record<string, any> | null>(null);

  const handleGenerate = useCallback(
    (data: { textContent?: string; files?: File[]; youtubeUrl?: string; websiteUrl?: string; instructions: string; folder: string; tags: string[]; shouldSaveToLibrary: boolean; saveYouTubeVideo?: boolean; noteFormat?: string; chapterData?: ChapterGenerateData; backgroundFiles?: File[] }) => {
      lastGenerateDataRef.current = data;
      autoSavedRef.current = false;
      setSavedNoteId(null);
      setSavedNoteTitle("");
      setStickyNotes([]);
      setSavedVideos([]);
      resetChapterGeneration();
      pendingMetaRef.current = { folder: data.folder, tags: data.tags, shouldSaveToLibrary: data.shouldSaveToLibrary };

      // Save source YouTube video if checkbox was checked
      if (data.saveYouTubeVideo && data.youtubeUrl) {
        const videoId = extractYouTubeVideoId(data.youtubeUrl);
        if (videoId) {
          setSavedVideos([{
            id: `source-${videoId}-${Date.now()}`,
            query: "Source video",
            videoId,
            title: "Source Video",
            channelTitle: "",
            thumbnailUrl: `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`,
            duration: "",
            savedAt: new Date().toISOString(),
          }]);
        }
      }

      // ── Chapter mode: first chapter displayed live, rest generated in background ──
      if (data.chapterData) {
        const cd = data.chapterData;
        setChapterBookTitle(cd.bookTitle);

        // Update folder to the book-level folder path for auto-save
        pendingMetaRef.current.folder = buildFolderPath(data.folder, cd.bookTitle);

        // Compute page range for image extraction from chapter boundaries
        const firstChapterObj = cd.allChapters[0];
        const secondChapterObj = cd.allChapters.length > 1 ? cd.allChapters[1] : null;
        const chapterPageRange = firstChapterObj?.startPage
          ? {
              start: firstChapterObj.startPage,
              end: secondChapterObj?.startPage
                ? secondChapterObj.startPage - 1
                : firstChapterObj.startPage + 50, // fallback: ~50 pages
            }
          : undefined;

        // Generate first chapter on the workspace (live stream)
        generate({
          textContent: cd.textContent,
          instructions: data.instructions,
          learningMode,
          extras: activeExtras,
          profilePrompt: profile.promptAppend || undefined,
          age: profile.age,
          noteFormat: data.noteFormat as any,
          folder: pendingMetaRef.current.folder,
          tags: data.tags,
          shouldSaveToLibrary: data.shouldSaveToLibrary,
          chapterContext: cd.chapterContext,
          sourceFile: cd.sourceFile,
          chapterPageRange,
          energyMode: preferences.energy_mode || "full",
        });

        // Kick off background chapters (chapters 1+)
        if (cd.backgroundChapters.length > 0) {
          startBackgroundGeneration({
            allChapters: cd.allChapters,
            backgroundChapters: cd.backgroundChapters,
            bookTitle: cd.bookTitle,
            parentFolder: data.folder,
            tags: data.tags,
            learningMode,
            extras: activeExtras,
            profilePrompt: profile.promptAppend || undefined,
            age: profile.age,
            energyMode: preferences.energy_mode || "full",
          });
        }
        return;
      }

      // ── Standard mode (existing flow) ──
      generate({
        ...data,
        learningMode: learningMode,
        extras: activeExtras,
        profilePrompt: profile.promptAppend || undefined,
        age: profile.age,
        noteFormat: data.noteFormat as any,
        energyMode: preferences.energy_mode || "full",
      });

      // ── Multi-file: generate remaining files in background ──
      if (data.backgroundFiles && data.backgroundFiles.length > 0) {
        startBackgroundFileGeneration({
          files: data.backgroundFiles,
          folder: data.folder,
          tags: data.tags,
          learningMode,
          extras: activeExtras,
          instructions: data.instructions,
          profilePrompt: profile.promptAppend || undefined,
          age: profile.age,
          energyMode: preferences.energy_mode || "full",
        });
      }
    },
    [generate, learningMode, activeExtras, profile.promptAppend, profile.age, preferences.energy_mode, startBackgroundGeneration, startBackgroundFileGeneration, resetChapterGeneration]
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
  }, [generatedHtml, user, isGenerating, learningMode]);

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

  // First-time tutorial
  const { showTutorial, triggerIfFirstTime, dismiss: dismissTutorial } = useFirstTimeTutorial();
  useEffect(() => {
    if (notesGenerated && !isGenerating) {
      triggerIfFirstTime();
    }
  }, [notesGenerated, isGenerating, triggerIfFirstTime]);

  return (
    <Layout>
      {/* Hero — compact, lets Layout watermark show through */}
      <div className="relative overflow-hidden">
        <div className="container relative max-w-3xl py-10 md:py-14">
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="text-center">
            <h1 className="text-2xl font-extrabold tracking-tight text-foreground md:text-3xl lg:text-4xl [text-shadow:_1px_1px_0_rgba(255,255,255,0.5),_-1px_-1px_0_rgba(255,255,255,0.5),_1px_-1px_0_rgba(255,255,255,0.5),_-1px_1px_0_rgba(255,255,255,0.5),_0_2px_4px_rgba(0,0,0,0.06)]">
              Study notes that work{" "}
              <span className="bg-gradient-to-r from-sage-400 via-primary to-sky-300 bg-clip-text text-transparent [text-shadow:none]">
                with your brain
              </span>
            </h1>
            <p className="mx-auto mt-2.5 max-w-lg text-sm text-muted-foreground md:text-base">
              Upload anything. Get notes tailored to how you actually learn.
            </p>

            <div className="mt-4 flex items-center justify-center gap-3 flex-wrap">
              {showWizardBanner && (
                <motion.button
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  onClick={() => navigate("/setup")}
                  className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-5 py-2.5 text-sm font-semibold text-foreground shadow-elevated transition-all duration-200 hover:shadow-elevated-hover hover:-translate-y-0.5"
                >
                  <Brain className="h-4 w-4 text-primary" />
                  Set up your learning profile
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                </motion.button>
              )}
              {learningMode === LEARNING_MODE.DYSLEXIA && (
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
              <NoteExtras activeExtras={activeExtras} onExtrasChange={setActiveExtras} isLowBattery={isLowBattery} />
            </motion.div>
          </>
        )}

        {(notesGenerated || isGenerating) && (
          <GeneratedNotes
            html={generatedHtml}
            isGenerating={isGenerating}
            bionicEnabled={bionicEnabled}
            dyslexiaMode={learningMode === LEARNING_MODE.DYSLEXIA}
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

        {/* Background chapter generation progress */}
        {chapterTotalCount > 0 && (
          <ChapterGenerationProgress
            chapterStates={chapterStates}
            currentIndex={chapterCurrentIndex}
            isRunning={isChapterRunning}
            completedCount={chapterCompletedCount}
            failedCount={chapterFailedCount}
            totalCount={chapterTotalCount}
            bookTitle={chapterBookTitle}
            onStop={stopAfterCurrent}
          />
        )}

        {notesGenerated && !isGenerating && lastGenerateDataRef.current && (
          <div className="flex items-center gap-2 flex-wrap rounded-xl border border-border bg-card p-3 shadow-sm">
            <RefreshCw className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
            <span className="text-xs font-medium text-muted-foreground">Regenerate as:</span>
            {([
              { value: "outline", label: "Outline" },
              { value: "cornell", label: "Cornell Notes" },
              { value: "concept_map", label: "Concept Map" },
              { value: "flow", label: "Flow" },
            ] as const).map((fmt) => (
              <button
                key={fmt.value}
                onClick={() => {
                  const prev = lastGenerateDataRef.current;
                  if (prev) handleGenerate({ ...prev, noteFormat: fmt.value });
                }}
                className="rounded-lg bg-lavender-100 dark:bg-lavender-500/15 px-2.5 py-1 text-[11px] font-medium text-lavender-600 dark:text-lavender-300 hover:bg-lavender-200 dark:hover:bg-lavender-500/25 transition-colors"
              >
                {fmt.label}
              </button>
            ))}
          </div>
        )}

        {notesGenerated && (
          <StudyToolsInline notesHtml={generatedHtml} linkedNoteId={savedNoteId} noteTitle={savedNoteTitle} />
        )}
      </div>

      {notesGenerated && savedVideos.length > 0 && (
        <VideoBar
          savedVideos={savedVideos}
          onRemoveVideo={(videoId) => {
            setSavedVideos((prev) => prev.filter((v) => v.videoId !== videoId));
          }}
        />
      )}
      <FirstTimeTutorial show={showTutorial} onDismiss={dismissTutorial} />
    </Layout>
  );
}

/* ═══════════════════════════════════════════════════════════════
   ROUTER — decides which view to show
   ═══════════════════════════════════════════════════════════════ */

const Index = () => {
  const { user, loading } = useAuth();

  // While auth state is loading, show nothing to prevent flash
  if (loading) return null;

  return user ? <Workspace /> : <LandingPage />;
};

export default Index;
