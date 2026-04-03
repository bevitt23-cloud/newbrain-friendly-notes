import { useState, useCallback, useEffect, useRef } from "react";
import { Upload, Link2, FileText, X, Sparkles, Mic, MessageSquare, Loader2, Youtube, FolderPlus, Check, Save, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { isTranscribableYouTubeUrl } from "@/lib/youtube";
import { DEFAULT_FOLDER } from "@/lib/constants";
import { extractTextFromFile, isClientExtractable, type ExtractionProgressCallback } from "@/lib/extractTextFromFile";
import { detectChapters, shouldOfferChapterDetection } from "@/lib/chapterDetection";
import type { DetectedChapter, ChapterDetectionResult } from "@/lib/chapterDetection";
import ChapterPreview from "./ChapterPreview";

export interface ChapterGenerateData {
  /** First chapter text (displays on workspace) */
  textContent: string;
  /** Chapter context for the first chapter */
  chapterContext: {
    chapterTitle: string;
    chapterIndex: number;
    totalChapters: number;
    bookTitle: string;
  };
  /** Remaining chapters to generate in background */
  backgroundChapters: DetectedChapter[];
  /** All selected chapters */
  allChapters: DetectedChapter[];
  /** Book title */
  bookTitle: string;
}

interface ContentUploaderProps {
  onGenerate: (data: {
    textContent?: string;
    files?: File[];
    youtubeUrl?: string;
    websiteUrl?: string;
    instructions: string;
    folder: string;
    tags: string[];
    shouldSaveToLibrary: boolean;
    saveYouTubeVideo?: boolean;
    /** Present when generating from detected chapters */
    chapterData?: ChapterGenerateData;
  }) => void;
  isGenerating: boolean;
  uploadProgress: string;
}

const ContentUploader = ({ onGenerate, isGenerating, uploadProgress }: ContentUploaderProps) => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<"file" | "url" | "text">("file");
  const [files, setFiles] = useState<File[]>([]);
  const [url, setUrl] = useState("");
  const [text, setText] = useState("");
  const [instructions, setInstructions] = useState("");
  const [showInstructions, setShowInstructions] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [folder, setFolder] = useState(DEFAULT_FOLDER);
  const [tagsInput, setTagsInput] = useState("");
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [shouldSaveToLibrary, setShouldSaveToLibrary] = useState(true);
  const [saveYouTubeVideo, setSaveYouTubeVideo] = useState(true);
  const [libraryFolders, setLibraryFolders] = useState<string[]>([]);

  // ── Chapter detection state ──
  const [chapterDetection, setChapterDetection] = useState<ChapterDetectionResult | null>(null);
  const [selectedChapterIndices, setSelectedChapterIndices] = useState<Set<number>>(new Set());
  const [bookTitle, setBookTitle] = useState("");
  const [isDetectingChapters, setIsDetectingChapters] = useState(false);
  const [extractionProgress, setExtractionProgress] = useState("");
  const lastDetectedFilesRef = useRef<string>("");

  // Run chapter detection when files change
  useEffect(() => {
    if (activeTab !== "file" || files.length === 0) {
      setChapterDetection(null);
      setSelectedChapterIndices(new Set());
      setBookTitle("");
      lastDetectedFilesRef.current = "";
      return;
    }

    // Only run for single extractable files (multi-file keeps existing flow)
    if (files.length !== 1 || !isClientExtractable(files[0].name)) {
      setChapterDetection(null);
      return;
    }

    const fileKey = `${files[0].name}-${files[0].size}-${files[0].lastModified}`;
    if (fileKey === lastDetectedFilesRef.current) return; // already detected
    lastDetectedFilesRef.current = fileKey;

    let cancelled = false;
    (async () => {
      setIsDetectingChapters(true);
      setExtractionProgress("Loading file…");
      try {
        const progressCb: ExtractionProgressCallback = (processed, total) => {
          if (!cancelled) {
            setExtractionProgress(
              `Reading pages… ${processed.toLocaleString()} / ${total.toLocaleString()}`
            );
          }
        };
        const result = await extractTextFromFile(files[0], progressCb);
        if (cancelled || !result || !result.text) {
          setIsDetectingChapters(false);
          setExtractionProgress("");
          return;
        }
        if (!shouldOfferChapterDetection(result.text.length)) {
          setChapterDetection(null);
          setIsDetectingChapters(false);
          setExtractionProgress("");
          return;
        }
        setExtractionProgress("Detecting chapters…");
        const detection = detectChapters(result.text, result.fileName);
        if (cancelled) return;

        if (detection.chapters.length >= 2) {
          setChapterDetection(detection);
          setSelectedChapterIndices(new Set(detection.chapters.map((_, i) => i)));
          setBookTitle(detection.suggestedBookTitle);
        } else {
          setChapterDetection(null);
        }
      } catch (err) {
        console.error("[Chapter Detection] Error:", err);
        setChapterDetection(null);
      }
      if (!cancelled) {
        setIsDetectingChapters(false);
        setExtractionProgress("");
      }
    })();

    return () => { cancelled = true; };
  }, [files, activeTab]);

  const isChapterMode = chapterDetection !== null && selectedChapterIndices.size > 0;

  const DEFAULT_FOLDERS = [DEFAULT_FOLDER] as const;

  // Fetch existing folders from user's library
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("saved_notes")
        .select("folder")
        .eq("user_id", user.id);
      if (data) {
        const unique = [...new Set(data.map((r: any) => r.folder as string))].filter(
          (f) => !DEFAULT_FOLDERS.includes(f as any)
        );
        setLibraryFolders(unique);
      }
    })();
  }, [user]);

  const ALL_FOLDERS = [...DEFAULT_FOLDERS, ...libraryFolders];

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const droppedFiles = Array.from(e.dataTransfer.files).slice(0, 5);
    setFiles((prev) => [...prev, ...droppedFiles].slice(0, 5));
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const selected = Array.from(e.target.files).slice(0, 5);
    setFiles((prev) => [...prev, ...selected].slice(0, 5));
  }, []);

  const removeFile = (index: number) => setFiles((prev) => prev.filter((_, i) => i !== index));

  const isYouTubeUrl = (u: string) => isTranscribableYouTubeUrl(u);

  const normalizeWebsiteUrl = (input: string): string | null => {
    const raw = input.trim();
    if (!raw || /\s/.test(raw)) return null;

    const unwrapCandidate = (value: string): string => {
      const redirectKeys = [
        "url",
        "u",
        "target",
        "dest",
        "destination",
        "redirect",
        "redirect_url",
        "redirectUri",
        "redirect_uri",
        "redirectTo",
        "redirect_to",
        "to",
        "out",
        "next",
        "link",
        "source",
        "source_url",
        "article",
        "article_url",
        "articleUrl",
      ];

      let current = value;
      for (let depth = 0; depth < 3; depth += 1) {
        try {
          const parsed = new URL(/^https?:\/\//i.test(current) ? current : `https://${current}`);
          const nested = redirectKeys
            .map((key) => parsed.searchParams.get(key))
            .find((candidate) => typeof candidate === "string" && candidate.trim().length > 0);
          if (!nested) return current;
          current = nested;
          continue;
        } catch {
          try {
            const decoded = decodeURIComponent(current);
            if (decoded === current) return current;
            current = decoded;
            continue;
          } catch {
            return current;
          }
        }
      }
      return current;
    };

    const candidate = unwrapCandidate(raw).trim();
    if (!candidate || !/[.:/]/.test(candidate)) return null;

    try {
      const parsed = new URL(/^https?:\/\//i.test(candidate) ? candidate : `https://${candidate}`);
      if (!["http:", "https:"].includes(parsed.protocol)) return null;
      if (!parsed.hostname) return null;
      if (!parsed.hostname.includes(".") && parsed.hostname !== "localhost") return null;
      return parsed.toString();
    } catch {
      return null;
    }
  };

  const parsedTags = tagsInput.split(",").map((t) => t.trim()).filter(Boolean);

  const handleSubmit = () => {
    const common = { instructions, folder: shouldSaveToLibrary ? folder : DEFAULT_FOLDER, tags: shouldSaveToLibrary ? parsedTags : [], shouldSaveToLibrary };

    // ── Chapter mode: split into first chapter (workspace) + background chapters ──
    if (isChapterMode && chapterDetection) {
      const sortedIndices = Array.from(selectedChapterIndices).sort((a, b) => a - b);
      const selectedChapters = sortedIndices.map((i) => chapterDetection.chapters[i]);

      if (selectedChapters.length === 0) {
        toast.error("Select at least one chapter to generate notes.");
        return;
      }

      const firstChapter = selectedChapters[0];
      const backgroundChapters = selectedChapters.slice(1);

      const chapterData: ChapterGenerateData = {
        textContent: firstChapter.text,
        chapterContext: {
          chapterTitle: firstChapter.title,
          chapterIndex: firstChapter.index,
          totalChapters: selectedChapters.length,
          bookTitle,
        },
        backgroundChapters,
        allChapters: selectedChapters,
        bookTitle,
      };

      onGenerate({ textContent: firstChapter.text, chapterData, ...common });
      return;
    }

    // ── Standard mode (existing flow) ──
    if (activeTab === "text" && text.trim()) {
      onGenerate({ textContent: text.trim(), ...common });
    } else if (activeTab === "url" && url.trim()) {
      if (isYouTubeUrl(url)) {
        onGenerate({ youtubeUrl: url.trim(), saveYouTubeVideo, ...common });
      } else {
        const normalizedWebsiteUrl = normalizeWebsiteUrl(url);
        if (!normalizedWebsiteUrl) {
          toast.error("Paste a valid website URL, including the domain name.");
          return;
        }
        onGenerate({ websiteUrl: normalizedWebsiteUrl, ...common });
      }
    } else if (activeTab === "file" && files.length > 0) {
      const oversized = files.find((f) => f.size > 500 * 1024 * 1024);
      if (oversized) {
        toast.error(`${oversized.name} is too large (max 500MB per file)`);
        return;
      }
      onGenerate({ files, ...common });
    }
  };

  const tabs = [
    { id: "file" as const, label: "Upload File", icon: Upload, color: "text-sage-600" },
    { id: "url" as const, label: "Paste URL", icon: Link2, color: "text-lavender-500" },
    { id: "text" as const, label: "Paste Text", icon: FileText, color: "text-peach-500" },
  ];

  const hasContent = files.length > 0 || url.trim() || text.trim();

  const formatFileSize = (size: number) => {
    if (size < 1024) return `${size}B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(0)}KB`;
    return `${(size / (1024 * 1024)).toFixed(1)}MB`;
  };

  return (
    <div className="animate-fade-in">
      {/* Tab switcher */}
      <div className="mb-6 flex gap-1 rounded-2xl bg-gradient-to-r from-sage-200 via-lavender-200 to-peach-200 dark:from-sage-500/20 dark:via-lavender-500/20 dark:to-peach-500/20 p-1.5 ring-1 ring-sage-300 dark:ring-border">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`relative flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-300 ${
              activeTab === tab.id
                ? "bg-card text-foreground shadow-lg ring-1 ring-border/80"
                : "text-muted-foreground hover:text-foreground hover:bg-card/50"
            }`}
          >
            <tab.icon className={`h-4 w-4 ${activeTab === tab.id ? tab.color : ""}`} />
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {activeTab === "file" && (
          <motion.div key="file" initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 8 }} className="space-y-3">
            <div
              onDrop={handleDrop}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              className={`relative flex min-h-[180px] cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed transition-all duration-300 ${
                dragOver
                  ? "border-sage-600 bg-sage-200 dark:border-sage-300 dark:bg-sage-500/30 scale-[1.01]"
                  : "border-sage-400 bg-gradient-to-br from-sage-100 to-sage-200/60 dark:border-sage-300/40 dark:from-sage-500/20 dark:to-sage-500/10 hover:border-sage-500 hover:bg-sage-200/80 dark:hover:border-sage-200/50 dark:hover:bg-sage-500/25"
              }`}
            >
              <input
                id="content-files"
                name="contentFiles"
                type="file"
                multiple
                accept=".pdf,.doc,.docx,.ppt,.pptx,.txt,.md,.csv,.png,.jpg,.jpeg,.gif,.webp,.mp4,.mov,.avi"
                onChange={handleFileSelect}
                className="absolute inset-0 cursor-pointer opacity-0"
              />
              <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-sage-300 dark:bg-sage-500/35 shadow-md">
                <Upload className="h-7 w-7 text-sage-700 dark:text-sage-100" />
              </div>
              <p className="text-sm font-medium text-foreground">Drop files here or click to browse</p>
              <p className="mt-1 text-xs text-muted-foreground">
                PDF, Word, PowerPoint, images, video — up to 5 files (500MB each)
              </p>
            </div>

            {files.length > 0 && (
              <div className="space-y-2">
                {files.map((file, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center justify-between rounded-xl bg-sage-100 dark:bg-sage-500/15 px-3 py-2.5 ring-1 ring-sage-300 dark:ring-sage-200/30"
                  >
                    <div className="flex items-center gap-2 text-sm">
                      <FileText className="h-4 w-4 text-sage-500" />
                      <span className="truncate text-foreground">{file.name}</span>
                      <span className="text-xs text-muted-foreground">({formatFileSize(file.size)})</span>
                    </div>
                    <button onClick={() => removeFile(i)} className="rounded-lg p-1 text-muted-foreground hover:bg-sage-100 hover:text-foreground transition-colors">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </motion.div>
                ))}
              </div>
            )}

            {/* Chapter detection spinner */}
            {isDetectingChapters && (
              <div className="flex items-center gap-2.5 rounded-xl bg-lavender-50 dark:bg-lavender-500/10 px-4 py-3 ring-1 ring-lavender-200/60 dark:ring-lavender-400/20">
                <Loader2 className="h-4 w-4 animate-spin text-lavender-500" />
                <span className="text-sm text-muted-foreground">
                  {extractionProgress || "Detecting chapters…"}
                </span>
              </div>
            )}

            {/* Chapter preview & selection */}
            {isChapterMode && chapterDetection && (
              <ChapterPreview
                detection={chapterDetection}
                selectedIndices={selectedChapterIndices}
                onSelectionChange={setSelectedChapterIndices}
                bookTitle={bookTitle}
                onBookTitleChange={setBookTitle}
                parentFolder={folder}
              />
            )}

            {/* Option to skip chapter mode */}
            {chapterDetection && chapterDetection.chapters.length >= 2 && (
              <button
                onClick={() => { setChapterDetection(null); setSelectedChapterIndices(new Set()); }}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2"
              >
                Generate as a single note instead
              </button>
            )}
          </motion.div>
        )}

        {activeTab === "url" && (
          <motion.div key="url" initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 8 }}>
            <div className="relative">
              {isYouTubeUrl(url) ? (
                <Youtube className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-red-500" />
              ) : (
                <Link2 className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-lavender-500" />
              )}
              <input
                id="content-url"
                name="contentUrl"
                type="url"
                placeholder="https://example.com/article or YouTube URL..."
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="w-full rounded-2xl border-2 border-lavender-300 dark:border-lavender-300/30 bg-gradient-to-br from-lavender-100/60 to-lavender-200/30 dark:from-lavender-500/15 dark:to-lavender-500/10 pl-10 pr-4 py-3.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-lavender-500 focus:bg-lavender-100 dark:focus:bg-lavender-500/20 focus:outline-none focus:ring-2 focus:ring-lavender-300/60 transition-all"
              />
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {isYouTubeUrl(url)
                ? "🎥 YouTube detected — AI will transcribe and generate notes from the video"
                : "Paste a URL or YouTube link and we'll generate notes from it"}
            </p>
            {isYouTubeUrl(url) && (
              <label className="mt-2 flex items-center gap-2 cursor-pointer px-1">
                <input
                  type="checkbox"
                  checked={saveYouTubeVideo}
                  onChange={(e) => setSaveYouTubeVideo(e.target.checked)}
                  className="h-4 w-4 rounded border-border text-red-500 focus:ring-red-500/30 accent-red-500 cursor-pointer"
                />
                <span className="text-xs font-medium text-muted-foreground">Save this video to my notes</span>
              </label>
            )}
          </motion.div>
        )}

        {activeTab === "text" && (
          <motion.div key="text" initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 8 }}>
            <textarea
              id="content-text"
              name="contentText"
              placeholder="Paste your study material here..."
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={6}
              className="w-full resize-none rounded-2xl border-2 border-peach-300 dark:border-peach-300/30 bg-gradient-to-br from-peach-100/60 to-peach-200/30 dark:from-peach-500/15 dark:to-peach-500/10 px-4 py-3.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-peach-500 focus:bg-peach-100 dark:focus:bg-peach-500/20 focus:outline-none focus:ring-2 focus:ring-peach-300/60 transition-all"
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Speak notes button */}
      <button className="mt-3 flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors group">
        <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-lavender-50 dark:bg-lavender-500/15 group-hover:bg-lavender-100 dark:group-hover:bg-lavender-500/25 transition-colors">
          <Mic className="h-3 w-3 text-lavender-500 dark:text-lavender-300" />
        </div>
        Or speak your notes aloud
      </button>

      {/* Save checkbox + Folder & Tags */}
      <div className="mt-4 space-y-3">
        {/* Save to Library checkbox */}
        <label className="flex items-center gap-2 cursor-pointer px-1">
          <input
            id="save-to-library"
            name="saveToLibrary"
            type="checkbox"
            checked={shouldSaveToLibrary}
            onChange={(e) => setShouldSaveToLibrary(e.target.checked)}
            className="h-4 w-4 rounded border-border text-primary focus:ring-primary/30 accent-primary cursor-pointer"
          />
          <span className="text-xs font-medium text-muted-foreground">Save to Library</span>
        </label>

        {shouldSaveToLibrary ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Save to folder</label>
              {isCreatingFolder ? (
                <div className="flex gap-1.5">
                  <input
                    id="content-new-folder"
                    name="contentNewFolder"
                    type="text"
                    autoFocus
                    placeholder="Name your new folder..."
                    value={newFolderName}
                    onChange={(e) => setNewFolderName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && newFolderName.trim()) {
                        const name = `📂 ${newFolderName.trim()}`;
                        setLibraryFolders((prev) => [...prev, name]);
                        setFolder(name);
                        setNewFolderName("");
                        setIsCreatingFolder(false);
                      } else if (e.key === "Escape") {
                        setNewFolderName("");
                        setIsCreatingFolder(false);
                      }
                    }}
                    className="flex-1 rounded-xl border border-primary/40 bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                  />
                  <button
                    onClick={() => {
                      if (newFolderName.trim()) {
                        const name = `📂 ${newFolderName.trim()}`;
                        setLibraryFolders((prev) => [...prev, name]);
                        setFolder(name);
                        setNewFolderName("");
                        setIsCreatingFolder(false);
                      }
                    }}
                    disabled={!newFolderName.trim()}
                    className="rounded-xl border border-border bg-primary/10 px-2.5 text-primary hover:bg-primary/20 transition-colors disabled:opacity-40"
                  >
                    <Check className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => { setNewFolderName(""); setIsCreatingFolder(false); }}
                    className="rounded-xl border border-border bg-card px-2.5 text-muted-foreground hover:bg-muted transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-1.5">
                  <select
                    id="content-folder"
                    name="contentFolder"
                    value={folder}
                    onChange={(e) => setFolder(e.target.value)}
                    className="flex-1 rounded-xl border border-border bg-card px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                  >
                    {ALL_FOLDERS.map((f) => (
                      <option key={f} value={f}>{f}</option>
                    ))}
                  </select>
                  <button
                    onClick={() => setIsCreatingFolder(true)}
                    className="rounded-xl border border-border bg-card p-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                    title="Create New Folder"
                  >
                    <FolderPlus className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Tags</label>
              <input
                id="content-tags"
                name="contentTags"
                type="text"
                placeholder="biology, chapter 1, exam prep"
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
                className="w-full rounded-xl border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
              />
            </div>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground italic px-1">
            ⚠️ These notes will disappear if you refresh or leave the page.
          </p>
        )}
      </div>

      {/* Instructions toggle */}
      <div className="mt-4">
        <button
          onClick={() => setShowInstructions(!showInstructions)}
          className="flex items-center gap-2 text-xs font-medium text-primary hover:text-sage-700 transition-colors"
        >
          <MessageSquare className="h-3.5 w-3.5" />
          {showInstructions ? "Hide instructions" : "+ Add instructions for your notes"}
        </button>
        <AnimatePresence>
          {showInstructions && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <textarea
                id="content-instructions"
                name="contentInstructions"
                placeholder='e.g. "Focus on Chapter 3 only" or "Make it step-by-step for a beginner"'
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                rows={3}
                className="mt-2 w-full resize-none rounded-xl border border-border bg-card px-3 py-2.5 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* CTA button */}
      <Button
        disabled={!hasContent || isGenerating}
        size="lg"
        onClick={handleSubmit}
        className="mt-6 w-full gap-2 rounded-2xl py-6 text-base font-semibold shadow-md transition-all duration-200 hover:shadow-lg disabled:opacity-40 disabled:shadow-none"
      >
        {isGenerating ? (
          <>
            <Loader2 className="h-5 w-5 animate-spin" />
            {uploadProgress || "Generating Notes..."}
          </>
        ) : isChapterMode ? (
          <>
            <BookOpen className="h-5 w-5" />
            Generate Notes for {selectedChapterIndices.size} Chapter{selectedChapterIndices.size !== 1 ? "s" : ""}
          </>
        ) : (
          <>
            <Sparkles className="h-5 w-5" />
            Turn into Brain-Friendly Notes
          </>
        )}
      </Button>
    </div>
  );
};

export default ContentUploader;
