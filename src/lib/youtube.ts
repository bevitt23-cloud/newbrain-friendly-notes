export function extractYouTubeVideoId(url: string): string | null {
  const raw = url.trim();
  if (!raw) return null;

  const cleanId = (candidate?: string | null): string | null => {
    if (!candidate) return null;
    const id = candidate.trim();
    return /^[A-Za-z0-9_-]{6,}$/.test(id) ? id : null;
  };

  try {
    const normalized = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    const parsed = new URL(normalized);
    const host = parsed.hostname.replace(/^www\./i, "").replace(/^m\./i, "").toLowerCase();
    const segments = parsed.pathname.split("/").filter(Boolean);

    if (host === "youtu.be") return cleanId(segments[0]);

    if (host === "youtube.com" || host === "music.youtube.com") {
      if (segments[0] === "watch") return cleanId(parsed.searchParams.get("v"));
      if (segments[0] === "shorts" || segments[0] === "embed" || segments[0] === "live") {
        return cleanId(segments[1]);
      }
    }
  } catch {
    return null;
  }

  return null;
}

export function isTranscribableYouTubeUrl(url: string): boolean {
  return Boolean(extractYouTubeVideoId(url));
}