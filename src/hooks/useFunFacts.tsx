import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface SavedFunFact {
  id: string;
  fact: string;
  searchQuery: string;
  searchUrl: string;
  savedAt: number;
}

interface FunFactContextValue {
  savedFacts: SavedFunFact[];
  saveFact: (fact: string, searchQuery: string) => void;
  removeFact: (id: string) => void;
  clearFacts: () => void;
  generateFunFact: (topic: string, context?: string, interests?: string[]) => Promise<{ fact: string; search_query: string } | null>;
  isGenerating: boolean;
}

const FunFactContext = createContext<FunFactContextValue | null>(null);

export function FunFactProvider({ children }: { children: ReactNode }) {
  const [savedFacts, setSavedFacts] = useState<SavedFunFact[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);

  const saveFact = useCallback((fact: string, searchQuery: string) => {
    const newFact: SavedFunFact = {
      id: `ff-${Date.now()}`,
      fact,
      searchQuery,
      searchUrl: `https://www.google.com/search?q=${encodeURIComponent(searchQuery)}`,
      savedAt: Date.now(),
    };
    setSavedFacts((prev) => [...prev, newFact]);
  }, []);

  const removeFact = useCallback((id: string) => setSavedFacts((prev) => prev.filter((f) => f.id !== id)), []);

  const clearFacts = useCallback(() => setSavedFacts([]), []);

  const generateFunFact = useCallback(async (topic: string, context?: string, interests?: string[]) => {
    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-fun-fact", {
        body: { topic, context, interests },
      });

      if (error) throw error;

      const raw = data?.result || "";
      // Parse JSON from response
      const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      const parsed = JSON.parse(cleaned);
      return parsed as { fact: string; search_query: string };
    } catch (e) {
      console.error("Fun fact generation failed:", e);
      const msg = e instanceof Error ? e.message : String(e);
      toast.error("Fun fact generation failed", {
        description: msg.includes("non-2xx")
          ? "The AI service may not be configured. Please check that your API keys are set in Supabase Function Secrets."
          : msg,
      });
      return null;
    } finally {
      setIsGenerating(false);
    }
  }, []);

  return (
    <FunFactContext.Provider value={{ savedFacts, saveFact, removeFact, clearFacts, generateFunFact, isGenerating }}>
      {children}
    </FunFactContext.Provider>
  );
}

export function useFunFacts() {
  const ctx = useContext(FunFactContext);
  if (!ctx) throw new Error("useFunFacts must be used inside FunFactProvider");
  return ctx;
}
