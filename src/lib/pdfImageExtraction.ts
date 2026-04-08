/**
 * PDF Image Extraction — detects pages with embedded images, renders them
 * as JPEG snapshots, and packages them as EncodedImage[] for the AI vision pipeline.
 *
 * Smart Cropping: Instead of sending full-page screenshots, this module
 * extracts individual diagrams, charts, and figures by:
 * 1. Parsing PDF operator lists to find raster image positions/transforms
 * 2. Cropping individual images from the rendered canvas
 * 3. For vector-only pages, detecting content bounding boxes via pixel scanning
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

const VECTOR_ABS_THRESHOLD = 30;
const VECTOR_RATIO_THRESHOLD = 0.3;
const MIN_VECTOR_OPS = 15;

export interface PdfImageExtractionOptions {
  /** Max images to return (shared budget with standalone uploads). Default 10. */
  maxImages?: number;
  /** Constrain to pages within this 1-indexed range (inclusive). For chapter mode. */
  pageRange?: { start: number; end: number };
  /** Progress callback: (phase, current, total) */
  onProgress?: (phase: string, current: number, total: number) => void;
}

const DEFAULT_MAX_DIM = 2048;
const JPEG_QUALITY = 0.92;
/** Minimum crop size in pixels — skip tiny images */
const MIN_CROP_DIM = 80;
/** If content area covers more than this fraction of the page, use full page */
const MAX_CONTENT_RATIO = 0.85;
/** Padding around cropped content in pixels */
const CROP_PADDING = 20;

// ── Types ──────────────────────────────────────────────────────

interface ImageRegion {
  /** Position and size in rendered canvas coordinates */
  x: number;
  y: number;
  width: number;
  height: number;
  /** Whether this is a raster image (vs detected vector content) */
  isRaster: boolean;
}

interface PageAnalysis {
  pageNum: number;
  hasRasterImages: boolean;
  hasVectorContent: boolean;
  /** Extracted image regions from operator transforms */
  rasterRegions: ImageRegion[];
  vectorOps: number;
  textOps: number;
}

// ── Detection ──────────────────────────────────────────────────────

/**
 * Analyze a PDF page: detect visual content AND extract raster image positions.
 * Returns both qualification status and image region coordinates.
 */
async function analyzePage(
  pdf: pdfjsLib.PDFDocumentProxy,
  pageNum: number,
  scale: number,
): Promise<PageAnalysis> {
  const page = await pdf.getPage(pageNum);
  const ops = await page.getOperatorList();
  const viewport = page.getViewport({ scale });

  let vectorOps = 0;
  let textOps = 0;
  const rasterRegions: ImageRegion[] = [];
  let hasRasterImages = false;

  // Track the current transform matrix to extract image positions
  // PDF.js operator list has transform/setTransform ops interleaved with draw ops
  // We need to track the CTM (Current Transform Matrix) to know where images land
  let ctm: number[] = [scale, 0, 0, scale, 0, 0]; // initial transform = viewport scale

  for (let i = 0; i < ops.fnArray.length; i++) {
    const op = ops.fnArray[i];

    if (op === OPS.transform) {
      // args: [a, b, c, d, e, f] — multiply with current CTM
      const args = ops.argsArray[i] as number[];
      if (args && args.length >= 6) {
        const [a, b, c, d, e, f] = args;
        const prev = ctm;
        ctm = [
          prev[0] * a + prev[2] * b,
          prev[1] * a + prev[3] * b,
          prev[0] * c + prev[2] * d,
          prev[1] * c + prev[3] * d,
          prev[0] * e + prev[2] * f + prev[4],
          prev[1] * e + prev[3] * f + prev[5],
        ];
      }
    } else if (op === OPS.save) {
      // We don't track a full stack for simplicity — the CTM at paint time is close enough
    } else if (op === OPS.restore) {
      // Reset to base transform
      ctm = [scale, 0, 0, scale, 0, 0];
    } else if (RASTER_IMAGE_OPS.has(op)) {
      hasRasterImages = true;

      // Extract image position from the current transform matrix
      // CTM maps the unit square [0,1]x[0,1] to page coordinates
      // Image width = sqrt(a² + b²), height = sqrt(c² + d²)
      const imgWidth = Math.sqrt(ctm[0] * ctm[0] + ctm[1] * ctm[1]);
      const imgHeight = Math.sqrt(ctm[2] * ctm[2] + ctm[3] * ctm[3]);

      // Position: the translation components, adjusted for PDF coordinate system
      // PDF has origin at bottom-left, canvas at top-left
      const x = ctm[4];
      const y = viewport.height - ctm[5] - imgHeight;

      if (imgWidth >= MIN_CROP_DIM && imgHeight >= MIN_CROP_DIM) {
        rasterRegions.push({
          x: Math.max(0, x),
          y: Math.max(0, y),
          width: Math.min(imgWidth, viewport.width - Math.max(0, x)),
          height: Math.min(imgHeight, viewport.height - Math.max(0, y)),
          isRaster: true,
        });
      }
    } else if (VECTOR_DRAW_OPS.has(op)) {
      vectorOps++;
    } else if (TEXT_OPS.has(op)) {
      textOps++;
    }
  }

  const hasVectorContent =
    vectorOps >= VECTOR_ABS_THRESHOLD ||
    (vectorOps >= MIN_VECTOR_OPS && textOps > 0 && vectorOps / textOps >= VECTOR_RATIO_THRESHOLD);

  return {
    pageNum,
    hasRasterImages,
    hasVectorContent,
    rasterRegions,
    vectorOps,
    textOps,
  };
}

