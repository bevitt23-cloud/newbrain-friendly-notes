import { useRef, useCallback, useState } from "react";
import { Youtube, X, PlayCircle, GripHorizontal, Minimize2, ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useVideoBar } from "@/hooks/useVideoBar";
import type { SavedExplainerVideo } from "@/components/InAppVideoModal";

interface VideoBarProps {
  savedVideos: SavedExplainerVideo[];
  onRemoveVideo: (videoId: string) => void;
}

const VideoBar = ({ savedVideos, onRemoveVideo }: VideoBarProps) => {
  const {
    activeVideoId,
    isExpanded,
    isPlayerOpen,
    barPosition,
    playerPosition,
    saveBarPosition,
    savePlayerPosition,
    playVideo,
    closePlayer,
    toggleExpanded,
    setIsExpanded,
  } = useVideoBar();

  /* ── Bar drag state ── */
  const barDragRef = useRef({ startX: 0, startY: 0, posX: 0, posY: 0 });
  const [isBarDragging, setIsBarDragging] = useState(false);
  const barClickedRef = useRef(false);

  const onBarPointerDown = useCallback(
    (e: React.PointerEvent) => {
      barDragRef.current = { startX: e.clientX, startY: e.clientY, posX: barPosition.x, posY: barPosition.y };
      setIsBarDragging(true);
      barClickedRef.current = true;
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    },
    [barPosition]
  );

  const onBarPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isBarDragging) return;
      const dx = e.clientX - barDragRef.current.startX;
      const dy = e.clientY - barDragRef.current.startY;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) barClickedRef.current = false;
      const newX = Math.max(0, Math.min(window.innerWidth - 48, barDragRef.current.posX + dx));
      const newY = Math.max(0, Math.min(window.innerHeight - 48, barDragRef.current.posY + dy));
      saveBarPosition({ x: newX, y: newY });
    },
    [isBarDragging, saveBarPosition]
  );

  const onBarPointerUp = useCallback(() => {
    setIsBarDragging(false);
    if (barClickedRef.current) toggleExpanded();
  }, [toggleExpanded]);

  /* ── Player drag state ── */
  const playerDragRef = useRef({ startX: 0, startY: 0, posX: 0, posY: 0 });
  const [isPlayerDragging, setIsPlayerDragging] = useState(false);

  const onPlayerPointerDown = useCallback(
    (e: React.PointerEvent) => {
      playerDragRef.current = { startX: e.clientX, startY: e.clientY, posX: playerPosition.x, posY: playerPosition.y };
      setIsPlayerDragging(true);
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    },
    [playerPosition]
  );

  const onPlayerPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isPlayerDragging) return;
      const dx = e.clientX - playerDragRef.current.startX;
      const dy = e.clientY - playerDragRef.current.startY;
      const newX = Math.max(0, Math.min(window.innerWidth - 200, playerDragRef.current.posX + dx));
      const newY = Math.max(0, Math.min(window.innerHeight - 100, playerDragRef.current.posY + dy));
      savePlayerPosition({ x: newX, y: newY });
    },
    [isPlayerDragging, savePlayerPosition]
  );

  const onPlayerPointerUp = useCallback(() => {
    setIsPlayerDragging(false);
  }, []);

  const activeVideo = savedVideos.find((v) => v.videoId === activeVideoId);

  if (savedVideos.length === 0) return null;

  return (
    <>
      {/* ── Floating Video Icon (collapsed bar) ── */}
      <div
        className="fixed z-[55] select-none touch-none"
        style={{ left: barPosition.x, top: barPosition.y }}
      >
        {/* Icon pill */}
        <button
          onPointerDown={onBarPointerDown}
          onPointerMove={onBarPointerMove}
          onPointerUp={onBarPointerUp}
          className={`relative flex h-11 w-11 items-center justify-center rounded-2xl border border-border/60 bg-card/95 shadow-xl backdrop-blur-xl transition-all hover:shadow-2xl hover:scale-105 ${
            isBarDragging ? "cursor-grabbing scale-105" : "cursor-grab"
          }`}
          title="Saved Videos"
        >
          <Youtube className="h-5 w-5 text-red-500" />
          {/* Badge */}
          <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white shadow">
            {savedVideos.length}
          </span>
        </button>

        {/* ── Expanded List Panel ── */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: -8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: -8 }}
              transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
              className="absolute left-0 top-14 w-72 max-h-[400px] overflow-hidden rounded-2xl border border-border/60 bg-card shadow-2xl backdrop-blur-xl"
            >
              {/* Panel header */}
              <div className="flex items-center justify-between border-b border-border px-3 py-2.5">
                <p className="text-xs font-semibold text-foreground">
                  Saved Videos ({savedVideos.length})
                </p>
                <button
                  onClick={() => setIsExpanded(false)}
                  className="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                >
                  <ChevronDown className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* Video list */}
              <div className="max-h-[340px] overflow-y-auto p-2 space-y-2">
                {savedVideos.map((video) => (
                  <div
                    key={video.id}
                    className={`group relative flex items-start gap-2.5 rounded-xl border p-2 transition-colors ${
                      activeVideoId === video.videoId
                        ? "border-red-400/50 bg-red-500/5"
                        : "border-border/50 bg-background hover:bg-muted/60"
                    }`}
                  >
                    {/* Thumbnail */}
                    <button
                      onClick={() => playVideo(video.videoId)}
                      className="relative shrink-0 overflow-hidden rounded-lg"
                    >
                      <img
                        src={video.thumbnailUrl}
                        alt={video.title}
                        className="h-[50px] w-[88px] object-cover"
                      />
                      <div className="absolute inset-0 flex items-center justify-center bg-black/25 transition-colors group-hover:bg-black/35">
                        <PlayCircle className="h-6 w-6 text-white drop-shadow" />
                      </div>
                    </button>

                    {/* Info */}
                    <div className="min-w-0 flex-1 pt-0.5">
                      <button
                        onClick={() => playVideo(video.videoId)}
                        className="text-left w-full"
                      >
                        <p className="line-clamp-2 text-xs font-semibold text-foreground leading-snug">
                          {video.title}
                        </p>
                        {video.channelTitle && (
                          <p className="mt-0.5 text-[10px] text-muted-foreground truncate">
                            {video.channelTitle}
                            {video.duration && ` \u2022 ${video.duration}`}
                          </p>
                        )}
                      </button>
                    </div>

                    {/* Remove button */}
                    <button
                      onClick={() => {
                        if (activeVideoId === video.videoId) closePlayer();
                        onRemoveVideo(video.videoId);
                      }}
                      className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-muted border border-border text-muted-foreground opacity-0 group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive transition-all"
                      title="Remove video"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Draggable Player ── */}
      <AnimatePresence>
        {isPlayerOpen && activeVideo && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="fixed z-[60] select-none"
            style={{ left: playerPosition.x, top: playerPosition.y }}
          >
            <div className="w-[480px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-border/60 bg-card shadow-2xl">
              {/* Drag handle */}
              <div
                onPointerDown={onPlayerPointerDown}
                onPointerMove={onPlayerPointerMove}
                onPointerUp={onPlayerPointerUp}
                className={`flex items-center justify-between border-b border-border bg-muted/50 px-3 py-1.5 ${
                  isPlayerDragging ? "cursor-grabbing" : "cursor-grab"
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <GripHorizontal className="h-4 w-4 shrink-0 text-muted-foreground/60" />
                  <p className="text-xs font-medium text-foreground truncate">
                    {activeVideo.title}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0 ml-2">
                  <button
                    onClick={closePlayer}
                    className="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                    title="Minimize"
                  >
                    <Minimize2 className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={closePlayer}
                    className="rounded-lg p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                    title="Close"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              {/* YouTube iframe */}
              <div className="relative w-full" style={{ paddingBottom: "56.25%" }}>
                {/* Drag overlay to prevent iframe from capturing pointer events */}
                {isPlayerDragging && (
                  <div className="absolute inset-0 z-10" />
                )}
                <iframe
                  className="absolute inset-0 h-full w-full"
                  src={`https://www.youtube.com/embed/${activeVideo.videoId}?autoplay=1&rel=0&modestbranding=1`}
                  title={activeVideo.title}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default VideoBar;
