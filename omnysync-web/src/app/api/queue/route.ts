import crypto from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { performSync, detectAndSyncChanges } from '@omnysync/core/services/sync'
import { generateAImage, generateSEO } from '@omnysync/core/services/ai'
import { uploadAllImages } from '@omnysync/core/services/image-upload'
import { prisma } from '@/lib/prisma'
import {
  processJobWithRetry,
  isJobCompleted,
  markJobCompleted,
} from '@omnysync/core/services/queue'

function timingSafeCompare(a: string, b: string): boolean {
  try {
    const bufA = Buffer.from(a)
    const bufB = Buffer.from(b)
    if (bufA.length !== bufB.length) return false
    return crypto.timingSafeEqual(bufA, bufB)
  } catch {
    return false
  }
}

function verifyQStashSignature(req: NextRequest): boolean {
  // In development, allow unsigned requests for testing
  if (process.env.NODE_ENV === 'development') {
    return true
  }

  const signature = req.headers.get('upstash-signature')
  if (!signature) {
    return false
  }

  // QStash sends a signing key that should match QSTASH_CURRENT_SIGNING_KEY
  // or QSTASH_NEXT_SIGNING_KEY (for key rotation)
  const currentKey = process.env.QSTASH_CURRENT_SIGNING_KEY
  const nextKey = process.env.QSTASH_NEXT_SIGNING_KEY

  if (!currentKey && !nextKey) {
    console.warn('No QStash signing keys configured — blocking webhook')
    return false
  }

  // Use timingSafeEqual to prevent timing attacks
  if (currentKey && timingSafeCompare(signature, currentKey)) {
    return true
  }

  if (nextKey && timingSafeCompare(signature, nextKey)) {
    return true
  }

  return false
}

export async function POST(req: NextRequest) {
  if (!verifyQStashSignature(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await req.json()
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
        const { userId } = payload
        const result = await processJobWithRetry(job, async (j: unknown) => {
          const jPayload = j as {
            payload: { documentId: string; sourceConnectorId: string; destConnectorId: string }
          }
          return performSync(
            jPayload.payload.documentId,
            jPayload.payload.sourceConnectorId,
            jPayload.payload.destConnectorId,
            userId as string
          )
        })
        // Upload images after sync (fire and forget)
        if (userId) {
          uploadAllImages(job.payload.documentId as string, userId as string).catch(console.error)
        }

        // Mark as completed after successful processing
        if (idempotencyKey) {
          markJobCompleted(idempotencyKey)
        }
        return NextResponse.json(result)
      }

      case 'detect_changes': {
        const { userId } = payload
        const result = await processJobWithRetry(job, async (j: unknown) => {
          const jPayload = j as { payload: { documentId: string } }
          return detectAndSyncChanges(jPayload.payload.documentId, userId as string)
        })

        if (idempotencyKey) {
          markJobCompleted(idempotencyKey)
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
            const seo = await generateSEO(document.content, document.title)
            const seoData = JSON.parse(seo) as {
              title: string
              description: string
              keywords: string[]
            }
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
          markJobCompleted(idempotencyKey)
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
          markJobCompleted(idempotencyKey)
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
