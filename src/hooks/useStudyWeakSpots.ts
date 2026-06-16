import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useUserPreferences } from "@/hooks/useUserPreferences";

/**
 * Aggregates the signed-in user's own behavioral telemetry for a given note into a
 * concise "focus areas" instruction that adaptive study-material generation can use.
 *
 * Signals (all scoped to one note via event_data.note_id):
 *  - Missed questions   — *_answer events with correct === false
 *  - Slow answers       — *_answer events with a high answer_ms
 *  - Re-read sections   — session_behavior_summary.scroll_thrash_sections + low reading velocity
 *
 * Gated by the same consent toggles `useTelemetry` respects. Returns undefined when
 * adaptation is disabled or there is no usable signal, so callers can omit it cleanly.
 */

const RELEVANT_EVENTS = ["quiz_answer", "final_exam_answer", "cloze_answer", "session_behavior_summary"];
const SLOW_ANSWER_MS = 20_000; // a question that took >20s likely caused friction

interface RawRow {
  event_type: string;
  event_data: Record<string, unknown> | null;
  created_at: string;
}

function topByFrequency(values: string[], max: number): string[] {
  const counts = new Map<string, number>();
  for (const v of values) {
    const key = v.trim();
    if (!key) continue;
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, max)
    .map(([v]) => (v.length > 120 ? v.slice(0, 117) + "…" : v));
}

export function useStudyWeakSpots(noteId?: string) {
  const { preferences } = useUserPreferences();
  const enabled =
    !!noteId &&
    preferences.insights_enabled !== false &&
    (preferences as Record<string, unknown>).research_data_shared !== false;

  const computeFocusAreas = useCallback(async (): Promise<string | undefined> => {
    if (!enabled || !noteId) return undefined;

    const { data, error } = await supabase
      .from("telemetry_events")
      .select("event_type, event_data, created_at")
      .in("event_type", RELEVANT_EVENTS)
      .order("created_at", { ascending: false })
      .limit(1000);
    if (error || !data) return undefined;

    const rows = (data as RawRow[]).filter((r) => (r.event_data?.note_id as string | undefined) === noteId);
    if (rows.length === 0) return undefined;

    const missed: string[] = [];
    const slow: string[] = [];
    const sections: string[] = [];

    for (const row of rows) {
      const ed = row.event_data || {};
      if (row.event_type === "session_behavior_summary") {
        const thrash = ed.scroll_thrash_sections;
        if (Array.isArray(thrash)) sections.push(...thrash.filter((s): s is string => typeof s === "string"));
        continue;
      }
      // *_answer events
      const label = (typeof ed.question === "string" && ed.question)
        || (typeof ed.topic === "string" && ed.topic)
        || (typeof ed.answer === "string" && ed.answer)
        || "";
      if (!label) continue;
      if (ed.correct === false) missed.push(label);
      if (typeof ed.answer_ms === "number" && ed.answer_ms > SLOW_ANSWER_MS) slow.push(label);
    }

    const missedTop = topByFrequency(missed, 5);
    const slowTop = topByFrequency(slow, 3).filter((s) => !missedTop.includes(s));
    const sectionTop = topByFrequency(sections.map((s) => s.replace(/^section-/, "").replace(/-/g, " ")), 5);

    const lines: string[] = [];
    if (missedTop.length) lines.push(`- Previously answered INCORRECTLY: ${missedTop.join("; ")}`);
    if (slowTop.length) lines.push(`- Took a long time / hesitated on: ${slowTop.join("; ")}`);
    if (sectionTop.length) lines.push(`- Re-read or scrolled back repeatedly over: ${sectionTop.join("; ")}`);
    if (lines.length === 0) return undefined;

    return (
      "ADAPTIVE FOCUS (based on this student's past performance on this material) — " +
      "re-teach the following more concretely (smaller steps, plain-language analogies, worked examples) " +
      "and weight questions/examples toward them:\n" +
      lines.join("\n")
    );
  }, [enabled, noteId]);

  return { computeFocusAreas, enabled };
}
