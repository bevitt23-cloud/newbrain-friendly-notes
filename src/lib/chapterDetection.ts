/* ═══════════════════════════════════════════════════════════════
   Chapter detection for large documents.

   Strategy: heuristic regex patterns that catch the most common
   textbook/document chapter formats.  Fast, free, runs client-side.

   When heuristics find nothing on a large document (>15 K chars),
   the caller can offer an AI-powered TOC extraction fallback.
   ═══════════════════════════════════════════════════════════════ */

export interface DetectedChapter {
  /** 0-based chapter index */
  index: number;
  /** Cleaned chapter title, e.g. "Chapter 3: Molecular Biology" */
  title: string;
  /** Character offset where this chapter starts in the full text */
  startOffset: number;
  /** Character offset where this chapter ends (exclusive) */
  endOffset: number;
  /** The raw text content of this chapter */
  text: string;
  /** Approximate page number (if page markers are available) */
  startPage?: number;
}

export interface ChapterDetectionResult {
  /** Detected chapters (empty if none found) */
  chapters: DetectedChapter[];
  /** How detection was performed */
  method: "heuristic" | "ai" | "none";
  /** Total characters in the source text */
  totalChars: number;
  /** Original file name */
  sourceFileName: string;
  /** Auto-detected book/document title (best guess) */
  suggestedBookTitle: string;
}

/* ─── Minimum thresholds ─── */

/** Don't attempt chapter detection on small documents */
const MIN_CHARS_FOR_DETECTION = 8_000;

/** Minimum characters per chapter to accept a split (avoid false positives) */
const MIN_CHAPTER_LENGTH = 500;

/** Minimum number of chapters to consider a valid detection */
const MIN_CHAPTERS = 2;

/* ─── Heuristic patterns ─── */

interface PatternDef {
  /** Name for debugging */
  name: string;
  /** Regex applied per-line. Must capture the chapter title in group 1. */
  regex: RegExp;
  /** Minimum matches required to trust this pattern */
  minMatches: number;
}

/**
 * Patterns are tried in priority order. First pattern that produces
 * enough matches wins. This avoids false positives from e.g. body text
 * mentioning "Chapter 1" once in a sentence.
 */
const PATTERNS: PatternDef[] = [
  {
    name: "Chapter N: Title",
    regex: /^(?:CHAPTER|Chapter)\s+(\d+[\s.:\u2014\u2013-]+.+)/m,
    minMatches: 2,
  },
  {
    name: "Chapter N (no title)",
    regex: /^(?:CHAPTER|Chapter)\s+(\d+)\s*$/m,
    minMatches: 2,
  },
  {
    name: "Part N: Title",
    regex: /^(?:PART|Part)\s+(\d+[\s.:\u2014\u2013-]+.+)/m,
    minMatches: 2,
  },
  {
    name: "Unit/Module/Lesson N",
    regex: /^(?:UNIT|Unit|MODULE|Module|LESSON|Lesson)\s+(\d+[\s.:\u2014\u2013-]*.+)/m,
    minMatches: 2,
  },
  {
    name: "Section N.N Title",
    regex: /^(?:SECTION|Section)\s+(\d+(?:\.\d+)?\s*[.:\u2014\u2013-]\s*.+)/m,
    minMatches: 2,
  },
  {
    name: "Numbered heading (1. Title)",
    regex: /^(\d{1,2})\.\s+([A-Z][A-Za-z\s,&:—–-]{4,80})$/m,
    minMatches: 3,
  },
  {
    name: "Roman numeral heading",
    regex: /^((?:X{0,3})(?:IX|IV|V?I{0,3}))\.\s+([A-Z][A-Za-z\s,&:—–-]{4,80})$/m,
    minMatches: 3,
  },
  {
    name: "ALL CAPS heading (≥6 chars, preceded by blank line)",
    regex: /(?:^|\n\n)([A-Z][A-Z\s,&:—–-]{5,80})\s*\n/,
    minMatches: 4,
  },
];

/* ─── Page marker support ─── */

/**
 * If the text contains page markers (inserted by extractTextFromFile),
 * parse them for page number correlation.
 */
const PAGE_MARKER_REGEX = /\[PAGE_BREAK:(\d+)\]/g;

function buildPageIndex(text: string): Map<number, number> {
  const index = new Map<number, number>(); // offset → page number
  let match: RegExpExecArray | null;
  while ((match = PAGE_MARKER_REGEX.exec(text)) !== null) {
    index.set(match.index, parseInt(match[1], 10));
  }
  return index;
}

function getPageForOffset(
  offset: number,
  pageIndex: Map<number, number>
): number | undefined {
  let lastPage: number | undefined;
  for (const [markerOffset, page] of pageIndex) {
    if (markerOffset > offset) break;
    lastPage = page;
  }
  return lastPage;
}

/* ─── Line scanning ─── */

interface RawMatch {
  title: string;
  offset: number;
  lineNumber: number;
}

function scanForPattern(text: string, pattern: PatternDef): RawMatch[] {
  const matches: RawMatch[] = [];
  const lines = text.split("\n");
  let offset = 0;

  for (let lineNum = 0; lineNum < lines.length; lineNum++) {
    const line = lines[lineNum].trim();
    const m = pattern.regex.exec(line);
    if (m) {
      // Build a clean title from captured groups
      let title: string;
      if (m[2]) {
        // Pattern captured number + title separately (e.g. numbered heading)
        title = `${m[1]}. ${m[2].trim()}`;
      } else {
        title = m[1].trim();
      }

      // Clean up trailing punctuation / excessive whitespace
      title = title.replace(/\s+/g, " ").replace(/[.:—–-]+$/, "").trim();

      // Prefix "Chapter" if the title is just a number
      if (/^\d+$/.test(title)) {
        title = `Chapter ${title}`;
      }

      matches.push({
        title,
        offset: offset + (lines[lineNum].indexOf(line.charAt(0)) || 0),
        lineNumber: lineNum + 1,
      });
    }
    offset += lines[lineNum].length + 1; // +1 for the \n
  }

  return matches;
}

