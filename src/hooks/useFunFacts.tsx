import { createContext, useContext, useState, useCallback, useRef, type ReactNode } from "react";
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

const SHOWN_FACTS_KEY = "bfn:funfact-history";
const SHOWN_FACTS_CAP = 30;

function loadShownFacts(): string[] {
  try {
    const raw = localStorage.getItem(SHOWN_FACTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((s) => typeof s === "string") : [];
  } catch {
    return [];
  }
}

function persistShownFacts(facts: string[]) {
  try {
    localStorage.setItem(SHOWN_FACTS_KEY, JSON.stringify(facts.slice(-SHOWN_FACTS_CAP)));
  } catch { /* localStorage may be full or unavailable */ }
}

export function FunFactProvider({ children }: { children: ReactNode }) {
  const [savedFacts, setSavedFacts] = useState<SavedFunFact[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  // Ref so updates between rapid clicks don't get overwritten by stale closures.
  const shownFactsRef = useRef<string[]>(loadShownFacts());

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
      let data: any;
      let error: any;
      try {
        ({ data, error } = await supabase.functions.invoke("generate-fun-fact", {
          body: {
            topic,
            context,
            interests,
            previousFacts: shownFactsRef.current.slice(-SHOWN_FACTS_CAP),
          },
        }));
      } catch (invokeErr) {
        throw new Error("The fun fact service returned an invalid response. Please try again.");
      }

      // Supabase wraps non-2xx responses in a FunctionsHttpError whose .context
      // is the raw Response. Read its body to surface the actual edge-function
      // error message instead of the generic "non-2xx status code".
      if (error) {
        const ctxResponse: Response | undefined = error?.context;
        if (ctxResponse && typeof ctxResponse.text === "function") {
          try {
            const bodyText = await ctxResponse.text();
            let serverMsg = bodyText;
            try {
              const json = JSON.parse(bodyText);
              if (json?.error) serverMsg = String(json.error);
            } catch { /* not JSON, use raw text */ }
            console.error("Fun fact edge-function error body:", serverMsg);
            throw new Error(serverMsg || "Fun fact service is unavailable.");
          } catch (readErr) {
            if (readErr instanceof Error && readErr.message && readErr.message !== "Fun fact service is unavailable.") {
              throw readErr;
            }
          }
        }
        throw error;
      }

      if (data && typeof data.fact === "string") {
        const newFact = data.fact.trim();
        if (newFact) {
          shownFactsRef.current = [...shownFactsRef.current, newFact].slice(-SHOWN_FACTS_CAP);
          persistShownFacts(shownFactsRef.current);
        }
        return { fact: data.fact, search_query: data.search_query ?? "" };
      }
      if (data && typeof data.result === "string") {
        const cleaned = data.result
          .replace(/^```(?:json)?\s*/i, "")
          .replace(/\s*```\s*$/i, "")
          .trim();
        try {
          const parsed = JSON.parse(cleaned) as { fact: string; search_query: string };
          const newFact = typeof parsed.fact === "string" ? parsed.fact.trim() : "";
          if (newFact) {
            shownFactsRef.current = [...shownFactsRef.current, newFact].slice(-SHOWN_FACTS_CAP);
            persistShownFacts(shownFactsRef.current);
          }
          return parsed;
        } catch {
          throw new Error("AI returned malformed fun fact. Please try again.");
        }
      }
      throw new Error("Empty response from fun fact service.");
    } catch (e) {
      console.error("Fun fact generation failed:", e);
      const msg = e instanceof Error ? e.message : String(e);
      const isMissingKeys = msg.includes("All AI models") || msg.includes("non-2xx");
      const isAuthIssue = msg.toLowerCase().includes("authentication") || msg.includes("401");
      toast.error("Fun fact generation failed", {
        description: isAuthIssue
          ? "Please sign in again — your session may have expired."
          : isMissingKeys
            ? "The AI service isn't configured. Add GEMINI_KEY or ANTHROPIC_KEY in Supabase → Edge Functions → Secrets."
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
