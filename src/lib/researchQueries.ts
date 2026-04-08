/**
 * Research query engine for the admin dashboard.
 * Computes metrics from raw telemetry events, groups by dimensions,
 * and exports anonymized CSV.
 */

// ─── Types ──────────────────────────────────────────────────

export type MetricKey =
  | "quiz_accuracy"
  | "avg_dwell_time"
  | "scroll_thrash_rate"
  | "post_error_abandon_rate"
  | "post_error_recovery_time"
  | "tool_completion_rate"
  | "session_duration"
  | "text_highlight_friction"
  | "reading_velocity"
  | "velocity_degradation";

export type DimensionKey =
  | "trait"
  | "age_range"
  | "gender"
  | "region"
  | "hour_of_day"
  | "time_block"
  | "profile_name"
  | "note_format"
  | "writing_style";

export const METRIC_LABELS: Record<MetricKey, { name: string; unit: string }> = {
  quiz_accuracy: { name: "Quiz Accuracy", unit: "%" },
  avg_dwell_time: { name: "Avg Dwell Time", unit: "sec" },
  scroll_thrash_rate: { name: "Scroll Thrash Rate", unit: "/session" },
  post_error_abandon_rate: { name: "Post-Error Abandon Rate", unit: "%" },
  post_error_recovery_time: { name: "Post-Error Recovery Time", unit: "sec" },
  tool_completion_rate: { name: "Tool Completion Rate", unit: "%" },
  session_duration: { name: "Session Duration", unit: "min" },
  text_highlight_friction: { name: "Text Highlight Friction", unit: "/session" },
  reading_velocity: { name: "Reading Velocity", unit: "wpm" },
  velocity_degradation: { name: "Velocity Degradation", unit: "%" },
};

export const DIMENSION_LABELS: Record<DimensionKey, string> = {
  trait: "Cognitive Trait",
  age_range: "Age Range",
  gender: "Gender",
  region: "Region",
  hour_of_day: "Hour of Day",
  time_block: "Time Block",
  profile_name: "Profile Name",
  note_format: "Note Format",
  writing_style: "Writing Style",
};

export interface QueryResult {
  group: string;
  count: number;
  value: number;
  userCount: number;
}

interface RawEvent {
  event_type: string;
  event_data: Record<string, any>;
  created_at: string;
  user_id: string;
}

// ─── Dimension Extraction ───────────────────────────────────

function getAgeRange(age: number | null | undefined): string {
  if (!age) return "Unknown";
  if (age < 13) return "Under 13";
  if (age <= 18) return "13–18";
  if (age <= 25) return "19–25";
  if (age <= 40) return "26–40";
  return "41+";
}

function getTimeBlock(hour: number): string {
  if (hour < 6) return "Night (12am–6am)";
  if (hour < 12) return "Morning (6am–12pm)";
  if (hour < 18) return "Afternoon (12pm–6pm)";
  return "Evening (6pm–12am)";
}

function extractDimension(event: RawEvent, dim: DimensionKey): string[] {
  const ctx = event.event_data?._ctx || {};
  switch (dim) {
    case "trait": {
      const traits = ctx.traits as string[] | undefined;
      return traits && traits.length > 0 ? traits : ["None"];
    }
    case "age_range":
      return [getAgeRange(ctx.age)];
    case "gender":
      return [ctx.gender || "Not set"];
    case "region":
      return [ctx.region || "Not set"];
    case "hour_of_day": {
      const h = event.event_data?.local_hour;
      return [h !== undefined ? `${h}:00` : "Unknown"];
    }
    case "time_block": {
      const h = event.event_data?.local_hour;
      return [h !== undefined ? getTimeBlock(h) : "Unknown"];
    }
    case "profile_name":
      return [ctx.profile_name || "Unknown"];
    case "note_format":
      return [ctx.note_format || "Auto"];
    case "writing_style":
      return [ctx.learning_mode || "Default"];
    default:
      return ["Unknown"];
  }
}

// ─── Metric Computations ────────────────────────────────────

function groupEvents(events: RawEvent[], dim: DimensionKey): Map<string, RawEvent[]> {
  const groups = new Map<string, RawEvent[]>();
  for (const ev of events) {
    const keys = extractDimension(ev, dim);
    for (const key of keys) {
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(ev);
    }
  }
  return groups;
}

function uniqueUsers(events: RawEvent[]): number {
  return new Set(events.map((e) => e.user_id)).size;
}

