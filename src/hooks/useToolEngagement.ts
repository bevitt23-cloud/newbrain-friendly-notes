import { useEffect, useRef } from "react";
import { useTelemetry } from "@/hooks/useTelemetry";

export type ToolName =
  | "flashcard"
  | "cloze"
  | "quiz"
  | "mindmap"
  | "flowchart"
  | "socratic"
  | "final_exam";

/**
 * Tracks tool engagement lifecycle for research.
 * Fires `tool_engaged` on mount, `tool_abandoned` on unmount unless
 * the caller marks the session as complete via the returned `markComplete()`.
 *
 * Also returns total time-on-tool in ms so completion events can include it.
 */
export function useToolEngagement(tool: ToolName, noteId?: string) {
  const { track } = useTelemetry();
  const startRef = useRef<number>(Date.now());
  const completedRef = useRef(false);

  useEffect(() => {
    startRef.current = Date.now();
    track("tool_engaged", { tool, note_id: noteId });

    return () => {
      if (!completedRef.current) {
        const duration_ms = Date.now() - startRef.current;
        track("tool_abandoned", { tool, note_id: noteId, duration_ms });
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tool, noteId]);

  return {
    markComplete: () => {
      completedRef.current = true;
    },
    getDurationMs: () => Date.now() - startRef.current,
  };
}
