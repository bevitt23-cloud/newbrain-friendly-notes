import { useState, useRef, useCallback, useEffect } from "react";
import { X, Minimize2, Maximize2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface FloatingImageViewerProps {
  src: string;
  alt: string;
  onClose: () => void;
}

/**
 * Picture-in-Picture style floating image viewer.
 * Draggable, resizable, and doesn't impede note reading.
 */
const FloatingImageViewer = ({ src, alt, onClose }: FloatingImageViewerProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [position, setPosition] = useState({ x: 20, y: 20 });
  const dragRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const posStart = useRef({ x: 0, y: 0 });

  // Collapse/expand dimensions
  const collapsedSize = { width: 320, height: 240 };
  const expandedSize = { width: Math.min(window.innerWidth - 40, 800), height: Math.min(window.innerHeight - 40, 600) };
  const size = isExpanded ? expandedSize : collapsedSize;

  // ── Drag handling ──
  const onMouseDown = useCallback((e: React.MouseEvent) => {
    // Only drag from the header bar
    if (!(e.target as HTMLElement).closest(".pip-header")) return;
    e.preventDefault();
    isDragging.current = true;
    dragStart.current = { x: e.clientX, y: e.clientY };
    posStart.current = { ...position };
  }, [position]);

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      const dx = e.clientX - dragStart.current.x;
      const dy = e.clientY - dragStart.current.y;
      setPosition({
        x: Math.max(0, Math.min(window.innerWidth - size.width, posStart.current.x + dx)),
        y: Math.max(0, Math.min(window.innerHeight - size.height, posStart.current.y + dy)),
      });
    };

    const onMouseUp = () => {
      isDragging.current = false;
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [size.width, size.height]);

  // ── Touch drag handling ──
  const onTouchStart = useCallback((e: React.TouchEvent) => {
    if (!(e.target as HTMLElement).closest(".pip-header")) return;
    const touch = e.touches[0];
    isDragging.current = true;
    dragStart.current = { x: touch.clientX, y: touch.clientY };
    posStart.current = { ...position };
  }, [position]);

  useEffect(() => {
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

    const onTouchEnd = () => {
      isDragging.current = false;
    };

    window.addEventListener("touchmove", onTouchMove, { passive: true });
    window.addEventListener("touchend", onTouchEnd);
    return () => {
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
    };
  }, [size.width, size.height]);

  // Close on Escape
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

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
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground/70 transition-colors hover:bg-muted hover:text-foreground"
              title={isExpanded ? "Minimize" : "Maximize"}
            >
              {isExpanded ? (
                <Minimize2 className="h-3.5 w-3.5" />
              ) : (
                <Maximize2 className="h-3.5 w-3.5" />
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
