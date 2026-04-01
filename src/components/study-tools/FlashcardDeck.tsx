import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { RotateCcw, ChevronLeft, ChevronRight, Check, Star, Eye, Keyboard } from "lucide-react";
import { useTelemetry } from "@/hooks/useTelemetry";

interface Card {
  id: string;
  front: string;
  back: string;
}

export default function FlashcardDeck({ data, onStarQuestion }: { data: string; onStarQuestion?: (q: string) => void }) {
  const { track } = useTelemetry();
  const [cards, setCards] = useState<Card[]>([]);
  const [current, setCurrent] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [mastered, setMastered] = useState<Set<string>>(new Set());
  const [starred, setStarred] = useState<Set<string>>(new Set());
  const [typeMode, setTypeMode] = useState(false); // false = flip mode, true = type mode
  const [typedAnswer, setTypedAnswer] = useState("");
  const [answerRevealed, setAnswerRevealed] = useState(false);
  const [answerCorrect, setAnswerCorrect] = useState<boolean | null>(null);

  useEffect(() => {
    try {
      const cleaned = data.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
      const parsed = JSON.parse(cleaned);
      setCards(parsed.map((c: any, i: number) => ({ id: c.id || String(i), front: c.front, back: c.back })));
    } catch { setCards([]); }
  }, [data]);

  if (!cards.length) return <p className="text-sm text-muted-foreground">No flashcards generated.</p>;

  const card = cards[current];
  const progress = ((mastered.size / cards.length) * 100).toFixed(0);

  const resetCard = () => {
    setFlipped(false);
    setTypedAnswer("");
    setAnswerRevealed(false);
    setAnswerCorrect(null);
  };

  const handleGotIt = () => {
    const newMastered = new Set(mastered).add(card.id);
    setMastered(newMastered);
    track("flashcard_rated", { cardId: card.id, rating: "mastered", cardIndex: current, totalCards: cards.length });
    if (newMastered.size === cards.length) {
      track("flashcard_session_complete", { totalCards: cards.length, mastered: newMastered.size });
    }
    goNext();
  };

  const handleReviewAgain = () => {
    track("flashcard_rated", { cardId: card.id, rating: "review_again", cardIndex: current, totalCards: cards.length });
    if (current === cards.length - 1) {
      track("flashcard_session_complete", { totalCards: cards.length, mastered: mastered.size });
    }
    goNext();
  };

  const goNext = () => {
    resetCard();
    setCurrent((c) => Math.min(cards.length - 1, c + 1));
  };

  const handleCheckTyped = () => {
    const correct = typedAnswer.toLowerCase().trim() === card.back.toLowerCase().trim();
    setAnswerCorrect(correct);
    setAnswerRevealed(true);
    if (correct) {
      setMastered((prev) => new Set(prev).add(card.id));
    }
  };

  const handleTryAgain = () => {
    setTypedAnswer("");
    setAnswerRevealed(false);
    setAnswerCorrect(null);
    setFlipped(false);
  };

  const handleStar = () => {
    const next = new Set(starred);
    if (next.has(card.id)) {
      next.delete(card.id);
    } else {
      next.add(card.id);
      onStarQuestion?.(card.front);
    }
    setStarred(next);
  };

  return (
    <div className="space-y-5">
      {/* Progress */}
      <div className="space-y-1.5">
        <div className="flex justify-between text-xs font-medium text-muted-foreground">
          <span>Card {current + 1} of {cards.length}</span>
          <span>{mastered.size} mastered ({progress}%)</span>
        </div>
        <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-primary to-sage-400"
            animate={{ width: `${progress}%` }}
            transition={{ type: "spring", stiffness: 80 }}
          />
        </div>
      </div>

      {/* Mode toggle */}
      <div className="flex items-center justify-center gap-2">
        <button
          onClick={() => { setTypeMode(false); resetCard(); }}
          className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold transition-all ${
            !typeMode ? "bg-primary text-primary-foreground shadow-sm" : "bg-muted text-muted-foreground hover:bg-muted/80"
          }`}
        >
          <Eye className="h-3.5 w-3.5" /> Flip Mode
        </button>
        <button
          onClick={() => { setTypeMode(true); resetCard(); }}
          className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold transition-all ${
            typeMode ? "bg-primary text-primary-foreground shadow-sm" : "bg-muted text-muted-foreground hover:bg-muted/80"
          }`}
        >
          <Keyboard className="h-3.5 w-3.5" /> Type Answer
        </button>
      </div>

      {/* Card */}
      {!typeMode ? (
        /* ─── Flip Mode ─── */
        <div
          className="cursor-pointer"
          onClick={() => {
            if (!flipped) track("flashcard_flip", { cardIndex: current, totalCards: cards.length });
            setFlipped(!flipped);
          }}
          style={{ perspective: "1000px" }}
        >
          <motion.div
            className="relative w-full min-h-[220px]"
            animate={{ rotateY: flipped ? 180 : 0 }}
            transition={{ duration: 0.5, type: "spring", stiffness: 100 }}
            style={{ transformStyle: "preserve-3d" }}
          >
            <div className="absolute inset-0 flex flex-col items-center justify-center rounded-3xl border-2 border-sage-200 dark:border-sage-200/30 bg-gradient-to-br from-sage-50 to-lavender-50 dark:from-sage-500/10 dark:to-lavender-500/10 p-8 shadow-lg" style={{ backfaceVisibility: "hidden" }}>
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">Question</p>
              <p className="text-lg font-semibold text-foreground text-center leading-relaxed">{card.front}</p>
              <p className="mt-4 text-xs text-muted-foreground">Tap to flip</p>
            </div>
            <div className="absolute inset-0 flex flex-col items-center justify-center rounded-3xl border-2 border-lavender-200 dark:border-lavender-200/30 bg-gradient-to-br from-lavender-50 to-peach-50 dark:from-lavender-500/10 dark:to-peach-500/10 p-8 shadow-lg" style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}>
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">Answer</p>
              <p className="text-lg font-semibold text-foreground text-center leading-relaxed">{card.back}</p>
            </div>
          </motion.div>
        </div>
      ) : (
        /* ─── Type Mode ─── */
        <div className="rounded-3xl border-2 border-sage-200 dark:border-sage-200/30 bg-gradient-to-br from-sage-50 to-lavender-50 dark:from-sage-500/10 dark:to-lavender-500/10 p-8 shadow-lg space-y-4">
          <div className="text-center">
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">Question</p>
            <p className="text-lg font-semibold text-foreground leading-relaxed">{card.front}</p>
          </div>
          {!answerRevealed ? (
            <div className="space-y-3">
              <input
                id={`flashcard-typed-answer-${card.id}`}
                name={`flashcardTypedAnswer${card.id}`}
                type="text"
                value={typedAnswer}
                onChange={(e) => setTypedAnswer(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && typedAnswer.trim() && handleCheckTyped()}
                placeholder="Type your answer..."
                className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
              <button
                onClick={handleCheckTyped}
                disabled={!typedAnswer.trim()}
                className="w-full rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground shadow-sm disabled:opacity-40"
              >
                Check Answer
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className={`rounded-xl border p-4 text-center ${
                answerCorrect ? "border-sage-300 bg-sage-50 dark:bg-sage-500/10 dark:border-sage-300/30" : "border-border bg-muted/30"
              }`}>
                <p className="text-sm font-semibold">{answerCorrect ? "✨ Correct!" : "Not quite"}</p>
                <p className="text-sm text-muted-foreground mt-1">Answer: <span className="font-semibold text-foreground">{card.back}</span></p>
              </div>
              {!answerCorrect && (
                <div className="flex gap-2 justify-center">
                  <button onClick={handleTryAgain} className="flex items-center gap-1.5 rounded-full border border-border px-4 py-2 text-xs font-semibold hover:bg-muted transition-colors">
                    <RotateCcw className="h-3.5 w-3.5" /> Try Again
                  </button>
                  <button onClick={handleStar} className={`flex items-center gap-1.5 rounded-full border px-4 py-2 text-xs font-semibold transition-colors ${
                    starred.has(card.id) ? "border-amber-300 bg-amber-50 text-amber-600 dark:bg-amber-400/10 dark:border-amber-400/30 dark:text-amber-400" : "border-border hover:bg-muted"
                  }`}>
                    <Star className={`h-3.5 w-3.5 ${starred.has(card.id) ? "fill-amber-400" : ""}`} /> Star
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Flip mode action buttons */}
      {!typeMode && (
        <AnimatePresence>
          {flipped && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex justify-center gap-3">
              <button onClick={handleReviewAgain} className="flex items-center gap-2 rounded-full border border-peach-200 dark:border-peach-200/30 bg-gradient-to-r from-peach-50 to-peach-100 dark:from-peach-500/10 dark:to-peach-500/5 px-5 py-2.5 text-sm font-semibold text-foreground shadow-sm transition-all hover:shadow-md">
                <RotateCcw className="h-4 w-4 text-peach-500" /> Review Again
              </button>
              <button onClick={handleStar} className={`flex items-center gap-2 rounded-full border px-5 py-2.5 text-sm font-semibold shadow-sm transition-all hover:shadow-md ${
                starred.has(card.id) ? "border-amber-300 bg-amber-50 text-amber-700 dark:bg-amber-400/10 dark:border-amber-400/30 dark:text-amber-400" : "border-border bg-card"
              }`}>
                <Star className={`h-4 w-4 ${starred.has(card.id) ? "fill-amber-400 text-amber-500" : "text-muted-foreground"}`} /> Star
              </button>
              <button onClick={handleGotIt} className="flex items-center gap-2 rounded-full border border-sage-200 dark:border-sage-200/30 bg-gradient-to-r from-sage-50 to-sage-100 dark:from-sage-500/10 dark:to-sage-500/5 px-5 py-2.5 text-sm font-semibold text-foreground shadow-sm transition-all hover:shadow-md">
                <Check className="h-4 w-4 text-sage-600" /> Got It!
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      )}

      {/* Nav */}
      <div className="flex justify-center gap-2">
        <button onClick={() => { setCurrent(Math.max(0, current - 1)); resetCard(); }} disabled={current === 0} className="rounded-xl border border-border p-2 text-muted-foreground hover:bg-muted disabled:opacity-30 transition-colors">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button onClick={() => { setCurrent(Math.min(cards.length - 1, current + 1)); resetCard(); }} disabled={current === cards.length - 1} className="rounded-xl border border-border p-2 text-muted-foreground hover:bg-muted disabled:opacity-30 transition-colors">
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Starred summary */}
      {starred.size > 0 && (
        <div className="rounded-xl border border-amber-200 dark:border-amber-400/30 bg-amber-50 dark:bg-amber-400/10 p-3">
          <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">⭐ {starred.size} card{starred.size > 1 ? "s" : ""} starred for review</p>
        </div>
      )}
    </div>
  );
}
