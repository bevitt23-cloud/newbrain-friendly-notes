import { useState, useEffect, useRef } from "react";
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

export default function ClozeNotes({ data, onStarQuestion, noteId }: { data: string; onStarQuestion?: (q: string) => void; noteId?: string }) {
  const { track } = useTelemetry();
  const { markComplete } = useToolEngagement("cloze");
  const [cloze, setCloze] = useState<ClozeData | null>(null);
  const [parseError, setParseError] = useState(false);
  const [userAnswers, setUserAnswers] = useState<Record<string, string>>({});
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [incorrect, setIncorrect] = useState<Record<string, boolean>>({});
  const [starred, setStarred] = useState<Set<string>>(new Set());
  const [shaking, setShaking] = useState<string | null>(null);
  const [draggedWord, setDraggedWord] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const touchDragRef = useRef<{ word: string; startY: number } | null>(null);

  useEffect(() => {
    try {
      const cleaned = data.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
      const parsed = JSON.parse(cleaned);
      setCloze(parsed);
      setParseError(false);
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
    track("cloze_answer", { blankId, correct: isCorrect, answer: blank.answer, question: blank.answer, note_id: noteId });
    if (isCorrect) {
      const newChecked = { ...checked, [blankId]: true };
      setChecked(newChecked);
      setIncorrect((p) => { const n = { ...p }; delete n[blankId]; return n; });
      const allDone = blanks.length > 0 && blanks.every((b) => newChecked[b.id!] === true);
      if (allDone) {
        track("cloze_session_complete", { totalBlanks: blanks.length, correctCount: blanks.length, note_id: noteId });
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

  const handleDrop = (blankId: string, word: string) => {
    if (checked[blankId]) return;
    setUserAnswers((p) => ({ ...p, [blankId]: word }));
    setDropTarget(null);
    setDraggedWord(null);
    setTimeout(() => handleCheck(blankId), 150);
  };

  const usedWords = new Set(
    blanks.filter((b) => checked[b.id!]).map((b) => b.answer?.toLowerCase())
  );

  const placedWords = new Set(
    blanks
      .filter((b) => !checked[b.id!] && userAnswers[b.id!])
      .map((b) => userAnswers[b.id!]?.toLowerCase())
  );

  return (
    <div className="space-y-5">
      <p className="text-xs text-muted-foreground text-center">
        Drag words from the word bank into the blanks, or tap a word then tap a blank
      </p>

      {/* Text with blanks (drop targets) */}
      <div className="rounded-2xl border border-border bg-card p-5 text-[0.95rem] leading-[2.2] text-foreground">
        {segments?.map((seg, i) => {
          if (seg.type === "text") return <span key={i}>{seg.value}</span>;
          const blankId = seg.id!;
          const isCorrect = checked[blankId];
          const isIncorrect = incorrect[blankId];
          const currentAnswer = userAnswers[blankId];
          const isOver = dropTarget === blankId;
          return (
            <motion.span
              key={blankId}
              animate={shaking === blankId ? { x: [-5, 5, -5, 5, 0] } : {}}
              transition={{ duration: 0.4 }}
              className="inline-block mx-1 align-middle"
            >
              {isCorrect ? (
                <span className="inline-block rounded-lg bg-sage-100 dark:bg-sage-500/15 border border-sage-300 dark:border-sage-300/30 px-3 py-1 text-sm font-semibold text-sage-700 dark:text-sage-300">
                  {seg.answer}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1">
                  <span
                    className={`inline-flex items-center justify-center min-w-[5rem] rounded-lg border-2 border-dashed px-3 py-1 text-sm font-medium transition-all cursor-pointer ${
                      isOver
                        ? "border-primary bg-primary/10 scale-105"
                        : currentAnswer
                          ? isIncorrect
                            ? "border-peach-300 bg-peach-50 dark:bg-peach-500/10 text-foreground"
                            : "border-lavender-400 bg-lavender-50 dark:bg-lavender-500/10 text-foreground"
                          : "border-lavender-300 dark:border-lavender-300/40 bg-muted/30 text-muted-foreground/50"
                    }`}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDropTarget(blankId);
                    }}
                    onDragLeave={() => setDropTarget(null)}
                    onDrop={(e) => {
                      e.preventDefault();
                      const word = e.dataTransfer.getData("text/plain");
                      if (word) handleDrop(blankId, word);
                    }}
                    onClick={() => {
                      if (draggedWord) {
                        handleDrop(blankId, draggedWord);
                      }
                    }}
                  >
                    {currentAnswer || "..."}
                  </span>
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

      {/* Word Bank (drag sources) */}
      <div className="space-y-2">
        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Word Bank</p>
        <div className="flex flex-wrap gap-2">
          {cloze.wordBank.map((word, i) => {
            const isUsed = usedWords.has(word.toLowerCase());
            const isPlaced = placedWords.has(word.toLowerCase());
            const isActive = draggedWord === word;
            return (
              <span
                key={i}
                draggable={!isUsed}
                onDragStart={(e) => {
                  e.dataTransfer.setData("text/plain", word);
                  e.dataTransfer.effectAllowed = "move";
                  setDraggedWord(word);
                }}
                onDragEnd={() => setDraggedWord(null)}
                onTouchStart={() => {
                  if (!isUsed) setDraggedWord(word);
                }}
                onClick={() => {
                  if (isUsed) return;
                  setDraggedWord((prev) => prev === word ? null : word);
                }}
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-all select-none ${
                  isUsed
                    ? "border-sage-200 dark:border-sage-200/30 bg-sage-50 dark:bg-sage-500/10 text-sage-400 dark:text-sage-500 line-through opacity-50 cursor-default"
                    : isActive
                      ? "border-primary bg-primary/15 text-primary ring-2 ring-primary/30 scale-105 cursor-grabbing"
                      : isPlaced
                        ? "border-lavender-300 dark:border-lavender-300/30 bg-lavender-50 dark:bg-lavender-500/10 text-lavender-500 opacity-60 cursor-grab"
                        : "border-lavender-200 dark:border-lavender-200/30 bg-lavender-50 dark:bg-lavender-500/10 text-foreground shadow-sm cursor-grab hover:shadow-md hover:scale-105"
                }`}
              >
                {word}
              </span>
            );
          })}
        </div>
        {draggedWord && (
          <p className="text-[11px] text-primary font-medium animate-pulse">
            Now tap a blank to place "{draggedWord}"
          </p>
        )}
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
