import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Highlighter, Music, Timer, Volume2, Mic, ArrowRight } from "lucide-react";

/**
 * First-time tutorial overlay that appears when a user generates
 * their first set of notes. Walks them through key features.
 */

const STORAGE_KEY = "bfn:tutorial_shown";

interface TutorialStep {
  icon: React.ElementType;
  title: string;
  description: string;
  color: string;
}

const STEPS: TutorialStep[] = [
  {
    icon: Highlighter,
    title: "Highlight to Interact",
    description: "Select any text in your notes to open the action menu. You can ask the AI to explain a concept deeper, simplify it, find a video explainer, create a sticky note, or hear the pronunciation.",
    color: "text-sage-500",
  },
  {
    icon: Volume2,
    title: "Read Aloud",
    description: "Click the speaker icon in the study bar to have your notes read to you. Adjust speed and pause anytime. Great for auditory learners or when your eyes need a break.",
    color: "text-lavender-500",
  },
  {
    icon: Music,
    title: "Focus Music & Binaural Beats",
    description: "The music player in the study bar offers lo-fi beats, gamma binaural tones (40Hz for focus), and isochronic pulses. Mix and match to find what helps your brain lock in.",
    color: "text-peach-500",
  },
  {
    icon: Timer,
    title: "Pomodoro Timer",
    description: "Built-in focus timer with work/break cycles (25/5, 50/10, or custom). A chime sounds when it's break time. The timer helps prevent cognitive burnout during long study sessions.",
    color: "text-sky-500",
  },
  {
    icon: Mic,
    title: "Voice-to-Text",
    description: "Look for the microphone icon on Socratic Debate, Feynman Check, and Recall Prompt text areas. Tap it to speak your answer instead of typing — your voice is transcribed in real-time.",
    color: "text-amber-500",
  },
];

export function useFirstTimeTutorial() {
  const [showTutorial, setShowTutorial] = useState(false);

  const triggerIfFirstTime = useCallback(() => {
    if (typeof window === "undefined") return;
    const shown = localStorage.getItem(STORAGE_KEY);
    if (!shown) {
      setShowTutorial(true);
    }
  }, []);

  const dismiss = useCallback(() => {
    setShowTutorial(false);
    localStorage.setItem(STORAGE_KEY, "true");
  }, []);

  return { showTutorial, triggerIfFirstTime, dismiss };
}

interface FirstTimeTutorialProps {
  show: boolean;
  onDismiss: () => void;
}

export default function FirstTimeTutorial({ show, onDismiss }: FirstTimeTutorialProps) {
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    if (show) setCurrentStep(0);
  }, [show]);

  if (!show) return null;

  const step = STEPS[currentStep];
  const isLast = currentStep === STEPS.length - 1;
  const Icon = step.icon;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
        onClick={onDismiss}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl"
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-muted-foreground">
                {currentStep + 1} of {STEPS.length}
              </span>
              {/* Progress dots */}
              <div className="flex gap-1">
                {STEPS.map((_, i) => (
                  <div
                    key={i}
                    className={`h-1.5 rounded-full transition-all ${
                      i === currentStep ? "w-4 bg-primary" : i < currentStep ? "w-1.5 bg-primary/40" : "w-1.5 bg-muted"
                    }`}
                  />
                ))}
              </div>
            </div>
            <button
              onClick={onDismiss}
              className="rounded-lg p-1 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Content */}
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              <div className={`mx-auto mb-4 h-14 w-14 rounded-2xl bg-muted/50 flex items-center justify-center`}>
                <Icon className={`h-7 w-7 ${step.color}`} />
              </div>
              <h3 className="text-lg font-bold text-foreground text-center mb-2">{step.title}</h3>
              <p className="text-sm text-muted-foreground text-center leading-relaxed">{step.description}</p>
            </motion.div>
          </AnimatePresence>

          {/* Navigation */}
          <div className="flex items-center justify-between mt-6">
            <button
              onClick={() => setCurrentStep((s) => Math.max(0, s - 1))}
              disabled={currentStep === 0}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors disabled:opacity-30"
            >
              Back
            </button>
            <button
              onClick={() => {
                if (isLast) {
                  onDismiss();
                } else {
                  setCurrentStep((s) => s + 1);
                }
              }}
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-sage-500 to-lavender-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg hover:shadow-xl transition-all"
            >
              {isLast ? "Start Studying" : "Next"}
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>

          {/* Don't show again */}
          <button
            onClick={onDismiss}
            className="mt-3 w-full text-center text-xs text-muted-foreground/60 hover:text-muted-foreground transition-colors"
          >
            Don't show this again
          </button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
