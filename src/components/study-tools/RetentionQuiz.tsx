import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, XCircle, ChevronRight, RotateCcw, Trophy } from "lucide-react";
import FunFactLink from "@/components/study-tools/FunFactLink";
import { useTelemetry } from "@/hooks/useTelemetry";
import { useToolEngagement } from "@/hooks/useToolEngagement";

interface QuizQuestion {
  question: string;
  options: string[];
  correct: number;
  explanation: string;
}

interface RetentionQuizProps {
  questions: QuizQuestion[];
  topic?: string;
  notesContext?: string;
}

const RetentionQuiz = ({ questions, topic, notesContext }: RetentionQuizProps) => {
  const { track } = useTelemetry();
  const { markComplete } = useToolEngagement("quiz");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [answered, setAnswered] = useState(false);
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);

  const current = questions[currentIndex];
  const isCorrect = selectedAnswer === current?.correct;
  const total = questions.length;

  const handleSelect = (idx: number) => {
    if (answered) return;
    setSelectedAnswer(idx);
    setAnswered(true);
    const correct = idx === current.correct;
    if (correct) setScore((s) => s + 1);
    track("quiz_answer", { questionIndex: currentIndex, correct, topic });
  };

  const handleNext = () => {
    if (currentIndex + 1 >= total) {
      setFinished(true);
      track("quiz_complete", { score, total, topic, percent: Math.round((score / total) * 100) });
      markComplete();
    } else {
      setCurrentIndex((i) => i + 1);
      setSelectedAnswer(null);
      setAnswered(false);
    }
  };

  const handleRestart = () => {
    setCurrentIndex(0);
    setSelectedAnswer(null);
    setAnswered(false);
    setScore(0);
    setFinished(false);
  };

  if (!questions || questions.length === 0) return null;

  if (finished) {
    const percent = Math.round((score / total) * 100);
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="mt-8 rounded-2xl border border-border bg-card p-6 md:p-8 shadow-sm"
      >
        <div className="text-center space-y-4">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-sage-100 to-sage-200 dark:from-sage-500/20 dark:to-sage-400/10">
            <Trophy className="h-8 w-8 text-sage-600 dark:text-sage-400" />
          </div>
          <h3 className="text-lg font-bold text-foreground">Quiz Complete!</h3>
          <p className="text-2xl font-extrabold text-primary">
            {score}/{total} <span className="text-sm font-medium text-muted-foreground">({percent}%)</span>
          </p>
          <p className="text-sm text-muted-foreground">
            {percent >= 80
              ? "Excellent retention! You've got a strong grasp on this material. 🎉"
              : percent >= 50
              ? "Good effort! Review the sections you missed to strengthen your understanding."
              : "Keep going! Re-read the notes and try again — repetition is how we learn."}
          </p>
          <button
            onClick={handleRestart}
            className="inline-flex items-center gap-2 rounded-xl bg-primary/10 px-5 py-2.5 text-sm font-semibold text-primary hover:bg-primary/20 transition-colors"
          >
            <RotateCcw className="h-4 w-4" />
            Try Again
          </button>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="mt-8 rounded-2xl border border-border bg-card shadow-sm overflow-hidden"
    >
      <div className="h-1 bg-gradient-to-r from-sky-400 via-sage-400 to-lavender-400" />
      <div className="p-5 md:p-7">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-base font-bold text-foreground flex items-center gap-2">
            <span className="text-lg">🧩</span> Retention Quiz
          </h3>
          <span className="text-xs font-semibold text-muted-foreground tabular-nums">
            {currentIndex + 1} / {total}
          </span>
        </div>

        {/* Progress bar */}
        <div className="mb-5 h-1.5 rounded-full bg-muted overflow-hidden">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-sage-500 to-sky-400"
            initial={{ width: 0 }}
            animate={{ width: `${((currentIndex + (answered ? 1 : 0)) / total) * 100}%` }}
            transition={{ duration: 0.4, ease: "easeOut" }}
          />
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={currentIndex}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.25 }}
          >
            {/* Question */}
            <p className="text-sm font-semibold text-foreground mb-4 leading-relaxed">
              {current.question}
            </p>

            {/* Options */}
            <div className="space-y-2.5">
              {current.options.map((option, idx) => {
                const isThis = selectedAnswer === idx;
                const isRight = idx === current.correct;
                let borderColor = "border-border hover:border-primary/40";
                let bgColor = "bg-background";

                if (answered) {
                  if (isRight) {
                    borderColor = "border-sage-400 dark:border-sage-500";
                    bgColor = "bg-sage-50 dark:bg-sage-500/10";
                  } else if (isThis && !isCorrect) {
                    borderColor = "border-red-300 dark:border-red-400/50";
                    bgColor = "bg-red-50 dark:bg-red-500/10";
                  } else {
                    borderColor = "border-border opacity-50";
                  }
                } else if (isThis) {
                  borderColor = "border-primary/50 ring-2 ring-primary/20";
                  bgColor = "bg-primary/5";
                }

                return (
                  <button
                    key={idx}
                    onClick={() => handleSelect(idx)}
                    disabled={answered}
                    className={`w-full rounded-xl border ${borderColor} ${bgColor} px-4 py-3 text-left text-sm transition-all duration-200 ${
                      !answered ? "cursor-pointer active:scale-[0.98]" : "cursor-default"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-current/20 text-[10px] font-bold text-muted-foreground">
                        {String.fromCharCode(65 + idx)}
                      </span>
                      <span className="flex-1">{option}</span>
                      {answered && isRight && (
                        <CheckCircle2 className="h-4.5 w-4.5 shrink-0 text-sage-600 dark:text-sage-400 mt-0.5" />
                      )}
                      {answered && isThis && !isCorrect && (
                        <XCircle className="h-4.5 w-4.5 shrink-0 text-red-500 dark:text-red-400 mt-0.5" />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Feedback */}
            <AnimatePresence>
              {answered && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div
                    className={`mt-4 rounded-xl px-4 py-3 text-sm leading-relaxed ${
                      isCorrect
                        ? "bg-sage-50 dark:bg-sage-500/10 text-sage-800 dark:text-sage-200 border border-sage-200 dark:border-sage-500/20"
                        : "bg-amber-50 dark:bg-amber-500/10 text-amber-800 dark:text-amber-200 border border-amber-200 dark:border-amber-500/20"
                    }`}
                  >
                    <p className="font-semibold mb-1">
                      {isCorrect ? "✅ Correct!" : "💡 Not quite — here's why:"}
                    </p>
                    <p>{current.explanation}</p>
                    {isCorrect && (
                      <div className="mt-2">
                        <FunFactLink topic={topic} context={notesContext} />
                      </div>
                    )}
                  </div>

                  <button
                    onClick={handleNext}
                    className="mt-4 flex items-center gap-2 rounded-xl bg-gradient-to-r from-sage-600 to-sage-500 px-5 py-2.5 text-sm font-semibold text-white shadow-md transition-all hover:shadow-lg active:scale-[0.97]"
                  >
                    {currentIndex + 1 >= total ? "See Results" : "Next"}
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </AnimatePresence>
      </div>
    </motion.div>
  );
};

export default RetentionQuiz;
