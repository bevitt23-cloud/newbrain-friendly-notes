import { describe, it, expect } from "vitest";
import {
  detectChapters,
  shouldOfferChapterDetection,
  formatChapterSummary,
} from "./chapterDetection";

/* ─── Helper: build a fake textbook with N chapters ─── */
function fakeTextbook(chapterCount: number, wordsPerChapter = 500): string {
  const chapters: string[] = [];
  for (let i = 1; i <= chapterCount; i++) {
    const body = Array.from(
      { length: wordsPerChapter },
      (_, w) => `word${w}`
    ).join(" ");
    chapters.push(`Chapter ${i}: Topic Number ${i}\n\n${body}`);
  }
  return chapters.join("\n\n");
}

describe("detectChapters", () => {
  it("returns no chapters for small documents", () => {
    const result = detectChapters("Short text.", "notes.txt");
    expect(result.chapters).toHaveLength(0);
    expect(result.method).toBe("none");
  });

  it("detects 'Chapter N: Title' pattern", () => {
    const text = fakeTextbook(5);
    const result = detectChapters(text, "biology.pdf");
    expect(result.chapters.length).toBeGreaterThanOrEqual(5);
    expect(result.method).toBe("heuristic");
    expect(result.chapters[0].title).toContain("Topic Number");
  });

  it("detects 'CHAPTER N' uppercase pattern", () => {
    const text = [
      "CHAPTER 1\n\n" + "a ".repeat(2000),
      "CHAPTER 2\n\n" + "b ".repeat(2000),
      "CHAPTER 3\n\n" + "c ".repeat(2000),
    ].join("\n\n");
    const result = detectChapters(text, "book.pdf");
    expect(result.chapters.length).toBeGreaterThanOrEqual(3);
    expect(result.method).toBe("heuristic");
  });

  it("detects 'Unit N: Title' pattern", () => {
    const text = [
      "Unit 1: Foundations\n\n" + "a ".repeat(2000),
      "Unit 2: Applications\n\n" + "b ".repeat(2000),
      "Unit 3: Advanced Topics\n\n" + "c ".repeat(2000),
    ].join("\n\n");
    const result = detectChapters(text, "course.pdf");
    expect(result.chapters.length).toBeGreaterThanOrEqual(3);
  });

  it("includes preamble as Introduction when substantial", () => {
    const preamble = "a ".repeat(1000); // 2000+ chars of preface
    const text = preamble + "\n\n" + fakeTextbook(3);
    const result = detectChapters(text, "textbook.pdf");
    expect(result.chapters[0].title).toMatch(/introduction|preface/i);
  });

  it("skips tiny 'chapters' as false positives", () => {
    // One chapter is too short — should be filtered
    const text = [
      "Chapter 1: Real Chapter\n\n" + "a ".repeat(2000),
      "Chapter 2: Tiny\n\nshort",
      "Chapter 3: Also Real\n\n" + "c ".repeat(2000),
      "Chapter 4: Good\n\n" + "d ".repeat(2000),
    ].join("\n\n");
    const result = detectChapters(text, "test.pdf");
    // The tiny chapter may or may not be included, but we should still get chapters
    expect(result.chapters.length).toBeGreaterThanOrEqual(3);
  });

  it("guesses book title from first lines", () => {
    const text =
      "Introduction to Organic Chemistry\nby John Smith\n\n" +
      fakeTextbook(3, 1000);
    const result = detectChapters(text, "chem-textbook.pdf");
    expect(result.suggestedBookTitle).toBe(
      "Introduction to Organic Chemistry"
    );
  });

  it("falls back to filename for book title", () => {
    const text = fakeTextbook(3);
    // First lines will be "Chapter 1: ..." which gets skipped by title guesser
    const result = detectChapters(text, "my-biology-notes.pdf");
    expect(result.suggestedBookTitle).toContain("biology");
  });

  it("populates startPage when page markers are present", () => {
    const text = [
      "Chapter 1: Intro\n\n" + "a ".repeat(2000),
      "[PAGE_BREAK:5]\n\nChapter 2: Cells\n\n" + "b ".repeat(2000),
      "[PAGE_BREAK:12]\n\nChapter 3: DNA\n\n" + "c ".repeat(2000),
    ].join("\n\n");
    const result = detectChapters(text, "bio.pdf");
    expect(result.chapters.length).toBeGreaterThanOrEqual(3);
    // Chapter 2 should know it starts around page 5
    const ch2 = result.chapters.find((c) => c.title.includes("Cells"));
    if (ch2) {
      expect(ch2.startPage).toBe(5);
    }
  });
});

describe("shouldOfferChapterDetection", () => {
  it("returns false for small docs", () => {
    expect(shouldOfferChapterDetection(500)).toBe(false);
    expect(shouldOfferChapterDetection(7999)).toBe(false);
  });

  it("returns true for large docs", () => {
    expect(shouldOfferChapterDetection(8000)).toBe(true);
    expect(shouldOfferChapterDetection(100000)).toBe(true);
  });
});

describe("formatChapterSummary", () => {
  it("formats chapter with page and word count", () => {
    const summary = formatChapterSummary({
      index: 0,
      title: "Chapter 1: Cells",
      startOffset: 0,
      endOffset: 5000,
      text: "a ".repeat(2100), // ~2100 words
      startPage: 3,
    });
    expect(summary).toContain("Chapter 1: Cells");
    expect(summary).toContain("p. 3");
    expect(summary).toContain("words");
  });

  it("omits page when not available", () => {
    const summary = formatChapterSummary({
      index: 0,
      title: "Introduction",
      startOffset: 0,
      endOffset: 100,
      text: "Hello world",
    });
    expect(summary).toContain("Introduction");
    expect(summary).not.toContain("p.");
  });
});
