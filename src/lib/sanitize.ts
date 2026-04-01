import DOMPurify from "dompurify";

/**
 * Sanitize HTML to prevent XSS attacks.
 * Allows safe tags used by AI-generated notes (headings, lists, spans, etc.)
 * while stripping scripts, event handlers, and dangerous attributes.
 */
export function sanitizeHtml(dirty: string): string {
  return DOMPurify.sanitize(dirty, {
    ADD_TAGS: ["section", "details", "summary"],
    ADD_ATTR: [
      "data-definition",
      "data-query",
      "data-mindmap",
      "data-flowchart",
      "tabindex",
      "role",
      "aria-label",
    ],
    FORBID_TAGS: ["style", "script", "iframe", "object", "embed", "form", "input"],
    FORBID_ATTR: ["onerror", "onload", "onclick", "onmouseover"],
  });
}
