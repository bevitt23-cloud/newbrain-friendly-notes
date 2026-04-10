import { useEffect, useState, type RefObject } from "react";

export interface JargonTooltipState {
  term: string;
  definition: string;
  x: number;
  y: number;
}

/**
 * Controlled tooltip hook for jargon definitions.
 * Wires mouseover/focus/touch listeners to <span class="jargon" data-definition="..."> elements
 * inside the given container and returns the active tooltip state.
 */
export function useJargonTooltip(
  containerRef: RefObject<HTMLElement>,
  html: string,
): JargonTooltipState | null {
  const [jargonTooltip, setJargonTooltip] = useState<JargonTooltipState | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let touchTimer: ReturnType<typeof setTimeout> | null = null;
    let activeTouchTarget: HTMLElement | null = null;

    const updateTooltip = (target: HTMLElement | null) => {
      if (!target) {
        setJargonTooltip(null);
        return;
      }

      const definition = target.getAttribute("data-definition")?.trim();
      const term = target.textContent?.trim() || "Term";
      if (!definition) {
        setJargonTooltip(null);
        return;
      }

      const rect = target.getBoundingClientRect();
      setJargonTooltip({
        term,
        definition,
        x: rect.left + rect.width / 2,
        y: rect.top - 10,
      });
    };

    const getJargonTarget = (node: EventTarget | null) => {
      if (!(node instanceof HTMLElement)) return null;
      return node.closest(".jargon") as HTMLElement | null;
    };

    const onMouseOver = (e: MouseEvent) => {
      updateTooltip(getJargonTarget(e.target));
    };

    const onMouseOut = (e: MouseEvent) => {
      const current = getJargonTarget(e.target);
      const next = getJargonTarget(e.relatedTarget);
      if (current && current === next) return;
      if (!next) setJargonTooltip(null);
    };

    const onFocusIn = (e: FocusEvent) => {
      updateTooltip(getJargonTarget(e.target));
    };

    const onFocusOut = (e: FocusEvent) => {
      if (!getJargonTarget(e.relatedTarget)) {
        setJargonTooltip(null);
      }
    };

    const onTouchStart = (e: TouchEvent) => {
      const target = getJargonTarget(e.target);
      if (!target) return;
      activeTouchTarget = target;
      touchTimer = setTimeout(() => {
        updateTooltip(target);
      }, 350);
    };

    const onTouchEnd = () => {
      if (touchTimer) {
        clearTimeout(touchTimer);
        touchTimer = null;
      }
      activeTouchTarget = null;
      setTimeout(() => setJargonTooltip(null), 120);
    };

    const onScroll = () => {
      if (!activeTouchTarget) {
        setJargonTooltip(null);
        return;
      }
      updateTooltip(activeTouchTarget);
    };

    container.addEventListener("mouseover", onMouseOver);
    container.addEventListener("mouseout", onMouseOut);
    container.addEventListener("focusin", onFocusIn);
    container.addEventListener("focusout", onFocusOut);
    container.addEventListener("touchstart", onTouchStart, { passive: true });
    container.addEventListener("touchend", onTouchEnd);
    container.addEventListener("touchcancel", onTouchEnd);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);

    return () => {
      if (touchTimer) clearTimeout(touchTimer);
      container.removeEventListener("mouseover", onMouseOver);
      container.removeEventListener("mouseout", onMouseOut);
      container.removeEventListener("focusin", onFocusIn);
      container.removeEventListener("focusout", onFocusOut);
      container.removeEventListener("touchstart", onTouchStart);
      container.removeEventListener("touchend", onTouchEnd);
      container.removeEventListener("touchcancel", onTouchEnd);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
    };
  }, [containerRef, html]);

  return jargonTooltip;
}
