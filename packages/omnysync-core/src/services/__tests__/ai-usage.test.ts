/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockPrisma = vi.hoisted(() => ({
  aiUsageLog: {
    create: vi.fn(),
    aggregate: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
  },
}));

vi.mock("../../prisma", () => ({ prisma: mockPrisma }));

import { logAIUsage, getAIUsageStats } from "../ai-usage";

describe("AI Usage Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("logAIUsage", () => {
    it("should log usage data to console (and optionally DB)", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      await logAIUsage({
        userId: "user-1",
        model: "gpt-4o",
        feature: "generateSEO",
        tokens: 500,
        costEstimate: 0.0025,
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        "AI Usage:",
        expect.objectContaining({
          model: "gpt-4o",
          feature: "generateSEO",
          tokens: 500,
        }),
      );
      consoleSpy.mockRestore();
    });

    it("should not throw when logging fails", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {
        throw new Error("Console error");
      });
      const consoleErrorSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      await expect(
        logAIUsage({
          userId: null,
          model: "gpt-4o",
          feature: "test",
          tokens: 10,
          costEstimate: 0.0001,
        }),
      ).resolves.toBeUndefined();

      consoleSpy.mockRestore();
      consoleErrorSpy.mockRestore();
    });
  });

  describe("getAIUsageStats", () => {
    it("should return zero stats when no data", async () => {
      const result = await getAIUsageStats("user-1");

      expect(result.totalTokens).toBe(0);
      expect(result.totalCost).toBe(0);
      expect(result.requestCount).toBe(0);
    });

    it("should return stats with date filtering", async () => {
      const startDate = new Date("2026-01-01");
      const endDate = new Date("2026-06-01");

      const result = await getAIUsageStats("user-1", startDate, endDate);

      expect(result.period.start).toEqual(startDate);
      expect(result.period.end).toEqual(endDate);
      expect(result.totalTokens).toBe(0);
    });
  });
});
