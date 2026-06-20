/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockPrisma = vi.hoisted(() => ({
  document: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
  },
  syncLog: { create: vi.fn() },
}));

vi.mock("../../prisma", () => ({ prisma: mockPrisma }));

// Mock sync module
vi.mock("../sync", () => ({
  performSync: vi.fn(),
}));

import { prisma } from "../../prisma";
import { performSync } from "../sync";
import {
  calculateNextSync,
  scheduleSync,
  disableScheduledSync,
  runScheduledSyncs,
  handleScheduledSyncRun,
} from "../scheduler";

describe("Scheduler Service", () => {
  const documentId = "doc-1";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("calculateNextSync", () => {
    it("should return tomorrow 9am for DAILY", () => {
      const result = calculateNextSync("DAILY");
      const now = new Date();
      expect(result.getDate()).toBe(now.getDate() + 1);
      expect(result.getHours()).toBe(9);
      expect(result.getMinutes()).toBe(0);
    });

    it("should return next Monday 9am for WEEKLY", () => {
      const now = new Date();
      const result = calculateNextSync("WEEKLY");
      expect(result.getHours()).toBe(9);
      // Monday = 1 in getDay()
      const dayDiff =
        (result.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
      expect(dayDiff).toBeGreaterThanOrEqual(0);
      expect(dayDiff).toBeLessThanOrEqual(8);
    });

    it("should return first day of next month 9am for MONTHLY", () => {
      const result = calculateNextSync("MONTHLY");
      expect(result.getDate()).toBe(1);
      expect(result.getHours()).toBe(9);
    });

    it("should handle December month boundary for MONTHLY frequency", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2024, 11, 15, 10, 0, 0));
      const result = calculateNextSync("MONTHLY");
      expect(result.getFullYear()).toBe(2025);
      expect(result.getMonth()).toBe(0);
      expect(result.getDate()).toBe(1);
      expect(result.getHours()).toBe(9);
      expect(result.getMinutes()).toBe(0);
      vi.useRealTimers();
    });

    it("should handle invalid frequency with fallback", () => {
      const result = calculateNextSync("INVALID" as any);
      expect(result).toBeInstanceOf(Date);
    });

    it("should return the next day (Monday) for WEEKLY on Sunday", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2024, 0, 7, 10, 0, 0)); // Sunday Jan 7, 2024
      const result = calculateNextSync("WEEKLY");
      expect(result.getDay()).toBe(1); // Monday
      expect(result.getDate()).toBe(8); // Jan 8
      expect(result.getMonth()).toBe(0); // January
      expect(result.getFullYear()).toBe(2024);
      expect(result.getHours()).toBe(9);
      expect(result.getMinutes()).toBe(0);
      expect(result.getSeconds()).toBe(0);
      vi.useRealTimers();
    });

    it("should return 7 days later (next Monday) for WEEKLY on Monday", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2024, 0, 1, 10, 0, 0)); // Monday Jan 1, 2024
      const result = calculateNextSync("WEEKLY");
      expect(result.getDay()).toBe(1); // Monday
      expect(result.getDate()).toBe(8); // Jan 8 — 7 days later
      expect(result.getMonth()).toBe(0);
      expect(result.getFullYear()).toBe(2024);
      expect(result.getHours()).toBe(9);
      expect(result.getMinutes()).toBe(0);
      vi.useRealTimers();
    });

    it("should handle January to February for MONTHLY frequency (same year)", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2024, 0, 15, 10, 0, 0)); // Jan 15, 2024
      const result = calculateNextSync("MONTHLY");
      expect(result.getFullYear()).toBe(2024);
      expect(result.getMonth()).toBe(1); // February
      expect(result.getDate()).toBe(1);
      expect(result.getHours()).toBe(9);
      expect(result.getMinutes()).toBe(0);
      vi.useRealTimers();
    });
  });

  describe("scheduleSync", () => {
    it("should update document with sync schedule", async () => {
      vi.mocked(prisma.document.update).mockResolvedValue({} as any);

      const result = await scheduleSync(documentId, "DAILY");

      expect(result.success).toBe(true);
      expect(prisma.document.update).toHaveBeenCalledWith({
        where: { id: documentId },
        data: expect.objectContaining({
          autoSyncEnabled: true,
          syncFrequency: "DAILY",
          nextSyncAt: expect.any(Date),
        }),
      });
    });

    it("should handle errors", async () => {
      vi.mocked(prisma.document.update).mockRejectedValue(
        new Error("DB error"),
      );

      const result = await scheduleSync(documentId, "WEEKLY");

      expect(result.success).toBe(false);
      expect(result.error).toBe("DB error");
    });
  });

  describe("disableScheduledSync", () => {
    it("should disable scheduled sync", async () => {
      vi.mocked(prisma.document.update).mockResolvedValue({} as any);

      const result = await disableScheduledSync(documentId);

      expect(result).toBe(true);
      expect(prisma.document.update).toHaveBeenCalledWith({
        where: { id: documentId },
        data: expect.objectContaining({
          autoSyncEnabled: false,
          syncFrequency: "MANUAL",
          nextSyncAt: null,
        }),
      });
    });

    it("should return false on error", async () => {
      vi.mocked(prisma.document.update).mockRejectedValue(
        new Error("DB error"),
      );

      const result = await disableScheduledSync(documentId);

      expect(result).toBe(false);
    });
  });

  describe("runScheduledSyncs", () => {
    it("should execute scheduled syncs for today", async () => {
      vi.mocked(prisma.document.findMany).mockResolvedValue([
        {
          id: documentId,
          organizationId: "org-1",
          userId: "user-1",
          sourceConnectorId: "sc-1",
          destConnectorId: "dc-1",
          syncFrequency: "DAILY",
          status: "PUBLISHED",
          syncStatus: "SYNCED",
          sourceConnector: { id: "sc-1" },
          destConnector: { id: "dc-1" },
        },
      ] as any);
      vi.mocked(performSync).mockResolvedValue({ success: true } as any);
      vi.mocked(prisma.document.update).mockResolvedValue({} as any);

      const result = await runScheduledSyncs();

      expect(result.executed).toBe(1);
      expect(result.failed).toBe(0);
      expect(performSync).toHaveBeenCalledWith(
        documentId,
        "sc-1",
        "dc-1",
        "user-1",
      );
    });

    it("should handle sync errors and log them", async () => {
      vi.mocked(prisma.document.findMany).mockResolvedValue([
        {
          id: documentId,
          organizationId: "org-1",
          userId: "user-1",
          sourceConnectorId: "sc-1",
          destConnectorId: "dc-1",
          syncFrequency: "DAILY",
          status: "PUBLISHED",
          syncStatus: "SYNCED",
          sourceConnector: { id: "sc-1" },
          destConnector: { id: "dc-1" },
        },
      ] as any);
      vi.mocked(performSync).mockRejectedValue(new Error("Sync failed"));
      vi.mocked(prisma.syncLog.create).mockResolvedValue({} as any);

      const result = await runScheduledSyncs();

      expect(result.executed).toBe(0);
      expect(result.failed).toBe(1);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it("should return executed=0 when no documents scheduled", async () => {
      vi.mocked(prisma.document.findMany).mockResolvedValue([]);

      const result = await runScheduledSyncs();

      expect(result).toEqual({ executed: 0, failed: 0, errors: [] });
      expect(performSync).not.toHaveBeenCalled();
      expect(prisma.document.update).not.toHaveBeenCalled();
    });

    it("should handle missing sourceConnectorId or destConnectorId (silent skip)", async () => {
      vi.mocked(prisma.document.findMany).mockResolvedValue([
        {
          id: documentId,
          organizationId: "org-1",
          userId: "user-1",
          sourceConnectorId: null,
          destConnectorId: "dc-1",
          syncFrequency: "DAILY",
          status: "PUBLISHED",
          syncStatus: "SYNCED",
          sourceConnector: { id: "sc-1" },
          destConnector: { id: "dc-1" },
        },
      ] as any);

      const result = await runScheduledSyncs();

      expect(result.executed).toBe(0);
      expect(result.failed).toBe(0);
      expect(performSync).not.toHaveBeenCalled();
    });

    it("should update nextSyncAt after successful sync", async () => {
      vi.mocked(prisma.document.findMany).mockResolvedValue([
        {
          id: "doc-1",
          organizationId: "org-1",
          userId: "user-1",
          sourceConnectorId: "sc-1",
          destConnectorId: "dc-1",
          syncFrequency: "DAILY",
          status: "PUBLISHED",
          syncStatus: "SYNCED",
          sourceConnector: { id: "sc-1" },
          destConnector: { id: "dc-1" },
        },
      ] as any);
      vi.mocked(performSync).mockResolvedValue({ success: true } as any);
      vi.mocked(prisma.document.update).mockResolvedValue({} as any);

      await runScheduledSyncs();

      expect(prisma.document.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "doc-1" },
          data: expect.objectContaining({
            nextSyncAt: expect.any(Date),
          }),
        }),
      );
    });

    it("should handle partial failures across multiple documents", async () => {
      vi.mocked(prisma.document.findMany).mockResolvedValue([
        {
          id: "doc-success",
          organizationId: "org-1",
          userId: "user-1",
          sourceConnectorId: "sc-1",
          destConnectorId: "dc-1",
          syncFrequency: "DAILY",
          status: "PUBLISHED",
          syncStatus: "SYNCED",
          sourceConnector: { id: "sc-1" },
          destConnector: { id: "dc-1" },
        },
        {
          id: "doc-fail",
          organizationId: "org-1",
          userId: "user-1",
          sourceConnectorId: "sc-2",
          destConnectorId: "dc-2",
          syncFrequency: "DAILY",
          status: "PUBLISHED",
          syncStatus: "SYNCED",
          sourceConnector: { id: "sc-2" },
          destConnector: { id: "dc-2" },
        },
      ] as any);
      vi.mocked(performSync)
        .mockResolvedValueOnce({ success: true } as any)
        .mockRejectedValueOnce(new Error("Connection timeout"));
      vi.mocked(prisma.document.update).mockResolvedValue({} as any);
      vi.mocked(prisma.syncLog.create).mockResolvedValue({} as any);

      const result = await runScheduledSyncs();

      expect(result.executed).toBe(1);
      expect(result.failed).toBe(1);
      expect(result.errors.length).toBe(1);
      expect(result.errors[0]).toContain("doc-fail");
      expect(prisma.syncLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          documentId: "doc-fail",
          action: "scheduled_sync_failed",
          status: "ERROR",
        }),
      });
    });
  });

  describe("handleScheduledSyncRun", () => {
    it("should return error when document not found", async () => {
      vi.mocked(prisma.document.findUnique).mockResolvedValue(null);

      const result = await handleScheduledSyncRun(documentId);

      expect(result.success).toBe(false);
      expect(result.message).toBe("Document not found");
    });

    it("should perform sync for a valid document", async () => {
      vi.mocked(prisma.document.findUnique).mockResolvedValue({
        id: documentId,
        org: "org-1",
        userId: "user-1",
        autoSyncEnabled: true,
        sourceConnectorId: "sc-1",
        destConnectorId: "dc-1",
        syncFrequency: "DAILY",
        lastSyncedAt: null,
        sourceConnector: { id: "sc-1" },
        destConnector: { id: "dc-1" },
      } as any);
      vi.mocked(performSync).mockResolvedValue({ success: true } as any);
      vi.mocked(prisma.document.update).mockResolvedValue({} as any);

      const result = await handleScheduledSyncRun(documentId);

      expect(result.success).toBe(true);
    });

    it("should skip when autoSyncEnabled is false", async () => {
      vi.mocked(prisma.document.findUnique).mockResolvedValue({
        id: documentId,
        userId: "user-1",
        autoSyncEnabled: false,
        sourceConnectorId: "sc-1",
        destConnectorId: "dc-1",
        syncFrequency: "DAILY",
        lastSyncedAt: null,
        sourceConnector: { id: "sc-1" },
        destConnector: { id: "dc-1" },
      } as any);

      const result = await handleScheduledSyncRun(documentId);

      expect(result.success).toBe(false);
      expect(result.message).toBe("Sync not scheduled");
      expect(performSync).not.toHaveBeenCalled();
    });

    it("should skip when sync too recent (< 1 hour)", async () => {
      const now = Date.now();
      const fiveMinAgo = new Date(now - 5 * 60 * 1000);

      vi.mocked(prisma.document.findUnique).mockResolvedValue({
        id: documentId,
        userId: "user-1",
        autoSyncEnabled: true,
        sourceConnectorId: "sc-1",
        destConnectorId: "dc-1",
        syncFrequency: "DAILY",
        lastSyncedAt: fiveMinAgo,
        sourceConnector: { id: "sc-1" },
        destConnector: { id: "dc-1" },
      } as any);

      const result = await handleScheduledSyncRun(documentId);

      expect(result.success).toBe(true);
      expect(result.message).toBe("Skipped - sync too recent");
      expect(result.hoursSinceLastSync).toBeDefined();
      expect(result.hoursSinceLastSync).toBeGreaterThan(0);
      expect(result.hoursSinceLastSync).toBeLessThan(1);
      expect(performSync).not.toHaveBeenCalled();
    });

    it("should handle performSync returning soft failure { success: false }", async () => {
      vi.mocked(prisma.document.findUnique).mockResolvedValue({
        id: documentId,
        userId: "user-1",
        autoSyncEnabled: true,
        sourceConnectorId: "sc-1",
        destConnectorId: "dc-1",
        syncFrequency: "DAILY",
        lastSyncedAt: null,
        sourceConnector: { id: "sc-1" },
        destConnector: { id: "dc-1" },
      } as any);
      vi.mocked(performSync).mockResolvedValue({
        success: false,
        error: "API error",
      } as any);
      vi.mocked(prisma.document.update).mockResolvedValue({} as any);

      const result = await handleScheduledSyncRun(documentId);

      expect(result.success).toBe(false);
      expect(result.message).toBe("API error");
    });

    it("should not skip when last sync was more than 1 hour ago", async () => {
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);

      vi.mocked(prisma.document.findUnique).mockResolvedValue({
        id: documentId,
        userId: "user-1",
        autoSyncEnabled: true,
        sourceConnectorId: "sc-1",
        destConnectorId: "dc-1",
        syncFrequency: "DAILY",
        lastSyncedAt: twoHoursAgo,
        sourceConnector: { id: "sc-1" },
        destConnector: { id: "dc-1" },
      } as any);
      vi.mocked(performSync).mockResolvedValue({ success: true } as any);
      vi.mocked(prisma.document.update).mockResolvedValue({} as any);

      const result = await handleScheduledSyncRun(documentId);

      expect(result.success).toBe(true);
      expect(result.message).toBe("Sync completed");
      expect(performSync).toHaveBeenCalled();
    });

    it("should fall back to 'Sync failed' when performSync returns { success: false } without error field", async () => {
      vi.mocked(prisma.document.findUnique).mockResolvedValue({
        id: documentId,
        userId: "user-1",
        autoSyncEnabled: true,
        sourceConnectorId: "sc-1",
        destConnectorId: "dc-1",
        syncFrequency: "DAILY",
        lastSyncedAt: null,
        sourceConnector: { id: "sc-1" },
        destConnector: { id: "dc-1" },
      } as any);
      vi.mocked(performSync).mockResolvedValue({
        success: false,
        // No error field → should fall back to "Sync failed"
      } as any);
      vi.mocked(prisma.document.update).mockResolvedValue({} as any);

      const result = await handleScheduledSyncRun(documentId);

      expect(result.success).toBe(false);
      expect(result.message).toBe("Sync failed");
    });

    it("should skip when lastSync is exactly now (hoursSinceLastSync is 0, < 1 is true)", async () => {
      vi.mocked(prisma.document.findUnique).mockResolvedValue({
        id: documentId,
        userId: "user-1",
        autoSyncEnabled: true,
        sourceConnectorId: "sc-1",
        destConnectorId: "dc-1",
        syncFrequency: "DAILY",
        lastSyncedAt: new Date(), // exactly now → 0 hours
        sourceConnector: { id: "sc-1" },
        destConnector: { id: "dc-1" },
      } as any);

      const result = await handleScheduledSyncRun(documentId);

      expect(result.success).toBe(true);
      expect(result.message).toBe("Skipped - sync too recent");
      expect(result.hoursSinceLastSync).toBeDefined();
      expect(result.hoursSinceLastSync).toBeLessThan(1);
      expect(performSync).not.toHaveBeenCalled();
    });

    it("should handle result.error being empty string (falsy fallback to 'Sync failed')", async () => {
      vi.mocked(prisma.document.findUnique).mockResolvedValue({
        id: documentId,
        userId: "user-1",
        autoSyncEnabled: true,
        sourceConnectorId: "sc-1",
        destConnectorId: "dc-1",
        syncFrequency: "DAILY",
        lastSyncedAt: null,
        sourceConnector: { id: "sc-1" },
        destConnector: { id: "dc-1" },
      } as any);
      vi.mocked(performSync).mockResolvedValue({
        success: false,
        error: "", // empty string is falsy → fall back to "Sync failed"
      } as any);
      vi.mocked(prisma.document.update).mockResolvedValue({} as any);

      const result = await handleScheduledSyncRun(documentId);

      expect(result.success).toBe(false);
      expect(result.message).toBe("Sync failed");
    });

    it("should update lastSyncError when performSync throws", async () => {
      vi.mocked(prisma.document.findUnique).mockResolvedValue({
        id: documentId,
        userId: "user-1",
        autoSyncEnabled: true,
        sourceConnectorId: "sc-1",
        destConnectorId: "dc-1",
        syncFrequency: "DAILY",
        lastSyncedAt: null,
        sourceConnector: { id: "sc-1" },
        destConnector: { id: "dc-1" },
      } as any);
      vi.mocked(performSync).mockRejectedValue(new Error("Network error"));
      vi.mocked(prisma.document.update).mockResolvedValue({} as any);

      const result = await handleScheduledSyncRun(documentId);

      expect(result.success).toBe(false);
      expect(result.message).toBe("Network error");
      expect(prisma.document.update).toHaveBeenCalledWith({
        where: { id: documentId },
        data: expect.objectContaining({
          lastSyncError: "Network error",
        }),
      });
    });
  });
});
