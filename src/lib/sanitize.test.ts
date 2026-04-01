import { describe, expect, it } from "vitest";
import { sanitizeHtml } from "./sanitize";

describe("sanitizeHtml", () => {
  it("preserves safe HTML tags", () => {
    const input = "<h1>Title</h1><p>Paragraph</p><ul><li>Item</li></ul>";
    expect(sanitizeHtml(input)).toBe(input);
  });

  it("preserves allowed custom data attributes", () => {
    const input = '<span data-definition="term">word</span>';
    expect(sanitizeHtml(input)).toContain('data-definition="term"');
  });

  it("preserves section, details, summary tags", () => {
    const input = "<details><summary>Click</summary><p>Content</p></details>";
    expect(sanitizeHtml(input)).toContain("<details>");
    expect(sanitizeHtml(input)).toContain("<summary>");
  });

  it("strips script tags", () => {
    const input = '<p>Hello</p><script>alert("xss")</script>';
    const result = sanitizeHtml(input);
    expect(result).not.toContain("<script");
    expect(result).not.toContain("alert");
    expect(result).toContain("<p>Hello</p>");
  });

  it("strips iframe tags", () => {
    const input = '<p>Safe</p><iframe src="http://evil.com"></iframe>';
    const result = sanitizeHtml(input);
    expect(result).not.toContain("<iframe");
    expect(result).toContain("<p>Safe</p>");
  });

  it("strips event handler attributes", () => {
    const input = '<img src="x" onerror="alert(1)">';
    const result = sanitizeHtml(input);
    expect(result).not.toContain("onerror");
  });

  it("strips onclick attributes", () => {
    const input = '<button onclick="alert(1)">Click</button>';
    const result = sanitizeHtml(input);
    expect(result).not.toContain("onclick");
    expect(result).toContain("Click");
  });

  it("strips style tags", () => {
    const input = "<style>body{display:none}</style><p>Visible</p>";
    const result = sanitizeHtml(input);
    expect(result).not.toContain("<style");
    expect(result).toContain("<p>Visible</p>");
  });

  it("strips form and input tags", () => {
    const input = '<form action="/steal"><input name="pw"></form><p>Safe</p>';
    const result = sanitizeHtml(input);
    expect(result).not.toContain("<form");
    expect(result).not.toContain("<input");
    expect(result).toContain("<p>Safe</p>");
  });

  it("handles empty string", () => {
    expect(sanitizeHtml("")).toBe("");
  });

  it("handles plain text (no HTML)", () => {
    expect(sanitizeHtml("Just plain text")).toBe("Just plain text");
  });
});
