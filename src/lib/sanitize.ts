import DOMPurify from "dompurify";

/**
 * Sanitize HTML to prevent XSS attacks.
 * Allows safe tags used by AI-generated notes (headings, lists, spans, etc.)
 * while stripping scripts, event handlers, and dangerous attributes.
 */
export function sanitizeHtml(dirty: string): string {
  // Strip math-formula pill wrappers globally — AI wraps plain numbers/labels
  // in these spans which show misleading magnifying glass pills. Remove the
  // wrapper but keep the inner content. This runs before DOMPurify so it
  // catches saved notes loaded from the library, not just new generations.
  const cleaned = dirty.replace(
    /<span\s+class="math-formula"[^>]*>([\s\S]*?)<\/span>/gi,
    "$1",
  );

  return DOMPurify.sanitize(cleaned, {
    ADD_TAGS: ["section", "details", "summary", "button", "textarea", "figure", "figcaption", "img"],
    ADD_ATTR: [
      "data-definition",
      "data-query",
      "data-mindmap",
      "data-flowchart",
      "data-section-color",
      "data-section",
      "data-section-index",
      "data-concept",
      "data-image-index",
      "data-total-steps",
      "data-step",
      "tabindex",
      "role",
      "aria-label",
      "rows",
      "placeholder",
      "loading",
      "alt",
    ],
    ADD_URI_SAFE_ATTR: ["src"],
    FORBID_TAGS: ["style", "script", "iframe", "object", "embed", "form", "input"],
    FORBID_ATTR: ["onerror", "onload", "onclick", "onmouseover"],
    // Allow data: URIs for inline base64 images
    ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|tel|data):|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i,
  });
}
