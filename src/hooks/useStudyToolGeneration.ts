import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

const TOOL_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-study-tool`;

export type StudyToolType = "flashcard" | "mindmap" | "flowchart" | "cloze" | "socratic" | "final-exam";

export function useStudyToolGeneration() {
  const generate = useCallback(async (tool: StudyToolType, notesHtml: string, profilePrompt?: string): Promise<string | null> => {
    try {
      const session = await supabase.auth.getSession();
      const token = session.data?.session?.access_token;
      const resp = await fetch(TOOL_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          Authorization: `Bearer ${token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ tool, notesHtml, profilePrompt }),
      });

      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({ error: "Request failed" }));
        throw new Error(errData.error || `Error ${resp.status}`);
      }

      const data = await resp.json();
      return data.result;
    } catch (e) {
      console.error(`[StudyToolGen] ${tool} failed:`, e);
      return null;
    }
  }, []);

  return { generate };
}
