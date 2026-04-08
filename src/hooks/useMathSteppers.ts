import { useEffect, useRef } from "react";
import { createRoot, type Root } from "react-dom/client";
import { createElement } from "react";
import CascadingMathStepper from "@/components/study-tools/CascadingMathStepper";

interface ParsedStep {
  step: number;
  equation: string;
  explanation: string;
}

/**
 * Finds all .math-stepper containers in the notes DOM, parses their
 * child .math-step elements, and mounts CascadingMathStepper React
 * components into them for interactive step-by-step reveal.
 */
export function useMathSteppers(
  containerRef: React.RefObject<HTMLDivElement | null>,
  html: string,
  isGenerating: boolean,
) {
  const rootsRef = useRef<Root[]>([]);

  useEffect(() => {
    // Cleanup previous mounts
    for (const root of rootsRef.current) {
      root.unmount();
    }
    rootsRef.current = [];

    const container = containerRef.current;
    if (!container || isGenerating) return;

    // Delay mount slightly to ensure dangerouslySetInnerHTML has flushed to DOM
    const timer = setTimeout(() => {
      if (!containerRef.current) return;

    const stepperEls = container.querySelectorAll(".math-stepper");
    if (stepperEls.length === 0) return;

    for (const stepperEl of stepperEls) {
      const stepEls = stepperEl.querySelectorAll(".math-step");
      if (stepEls.length === 0) continue;

      const steps: ParsedStep[] = [];
      for (const stepEl of stepEls) {
        const stepNum = parseInt(
          (stepEl as HTMLElement).getAttribute("data-step") || "0",
          10,
        );
        const equation =
          stepEl.querySelector(".math-step-equation")?.innerHTML || "";
        const explanation =
          stepEl.querySelector(".math-step-explain")?.textContent || "";

        steps.push({
          step: stepNum || steps.length + 1,
          equation,
          explanation,
        });
      }

      if (steps.length === 0) continue;

      // Replace the static HTML with the interactive React component
      const mountPoint = document.createElement("div");
      stepperEl.replaceWith(mountPoint);

      const root = createRoot(mountPoint);
      root.render(createElement(CascadingMathStepper, { steps }));
      rootsRef.current.push(root);
    }
    }, 100); // Small delay to ensure DOM is ready after innerHTML update

    return () => {
      clearTimeout(timer);
      for (const root of rootsRef.current) {
        root.unmount();
      }
      rootsRef.current = [];
    };
  }, [containerRef, html, isGenerating]);
}