/* ─── Title guessing ─── */

/**
 * Guess the book/document title from the first ~2000 chars.
 * Looks for common patterns: title pages, header lines, etc.
 */
function guessBookTitle(text: string, fileName: string): string {
  // Try to find a title in the first 2000 characters
  const head = text.slice(0, 2000);
  const lines = head.split("\n").map((l) => l.trim()).filter(Boolean);

  // First non-trivial line that looks like a title (3-100 chars, starts with a letter)
  for (const line of lines.slice(0, 10)) {
    if (
      line.length >= 3 &&
      line.length <= 100 &&
      /^[A-Za-z]/.test(line) &&
      !/^(copyright|isbn|published|table of contents|contents|preface)/i.test(line) &&
      !/^(chapter|part|unit|section|module|lesson)\s+\d/i.test(line) &&
      !/^by\s+/i.test(line) // skip author lines
    ) {
      return line.replace(/\s+/g, " ");
    }
  }

  // Fallback: derive from filename
  return fileName
    .replace(/\.[^.]+$/, "")            // strip extension
    .replace(/[-_]+/g, " ")             // dashes/underscores → spaces
    .replace(/\s+/g, " ")
    .trim() || "Untitled Document";
}

/* ─── Main detection function ─── */

/**
 * Detect chapters in extracted document text using heuristic patterns.
 *
 * @param text     Full extracted text from the document
 * @param fileName Original file name (for title guessing)
 * @returns        Detection result with chapters array
 */
export function detectChapters(
  text: string,
  fileName: string
): ChapterDetectionResult {
  const totalChars = text.length;
  const suggestedBookTitle = guessBookTitle(text, fileName);

  const noResult: ChapterDetectionResult = {
    chapters: [],
    method: totalChars < MIN_CHARS_FOR_DETECTION ? "none" : "none",
    totalChars,
    sourceFileName: fileName,
    suggestedBookTitle,
  };

  // Skip small documents
  if (totalChars < MIN_CHARS_FOR_DETECTION) {
    return noResult;
  }

  const pageIndex = buildPageIndex(text);

  // Try each pattern in priority order
  for (const pattern of PATTERNS) {
    const rawMatches = scanForPattern(text, pattern);

    if (rawMatches.length < pattern.minMatches) continue;
    if (rawMatches.length < MIN_CHAPTERS) continue;

    // Build chapter objects by slicing text between consecutive matches
    const chapters: DetectedChapter[] = [];

    for (let i = 0; i < rawMatches.length; i++) {
      const start = rawMatches[i].offset;
      const end =
        i < rawMatches.length - 1
          ? rawMatches[i + 1].offset
          : totalChars;

      const chapterText = text.slice(start, end).trim();

      // Filter out false-positive "chapters" that are too short
      if (chapterText.length < MIN_CHAPTER_LENGTH && rawMatches.length > 3) {
        continue;
      }

      chapters.push({
        index: chapters.length,
        title: rawMatches[i].title,
        startOffset: start,
        endOffset: end,
        text: chapterText,
        startPage: getPageForOffset(start, pageIndex),
      });
    }

    // Include any preamble text before the first chapter (intro, TOC, etc.)
    // Only if it's substantial enough
    if (chapters.length > 0 && chapters[0].startOffset > MIN_CHAPTER_LENGTH) {
      const preambleText = text.slice(0, chapters[0].startOffset).trim();
      if (preambleText.length > MIN_CHAPTER_LENGTH) {
        chapters.unshift({
          index: 0,
          title: "Introduction / Preface",
          startOffset: 0,
          endOffset: chapters[0].startOffset,
          text: preambleText,
          startPage: 1,
        });
        // Re-index
        chapters.forEach((ch, i) => (ch.index = i));
      }
    }

    if (chapters.length >= MIN_CHAPTERS) {
      console.log(
        `[Chapter Detection] Pattern "${pattern.name}" found ${chapters.length} chapters in "${fileName}"`
      );
      return {
        chapters,
        method: "heuristic",
        totalChars,
        sourceFileName: fileName,
        suggestedBookTitle,
      };
    }
  }

  // No pattern matched
  console.log(
    `[Chapter Detection] No chapters detected in "${fileName}" (${totalChars} chars)`
  );
  return noResult;
}

/**
 * Quick check: is this document large enough that chapter detection
 * should be offered to the user?
 */
export function shouldOfferChapterDetection(charCount: number): boolean {
  return charCount >= MIN_CHARS_FOR_DETECTION;
}

/**
 * Format chapter for display in the selection UI.
 * Returns a human-readable summary like "Ch 3: Molecular Biology (~4,200 words)"
 */
export function formatChapterSummary(chapter: DetectedChapter): string {
  const wordCount = Math.round(chapter.text.split(/\s+/).length / 100) * 100;
  const wordLabel = wordCount > 0 ? `~${wordCount.toLocaleString()} words` : "short";
  const pageLabel = chapter.startPage ? `p. ${chapter.startPage}` : "";
  const meta = [pageLabel, wordLabel].filter(Boolean).join(", ");
  return `${chapter.title}${meta ? ` (${meta})` : ""}`;
}
