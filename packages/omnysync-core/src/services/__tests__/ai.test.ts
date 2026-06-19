/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockCreate = vi.hoisted(() => vi.fn());
const mockImagesGenerate = vi.hoisted(() => vi.fn());
const MockOpenAI = vi.hoisted(
  () =>
    class MockOpenAI {
      chat = { completions: { create: mockCreate } };
      images = { generate: mockImagesGenerate };
    },
);

vi.mock("openai", () => ({ default: MockOpenAI }));
vi.mock("../ai-usage", () => ({ logAIUsage: vi.fn() }));

process.env.OPENAI_API_KEY = "sk-test-key";

import {
  generateSEO,
  generateAImage,
  improveContent,
  findInterlinkingOpportunities,
  generateExcerpt,
  detectContentChanges,
} from "../ai";

describe("AI Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("generateSEO", () => {
    it("should parse and return SEO data from response", async () => {
      mockCreate.mockResolvedValue({
        choices: [
          {
            message: {
              content: JSON.stringify({
                title: "SEO Title",
                description: "SEO Description",
                keywords: ["kw1", "kw2"],
              }),
            },
          },
        ],
        usage: { total_tokens: 100 },
      });

      const result = await generateSEO("Content here", "Original Title", {
        targetKeyword: "test",
      });

      expect(result.title).toBe("SEO Title");
      expect(result.description).toBe("SEO Description");
      expect(result.keywords).toEqual(["kw1", "kw2"]);
    });

    it("should fallback to original title on parse failure", async () => {
      mockCreate.mockResolvedValue({
        choices: [{ message: { content: "invalid json" } }],
        usage: null,
      });

      const result = await generateSEO("content", "Original Title");

      expect(result.title).toBe("Original Title");
      expect(result.keywords).toEqual([]);
    });

    it("should enforce max lengths", async () => {
      mockCreate.mockResolvedValue({
        choices: [
          {
            message: {
              content: JSON.stringify({
                title: "A".repeat(100),
                description: "B".repeat(200),
                keywords: ["kw"],
              }),
            },
          },
        ],
        usage: { total_tokens: 50 },
      });

      const result = await generateSEO("content", "Title", {
        maxTitleLength: 30,
        maxDescriptionLength: 50,
      });

      expect(result.title.length).toBeLessThanOrEqual(30);
      expect(result.description.length).toBeLessThanOrEqual(50);
    });

    it("should throw a user-friendly error on API failure", async () => {
      mockCreate.mockRejectedValue(new Error("API error"));

      await expect(generateSEO("content", "Title")).rejects.toThrow(
        "AI generation failed. Please try again.",
      );
    });
  });

  describe("generateAImage", () => {
    it("should return image URL from response", async () => {
      mockImagesGenerate.mockResolvedValue({
        data: [
          { url: "https://oaidalleapiprodscus.blob.core.windows.net/img.png" },
        ],
      });

      const result = await generateAImage("A cat");

      expect(result).toBe(
        "https://oaidalleapiprodscus.blob.core.windows.net/img.png",
      );
    });

    it("should return empty string when no image data", async () => {
      mockImagesGenerate.mockResolvedValue({ data: [] });

      const result = await generateAImage("A dog");

      expect(result).toBe("");
    });
  });

  describe("improveContent", () => {
    it("should return improved content from API", async () => {
      mockCreate.mockResolvedValue({
        choices: [{ message: { content: "Improved content" } }],
        usage: { total_tokens: 200 },
      });

      const result = await improveContent("Original content", "Make it better");

      expect(result).toBe("Improved content");
    });

    it("should fallback to original content on API failure", async () => {
      mockCreate.mockRejectedValue(new Error("API error"));

      await expect(
        improveContent("Original content", "Make it better"),
      ).rejects.toThrow("AI content improvement failed. Please try again.");
    });
  });

  describe("findInterlinkingOpportunities", () => {
    it("should parse interlinking data from response", async () => {
      mockCreate.mockResolvedValue({
        choices: [
          {
            message: {
              content: JSON.stringify({
                links: [{ url: "/page1", text: "Page 1", position: 1 }],
              }),
            },
          },
        ],
        usage: { total_tokens: 100 },
      });

      const result = await findInterlinkingOpportunities("Content with links", [
        { title: "Page 1", url: "/page1", excerpt: "About page 1" },
      ]);

      expect(result.links.length).toBe(1);
      expect(result.links[0].url).toBe("/page1");
    });

    it("should return empty links on failure", async () => {
      mockCreate.mockRejectedValue(new Error("API error"));

      await expect(
        findInterlinkingOpportunities("content", []),
      ).rejects.toThrow("AI interlinking failed. Please try again.");
    });
  });

  describe("generateExcerpt", () => {
    it("should return plain text excerpt for short content", async () => {
      const result = await generateExcerpt("Short text", 160);

      expect(result).toBe("Short text");
      expect(mockCreate).not.toHaveBeenCalled();
    });

    it("should use API for long content", async () => {
      mockCreate.mockResolvedValue({
        choices: [{ message: { content: "AI generated excerpt" } }],
        usage: { total_tokens: 50 },
      });

      const longContent = "A".repeat(300);
      const result = await generateExcerpt(longContent, 160);

      expect(result).toBe("AI generated excerpt");
    });
  });

  describe("detectContentChanges", () => {
    it("should return hasChanges=true when API detects changes", async () => {
      mockCreate.mockResolvedValue({
        choices: [
          {
            message: {
              content: JSON.stringify({
                hasChanges: true,
                summary: "Title was updated",
              }),
            },
          },
        ],
        usage: { total_tokens: 100 },
      });

      const result = await detectContentChanges("Old", "New");

      expect(result.hasChanges).toBe(true);
      expect(result.summary).toBe("Title was updated");
    });

    it("should return hasChanges=false on API failure", async () => {
      mockCreate.mockRejectedValue(new Error("API error"));

      await expect(detectContentChanges("Old", "New")).rejects.toThrow(
        "AI content change detection failed. Please try again.",
      );
    });
  });
});
