import { useEffect, useRef, useCallback } from "react";
import { useTelemetry } from "@/hooks/useTelemetry";

/**
 * Behavioral sensors for research telemetry.
 * Tracks scroll thrashing, section dwell time, text highlight friction,
 * and bailout point. All data is batched client-side and sent as a single
 * `session_behavior_summary` event when the component unmounts or the
 * user leaves the page.
 *
 * Mount this hook in the GeneratedNotes component.
 */

interface DwellRecord {
  section_id: string;
  word_count: number;
  dwell_ms: number;
}

interface SessionData {
  startTime: number;
  scrollThrashCount: number;
  scrollThrashSections: string[];
  dwellRecords: DwellRecord[];
  textHighlightNoActionCount: number;
  sectionsViewed: Set<string>;
  totalSections: number;
}

function getNearestSectionId(element: Element | null): string {
  let el = element;
  while (el) {
    if (el.id) return el.id;
    if (el.tagName === "SECTION" && el.getAttribute("data-section-color")) {
      // Find the h2 inside for its id
      const h2 = el.querySelector("h2[id]");
      if (h2) return h2.id;
    }
    el = el.parentElement;
  }
  return "unknown";
}

function getWordCount(el: Element): number {
  return (el.textContent || "").trim().split(/\s+/).filter(Boolean).length;
}

function getViewportCenterElement(): string {
  const el = document.elementFromPoint(window.innerWidth / 2, window.innerHeight / 2);
  return getNearestSectionId(el);
}

