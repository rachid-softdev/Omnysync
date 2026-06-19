/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockQstashPublish = vi.hoisted(() => vi.fn());
const mockRedisExists = vi.hoisted(() => vi.fn());
const mockRedisSet = vi.hoisted(() => vi.fn());
const MockQStashClient = vi.hoisted(
  () =>
    class MockQStashClient {
      publish = mockQstashPublish;
    },
);
const MockRedis = vi.hoisted(
  () =>
    class MockRedis {
      exists = mockRedisExists;
      set = mockRedisSet;
    },
);

vi.mock("@upstash/qstash", () => ({ Client: MockQStashClient }));
vi.mock("@upstash/redis", () => ({ Redis: MockRedis }));

import {
  generateIdempotencyKey,
  isJobCompleted,
  markJobCompleted,
  addToDeadLetter,
  processJobWithRetry,
  enqueueJob,
} from "../queue";

describe("Queue Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.QSTASH_URL;
    delete process.env.QSTASH_TOKEN;
  });

  describe("generateIdempotencyKey", () => {
    it("should generate the same key for same type and doc (deterministic)", () => {
      const key1 = generateIdempotencyKey("sync_document", "doc-1");
      const key2 = generateIdempotencyKey("sync_document", "doc-1");
      expect(key1).toBe(key2);
      expect(key1.length).toBe(32);
      expect(typeof key1).toBe("string");
    });

    it("should generate a key without document ID", () => {
      const key = generateIdempotencyKey("sync_document");
      expect(key.length).toBe(32);
    });
  });

  describe("isJobCompleted / markJobCompleted", () => {
    it("should use in-memory fallback when Redis is unavailable", async () => {
      const completed = await isJobCompleted("test-key");
      expect(completed).toBe(false);

      await markJobCompleted("test-key", { success: true });

      const after = await isJobCompleted("test-key");
      expect(after).toBe(true);
    });

    it("should use Redis when available", async () => {
      process.env.QSTASH_URL = "https://example.com";
      process.env.QSTASH_TOKEN = "token";

      mockRedisExists.mockResolvedValue(1 as never);
      const completed = await isJobCompleted("redis-key");
      expect(completed).toBe(true);
    });
  });

  describe("addToDeadLetter", () => {
    it("should log the dead letter job", async () => {
      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});
      const job = {
        id: "job-1",
        type: "sync_document" as const,
        payload: { documentId: "doc-1" },
      };

      await addToDeadLetter(job, "Failed after 3 attempts", 3);

      expect(consoleSpy).toHaveBeenCalledWith(
        "Job moved to dead letter queue:",
        expect.objectContaining({ jobId: "job-1", attempts: 3 }),
      );
      consoleSpy.mockRestore();
    });
  });

  describe("processJobWithRetry", () => {
    it("should process job successfully", async () => {
      const processFn = vi.fn().mockResolvedValue({ published: true });
      const job = {
        id: "job-1",
        type: "sync_document" as const,
        payload: { documentId: "doc-1" },
      };

      const result = await processJobWithRetry(job, processFn);

      expect(result).toEqual({ published: true });
      expect(processFn).toHaveBeenCalledTimes(1);
    });

    // processJobWithRetry has built-in retry delays (RETRY_DELAYS array)
    // which can cause real setTimeout waits, so we set a generous timeout
    it(
      "should retry on failure and move to dead letter after max retries",
      { timeout: 20000 },
      async () => {
        const processFn = vi.fn().mockRejectedValue(new Error("Network error"));
        const job = {
          id: "job-2",
          type: "sync_document" as const,
          payload: { documentId: "doc-2" },
        };

        const consoleSpy = vi
          .spyOn(console, "error")
          .mockImplementation(() => {});

        await expect(processJobWithRetry(job, processFn)).rejects.toThrow(
          "Network error",
        );

        expect(processFn).toHaveBeenCalledTimes(3);
        consoleSpy.mockRestore();
      },
    );
  });

  describe("enqueueJob", () => {
    it("should publish a job to QStash", async () => {
      process.env.NEXTAUTH_URL = "https://app.omnysync.com";
      mockQstashPublish.mockResolvedValue({ messageId: "msg-1" } as never);

      const job = {
        id: "",
        type: "sync_document" as const,
        payload: { documentId: "doc-1" },
      };
      const jobId = await enqueueJob(job);

      expect(jobId).toBeDefined();
      expect(mockQstashPublish).toHaveBeenCalledWith({
        url: "https://app.omnysync.com/api/queue",
        body: expect.stringContaining("sync_document"),
      });
    });

    it("should publish with delay when specified", async () => {
      process.env.NEXTAUTH_URL = "https://app.omnysync.com";
      mockQstashPublish.mockResolvedValue({ messageId: "msg-2" } as never);

      const job = {
        id: "",
        type: "sync_document" as const,
        payload: { documentId: "doc-1" },
      };
      await enqueueJob(job, 3600);

      expect(mockQstashPublish).toHaveBeenCalledWith(
        expect.objectContaining({ scheduledAt: expect.any(Number) }),
      );
    });
  });
});
