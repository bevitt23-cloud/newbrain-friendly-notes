import { useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { ChapterChunk } from "@/components/ContentUploader";

export interface QuizQuestion {
  question: string;
  options: string[];
  correct: number;
  explanation: string;
}

export interface GenerateOptions {
  chapters: ChapterChunk[];
  youtubeUrl?: string;
  websiteUrl?: string;
  saveYouTubeVideo?: boolean;
  backgroundProcessingEnabled?: boolean;
  instructions?: string;
  learningMode?: string;
  extras?: string[];
  profilePrompt?: string;
  age?: number;
  folder?: string;
  tags?: string[];
  shouldSaveToLibrary?: boolean;
  images?: Array<{ data: string; mimeType: string } | File | Blob>;
}

/**
 * Convert a File or blob to base64 string
 */
function toBase64(file: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Extract base64 part after "data:...;base64,"
      const base64 = result.split(",")[1];
      resolve(base64 || "");
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function isUploadImageOrPdf(mimeType: string): boolean {
  return mimeType.startsWith("image/") || mimeType === "application/pdf";
}

async function normalizeImages(
  input: GenerateOptions["images"]
): Promise<Array<{ data: string; mimeType: string }>> {
  if (!input || input.length === 0) return [];

  const normalized = await Promise.all(
    input.map(async (item) => {
      if (item instanceof File || item instanceof Blob) {
        const mimeType = item.type || "application/octet-stream";
        if (!isUploadImageOrPdf(mimeType)) return null;

        return {
          data: await toBase64(item),
          mimeType,
        };
      }

      if (
        item &&
        typeof item === "object" &&
        "data" in item &&
        typeof item.data === "string" &&
        "mimeType" in item &&
        typeof item.mimeType === "string" &&
        isUploadImageOrPdf(item.mimeType)
      ) {
        return {
          data: item.data,
          mimeType: item.mimeType,
        };
      }

      return null;
    })
  );

  return normalized.filter((item): item is { data: string; mimeType: string } => Boolean(item));
}

export function useNoteGeneration() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatedHtml, setGeneratedHtml] = useState("");
  const [uploadProgress, setUploadProgress] = useState("");
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([]);
  const [isGeneratingQuiz, setIsGeneratingQuiz] = useState(false);
  const ageRef = useRef<number | null>(null);

  const generate = useCallback(async (opts: GenerateOptions) => {
    setIsGenerating(true);
    setError(null);
    setGeneratedHtml("");
    setUploadProgress("");
    setQuizQuestions([]);
    setIsGeneratingQuiz(false);
    ageRef.current = opts.age ?? null;

    try {
      const { data: session } = await supabase.auth.getSession();
      const userId = session?.session?.user?.id;
      const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      const accessToken = session?.session?.access_token || anonKey;
      const images = await normalizeImages(opts.images);

      if (opts.youtubeUrl || opts.websiteUrl) {
        setUploadProgress("Generating your notes...");

        const payload = {
          textContent: "",
          youtubeUrl: opts.youtubeUrl,
          websiteUrl: opts.websiteUrl,
          learningMode: opts.learningMode,
          extras: Array.isArray(opts.extras) ? opts.extras : [],
          instructions: typeof opts.instructions === "string" ? opts.instructions : "",
          profilePrompt: opts.profilePrompt,
          age: opts.age ?? null,
          saveYouTubeVideo: opts.saveYouTubeVideo,
          images,
        };

        console.log('Sending payload:', payload);

        const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-notes`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: anonKey,
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify(payload),
        });

        if (!resp.ok) {
          const errData = await resp.json().catch(() => ({ error: "Request failed" }));
          throw new Error(errData.error || `Error ${resp.status}`);
        }
        if (!resp.body) throw new Error("No response body");

        const reader = resp.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let fullContent = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          let newlineIndex: number;
          while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
            let line = buffer.slice(0, newlineIndex);
            buffer = buffer.slice(newlineIndex + 1);
            if (line.endsWith("\r")) line = line.slice(0, -1);

            if (line.startsWith("data: ")) {
              const jsonStr = line.slice(6).trim();
              if (jsonStr === "[DONE]") continue;

              try {
                const parsed = JSON.parse(jsonStr);
                const delta = parsed.choices?.[0]?.delta?.content || parsed.text || "";
                if (delta) {
                  fullContent += delta;
                  setGeneratedHtml(fullContent);
                }
              } catch {
                buffer = `${line}\n${buffer}`;
                break;
              }
            }
          }
        }

        const finalHtml = fullContent
          .replace(/^```html\s*/i, "")
          .replace(/^```\s*/i, "")
          .replace(/\s*```\s*$/i, "")
          .trim();

        setGeneratedHtml(finalHtml);
        setUploadProgress("");

        const shouldQuiz = (opts.extras || []).includes("retention_quiz");
        if (shouldQuiz && finalHtml.length > 100) {
          setIsGeneratingQuiz(true);
          fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-retention-quiz`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              apikey: anonKey,
              Authorization: `Bearer ${accessToken}`,
            },
            body: JSON.stringify({ notesHtml: finalHtml, age: ageRef.current }),
          })
            .then((r) => (r.ok ? r.json() : null))
            .then((data) => {
              if (data?.questions && Array.isArray(data.questions)) {
                setQuizQuestions(data.questions as QuizQuestion[]);
              }
            })
            .catch(() => {})
            .finally(() => setIsGeneratingQuiz(false));
        }

        return;
      }

      if (!opts.chapters || opts.chapters.length === 0) {
        throw new Error("No content provided to generate.");
      }

      if (opts.backgroundProcessingEnabled) {
        const [firstChapter, ...remainingChapters] = opts.chapters;
        setUploadProgress(`Generating chapter 1 of ${opts.chapters.length}: ${firstChapter.title}`);

        const payload = {
          textContent: firstChapter.text,
          learningMode: opts.learningMode,
          extras: Array.isArray(opts.extras) ? opts.extras : [],
          instructions: opts.instructions,
          profilePrompt: opts.profilePrompt,
          age: opts.age,
          images,
        };

        console.log('Sending payload:', payload);

        const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-notes`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: anonKey,
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify(payload),
        });

        if (!resp.ok) throw new Error("Failed to generate chapter 1.");
        if (!resp.body) throw new Error("No response body");

        const reader = resp.body.getReader();
        const decoder = new TextDecoder();
        let sseBuffer = "";
        let firstChapterContent = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          sseBuffer += decoder.decode(value, { stream: true });
          let newlineIndex: number;
          while ((newlineIndex = sseBuffer.indexOf("\n")) !== -1) {
            let line = sseBuffer.slice(0, newlineIndex);
            sseBuffer = sseBuffer.slice(newlineIndex + 1);
            if (line.endsWith("\r")) line = line.slice(0, -1);

            if (line.startsWith("data: ") && !line.includes("[DONE]")) {
              try {
                const parsed = JSON.parse(line.slice(6));
                const delta = parsed.choices?.[0]?.delta?.content || "";
                firstChapterContent += delta;
                setGeneratedHtml(firstChapterContent);
              } catch {
                sseBuffer = `${line}\n${sseBuffer}`;
                break;
              }
            }
          }
        }

        const cleanedFirstChapter = firstChapterContent
          .replace(/^```html\s*/i, "")
          .replace(/^```\s*/i, "")
          .replace(/\s*```\s*$/i, "")
          .trim();

        setGeneratedHtml(cleanedFirstChapter);
        setUploadProgress("");

        const shouldQuiz = (opts.extras || []).includes("retention_quiz");
        if (shouldQuiz && cleanedFirstChapter.length > 100) {
          setIsGeneratingQuiz(true);
          fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-retention-quiz`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              apikey: anonKey,
              Authorization: `Bearer ${accessToken}`,
            },
            body: JSON.stringify({ notesHtml: cleanedFirstChapter, age: ageRef.current }),
          })
            .then((r) => (r.ok ? r.json() : null))
            .then((data) => {
              if (data?.questions && Array.isArray(data.questions)) {
                setQuizQuestions(data.questions as QuizQuestion[]);
              }
            })
            .catch(() => {})
            .finally(() => setIsGeneratingQuiz(false));
        }

        if (remainingChapters.length > 0 && opts.shouldSaveToLibrary) {
          if (!userId) {
            throw new Error("You must be signed in to queue background jobs.");
          }

          const queueRows = remainingChapters.map((chapter) => ({
            user_id: userId,
            status: "pending",
            content_chunk: chapter.text,
            folder: opts.folder || "Unsorted",
            tags: opts.tags || [],
            instructions: typeof opts.instructions === "string" ? opts.instructions : null,
            learning_mode: opts.learningMode || "adhd",
            extras: Array.isArray(opts.extras) ? opts.extras : [],
            profile_prompt: opts.profilePrompt || null,
            age: typeof opts.age === "number" ? opts.age : null,
          }));

          const { error: queueError } = await supabase
            .from("background_jobs")
            .insert(queueRows);

          if (queueError) {
            throw new Error(queueError.message || "Failed to queue background jobs.");
          }

          toast.success("Chapter 1 is generating now. The rest of the textbook is processing in the background and will appear in your Library soon.");
        }

        return;
      }

      for (let i = 0; i < opts.chapters.length; i++) {
        const chapter = opts.chapters[i];
        const isFirstChapter = i === 0;

        setUploadProgress(`Generating note ${i + 1} of ${opts.chapters.length}: ${chapter.title}`);

        const payload = {
          textContent: chapter.text,
          learningMode: opts.learningMode,
          extras: isFirstChapter ? opts.extras : [],
          instructions: opts.instructions,
          profilePrompt: opts.profilePrompt,
          age: opts.age,
          images: isFirstChapter ? images : [],
        };

        console.log('Sending payload:', payload);

        const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-notes`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: anonKey,
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify(payload),
        });

        if (!resp.ok) throw new Error("Failed to generate chapter.");
        if (!resp.body) throw new Error("No response body");

        const reader = resp.body.getReader();
        const decoder = new TextDecoder();
        let sseBuffer = "";
        let chunkContent = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          sseBuffer += decoder.decode(value, { stream: true });
          let newlineIndex: number;
          while ((newlineIndex = sseBuffer.indexOf("\n")) !== -1) {
            let line = sseBuffer.slice(0, newlineIndex);
            sseBuffer = sseBuffer.slice(newlineIndex + 1);
            if (line.endsWith("\r")) line = line.slice(0, -1);

            if (line.startsWith("data: ") && !line.includes("[DONE]")) {
              try {
                const parsed = JSON.parse(line.slice(6));
                const delta = parsed.choices?.[0]?.delta?.content || "";
                chunkContent += delta;

                if (isFirstChapter) {
                  setGeneratedHtml(chunkContent);
                }
              } catch {
                sseBuffer = `${line}\n${sseBuffer}`;
                break;
              }
            }
          }
        }

        if (chunkContent.startsWith("```html")) chunkContent = chunkContent.slice(7);
        if (chunkContent.endsWith("```")) chunkContent = chunkContent.slice(0, -3);

        if (opts.shouldSaveToLibrary && userId) {
          await supabase.from("saved_notes").insert({
            user_id: userId,
            title: chapter.title,
            content: chunkContent.trim(),
            source_type: "generated",
            learning_mode: opts.learningMode || "adhd",
            folder: opts.folder || "Unsorted",
            tags: opts.tags || [],
            sticky_notes: [],
            saved_videos: [],
          });

          if (!isFirstChapter) {
            toast.success(`Saved "${chapter.title}" to ${opts.folder}`);
          }
        }
      }

      toast.success("All selected chapters have been processed!");

    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      setError(msg);
      toast.error(msg);
    } finally {
      setIsGenerating(false);
      setUploadProgress("");
    }
  }, []);

  const reset = useCallback(() => {
    setIsGenerating(false);
    setError(null);
    setGeneratedHtml("");
    setUploadProgress("");
    setQuizQuestions([]);
    setIsGeneratingQuiz(false);
    ageRef.current = null;
  }, []);

  return {
    generate,
    reset,
    isGenerating,
    error,
    generatedHtml,
    uploadProgress,
    quizQuestions,
    isGeneratingQuiz,
  };
}