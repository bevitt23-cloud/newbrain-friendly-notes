import { createContext, useContext, useState, useCallback, useRef, useEffect, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface SavedFunFact {
  id: string;
  fact: string;
  searchQuery: string;
  searchUrl: string;
  /** ISO timestamp (from the DB created_at column). */
  savedAt: string;
}

function searchUrlFor(query: string): string {
  return `https://www.google.com/search?q=${encodeURIComponent(query)}`;
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

  // Load persisted fun facts on mount (RLS scopes rows to the signed-in user).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("saved_fun_facts")
        .select("id, fact, search_query, search_url, created_at")
        .order("created_at", { ascending: false });
      if (cancelled || error || !data) return;
      setSavedFacts(
        data.map((row) => ({
          id: row.id,
          fact: row.fact,
          searchQuery: row.search_query,
          searchUrl: row.search_url || searchUrlFor(row.search_query),
          savedAt: row.created_at,
        }))
      );
    })();
    return () => { cancelled = true; };
  }, []);

  const saveFact = useCallback(async (fact: string, searchQuery: string) => {
    const { data: auth } = await supabase.auth.getUser();
    const userId = auth.user?.id;
    if (!userId) {
      toast.error("Please sign in to save fun facts.");
      return;
    }
    const searchUrl = searchUrlFor(searchQuery);
    const { data, error } = await supabase
      .from("saved_fun_facts")
      .insert({ user_id: userId, fact, search_query: searchQuery, search_url: searchUrl })
      .select("id, created_at")
      .single();
    if (error || !data) {
      console.error("Failed to save fun fact:", error);
      toast.error("Couldn't save that fun fact. Please try again.");
      return;
    }
    setSavedFacts((prev) => [
      { id: data.id, fact, searchQuery, searchUrl, savedAt: data.created_at },
      ...prev,
    ]);
  }, []);

  const removeFact = useCallback(async (id: string) => {
    setSavedFacts((prev) => prev.filter((f) => f.id !== id));
    const { error } = await supabase.from("saved_fun_facts").delete().eq("id", id);
    if (error) console.error("Failed to delete fun fact:", error);
  }, []);

  const clearFacts = useCallback(async () => {
    const ids = savedFacts.map((f) => f.id);
    setSavedFacts([]);
    if (ids.length > 0) {
      const { error } = await supabase.from("saved_fun_facts").delete().in("id", ids);
      if (error) console.error("Failed to clear fun facts:", error);
    }
  }, [savedFacts]);

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
