import * as pdfjsLib from "pdfjs-dist";
import { toast } from "sonner";

// Fix PDF.js worker for Vite — use the minified worker
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString();

async function extractPdfPages(file: File): Promise<Array<{ data: string; mimeType: string }>> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const images: Array<{ data: string; mimeType: string }> = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: 1.5 });
    const canvas = document.createElement("canvas");
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    const ctx = canvas.getContext("2d");
    if (!ctx) continue;
    await page.render({ canvasContext: ctx, viewport }).promise;
    const base64 = canvas.toDataURL("image/jpeg", 0.75).split(",")[1];
    if (base64) images.push({ data: base64, mimeType: "image/jpeg" });
  }

  console.log(`[PDF Extract] Rendered ${images.length} page image(s) for vision AI`);
  return images;
}

async function extractPdfText(file: File): Promise<string> {
  console.log(`[PDF Extract] Starting extraction for "${file.name}" (${(file.size / 1024 / 1024).toFixed(1)} MB)`);
  
  const arrayBuffer = await file.arrayBuffer();
  console.log(`[PDF Extract] ArrayBuffer loaded: ${arrayBuffer.byteLength} bytes`);
  
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  console.log(`[PDF Extract] PDF loaded: ${pdf.numPages} pages`);
  
  const pages: string[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items
      .map((item: any) => item.str)
      .join(" ");
    pages.push(pageText);
    
    // Log progress every 10 pages for large documents
    if (i % 10 === 0 || i === pdf.numPages) {
      console.log(`[PDF Extract] Processed page ${i}/${pdf.numPages}`);
    }
  }

  const fullText = pages.join("\n\n");
  console.log(`[PDF Extract] Extraction complete: ${fullText.length} characters from ${pdf.numPages} pages`);
  
  return fullText;
}

async function extractDocxText(file: File): Promise<string> {
  console.log(`[DOCX Extract] Starting extraction for "${file.name}" (${(file.size / 1024 / 1024).toFixed(1)} MB)`);
  const mammoth = await import("mammoth");
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  console.log(`[DOCX Extract] Extraction complete: ${result.value.length} characters`);
  return result.value;
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
  images?: Array<{ data: string; mimeType: string }>;
};

export const MAX_FILE_SIZE_MB = 500;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

/**
 * Extracts text from a file client-side.
 * Supports: PDF, DOCX, DOC, TXT, MD, CSV
 * Returns null for unsupported types (images, video, etc.)
 */
export async function extractTextFromFile(
  file: File
): Promise<ExtractionResult | null> {
  if (file.size > MAX_FILE_SIZE_BYTES) {
    toast.error(
      `"${file.name}" exceeds the ${MAX_FILE_SIZE_MB}MB upload limit.`,
      { duration: 8000 }
    );
    return null;
  }

  const ext = file.name.split(".").pop()?.toLowerCase() || "";

  try {
    let text = "";
    let extractedImages: Array<{ data: string; mimeType: string }> | undefined;

    if (ext === "pdf") {
      [text, extractedImages] = await Promise.all([
        extractPdfText(file),
        extractPdfPages(file),
      ]);
    } else if (ext === "docx" || ext === "doc") {
      text = await extractDocxText(file);
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
      toast.error(
        `Could not extract any text from "${file.name}". The file may be image-based or scanned. Try a text-based PDF instead.`,
        { duration: 8000 }
      );
      console.warn(`[Extract] Zero characters extracted from "${file.name}" — file may be scanned/image-based`);
    }

    return { text, fileName: file.name, images: extractedImages };
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
  "pdf", "docx", "doc", "txt", "md", "csv",
]);

export function isClientExtractable(fileName: string): boolean {
  const ext = fileName.split(".").pop()?.toLowerCase() || "";
  return CLIENT_EXTRACTABLE_EXTENSIONS.has(ext);
}
