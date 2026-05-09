import { NextRequest, NextResponse } from "next/server"
import { performSync, detectAndSyncChanges } from "@/lib/services/sync"
import { generateAImage, generateSEO } from "@/lib/services/ai"
import { uploadAllImages } from "@/lib/services/image-upload"
import { prisma } from "@/lib/prisma"

function verifyQStashSignature(req: NextRequest): boolean {
  // In development, allow unsigned requests for testing
  if (process.env.NODE_ENV === "development") {
    return true
  }

  const signature = req.headers.get("upstash-signature")
  if (!signature) {
    return false
  }

  // QStash sends a signing key that should match QSTASH_CURRENT_SIGNING_KEY
  // or QSTASH_NEXT_SIGNING_KEY (for key rotation)
  const currentKey = process.env.QSTASH_CURRENT_SIGNING_KEY
  const nextKey = process.env.QSTASH_NEXT_SIGNING_KEY

  if (!currentKey && !nextKey) {
    console.warn("No QStash signing keys configured — blocking webhook")
    return false
  }

  return signature === currentKey || signature === nextKey
}

export async function POST(req: NextRequest) {
  if (!verifyQStashSignature(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = await req.json()
    const { type, payload } = body

    switch (type) {
      case "sync_document": {
        const { documentId, sourceConnectorId, destConnectorId } = payload
        const result = await performSync(documentId, sourceConnectorId, destConnectorId)
        // Upload images after sync
        uploadAllImages(documentId).catch(console.error)
        return NextResponse.json(result)
      }

      case "detect_changes": {
        const { documentId } = payload
        const result = await detectAndSyncChanges(documentId)
        return NextResponse.json(result)
      }

      case "process_seo": {
        const { documentId } = payload
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
        return NextResponse.json({ success: true })
      }

      case "generate_ai_image": {
        const { documentId, prompt } = payload
        const imageUrl = await generateAImage(prompt)

        if (imageUrl) {
          await prisma.document.update({
            where: { id: documentId },
            data: {
              featuredImage: imageUrl,
            },
          })
        }
        return NextResponse.json({ success: true, imageUrl })
      }

      default:
        return NextResponse.json({ error: "Unknown job type" }, { status: 400 })
    }
  } catch (error) {
    console.error("Queue job error:", error)
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    )
  }
}
