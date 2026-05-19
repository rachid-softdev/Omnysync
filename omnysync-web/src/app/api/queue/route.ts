import { NextRequest, NextResponse } from 'next/server'
import { performSync, detectAndSyncChanges } from '@/lib/services/sync'
import { generateAImage, generateSEO } from '@/lib/services/ai'
import { uploadAllImages } from '@/lib/services/image-upload'
import { prisma } from '@/lib/prisma'
import { processJobWithRetry, isJobCompleted, markJobCompleted } from '@/lib/services/queue'

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

  return signature === currentKey || signature === nextKey
}

export async function POST(req: NextRequest) {
  if (!verifyQStashSignature(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await req.json()
    const { type, payload, idempotencyKey, jobId } = body

    // Check idempotency before processing
    if (idempotencyKey && isJobCompleted(idempotencyKey)) {
      console.log(`Job ${jobId} already processed, skipping (idempotency key: ${idempotencyKey})`)
      return NextResponse.json({ skipped: true, reason: 'already_processed' })
    }

    // Create job object for retry mechanism
    const job = { id: jobId, type, payload }

    switch (type) {
      case 'sync_document': {
        const { documentId, sourceConnectorId, destConnectorId } = payload
        const result = await processJobWithRetry(job, async (j) => {
          return await performSync(
            j.payload.documentId as string,
            j.payload.sourceConnectorId as string,
            j.payload.destConnectorId as string
          )
        })
        // Upload images after sync (fire and forget)
        uploadAllImages(documentId).catch(console.error)

        // Mark as completed after successful processing
        if (idempotencyKey) {
          markJobCompleted(idempotencyKey, result)
        }
        return NextResponse.json(result)
      }

      case 'detect_changes': {
        const { documentId } = payload
        const result = await processJobWithRetry(job, async (j) => {
          return await detectAndSyncChanges(j.payload.documentId as string)
        })

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
            const seo = await generateSEO(document.content, document.title)
            await prisma.document.update({
              where: { id: documentId },
              data: {
                seoTitle: seo.title,
                seoDescription: seo.description,
                seoKeywords: seo.keywords,
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
        const { documentId, prompt } = payload
        const result = await processJobWithRetry(job, async (j) => {
          const imageUrl = await generateAImage(j.payload.prompt as string)

          if (imageUrl) {
            await prisma.document.update({
              where: { id: j.payload.documentId as string },
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
