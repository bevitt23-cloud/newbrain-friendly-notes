import { useEffect, useCallback } from "react";
import { sanitizeHtml } from "@/lib/sanitize";
import { supabase } from "@/integrations/supabase/client";

async function getAIFeedback(prompt: string): Promise<string> {
  const { data, error } = await supabase.functions.invoke("explain-text", {
    body: { text: prompt, mode: "feedback" },
  });
  if (error) throw error;
  return data.explanation || data.result || "Unable to process feedback.";
}

export function useNotesInteractivity(containerRef: React.RefObject<HTMLDivElement | null>, html: string) {
  const handleClick = useCallback(async (e: MouseEvent) => {
    const target = e.target as HTMLElement;

    // Math formula tooltip — translate to plain English on click
    const formulaEl = target.closest(".math-formula") as HTMLElement;
    if (formulaEl && !formulaEl.classList.contains("formula-loading")) {
      e.preventDefault();
      const formula = formulaEl.getAttribute("data-formula") || formulaEl.textContent || "";
      if (!formula.trim()) return;

      // If tooltip already exists, toggle it off
      const existingTooltip = formulaEl.querySelector(".formula-tooltip");
      if (existingTooltip) {
        existingTooltip.remove();
        return;
      }

      // Show loading state
      formulaEl.classList.add("formula-loading");
      const tooltip = document.createElement("div");
      tooltip.className = "formula-tooltip";
      tooltip.textContent = "Translating…";
      formulaEl.appendChild(tooltip);

      try {
        const result = await getAIFeedback(
          `You are a plain-English math translator for students with dyscalculia. Translate this formula into a single conversational sentence that explains what it physically means in the real world. No jargon, no symbols — just what happens.

Formula: ${formula}

Respond with ONLY the plain-English sentence. No preamble, no "This formula means…" — just the explanation.`
        );
        tooltip.innerHTML = sanitizeHtml(result);
      } catch {
        tooltip.textContent = "Could not translate formula.";
      }
      formulaEl.classList.remove("formula-loading");
      return;
    }

    // Recall submit
    if (target.classList.contains("recall-submit")) {
      const wrapper = target.closest(".recall-prompt") as HTMLElement;
      if (!wrapper) return;
      const textarea = wrapper.querySelector(".recall-input") as HTMLTextAreaElement;
      const keyDiv = wrapper.querySelector(".recall-key") as HTMLElement;
      if (!textarea?.value.trim()) return;

      target.textContent = "Checking...";
      target.setAttribute("disabled", "true");

      try {
        const keyPoints = keyDiv?.textContent || "";
        const feedback = await getAIFeedback(
          `The student was asked a recall question about a study section. The key points they should cover are: "${keyPoints}"\n\nThe student answered: "${textarea.value}"\n\nGive brief, encouraging feedback. List what they got right and what they missed. For missed points, prefix with ⭐ so they can star it for review. Keep it under 100 words. Use HTML formatting.`
        );
        let feedbackDiv = wrapper.querySelector(".recall-feedback") as HTMLElement;
        if (!feedbackDiv) {
          feedbackDiv = document.createElement("div");
          feedbackDiv.className = "recall-feedback";
          wrapper.appendChild(feedbackDiv);
        }
        feedbackDiv.innerHTML = sanitizeHtml(feedback);
        target.textContent = "Check Again";
      } catch {
        target.textContent = "Check";
      }
      target.removeAttribute("disabled");
    }

    // Feynman submit
    if (target.classList.contains("feynman-submit")) {
      const wrapper = target.closest(".feynman-check") as HTMLElement;
      if (!wrapper) return;
      const textarea = wrapper.querySelector(".feynman-input") as HTMLTextAreaElement;
      const keyDiv = wrapper.querySelector(".feynman-key") as HTMLElement;
      if (!textarea?.value.trim()) return;

      target.textContent = "Analyzing...";
      target.setAttribute("disabled", "true");

      try {
        const points = Array.from(keyDiv?.querySelectorAll(".feynman-point") || []).map(
          (el) => `${(el as HTMLElement).dataset.concept}: ${el.textContent}`
        );
        const feedback = await getAIFeedback(
          `You are an encouraging tutor. The user is attempting the Feynman Technique.\n\nHIDDEN RUBRIC: [${points.join(", ")}]\n\nUSER'S EXPLANATION: ${textarea.value}\n\n1. Evaluate if the user's explanation successfully covers the hidden rubric.\n2. If they succeeded, validate them enthusiastically and highlight a specific analogy they used well.\n3. If they missed concepts, use a Socratic question to guide them to the missing piece. Do not just give them the answer.\n4. Tone must be conversational, low-pressure, and maximum 3 sentences.`
        );
        let feedbackDiv = wrapper.querySelector(".feynman-feedback") as HTMLElement;
        if (!feedbackDiv) {
          feedbackDiv = document.createElement("div");
          feedbackDiv.className = "feynman-feedback";
          wrapper.appendChild(feedbackDiv);
        }
        feedbackDiv.innerHTML = sanitizeHtml(feedback);
        target.textContent = "Try Again";
      } catch {
        target.textContent = "Check My Understanding";
      }
      target.removeAttribute("disabled");
    }
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    container.addEventListener("click", handleClick);
    return () => container.removeEventListener("click", handleClick);
  }, [containerRef, handleClick, html]);
}
