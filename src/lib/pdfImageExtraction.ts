/**
 * PDF Image Extraction — detects pages with embedded images, renders them
 * as JPEG snapshots, and packages them as EncodedImage[] for the AI vision pipeline.
 */
import * as pdfjsLib from "pdfjs-dist";
import { OPS } from "pdfjs-dist";
import { createEncodedImage, type EncodedImage } from "@/lib/imageUtils";

/** Opcodes that indicate a page contains an embedded raster image. */
const RASTER_IMAGE_OPS = new Set([
  OPS.paintImageXObject,
  OPS.paintInlineImageXObject,
  OPS.paintImageMaskXObject,
  OPS.paintImageXObjectRepeat,
  OPS.paintInlineImageXObjectGroup,
  OPS.paintImageMaskXObjectGroup,
  OPS.paintImageMaskXObjectRepeat,
]);

/** Opcodes for vector drawing — graphs, diagrams, shapes drawn with paths. */
const VECTOR_DRAW_OPS = new Set([
  OPS.constructPath,
  OPS.stroke,
  OPS.closeStroke,
  OPS.fill,
  OPS.eoFill,
  OPS.fillStroke,
  OPS.eoFillStroke,
  OPS.closeFillStroke,
  OPS.closeEOFillStroke,
]);

/** Opcodes for text rendering. */
const TEXT_OPS = new Set([
  OPS.showText,
  OPS.showSpacedText,
  OPS.nextLineShowText,
  OPS.nextLineSetSpacingShowText,
]);

/**
 * Minimum ratio of vector draw ops to text ops for a page to qualify as
 * "vector-heavy" (likely contains a graph/diagram drawn with paths).
 * A page with 50 draw ops and 10 text ops has ratio 5.0 → qualifies.
 * A page with 5 draw ops and 100 text ops has ratio 0.05 → text-heavy, skip.
 */
const VECTOR_RATIO_THRESHOLD = 0.8;
/** Minimum absolute vector ops to avoid false-positiving on simple borders/lines. */
const MIN_VECTOR_OPS = 20;

export interface PdfImageExtractionOptions {
  /** Max images to return (shared budget with standalone uploads). Default 10. */
  maxImages?: number;
  /** Constrain to pages within this 1-indexed range (inclusive). For chapter mode. */
  pageRange?: { start: number; end: number };
  /** Progress callback: (phase, current, total) */
  onProgress?: (phase: string, current: number, total: number) => void;
}

const DEFAULT_MAX_DIM = 1024;
const JPEG_QUALITY = 0.75;

// ── Detection ──────────────────────────────────────────────────────

/**
 * Scan PDF pages and return 1-indexed page numbers that contain visual content.
 * Detects both raster images (embedded PNGs/JPEGs) AND vector-heavy pages
 * (graphs, diagrams, charts drawn with PDF path operators).
 * Uses getOperatorList() which is fast — no rendering involved.
 */
async function detectPagesWithVisuals(
  pdf: pdfjsLib.PDFDocumentProxy,
  startPage: number,
  endPage: number,
  onProgress?: (current: number, total: number) => void,
): Promise<number[]> {
  const visualPages: number[] = [];
  const total = endPage - startPage + 1;

  for (let i = startPage; i <= endPage; i++) {
    try {
      const page = await pdf.getPage(i);
      const ops = await page.getOperatorList();

      // Check 1: page has raster images
      const hasRasterImage = ops.fnArray.some((op: number) => RASTER_IMAGE_OPS.has(op));
      if (hasRasterImage) {
        visualPages.push(i);
        continue; // no need to check vectors — already qualifies
      }

      // Check 2: page is vector-heavy (likely a graph/diagram/chart)
      let vectorOps = 0;
      let textOps = 0;
      for (const op of ops.fnArray) {
        if (VECTOR_DRAW_OPS.has(op)) vectorOps++;
        else if (TEXT_OPS.has(op)) textOps++;
      }

      if (vectorOps >= MIN_VECTOR_OPS) {
        // Ratio check: high vector-to-text ratio means the page is mostly drawing
        const ratio = textOps > 0 ? vectorOps / textOps : vectorOps;
        if (ratio >= VECTOR_RATIO_THRESHOLD) {
          visualPages.push(i);
        }
      }
    } catch (err) {
      console.warn(`[PDF Images] Skipping page ${i} (getOperatorList failed):`, err);
    }

    // Yield every 50 pages to keep the UI responsive
    if ((i - startPage + 1) % 50 === 0) {
      onProgress?.(i - startPage + 1, total);
      await new Promise((r) => setTimeout(r, 0));
    }
  }

  onProgress?.(total, total);
  return visualPages;
}

