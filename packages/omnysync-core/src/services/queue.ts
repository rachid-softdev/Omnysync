import { Client } from "@upstash/qstash";
import { Redis } from "@upstash/redis";
import crypto from "crypto";

const qstash = new Client({
  baseUrl: process.env.QSTASH_URL!,
  token: process.env.QSTASH_TOKEN!,
});

// Redis-backed completed-jobs store (shared across instances)
function getRedis(): Redis | null {
  if (process.env.QSTASH_URL && process.env.QSTASH_TOKEN) {
    try {
      return new Redis({
        url: process.env.QSTASH_URL,
        token: process.env.QSTASH_TOKEN,
      });
    } catch {
      return null;
    }
  }
  return null;
}

const PROCESSED_JOBS_TTL = 24 * 60 * 60; // 24 hours (seconds for Redis)
const JOB_PREFIX = "queue:completed:";

export type JobType =
  | "sync_document"
  | "upload_image"
  | "generate_ai_image"
  | "process_seo"
  | "detect_changes";

export interface Job {
  id: string;
  type: JobType;
  payload: Record<string, string | number | boolean | null>;
  retries?: number;
  priority?: number;
}

// Retry configuration
const MAX_RETRIES = 3;
const RETRY_DELAYS = [1000, 5000, 30000]; // milliseconds

// Dead letter queue interface
export interface DeadLetterJob {
  job: Job;
  error: string;
  failedAt: Date;
  attempts: number;
}

// Fallback in-memory tracking when Redis is unavailable
const completedJobsMemory = new Map<
  string,
  { completedAt: Date; result?: unknown }
>();
const MEMORY_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Generate idempotency key for job deduplication
 */
export function generateIdempotencyKey(
  type: string,
  documentId?: string,
): string {
  const parts = [type, documentId || "", Date.now().toString()];
  return crypto
    .createHash("sha256")
    .update(parts.join(":"))
    .digest("hex")
    .substring(0, 32);
}

/**
 * Check if job has been processed (idempotency check).
 * Uses Redis when available, falls back to in-memory Map.
 */
export async function isJobCompleted(idempotencyKey: string): Promise<boolean> {
  const redis = getRedis();
  if (redis) {
    const exists = await redis.exists(`${JOB_PREFIX}${idempotencyKey}`);
    return exists === 1;
  }

  // Fallback to in-memory
  const record = completedJobsMemory.get(idempotencyKey);
  if (!record) return false;

  if (Date.now() - record.completedAt.getTime() > MEMORY_TTL_MS) {
    completedJobsMemory.delete(idempotencyKey);
    return false;
  }

  return true;
}

/**
 * Mark job as completed.
 * Uses Redis when available, falls back to in-memory Map.
 */
export async function markJobCompleted(
  idempotencyKey: string,
  result?: unknown,
): Promise<void> {
  const redis = getRedis();
  if (redis) {
    await redis.set(
      `${JOB_PREFIX}${idempotencyKey}`,
      JSON.stringify({ completedAt: new Date().toISOString(), result }),
      { ex: PROCESSED_JOBS_TTL },
    );
    return;
  }

  // Fallback to in-memory
  completedJobsMemory.set(idempotencyKey, { completedAt: new Date(), result });
}

/**
 * Add job to dead letter queue
 */
export async function addToDeadLetter(
  job: Job,
  error: string,
  attempts: number,
): Promise<void> {
  const deadLetterJob: DeadLetterJob = {
    job,
    error,
    failedAt: new Date(),
    attempts,
  };

  console.error("Job moved to dead letter queue:", {
    jobId: job.id,
    jobType: job.type,
    error: error.substring(0, 500),
    failedAt: deadLetterJob.failedAt.toISOString(),
    attempts,
  });

  // In production, store in database or Redis
  // await prisma.deadLetterJob.create({ data: deadLetterJob })
}

/**
 * Log failed job details
 */
function logFailedJob(
  jobId: string,
  jobType: JobType,
  userId: string | undefined,
  errorMessage: string,
  attempts: number,
): void {
  console.error("Job processing failed:", {
    jobId,
    jobType,
    userId,
    errorMessage: errorMessage.substring(0, 1000),
    timestamp: new Date().toISOString(),
    attempts,
  });
}

/**
 * Process job with exponential backoff retry
 */
