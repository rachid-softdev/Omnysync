import { createHmac } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockPrisma = vi.hoisted(() => ({
  webhookEndpoint: { findMany: vi.fn() },
  syncLog: { create: vi.fn() },
}));

vi.mock("../../prisma", () => ({ prisma: mockPrisma }));

const { mockPostJson, UnsafeOutboundUrlError } = vi.hoisted(() => {
  class UnsafeOutboundUrlError extends Error {
    constructor(message: string) {
      super(message);
      this.name = "UnsafeOutboundUrlError";
    }
  }

  return { mockPostJson: vi.fn(), UnsafeOutboundUrlError };
});

vi.mock("../safe-fetch", () => ({
  postJsonWithPinnedDns: mockPostJson,
  UnsafeOutboundUrlError,
}));

import { dispatchSyncWebhooks } from "../webhooks";

const input = {
  organizationId: "org-1",
  connectorId: "conn-dest",
  documentId: "doc-1",
  documentTitle: "Launch notes",
  userId: "user-1",
  success: true,
};

describe("dispatchSyncWebhooks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.syncLog.create.mockResolvedValue({} as any);
    mockPostJson.mockResolvedValue({
      ok: true,
      status: 200,
      body: "",
      headers: {},
    });
  });

  it("does nothing when the destination has no active endpoints", async () => {
    mockPrisma.webhookEndpoint.findMany.mockResolvedValue([]);

    await dispatchSyncWebhooks(input);

    expect(mockPrisma.webhookEndpoint.findMany).toHaveBeenCalledWith({
      where: {
        organizationId: "org-1",
        connectorId: "conn-dest",
        isActive: true,
      },
      select: { id: true, url: true, secret: true, type: true },
    });
    expect(mockPostJson).not.toHaveBeenCalled();
    expect(mockPrisma.syncLog.create).not.toHaveBeenCalled();
  });

  it("posts a signed payload to every active endpoint", async () => {
    mockPrisma.webhookEndpoint.findMany.mockResolvedValue([
      {
        id: "wh-1",
        url: "https://example.com/hooks/one",
        secret: "top-secret",
        type: "WORDPRESS",
      },
      {
        id: "wh-2",
        url: "https://example.com/hooks/two",
        secret: null,
        type: "GHOST",
      },
    ]);

    await dispatchSyncWebhooks(input);

    expect(mockPostJson).toHaveBeenCalledTimes(2);

    const [url, body, headers] = mockPostJson.mock.calls[0];
    expect(url).toBe("https://example.com/hooks/one");
    expect(headers["X-Omnysync-Event"]).toBe("sync.completed");
    expect(headers["X-Omnysync-Signature"]).toMatch(/^sha256=[0-9a-f]{64}$/);

    const timestamp = headers["X-Omnysync-Timestamp"];
    const expected = createHmac("sha256", "top-secret")
      .update(`${timestamp}.${body}`)
      .digest("hex");
    expect(headers["X-Omnysync-Signature"]).toBe(`sha256=${expected}`);

    const payload = JSON.parse(body);
    expect(payload.event).toBe("sync.completed");
    expect(payload.document).toMatchObject({
      id: "doc-1",
      title: "Launch notes",
    });
    expect(payload.document.url).toContain("/dashboard/documents/doc-1");

    const [, , unsignedHeaders] = mockPostJson.mock.calls[1];
    expect(unsignedHeaders["X-Omnysync-Signature"]).toBeUndefined();

    expect(mockPrisma.syncLog.create).toHaveBeenCalledTimes(2);
    expect(mockPrisma.syncLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "webhook_delivered",
          status: "SUCCESS",
          documentId: "doc-1",
          details: expect.objectContaining({
            webhookId: "wh-1",
            event: "sync.completed",
            responseStatus: 200,
          }),
        }),
      }),
    );
  });

  it("logs a failed delivery without throwing", async () => {
    mockPrisma.webhookEndpoint.findMany.mockResolvedValue([
      {
        id: "wh-1",
        url: "https://example.com/hooks/one",
        secret: "top-secret",
        type: "WORDPRESS",
      },
    ]);
    mockPostJson.mockRejectedValue(new Error("connection refused"));

    await expect(dispatchSyncWebhooks(input)).resolves.toBeUndefined();

    expect(mockPrisma.syncLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "webhook_failed",
          status: "ERROR",
          message: expect.stringContaining("connection refused"),
          details: expect.objectContaining({ webhookId: "wh-1" }),
        }),
      }),
    );
  });

  it("reports a rejected target as a failed delivery", async () => {
    mockPrisma.webhookEndpoint.findMany.mockResolvedValue([
      {
        id: "wh-1",
        url: "http://127.0.0.1/hook",
        secret: null,
        type: "WORDPRESS",
      },
    ]);
    mockPostJson.mockRejectedValue(
      new UnsafeOutboundUrlError("Webhook URL must point to a public host"),
    );

    await dispatchSyncWebhooks(input);

    expect(mockPrisma.syncLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "webhook_failed",
          message: expect.stringContaining("Webhook URL rejected"),
        }),
      }),
    );
  });

  it("continues delivering to other endpoints when one fails", async () => {
    mockPrisma.webhookEndpoint.findMany.mockResolvedValue([
      {
        id: "wh-1",
        url: "https://example.com/hooks/one",
        secret: null,
        type: "WORDPRESS",
      },
      {
        id: "wh-2",
        url: "https://example.com/hooks/two",
        secret: null,
        type: "GHOST",
      },
    ]);
    mockPostJson
      .mockRejectedValueOnce(new Error("first failed"))
      .mockResolvedValueOnce({ ok: true, status: 204, body: "", headers: {} });

    await dispatchSyncWebhooks(input);

    expect(mockPostJson).toHaveBeenCalledTimes(2);
    expect(mockPrisma.syncLog.create).toHaveBeenCalledTimes(2);
  });

  it("does not throw when the endpoint query fails", async () => {
    mockPrisma.webhookEndpoint.findMany.mockRejectedValue(new Error("db down"));

    await expect(dispatchSyncWebhooks(input)).resolves.toBeUndefined();
    expect(mockPostJson).not.toHaveBeenCalled();
  });
});
