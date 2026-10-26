import { NextRequest, NextResponse } from 'next/server'
import { Receiver } from '@upstash/qstash'
import { performSync, detectAndSyncChanges } from '@omnysync/core/services/sync'
import { generateAImage, generateSEO } from '@omnysync/core/services/ai'
import { uploadAllImages } from '@omnysync/core/services/image-upload'
import { prisma } from '@/lib/prisma'
import {
  checkAndIncrementQuota,
  decrementQuotaOnFailure,
  getPlanLimits,
  getUserPlan,
} from '@/lib/auth/subscription'
import {
  processJobWithRetry,
  isJobCompleted,
  markJobCompleted,
} from '@omnysync/core/services/queue'

/**
 * Verify the QStash request signature.
 *
 * QStash signs the request with a JWT (HMAC-SHA256 over the raw body) — the
 * signature must be verified against the signing keys; comparing the header to
 * the key itself would reject every legitimate delivery.
 */
async function verifyQStashSignature(req: NextRequest, rawBody: string): Promise<boolean> {
  // In development, allow unsigned requests for testing
  if (process.env.NODE_ENV === 'development') {
    return true
  }

  const signature = req.headers.get('upstash-signature')
  if (!signature) {
    return false
  }

  if (!process.env.QSTASH_CURRENT_SIGNING_KEY) {
    console.warn('No QStash signing key configured — blocking webhook')
    return false
  }

  // Same key passed twice = rotation disabled, which the Receiver accepts.
  const receiver = new Receiver({
    currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY,
    nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY ?? process.env.QSTASH_CURRENT_SIGNING_KEY,
  })

  try {
    return await receiver.verify({ signature, body: rawBody })
  } catch (error) {
    console.warn('Invalid QStash signature:', error)
    return false
  }
}

/**
 * Resolve the user that authorizes a queued job.
 *
 * The job payload normally carries the userId, but it may be missing for jobs
 * enqueued by older code paths — in that case fall back to the document owner
 * (performSync/detectAndSyncChanges use this id for the organization
 * membership check).
 */
async function resolveJobUserId(
  payload: Record<string, unknown> | undefined
): Promise<string | null> {
  const payloadUserId = payload?.userId
  if (typeof payloadUserId === 'string' && payloadUserId.length > 0) {
    return payloadUserId
  }

  const documentId = payload?.documentId
  if (typeof documentId !== 'string' || documentId.length === 0) {
    return null
  }

  const document = await prisma.document.findUnique({
    where: { id: documentId },
    select: { userId: true },
  })

  return document?.userId ?? null
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text()

  if (!(await verifyQStashSignature(req, rawBody))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = JSON.parse(rawBody)
    const { type, payload, idempotencyKey, jobId } = body

    // Check idempotency before processing
    if (idempotencyKey && (await isJobCompleted(idempotencyKey))) {
      console.log(`Job ${jobId} already processed, skipping (idempotency key: ${idempotencyKey})`)
      return NextResponse.json({ skipped: true, reason: 'already_processed' })
    }

    // Create job object for retry mechanism
    const job = { id: jobId, type, payload }

    switch (type) {
      case 'sync_document': {
        const userId = await resolveJobUserId(payload)
        if (!userId) {
          return NextResponse.json({ error: 'Unknown document' }, { status: 404 })
        }
        // AI enrichment is a paid feature: resolve the plan at processing time
        // (it may have changed since the job was enqueued).
        const limits = getPlanLimits(await getUserPlan(userId))

        const result = await processJobWithRetry(job, async (j: unknown) => {
          const jPayload = j as {
            payload: { documentId: string; sourceConnectorId: string; destConnectorId: string }
          }
          return performSync(
            jPayload.payload.documentId,
            jPayload.payload.sourceConnectorId,
            jPayload.payload.destConnectorId,
            userId,
            { ai: limits.aiFeatures }
          )
        })
        // performSync() returns a failure result for provider errors instead of
        // throwing. The quota was consumed when the document was created, so
        // refund it when the queued sync did not publish.
        const failed = (result as { success?: boolean } | null)?.success === false
        if (failed) {
          await decrementQuotaOnFailure(userId)
        } else {
          // Upload images after a successful sync (fire and forget).
          uploadAllImages(job.payload.documentId as string, userId).catch(console.error)
        }

        // Mark as completed after successful processing
        if (idempotencyKey) {
          markJobCompleted(idempotencyKey, result)
        }
        return NextResponse.json(result)
      }

      case 'detect_changes': {
        const userId = await resolveJobUserId(payload)
        if (!userId) {
          return NextResponse.json({ error: 'Unknown document' }, { status: 404 })
        }

        // A detected change triggers a publish, so it consumes the same
        // monthly sync quota as a regular sync. Check before running the AI
        // comparison; refund when no change was found or the run failed.
        const quota = await checkAndIncrementQuota(userId)
        if (!quota.allowed) {
          return NextResponse.json(
            {
              error: 'Monthly sync quota exceeded',
              code: 'QUOTA_EXCEEDED',
              upgradeUrl: quota.upgradeUrl,
            },
            { status: 403 }
          )
        }

        let result: unknown
        try {
          result = await processJobWithRetry(job, async (j: unknown) => {
            const jPayload = j as { payload: { documentId: string } }
            return detectAndSyncChanges(jPayload.payload.documentId, userId)
          })
        } catch (error) {
          await decrementQuotaOnFailure(userId)
          throw error
        }

        const detection = result as { success?: boolean; changesDetected?: boolean } | null
        if (detection?.success === false || detection?.changesDetected === false) {
          await decrementQuotaOnFailure(userId)
        }

        if (idempotencyKey) {
          markJobCompleted(idempotencyKey, result)
        }
        return NextResponse.json(result)
      }

      case 'process_seo': {
        const { documentId } = payload
        const result = await processJobWithRetry(job, async () => {
          const document = await prisma.document.findUnique({
            where: { id: documentId },
          })

          if (document && document.content) {
            // generateSEO() returns an SEOData object — parsing it as JSON
            // always threw and made every process_seo job fail.
            const seoData = await generateSEO(document.content, document.title)
            await prisma.document.update({
              where: { id: documentId },
              data: {
                seoTitle: seoData.title,
                seoDescription: seoData.description,
                seoKeywords: seoData.keywords,
              },
            })
          }
          return { success: true }
        })

        if (idempotencyKey) {
          markJobCompleted(idempotencyKey, result)
        }
        return NextResponse.json(result)
      }

      case 'generate_ai_image': {
        const result = await processJobWithRetry(job, async (j: unknown) => {
          const jPayload = j as { payload: { prompt: string; documentId: string } }
          const imageUrl = await generateAImage(jPayload.payload.prompt)

          if (imageUrl) {
            await prisma.document.update({
              where: { id: jPayload.payload.documentId },
              data: {
                featuredImage: imageUrl,
              },
            })
          }
          return { success: true, imageUrl }
        })

        if (idempotencyKey) {
          markJobCompleted(idempotencyKey, result)
        }
        return NextResponse.json(result)
      }

      default:
        return NextResponse.json({ error: 'Unknown job type' }, { status: 400 })
    }
  } catch (error) {
    console.error('Queue job failed permanently:', error)
    return NextResponse.json(
      { error: 'Job processing failed after retries', details: (error as Error).message },
      { status: 500 }
    )
  }
}
