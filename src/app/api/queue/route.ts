import { NextRequest, NextResponse } from "next/server"
import { performSync, detectAndSyncChanges } from "@/lib/services/sync"
import { generateAImage, generateSEO } from "@/lib/services/ai"
import { prisma } from "@/lib/prisma"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { type, payload } = body

    switch (type) {
      case "sync_document": {
        const { documentId, sourceConnectorId, destConnectorId } = payload
        const result = await performSync(documentId, sourceConnectorId, destConnectorId)
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