/**
 * Scan PDF pages and return analyses of pages with visual content.
 */
async function detectVisualPages(
  pdf: pdfjsLib.PDFDocumentProxy,
  startPage: number,
  endPage: number,
  scale: number,
  onProgress?: (current: number, total: number) => void,
): Promise<PageAnalysis[]> {
  const visualPages: PageAnalysis[] = [];
  const total = endPage - startPage + 1;

  for (let i = startPage; i <= endPage; i++) {
    try {
      const analysis = await analyzePage(pdf, i, scale);
      if (analysis.hasRasterImages || analysis.hasVectorContent) {
        visualPages.push(analysis);
      }
    } catch (err) {
      console.warn(`[PDF Images] Skipping page ${i} (analysis failed):`, err);
    }

    if ((i - startPage + 1) % 50 === 0) {
      onProgress?.(i - startPage + 1, total);
      await new Promise((r) => setTimeout(r, 0));
    }
  }

  onProgress?.(total, total);
  return visualPages;
}

// ── Selection ──────────────────────────────────────────────────────

function selectPages(analyses: PageAnalysis[], maxImages: number): PageAnalysis[] {
  // Count total potential images (raster regions + vector pages)
  let totalImages = 0;
  for (const a of analyses) {
    totalImages += a.rasterRegions.length > 0 ? a.rasterRegions.length : 1;
  }

  if (totalImages <= maxImages) return analyses;

  // If over budget, distribute evenly across pages
  const selected: PageAnalysis[] = [];
  const step = analyses.length / maxImages;
  for (let i = 0; i < Math.min(maxImages, analyses.length); i++) {
    selected.push(analyses[Math.floor(i * step)]);
  }
  return selected;
}

// ── Rendering & Cropping ──────────────────────────────────────────

/**
 * Render a PDF page to canvas and return the canvas + context for cropping.
 */
async function renderPageToCanvas(
  page: pdfjsLib.PDFPageProxy,
  maxDim: number = DEFAULT_MAX_DIM,
): Promise<{ canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D; scale: number; viewport: any }> {
  const baseViewport = page.getViewport({ scale: 1.0 });
  const longest = Math.max(baseViewport.width, baseViewport.height);
  const scale = longest > maxDim ? maxDim / longest : 1.0;
  const viewport = page.getViewport({ scale });

  const canvas = document.createElement("canvas");
  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not get 2D canvas context");

  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvasContext: ctx, viewport }).promise;

  return { canvas, ctx, scale, viewport };
}

/**
 * Crop a region from a rendered canvas and return as base64 JPEG.
 */