// ── Selection ──────────────────────────────────────────────────────

/**
 * Pick which pages to render, respecting the maxImages budget.
 * If more image pages exist than budget, distribute evenly across the range.
 */
function selectPages(imagePageNums: number[], maxImages: number): number[] {
  if (imagePageNums.length <= maxImages) return imagePageNums;

  // Evenly sample across the array
  const selected: number[] = [];
  const step = imagePageNums.length / maxImages;
  for (let i = 0; i < maxImages; i++) {
    selected.push(imagePageNums[Math.floor(i * step)]);
  }
  return selected;
}

// ── Rendering ──────────────────────────────────────────────────────

/**
 * Render a single PDF page to a JPEG base64 string.
 * Scales the page so its longest edge fits within maxDim pixels.
 */
async function renderPageAsImage(
  page: pdfjsLib.PDFPageProxy,
  maxDim: number = DEFAULT_MAX_DIM,
  quality: number = JPEG_QUALITY,
): Promise<{ data: string; mimeType: string }> {
  const baseViewport = page.getViewport({ scale: 1.0 });
  const longest = Math.max(baseViewport.width, baseViewport.height);
  const scale = longest > maxDim ? maxDim / longest : 1.0;
  const viewport = page.getViewport({ scale });

  const canvas = document.createElement("canvas");
  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);

  try {
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not get 2D canvas context");

    // White background so transparent areas don't render as black
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    await page.render({ canvasContext: ctx, viewport }).promise;

    const dataUrl = canvas.toDataURL("image/jpeg", quality);
    const base64 = dataUrl.split(",")[1];

    return { data: base64, mimeType: "image/jpeg" };
  } finally {
    // Always release canvas memory
    canvas.width = 0;
    canvas.height = 0;
  }
}

// ── Orchestrator ───────────────────────────────────────────────────

/**
 * Extract images from a PDF file:
 * 1. Detect which pages contain embedded images
 * 2. Select up to maxImages pages
 * 3. Render those pages as JPEG snapshots
 * 4. Return as EncodedImage[] ready for the vision pipeline
 *
 * @param file       The PDF file to process
 * @param startIndex The starting index for EncodedImage.index values
 *                   (so PDF images don't collide with standalone image indices)
 * @param options    Configuration options
 */
export async function extractPdfImages(
  file: File,
  startIndex: number,
  options: PdfImageExtractionOptions = {},
): Promise<EncodedImage[]> {
  const { maxImages = 10, pageRange, onProgress } = options;

  if (maxImages <= 0) return [];

  // 1. Load PDF
  onProgress?.("Scanning PDF for images…", 0, 1);
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  try {
    const startPage = pageRange?.start ?? 1;
    const endPage = Math.min(pageRange?.end ?? pdf.numPages, pdf.numPages);

    // 2. Detect pages with images
    const imagePages = await detectPagesWithVisuals(
      pdf,
      startPage,
      endPage,
      (current, total) => onProgress?.("Scanning pages for images…", current, total),
    );

    if (imagePages.length === 0) {
      console.log(`[PDF Images] No visual pages found in "${file.name}" (pages ${startPage}-${endPage})`);
      return [];
    }

    console.log(
      `[PDF Images] Found ${imagePages.length} pages with visuals in "${file.name}". Budget: ${maxImages}.`,
    );

    // 3. Select pages within budget
    const selected = selectPages(imagePages, maxImages);
    console.log(`[PDF Images] Rendering ${selected.length} pages: [${selected.join(", ")}]`);

    // 4. Render selected pages
    const results: EncodedImage[] = [];

    for (let i = 0; i < selected.length; i++) {
      const pageNum = selected[i];
      onProgress?.("Rendering page images…", i + 1, selected.length);

      try {
        const page = await pdf.getPage(pageNum);
        const { data, mimeType } = await renderPageAsImage(page);
        results.push(
          createEncodedImage(
            data,
            mimeType,
            `${file.name} — Page ${pageNum}`,
            startIndex + i,
          ),
        );
      } catch (err) {
        console.warn(`[PDF Images] Failed to render page ${pageNum}:`, err);
      }

      // Yield to main thread between renders
      if (i % 3 === 2) {
        await new Promise((r) => setTimeout(r, 0));
      }
    }

    console.log(`[PDF Images] Extracted ${results.length} page images from "${file.name}"`);
    return results;
  } finally {
    // Always destroy PDF document to prevent memory leaks
    pdf.destroy();
  }
}
