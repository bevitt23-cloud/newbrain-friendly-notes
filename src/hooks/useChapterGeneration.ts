import { useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { DetectedChapter } from "@/lib/chapterDetection";
import type { ChapterContext } from "@/hooks/useNoteGeneration";
import type { Json } from "@/integrations/supabase/types";
import { buildFolderPath } from "@/lib/folderUtils";
import { isClientExtractable, extractTextFromFile } from "@/lib/extractTextFromFile";

/* ═══════════════════════════════════════════════════════════════
   useChapterGeneration

   Orchestrates multi-chapter note generation.

   Design:
   - Chapter 0 (first selected) is handled by the EXISTING
     useNoteGeneration / useNotesContext flow so it displays
     live on the workspace page.
   - Chapters 1+ are generated sequentially by THIS hook,
     each saved directly to the library when complete.
   - Progress state is exposed so the UI can show a tracker.
   ═══════════════════════════════════════════════════════════════ */

export type ChapterStatus = "pending" | "generating" | "complete" | "failed" | "skipped";

export interface ChapterGenerationState {
  chapter: DetectedChapter;
  status: ChapterStatus;
  /** Populated when status === "complete" */
  savedNoteId: string | null;
  /** Error message when status === "failed" */
  error: string | null;
}

export interface ChapterGenerationOptions {
  /** All selected chapters (including the first one handled by workspace) */
  allChapters: DetectedChapter[];
  /** Chapters to generate in the background (indexes 1+) */
  backgroundChapters: DetectedChapter[];
  /** Book title for the folder path and AI context */
  bookTitle: string;
  /** Parent folder selected by the user (e.g. "Biology") */
  parentFolder: string;
  /** Tags to apply to all saved notes */
  tags: string[];
  /** Learning mode: "adhd" | "dyslexia" | "neurotypical" */
  learningMode: string;
  /** Extras to include (tldr, recall, etc.) */
  extras: string[];
  /** Cognitive profile prompt */
  profilePrompt?: string;
  /** User age */
  age?: number;
}

export interface BackgroundFileOptions {
  /** Files to generate notes for in the background */
  files: File[];
  /** Folder to save notes into */
  folder: string;
  /** Tags to apply */
  tags: string[];
  /** Learning mode */
  learningMode: string;
  /** Extras */
  extras: string[];
  /** Instructions */
  instructions: string;
  /** Cognitive profile prompt */
  profilePrompt?: string;
  /** User age */
  age?: number;
}

/* ─── SSE stream reader (mirrors useNoteGeneration logic) ─── */

async function streamGenerateNotes(
  accessToken: string,
  payload: Record<string, unknown>
): Promise<string> {
  const resp = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-notes`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        Authorization: `Bearer ${accessToken || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
      },
      body: JSON.stringify(payload),
    }
  );

  if (!resp.ok) {
    const errData = await resp.json().catch(() => ({ error: "Request failed" }));
    throw new Error(errData.error || `Error ${resp.status}`);
  }

  if (!resp.body) throw new Error("No response body");

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let fullContent = "";
  let isSSE = false;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value, { stream: true });
    buffer += chunk;

    if (!isSSE && buffer.includes("data: ")) {
      isSSE = true;
    }

    if (isSSE) {
      let newlineIndex: number;
      while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
        let line = buffer.slice(0, newlineIndex);
        buffer = buffer.slice(newlineIndex + 1);
        if (line.endsWith("\r")) line = line.slice(0, -1);

        if (line.startsWith("data: ")) {
          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") break;
          try {
            const parsed = JSON.parse(jsonStr);
            const delta =
              parsed.choices?.[0]?.delta?.content ||
              parsed.text ||
              parsed.delta ||
              "";
            if (delta) fullContent += delta;
          } catch {
            buffer = line + "\n" + buffer;
            break;
          }
        }
      }
    } else {
      fullContent += chunk;
      buffer = "";
    }
  }

  // Clean up markdown fences
  let cleaned = fullContent;
  if (cleaned.startsWith("```html")) cleaned = cleaned.slice(7);
  if (cleaned.startsWith("```")) cleaned = cleaned.slice(3);
  if (cleaned.endsWith("```")) cleaned = cleaned.slice(0, -3);

  // Strip leaked markdown bold/italic
  cleaned = cleaned
    .replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/(?<!=["'])\*([^*\n]+)\*(?!["'])/g, "<em>$1</em>");

  // Convert leaked markdown bullet lists into <ul><li>
  cleaned = cleaned.replace(
    /(?:^|\n)((?:[ \t]*[*\-][ \t]+.+(?:\n|$)){2,})/gm,
    (_match, block: string) => {
      const items = block
        .split(/\n/)
        .map((line: string) => line.replace(/^[ \t]*[*\-][ \t]+/, "").trim())
        .filter(Boolean)
        .map((item: string) => `<li>${item}</li>`)
        .join("");
      return `<ul>${items}</ul>`;
    },
  );

  // Remove any remaining stray asterisks used as bullets
  cleaned = cleaned.replace(/^[ \t]*\*[ \t]+(?![\s*])/gm, "");

  return cleaned.trim();
}

/* ─── Hook ─── */

export function useChapterGeneration() {
  const [chapterStates, setChapterStates] = useState<ChapterGenerationState[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const abortRef = useRef(false);

  /** How many background chapters are complete */
  const completedCount = chapterStates.filter(
    (s) => s.status === "complete"
  ).length;

  /** How many background chapters failed */
  const failedCount = chapterStates.filter(
    (s) => s.status === "failed"
  ).length;

  /** Total background chapters */
  const totalCount = chapterStates.length;

  /**
   * Start generating notes for background chapters (chapters 1+).
   * Chapter 0 is assumed to be handled by the workspace's existing generate() flow.
   */
  const startBackgroundGeneration = useCallback(
    async (opts: ChapterGenerationOptions) => {
      const { backgroundChapters, allChapters, bookTitle, parentFolder, tags, learningMode, extras, profilePrompt, age } = opts;

      if (backgroundChapters.length === 0) return;

      abortRef.current = false;
      setIsRunning(true);

      // Initialize states for all background chapters
      const initialStates: ChapterGenerationState[] = backgroundChapters.map(
        (chapter) => ({
          chapter,
          status: "pending" as const,
          savedNoteId: null,
          error: null,
        })
      );
      setChapterStates(initialStates);

      // Build the book-level folder path
      const bookFolder = buildFolderPath(parentFolder, bookTitle);

      // Get auth session
      const { data: session } = await supabase.auth.getSession();
      const accessToken = session?.session?.access_token || "";
      const userId = session?.session?.user?.id;

      if (!userId) {
        toast.error("You must be logged in to generate chapter notes.");
        setIsRunning(false);
        return;
      }

      // Create the book-level folder placeholder (so it appears in the sidebar)
      await supabase.from("saved_notes").insert({
        user_id: userId,
        title: ".folder_metadata",
        content: null,
        folder: bookFolder,
        source_type: "system",
      } as any);

      // Generate each chapter sequentially
      for (let i = 0; i < backgroundChapters.length; i++) {
        if (abortRef.current) {
          // Mark remaining as skipped
          setChapterStates((prev) =>
            prev.map((s, idx) =>
              idx >= i ? { ...s, status: "skipped" } : s
            )
          );
          break;
        }

        const chapter = backgroundChapters[i];
        setCurrentIndex(i);

        // Mark as generating
        setChapterStates((prev) =>
          prev.map((s, idx) =>
            idx === i ? { ...s, status: "generating" } : s
          )
        );

        try {
          const chapterContext: ChapterContext = {
            chapterTitle: chapter.title,
            chapterIndex: chapter.index,
            totalChapters: allChapters.length,
            bookTitle,
          };

          const payload = {
            textContent: chapter.text,
            learningMode,
            extras,
            instructions: "",
            profilePrompt: profilePrompt || undefined,
            age: age ?? null,
            chapterContext,
          };

          const html = await streamGenerateNotes(accessToken, payload);

          if (!html || html.length < 50) {
            throw new Error("Generated content was too short or empty");
          }

          // Extract title from generated HTML (should match chapter title)
          const titleMatch =
            html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i) ||
            html.match(/<h2[^>]*>([\s\S]*?)<\/h2>/i);
          const tmpDiv = document.createElement("div");
          tmpDiv.innerHTML = titleMatch?.[1] || "";
          const noteTitle = tmpDiv.textContent?.trim() || chapter.title;

          // Save to library
          const { data: savedData, error: saveErr } = await supabase
            .from("saved_notes")
            .insert({
              user_id: userId,
              title: noteTitle,
              content: html,
              source_type: "generated",
              learning_mode: learningMode,
              folder: bookFolder,
              tags,
              sticky_notes: [] as unknown as Json,
              saved_videos: [] as unknown as Json,
            })
            .select("id")
            .single();

          if (saveErr) {
            throw new Error(`Save failed: ${saveErr.message}`);
          }

          // Mark as complete
          setChapterStates((prev) =>
            prev.map((s, idx) =>
              idx === i
                ? { ...s, status: "complete", savedNoteId: savedData.id }
                : s
            )
          );
        } catch (err) {
          const errorMsg =
            err instanceof Error ? err.message : "Unknown error";
          console.error(
            `[Chapter Gen] Failed chapter ${i + 1}: "${chapter.title}":`,
            err
          );

          // Mark as failed
          setChapterStates((prev) =>
            prev.map((s, idx) =>
              idx === i ? { ...s, status: "failed", error: errorMsg } : s
            )
          );
        }

        // Small delay between chapters to avoid rate limits
        if (i < backgroundChapters.length - 1 && !abortRef.current) {
          await new Promise((resolve) => setTimeout(resolve, 2000));
        }
      }

      setIsRunning(false);
      setCurrentIndex(-1);

      // Summary toast
      const completed = backgroundChapters.filter(
        (_, i) =>
          initialStates[i] === undefined // We need to read final state
      );
      // Read final state after the loop
      setChapterStates((prev) => {
        const done = prev.filter((s) => s.status === "complete").length;
        const failed = prev.filter((s) => s.status === "failed").length;
        if (failed > 0) {
          toast.warning(
            `Generated ${done} of ${prev.length} chapters. ${failed} failed.`,
            { duration: 6000 }
          );
        } else if (done > 0) {
          toast.success(
            `All ${done} background chapters saved to Library!`,
            { duration: 5000 }
          );
        }
        return prev;
      });
    },
    []
  );

  /**
   * Start generating notes for background files (multi-file upload).
   * Each file is extracted, sent to the AI, and saved directly to the library.
   */
  const startBackgroundFileGeneration = useCallback(
    async (opts: BackgroundFileOptions) => {
      const { files, folder, tags, learningMode, extras, instructions, profilePrompt, age } = opts;

      if (files.length === 0) return;

      abortRef.current = false;
      setIsRunning(true);

      // Create pseudo-chapter states for progress tracking
      const initialStates: ChapterGenerationState[] = files.map(
        (file) => ({
          chapter: { title: file.name, text: "", index: 0, startPage: undefined } as DetectedChapter,
          status: "pending" as const,
          savedNoteId: null,
          error: null,
        })
      );
      setChapterStates(initialStates);

      const { data: session } = await supabase.auth.getSession();
      const accessToken = session?.session?.access_token || "";
      const userId = session?.session?.user?.id;

      if (!userId) {
        toast.error("You must be logged in to generate notes.");
        setIsRunning(false);
        return;
      }

      for (let i = 0; i < files.length; i++) {
        if (abortRef.current) {
          setChapterStates((prev) =>
            prev.map((s, idx) => (idx >= i ? { ...s, status: "skipped" } : s))
          );
          break;
        }

        const file = files[i];
        setCurrentIndex(i);

        setChapterStates((prev) =>
          prev.map((s, idx) => (idx === i ? { ...s, status: "generating" } : s))
        );

        try {
          // Extract text from file
          let textContent = "";
          if (isClientExtractable(file.name)) {
            const result = await extractTextFromFile(file);
            if (result && result.text) {
              textContent = result.text;
            }
          } else if (file.type.startsWith("text/")) {
            textContent = await file.text();
          }

          if (!textContent.trim()) {
            throw new Error(`Could not extract text from ${file.name}`);
          }

          const payload = {
            textContent,
            learningMode,
            extras,
            instructions: instructions || "",
            profilePrompt: profilePrompt || undefined,
            age: age ?? null,
          };

          const html = await streamGenerateNotes(accessToken, payload);

          if (!html || html.length < 50) {
            throw new Error("Generated content was too short or empty");
          }

          // Extract title from generated HTML
          const titleMatch =
            html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i) ||
            html.match(/<h2[^>]*>([\s\S]*?)<\/h2>/i);
          const tmpDiv = document.createElement("div");
          tmpDiv.innerHTML = titleMatch?.[1] || "";
          const noteTitle = tmpDiv.textContent?.trim() || file.name.replace(/\.[^.]+$/, "");

          // Save to library
          const { data: savedData, error: saveErr } = await supabase
            .from("saved_notes")
            .insert({
              user_id: userId,
              title: noteTitle,
              content: html,
              source_type: "generated",
              learning_mode: learningMode,
              folder,
              tags,
              sticky_notes: [] as unknown as Json,
              saved_videos: [] as unknown as Json,
            })
            .select("id")
            .single();

          if (saveErr) {
            throw new Error(`Save failed: ${saveErr.message}`);
          }

          setChapterStates((prev) =>
            prev.map((s, idx) =>
              idx === i ? { ...s, status: "complete", savedNoteId: savedData.id } : s
            )
          );
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : "Unknown error";
          console.error(`[File Gen] Failed file ${i + 1}: "${file.name}":`, err);

          setChapterStates((prev) =>
            prev.map((s, idx) =>
              idx === i ? { ...s, status: "failed", error: errorMsg } : s
            )
          );
        }

        if (i < files.length - 1 && !abortRef.current) {
          await new Promise((resolve) => setTimeout(resolve, 2000));
        }
      }

      setIsRunning(false);
      setCurrentIndex(-1);

      setChapterStates((prev) => {
        const done = prev.filter((s) => s.status === "complete").length;
        const failed = prev.filter((s) => s.status === "failed").length;
        if (failed > 0) {
          toast.warning(
            `Generated ${done} of ${prev.length} files. ${failed} failed.`,
            { duration: 6000 }
          );
        } else if (done > 0) {
          toast.success(
            `All ${done} background files saved to Library!`,
            { duration: 5000 }
          );
        }
        return prev;
      });
    },
    []
  );

  /** Stop after the current chapter finishes */
  const stopAfterCurrent = useCallback(() => {
    abortRef.current = true;
  }, []);

  /** Reset all state */
  const resetChapterGeneration = useCallback(() => {
    abortRef.current = true;
    setChapterStates([]);
    setIsRunning(false);
    setCurrentIndex(-1);
  }, []);

  return {
    /** Per-chapter status array */
    chapterStates,
    /** Whether background generation is in progress */
    isRunning,
    /** Index of the currently generating chapter (in backgroundChapters) */
    currentIndex,
    /** Count of completed chapters */
    completedCount,
    /** Count of failed chapters */
    failedCount,
    /** Total background chapters */
    totalCount,
    /** Start generating background chapters */
    startBackgroundGeneration,
    /** Start generating background files (multi-file upload) */
    startBackgroundFileGeneration,
    /** Stop after current chapter finishes */
    stopAfterCurrent,
    /** Reset all chapter generation state */
    resetChapterGeneration,
  };
}
