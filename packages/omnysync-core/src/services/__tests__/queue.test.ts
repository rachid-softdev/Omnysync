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
const MockRedis = vi.hoisted(() => {
  const RedisClass = class MockRedis {
    static shouldThrow = false;
    exists = mockRedisExists;
    set = mockRedisSet;
    constructor() {
      if (MockRedis.shouldThrow) {
        throw new Error("Redis constructor failed");
      }
    }
  };
  return RedisClass;
});

vi.mock("@upstash/qstash", () => ({ Client: MockQStashClient }));
vi.mock("@upstash/redis", () => ({ Redis: MockRedis }));

import {
  generateIdempotencyKey,
  isJobCompleted,
  markJobCompleted,
  addToDeadLetter,
  processJobWithRetry,
  enqueueJob,
  enqueueSyncJob,
  enqueueImageUpload,
  enqueueAIImageGeneration,
  enqueueSEOProcessing,
  enqueueChangeDetection,
  receiveMessage,
  acknowledgeMessage,
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

    it("should return false from Redis when key does not exist", async () => {
      process.env.QSTASH_URL = "https://example.com";
      process.env.QSTASH_TOKEN = "token";

      mockRedisExists.mockResolvedValue(0 as never);
      const completed = await isJobCompleted("unknown-key");
      expect(completed).toBe(false);
    });

    it("should mark job completed in Redis when available", async () => {
      process.env.QSTASH_URL = "https://example.com";
      process.env.QSTASH_TOKEN = "token";

      mockRedisSet.mockResolvedValue("OK" as never);
      await markJobCompleted("redis-key", { synced: true });

      expect(mockRedisSet).toHaveBeenCalledWith(
        "queue:completed:redis-key",
        expect.stringContaining("synced"),
        { ex: 86400 },
      );
    });

    it("should propagate Redis error when Redis set fails (no fallback)", async () => {
      process.env.QSTASH_URL = "https://example.com";
      process.env.QSTASH_TOKEN = "token";

      mockRedisSet.mockRejectedValue(
        new Error("Redis connection error") as never,
      );

      await expect(
        markJobCompleted("fallback-key", { data: "test" }),
      ).rejects.toThrow("Redis connection error");

      expect(mockRedisSet).toHaveBeenCalled();
    });

    it("should handle expired in-memory entry", async () => {
      vi.useFakeTimers();

      await markJobCompleted("expiring-key");
      expect(await isJobCompleted("expiring-key")).toBe(true);

      // Advance time past the 24h TTL
      vi.advanceTimersByTime(25 * 60 * 60 * 1000);

      expect(await isJobCompleted("expiring-key")).toBe(false);

      vi.useRealTimers();
    });

    it("should fallback to in-memory when Redis constructor throws", async () => {
      process.env.QSTASH_URL = "https://example.com";
      process.env.QSTASH_TOKEN = "token";

      MockRedis.shouldThrow = true;

      // When Redis constructor throws, getRedis should return null,
      // falling back to in-memory tracking
      const completed = await isJobCompleted("throw-key");
      expect(completed).toBe(false);

      await markJobCompleted("throw-key", { fallback: true });

      const after = await isJobCompleted("throw-key");
      expect(after).toBe(true);

      MockRedis.shouldThrow = false;
    });

    it("should use in-memory fallback when env vars are not set (getRedis returns null early)", async () => {
      // Ensure env vars are not set (already done in beforeEach)
      const completed = await isJobCompleted("no-env-key");
      expect(completed).toBe(false);

      await markJobCompleted("no-env-key", { data: "memory" });
      expect(await isJobCompleted("no-env-key")).toBe(true);
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

    it("should skip already processed job (idempotency)", async () => {
      const processFn = vi.fn().mockResolvedValue({ published: true });
      const job = {
        id: "job-idemp",
        type: "sync_document" as const,
        payload: { documentId: "doc-idemp" },
      };

      // First call succeeds
      const result1 = await processJobWithRetry(job, processFn);
      expect(result1).toEqual({ published: true });
      expect(processFn).toHaveBeenCalledTimes(1);

      // Second call with same job should skip
      const result2 = await processJobWithRetry(job, processFn);
      expect(result2).toEqual({ skipped: true, reason: "already_processed" });
      // processFn should NOT have been called again
      expect(processFn).toHaveBeenCalledTimes(1);
    });

    // processJobWithRetry has built-in retry delays (RETRY_DELAYS array)
    // which can cause real setTimeout waits, so we set a generous timeout
    it(
      "should retry on failure and move to dead letter after max retries",
      { timeout: 60000 },
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

    it("should retry on first failure and succeed on second attempt", async () => {
      vi.useFakeTimers();

      const processFn = vi
        .fn()
        .mockRejectedValueOnce(new Error("Temporary error"))
        .mockResolvedValueOnce({ success: true });

      const job = {
        id: "job-retry",
        type: "sync_document" as const,
        payload: { documentId: "doc-retry" },
      };

      const promise = processJobWithRetry(job, processFn);

      // First attempt fails immediately, then retry delay of 1000ms
      // Advance past the first retry delay
      await vi.advanceTimersByTimeAsync(1000);

      const result = await promise;

      expect(result).toEqual({ success: true });
      expect(processFn).toHaveBeenCalledTimes(2);

      vi.useRealTimers();
    });

    it("should generate type-only idempotency key when no documentId in payload", async () => {
      const processFn = vi.fn().mockResolvedValue({ processed: true });

      const jobWithoutDoc = {
        id: "job-no-doc",
        type: "process_seo" as const,
        payload: {},
      };

      const result = await processJobWithRetry(jobWithoutDoc, processFn);

      expect(result).toEqual({ processed: true });
      expect(processFn).toHaveBeenCalledTimes(1);

      // Second call with same type should skip due to idempotency
      const result2 = await processJobWithRetry(jobWithoutDoc, processFn);
      expect(result2).toEqual({ skipped: true, reason: "already_processed" });
      expect(processFn).toHaveBeenCalledTimes(1);
    });
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

    it("should publish with malformed URL when NEXTAUTH_URL is not set", async () => {
      delete process.env.NEXTAUTH_URL;
      mockQstashPublish.mockResolvedValue({ messageId: "msg-3" } as never);

      const job = {
        id: "",
        type: "sync_document" as const,
        payload: { documentId: "doc-1" },
      };
      const jobId = await enqueueJob(job);

      expect(jobId).toBeDefined();
      expect(mockQstashPublish).toHaveBeenCalledWith({
        url: "undefined/api/queue",
        body: expect.any(String),
      });
    });

    it("should accept a custom idempotency key", async () => {
      process.env.NEXTAUTH_URL = "https://app.omnysync.com";
      mockQstashPublish.mockResolvedValue({ messageId: "msg-4" } as never);

      const job = {
        id: "",
        type: "sync_document" as const,
        payload: { documentId: "doc-1" },
      };
      const jobId = await enqueueJob(job, undefined, "custom-idempotency-key");

      expect(jobId).toBeDefined();
      expect(mockQstashPublish).toHaveBeenCalledWith({
        url: "https://app.omnysync.com/api/queue",
        body: expect.stringContaining("custom-idempotency-key"),
      });
    });

    it("should generate a unique job ID for each call", async () => {
      process.env.NEXTAUTH_URL = "https://app.omnysync.com";
      mockQstashPublish.mockResolvedValue({ messageId: "msg-5" } as never);

      const job = {
        id: "",
        type: "sync_document" as const,
        payload: { documentId: "doc-1" },
      };
      const jobId1 = await enqueueJob(job);
      const jobId2 = await enqueueJob(job);

      expect(jobId1).not.toBe(jobId2);
    });
  });

  describe("enqueueSyncJob", () => {
    it("should enqueue a sync job without options", async () => {
      process.env.NEXTAUTH_URL = "https://app.omnysync.com";
      mockQstashPublish.mockResolvedValue({ messageId: "msg-s1" } as never);

      const jobId = await enqueueSyncJob("doc-1", "source-1", "dest-1");

      expect(jobId).toBeDefined();
      expect(mockQstashPublish).toHaveBeenCalledWith({
        url: "https://app.omnysync.com/api/queue",
        body: expect.stringContaining("sync_document"),
      });
    });

    it("should enqueue a sync job with delay and priority options", async () => {
      process.env.NEXTAUTH_URL = "https://app.omnysync.com";
      mockQstashPublish.mockResolvedValue({ messageId: "msg-s2" } as never);

      const jobId = await enqueueSyncJob("doc-1", "source-1", "dest-1", {
        delay: 3600,
        priority: 5,
      });

      expect(jobId).toBeDefined();
      expect(mockQstashPublish).toHaveBeenCalledWith(
        expect.objectContaining({
          url: "https://app.omnysync.com/api/queue",
          scheduledAt: expect.any(Number),
        }),
      );
    });
  });

  describe("enqueueImageUpload", () => {
    it("should enqueue an image upload job", async () => {
      process.env.NEXTAUTH_URL = "https://app.omnysync.com";
      mockQstashPublish.mockResolvedValue({ messageId: "msg-i1" } as never);

      const jobId = await enqueueImageUpload(
        "doc-1",
        "https://example.com/image.png",
        "dest-1",
      );

      expect(jobId).toBeDefined();
      expect(mockQstashPublish).toHaveBeenCalledWith({
        url: "https://app.omnysync.com/api/queue",
        body: expect.stringContaining("upload_image"),
      });
    });
  });

  describe("enqueueAIImageGeneration", () => {
    it("should enqueue an AI image generation job", async () => {
      process.env.NEXTAUTH_URL = "https://app.omnysync.com";
      mockQstashPublish.mockResolvedValue({ messageId: "msg-ai1" } as never);

      const jobId = await enqueueAIImageGeneration(
        "doc-1",
        "Generate a hero image",
      );

      expect(jobId).toBeDefined();
      expect(mockQstashPublish).toHaveBeenCalledWith({
        url: "https://app.omnysync.com/api/queue",
        body: expect.stringContaining("generate_ai_image"),
      });
    });
  });

  describe("enqueueSEOProcessing", () => {
    it("should enqueue an SEO processing job", async () => {
      process.env.NEXTAUTH_URL = "https://app.omnysync.com";
      mockQstashPublish.mockResolvedValue({ messageId: "msg-seo1" } as never);

      const jobId = await enqueueSEOProcessing("doc-1");

      expect(jobId).toBeDefined();
      expect(mockQstashPublish).toHaveBeenCalledWith({
        url: "https://app.omnysync.com/api/queue",
        body: expect.stringContaining("process_seo"),
      });
    });
  });

  describe("enqueueChangeDetection", () => {
    it("should enqueue a change detection job", async () => {
      process.env.NEXTAUTH_URL = "https://app.omnysync.com";
      mockQstashPublish.mockResolvedValue({ messageId: "msg-c1" } as never);

      const jobId = await enqueueChangeDetection("doc-1");

      expect(jobId).toBeDefined();
      expect(mockQstashPublish).toHaveBeenCalledWith({
        url: "https://app.omnysync.com/api/queue",
        body: expect.stringContaining("detect_changes"),
      });
    });
  });

  describe("receiveMessage / acknowledgeMessage", () => {
    it("receiveMessage should return null (stub)", async () => {
      const consoleWarn = vi
        .spyOn(console, "warn")
        .mockImplementation(() => {});
      const msg = await receiveMessage();
      expect(msg).toBeNull();
      consoleWarn.mockRestore();
    });

    it("acknowledgeMessage should not throw (stub)", async () => {
      const consoleWarn = vi
        .spyOn(console, "warn")
        .mockImplementation(() => {});
      await expect(acknowledgeMessage("msg-1")).resolves.toBeUndefined();
      consoleWarn.mockRestore();
    });
  });

  describe("enqueueJob with special characters", () => {
    it("should handle payload with special characters", async () => {
      process.env.NEXTAUTH_URL = "https://app.omnysync.com";
      mockQstashPublish.mockResolvedValue({ messageId: "msg-sp" } as never);

      const job = {
        id: "",
        type: "sync_document" as const,
        payload: { documentId: "doc-1", note: "héllo wörld & spécial chars!" },
      };
      const jobId = await enqueueJob(job);

      expect(jobId).toBeDefined();
      // Body should contain the special characters properly serialized
      expect(mockQstashPublish).toHaveBeenCalledWith({
        url: "https://app.omnysync.com/api/queue",
        body: expect.stringContaining("spécial"),
      });
    });
  });
});
