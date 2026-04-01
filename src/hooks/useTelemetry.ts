import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserPreferences } from "@/hooks/useUserPreferences";

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
  | "practice_answer"
  | "practice_complete"
  | "final_exam_answer"
  | "final_exam_complete"
  | "video_watched"
  | "video_tier_selected";

export function useTelemetry() {
  const { user } = useAuth();
  const { preferences } = useUserPreferences();

  const track = useCallback(
    async (eventType: TelemetryEventType, eventData: Record<string, unknown> = {}) => {
      if (!user) return;
      // Respect user's insights preference — don't collect if disabled
      if (!preferences.insights_enabled) return;
      try {
        await supabase.from("telemetry_events").insert({
          user_id: user.id,
          event_type: eventType,
          event_data: eventData,
        });
      } catch (e) {
        console.error("Telemetry error:", e);
      }
    },
    [user, preferences.insights_enabled]
  );

  return { track };
}
