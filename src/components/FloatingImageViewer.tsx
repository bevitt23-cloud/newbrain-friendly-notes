import { useState, useRef, useCallback, useEffect } from "react";
import { X, Minimize2, Maximize2, Expand, StickyNote } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface FloatingImageViewerProps {
  src: string;
  alt: string;
  onClose: () => void;
  onSaveToSticky?: (src: string, alt: string) => void;
}

type ViewMode = "pip" | "expanded" | "fullscreen";

/**
 * Image viewer with 3 modes:
 * - PIP: small draggable panel (~320x240)
 * - Expanded: medium draggable panel with resize handles
 * - Fullscreen: modal overlay with scroll-to-zoom
 *
 * Features: drag, resize, close, save-to-sticky-note
 */
const FloatingImageViewer = ({ src, alt, onClose, onSaveToSticky }: FloatingImageViewerProps) => {
  const [mode, setMode] = useState<ViewMode>("expanded");
  const [position, setPosition] = useState({ x: Math.max(20, (window.innerWidth - 600) / 2), y: 60 });
  const [panelSize, setPanelSize] = useState({ width: 600, height: 450 });
  const [zoom, setZoom] = useState(1);
  const isDragging = useRef(false);
  const isResizing = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const posStart = useRef({ x: 0, y: 0 });
  const sizeStart = useRef({ width: 0, height: 0 });

  const pipSize = { width: 320, height: 240 };

  // ── Drag handling ──
  const onDragStart = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (mode === "fullscreen") return;
    if (!(e.target as HTMLElement).closest(".pip-header")) return;
    e.preventDefault();
    isDragging.current = true;
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
    dragStart.current = { x: clientX, y: clientY };
    posStart.current = { ...position };
  }, [position, mode]);

  useEffect(() => {
    const onMove = (e: MouseEvent | TouchEvent) => {
      const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
      const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;

      if (isDragging.current) {
        setPosition({
          x: Math.max(0, posStart.current.x + clientX - dragStart.current.x),
          y: Math.max(0, posStart.current.y + clientY - dragStart.current.y),
        });
      }
      if (isResizing.current) {
        const newW = Math.max(280, sizeStart.current.width + clientX - dragStart.current.x);
        const newH = Math.max(200, sizeStart.current.height + clientY - dragStart.current.y);
        setPanelSize({ width: newW, height: newH });
      }
    };
    const onUp = () => {
      isDragging.current = false;
      isResizing.current = false;
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    window.addEventListener("touchmove", onMove, { passive: true });
    window.addEventListener("touchend", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onUp);
    };
  }, []);

  // ── Resize handling ──
  const onResizeStart = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    isResizing.current = true;
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
    dragStart.current = { x: clientX, y: clientY };
    sizeStart.current = { ...panelSize };
  }, [panelSize]);

  // Close on Escape
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (mode === "fullscreen") { setMode("expanded"); setZoom(1); }
        else onClose();
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
          <div className="flex h-11 items-center justify-between px-4 bg-black/50">
            <span className="truncate text-xs font-medium text-white/70">{alt || "Image"}</span>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-white/40">{Math.round(zoom * 100)}%</span>
              {onSaveToSticky && (
                <button
                  onClick={() => onSaveToSticky(src, alt)}
                  className="flex h-7 items-center gap-1 rounded-md px-2 text-[11px] text-white/60 hover:bg-white/10 hover:text-white transition-colors"
                  title="Save to sticky note"
                >
                  <StickyNote className="h-3.5 w-3.5" /> Save
                </button>
              )}
              <button onClick={shrink} className="flex h-7 w-7 items-center justify-center rounded-md text-white/60 hover:bg-white/10 hover:text-white transition-colors" title="Exit fullscreen">
                <Minimize2 className="h-4 w-4" />
              </button>
              <button onClick={onClose} className="flex h-7 w-7 items-center justify-center rounded-md text-white/60 hover:bg-red-500/20 hover:text-red-400 transition-colors" title="Close">
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-auto flex items-center justify-center cursor-zoom-in" onWheel={handleWheel}>
            <img src={src} alt={alt} className="transition-transform duration-100" style={{ transform: `scale(${zoom})`, transformOrigin: "center center" }} draggable={false} />
          </div>
          <div className="flex h-8 items-center justify-center bg-black/50">
            <span className="text-[10px] text-white/40">Scroll to zoom · Esc to exit fullscreen</span>
          </div>
        </motion.div>
      </AnimatePresence>
    );
  }

  // ── PIP / Expanded floating panel ──
  const size = mode === "pip" ? pipSize : panelSize;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.8 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        className="fixed z-[60] overflow-hidden rounded-2xl border border-border/60 bg-card shadow-2xl"
        style={{ left: position.x, top: position.y, width: size.width, height: size.height }}
        onMouseDown={onDragStart}
        onTouchStart={onDragStart}
      >
        {/* Header bar — draggable handle */}
        <div className="pip-header flex h-9 cursor-grab items-center justify-between bg-muted/80 px-3 backdrop-blur-sm active:cursor-grabbing select-none">
          <span className="truncate text-[11px] font-medium text-muted-foreground">{alt || "Image"}</span>
          <div className="flex items-center gap-1">
            {onSaveToSticky && (
              <button
                onClick={() => onSaveToSticky(src, alt)}
                className="flex h-6 items-center gap-1 rounded-md px-1.5 text-[10px] text-muted-foreground/70 transition-colors hover:bg-muted hover:text-foreground"
                title="Save to sticky note"
              >
                <StickyNote className="h-3 w-3" /> Sticky
              </button>
            )}
            {mode === "expanded" && (
              <button onClick={shrink} className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground/70 transition-colors hover:bg-muted hover:text-foreground" title="Minimize">
                <Minimize2 className="h-3.5 w-3.5" />
              </button>
            )}
            <button onClick={cycleMode} className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground/70 transition-colors hover:bg-muted hover:text-foreground" title={mode === "pip" ? "Expand" : "Fullscreen"}>
              {mode === "pip" ? <Maximize2 className="h-3.5 w-3.5" /> : <Expand className="h-3.5 w-3.5" />}
            </button>
            <button onClick={onClose} className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground/70 transition-colors hover:bg-destructive/10 hover:text-destructive" title="Close">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Image content */}
        <div className="flex h-[calc(100%-2.25rem)] items-center justify-center overflow-auto bg-black/5 dark:bg-black/20 p-2">
          <img src={src} alt={alt} className="max-h-full max-w-full rounded-lg object-contain" draggable={false} />
        </div>

        {/* Resize handle (expanded mode only) */}
        {mode === "expanded" && (
          <div
            onMouseDown={onResizeStart}
            onTouchStart={onResizeStart}
            className="absolute bottom-0 right-0 h-5 w-5 cursor-nwse-resize"
            style={{ background: "linear-gradient(135deg, transparent 50%, hsl(var(--muted-foreground) / 0.3) 50%)" }}
          />
        )}
      </motion.div>
    </AnimatePresence>
  );
};

export default FloatingImageViewer;