export function computeMetric(
  allEvents: RawEvent[],
  metric: MetricKey,
  dimension: DimensionKey,
  minGroupSize: number = 3
): QueryResult[] {
  const results: QueryResult[] = [];

  switch (metric) {
    case "quiz_accuracy": {
      const quizEvents = allEvents.filter((e) =>
        ["quiz_answer", "cloze_answer", "final_exam_answer"].includes(e.event_type)
      );
      const groups = groupEvents(quizEvents, dimension);
      for (const [group, events] of groups) {
        const users = uniqueUsers(events);
        if (users < minGroupSize) continue;
        const correct = events.filter((e) => e.event_data?.correct === true).length;
        results.push({
          group,
          count: events.length,
          value: events.length > 0 ? Math.round((correct / events.length) * 100) : 0,
          userCount: users,
        });
      }
      break;
    }

    case "avg_dwell_time": {
      const summaries = allEvents.filter((e) => e.event_type === "session_behavior_summary");
      const groups = groupEvents(summaries, dimension);
      for (const [group, events] of groups) {
        const users = uniqueUsers(events);
        if (users < minGroupSize) continue;
        let totalDwell = 0;
        let sectionCount = 0;
        for (const ev of events) {
          const dwells = ev.event_data?.section_dwell_times as DwellTimeEntry[] | undefined;
          if (dwells) {
            for (const d of dwells) {
              totalDwell += d.dwell_ms;
              sectionCount++;
            }
          }
        }
        results.push({
          group,
          count: sectionCount,
          value: sectionCount > 0 ? Math.round(totalDwell / sectionCount / 1000) : 0,
          userCount: users,
        });
      }
      break;
    }

    case "scroll_thrash_rate": {
      const summaries = allEvents.filter((e) => e.event_type === "session_behavior_summary");
      const groups = groupEvents(summaries, dimension);
      for (const [group, events] of groups) {
        const users = uniqueUsers(events);
        if (users < minGroupSize) continue;
        const totalThrash = events.reduce((sum, e) => sum + (e.event_data?.scroll_thrash_count || 0), 0);
        results.push({
          group,
          count: events.length,
          value: events.length > 0 ? Math.round((totalThrash / events.length) * 10) / 10 : 0,
          userCount: users,
        });
      }
      break;
    }

    case "post_error_abandon_rate": {
      // Correlate quiz_answer(correct:false) with tool_abandoned within 10s
      const quizWrong = allEvents
        .filter((e) => ["quiz_answer", "cloze_answer", "final_exam_answer"].includes(e.event_type) && e.event_data?.correct === false)
        .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      const abandons = allEvents
        .filter((e) => e.event_type === "tool_abandoned")
        .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

      let abandonCount = 0;
      for (const wrong of quizWrong) {
        const wrongTime = new Date(wrong.created_at).getTime();
        const abandoned = abandons.find(
          (a) => a.user_id === wrong.user_id && Math.abs(new Date(a.created_at).getTime() - wrongTime) < 10000
        );
        if (abandoned) abandonCount++;
      }

      const groups = groupEvents(quizWrong, dimension);
      for (const [group, events] of groups) {
        const users = uniqueUsers(events);
        if (users < minGroupSize) continue;
        let groupAbandons = 0;
        for (const wrong of events) {
          const wrongTime = new Date(wrong.created_at).getTime();
          const abandoned = abandons.find(
            (a) => a.user_id === wrong.user_id && Math.abs(new Date(a.created_at).getTime() - wrongTime) < 10000
          );
          if (abandoned) groupAbandons++;
        }
        results.push({
          group,
          count: events.length,
          value: events.length > 0 ? Math.round((groupAbandons / events.length) * 100) : 0,
          userCount: users,
        });
      }
      break;
    }

    case "post_error_recovery_time": {
      // Time between wrong answer and next answer by same user
      const allQuiz = allEvents
        .filter((e) => ["quiz_answer", "cloze_answer", "final_exam_answer"].includes(e.event_type))
        .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

      const recoveryTimes: Array<RawEvent & { recovery_ms: number }> = [];
      for (let i = 0; i < allQuiz.length - 1; i++) {
        if (allQuiz[i].event_data?.correct === false) {
          // Find next answer by same user
          for (let j = i + 1; j < allQuiz.length; j++) {
            if (allQuiz[j].user_id === allQuiz[i].user_id) {
              const delta = new Date(allQuiz[j].created_at).getTime() - new Date(allQuiz[i].created_at).getTime();
              if (delta < 300000) { // within 5 min
                recoveryTimes.push({ ...allQuiz[j], recovery_ms: delta });
              }
              break;
            }
          }
        }
      }

      const groups = groupEvents(recoveryTimes, dimension);
      for (const [group, events] of groups) {
        const users = uniqueUsers(events);
        if (users < minGroupSize) continue;
        const totalRecovery = (events as any[]).reduce((sum: number, e: any) => sum + (e.recovery_ms || 0), 0);
        results.push({
          group,
          count: events.length,
          value: events.length > 0 ? Math.round(totalRecovery / events.length / 1000) : 0,
          userCount: users,
        });
      }
      break;
    }

    case "tool_completion_rate": {
      const engaged = allEvents.filter((e) => e.event_type === "tool_engaged");
      const completionTypes = new Set([
        "flashcard_session_complete", "cloze_session_complete", "quiz_complete",
        "final_exam_complete", "socratic_session_end",
      ]);
      const completed = allEvents.filter((e) => completionTypes.has(e.event_type));

      const groups = groupEvents(engaged, dimension);
      for (const [group, events] of groups) {
        const users = uniqueUsers(events);
        if (users < minGroupSize) continue;
        const userIds = new Set(events.map((e) => e.user_id));
        const completions = completed.filter((c) => userIds.has(c.user_id)).length;
        results.push({
          group,
          count: events.length,
          value: events.length > 0 ? Math.round((completions / events.length) * 100) : 0,
          userCount: users,
        });
      }
      break;
    }

    case "session_duration": {
      const summaries = allEvents.filter((e) => e.event_type === "session_behavior_summary");
      const groups = groupEvents(summaries, dimension);
      for (const [group, events] of groups) {
        const users = uniqueUsers(events);
        if (users < minGroupSize) continue;
        const totalMs = events.reduce((sum, e) => sum + (e.event_data?.session_duration_ms || 0), 0);
        results.push({
          group,
          count: events.length,
          value: events.length > 0 ? Math.round(totalMs / events.length / 60000) : 0,
          userCount: users,
        });
      }
      break;
    }

    case "text_highlight_friction": {
      const summaries = allEvents.filter((e) => e.event_type === "session_behavior_summary");
      const groups = groupEvents(summaries, dimension);
      for (const [group, events] of groups) {
        const users = uniqueUsers(events);
        if (users < minGroupSize) continue;
        const total = events.reduce((sum, e) => sum + (e.event_data?.text_highlight_no_action_count || 0), 0);
        results.push({
          group,
          count: events.length,
          value: events.length > 0 ? Math.round((total / events.length) * 10) / 10 : 0,
          userCount: users,
        });
      }
      break;
    }

    case "reading_velocity": {
      const summaries = allEvents.filter((e) => e.event_type === "session_behavior_summary");
      const groups = groupEvents(summaries, dimension);
      for (const [group, events] of groups) {
        const users = uniqueUsers(events);
        if (users < minGroupSize) continue;
        const withVelocity = events.filter((e) => e.event_data?.avg_reading_velocity_wpm > 0);
        const totalWpm = withVelocity.reduce((sum, e) => sum + e.event_data.avg_reading_velocity_wpm, 0);
        results.push({
          group,
          count: withVelocity.length,
          value: withVelocity.length > 0 ? Math.round(totalWpm / withVelocity.length) : 0,
          userCount: users,
        });
      }
      break;
    }

    case "velocity_degradation": {
      const summaries = allEvents.filter((e) => e.event_type === "session_behavior_summary");
      const groups = groupEvents(summaries, dimension);
      for (const [group, events] of groups) {
        const users = uniqueUsers(events);
        if (users < minGroupSize) continue;
        const withDeg = events.filter((e) => e.event_data?.velocity_degradation_pct !== undefined);
        const totalDeg = withDeg.reduce((sum, e) => sum + e.event_data.velocity_degradation_pct, 0);
        results.push({
          group,
          count: withDeg.length,
          value: withDeg.length > 0 ? Math.round(totalDeg / withDeg.length) : 0,
          userCount: users,
        });
      }
      break;
    }
  }

  return results.sort((a, b) => b.value - a.value);
}

