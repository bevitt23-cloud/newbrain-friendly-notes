import DOMPurify from "dompurify";

/**
 * Sanitize HTML to prevent XSS attacks.
 * Allows safe tags used by AI-generated notes (headings, lists, spans, etc.)
 * while stripping scripts, event handlers, and dangerous attributes.
 */
export function sanitizeHtml(dirty: string): string {
  return DOMPurify.sanitize(dirty, {
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
      "data-formula",
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
