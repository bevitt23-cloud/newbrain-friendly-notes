/**
 * Image utilities for extracting, resizing, and encoding uploaded images.
 * Used by the note generation pipeline to send images to the AI as vision input.
 */

/** Supported image MIME types */
const IMAGE_MIME_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/gif",
  "image/webp",
  "image/bmp",
  "image/tiff",
]);

/** Max images per generation request (Claude supports up to 20) */
export const MAX_IMAGES = 10;

/** Max dimension in pixels for the longest edge */
const MAX_DIMENSION = 1024;

/** JPEG compression quality */
const JPEG_QUALITY = 0.75;

export interface EncodedImage {
  /** Base64-encoded image data (no data URI prefix) */
  data: string;
  /** MIME type (e.g. image/jpeg) */
  mimeType: string;
  /** Original file name */
  fileName: string;
  /** Index in the images array — used for AI placeholder references */
  index: number;
}

/**
 * Check if a file is an image based on MIME type or extension.
 */
export function isImageFile(file: File): boolean {
  if (IMAGE_MIME_TYPES.has(file.type.toLowerCase())) return true;

  const ext = file.name.split(".").pop()?.toLowerCase();
  return ["png", "jpg", "jpeg", "gif", "webp", "bmp", "tiff", "tif"].includes(
    ext || "",
  );
}

/**
 * Resize an image to fit within MAX_DIMENSION and compress to JPEG.
 * Returns base64-encoded data without the data URI prefix.
 */
function resizeAndCompress(img: HTMLImageElement): {
  data: string;
  mimeType: string;
} {
  const canvas = document.createElement("canvas");
  let { width, height } = img;

  // Scale down if larger than max dimension
  if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
    if (width > height) {
      height = Math.round((height * MAX_DIMENSION) / width);
      width = MAX_DIMENSION;
    } else {
      width = Math.round((width * MAX_DIMENSION) / height);
      height = MAX_DIMENSION;
    }
  }

  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not get canvas context");

  // White background for transparent PNGs
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(img, 0, 0, width, height);

  // Convert to JPEG for smaller payload
  const dataUrl = canvas.toDataURL("image/jpeg", JPEG_QUALITY);
  const base64 = dataUrl.split(",")[1];

  return { data: base64, mimeType: "image/jpeg" };
}

/**
 * Load a File as an HTMLImageElement.
 */
function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error(`Failed to load image: ${file.name}`));
    };
    img.src = url;
  });
}

/**
 * Encode a single image file: load, resize, compress, and return base64.
 */
export async function encodeImage(
  file: File,
  index: number,
): Promise<EncodedImage> {
  const img = await loadImage(file);
  const { data, mimeType } = resizeAndCompress(img);
  return { data, mimeType, fileName: file.name, index };
}

/**
 * Process multiple files and extract/encode all images.
 * Non-image files are skipped.
 * Returns at most MAX_IMAGES encoded images.
 */
export async function extractImages(files: File[]): Promise<EncodedImage[]> {
  const imageFiles = files.filter(isImageFile).slice(0, MAX_IMAGES);
  const encoded: EncodedImage[] = [];

  for (let i = 0; i < imageFiles.length; i++) {
    try {
      const result = await encodeImage(imageFiles[i], i);
      encoded.push(result);
    } catch (err) {
      console.warn(`[ImageUtils] Failed to encode ${imageFiles[i].name}:`, err);
    }
  }

  return encoded;
}

/**
 * Build a data URI from base64 data and MIME type.
 */
export function toDataUri(data: string, mimeType: string): string {
  return `data:${mimeType};base64,${data}`;
}

/**
 * Create an EncodedImage from raw base64 data (used by PDF page rendering
 * which already produces correctly sized/compressed output).
 */
export function createEncodedImage(
  data: string,
  mimeType: string,
  fileName: string,
  index: number,
): EncodedImage {
  return { data, mimeType, fileName, index };
}

/**
 * Post-process generated HTML: replace AI image placeholders with actual images.
 *
 * The AI outputs: <figure data-image-index="N">...</figure>
 * This function injects the real <img> tag with the base64 data.
 */
export function injectImages(
  html: string,
  images: EncodedImage[],
): string {
  if (!images.length) return html;

  // Replace <figure data-image-index="N"> with actual image content
  return html.replace(
    /<figure\s+data-image-index="(\d+)"[^>]*>([\s\S]*?)<\/figure>/gi,
    (match, indexStr, innerContent) => {
      const idx = parseInt(indexStr, 10);
      const img = images.find((i) => i.index === idx);
      if (!img) return match;

      const dataUri = toDataUri(img.data, img.mimeType);

      // Preserve any existing figcaption
      const captionMatch = innerContent.match(
        /<figcaption[^>]*>([\s\S]*?)<\/figcaption>/i,
      );
      const caption = captionMatch
        ? captionMatch[0]
        : `<figcaption>${img.fileName}</figcaption>`;

      return `<figure class="note-image" data-image-index="${idx}">
        <img src="${dataUri}" alt="${img.fileName}" class="note-image-thumb" loading="lazy" />
        ${caption}
      </figure>`;
    },
  );
}