// ─── CSV Export ──────────────────────────────────────────────

function hashUserId(userId: string): string {
  // Simple hash for anonymization — not cryptographic, just for de-identification
  let hash = 0;
  const str = userId + "_research_salt_2026";
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return "anon_" + Math.abs(hash).toString(36);
}

export function exportQueryResultsCSV(
  results: QueryResult[],
  metricKey: MetricKey,
  dimensionKey: DimensionKey,
): string {
  const metric = METRIC_LABELS[metricKey];
  const dimension = DIMENSION_LABELS[dimensionKey];
  const lines: string[] = [];
  lines.push(`${dimension},Event Count,User Count,${metric.name} (${metric.unit})`);
  for (const r of results) {
    lines.push(`"${r.group}",${r.count},${r.userCount},${r.value}`);
  }
  return lines.join("\n");
}

export function exportRawEventsCSV(events: RawEvent[], minGroupSize: number = 3): string {
  // Group users — suppress if fewer than minGroupSize events
  const userCounts = new Map<string, number>();
  for (const e of events) {
    userCounts.set(e.user_id, (userCounts.get(e.user_id) || 0) + 1);
  }

  const lines: string[] = [];
  lines.push("anon_id,event_type,created_at,local_hour,traits,profile_name,age_range,gender,region,event_data");
  for (const e of events) {
    if ((userCounts.get(e.user_id) || 0) < minGroupSize) continue;
    const ctx = e.event_data?._ctx || {};
    const data = { ...e.event_data };
    delete data._ctx; // strip context from data column (it's in separate columns)
    lines.push([
      hashUserId(e.user_id),
      e.event_type,
      e.created_at,
      e.event_data?.local_hour ?? "",
      (ctx.traits || []).join(";"),
      ctx.profile_name || "",
      getAgeRange(ctx.age),
      ctx.gender || "",
      ctx.region || "",
      `"${JSON.stringify(data).replace(/"/g, '""')}"`,
    ].join(","));
  }
  return lines.join("\n");
}

interface DwellTimeEntry {
  section_id: string;
  word_count: number;
  dwell_ms: number;
}
