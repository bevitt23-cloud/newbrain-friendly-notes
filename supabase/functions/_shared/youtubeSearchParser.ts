export type VideoTier = "short" | "medium" | "long";

export interface YouTubeVideoResult {
  videoId: string;
  title: string;
  channelTitle: string;
  thumbnailUrl: string;
  duration: string;
  durationSeconds: number;
  tier: VideoTier;
  rationale: string;
}

/** Parse a duration string like "12:34" or "1:02:15" into total seconds. */
export function parseDuration(raw: string): number {
  const parts = raw.replace(/\s/g, "").split(":").map(Number);
  if (parts.some(isNaN)) return 0;
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return parts[0] || 0;
}

export function getTier(seconds: number): VideoTier {
  if (seconds > 0 && seconds < 300) return "short";   // under 5 min
  if (seconds <= 900) return "medium";                  // 5-15 min
  return "long";                                        // 15+ min
}

export function buildRationale(query: string, title: string, duration: string, index: number): string {
  const queryWords = query.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
  const titleLower = title.toLowerCase();
  const matchesCore = queryWords.some((w) => titleLower.includes(w));
  const beginnerCue = /(beginner|basics|explained|introduction|for kids|simple|visual|easy)/i.test(title);
  const conciseCue = /(short|quick|in \d+ minutes?)/i.test(title) || /^(?:\d{1,2}:\d{2}|\d{1,2}m)$/i.test(duration);

  if (beginnerCue) return "Beginner-friendly language and visual framing for faster comprehension.";
  if (conciseCue) return "Shorter runtime helps maintain attention and reduce overwhelm.";
  if (matchesCore) return "Strong topic match for the concept highlighted in your notes.";
  if (index === 0) return "Best overall relevance based on your highlighted concept.";
  if (index === 1) return "Alternate teaching style to reinforce understanding from a second angle.";
  return "Additional perspective to deepen memory through varied explanations.";
}

// The InnerTube ANDROID client returns `compactVideoRenderer`; the WEB client returns `videoRenderer`.
// Collect both so the function works regardless of which client variant YouTube returns.
const VIDEO_RENDERER_KEYS = ["videoRenderer", "compactVideoRenderer"] as const;

export function collectVideoRenderers(node: unknown, results: Record<string, unknown>[] = []): Record<string, unknown>[] {
  if (!node) return results;

  if (Array.isArray(node)) {
    for (const item of node) collectVideoRenderers(item, results);
    return results;
  }

  if (typeof node !== "object") return results;

  const obj = node as Record<string, unknown>;
  for (const key of VIDEO_RENDERER_KEYS) {
    if (key in obj && obj[key] && typeof obj[key] === "object") {
      results.push(obj[key] as Record<string, unknown>);
    }
  }

  for (const value of Object.values(obj)) {
    collectVideoRenderers(value, results);
  }

  return results;
}

export function getRunText(value: unknown): string {
  if (!value || typeof value !== "object") return "";
  const obj = value as Record<string, unknown>;
  if (typeof obj.simpleText === "string") return obj.simpleText;
  if (Array.isArray(obj.runs)) {
    return (obj.runs as Record<string, unknown>[])
      .map((run) => (typeof run.text === "string" ? run.text : ""))
      .join("");
  }
  return "";
}

export function parseVideoResults(payload: unknown): YouTubeVideoResult[] {
  const renderers = collectVideoRenderers(payload);
  const seen = new Set<string>();
  const parsed: YouTubeVideoResult[] = [];

  for (const renderer of renderers) {
    const videoId = typeof renderer.videoId === "string" ? renderer.videoId : "";
    if (!videoId || seen.has(videoId)) continue;

    const title = getRunText(renderer.title);
    if (!title) continue;

    const channelTitle = getRunText(renderer.ownerText) || getRunText(renderer.longBylineText) || "YouTube";
    const duration = getRunText(renderer.lengthText) || "Video";

    const thumbnails =
      renderer.thumbnail &&
      typeof renderer.thumbnail === "object" &&
      Array.isArray((renderer.thumbnail as Record<string, unknown>).thumbnails)
        ? ((renderer.thumbnail as Record<string, unknown>).thumbnails as Record<string, unknown>[])
        : [];

    const thumbnailUrl =
      thumbnails
        .map((t) => (typeof t.url === "string" ? t.url : ""))
        .filter(Boolean)
        .at(-1) ?? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

    const durationSeconds = parseDuration(duration);
    const tier = getTier(durationSeconds);

    seen.add(videoId);
    parsed.push({ videoId, title, channelTitle, thumbnailUrl, duration, durationSeconds, tier, rationale: "" });

    // Collect more than 3 so we can pick one per tier
    if (parsed.length === 12) break;
  }

  // Pick best video per tier: one short, one medium, one long
  const byTier: Record<VideoTier, YouTubeVideoResult | undefined> = {
    short: parsed.find((v) => v.tier === "short"),
    medium: parsed.find((v) => v.tier === "medium"),
    long: parsed.find((v) => v.tier === "long"),
  };

  // Build final list: one per tier that exists, maintaining short→medium→long order
  const tiered: YouTubeVideoResult[] = [];
  for (const t of ["short", "medium", "long"] as VideoTier[]) {
    if (byTier[t]) tiered.push(byTier[t]!);
  }

  // If we have fewer than 3 tiers represented, fill from remaining videos
  if (tiered.length < 3) {
    const usedIds = new Set(tiered.map((v) => v.videoId));
    for (const v of parsed) {
      if (usedIds.has(v.videoId)) continue;
      tiered.push(v);
      usedIds.add(v.videoId);
      if (tiered.length === 3) break;
    }
  }

  return tiered;
}
