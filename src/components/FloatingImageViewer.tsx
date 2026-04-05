import { useState, useRef, useCallback, useEffect } from "react";
import { X, Minimize2, Maximize2, Expand } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface FloatingImageViewerProps {
  src: string;
  alt: string;
  onClose: () => void;
}

type ViewMode = "pip" | "expanded" | "fullscreen";

/**
 * Image viewer with 3 modes:
 * - PIP: small draggable floating panel (320x240)
 * - Expanded: large draggable panel (90vw x 80vh)
 * - Fullscreen: modal overlay with scroll-to-zoom
 */
const FloatingImageViewer = ({ src, alt, onClose }: FloatingImageViewerProps) => {
  const [mode, setMode] = useState<ViewMode>("expanded");
  const [position, setPosition] = useState({ x: 20, y: 20 });
  const [zoom, setZoom] = useState(1);
  const dragRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const posStart = useRef({ x: 0, y: 0 });

  const sizes: Record<Exclude<ViewMode, "fullscreen">, { width: number; height: number }> = {
    pip: { width: 360, height: 270 },
    expanded: {
      width: Math.min(window.innerWidth - 40, 1200),
      height: Math.min(window.innerHeight - 40, 900),
    },
  };

  // ── Drag handling (PIP + expanded only) ──
  const onMouseDown = useCallback((e: React.MouseEvent) => {
    if (mode === "fullscreen") return;
    if (!(e.target as HTMLElement).closest(".pip-header")) return;
    e.preventDefault();
    isDragging.current = true;
    dragStart.current = { x: e.clientX, y: e.clientY };
    posStart.current = { ...position };
  }, [position, mode]);

  useEffect(() => {
    const size = mode === "fullscreen" ? { width: 0, height: 0 } : sizes[mode];
    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      const dx = e.clientX - dragStart.current.x;
      const dy = e.clientY - dragStart.current.y;
      setPosition({
        x: Math.max(0, Math.min(window.innerWidth - size.width, posStart.current.x + dx)),
        y: Math.max(0, Math.min(window.innerHeight - size.height, posStart.current.y + dy)),
      });
    };
    const onMouseUp = () => { isDragging.current = false; };
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [mode]);

  // ── Touch drag ──
  const onTouchStart = useCallback((e: React.TouchEvent) => {
    if (mode === "fullscreen") return;
    if (!(e.target as HTMLElement).closest(".pip-header")) return;
    const touch = e.touches[0];
    isDragging.current = true;
    dragStart.current = { x: touch.clientX, y: touch.clientY };
    posStart.current = { ...position };
  }, [position, mode]);

  useEffect(() => {
    const size = mode === "fullscreen" ? { width: 0, height: 0 } : sizes[mode];
    const onTouchMove = (e: TouchEvent) => {
      if (!isDragging.current) return;
      const touch = e.touches[0];
      const dx = touch.clientX - dragStart.current.x;
      const dy = touch.clientY - dragStart.current.y;
      setPosition({
        x: Math.max(0, Math.min(window.innerWidth - size.width, posStart.current.x + dx)),
        y: Math.max(0, Math.min(window.innerHeight - size.height, posStart.current.y + dy)),
      });
    };
    const onTouchEnd = () => { isDragging.current = false; };
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    window.addEventListener("touchend", onTouchEnd);
    return () => {
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
    };
  }, [mode]);

  // Close on Escape
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (mode === "fullscreen") {
          setMode("expanded");
          setZoom(1);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, mode]);

  // Scroll-to-zoom in fullscreen
  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (mode !== "fullscreen") return;
    e.preventDefault();
    setZoom((prev) => Math.min(5, Math.max(0.5, prev - e.deltaY * 0.001)));
  }, [mode]);

  const cycleMode = useCallback(() => {
    if (mode === "pip") setMode("expanded");
    else if (mode === "expanded") { setMode("fullscreen"); setZoom(1); }
    else { setMode("expanded"); setZoom(1); }
  }, [mode]);

  const shrink = useCallback(() => {
    if (mode === "fullscreen") { setMode("expanded"); setZoom(1); }
    else if (mode === "expanded") setMode("pip");
  }, [mode]);

  // ── Fullscreen modal ──
  if (mode === "fullscreen") {
    return (
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[70] flex flex-col bg-black/90 backdrop-blur-sm"
        >
          {/* Header */}
          <div className="flex h-11 items-center justify-between px-4 bg-black/50">
            <span className="truncate text-xs font-medium text-white/70">{alt || "Image"}</span>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-white/40">{Math.round(zoom * 100)}%</span>
              <button
                onClick={shrink}
                className="flex h-7 w-7 items-center justify-center rounded-md text-white/60 hover:bg-white/10 hover:text-white transition-colors"
                title="Exit fullscreen"
              >
                <Minimize2 className="h-4 w-4" />
              </button>
              <button
                onClick={onClose}
                className="flex h-7 w-7 items-center justify-center rounded-md text-white/60 hover:bg-red-500/20 hover:text-red-400 transition-colors"
                title="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Zoomable image area */}
          <div
            className="flex-1 overflow-auto flex items-center justify-center cursor-zoom-in"
            onWheel={handleWheel}
          >
            <img
              src={src}
              alt={alt}
              className="transition-transform duration-100"
              style={{ transform: `scale(${zoom})`, transformOrigin: "center center" }}
              draggable={false}
            />
          </div>

          <div className="flex h-8 items-center justify-center bg-black/50">
            <span className="text-[10px] text-white/40">Scroll to zoom &middot; Esc to exit fullscreen</span>
          </div>
        </motion.div>
      </AnimatePresence>
    );
  }

  // ── PIP / Expanded floating panel ──
  const size = sizes[mode];

  return (
    <AnimatePresence>
      <motion.div
        ref={dragRef}
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.8 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        className="fixed z-[60] overflow-hidden rounded-2xl border border-border/60 bg-card shadow-2xl"
        style={{
          left: position.x,
          top: position.y,
          width: size.width,
          height: size.height,
        }}
        onMouseDown={onMouseDown}
        onTouchStart={onTouchStart}
      >
        {/* Header bar — draggable handle */}
        <div className="pip-header flex h-9 cursor-grab items-center justify-between bg-muted/80 px-3 backdrop-blur-sm active:cursor-grabbing select-none">
          <span className="truncate text-[11px] font-medium text-muted-foreground">
            {alt || "Image"}
          </span>
          <div className="flex items-center gap-1">
            {mode === "expanded" && (
              <button
                onClick={shrink}
                className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground/70 transition-colors hover:bg-muted hover:text-foreground"
                title="Minimize"
              >
                <Minimize2 className="h-3.5 w-3.5" />
              </button>
            )}
            <button
              onClick={cycleMode}
              className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground/70 transition-colors hover:bg-muted hover:text-foreground"
              title={mode === "pip" ? "Expand" : "Fullscreen"}
            >
              {mode === "pip" ? (
                <Maximize2 className="h-3.5 w-3.5" />
              ) : (
                <Expand className="h-3.5 w-3.5" />
              )}
            </button>
            <button
              onClick={onClose}
              className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground/70 transition-colors hover:bg-destructive/10 hover:text-destructive"
              title="Close"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Image content */}
        <div className="flex h-[calc(100%-2.25rem)] items-center justify-center overflow-auto bg-black/5 dark:bg-black/20 p-2">
          <img
            src={src}
            alt={alt}
            className="max-h-full max-w-full rounded-lg object-contain"
            draggable={false}
          />
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default FloatingImageViewer;
