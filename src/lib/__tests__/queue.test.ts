import { describe, it, expect, beforeEach, vi } from "vitest"
import {
  generateIdempotencyKey,
  isJobCompleted,
  markJobCompleted,
  addToDeadLetter,
  processJobWithRetry,
} from "../services/queue"

describe("generateIdempotencyKey", () => {
  it("creates consistent key format", () => {
    const key = generateIdempotencyKey("sync_document", "doc-123")

    expect(key).toHaveLength(32)
    expect(typeof key).toBe("string")
  })

  it("creates different keys for different types", () => {
    const key1 = generateIdempotencyKey("sync_document")
    const key2 = generateIdempotencyKey("upload_image")

    expect(key1).not.toBe(key2)
  })

  it("creates different keys for different document IDs", () => {
    const key1 = generateIdempotencyKey("sync_document", "doc-1")
    const key2 = generateIdempotencyKey("sync_document", "doc-2")

    expect(key1).not.toBe(key2)
  })

  it("creates key without documentId", () => {
    const key = generateIdempotencyKey("sync_document")

    expect(key).toHaveLength(32)
  })

  it("creates hexadecimal key", () => {
    const key = generateIdempotencyKey("sync_document", "doc-123")

    expect(key).toMatch(/^[a-f0-9]+$/)
  })
})

describe("isJobCompleted", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it("returns false for new job key", () => {
    const key = generateIdempotencyKey("sync_document", `new-doc-${Date.now()}`)
    const result = isJobCompleted(key)

    expect(result).toBe(false)
  })

  it("returns true for completed job", () => {
    const key = generateIdempotencyKey("sync_document", `completed-doc-${Date.now()}`)
    markJobCompleted(key, { result: "success" })

    const result = isJobCompleted(key)

    expect(result).toBe(true)
  })
})

describe("markJobCompleted", () => {
  it("marks job as completed without result", () => {
    const key = generateIdempotencyKey("sync_document", `mark-doc-${Date.now()}`)
    markJobCompleted(key)

    const result = isJobCompleted(key)

    expect(result).toBe(true)
  })

  it("marks job as completed with result", () => {
    const key = generateIdempotencyKey("sync_document", `mark-doc-${Date.now()}`)
    const testResult = { status: "synced" }
    markJobCompleted(key, testResult)

    const result = isJobCompleted(key)

    expect(result).toBe(true)
  })

  it("overwrites existing completion", () => {
    const key = generateIdempotencyKey("sync_document", `overwrite-${Date.now()}`)
    markJobCompleted(key, { first: true })

    // Mark again with different result
    markJobCompleted(key, { second: true })

    // Should still be marked as completed
    const result = isJobCompleted(key)
    expect(result).toBe(true)
  })
})

describe("addToDeadLetter", () => {
  it("logs dead letter job", () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {})

    const job = {
      id: "job-123",
      type: "sync_document" as const,
      payload: { documentId: "doc-123" },
    }

    addToDeadLetter(job, "Test error", 3)

    expect(consoleSpy).toHaveBeenCalledWith(
      "Job moved to dead letter queue:",
      expect.objectContaining({
        jobId: "job-123",
        jobType: "sync_document",
        attempts: 3,
      })
    )

    consoleSpy.mockRestore()
  })

  it("truncates long error messages", () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {})

    const job = {
      id: "job-456",
      type: "upload_image" as const,
      payload: {},
    }

    const longError = "x".repeat(1000)
    addToDeadLetter(job, longError, 1)

    expect(consoleSpy).toHaveBeenCalledWith(
      "Job moved to dead letter queue:",
      expect.objectContaining({
        error: expect.stringMatching(/^x{500}$/),
      })
    )

    consoleSpy.mockRestore()
  })
})

describe("processJobWithRetry", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it("processes job successfully on first attempt", async () => {
    const job = {
      id: "job-1",
      type: "sync_document" as const,
      payload: { documentId: "doc-1" },
    }

    const processFn = vi.fn().mockResolvedValue({ success: true })

    const result = await processJobWithRetry(job, processFn)

    expect(result).toEqual({ success: true })
    expect(processFn).toHaveBeenCalledTimes(1)
  })

  it("skips already processed jobs (idempotency)", async () => {
    const key = generateIdempotencyKey("sync_document", "doc-3")
    markJobCompleted(key, { skipped: true })

    const job = {
      id: "job-3",
      type: "sync_document" as const,
      payload: { documentId: "doc-3" },
    }

    const processFn = vi.fn().mockResolvedValue({ success: true })

    const result = await processJobWithRetry(job, processFn)

    expect(result).toEqual({ skipped: true, reason: "already_processed" })
    expect(processFn).not.toHaveBeenCalled()
  })

  it("marks job completed on success", async () => {
    const docId = `doc-4-${Date.now()}`
    const job = {
      id: "job-4",
      type: "sync_document" as const,
      payload: { documentId: docId },
    }

    const processFn = vi.fn().mockResolvedValue({ success: true })

    await processJobWithRetry(job, processFn)

    const idempotencyKey = generateIdempotencyKey("sync_document", docId)
    expect(isJobCompleted(idempotencyKey)).toBe(true)
  })
})