function cropRegion(
  sourceCanvas: HTMLCanvasElement,
  region: ImageRegion,
  quality: number = JPEG_QUALITY,
): { data: string; mimeType: string } | null {
  // Add padding
  const x = Math.max(0, Math.floor(region.x - CROP_PADDING));
  const y = Math.max(0, Math.floor(region.y - CROP_PADDING));
  const w = Math.min(Math.ceil(region.width + CROP_PADDING * 2), sourceCanvas.width - x);
  const h = Math.min(Math.ceil(region.height + CROP_PADDING * 2), sourceCanvas.height - y);

  if (w < MIN_CROP_DIM || h < MIN_CROP_DIM) return null;

  // Check if the crop covers most of the page — if so, just use full page
  const pageArea = sourceCanvas.width * sourceCanvas.height;
  const cropArea = w * h;
  if (cropArea / pageArea > MAX_CONTENT_RATIO) return null;

  const cropCanvas = document.createElement("canvas");
  cropCanvas.width = w;
  cropCanvas.height = h;

  try {
    const cropCtx = cropCanvas.getContext("2d");
    if (!cropCtx) return null;

    cropCtx.drawImage(sourceCanvas, x, y, w, h, 0, 0, w, h);

    const dataUrl = cropCanvas.toDataURL("image/jpeg", quality);
    return { data: dataUrl.split(",")[1], mimeType: "image/jpeg" };
  } finally {
    cropCanvas.width = 0;
    cropCanvas.height = 0;
  }
}

/**
 * For vector-only pages (no raster images), detect the bounding box of
 * non-white content by scanning pixels. Returns a content region or null.
 */
