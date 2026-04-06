import { Star, Eye, Trash2, FolderInput, Square, CheckSquare } from "lucide-react";
import { DEFAULT_FOLDER } from "@/lib/constants";

/** Card color tints based on learning mode */
const MODE_COLORS: Record<string, { bg: string; border: string; badge: string }> = {
  adhd: {
    bg: "bg-sky-50/70 dark:bg-sky-500/8",
    border: "border-sky-200/50 dark:border-sky-500/20",
    badge: "bg-sky-100 text-sky-600 dark:bg-sky-500/15 dark:text-sky-300",
  },
  dyslexia: {
    bg: "bg-lavender-50/70 dark:bg-lavender-500/8",
    border: "border-lavender-200/50 dark:border-lavender-500/20",
    badge: "bg-lavender-100 text-lavender-600 dark:bg-lavender-500/15 dark:text-lavender-300",
  },
  default: {
    bg: "bg-sage-50/70 dark:bg-sage-500/8",
    border: "border-sage-200/50 dark:border-sage-500/20",
    badge: "bg-sage-100 text-sage-600 dark:bg-sage-500/15 dark:text-sage-300",
  },
};

function getCardColors(mode: string | null) {
  if (mode && MODE_COLORS[mode]) return MODE_COLORS[mode];
  return MODE_COLORS.default;
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s{2,}/g, " ").trim();
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export interface NoteCardNote {
  id: string;
  title: string;
  content: string | null;
  folder: string;
  tags: string[] | null;
  learning_mode: string | null;
  is_favorite: boolean | null;
  updated_at: string;
}

interface NoteCardProps {
  note: NoteCardNote;
  viewMode: "grid" | "list";
  onView: (id: string) => void;
  onFavorite: (id: string) => void;
  onDelete: (id: string) => void;
  onMove: (id: string, folder: string) => void;
  selectMode: boolean;
  selected: boolean;
  onToggleSelect: (id: string) => void;
  folders: string[];
}

const NoteCard = ({
  note,
  viewMode,
  onView,
  onFavorite,
  onDelete,
  selectMode,
  selected,
  onToggleSelect,
}: NoteCardProps) => {
  const colors = getCardColors(note.learning_mode);
  const preview = note.content ? stripHtml(note.content).slice(0, 140) : "";
  const isFav = note.is_favorite ?? false;

  // ── List view ──
  if (viewMode === "list") {
    return (
      <div
        className={`group flex items-center gap-3 rounded-xl border px-4 py-3 cursor-pointer transition-all duration-150 hover:shadow-sm ${colors.border} ${
          selected ? "ring-2 ring-primary/30 bg-primary/5" : `${colors.bg} hover:bg-card`
        }`}
        onClick={() => (selectMode ? onToggleSelect(note.id) : onView(note.id))}
      >
        {selectMode && (
          <button onClick={(e) => { e.stopPropagation(); onToggleSelect(note.id); }} className="shrink-0">
            {selected ? (
              <CheckSquare className="h-4 w-4 text-primary" />
            ) : (
              <Square className="h-4 w-4 text-muted-foreground/40" />
            )}
          </button>
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm text-foreground truncate">{note.title}</span>
            {note.folder !== DEFAULT_FOLDER && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground shrink-0">
                {note.folder}
              </span>
            )}
          </div>
          {note.tags && note.tags.length > 0 && (
            <div className="flex gap-1 mt-0.5">
              {note.tags.slice(0, 3).map((tag) => (
                <span key={tag} className="text-[10px] text-muted-foreground/60">#{tag}</span>
              ))}
            </div>
          )}
        </div>

        <span className="text-[11px] text-muted-foreground/50 shrink-0">{formatDate(note.updated_at)}</span>

        <button
          onClick={(e) => { e.stopPropagation(); onFavorite(note.id); }}
          className="shrink-0"
        >
          <Star className={`h-3.5 w-3.5 transition-colors ${isFav ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30 hover:text-amber-400"}`} />
        </button>
      </div>
    );
  }

  // ── Grid view (Google Keep style) ──
  return (
    <div
      className={`group relative flex flex-col rounded-2xl border p-4 cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg ${colors.border} ${
        selected ? "ring-2 ring-primary/30 bg-primary/5" : `${colors.bg}`
      }`}
      onClick={() => (selectMode ? onToggleSelect(note.id) : onView(note.id))}
    >
      {/* Select checkbox */}
      {selectMode && (
        <button
          onClick={(e) => { e.stopPropagation(); onToggleSelect(note.id); }}
          className="absolute top-3 left-3 z-10"
        >
          {selected ? (
            <CheckSquare className="h-5 w-5 text-primary" />
          ) : (
            <Square className="h-5 w-5 text-muted-foreground/30" />
          )}
        </button>
      )}

      {/* Favorite star — always visible */}
      <button
        onClick={(e) => { e.stopPropagation(); onFavorite(note.id); }}
        className="absolute top-3 right-3 z-10"
      >
        <Star className={`h-4 w-4 transition-colors ${isFav ? "fill-amber-400 text-amber-400" : "text-muted-foreground/25 hover:text-amber-400"}`} />
      </button>

      {/* Title */}
      <h3 className="text-sm font-semibold text-foreground line-clamp-2 pr-6 mb-1.5">
        {note.title}
      </h3>

      {/* Preview */}
      {preview && (
        <p className="text-xs text-muted-foreground/70 line-clamp-3 leading-relaxed mb-3 flex-1">
          {preview}
        </p>
      )}

      {/* Footer: tags + date + actions */}
      <div className="flex items-end justify-between mt-auto pt-2 border-t border-border/30">
        <div className="flex flex-wrap gap-1 flex-1 min-w-0">
          {note.folder !== DEFAULT_FOLDER && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted/80 text-muted-foreground truncate max-w-[100px]">
              {note.folder}
            </span>
          )}
          {note.tags?.slice(0, 2).map((tag) => (
            <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded-full bg-lavender-100/60 text-lavender-600 dark:bg-lavender-500/10 dark:text-lavender-300">
              {tag}
            </span>
          ))}
        </div>
        <span className="text-[10px] text-muted-foreground/40 shrink-0 ml-2">{formatDate(note.updated_at)}</span>
      </div>

      {/* Hover actions */}
      <div className="absolute bottom-3 right-3 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={(e) => { e.stopPropagation(); onView(note.id); }}
          className="flex h-7 w-7 items-center justify-center rounded-lg bg-card/90 shadow-sm border border-border/50 text-muted-foreground hover:text-primary transition-colors"
          title="View"
        >
          <Eye className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(note.id); }}
          className="flex h-7 w-7 items-center justify-center rounded-lg bg-card/90 shadow-sm border border-border/50 text-muted-foreground hover:text-destructive transition-colors"
          title="Delete"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
};

export default NoteCard;
