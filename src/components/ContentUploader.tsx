import { useState, useCallback, useEffect } from "react";
import { Upload, Link2, FileText, X, Sparkles, Loader2, Youtube, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { isTranscribableYouTubeUrl } from "@/lib/youtube";
import { extractTextFromFile, isClientExtractable } from "@/lib/extractTextFromFile";
import { chunkTextbook } from "@/lib/textChunker";

const DEFAULT_FOLDER = "Unsorted";
const MAX_FILE_SIZE_BYTES = 500 * 1024 * 1024;

export interface ChapterChunk {
  id: string;
  title: string;
  text: string;
}

interface ContentUploaderProps {
  onGenerate: (data: {
    chapters: ChapterChunk[];
    youtubeUrl?: string;
    websiteUrl?: string;
    instructions: string;
    folder: string;
    tags: string[];
    shouldSaveToLibrary: boolean;
    saveYouTubeVideo?: boolean;
    backgroundProcessingEnabled?: boolean;
    images?: Array<{ data: string; mimeType: string } | File | Blob>;
  }) => void;
  isGenerating: boolean;
  uploadProgress: string;
}

function detectChapters(text: string, defaultTitle: string): ChapterChunk[] {
  // Try to split by common chapter markers (Chapter 1, Part 1, Section 1)
  const chapterRegex = /(?=^(?:Chapter|Part|Section)\s+[A-Z0-9]+)/im;
  const parts = text.split(chapterRegex).filter((t) => t.trim().length > 100);

  if (parts.length > 1) {
    return parts.map((partText, i) => {
      const firstLine = partText.split('\n')[0].trim().substring(0, 40);
      return { id: `ch-${i}`, title: firstLine || `${defaultTitle} - Part ${i + 1}`, text: partText };
    });
  }

  // Fallback: If it's just a massive wall of text without markers, split by ~30k characters safely
  if (text.length > 30000) {
    const chunks: ChapterChunk[] = [];
    let currentIndex = 0;
    let index = 1;
    while (currentIndex < text.length) {
      let endIndex = currentIndex + 30000;
      if (endIndex < text.length) {
        const nextNewline = text.lastIndexOf("\n", endIndex);
        if (nextNewline > currentIndex + 15000) endIndex = nextNewline;
      }
      chunks.push({
        id: `pt-${index}`,
        title: `${defaultTitle} - Part ${index}`,
        text: text.slice(currentIndex, endIndex)
      });
      currentIndex = endIndex;
      index++;
    }
    return chunks;
  }

  return [{ id: "full", title: defaultTitle, text }];
}

const ContentUploader = ({ onGenerate, isGenerating, uploadProgress }: ContentUploaderProps) => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<"file" | "url" | "text">("file");
  const [files, setFiles] = useState<File[]>([]);
  const [url, setUrl] = useState("");
  const [text, setText] = useState("");
  
  // Chapter Selection State
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [detectedChapters, setDetectedChapters] = useState<ChapterChunk[] | null>(null);
  const [selectedChapterIds, setSelectedChapterIds] = useState<Set<string>>(new Set());

  const [instructions, setInstructions] = useState("");
  const [showInstructions, setShowInstructions] = useState(true);
  const [dragOver, setDragOver] = useState(false);
  const [folder, setFolder] = useState(DEFAULT_FOLDER);
  const [tagsInput, setTagsInput] = useState("");
  const [shouldSaveToLibrary, setShouldSaveToLibrary] = useState(true);
  const [saveYouTubeVideo, setSaveYouTubeVideo] = useState(true);
  const [libraryFolders, setLibraryFolders] = useState<string[]>([]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase.from("saved_notes").select("folder").eq("user_id", user.id);
      if (data) {
        const unique = [...new Set(data.map((r) => r.folder).filter((f): f is string => typeof f === "string" && f.length > 0))].filter((f) => f !== DEFAULT_FOLDER);
        setLibraryFolders(unique);
      }
    })();
  }, [user]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    setFiles(Array.from(e.dataTransfer.files).slice(0, 1));
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    setFiles(Array.from(e.target.files).slice(0, 1));
  }, []);

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleAnalyzeAndSubmit = async () => {
    const common = { instructions, folder: shouldSaveToLibrary ? folder : DEFAULT_FOLDER, tags: tagsInput.split(",").map(t => t.trim()).filter(Boolean), shouldSaveToLibrary };
    const uploadedMedia = activeTab === "file" && files.length > 0 ? [files[0]] : undefined;
    
    // If they already selected chapters, generate them!
    if (detectedChapters) {
      const selected = detectedChapters.filter(c => selectedChapterIds.has(c.id));
      if (selected.length === 0) return toast.error("Select at least one chapter.");
      onGenerate({ chapters: selected, ...common, ...(uploadedMedia ? { images: uploadedMedia } : {}) });
      return;
    }

    // URL Handling
    if (activeTab === "url" && url.trim()) {
      if (isTranscribableYouTubeUrl(url)) {
        onGenerate({ chapters: [], youtubeUrl: url.trim(), saveYouTubeVideo, ...common });
      } else {
        onGenerate({ chapters: [], websiteUrl: url.trim(), ...common });
      }
      return;
    }

    // Text Handling
    if (activeTab === "text" && text.trim()) {
      const chunks = detectChapters(text.trim(), "Pasted Text");
      if (chunks.length > 1) {
        setDetectedChapters(chunks);
        setSelectedChapterIds(new Set(chunks.map(c => c.id)));
      } else {
        onGenerate({ chapters: chunks, ...common });
      }
      return;
    }

    // File Handling
    if (activeTab === "file" && files.length > 0) {
      setIsAnalyzing(true);
      try {
        const file = files[0];
        if (file.size > MAX_FILE_SIZE_BYTES) {
          toast.error("File is too large. Maximum size is 500MB.");
          return;
        }

        if (!isClientExtractable(file.name)) {
          toast.error("This file type is not supported for local extraction. Please use PDF, DOCX, or TXT.");
          return;
        }

        const result = await extractTextFromFile(file);
        if (!result?.text?.trim()) {
          toast.error("No readable text was found in this file.");
          return;
        }

        const textbookChunks = chunkTextbook(result.text, instructions);
        if (textbookChunks.length > 1) {
          const baseTitle = file.name.split(".")[0] || "Uploaded Textbook";
          const chapters: ChapterChunk[] = textbookChunks.map((chunk, index) => ({
            id: `tb-${index + 1}`,
            title: `${baseTitle} - Chapter ${index + 1}`,
            text: chunk,
          }));

          onGenerate({ chapters, backgroundProcessingEnabled: true, ...common, images: result.images });
          return;
        }

        const chunks = detectChapters(result.text, file.name.split(".")[0]);

        if (chunks.length > 1) {
          setDetectedChapters(chunks);
          setSelectedChapterIds(new Set(chunks.map((c) => c.id)));
        } else {
          onGenerate({ chapters: chunks, ...common, images: result.images });
          }
      } catch (err) {
        toast.error("Failed to analyze file.");
      } finally {
        setIsAnalyzing(false);
      }
    }
  };

  const toggleChapter = (id: string) => {
    const newSet = new Set(selectedChapterIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedChapterIds(newSet);
  };

  const hasContent = files.length > 0 || url.trim() || text.trim();
  const allFolders = [DEFAULT_FOLDER, ...libraryFolders];

  // --- CHAPTER SELECTION UI ---
  if (detectedChapters) {
    return (
      <div className="animate-fade-in space-y-4">
        <div className="rounded-2xl border border-sage-200 bg-sage-50/50 p-6 dark:border-sage-500/20 dark:bg-sage-500/5">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sage-200 dark:bg-sage-500/30">
              <BookOpen className="h-5 w-5 text-sage-700 dark:text-sage-200" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-foreground">Large Document Detected</h3>
              <p className="text-sm text-muted-foreground">We found {detectedChapters.length} sections. Select which ones you want to convert into notes.</p>
            </div>
          </div>

          <div className="flex gap-2 mb-4">
            <Button variant="outline" size="sm" onClick={() => setSelectedChapterIds(new Set(detectedChapters.map(c => c.id)))}>Select All</Button>
            <Button variant="outline" size="sm" onClick={() => setSelectedChapterIds(new Set())}>Deselect All</Button>
          </div>

          <div className="max-h-64 overflow-y-auto rounded-xl border border-border bg-card p-2 space-y-1">
            {detectedChapters.map((chapter) => (
              <label key={chapter.id} className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${selectedChapterIds.has(chapter.id) ? 'bg-primary/10' : 'hover:bg-muted'}`}>
                <input 
                  type="checkbox" 
                  checked={selectedChapterIds.has(chapter.id)}
                  onChange={() => toggleChapter(chapter.id)}
                  className="h-4 w-4 rounded border-border text-primary focus:ring-primary/30"
                />
                <span className="text-sm font-medium">{chapter.title}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="flex gap-3">
          <Button variant="outline" className="w-full" onClick={() => setDetectedChapters(null)}>Cancel</Button>
          <Button 
            className="w-full" 
            onClick={handleAnalyzeAndSubmit}
            disabled={selectedChapterIds.size === 0 || isGenerating}
          >
            {isGenerating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}
            Generate {selectedChapterIds.size} Notes
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in space-y-4">
      <div className="grid grid-cols-3 gap-2 rounded-xl border border-border p-1">
        <button
          onClick={() => setActiveTab("file")}
          className={`rounded-lg px-3 py-2 text-sm ${activeTab === "file" ? "bg-primary/10 text-primary" : "text-muted-foreground"}`}
        >
          <span className="inline-flex items-center gap-2"><Upload className="h-4 w-4" /> File</span>
        </button>
        <button
          onClick={() => setActiveTab("url")}
          className={`rounded-lg px-3 py-2 text-sm ${activeTab === "url" ? "bg-primary/10 text-primary" : "text-muted-foreground"}`}
        >
          <span className="inline-flex items-center gap-2"><Link2 className="h-4 w-4" /> URL</span>
        </button>
        <button
          onClick={() => setActiveTab("text")}
          className={`rounded-lg px-3 py-2 text-sm ${activeTab === "text" ? "bg-primary/10 text-primary" : "text-muted-foreground"}`}
        >
          <span className="inline-flex items-center gap-2"><FileText className="h-4 w-4" /> Text</span>
        </button>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === "file" && (
          <motion.div key="file" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} className="space-y-3">
            <div
              onDrop={handleDrop}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              className={`relative flex min-h-[160px] cursor-pointer items-center justify-center rounded-xl border-2 border-dashed p-6 text-center ${
                dragOver ? "border-primary bg-primary/5" : "border-border"
              }`}
            >
              <input
                type="file"
                accept=".pdf,.doc,.docx,.txt,.md"
                onChange={handleFileSelect}
                className="absolute inset-0 cursor-pointer opacity-0"
              />
              <div className="space-y-1">
                <p className="text-sm font-medium">Drop one file here or click to browse</p>
                <p className="text-xs text-muted-foreground">PDF, DOCX, TXT, MD - 500MB each</p>
              </div>
            </div>

            {files.map((file, i) => (
              <div key={`${file.name}-${i}`} className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
                <span className="truncate text-sm">{file.name}</span>
                <button onClick={() => removeFile(i)} className="rounded p-1 text-muted-foreground hover:text-foreground">
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </motion.div>
        )}

        {activeTab === "url" && (
          <motion.div key="url" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} className="space-y-2">
            <div className="relative">
              {isTranscribableYouTubeUrl(url) ? (
                <Youtube className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-red-500" />
              ) : (
                <Link2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              )}
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://example.com or https://youtube.com/..."
                className="w-full rounded-xl border border-border bg-background py-3 pl-10 pr-3 text-sm"
              />
            </div>
            {isTranscribableYouTubeUrl(url) && (
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  checked={saveYouTubeVideo}
                  onChange={(e) => setSaveYouTubeVideo(e.target.checked)}
                />
                Save YouTube video metadata with this note
              </label>
            )}
          </motion.div>
        )}

        {activeTab === "text" && (
          <motion.div key="text" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={8}
              placeholder="Paste your content here..."
              className="w-full resize-none rounded-xl border border-border bg-background px-3 py-2 text-sm"
            />
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Folder</label>
          <select
            value={folder}
            onChange={(e) => setFolder(e.target.value)}
            disabled={!shouldSaveToLibrary}
            className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm disabled:opacity-60"
          >
            {allFolders.map((f) => (
              <option key={f} value={f}>{f}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Tags (comma separated)</label>
          <input
            type="text"
            value={tagsInput}
            onChange={(e) => setTagsInput(e.target.value)}
            disabled={!shouldSaveToLibrary}
            className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm disabled:opacity-60"
          />
        </div>
      </div>

      <label className="flex items-center gap-2 text-xs text-muted-foreground">
        <input
          type="checkbox"
          checked={shouldSaveToLibrary}
          onChange={(e) => setShouldSaveToLibrary(e.target.checked)}
        />
        Save generated notes to Library
      </label>

      <button
        onClick={() => setShowInstructions((s) => !s)}
        className="text-xs font-medium text-primary"
      >
        {showInstructions ? "Hide instructions" : "Add instructions"}
      </button>
      {showInstructions && (
        <textarea
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          rows={3}
          placeholder="Optional instructions for the generated notes"
          className="w-full resize-none rounded-xl border border-border bg-background px-3 py-2 text-sm"
        />
      )}

      <Button
        disabled={!hasContent || isGenerating || isAnalyzing}
        size="lg"
        onClick={handleAnalyzeAndSubmit}
        className="mt-6 w-full gap-2 rounded-2xl py-6 text-base font-semibold shadow-md transition-all duration-200"
      >
        {isGenerating || isAnalyzing ? (
          <><Loader2 className="h-5 w-5 animate-spin" /> {isAnalyzing ? "Analyzing Document..." : uploadProgress || "Generating..."}</>
        ) : (
          <><Sparkles className="h-5 w-5" /> Turn into Brain-Friendly Notes</>
        )}
      </Button>
    </div>
  );
};
export default ContentUploader;