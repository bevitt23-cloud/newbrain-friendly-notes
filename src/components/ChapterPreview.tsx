import { useState } from "react";
import { BookOpen, Check, ChevronsUpDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import type { DetectedChapter, ChapterDetectionResult } from "@/lib/chapterDetection";
import { formatChapterSummary } from "@/lib/chapterDetection";

interface ChapterPreviewProps {
  detection: ChapterDetectionResult;
  selectedIndices: Set<number>;
  onSelectionChange: (indices: Set<number>) => void;
  bookTitle: string;
  onBookTitleChange: (title: string) => void;
  parentFolder: string;
}

const ChapterPreview = ({
  detection,
  selectedIndices,
  onSelectionChange,
  bookTitle,
  onBookTitleChange,
  parentFolder,
}: ChapterPreviewProps) => {
  const { chapters } = detection;
  const allSelected = chapters.every((_, i) => selectedIndices.has(i));

  const toggleAll = () => {
    if (allSelected) {
      onSelectionChange(new Set());
    } else {
      onSelectionChange(new Set(chapters.map((_, i) => i)));
    }
  };

  const toggleOne = (index: number) => {
    const next = new Set(selectedIndices);
    if (next.has(index)) {
      next.delete(index);
    } else {
      next.add(index);
    }
    onSelectionChange(next);
  };

  const selectedCount = selectedIndices.size;

  return (
    <div className="rounded-xl border border-lavender-200 bg-gradient-to-b from-lavender-50/60 to-card p-4 dark:border-lavender-400/20 dark:from-lavender-500/5">
      {/* Header */}
      <div className="mb-3 flex items-center gap-2.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-lavender-100 dark:bg-lavender-500/20">
          <BookOpen className="h-4 w-4 text-lavender-500" />
        </div>
        <div>
          <p className="text-sm font-bold text-foreground">
            {chapters.length} chapters detected
          </p>
          <p className="text-xs text-muted-foreground">
            {detection.sourceFileName}
          </p>
        </div>
      </div>

      {/* Book title input */}
      <div className="mb-3">
        <label className="mb-1 block text-xs font-medium text-muted-foreground">
          Book / Document Title
        </label>
        <Input
          value={bookTitle}
          onChange={(e) => onBookTitleChange(e.target.value)}
          placeholder="Enter book title..."
          className="h-8 text-sm"
        />
        <p className="mt-1 text-[11px] text-muted-foreground">
          Notes will save to:{" "}
          <span className="font-medium text-foreground">
            {parentFolder}/{bookTitle || "..."}
          </span>
        </p>
      </div>

      {/* Select all */}
      <button
        onClick={toggleAll}
        className="mb-2 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted/50 transition-colors"
      >
        <div
          className={`flex h-4 w-4 items-center justify-center rounded border transition-colors ${
            allSelected
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border"
          }`}
        >
          {allSelected && <Check className="h-3 w-3" />}
        </div>
        {allSelected ? "Deselect all" : "Select all"}
        <span className="ml-auto text-muted-foreground">
          {selectedCount} of {chapters.length}
        </span>
      </button>

      {/* Chapter list */}
      <div className="max-h-52 space-y-1 overflow-y-auto rounded-lg border border-border/40 bg-background/50 p-1.5">
        {chapters.map((chapter, i) => {
          const selected = selectedIndices.has(i);
          return (
            <button
              key={chapter.index}
              onClick={() => toggleOne(i)}
              className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition-all ${
                selected
                  ? "bg-sage-50 ring-1 ring-sage-200/60 dark:bg-sage-500/10 dark:ring-sage-400/20"
                  : "hover:bg-muted/40"
              }`}
            >
              <div
                className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors ${
                  selected
                    ? "border-sage-500 bg-sage-500 text-white"
                    : "border-border"
                }`}
              >
                {selected && <Check className="h-3 w-3" />}
              </div>
              <span className={`flex-1 truncate ${selected ? "text-foreground" : "text-muted-foreground"}`}>
                {formatChapterSummary(chapter)}
              </span>
            </button>
          );
        })}
      </div>

      {selectedCount > 0 && (
        <p className="mt-2 text-xs text-muted-foreground">
          First chapter displays on this page. {selectedCount > 1 ? `${selectedCount - 1} more will generate in the background and save to your Library.` : ""}
        </p>
      )}
    </div>
  );
};

export default ChapterPreview;
