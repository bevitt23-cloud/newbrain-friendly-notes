import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, ChevronUp, RotateCcw } from "lucide-react";

interface MathStep {
  step: number;
  equation: string;
  explanation: string;
}

interface CascadingMathStepperProps {
  steps: MathStep[];
}

/**
 * Cascading Math Stepper — reveals step-by-step math solutions one at a time.
 *
 * - Only shows steps up to `currentStep`
 * - Active step has full opacity + accent border
 * - Previous steps dim to 60% opacity as visual history
 * - "Show Next Step" button advances the reveal
 */
const CascadingMathStepper = ({ steps }: CascadingMathStepperProps) => {
  const [currentStep, setCurrentStep] = useState(1);

  const showNext = useCallback(() => {
    setCurrentStep((prev) => Math.min(prev + 1, steps.length));
  }, [steps.length]);

  const showPrev = useCallback(() => {
    setCurrentStep((prev) => Math.max(prev - 1, 1));
  }, []);

  const reset = useCallback(() => {
    setCurrentStep(1);
  }, []);

  const isComplete = currentStep >= steps.length;
  const visibleSteps = steps.slice(0, currentStep);

  return (
    <div className="math-stepper-component my-5">
      {/* Progress indicator */}
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">
          Step {currentStep} of {steps.length}
        </span>
        <div className="flex h-1.5 flex-1 mx-3 overflow-hidden rounded-full bg-muted/50">
          <motion.div
            className="h-full rounded-full bg-primary/60"
            initial={false}
            animate={{ width: `${(currentStep / steps.length) * 100}%` }}
            transition={{ duration: 0.3, ease: "easeOut" }}
          />
        </div>
        {currentStep > 1 && (
          <button
            onClick={reset}
            className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
            title="Reset to step 1"
          >
            <RotateCcw className="h-3 w-3" />
            Reset
          </button>
        )}
      </div>

      {/* Steps */}
      <div className="space-y-2.5">
        <AnimatePresence initial={false}>
          {visibleSteps.map((step, i) => {
            const isActive = i === currentStep - 1;

            return (
              <motion.div
                key={step.step}
                initial={{ opacity: 0, y: 12, scale: 0.97 }}
                animate={{
                  opacity: isActive ? 1 : 0.6,
                  y: 0,
                  scale: 1,
                }}
                transition={{ duration: 0.3, ease: "easeOut" }}
                className={`math-step-card rounded-xl border p-4 transition-all duration-300 ${
                  isActive
                    ? "border-primary/40 bg-card shadow-md ring-1 ring-primary/10"
                    : "border-border/30 bg-muted/20"
                }`}
              >
                {/* Step number badge */}
                <div className="mb-2 flex items-center gap-2">
                  <span
                    className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold ${
                      isActive
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {step.step}
                  </span>
                  {isActive && (
                    <motion.span
                      initial={{ opacity: 0, x: -4 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="text-[11px] font-medium uppercase tracking-wider text-primary"
                    >
                      Current Step
                    </motion.span>
                  )}
                </div>

                {/* Equation */}
                <div
                  className={`font-mono text-base font-semibold mb-2 ${
                    isActive ? "text-foreground" : "text-muted-foreground"
                  }`}
                  dangerouslySetInnerHTML={{ __html: step.equation }}
                />

                {/* Plain English explanation */}
                <p
                  className={`text-sm leading-relaxed ${
                    isActive ? "text-muted-foreground" : "text-muted-foreground/60"
                  }`}
                >
                  {step.explanation}
                </p>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Navigation buttons */}
      <div className="mt-3 flex items-center gap-2">
        {currentStep > 1 && (
          <button
            onClick={showPrev}
            className="flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2 text-xs font-medium text-muted-foreground transition-all hover:bg-muted hover:text-foreground"
          >
            <ChevronUp className="h-3.5 w-3.5" />
            Previous
          </button>
        )}

        {!isComplete ? (
          <button
            onClick={showNext}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-primary/10 border border-primary/20 px-4 py-2.5 text-sm font-semibold text-primary transition-all hover:bg-primary/20 hover:border-primary/30"
          >
            Show Next Step
            <ChevronDown className="h-4 w-4" />
          </button>
        ) : (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-sage-100 dark:bg-sage-500/15 border border-sage-300 dark:border-sage-500/30 px-4 py-2.5 text-sm font-medium text-sage-700 dark:text-sage-200"
          >
            All {steps.length} steps revealed
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default CascadingMathStepper;
