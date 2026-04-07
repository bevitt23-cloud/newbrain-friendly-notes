import { useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserPreferences } from "@/hooks/useUserPreferences";
import { useCognitiveProfile } from "@/hooks/useCognitiveProfile";
import { deriveProfileLabel } from "@/lib/cognitiveRules";

export type TelemetryEventType =
  | "tool_engaged"
  | "tool_abandoned"
  | "explain_this_clicked"
  | "setting_toggled"
  | "assessment_completed"
  | "energy_slider_used"
  // Study tool tracking
  | "flashcard_flip"
  | "flashcard_rated"
  | "flashcard_session_complete"
  | "cloze_answer"
  | "cloze_session_complete"
  | "quiz_answer"
  | "quiz_complete"
  | "mindmap_node_click"
  | "mindmap_branch_expand"
  | "flowchart_node_click"
  | "socratic_turn"
  | "socratic_session_end"
  | "final_exam_answer"
  | "final_exam_complete"
  | "video_watched"
  | "video_tier_selected"
  // Behavioral research sensors
  | "session_behavior_summary"
  | "session_bailout"
  | "text_highlighted_no_action";

export function useTelemetry() {
  const { user } = useAuth();
  const { preferences } = useUserPreferences();
  const { profile } = useCognitiveProfile();

  // Cache context so we don't recompute on every track call
  const ctxRef = useRef<Record<string, unknown> | null>(null);
  const ctxKeyRef = useRef("");

  const getContext = useCallback(() => {
    // Build a cache key from profile + preferences to avoid recomputing
    const key = `${profile.traits.join(",")}-${profile.age}-${profile.gender}-${profile.region}`;
    if (ctxKeyRef.current === key && ctxRef.current) return ctxRef.current;

    // Collect active toggles from preferences
    const toggles: string[] = [];
    const p = preferences as Record<string, unknown>;
    for (const k of Object.keys(p)) {
      if (typeof p[k] === "boolean" && p[k] === true && k !== "insights_enabled" && k !== "research_data_shared") {
        toggles.push(k);
      }
    }

    const ctx: Record<string, unknown> = {
      traits: profile.traits,
      profile_name: deriveProfileLabel(profile.traits).name,
      age: profile.age,
      gender: profile.gender,
      region: profile.region,
      active_toggles: toggles,
      learning_mode: profile.settings.learningMode,
    };

    ctxRef.current = ctx;
    ctxKeyRef.current = key;
    return ctx;
  }, [profile, preferences]);

  const track = useCallback(
    async (eventType: TelemetryEventType, eventData: Record<string, unknown> = {}) => {
      if (!user) return;
      // Respect user's insights preference — don't collect if disabled
      if (!preferences.insights_enabled) return;
      try {
        const enriched = {
          ...eventData,
          local_hour: new Date().getHours(),
          local_day: new Date().getDay(),
          _ctx: getContext(),
        };
        await supabase.from("telemetry_events").insert({
          user_id: user.id,
          event_type: eventType,
          event_data: enriched as unknown as import("@/integrations/supabase/types").Json,
        });
      } catch (e) {
        console.error("Telemetry error:", e);
      }
    },
    [user, preferences.insights_enabled, getContext]
  );

  return { track };
}
