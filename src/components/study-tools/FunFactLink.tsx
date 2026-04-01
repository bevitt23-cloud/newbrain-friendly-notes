import { useState } from "react";
import { Sparkles, Loader2, Clock, BookOpen } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useFunFacts } from "@/hooks/useFunFacts";
import { useCognitiveProfile } from "@/hooks/useCognitiveProfile";
import { useUserPreferences } from "@/hooks/useUserPreferences";
import { toast } from "sonner";

interface FunFactLinkProps {
  topic?: string;
  context?: string;
}

const FunFactLink = ({ topic, context }: FunFactLinkProps) => {
  const { profile } = useCognitiveProfile();
  const { preferences } = useUserPreferences();
  const { generateFunFact, saveFact, isGenerating } = useFunFacts();
  const [open, setOpen] = useState(false);
  const [factData, setFactData] = useState<{ fact: string; search_query: string } | null>(null);
  const [saved, setSaved] = useState(false);

  const isUnder13 = profile.age !== null && profile.age !== undefined && profile.age < 13;
  const isDisabled = !preferences.dopamine_rewards;

  if (isUnder13 || isDisabled) return null;

  const getEffectiveTopic = () => {
    let effectiveTopic = topic || "";
    if (preferences.fun_fact_mode === "special_interest" && profile.hyperFixations.length > 0) {
      const randomIdx = Math.floor(Math.random() * profile.hyperFixations.length);
      effectiveTopic = profile.hyperFixations[randomIdx];
    } else if (preferences.fun_fact_mode === "custom" && preferences.fun_fact_custom_topic) {
      effectiveTopic = preferences.fun_fact_custom_topic;
    }
    return effectiveTopic;
  };

  const handleClick = async () => {
    setOpen(true);
    setSaved(false);
    if (!factData) {
      const effectiveTopic = getEffectiveTopic();
      const result = await generateFunFact(
        effectiveTopic,
        preferences.fun_fact_mode === "material" ? context : undefined,
        preferences.fun_fact_mode === "special_interest" ? profile.hyperFixations : undefined,
      );
      if (result) setFactData(result);
    }
  };

  const handleSave = () => {
    if (!factData) return;
    saveFact(factData.fact, factData.search_query);
    setSaved(true);
    toast.success("Fun fact saved to your Library! 🎉");
  };

  return (
    <>
      <button
        onClick={handleClick}
        className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-600 hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-300 transition-colors"
      >
        <Sparkles className="h-3 w-3" />
        Fun Fact!
      </button>

      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setFactData(null); }}>
        <DialogContent className="max-w-sm rounded-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <span className="text-lg">🧠</span> Fun Fact!
            </DialogTitle>
            <DialogDescription className="sr-only">A fun fact about your study topic</DialogDescription>
          </DialogHeader>

          <div className="min-h-[80px]">
            <AnimatePresence mode="wait">
              {isGenerating && !factData ? (
                <motion.div
                  key="loading"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex items-center justify-center py-8 gap-2"
                >
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  <span className="text-sm text-muted-foreground">Finding something cool...</span>
                </motion.div>
              ) : factData ? (
                <motion.div
                  key="fact"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-4"
                >
                  <p className="text-sm leading-relaxed text-foreground">
                    {factData.fact}
                  </p>

                  <div className="flex flex-col gap-2">
                    {!saved ? (
                      <button
                        onClick={handleSave}
                        className="flex items-center justify-center gap-2 rounded-xl bg-primary/10 px-4 py-2.5 text-sm font-semibold text-primary transition-colors hover:bg-primary/20"
                      >
                        <Clock className="h-4 w-4" />
                        Save Fun Fact
                      </button>
                    ) : (
                      <div className="flex items-center justify-center gap-2 rounded-xl bg-secondary/30 px-4 py-2.5 text-sm font-semibold text-secondary-foreground">
                        ✅ Saved!
                      </div>
                    )}

                    <div className="flex items-center justify-center gap-1.5 rounded-xl bg-muted px-3 py-2 text-xs text-muted-foreground">
                      <BookOpen className="h-3 w-3" />
                      Saved fun facts live in your Library
                    </div>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="error"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="py-6 text-center text-sm text-muted-foreground"
                >
                  Couldn't generate a fun fact. Try again!
                  <button onClick={handleClick} className="block mx-auto mt-2 text-xs text-primary underline">
                    Retry
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default FunFactLink;
