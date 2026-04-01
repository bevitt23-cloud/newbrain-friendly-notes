import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Lightbulb, StickyNote, Star, Volume2, GripHorizontal, X, Minus, Maximize2, Youtube } from "lucide-react";
import ExplainPanel from "@/components/ExplainPanel";
import { useUserPreferences } from "@/hooks/useUserPreferences";

export interface StickyNoteData {
  id: string;
  text: string;
  note: string;
  position: { x: number; y: number };
  colorIdx: number;
  minimized: boolean;
}

interface TextSelectionMenuProps {
  containerRef: React.RefObject<HTMLDivElement>;
  notesContext?: string;
  stickyNotes?: StickyNoteData[];
  onStickyNotesChange?: (notes: StickyNoteData[]) => void;
  onVideoQuery?: (query: string) => void;
}

const STICKY_COLORS = [
  { name: "Yellow", bg: "bg-yellow-100 dark:bg-yellow-900/40", border: "border-yellow-300 dark:border-yellow-700", dot: "bg-yellow-400", tape: "bg-yellow-200/60 dark:bg-yellow-700/30" },
  { name: "Pink", bg: "bg-pink-100 dark:bg-pink-900/40", border: "border-pink-300 dark:border-pink-700", dot: "bg-pink-400", tape: "bg-pink-200/60 dark:bg-pink-700/30" },
  { name: "Blue", bg: "bg-sky-100 dark:bg-sky-900/40", border: "border-sky-300 dark:border-sky-700", dot: "bg-sky-400", tape: "bg-sky-200/60 dark:bg-sky-700/30" },
  { name: "Green", bg: "bg-green-100 dark:bg-green-900/40", border: "border-green-300 dark:border-green-700", dot: "bg-green-400", tape: "bg-green-200/60 dark:bg-green-700/30" },
  { name: "Orange", bg: "bg-orange-100 dark:bg-orange-900/40", border: "border-orange-300 dark:border-orange-700", dot: "bg-orange-400", tape: "bg-orange-200/60 dark:bg-orange-700/30" },
];

