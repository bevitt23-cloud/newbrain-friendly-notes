import * as pdfjsLib from "pdfjs-dist";
import { toast } from "sonner";

// Fix PDF.js worker for Vite — use the minified worker
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString();

/** Optional progress callback: receives (pagesProcessed, totalPages) */
export type ExtractionProgressCallback = (
  processed: number,
  total: number
) => void;

async function extractPdfText(
  file: File,
  onProgress?: ExtractionProgressCallback
): Promise<{ text: string; pageCount: number }> {
  console.log(`[PDF Extract] Starting extraction for "${file.name}" (${(file.size / 1024 / 1024).toFixed(1)} MB)`);

  const arrayBuffer = await file.arrayBuffer();
  console.log(`[PDF Extract] ArrayBuffer loaded: ${arrayBuffer.byteLength} bytes`);

  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  console.log(`[PDF Extract] PDF loaded: ${pdf.numPages} pages`);

  const pages: string[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();

    // Preserve line structure by detecting Y-coordinate changes.
    // PDF text items on the same line share similar Y positions.
    // When Y changes significantly, insert a newline.
    const items = textContent.items as any[];
    if (items.length === 0) {
      pages.push("");
    } else {
      const lines: string[] = [];
      let currentLine: string[] = [];
      let lastY: number | null = null;

      for (const item of items) {
        const y = item.transform ? item.transform[5] : null;
        const str = item.str || "";

        if (lastY !== null && y !== null && Math.abs(y - lastY) > 2) {
          // Y position changed — new line
          lines.push(currentLine.join(" "));
          currentLine = [];
        }

        if (str.trim()) {
          currentLine.push(str);
        } else if (currentLine.length > 0) {
          // Whitespace-only item acts as a space separator
          currentLine.push(" ");
        }

        if (y !== null) lastY = y;
      }

      if (currentLine.length > 0) {
        lines.push(currentLine.join(" "));
      }

      pages.push(
        lines
          .map((l) => l.replace(/\s+/g, " ").trim())
          .filter(Boolean)
          .join("\n")
      );
    }

    // Report progress and yield to the UI thread every 25 pages
    if (i % 25 === 0 || i === pdf.numPages) {
      console.log(`[PDF Extract] Processed page ${i}/${pdf.numPages}`);
      onProgress?.(i, pdf.numPages);
      // Yield to the main thread so the UI can update (progress spinners, etc.)
      await new Promise((r) => setTimeout(r, 0));
    }
  }

  // Insert page markers between pages so chapter detection can correlate page numbers
  const fullText = pages
    .map((text, i) => (i > 0 ? `[PAGE_BREAK:${i + 1}]\n\n${text}` : text))
    .join("\n\n");
  console.log(`[PDF Extract] Extraction complete: ${fullText.length} characters from ${pdf.numPages} pages`);

  return { text: fullText, pageCount: pdf.numPages };
}

async function extractDocxText(file: File): Promise<string> {
  console.log(`[DOCX Extract] Starting extraction for "${file.name}" (${(file.size / 1024 / 1024).toFixed(1)} MB)`);
  const mammoth = await import("mammoth");
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  console.log(`[DOCX Extract] Extraction complete: ${result.value.length} characters`);
  return result.value;
}

async function extractPptxText(file: File): Promise<string> {
  console.log(`[PPTX Extract] Starting extraction for "${file.name}" (${(file.size / 1024 / 1024).toFixed(1)} MB)`);
  const JSZip = (await import("jszip")).default;
  const arrayBuffer = await file.arrayBuffer();
  const zip = await JSZip.loadAsync(arrayBuffer);

  // PPTX is a ZIP containing ppt/slides/slide1.xml, slide2.xml, etc.
  const slideFiles = Object.keys(zip.files)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/i.test(name))
    .sort((a, b) => {
      const numA = parseInt(a.match(/slide(\d+)/)?.[1] || "0", 10);
      const numB = parseInt(b.match(/slide(\d+)/)?.[1] || "0", 10);
      return numA - numB;
    });

  if (slideFiles.length === 0) {
    console.warn(`[PPTX Extract] No slide XML files found in "${file.name}"`);
    return "";
  }

  const slideTexts: string[] = [];
  for (const slidePath of slideFiles) {
    const xml = await zip.files[slidePath].async("text");
    // Extract text from <a:t> tags (DrawingML text runs)
    const texts: string[] = [];
    const regex = /<a:t>([\s\S]*?)<\/a:t>/g;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(xml)) !== null) {
      const text = match[1].trim();
      if (text) texts.push(text);
    }
    if (texts.length > 0) {
      slideTexts.push(texts.join(" "));
    }
  }

  const fullText = slideTexts.join("\n\n");
  console.log(`[PPTX Extract] Extraction complete: ${fullText.length} characters from ${slideFiles.length} slides`);
  return fullText;
}

