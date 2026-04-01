import { useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { isClientExtractable, extractTextFromFile } from "@/lib/extractTextFromFile";

export interface GenerateOptions {
  textContent?: string;
  files?: File[];
  youtubeUrl?: string;
  websiteUrl?: string;
  instructions?: string;
  learningMode?: string;
  extras?: string[];
  profilePrompt?: string;
  age?: number;
  folder?: string;
  tags?: string[];
  shouldSaveToLibrary?: boolean;
}

export function useNoteGeneration() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatedHtml, setGeneratedHtml] = useState("");
  const [uploadProgress, setUploadProgress] = useState("");
  const [quizQuestions, setQuizQuestions] = useState<any[]>([]);
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
      // 1. Normalize text to prevent "undefined" string coercion
      const normalizedTextContent =
        typeof opts.textContent === "string" && opts.textContent.trim().toLowerCase() !== "undefined"
          ? opts.textContent
          : "";

      // 2. Advanced Safe File Extraction
      const extractedTexts: string[] = [];
      if (Array.isArray(opts.files) && opts.files.length > 0) {
        for (let i = 0; i < opts.files.length; i++) {
          const file = opts.files[i];

          if (opts.files.length > 1) {
            setUploadProgress(`Extracting text locally from file ${i + 1} of ${opts.files.length}...`);
          } else {
            setUploadProgress("Extracting text locally (this may take a minute for large files)...");
          }

          if (typeof isClientExtractable === "function" && isClientExtractable(file.name)) {
            try {
              const result = await extractTextFromFile(file);
              if (result && typeof result.text === "string" && result.text.trim().length > 0) {
                extractedTexts.push(`--- Content from ${result.fileName || file.name} ---\n${result.text}`);
              } else {
                extractedTexts.push(`[Could not extract text from ${file.name}]`);
              }
            } catch (err) {
              console.error(`Client-side extraction failed for ${file.name}:`, err);
              extractedTexts.push(`[Failed to extract text from ${file.name}: ${err instanceof Error ? err.message : "Unknown error"}]`);
            }
          } else if (file.type.startsWith("text/")) {
            try {
              const text = await file.text();
              extractedTexts.push(`--- Content from ${file.name} ---\n${text}`);
            } catch (err) {
              extractedTexts.push(`[Failed to read text file ${file.name}: ${err instanceof Error ? err.message : "Unknown error"}]`);
            }
          } else {
            extractedTexts.push(`[File "${file.name}" is a ${file.type || "binary"} file that cannot be extracted client-side. Please use PDF, DOCX, or TXT format.]`);
          }
        }
      }

      const combinedTextContent = [normalizedTextContent, extractedTexts.join("\n\n")]
        .filter((chunk) => typeof chunk === "string" && chunk.trim().length > 0)
        .join("\n\n");

      const payload = {
        textContent: combinedTextContent || "",
        youtubeUrl: typeof opts.youtubeUrl === "string" ? opts.youtubeUrl : undefined,
        websiteUrl: typeof opts.websiteUrl === "string" ? opts.websiteUrl : undefined,
        learningMode: opts.learningMode,
        extras: Array.isArray(opts.extras) ? opts.extras : [],
        instructions: typeof opts.instructions === "string" ? opts.instructions : "",
        profilePrompt: typeof opts.profilePrompt === "string" ? opts.profilePrompt : undefined,
        age: opts.age ?? null,
      };

      if (!payload.textContent && !payload.youtubeUrl && !payload.websiteUrl) {
        throw new Error("No valid content found to generate notes from. Please provide text, a file, or a URL.");
      }

      setUploadProgress("Generating your notes...");

      const { data: session } = await supabase.auth.getSession();
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-notes`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.session?.access_token || import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify(payload),
        }
      );

      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({ error: "Request failed" }));
        const errorMsg = errData.error || `Error ${resp.status}`;
        throw new Error(errorMsg);
      }

      if (!resp.body) throw new Error("No response body");

      setUploadProgress("");

      // ==========================================
      // 3. THE FIX: UNIVERSAL STREAM DECODER
      // ==========================================
      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let fullContent = "";
      let isSSE = false; // We will detect the format on the fly

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value, { stream: true });
        buffer += chunk;

        // Auto-detect if the AI is using Server-Sent Events
        if (!isSSE && buffer.includes("data: ")) {
          isSSE = true;
        }

        if (isSSE) {
          // Parse as SSE JSON chunks
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
                const delta = parsed.choices?.[0]?.delta?.content || parsed.text || parsed.delta || "";
                if (delta) {
                  fullContent += delta;
                  setGeneratedHtml(fullContent);
                }
              } catch {
                // If JSON is cut off, put it back in the buffer and wait for the next piece
                buffer = line + "\n" + buffer;
                break;
              }
            }
          }
        } else {
          // Parse as Raw Text Stream
          fullContent += chunk;
          setGeneratedHtml(fullContent);
          buffer = ""; // Clear buffer so we don't duplicate text
        }
      }

      // 4. Formatting Cleanups
      let cleaned = fullContent;
      if (cleaned.startsWith("```html")) cleaned = cleaned.slice(7);
      if (cleaned.startsWith("```")) cleaned = cleaned.slice(3);
      if (cleaned.endsWith("```")) cleaned = cleaned.slice(0, -3);
      
      const finalHtml = cleaned.trim();
      setGeneratedHtml(finalHtml);

      // 5. Trigger Quiz Generation
      const shouldQuiz = payload.extras.includes("retention_quiz");
      if (shouldQuiz && finalHtml.length > 100) {
        setIsGeneratingQuiz(true);
        fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-retention-quiz`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.session?.access_token || import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({ notesHtml: finalHtml, age: ageRef.current }),
        })
          .then((r) => (r.ok ? r.json() : null))
          .then((data) => {
            if (data?.questions && Array.isArray(data.questions)) {
              setQuizQuestions(data.questions);
            }
          })
          .catch(() => {})
          .finally(() => setIsGeneratingQuiz(false));
      }

    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      console.error("[NoteGen] Generation failed:", msg);
      setError(msg);
      toast.error(msg, { duration: 8000 });
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
    isGeneratingQuiz
  };
}