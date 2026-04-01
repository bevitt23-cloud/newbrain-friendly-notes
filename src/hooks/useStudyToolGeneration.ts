import { useState, useCallback } from "react";

const TOOL_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-study-tool`;

export type StudyToolType = "flashcard" | "mindmap" | "flowchart" | "practice" | "cloze" | "socratic" | "final-exam";

export function useStudyToolGeneration() {
  const [result, setResult] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = useCallback(async (tool: StudyToolType, notesHtml: string, profilePrompt?: string) => {
    setIsGenerating(true);
    setError(null);
    setResult(null);

    try {
      const resp = await fetch(TOOL_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ tool, notesHtml, profilePrompt }),
      });

      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({ error: "Request failed" }));
        throw new Error(errData.error || `Error ${resp.status}`);
      }

      const data = await resp.json();
      setResult(data.result);
      return data.result;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      setError(msg);
      return null;
    } finally {
      setIsGenerating(false);
    }
  }, []);

  const reset = useCallback(() => {
    setResult(null);
    setError(null);
  }, []);

  return { result, isGenerating, error, generate, reset };
}
