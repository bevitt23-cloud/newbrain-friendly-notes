/**
 * Bionic reading: bold the leading ~40% of each word so the eye anchors
 * faster. Operates on the HTML string before sanitization, transforming
 * only the visible text between tags (never tag names or attributes).
 *
 * Used by every surface that renders note HTML so the effect is consistent
 * across freshly generated notes and saved library notes.
 *
 * Two safeguards:
 *  - Tracks a tag stack and skips text inside interactive/code elements
 *    (button, textarea, input, …) so labels like "Check" aren't split.
 *  - Leaves HTML entities (&amp;, &#39;, …) untouched so they aren't corrupted.
 */

const SKIP_TAGS = /^(button|textarea|input|select|option|summary|code|pre)$/i;

function bionicizeText(text: string): string {
  // Odd-indexed parts are HTML entities — never bold inside them.
  return text
    .split(/(&[#\w]+;)/g)
    .map((part, i) =>
      i % 2 === 1
        ? part
        : part.replace(/\b(\w{2,})\b/g, (word: string) => {
            const boldLen = Math.ceil(word.length * 0.4);
            return `<span class="bionic-bold" style="font-weight:700">${word.slice(0, boldLen)}</span>${word.slice(boldLen)}`;
          })
    )
    .join("");
}

export function applyBionic(html: string): string {
  const tagStack: string[] = [];

  return html.replace(
    /<\/?([a-z][a-z0-9]*)[^>]*>|>([^<]+)</gi,
    (match, tagName?: string, textNode?: string) => {
      if (tagName) {
        if (match.startsWith("</")) tagStack.pop();
        else if (!match.endsWith("/>")) tagStack.push(tagName.toLowerCase());
        return match;
      }
      if (textNode != null) {
        if (tagStack.some((t) => SKIP_TAGS.test(t))) return match;
        return `>${bionicizeText(textNode)}<`;
      }
      return match;
    }
  );
}
