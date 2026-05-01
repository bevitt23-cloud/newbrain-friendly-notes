import { useState, useEffect, useRef } from "react";
import { Check, Loader2, PlayCircle, Plus, X, Youtube } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useTelemetry } from "@/hooks/useTelemetry";

export type VideoTier = "short" | "medium" | "long";

export interface VideoChoice {
  videoId: string;
  title: string;
  channelTitle: string;
  thumbnailUrl: string;
  duration: string;
  durationSeconds?: number;
  tier?: VideoTier;
  rationale?: string;
}

const TIER_LABELS: Record<VideoTier, { label: string; color: string }> = {
  short: { label: "Quick (< 5 min)", color: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" },
  medium: { label: "Standard (5-15 min)", color: "bg-sky-500/15 text-sky-600 dark:text-sky-400" },
  long: { label: "Deep Dive (15+ min)", color: "bg-lavender-500/15 text-lavender-600 dark:text-lavender-400" },
};

export interface SavedExplainerVideo {
  id: string;
  query: string;
  videoId: string;
  title: string;
  channelTitle: string;
  thumbnailUrl: string;
  duration: string;
  tier?: VideoTier;
  rationale?: string;
  savedAt: string;
}

interface InAppVideoModalProps {
  searchQuery: string;
  onClose: () => void;
  savedVideos?: SavedExplainerVideo[];
  onSaveVideo?: (video: SavedExplainerVideo) => void;
}

const InAppVideoModal = ({ searchQuery, onClose, savedVideos = [], onSaveVideo }: InAppVideoModalProps) => {
  const { track } = useTelemetry();
  const overlayRef = useRef<HTMLDivElement>(null);
  const [videos, setVideos] = useState<VideoChoice[]>([]);
  const [selectedVideo, setSelectedVideo] = useState<VideoChoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saveToast, setSaveToast] = useState<string | null>(null);
  // The query the edge function actually used to search YouTube. May
  // differ from `searchQuery` (the user's raw highlight) when the
  // edge function distilled a long passage into a concise query.
  const [resolvedQuery, setResolvedQuery] = useState<string | null>(null);

  const normalizeQuery = (query: string) => query.trim().toLowerCase().replace(/\s+/g, " ");
  const selectionKey = `bfn:lastExplainer:${normalizeQuery(searchQuery)}`;

  const isSaved = (videoId: string) => savedVideos.some((v) => v.videoId === videoId);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  useEffect(() => {
    let isMounted = true;

    const loadVideos = async () => {
      setLoading(true);
      setError(null);
      setSelectedVideo(null);

      const { data, error: invokeError } = await supabase.functions.invoke("search-youtube-videos", {
        body: { query: searchQuery },
      });

      if (!isMounted) return;

      if (invokeError) {
        setVideos([]);
        setError(invokeError.message || "Could not load explainer videos.");
        setLoading(false);
        return;
      }

      const nextVideos = Array.isArray(data?.videos) ? data.videos as VideoChoice[] : [];
      const distilled = typeof data?.searchQuery === "string" ? data.searchQuery : null;
      setResolvedQuery(distilled && distilled !== searchQuery.trim() ? distilled : null);

      if (nextVideos.length === 0) {
        setVideos([]);
        setError(data?.error || "No explainer videos found for this topic.");
        setLoading(false);
        return;
      }

      setVideos(nextVideos);
      const lastVideoId = localStorage.getItem(selectionKey);
      const lastPicked = lastVideoId ? nextVideos.find((v) => v.videoId === lastVideoId) : null;
      setSelectedVideo(lastPicked || nextVideos[0]);
      setLoading(false);
    };

    void loadVideos();

    return () => {
      isMounted = false;
    };
  }, [searchQuery, selectionKey]);

  const handleSelectVideo = (video: VideoChoice) => {
    setSelectedVideo(video);
    localStorage.setItem(selectionKey, video.videoId);
    track("video_tier_selected", { tier: video.tier, videoId: video.videoId, title: video.title });
  };

  const handleSaveVideo = () => {
    if (!selectedVideo || !onSaveVideo) return;
    if (isSaved(selectedVideo.videoId)) {
      setSaveToast("Already saved to this note.");
      setTimeout(() => setSaveToast(null), 1200);
      return;
    }

    onSaveVideo({
      id: `${selectedVideo.videoId}-${Date.now()}`,
      query: searchQuery,
      videoId: selectedVideo.videoId,
      title: selectedVideo.title,
      channelTitle: selectedVideo.channelTitle,
      thumbnailUrl: selectedVideo.thumbnailUrl,
      duration: selectedVideo.duration,
      rationale: selectedVideo.rationale,
      savedAt: new Date().toISOString(),
    });

    setSaveToast("Video attached to this note.");
    setTimeout(() => setSaveToast(null), 1400);
  };

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose();
      }}
    >
      <div className="relative mx-4 w-full max-w-5xl overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
        <div className="flex flex-col gap-1 px-4 py-3 border-b border-border bg-muted/50">
          <div className="flex items-center justify-between gap-4">
            <p className="text-sm font-medium text-foreground truncate pr-4">
              🎥 Visual Explainer: {(resolvedQuery || searchQuery).replace(/\b(simple|easy)?\s*(explanation|explainer)?\s*(for|aimed at)?\s*\d+[\s-]*(year[\s-]*old|yo)\b/gi, "").replace(/\b(for students|for kids|for beginners|ADHD friendly|simple visual)\b/gi, "").replace(/\s{2,}/g, " ").trim()}
            </p>
            <Button
              variant="ghost"
              size="icon"
              className="shrink-0 h-8 w-8 rounded-full hover:bg-destructive/10 hover:text-destructive"
              onClick={onClose}
            >
              <X className="h-4 w-4" />
              <span className="sr-only">Close video</span>
            </Button>
          </div>
          {resolvedQuery && (
            <p className="text-[11px] text-muted-foreground line-clamp-1" title={searchQuery}>
              Refined from your selection: <span className="font-medium text-foreground">{resolvedQuery}</span>
            </p>
          )}
        </div>

        <div className="grid gap-0 md:grid-cols-[1.35fr_0.9fr]">
          <div className="border-b border-border bg-black/95 md:border-b-0 md:border-r">
            {selectedVideo ? (
              <>
                <div className="relative w-full" style={{ paddingBottom: "56.25%" }}>
                  <iframe
                    className="absolute inset-0 h-full w-full"
                    src={`https://www.youtube.com/embed/${selectedVideo.videoId}?autoplay=1&rel=0&modestbranding=1`}
                    title={selectedVideo.title}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    onLoad={() => track("video_watched", { videoId: selectedVideo.videoId, title: selectedVideo.title, tier: selectedVideo.tier, query: searchQuery })}
                  />
                </div>
                <div className="border-t border-white/10 px-5 py-4 text-white">
                  <p className="text-sm font-semibold leading-snug">{selectedVideo.title}</p>
                  <p className="mt-1 text-xs text-white/70">{selectedVideo.channelTitle} • {selectedVideo.duration}</p>
                  {selectedVideo.rationale && (
                    <p className="mt-2 text-xs text-white/80">
                      Why this was chosen: {selectedVideo.rationale}
                    </p>
                  )}
                  <div className="mt-3 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleSaveVideo}
                      className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                        isSaved(selectedVideo.videoId)
                          ? "bg-emerald-500/25 text-emerald-100"
                          : "bg-primary/90 text-primary-foreground hover:bg-primary"
                      }`}
                    >
                      {isSaved(selectedVideo.videoId) ? <Check className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                      {isSaved(selectedVideo.videoId) ? "Saved to Note" : "Save Video to Note"}
                    </button>
                    {saveToast && <span className="text-[11px] text-white/75">{saveToast}</span>}
                  </div>
                </div>
              </>
            ) : (
              <div className="flex min-h-[260px] flex-col items-center justify-center gap-3 px-6 py-10 text-center text-white/90 md:min-h-full">
                <Youtube className="h-10 w-10 text-red-500" />
                <div>
                  <p className="text-base font-semibold">Choose one of the 3 explainer videos</p>
                  <p className="mt-1 text-sm text-white/65">Playback stays inside BrainFriendlyNotes so the study flow is not interrupted.</p>
                </div>
              </div>
            )}
          </div>

          <div className="max-h-[75vh] overflow-y-auto p-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Recommended Videos
            </p>

            {loading && (
              <div className="flex min-h-[200px] items-center justify-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Finding explainer videos...
              </div>
            )}

            {!loading && error && (
              <div className="rounded-xl border border-border bg-muted/50 p-4 text-sm text-muted-foreground">
                {error}
              </div>
            )}

            {!loading && !error && (
              <div className="space-y-3">
                {videos.map((video) => {
                  const isSelected = selectedVideo?.videoId === video.videoId;
                  return (
                    <button
                      key={video.videoId}
                      type="button"
                      onClick={() => handleSelectVideo(video)}
                      className={`flex w-full items-start gap-3 rounded-2xl border p-2 text-left transition-colors ${
                        isSelected ? "border-primary bg-primary/5" : "border-border bg-background hover:bg-muted/60"
                      }`}
                    >
                      <div className="relative shrink-0 overflow-hidden rounded-xl">
                        <img
                          src={video.thumbnailUrl}
                          alt={video.title}
                          className="h-20 w-36 object-cover"
                        />
                        <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                          <PlayCircle className="h-8 w-8 text-white drop-shadow" />
                        </div>
                      </div>
                      <div className="min-w-0 pt-1">
                        <p className="line-clamp-2 text-sm font-semibold text-foreground">{video.title}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{video.channelTitle}</p>
                        <div className="mt-1 flex items-center gap-2">
                          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{video.duration}</p>
                          {video.tier && TIER_LABELS[video.tier] && (
                            <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${TIER_LABELS[video.tier].color}`}>
                              {TIER_LABELS[video.tier].label}
                            </span>
                          )}
                        </div>
                        {video.rationale && (
                          <p className="mt-1 line-clamp-2 text-[11px] text-muted-foreground">{video.rationale}</p>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default InAppVideoModal;
