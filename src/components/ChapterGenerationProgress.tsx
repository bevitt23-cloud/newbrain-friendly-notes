import { CheckCircle2, XCircle, Loader2, StopCircle, BookOpen, SkipForward } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ChapterGenerationState } from "@/hooks/useChapterGeneration";

interface ChapterGenerationProgressProps {
  chapterStates: ChapterGenerationState[];
  currentIndex: number;
  isRunning: boolean;
  completedCount: number;
  failedCount: number;
  totalCount: number;
  bookTitle: string;
  onStop: () => void;
}

const statusIcon = (status: ChapterGenerationState["status"]) => {
  switch (status) {
    case "complete":
      return <CheckCircle2 className="h-4 w-4 text-sage-500" />;
    case "failed":
      return <XCircle className="h-4 w-4 text-destructive" />;
    case "generating":
      return <Loader2 className="h-4 w-4 animate-spin text-primary" />;
    case "skipped":
      return <SkipForward className="h-4 w-4 text-muted-foreground" />;
    default:
      return <div className="h-4 w-4 rounded-full border-2 border-border" />;
  }
};

const ChapterGenerationProgress = ({
  chapterStates,
  currentIndex,
  isRunning,
  completedCount,
  failedCount,
  totalCount,
  bookTitle,
  onStop,
}: ChapterGenerationProgressProps) => {
  if (totalCount === 0) return null;

  const progressPercent =
    totalCount > 0
      ? Math.round(((completedCount + failedCount) / totalCount) * 100)
      : 0;

  return (
    <div className="mt-6 rounded-2xl border border-border bg-card p-5 shadow-soft">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-lavender-100 dark:bg-lavender-500/20">
            <BookOpen className="h-4 w-4 text-lavender-500" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">
              {isRunning
                ? `Generating chapter ${currentIndex + 1} of ${totalCount}...`
                : `${completedCount} of ${totalCount} chapters complete`}
            </h3>
            <p className="text-xs text-muted-foreground">{bookTitle}</p>
          </div>
        </div>
        {isRunning && (
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 text-xs"
            onClick={onStop}
          >
            <StopCircle className="h-3.5 w-3.5" />
            Stop after current
          </Button>
        )}
      </div>

      {/* Progress bar */}
      <div className="mb-4 h-2 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-gradient-to-r from-sage-400 to-primary transition-all duration-500"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* Chapter list */}
      <div className="space-y-1.5 max-h-48 overflow-y-auto">
        {chapterStates.map((state, i) => (
          <div
            key={state.chapter.index}
            className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${
              i === currentIndex && isRunning
                ? "bg-primary/5 ring-1 ring-primary/20"
                : state.status === "failed"
                  ? "bg-destructive/5"
                  : ""
            }`}
          >
            {statusIcon(state.status)}
            <span
              className={`flex-1 truncate ${
                state.status === "complete"
                  ? "text-muted-foreground"
                  : state.status === "failed"
                    ? "text-destructive"
                    : "text-foreground"
              }`}
            >
              {state.chapter.title}
            </span>
            {state.status === "complete" && (
              <span className="text-xs text-sage-500">Saved</span>
            )}
            {state.status === "failed" && (
              <span className="text-xs text-destructive">{state.error}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default ChapterGenerationProgress;