export async function processJobWithRetry(
  job: Job,
  processFn: (job: Job) => Promise<unknown>,
): Promise<unknown> {
  let attempts = 0;
  let lastError: Error | undefined;

  // Generate idempotency key for this job
  const idempotencyKey = generateIdempotencyKey(
    job.type,
    job.payload.documentId as string | undefined,
  );

  // Check if already completed (idempotency)
  if (await isJobCompleted(idempotencyKey)) {
    console.log(
      `Job ${job.id} already processed, skipping (idempotency key: ${idempotencyKey})`,
    );
    return { skipped: true, reason: "already_processed" };
  }

  while (attempts < MAX_RETRIES) {
    try {
      const result = await processFn(job);
      // Mark as completed on success
      await markJobCompleted(idempotencyKey, result);
      return result;
    } catch (error) {
      lastError = error as Error;
      attempts++;

      // Log failed job details
      const userId = job.payload.userId as string | undefined;
      logFailedJob(job.id, job.type, userId, lastError.message, attempts);

      if (attempts < MAX_RETRIES) {
        const delay = RETRY_DELAYS[attempts - 1] || 30000;
        console.log(
          `Job ${job.id} failed (attempt ${attempts}/${MAX_RETRIES}), retrying in ${delay}ms`,
          { jobType: job.type, error: lastError.message },
        );

        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  // All retries failed - move to dead letter
  console.error(
    `Job ${job.id} failed permanently after ${MAX_RETRIES} attempts`,
    {
      jobType: job.type,
      lastError: lastError?.message,
    },
  );

  await addToDeadLetter(job, lastError?.message || "Unknown error", attempts);
  throw lastError;
}

export async function enqueueJob(
  job: Job,
  delayInSeconds?: number,
  idempotencyKey?: string,
) {
  const jobId = `${job.type}-${Date.now()}-${Math.random().toString(36).substring(7)}`;
  // Override the placeholder ID with the generated one
  job.id = jobId;

  // Use provided idempotency key or generate one
  const key =
    idempotencyKey ||
    generateIdempotencyKey(
      job.type,
      job.payload.documentId as string | undefined,
    );

  const body = JSON.stringify({
    jobId,
    idempotencyKey: key,
    ...job,
  });

  if (delayInSeconds) {
    const scheduledTime = Math.floor(Date.now() / 1000) + delayInSeconds;
    await qstash.publish({
      url: `${process.env.NEXTAUTH_URL}/api/queue`,
      body,
      scheduledAt: scheduledTime,
    });
  } else {
    await qstash.publish({
      url: `${process.env.NEXTAUTH_URL}/api/queue`,
      body,
    });
  }

  return jobId;
}

export async function enqueueSyncJob(
  documentId: string,
  sourceConnectorId: string,
  destConnectorId: string,
  options?: { delay?: number; priority?: number },
) {
  return enqueueJob(
    {
      id: "",
      type: "sync_document",
      payload: {
        documentId,
        sourceConnectorId,
        destConnectorId,
      },
      priority: options?.priority,
    },
    options?.delay,
  );
}

export async function enqueueImageUpload(
  documentId: string,
  imageUrl: string,
  destConnectorId: string,
) {
  return enqueueJob({
    id: "",
    type: "upload_image",
    payload: {
      documentId,
      imageUrl,
      destConnectorId,
    },
  });
}

export async function enqueueAIImageGeneration(
  documentId: string,
  prompt: string,
) {
  return enqueueJob({
    id: "",
    type: "generate_ai_image",
    payload: {
      documentId,
      prompt,
    },
  });
}

export async function enqueueSEOProcessing(documentId: string) {
  return enqueueJob({
    id: "",
    type: "process_seo",
    payload: {
      documentId,
    },
  });
}

export async function enqueueChangeDetection(documentId: string) {
  return enqueueJob({
    id: "",
    type: "detect_changes",
    payload: {
      documentId,
    },
  });
}

export interface QueueMessage {
  jobId: string;
  type: JobType;
  payload: Record<string, string | number | boolean | null>;
}

// Note: QStash SDK v2.x removed `receive` and `acknowledge` from the Client API.
// These functions are kept as stubs for future migration to the new API.
export async function receiveMessage(): Promise<QueueMessage | null> {
  console.warn("receiveMessage is not supported in QStash SDK v2.x");
  return null;
}

export async function acknowledgeMessage(messageId: string) {
  console.warn(
    "acknowledgeMessage is not supported in QStash SDK v2.x",
    messageId,
  );
}
