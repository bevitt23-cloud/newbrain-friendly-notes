import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { RotateCcw, Star } from "lucide-react";
import { useTelemetry } from "@/hooks/useTelemetry";
import { useToolEngagement } from "@/hooks/useToolEngagement";

interface ClozeData {
  text?: string;
  textSegments?: { type: string; value?: string; id?: string; answer?: string }[];
  blanks?: string[];
  wordBank: string[];
}

export default function ClozeNotes({ data, onStarQuestion }: { data: string; onStarQuestion?: (q: string) => void }) {
  const { track } = useTelemetry();
  const { markComplete } = useToolEngagement("cloze");
  const [cloze, setCloze] = useState<ClozeData | null>(null);
  const [parseError, setParseError] = useState(false);
  const [userAnswers, setUserAnswers] = useState<Record<string, string>>({});
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [incorrect, setIncorrect] = useState<Record<string, boolean>>({});
  const [starred, setStarred] = useState<Set<string>>(new Set());
  const [shaking, setShaking] = useState<string | null>(null);

  useEffect(() => {
    try {
      const cleaned = data.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
      const parsed = JSON.parse(cleaned);
      setCloze(parsed);
      setParseError(false);
      // Reset all state on new data
      setUserAnswers({});
      setChecked({});
      setIncorrect({});
      setStarred(new Set());
    } catch {
      setCloze(null);
      setParseError(true);
    }
  }, [data]);

  if (parseError) {
    return (
      <div className="rounded-2xl border border-amber-200 dark:border-amber-400/30 bg-amber-50 dark:bg-amber-400/10 p-4 space-y-2">
        <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">Fill-in-the-blank data couldn't be read. Try generating again.</p>
        <details className="text-xs text-muted-foreground">
          <summary className="cursor-pointer hover:text-foreground">Show raw output</summary>
          <pre className="mt-2 whitespace-pre-wrap rounded-lg bg-muted/50 p-3 max-h-40 overflow-auto">{data}</pre>
        </details>
      </div>
    );
  }

  if (!cloze) return <p className="text-sm text-muted-foreground">Could not parse cloze data.</p>;

  // Build segments from text + blanks format
  const segments = cloze.textSegments || (() => {
    if (!cloze.text || !cloze.blanks) return [];
    const parts = cloze.text.split("____");
    const segs: ClozeData["textSegments"] = [];
    parts.forEach((part, i) => {
      segs.push({ type: "text", value: part });
      if (i < parts.length - 1 && i < cloze.blanks!.length) {
        segs.push({ type: "blank", id: `b${i}`, answer: cloze.blanks![i] });
      }
    });
    return segs;
  })();

  const blanks = segments?.filter((s) => s.type === "blank") || [];
  const allCorrect = blanks.length > 0 && blanks.every((b) => checked[b.id!] === true);

  const handleCheck = (blankId: string) => {
    const blank = blanks.find((b) => b.id === blankId);
    if (!blank) return;
    const isCorrect = userAnswers[blankId]?.toLowerCase().trim() === blank.answer?.toLowerCase().trim();
    track("cloze_answer", { blankId, correct: isCorrect, answer: blank.answer });
    if (isCorrect) {
      const newChecked = { ...checked, [blankId]: true };
      setChecked(newChecked);
      setIncorrect((p) => { const n = { ...p }; delete n[blankId]; return n; });
      const allDone = blanks.length > 0 && blanks.every((b) => newChecked[b.id!] === true);
      if (allDone) {
        const correctCount = blanks.length;
        track("cloze_session_complete", { totalBlanks: blanks.length, correctCount });
        markComplete();
      }
    } else {
      setIncorrect((p) => ({ ...p, [blankId]: true }));
      setShaking(blankId);
      setTimeout(() => setShaking(null), 500);
    }
  };

  const handleTryAgain = (blankId: string) => {
    setUserAnswers((p) => ({ ...p, [blankId]: "" }));
    setIncorrect((p) => { const n = { ...p }; delete n[blankId]; return n; });
  };

  const handleStar = (blankId: string) => {
    const blank = blanks.find((b) => b.id === blankId);
    const next = new Set(starred);
    if (next.has(blankId)) {
      next.delete(blankId);
    } else {
      next.add(blankId);
      if (blank?.answer) onStarQuestion?.(`Fill in the blank: ${blank.answer}`);
    }
    setStarred(next);
  };

  const usedWords = new Set(
    blanks.filter((b) => checked[b.id!]).map((b) => b.answer?.toLowerCase())
  );

  return (
    <div className="space-y-5">
      {/* Text with blanks */}
      <div className="rounded-2xl border border-border bg-card p-5 text-[0.95rem] leading-relaxed text-foreground">
        {segments?.map((seg, i) => {
          if (seg.type === "text") return <span key={i}>{seg.value}</span>;
          const blankId = seg.id!;
          const isCorrect = checked[blankId];
          const isIncorrect = incorrect[blankId];
          return (
            <motion.span
              key={blankId}
              animate={shaking === blankId ? { x: [-5, 5, -5, 5, 0] } : {}}
              transition={{ duration: 0.4 }}
              className="inline-block mx-1"
            >
              {isCorrect ? (
                <span className="inline-block rounded-lg bg-sage-100 dark:bg-sage-500/15 border border-sage-300 dark:border-sage-300/30 px-3 py-1 text-sm font-semibold text-sage-700 dark:text-sage-300">
                  {seg.answer}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1">
                  <input
                    id={`cloze-blank-${blankId}`}
                    name={`clozeBlank${blankId}`}
                    type="text"
                    value={userAnswers[blankId] || ""}
                    onChange={(e) => setUserAnswers({ ...userAnswers, [blankId]: e.target.value })}
                    onKeyDown={(e) => e.key === "Enter" && handleCheck(blankId)}
                    placeholder="..."
                    className={`inline-block w-28 rounded-lg border-b-2 border-dashed bg-muted/30 px-2 py-1 text-center text-sm font-medium text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary ${
                      isIncorrect ? "border-peach-300" : "border-lavender-300"
                    }`}
                  />
                  {isIncorrect && (
                    <>
                      <button onClick={() => handleTryAgain(blankId)} className="rounded-full p-1 text-muted-foreground hover:bg-muted transition-colors" title="Try Again">
                        <RotateCcw className="h-3 w-3" />
                      </button>
                      <button onClick={() => handleStar(blankId)} className={`rounded-full p-1 transition-colors ${starred.has(blankId) ? "text-amber-500" : "text-muted-foreground hover:bg-muted"}`} title="Star for review">
                        <Star className={`h-3 w-3 ${starred.has(blankId) ? "fill-amber-400" : ""}`} />
                      </button>
                    </>
                  )}
                </span>
              )}
            </motion.span>
          );
        })}
      </div>

      {/* Word Bank */}
      <div className="space-y-2">
        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Word Bank</p>
        <div className="flex flex-wrap gap-2">
          {cloze.wordBank.map((word, i) => {
            const isUsed = usedWords.has(word.toLowerCase());
            return (
              <span
                key={i}
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-all ${
                  isUsed
                    ? "border-sage-200 dark:border-sage-200/30 bg-sage-50 dark:bg-sage-500/10 text-sage-400 dark:text-sage-500 line-through opacity-50"
                    : "border-lavender-200 dark:border-lavender-200/30 bg-lavender-50 dark:bg-lavender-500/10 text-foreground shadow-sm"
                }`}
              >
                {word}
              </span>
            );
          })}
        </div>
      </div>

      {allCorrect && (
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="rounded-2xl border border-sage-200 dark:border-sage-200/30 bg-sage-50 dark:bg-sage-500/10 p-4 text-center">
          <p className="text-sm font-semibold text-sage-700 dark:text-sage-300">🎉 All blanks filled correctly!</p>
        </motion.div>
      )}

      {starred.size > 0 && (
        <div className="rounded-xl border border-amber-200 dark:border-amber-400/30 bg-amber-50 dark:bg-amber-400/10 p-3">
          <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">⭐ {starred.size} blank{starred.size > 1 ? "s" : ""} starred for review</p>
        </div>
      )}
    </div>
  );
}