async function extractPlainText(file: File): Promise<string> {
  console.log(`[Text Extract] Reading "${file.name}" (${(file.size / 1024 / 1024).toFixed(1)} MB)`);
  const text = await file.text();
  console.log(`[Text Extract] Read complete: ${text.length} characters`);
  return text;
}

export type ExtractionResult = {
  text: string;
  fileName: string;
  /** Total page count (PDF only) */
  pageCount?: number;
};

/**
 * Extracts text from a file client-side.
 * Supports: PDF, DOCX, DOC, PPTX, PPT, TXT, MD, CSV
 * Returns null for unsupported types (images, video, etc.)
 */
const MAX_FILE_SIZE_MB = 500;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

export async function extractTextFromFile(
  file: File,
  onProgress?: ExtractionProgressCallback
): Promise<ExtractionResult | null> {
  if (file.size > MAX_FILE_SIZE_BYTES) {
    toast.error(
      `"${file.name}" is too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Maximum file size is ${MAX_FILE_SIZE_MB} MB.`,
      { duration: 8000 }
    );
    return null;
  }

  const ext = file.name.split(".").pop()?.toLowerCase() || "";

  try {
    let text = "";
    let pageCount: number | undefined;

    if (ext === "pdf") {
      const result = await extractPdfText(file, onProgress);
      text = result.text;
      pageCount = result.pageCount;
    } else if (ext === "docx" || ext === "doc") {
      text = await extractDocxText(file);
    } else if (ext === "pptx" || ext === "ppt") {
      text = await extractPptxText(file);
    } else if (["txt", "md", "csv"].includes(ext)) {
      text = await extractPlainText(file);
    } else {
      // Unsupported for client-side extraction
      return null;
    }

    // Log extracted text length for debugging
    console.log(`[Extract] Extracted text length for "${file.name}":`, text.length);

    // Warn user about extremely large documents
    if (text.length > 100000) {
      toast.warning(
        `"${file.name}" is extremely large (${Math.round(text.length / 1000)}K characters). This may take extra time or exceed AI limits.`,
        { duration: 8000 }
      );
    }

    if (text.length === 0) {
      // Don't alarm the user for PDFs — visual content will be extracted separately
      if (ext === "pdf") {
        toast.info(
          `"${file.name}" has limited text. Visual content (charts, diagrams) will be analyzed by AI.`,
          { duration: 8000 }
        );
      } else {
        toast.error(
          `Could not extract any text from "${file.name}". Try a different file format.`,
          { duration: 8000 }
        );
      }
      console.warn(`[Extract] Zero characters extracted from "${file.name}" — file may be scanned/image-based`);
    }

    return { text, fileName: file.name, pageCount };
  } catch (err) {
    console.error(`[Extract] FAILED to extract text from "${file.name}":`, err);
    toast.error(
      `Failed to extract text from "${file.name}": ${err instanceof Error ? err.message : "Unknown error"}`,
      { duration: 8000 }
    );
    throw err; // Re-throw so caller knows extraction failed
  }
}

/** File extensions that can be extracted client-side */
export const CLIENT_EXTRACTABLE_EXTENSIONS = new Set([
  "pdf", "docx", "doc", "pptx", "ppt", "txt", "md", "csv",
]);

export function isClientExtractable(fileName: string): boolean {
  const ext = fileName.split(".").pop()?.toLowerCase() || "";
  return CLIENT_EXTRACTABLE_EXTENSIONS.has(ext);
}
