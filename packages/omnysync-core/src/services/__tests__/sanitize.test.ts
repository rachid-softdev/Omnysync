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
});