export function useBehavioralSensors(containerRef: React.RefObject<HTMLElement | null>) {
  const { track } = useTelemetry();
  const sessionRef = useRef<SessionData>({
    startTime: Date.now(),
    scrollThrashCount: 0,
    scrollThrashSections: [],
    dwellRecords: [],
    textHighlightNoActionCount: 0,
    sectionsViewed: new Set(),
    totalSections: 0,
  });
  const flushedRef = useRef(false);

  // ── Flush session summary ──
  const flushSummary = useCallback(() => {
    if (flushedRef.current) return;
    flushedRef.current = true;

    const s = sessionRef.current;
    const sessionDuration = Date.now() - s.startTime;

    // Compute reading velocity degradation
    const dwells = s.dwellRecords.filter((d) => d.dwell_ms > 500 && d.word_count > 5);
    let avgWpm = 0;
    let velocityDegradation = 0;
    if (dwells.length >= 2) {
      const velocities = dwells.map((d) => (d.word_count / d.dwell_ms) * 60000);
      avgWpm = Math.round(velocities.reduce((a, b) => a + b, 0) / velocities.length);
      const firstHalf = velocities.slice(0, Math.ceil(velocities.length / 2));
      const secondHalf = velocities.slice(Math.ceil(velocities.length / 2));
      const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
      const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
      if (firstAvg > 0) {
        velocityDegradation = Math.round(((firstAvg - secondAvg) / firstAvg) * 100);
      }
    }

    track("session_behavior_summary", {
      scroll_thrash_count: s.scrollThrashCount,
      scroll_thrash_sections: [...new Set(s.scrollThrashSections)].slice(0, 10),
      section_dwell_times: dwells.slice(0, 50),
      avg_reading_velocity_wpm: avgWpm,
      velocity_degradation_pct: velocityDegradation,
      text_highlight_no_action_count: s.textHighlightNoActionCount,
      session_duration_ms: sessionDuration,
      total_sections_viewed: s.sectionsViewed.size,
      total_sections_available: s.totalSections,
      bailout_element_id: getViewportCenterElement(),
    });
  }, [track]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const s = sessionRef.current;
    s.startTime = Date.now();
    flushedRef.current = false;

    // Count total sections
    s.totalSections = container.querySelectorAll("section[data-section-color]").length;

    // ── Scroll Thrashing Sensor ──
    let lastScrollY = window.scrollY;
    let lastDirection = 0; // 1 = down, -1 = up
    let directionChanges: number[] = []; // timestamps of direction changes

    const handleScroll = () => {
      const y = window.scrollY;
      const delta = y - lastScrollY;
      if (Math.abs(delta) < 5) return; // ignore micro-scrolls
      const dir = delta > 0 ? 1 : -1;

      if (lastDirection !== 0 && dir !== lastDirection) {
        const now = Date.now();
        directionChanges.push(now);
        // Keep only changes in the last 10 seconds
        directionChanges = directionChanges.filter((t) => now - t < 10000);
        if (directionChanges.length > 3) {
          s.scrollThrashCount++;
          s.scrollThrashSections.push(getViewportCenterElement());
          directionChanges = []; // reset window
        }
      }
      lastDirection = dir;
      lastScrollY = y;
    };

    // Throttle scroll to ~100ms
    let scrollTimer: ReturnType<typeof setTimeout> | null = null;
    const throttledScroll = () => {
      if (scrollTimer) return;
      scrollTimer = setTimeout(() => {
        scrollTimer = null;
        handleScroll();
      }, 100);
    };
    window.addEventListener("scroll", throttledScroll, { passive: true });

    // ── Section Dwell Time Sensor ──
    const dwellTimers = new Map<string, number>(); // section_id → enter timestamp

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const id = (entry.target as HTMLElement).id || getNearestSectionId(entry.target);
          if (entry.isIntersecting) {
            dwellTimers.set(id, Date.now());
            s.sectionsViewed.add(id);
          } else if (dwellTimers.has(id)) {
            const enterTime = dwellTimers.get(id)!;
            const dwellMs = Date.now() - enterTime;
            dwellTimers.delete(id);
            if (dwellMs > 500) {
              s.dwellRecords.push({
                section_id: id,
                word_count: getWordCount(entry.target),
                dwell_ms: dwellMs,
              });
            }
          }
        }
      },
      { threshold: 0.3 }
    );

    // Observe all h2/h3 and sections
    const sections = container.querySelectorAll("section[data-section-color], h2[id], h3");
    sections.forEach((el) => observer.observe(el));

    // ── Text Highlight No Action Sensor ──
    let selectionTimeout: ReturnType<typeof setTimeout> | null = null;

    const handleSelectionChange = () => {
      if (selectionTimeout) {
        clearTimeout(selectionTimeout);
        selectionTimeout = null;
      }
      const sel = document.getSelection();
      if (!sel || sel.isCollapsed || !sel.toString().trim()) return;

      const wordCount = sel.toString().trim().split(/\s+/).length;
      if (wordCount < 2) return; // ignore single-word selections

      selectionTimeout = setTimeout(() => {
        // If we get here, 5 seconds passed without menu interaction
        s.textHighlightNoActionCount++;
        // Fire individual event (low volume)
        track("text_highlighted_no_action", {
          word_count: wordCount,
          section_id: sel.anchorNode ? getNearestSectionId(sel.anchorNode.parentElement) : "unknown",
        });
      }, 5000);
    };

    document.addEventListener("selectionchange", handleSelectionChange);

    // Cancel highlight timer if the selection menu is used (user clicks a button)
    const handleClick = () => {
      if (selectionTimeout) {
        clearTimeout(selectionTimeout);
        selectionTimeout = null;
      }
    };
    container.addEventListener("click", handleClick);

    // ── Bailout / Page Leave ──
    const handleBeforeUnload = () => {
      // Flush any remaining dwell timers
      for (const [id, enterTime] of dwellTimers) {
        const dwellMs = Date.now() - enterTime;
        if (dwellMs > 500) {
          s.dwellRecords.push({
            section_id: id,
            word_count: 0, // can't measure on unload
            dwell_ms: dwellMs,
          });
        }
      }
      flushSummary();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        handleBeforeUnload();
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      // Flush on unmount
      handleBeforeUnload();
      window.removeEventListener("scroll", throttledScroll);
      observer.disconnect();
      document.removeEventListener("selectionchange", handleSelectionChange);
      container.removeEventListener("click", handleClick);
      window.removeEventListener("beforeunload", handleBeforeUnload);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (scrollTimer) clearTimeout(scrollTimer);
      if (selectionTimeout) clearTimeout(selectionTimeout);
    };
  }, [containerRef, track, flushSummary]);
}