const TextSelectionMenu = ({ containerRef, notesContext, stickyNotes: externalStickyNotes, onStickyNotesChange, onVideoQuery }: TextSelectionMenuProps) => {
  const { preferences } = useUserPreferences();
  const stickyFont = preferences.dyslexia_font
    ? "'OpenDyslexic', sans-serif"
    : preferences.adhd_font
      ? "'Lexend', sans-serif"
      : "'Arial', 'Helvetica Neue', sans-serif";

  const [menuPos, setMenuPos] = useState<{ x: number; y: number } | null>(null);
  const [selectedText, setSelectedText] = useState("");
  const [internalStickyNotes, setInternalStickyNotes] = useState<StickyNoteData[]>([]);
  const stickyNotes = externalStickyNotes ?? internalStickyNotes;
  const setStickyNotes = onStickyNotesChange
    ? (updater: StickyNoteData[] | ((prev: StickyNoteData[]) => StickyNoteData[])) => {
        if (typeof updater === "function") {
          onStickyNotesChange(updater(stickyNotes));
        } else {
          onStickyNotesChange(updater);
        }
      }
    : setInternalStickyNotes;
  const [editingNote, setEditingNote] = useState(false);
  const [noteInput, setNoteInput] = useState("");
  const [noteColorIdx, setNoteColorIdx] = useState(0);
  const [starredTexts, setStarredTexts] = useState<Set<string>>(new Set());
  const [dragging, setDragging] = useState<{ id: string; offsetX: number; offsetY: number } | null>(null);
  const [explainOpen, setExplainOpen] = useState(false);
  const [explainText, setExplainText] = useState("");
  const menuRef = useRef<HTMLDivElement>(null);
  const isPointerSelectingRef = useRef(false);

  const clearSelectionMenu = useCallback(() => {
    if (!editingNote && !explainOpen) {
      setMenuPos(null);
      setSelectedText("");
    }
  }, [editingNote, explainOpen]);

  const syncMenuToSelection = useCallback(() => {
    const selection = window.getSelection();

    if (!selection || selection.rangeCount === 0 || selection.isCollapsed || !containerRef.current) {
      clearSelectionMenu();
      return;
    }

    const range = selection.getRangeAt(0);
    if (!containerRef.current.contains(range.commonAncestorContainer)) {
      clearSelectionMenu();
      return;
    }

    const text = selection.toString().trim();
    if (text.length < 2) {
      clearSelectionMenu();
      return;
    }
    setSelectedText(text);

    const rect = range.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) return;

    const containerRect = containerRef.current.getBoundingClientRect();
    const nextPos = {
      x: rect.left + rect.width / 2 - containerRect.left,
      y: rect.top - containerRect.top - 8,
    };

    setMenuPos((prev) => {
      const previousBottom = prev ? prev.y - 12 : null;
      if (
        prev &&
        Math.abs(prev.x - nextPos.x) < 1 &&
        previousBottom !== null &&
        Math.abs(previousBottom - nextPos.y) < 1
      ) {
        return prev;
      }
      return {
        x: nextPos.x,
        y: nextPos.y + 12,
      };
    });
  }, [clearSelectionMenu, containerRef]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handlePointerStart = () => {
      isPointerSelectingRef.current = true;
    };

    const handlePointerEnd = () => {
      if (!isPointerSelectingRef.current) return;
      isPointerSelectingRef.current = false;
      requestAnimationFrame(syncMenuToSelection);
    };

    const handleKeyUp = () => {
      requestAnimationFrame(syncMenuToSelection);
    };

    const handleSelectionChange = () => {
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
        clearSelectionMenu();
      }
    };

    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        const target = e.target as HTMLElement;
        if (target.closest("[data-sticky-note]")) return;
        setMenuPos(null);
        setEditingNote(false);
      }
    };

    container.addEventListener("mousedown", handlePointerStart);
    container.addEventListener("touchstart", handlePointerStart, { passive: true });
    document.addEventListener("mouseup", handlePointerEnd);
    document.addEventListener("touchend", handlePointerEnd);
    document.addEventListener("touchcancel", handlePointerEnd);
    document.addEventListener("keyup", handleKeyUp);
    document.addEventListener("selectionchange", handleSelectionChange);
    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      container.removeEventListener("mousedown", handlePointerStart);
      container.removeEventListener("touchstart", handlePointerStart);
      document.removeEventListener("mouseup", handlePointerEnd);
      document.removeEventListener("touchend", handlePointerEnd);
      document.removeEventListener("touchcancel", handlePointerEnd);
      document.removeEventListener("keyup", handleKeyUp);
      document.removeEventListener("selectionchange", handleSelectionChange);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [clearSelectionMenu, containerRef, syncMenuToSelection]);

  // Draggable sticky notes
  useEffect(() => {
    if (!dragging) return;
    const handleMove = (e: MouseEvent) => {
      setStickyNotes((prev) =>
        prev.map((n) =>
          n.id === dragging.id
            ? { ...n, position: { x: e.clientX - dragging.offsetX, y: e.clientY - dragging.offsetY } }
            : n
        )
      );
    };
    const handleUp = () => setDragging(null);
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
  }, [dragging]);

  const handleExplain = () => {
    setExplainText(selectedText);
    setExplainOpen(true);
    setMenuPos(null);
  };

  const handleStickyNote = () => {
    setEditingNote(true);
    setNoteInput("");
    setNoteColorIdx(stickyNotes.length % STICKY_COLORS.length);
  };

  const saveStickyNote = () => {
    if (!noteInput.trim() || !selectedText) return;
    const newNote: StickyNoteData = {
      id: Date.now().toString(),
      text: selectedText,
      note: noteInput.trim(),
      position: { x: window.innerWidth - 230 - Math.round(Math.random() * 20), y: 100 + stickyNotes.length * 36 },
      colorIdx: noteColorIdx,
      minimized: false,
    };
    setStickyNotes((prev) => [...prev, newNote]);
    setEditingNote(false);
    setNoteInput("");
    setMenuPos(null);
  };

  const toggleMinimize = (id: string) => {
    setStickyNotes((prev) =>
      prev.map((n) => (n.id === id ? { ...n, minimized: !n.minimized } : n))
    );
  };

  const handleStar = () => {
    setStarredTexts((prev) => {
      const next = new Set(prev);
      if (next.has(selectedText)) next.delete(selectedText);
      else next.add(selectedText);
      return next;
    });
  };

  const handlePronounce = () => {
    if (!selectedText) return;
    const utterance = new SpeechSynthesisUtterance(selectedText);
    utterance.rate = 0.9;
    speechSynthesis.speak(utterance);
  };

  const handleFindVideo = () => {
    if (!selectedText || !onVideoQuery) return;
    onVideoQuery(selectedText);
    setMenuPos(null);
  };

  const isStarred = starredTexts.has(selectedText);

  return (
    <>
      {/* Floating draggable sticky notes */}
      {stickyNotes.map((note) => {
        const colors = STICKY_COLORS[note.colorIdx] || STICKY_COLORS[0];
        return (
          <div
            key={note.id}
            data-sticky-note
            className={`fixed z-[60] select-none ${note.minimized ? "w-36" : "w-52"} rounded-sm ${colors.bg} ${colors.border} border shadow-lg transition-all`}
            style={{
              left: note.position.x,
              top: note.position.y,
              transform: `rotate(${(Number(note.id) % 7) - 3}deg)`,
              fontFamily: stickyFont,
            }}
          >
            {/* Tape effect */}
            <div className={`absolute -top-2 left-1/2 h-4 w-12 -translate-x-1/2 rounded-sm ${colors.tape}`} />
            {/* Drag handle + controls */}
            <div
              className="flex cursor-grab items-center justify-between border-b border-inherit px-2 py-1 active:cursor-grabbing"
              onMouseDown={(e) => {
                e.preventDefault();
                setDragging({
                  id: note.id,
                  offsetX: e.clientX - note.position.x,
                  offsetY: e.clientY - note.position.y,
                });
              }}
            >
              <GripHorizontal className="h-3 w-3 opacity-40" />
              <div className="flex items-center gap-0.5">
                <button
                  onClick={() => toggleMinimize(note.id)}
                  className="rounded-full p-0.5 opacity-40 transition-opacity hover:opacity-100"
                >
                  {note.minimized ? <Maximize2 className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
                </button>
                <button
                  onClick={() => setStickyNotes((prev) => prev.filter((n) => n.id !== note.id))}
                  className="rounded-full p-0.5 opacity-40 transition-opacity hover:opacity-100"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            </div>
            {note.minimized ? (
              <div className="px-2 py-1.5">
                <p className="text-[10px] font-medium uppercase tracking-wider opacity-60 truncate">
                  {note.text.slice(0, 20)}…
                </p>
              </div>
            ) : (
              <div className="p-3">
                <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wider opacity-50">
                  Re: "{note.text.slice(0, 30)}{note.text.length > 30 ? "…" : ""}"
                </p>
                <p className="text-sm leading-snug text-foreground">{note.note}</p>
              </div>
            )}
          </div>
        );
      })}

      {/* Selection menu */}
      <AnimatePresence>
        {menuPos && (
          <motion.div
            ref={menuRef}
            initial={{ opacity: 0, y: 4, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute z-50 select-none"
            style={{
              left: menuPos.x,
              top: menuPos.y,
              transform: "translate(-50%, 0)",
            }}
          >
            <div className="rounded-xl border border-border bg-card shadow-lg shadow-black/10">
              {/* Action buttons */}
              <div className="flex items-center gap-0.5 p-1">
                <button
                  onClick={handleExplain}
                  className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-sage-100 dark:hover:bg-sage-700/20"
                  title="Explain This"
                >
                  <Lightbulb className="h-3.5 w-3.5 text-primary" />
                  Explain
                </button>
                {onVideoQuery && (
                  <>
                    <div className="h-4 w-px bg-border" />
                    <button
                      onClick={handleFindVideo}
                      className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-red-100 dark:hover:bg-red-500/10"
                      title="Find Video"
                    >
                      <Youtube className="h-3.5 w-3.5 text-red-500" />
                      Find Video
                    </button>
                  </>
                )}
                <div className="h-4 w-px bg-border" />
                <button
                  onClick={handleStickyNote}
                  className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-peach-100 dark:hover:bg-peach-500/10"
                  title="Add Sticky Note"
                >
                  <StickyNote className="h-3.5 w-3.5 text-peach-500" />
                  Note
                </button>
                <div className="h-4 w-px bg-border" />
                <button
                  onClick={handleStar}
                  className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-lavender-100 dark:hover:bg-lavender-500/10"
                  title="Star This"
                >
                  <Star className={`h-3.5 w-3.5 ${isStarred ? "fill-lavender-400 text-lavender-500" : "text-lavender-400"}`} />
                  Star
                </button>
                <div className="h-4 w-px bg-border" />
                <button
                  onClick={handlePronounce}
                  className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-sky-100 dark:hover:bg-sky-300/10"
                  title="Hear Pronunciation"
                >
                  <Volume2 className="h-3.5 w-3.5 text-sky-300" />
                  Hear
                </button>
              </div>

              {/* Sticky note creation with color picker */}
              {editingNote && (
                <div className="border-t border-border p-3" style={{ maxWidth: 320 }}>
                  {/* Color picker */}
                  <div className="flex items-center gap-1.5 mb-2">
                    <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Color:</span>
                    {STICKY_COLORS.map((c, i) => (
                      <button
                        key={i}
                        onClick={() => setNoteColorIdx(i)}
                        className={`h-5 w-5 rounded-full ${c.dot} transition-all ${
                          noteColorIdx === i ? "ring-2 ring-offset-1 ring-foreground/30 scale-110" : "opacity-60 hover:opacity-100"
                        }`}
                        title={c.name}
                      />
                    ))}
                  </div>
                  <textarea
                    id="selection-sticky-note"
                    name="selectionStickyNote"
                    value={noteInput}
                    onChange={(e) => setNoteInput(e.target.value)}
                    placeholder="Add your note..."
                    className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring select-text"
                    rows={2}
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        saveStickyNote();
                      }
                    }}
                  />
                  <div className="mt-2 flex justify-end gap-2">
                    <button
                      onClick={() => setEditingNote(false)}
                      className="rounded-md px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={saveStickyNote}
                      className="rounded-md bg-primary px-2.5 py-1 text-xs text-primary-foreground"
                    >
                      Save
                    </button>
                  </div>
                </div>
              )}

              {/* Arrow */}
              <div className="absolute bottom-full left-1/2 translate-x-[-50%]">
                <div className="h-2 w-2 translate-y-1 rotate-45 border-l border-t border-border bg-card" />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Explain bottom sheet */}
      <ExplainPanel
        selectedText={explainText}
        notesContext={notesContext}
        open={explainOpen}
        onClose={() => setExplainOpen(false)}
      />
    </>
  );
};

export default TextSelectionMenu;