function detectContentBounds(
  ctx: CanvasRenderingContext2D,
  canvasWidth: number,
  canvasHeight: number,
): ImageRegion | null {
  // Sample pixels to find the bounding box of non-white content
  // Scan at reduced resolution for performance (every 4th pixel)
  const step = 4;
  const imageData = ctx.getImageData(0, 0, canvasWidth, canvasHeight);
  const pixels = imageData.data;

  let minX = canvasWidth;
  let minY = canvasHeight;
  let maxX = 0;
  let maxY = 0;

  for (let y = 0; y < canvasHeight; y += step) {
    for (let x = 0; x < canvasWidth; x += step) {
      const idx = (y * canvasWidth + x) * 4;
      const r = pixels[idx];
      const g = pixels[idx + 1];
      const b = pixels[idx + 2];

      // Check if pixel is "not white" (threshold for near-white)
      if (r < 240 || g < 240 || b < 240) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (maxX <= minX || maxY <= minY) return null;

  const width = maxX - minX;
  const height = maxY - minY;

  // If content spans most of the page, it's probably not a single diagram
  if ((width * height) / (canvasWidth * canvasHeight) > MAX_CONTENT_RATIO) return null;

  // If content is too small, skip
  if (width < MIN_CROP_DIM || height < MIN_CROP_DIM) return null;

  return { x: minX, y: minY, width, height, isRaster: false };
}

/**
 * Render a full page as a single JPEG (fallback when cropping isn't applicable).
 */
function canvasToJpeg(
  canvas: HTMLCanvasElement,
  quality: number = JPEG_QUALITY,
): { data: string; mimeType: string } {
  const dataUrl = canvas.toDataURL("image/jpeg", quality);
  return { data: dataUrl.split(",")[1], mimeType: "image/jpeg" };
}

// ── Orchestrator ───────────────────────────────────────────────────

/**
 * Extract images from a PDF file with smart cropping:
 * 1. Analyze which pages contain visual content and where images are positioned
 * 2. Render pages and crop individual diagrams/charts instead of full pages
 * 3. Fall back to full-page screenshots when cropping isn't possible
 */
export async function extractPdfImages(
  file: File,
  startIndex: number,
  options: PdfImageExtractionOptions = {},
): Promise<EncodedImage[]> {
  const { maxImages = 10, pageRange, onProgress } = options;

  if (maxImages <= 0) return [];

  onProgress?.("Scanning PDF for images…", 0, 1);
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  try {
    const startPage = pageRange?.start ?? 1;
    const endPage = Math.min(pageRange?.end ?? pdf.numPages, pdf.numPages);

    // We need scale for position extraction — use a reference page
    const refPage = await pdf.getPage(startPage);
    const refViewport = refPage.getViewport({ scale: 1.0 });
    const longest = Math.max(refViewport.width, refViewport.height);
    const renderScale = longest > DEFAULT_MAX_DIM ? DEFAULT_MAX_DIM / longest : 1.0;

    // 1. Analyze pages — detect visuals AND extract image positions
    const visualPages = await detectVisualPages(
      pdf,
      startPage,
      endPage,
      renderScale,
      (current, total) => onProgress?.("Scanning pages for images…", current, total),
    );

    if (visualPages.length === 0) {
      console.log(`[PDF Images] No visual pages found in "${file.name}" (pages ${startPage}-${endPage})`);
      return [];
    }

    console.log(
      `[PDF Images] Found ${visualPages.length} pages with visuals in "${file.name}". Budget: ${maxImages}.`,
    );

    // 2. Select pages within budget
    const selected = selectPages(visualPages, maxImages);
    console.log(`[PDF Images] Processing ${selected.length} pages: [${selected.map((a) => a.pageNum).join(", ")}]`);

    // 3. Render and crop
    const results: EncodedImage[] = [];
    let imageIdx = startIndex;

    for (let i = 0; i < selected.length; i++) {
      const analysis = selected[i];
      onProgress?.("Extracting diagrams…", i + 1, selected.length);

      if (imageIdx - startIndex >= maxImages) break;

      try {
        const page = await pdf.getPage(analysis.pageNum);
        const { canvas, ctx, scale } = await renderPageToCanvas(page);

        let extracted = false;

        // Strategy 1: Crop individual raster images by position
        if (analysis.rasterRegions.length > 0) {
          // Merge overlapping regions to avoid duplicates
          const merged = mergeOverlappingRegions(analysis.rasterRegions);

          for (const region of merged) {
            if (imageIdx - startIndex >= maxImages) break;

            const cropped = cropRegion(canvas, region);
            if (cropped) {
              results.push(
                createEncodedImage(
                  cropped.data,
                  cropped.mimeType,
                  `${file.name} — Page ${analysis.pageNum} (diagram)`,
                  imageIdx++,
                ),
              );
              extracted = true;
            }
          }
        }

        // Strategy 2: For vector-only pages, detect content bounding box
        if (!extracted && analysis.hasVectorContent && !analysis.hasRasterImages) {
          const bounds = detectContentBounds(ctx, canvas.width, canvas.height);
          if (bounds) {
            const cropped = cropRegion(canvas, bounds);
            if (cropped) {
              results.push(
                createEncodedImage(
                  cropped.data,
                  cropped.mimeType,
                  `${file.name} — Page ${analysis.pageNum} (figure)`,
                  imageIdx++,
                ),
              );
              extracted = true;
            }
          }
        }

        // Strategy 3: Fallback — use full page if cropping didn't produce anything
        if (!extracted) {
          const full = canvasToJpeg(canvas);
          results.push(
            createEncodedImage(
              full.data,
              full.mimeType,
              `${file.name} — Page ${analysis.pageNum}`,
              imageIdx++,
            ),
          );
        }

        // Release canvas memory
        canvas.width = 0;
        canvas.height = 0;
      } catch (err) {
        console.warn(`[PDF Images] Failed to process page ${analysis.pageNum}:`, err);
      }

      // Yield to main thread between renders
      if (i % 3 === 2) {
        await new Promise((r) => setTimeout(r, 0));
      }
    }

    console.log(`[PDF Images] Extracted ${results.length} cropped images from "${file.name}"`);
    return results;
  } finally {
    pdf.destroy();
  }
}

// ── Helpers ────────────────────────────────────────────────────────

/**
 * Merge overlapping or adjacent image regions to avoid extracting
 * the same visual content multiple times.
 */
function mergeOverlappingRegions(regions: ImageRegion[]): ImageRegion[] {
  if (regions.length <= 1) return regions;

  // Sort by Y position, then X
  const sorted = [...regions].sort((a, b) => a.y - b.y || a.x - b.x);
  const merged: ImageRegion[] = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    const curr = sorted[i];
    const last = merged[merged.length - 1];

    // Check if regions overlap or are within CROP_PADDING of each other
    const overlapX = curr.x < last.x + last.width + CROP_PADDING * 2;
    const overlapY = curr.y < last.y + last.height + CROP_PADDING * 2;

    if (overlapX && overlapY) {
      // Merge: expand the last region to encompass both
      const newX = Math.min(last.x, curr.x);
      const newY = Math.min(last.y, curr.y);
      const newRight = Math.max(last.x + last.width, curr.x + curr.width);
      const newBottom = Math.max(last.y + last.height, curr.y + curr.height);
      last.x = newX;
      last.y = newY;
      last.width = newRight - newX;
      last.height = newBottom - newY;
    } else {
      merged.push(curr);
    }
  }

  return merged;
}
