const SMALL_TEXT_THRESHOLD = 50_000;
const TARGET_CHUNK_SIZE = 45_000;
const HARD_CHUNK_LIMIT = 60_000;

function normalizeLineEndings(text: string): string {
  return text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

function splitByChapterHeadings(text: string): string[] {
  // Common textbook patterns: "Chapter 1", "CHAPTER I", "Unit 2", "Part III"
  const chapterHeadingRegex = /(?=^\s*(?:chapter|unit|part)\s+(?:\d+|[ivxlcdm]+)\b.*$)/gim;
  const chunks = text
    .split(chapterHeadingRegex)
    .map((chunk) => chunk.trim())
    .filter((chunk) => chunk.length > 0);

  return chunks.length > 1 ? chunks : [];
}

function splitByMajorHeadingGaps(text: string): string[] {
  // Split on large heading-style separators (double newlines before title-like lines).
  const headingGapRegex = /\n{2,}(?=[A-Z][A-Z0-9\s:'"()-]{6,}\n)/g;
  const chunks = text
    .split(headingGapRegex)
    .map((chunk) => chunk.trim())
    .filter((chunk) => chunk.length > 0);

  return chunks.length > 1 ? chunks : [];
}

function chunkByCharacterLimit(text: string, maxSize = TARGET_CHUNK_SIZE): string[] {
  const chunks: string[] = [];
  let start = 0;

  while (start < text.length) {
    let end = Math.min(start + maxSize, text.length);

    if (end < text.length) {
      // Prefer natural breaks: paragraph, line, sentence, then whitespace.
      const paragraphBreak = text.lastIndexOf("\n\n", end);
      const lineBreak = text.lastIndexOf("\n", end);
      const sentenceBreak = Math.max(
        text.lastIndexOf(". ", end),
        text.lastIndexOf("? ", end),
        text.lastIndexOf("! ", end)
      );
      const wordBreak = text.lastIndexOf(" ", end);

      const minBreakPosition = start + Math.floor(maxSize * 0.55);
      const candidates = [paragraphBreak, lineBreak, sentenceBreak, wordBreak].filter(
        (pos) => pos >= minBreakPosition
      );

      if (candidates.length > 0) {
        end = Math.max(...candidates);
      }

      if (end - start > HARD_CHUNK_LIMIT) {
        end = start + maxSize;
      }
    }

    const piece = text.slice(start, end).trim();
    if (piece.length > 0) {
      chunks.push(piece);
    }

    start = end;
    while (start < text.length && /\s/.test(text[start])) {
      start += 1;
    }
  }

  return chunks;
}

function scoreChunkByInstructions(chunk: string, instructions: string): number {
  if (!instructions.trim()) return 0;

  const instructionTerms = instructions
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((term) => term.length >= 4);

  if (instructionTerms.length === 0) return 0;

  const chunkLower = chunk.toLowerCase();
  let score = 0;

  for (const term of instructionTerms) {
    if (chunkLower.includes(term)) score += 1;
  }

  return score;
}

export function chunkTextbook(text: string, instructions: string): string[] {
  const normalized = normalizeLineEndings(text).trim();
  if (!normalized) return [];

  if (normalized.length < SMALL_TEXT_THRESHOLD) {
    return [normalized];
  }

  let chunks = splitByChapterHeadings(normalized);

  if (chunks.length <= 1) {
    chunks = splitByMajorHeadingGaps(normalized);
  }

  if (chunks.length <= 1) {
    chunks = chunkByCharacterLimit(normalized);
  }

  // Ensure oversized chapter chunks are further split for downstream generation stability.
  const flattened = chunks.flatMap((chunk) =>
    chunk.length > HARD_CHUNK_LIMIT ? chunkByCharacterLimit(chunk) : [chunk]
  );

  // If instructions hint at chapter ordering (e.g., chapter focus), promote best-matching chunk to first.
  if (flattened.length > 1 && instructions.trim()) {
    const scored = flattened
      .map((chunk, index) => ({ chunk, index, score: scoreChunkByInstructions(chunk, instructions) }))
      .sort((a, b) => (b.score - a.score) || (a.index - b.index));

    const top = scored[0];
    if (top.score > 0 && top.index !== 0) {
      const reordered = [...flattened];
      reordered.splice(top.index, 1);
      reordered.unshift(top.chunk);
      return reordered;
    }
  }

  return flattened;
}
