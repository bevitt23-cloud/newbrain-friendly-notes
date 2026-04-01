import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Clock, ChevronRight, ChevronLeft, Check, RotateCcw, Star,
  Flag, Send, Loader2, AlertTriangle,
} from "lucide-react";

interface MCQuestion {
  type: "mc";
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}
interface TFQuestion {
  type: "tf";
  question: string;
  correctAnswer: boolean;
  explanation: string;
}
interface FIBQuestion {
  type: "fib";
  question: string;
  answer: string;
  explanation: string;
}
interface EssayQuestion {
  type: "essay";
  question: string;
  rubric: string;
  samplePoints: string[];
}

type ExamQuestion = MCQuestion | TFQuestion | FIBQuestion | EssayQuestion;

interface ExamData {
  questions: ExamQuestion[];
}

interface FinalExamProps {
  data: string;
  timerMinutes?: number;
  onStarQuestion?: (q: string) => void;
}

export default function FinalExam({ data, timerMinutes, onStarQuestion }: FinalExamProps) {
  const [questions, setQuestions] = useState<ExamQuestion[]>([]);
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState<Record<number, any>>({});
  const [revealed, setRevealed] = useState<Set<number>>(new Set());
  const [starred, setStarred] = useState<Set<number>>(new Set());
  const [submitted, setSubmitted] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number | null>(timerMinutes ? timerMinutes * 60 : null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    try {
      const cleaned = data.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
      const parsed = JSON.parse(cleaned);
      setQuestions(parsed.questions || parsed);
    } catch { setQuestions([]); }
  }, [data]);

  // Timer
  useEffect(() => {
    if (timeLeft === null || submitted) return;
    timerRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t !== null && t <= 1) {
          setSubmitted(true);
          return 0;
        }
        return t !== null ? t - 1 : null;
      });
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [timeLeft !== null, submitted]);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  if (!questions.length) return <p className="text-sm text-muted-foreground">No exam data generated.</p>;

  const q = questions[current];
  const isRevealed = revealed.has(current) || submitted;

  const setAnswer = (val: any) => {
    if (submitted) return;
    setAnswers((p) => ({ ...p, [current]: val }));
  };

  const handleReveal = () => setRevealed((p) => new Set(p).add(current));

  const handleTryAgain = () => {
    setAnswers((p) => { const n = { ...p }; delete n[current]; return n; });
    setRevealed((p) => { const n = new Set(p); n.delete(current); return n; });
  };

  const handleStar = () => {
    const next = new Set(starred);
    if (next.has(current)) next.delete(current);
    else {
      next.add(current);
      onStarQuestion?.(q.question);
    }
    setStarred(next);
  };

  const handleSubmitExam = () => setSubmitted(true);

  const isCorrect = (idx: number): boolean | null => {
    const qq = questions[idx];
    const ans = answers[idx];
    if (ans === undefined) return null;
    if (qq.type === "mc") return ans === qq.correctIndex;
    if (qq.type === "tf") return ans === qq.correctAnswer;
    if (qq.type === "fib") return ans?.toLowerCase().trim() === qq.answer.toLowerCase().trim();
    return null; // essay - manual
  };

  const score = submitted
    ? questions.reduce((acc, _, i) => acc + (isCorrect(i) === true ? 1 : 0), 0)
    : 0;
  const gradable = questions.filter((q) => q.type !== "essay").length;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Question {current + 1} of {questions.length}
          </span>
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
            q.type === "mc" ? "bg-lavender-100 text-lavender-600" :
            q.type === "tf" ? "bg-sage-100 text-sage-600" :
            q.type === "fib" ? "bg-peach-100 text-peach-600" :
            "bg-sky-100 text-sky-600"
          }`}>
            {q.type === "mc" ? "Multiple Choice" : q.type === "tf" ? "True / False" : q.type === "fib" ? "Fill in Blank" : "Essay"}
          </span>
        </div>
        {timeLeft !== null && !submitted && (
          <div className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold ${
            timeLeft < 60 ? "border-destructive/30 bg-destructive/10 text-destructive" : "border-border bg-muted text-foreground"
          }`}>
            <Clock className="h-3.5 w-3.5" />
            {formatTime(timeLeft)}
          </div>
        )}
      </div>

      {/* Progress */}
      <div className="flex gap-1">
        {questions.map((_, i) => (
          <button
            key={i}
            onClick={() => setCurrent(i)}
            className={`h-2 flex-1 rounded-full transition-colors ${
              i === current ? "bg-primary" :
              submitted && isCorrect(i) === true ? "bg-sage-400" :
              submitted && isCorrect(i) === false ? "bg-peach-400" :
              answers[i] !== undefined ? "bg-lavender-300" :
              "bg-muted"
            }`}
          />
        ))}
      </div>

      {/* Question */}
      <AnimatePresence mode="wait">
        <motion.div key={current} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
          <p className="text-base font-bold text-foreground leading-relaxed mb-4">{q.question}</p>

          {/* MC */}
          {q.type === "mc" && (
            <div className="space-y-2.5">
              {q.options.map((opt, oi) => {
                let style = "border-border bg-card hover:bg-accent/50";
                if (isRevealed) {
                  if (oi === q.correctIndex) style = "border-sage-300 bg-sage-50 ring-1 ring-sage-200";
                  else if (oi === answers[current] && oi !== q.correctIndex) style = "border-peach-300 bg-peach-50/50 opacity-60";
                  else style = "border-border bg-card opacity-40";
                } else if (answers[current] === oi) {
                  style = "border-lavender-300 bg-lavender-50 ring-1 ring-lavender-200";
                }
                return (
                  <button
                    key={oi}
                    onClick={() => setAnswer(oi)}
                    disabled={isRevealed}
                    className={`w-full text-left rounded-2xl border-2 px-4 py-3 text-sm font-medium transition-all ${style}`}
                  >
                    <span className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-muted text-xs font-bold">
                      {String.fromCharCode(65 + oi)}
                    </span>
                    {opt}
                  </button>
                );
              })}
            </div>
          )}

          {/* T/F */}
          {q.type === "tf" && (
            <div className="flex gap-3">
              {[true, false].map((val) => {
                let style = "border-border bg-card hover:bg-accent/50";
                if (isRevealed) {
                  if (val === q.correctAnswer) style = "border-sage-300 bg-sage-50 ring-1 ring-sage-200";
                  else if (val === answers[current] && val !== q.correctAnswer) style = "border-peach-300 bg-peach-50/50 opacity-60";
                  else style = "border-border bg-card opacity-40";
                } else if (answers[current] === val) {
                  style = "border-lavender-300 bg-lavender-50 ring-1 ring-lavender-200";
                }
                return (
                  <button
                    key={String(val)}
                    onClick={() => setAnswer(val)}
                    disabled={isRevealed}
                    className={`flex-1 rounded-2xl border-2 px-6 py-4 text-sm font-bold transition-all ${style}`}
                  >
                    {val ? "✓ True" : "✗ False"}
                  </button>
                );
              })}
            </div>
          )}

          {/* FIB */}
          {q.type === "fib" && (
            <div className="space-y-3">
              <input
                id={`final-exam-fib-${current}`}
                name={`finalExamFib${current}`}
                type="text"
                value={answers[current] || ""}
                onChange={(e) => setAnswer(e.target.value)}
                disabled={isRevealed}
                placeholder="Type your answer..."
                className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-60"
              />
              {isRevealed && (
                <div className={`rounded-xl border p-3 text-sm ${
                  isCorrect(current) ? "border-sage-300 bg-sage-50" : "border-peach-200 bg-peach-50/50"
                }`}>
                  <p className="font-semibold">{isCorrect(current) ? "✨ Correct!" : "Not quite"}</p>
                  <p className="text-muted-foreground mt-1">Answer: <strong className="text-foreground">{q.answer}</strong></p>
                </div>
              )}
            </div>
          )}

          {/* Essay */}
          {q.type === "essay" && (
            <div className="space-y-3">
              <textarea
                id={`final-exam-essay-${current}`}
                name={`finalExamEssay${current}`}
                value={answers[current] || ""}
                onChange={(e) => setAnswer(e.target.value)}
                disabled={submitted}
                placeholder="Write your 5-paragraph essay here..."
                rows={12}
                className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-60 resize-y"
              />
              {submitted && (
                <div className="rounded-xl border border-lavender-200 bg-lavender-50 p-4 space-y-2">
                  <p className="text-xs font-bold uppercase tracking-wider text-lavender-500">Rubric / Key Points</p>
                  <p className="text-sm text-muted-foreground">{q.rubric}</p>
                  <ul className="list-disc pl-4 text-sm text-foreground space-y-1">
                    {q.samplePoints?.map((pt, i) => <li key={i}>{pt}</li>)}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Feedback for non-essay when revealed */}
          {isRevealed && q.type !== "essay" && q.type !== "fib" && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="mt-4">
              <div className={`rounded-2xl border p-4 text-sm ${
                isCorrect(current) ? "border-sage-200 bg-sage-50" : "border-lavender-200 bg-lavender-50"
              }`}>
                <p className="font-semibold">{isCorrect(current) ? "✨ Correct!" : "Not quite"}</p>
                <p className="mt-1 text-muted-foreground">{(q as MCQuestion | TFQuestion).explanation}</p>
              </div>
            </motion.div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Actions */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex gap-2">
          {!submitted && answers[current] !== undefined && !isRevealed && q.type !== "essay" && (
            <button onClick={handleReveal} className="flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-sm">
              <Check className="h-3.5 w-3.5" /> Check
            </button>
          )}
          {isRevealed && !submitted && isCorrect(current) === false && (
            <>
              <button onClick={handleTryAgain} className="flex items-center gap-1.5 rounded-full border border-border px-4 py-2 text-xs font-semibold hover:bg-muted transition-colors">
                <RotateCcw className="h-3.5 w-3.5" /> Try Again
              </button>
              <button onClick={handleStar} className={`flex items-center gap-1.5 rounded-full border px-4 py-2 text-xs font-semibold transition-colors ${
                starred.has(current) ? "border-amber-300 bg-amber-50 text-amber-600" : "border-border hover:bg-muted"
              }`}>
                <Star className={`h-3.5 w-3.5 ${starred.has(current) ? "fill-amber-400" : ""}`} /> Star
              </button>
            </>
          )}
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setCurrent(Math.max(0, current - 1))}
            disabled={current === 0}
            className="rounded-xl border border-border p-2 text-muted-foreground hover:bg-muted disabled:opacity-30 transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          {current < questions.length - 1 ? (
            <button
              onClick={() => setCurrent(current + 1)}
              className="flex items-center gap-1 rounded-xl bg-primary/10 px-4 py-2 text-xs font-semibold text-primary hover:bg-primary/20 transition-colors"
            >
              Next <ChevronRight className="h-4 w-4" />
            </button>
          ) : !submitted ? (
            <button
              onClick={handleSubmitExam}
              className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-sage-600 to-sage-500 px-5 py-2 text-xs font-semibold text-white shadow-md hover:shadow-lg transition-all"
            >
              <Flag className="h-3.5 w-3.5" /> Submit Exam
            </button>
          ) : null}
        </div>
      </div>

      {/* Score summary */}
      {submitted && (
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="rounded-2xl border border-sage-200 bg-gradient-to-r from-sage-50 to-lavender-50 p-6 text-center space-y-2">
          <p className="text-xl font-bold text-foreground">🏆 Exam Complete!</p>
          <p className="text-sm text-muted-foreground">
            Score: <strong className="text-foreground">{score}/{gradable}</strong>
            {questions.some((q) => q.type === "essay") && " (essays require self-review)"}
          </p>
          <div className="h-3 w-48 mx-auto rounded-full bg-muted overflow-hidden">
            <div className="h-full rounded-full bg-gradient-to-r from-sage-400 to-primary" style={{ width: `${gradable ? (score / gradable) * 100 : 0}%` }} />
          </div>
          {starred.size > 0 && (
            <p className="text-xs text-amber-600">⭐ {starred.size} question{starred.size > 1 ? "s" : ""} starred for review</p>
          )}
        </motion.div>
      )}
    </div>
  );
}
