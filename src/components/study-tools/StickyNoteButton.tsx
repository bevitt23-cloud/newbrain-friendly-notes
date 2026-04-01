import { useState } from "react";
import { StickyNote, GripHorizontal, X, Minus, Maximize2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface StickyNoteData {
  id: string;
  note: string;
  position: { x: number; y: number };
  colorIdx: number;
  minimized: boolean;
}

const STICKY_COLORS = [
  { name: "Yellow", bg: "bg-yellow-100 dark:bg-yellow-900/40", border: "border-yellow-300 dark:border-yellow-700", dot: "bg-yellow-400", tape: "bg-yellow-200/60 dark:bg-yellow-700/30" },
  { name: "Pink", bg: "bg-pink-100 dark:bg-pink-900/40", border: "border-pink-300 dark:border-pink-700", dot: "bg-pink-400", tape: "bg-pink-200/60 dark:bg-pink-700/30" },
  { name: "Blue", bg: "bg-sky-100 dark:bg-sky-900/40", border: "border-sky-300 dark:border-sky-700", dot: "bg-sky-400", tape: "bg-sky-200/60 dark:bg-sky-700/30" },
  { name: "Green", bg: "bg-green-100 dark:bg-green-900/40", border: "border-green-300 dark:border-green-700", dot: "bg-green-400", tape: "bg-green-200/60 dark:bg-green-700/30" },
  { name: "Orange", bg: "bg-orange-100 dark:bg-orange-900/40", border: "border-orange-300 dark:border-orange-700", dot: "bg-orange-400", tape: "bg-orange-200/60 dark:bg-orange-700/30" },
];

export default function StickyNoteButton() {
  const [notes, setNotes] = useState<StickyNoteData[]>([]);
  const [editing, setEditing] = useState(false);
  const [noteInput, setNoteInput] = useState("");
  const [colorIdx, setColorIdx] = useState(0);
  const [dragging, setDragging] = useState<{ id: string; offsetX: number; offsetY: number } | null>(null);

  // Drag handling
  const handleMouseMove = (e: MouseEvent) => {
    if (!dragging) return;
    setNotes((prev) =>
      prev.map((n) =>
        n.id === dragging.id
          ? { ...n, position: { x: e.clientX - dragging.offsetX, y: e.clientY - dragging.offsetY } }
          : n
      )
    );
  };

  const handleMouseUp = () => setDragging(null);

  // Attach drag listeners
  if (dragging) {
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  }

  const saveNote = () => {
    if (!noteInput.trim()) return;
    setNotes((prev) => [
      ...prev,
      {
        id: Date.now().toString(),
        note: noteInput.trim(),
        position: { x: window.innerWidth / 2 - 100 + Math.random() * 60, y: 120 + prev.length * 30 },
        colorIdx,
        minimized: false,
      },
    ]);
    setNoteInput("");
    setEditing(false);
  };

  return (
    <>
      {/* Trigger button */}
      <button
        onClick={() => { setEditing(!editing); setColorIdx(notes.length % STICKY_COLORS.length); }}
        className="flex items-center gap-1.5 rounded-xl border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-muted transition-colors"
        title="Add Sticky Note"
      >
        <StickyNote className="h-3.5 w-3.5 text-peach-500" />
        Sticky Note
      </button>

      {/* Inline creation form */}
      <AnimatePresence>
        {editing && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="rounded-xl border border-border bg-card p-3 mt-2 space-y-2">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Color:</span>
                {STICKY_COLORS.map((c, i) => (
                  <button
                    key={i}
                    onClick={() => setColorIdx(i)}
                    className={`h-5 w-5 rounded-full ${c.dot} transition-all ${
                      colorIdx === i ? "ring-2 ring-offset-1 ring-foreground/30 scale-110" : "opacity-60 hover:opacity-100"
                    }`}
                  />
                ))}
              </div>
              <textarea
                id="sticky-note-input"
                name="stickyNoteInput"
                value={noteInput}
                onChange={(e) => setNoteInput(e.target.value)}
                placeholder="Write your note..."
                className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                rows={2}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); saveNote(); }
                }}
              />
              <div className="flex justify-end gap-2">
                <button onClick={() => setEditing(false)} className="rounded-md px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground">Cancel</button>
                <button onClick={saveNote} className="rounded-md bg-primary px-2.5 py-1 text-xs text-primary-foreground">Save</button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating sticky notes */}
      {notes.map((note) => {
        const colors = STICKY_COLORS[note.colorIdx] || STICKY_COLORS[0];
        return (
          <div
            key={note.id}
            data-sticky-note
            className={`fixed z-[60] ${note.minimized ? "w-36" : "w-52"} rounded-sm ${colors.bg} ${colors.border} border shadow-lg transition-all`}
            style={{
              left: note.position.x,
              top: note.position.y,
              transform: `rotate(${(Number(note.id) % 7) - 3}deg)`,
              fontFamily: "'Caveat', 'Comic Sans MS', cursive",
            }}
          >
            <div className={`absolute -top-2 left-1/2 h-4 w-12 -translate-x-1/2 rounded-sm ${colors.tape}`} />
            <div
              className="flex cursor-grab items-center justify-between border-b border-inherit px-2 py-1 active:cursor-grabbing"
              onMouseDown={(e) => {
                e.preventDefault();
                setDragging({ id: note.id, offsetX: e.clientX - note.position.x, offsetY: e.clientY - note.position.y });
              }}
            >
              <GripHorizontal className="h-3 w-3 opacity-40" />
              <div className="flex items-center gap-0.5">
                <button
                  onClick={() => setNotes((prev) => prev.map((n) => n.id === note.id ? { ...n, minimized: !n.minimized } : n))}
                  className="rounded-full p-0.5 opacity-40 transition-opacity hover:opacity-100"
                >
                  {note.minimized ? <Maximize2 className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
                </button>
                <button
                  onClick={() => setNotes((prev) => prev.filter((n) => n.id !== note.id))}
                  className="rounded-full p-0.5 opacity-40 transition-opacity hover:opacity-100"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            </div>
            {note.minimized ? (
              <div className="px-2 py-1.5">
                <p className="text-[10px] font-medium uppercase tracking-wider opacity-60 truncate">{note.note.slice(0, 20)}…</p>
              </div>
            ) : (
              <div className="p-3">
                <p className="text-sm leading-snug text-foreground">{note.note}</p>
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}
