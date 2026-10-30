import { beforeEach, describe, expect, it, vi } from "vitest";

const mockPrisma = vi.hoisted(() => ({
  notificationPreference: { findUnique: vi.fn() },
}));

vi.mock("../../prisma", () => ({ prisma: mockPrisma }));

import { shouldSendNotification } from "../notification-preferences";

describe("shouldSendNotification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("defaults to true when the user has no preference row", async () => {
    mockPrisma.notificationPreference.findUnique.mockResolvedValue(null);

    await expect(shouldSendNotification("user-1", "syncSuccess")).resolves.toBe(
      true,
    );
  });

  it("returns the persisted value for the requested key", async () => {
    mockPrisma.notificationPreference.findUnique.mockResolvedValue({
      syncSuccess: false,
      syncFailed: true,
      teamInvites: false,
    });

    await expect(shouldSendNotification("user-1", "syncSuccess")).resolves.toBe(
      false,
    );
    await expect(shouldSendNotification("user-1", "syncFailed")).resolves.toBe(
      true,
    );
    await expect(shouldSendNotification("user-1", "teamInvites")).resolves.toBe(
      false,
    );
  });

  it("defaults to true when the preference lookup fails", async () => {
    mockPrisma.notificationPreference.findUnique.mockRejectedValue(
      new Error("db down"),
    );

    await expect(shouldSendNotification("user-1", "syncFailed")).resolves.toBe(
      true,
    );
  });
});
