import { describe, expect, it, vi } from "vitest";
import { isClientExtractable } from "./extractTextFromFile";

// Mock sonner toast so we can test the file size rejection path
vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    warning: vi.fn(),
    success: vi.fn(),
  },
}));

// Mock pdfjs-dist to avoid loading the actual worker in tests
vi.mock("pdfjs-dist", () => ({
  GlobalWorkerOptions: { workerSrc: "" },
  getDocument: vi.fn(),
}));

describe("isClientExtractable", () => {
  it("returns true for supported extensions", () => {
    expect(isClientExtractable("notes.pdf")).toBe(true);
    expect(isClientExtractable("doc.docx")).toBe(true);
    expect(isClientExtractable("slides.pptx")).toBe(true);
    expect(isClientExtractable("readme.txt")).toBe(true);
    expect(isClientExtractable("notes.md")).toBe(true);
    expect(isClientExtractable("data.csv")).toBe(true);
    expect(isClientExtractable("legacy.doc")).toBe(true);
    expect(isClientExtractable("legacy.ppt")).toBe(true);
  });

  it("returns false for unsupported extensions", () => {
    expect(isClientExtractable("photo.png")).toBe(false);
    expect(isClientExtractable("image.jpg")).toBe(false);
    expect(isClientExtractable("video.mp4")).toBe(false);
    expect(isClientExtractable("audio.mp3")).toBe(false);
    expect(isClientExtractable("data.xlsx")).toBe(false);
    expect(isClientExtractable("archive.zip")).toBe(false);
  });

  it("handles files with no extension", () => {
    expect(isClientExtractable("Makefile")).toBe(false);
  });

  it("is case-insensitive via lowercase", () => {
    // The function lowercases the extension
    expect(isClientExtractable("notes.PDF")).toBe(true);
    expect(isClientExtractable("doc.DOCX")).toBe(true);
  });
});

describe("extractTextFromFile - file size limit", () => {
  it("rejects files over 20MB", async () => {
    const { toast } = await import("sonner");
    const { extractTextFromFile } = await import("./extractTextFromFile");

    const bigFile = new File(["x"], "huge.pdf", { type: "application/pdf" });
    Object.defineProperty(bigFile, "size", { value: 25 * 1024 * 1024 }); // 25MB

    const result = await extractTextFromFile(bigFile);
    expect(result).toBeNull();
    expect(toast.error).toHaveBeenCalledWith(
      expect.stringContaining("too large"),
      expect.any(Object)
    );
  });

  it("returns null for unsupported file types", async () => {
    const { extractTextFromFile } = await import("./extractTextFromFile");

    const imgFile = new File(["data"], "photo.png", { type: "image/png" });
    Object.defineProperty(imgFile, "size", { value: 1024 }); // 1KB

    const result = await extractTextFromFile(imgFile);
    expect(result).toBeNull();
  });
});
