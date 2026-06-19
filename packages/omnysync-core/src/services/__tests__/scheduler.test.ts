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
  });
});
