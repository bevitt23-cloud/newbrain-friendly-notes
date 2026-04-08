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

      // Guard: skip if data-formula is placeholder text, instruction text, or not a real equation
      const f = formula.trim().toLowerCase();
      if (
        f.length < 3 ||
        /^(raw_formula|the_raw_formula|the_actual_equation|formula|equation|value|expression)/i.test(f) ||
        /^[\d.,\s]+$/.test(f) || // plain numbers like "81" or "3.14"
        !/[=+\-*/^()√∑∫]/.test(f) // no math operators = not a real equation
      ) {
        // Not a real formula — strip the pill styling instead of showing tooltip
        formulaEl.classList.remove("math-formula");
        formulaEl.removeAttribute("data-formula");
        return;
      }

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

  // Inject voice-to-text mic buttons next to Feynman and Recall textareas
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return; // Browser doesn't support speech recognition

    const textareas = container.querySelectorAll(".recall-input, .feynman-input");
    const cleanups: (() => void)[] = [];

    textareas.forEach((textarea) => {
      // Don't add mic button twice
      if (textarea.parentElement?.querySelector(".voice-mic-btn")) return;

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "voice-mic-btn";
      btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/></svg>`;
      btn.title = "Voice input";
      btn.style.cssText = "position:absolute;right:8px;top:8px;padding:6px;border-radius:8px;background:var(--muted);color:var(--muted-foreground);border:none;cursor:pointer;transition:all 0.2s;z-index:5;";

      // Make the textarea container relative for positioning
      const parent = textarea.parentElement;
      if (parent) parent.style.position = "relative";

      let recognition: any = null;

      btn.addEventListener("click", () => {
        if (recognition) {
          recognition.stop();
          recognition = null;
          btn.style.background = "var(--muted)";
          btn.style.color = "var(--muted-foreground)";
          return;
        }

        recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = false;
        recognition.lang = "en-US";

        recognition.onresult = (event: any) => {
          let transcript = "";
          for (let i = event.resultIndex; i < event.results.length; i++) {
            if (event.results[i].isFinal) transcript += event.results[i][0].transcript;
          }
          if (transcript.trim()) {
            const ta = textarea as HTMLTextAreaElement;
            ta.value = ta.value ? ta.value + " " + transcript.trim() : transcript.trim();
            // Trigger input event so any listeners detect the change
            ta.dispatchEvent(new Event("input", { bubbles: true }));
          }
        };

        recognition.onend = () => {
          recognition = null;
          btn.style.background = "var(--muted)";
          btn.style.color = "var(--muted-foreground)";
        };

        recognition.onerror = () => {
          recognition = null;
          btn.style.background = "var(--muted)";
          btn.style.color = "var(--muted-foreground)";
        };

        recognition.start();
        btn.style.background = "#ef4444";
        btn.style.color = "white";
      });

      textarea.parentElement?.insertBefore(btn, textarea.nextSibling);

      cleanups.push(() => {
        if (recognition) { try { recognition.stop(); } catch {} }
        btn.remove();
      });
    });

    return () => cleanups.forEach((fn) => fn());
  }, [containerRef, html]);

  // Proactively strip invalid math-formula pills on render so they never appear visually
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const pills = container.querySelectorAll(".math-formula");
    for (const el of pills) {
      const formula = (el.getAttribute("data-formula") || el.textContent || "").trim();
      const f = formula.toLowerCase();
      const isInvalid =
        !formula ||
        formula.length < 3 ||
        /^(raw_formula|the_raw_formula|the_actual_equation|formula|equation|value|expression|number|placeholder)/i.test(f) ||
        /^[\d.,\s%$#]+$/.test(f) ||
        !/[=+\-*/^()√∑∫≤≥≠≈]/.test(f);

      if (isInvalid) {
        el.classList.remove("math-formula");
        el.removeAttribute("data-formula");
      }
    }
  }, [containerRef, html]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    container.addEventListener("click", handleClick);
    return () => container.removeEventListener("click", handleClick);
  }, [containerRef, handleClick, html]);
}
