import { decrypt } from "../crypto"
import { prisma } from "../../prisma"

export async function uploadImageToDestination(
  imageUrl: string,
  documentId: string
): Promise<string | null> {
  const document = await prisma.document.findUnique({
    where: { id: documentId },
    include: { destConnector: true },
  })

  if (!document?.destConnector) return null

  // Download the image
  const imageResponse = await fetch(imageUrl)
  if (!imageResponse.ok) return null

  const arrayBuffer = await imageResponse.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)
  const filename = `omnysync-${Date.now()}.png`

  const rawCredentials = decrypt(document.destConnector.credentials || "")
  const config = (document.destConnector.config || {}) as Record<string, any>

  try {
    if (document.destConnector.type === "WORDPRESS") {
      const { createWordPressClient } = await import("./wordpress")
      const creds = Buffer.from(rawCredentials, "base64").toString().split(":")
      const client = createWordPressClient(config.siteUrl, creds[0], creds[1])

      const blob = new Blob([buffer], { type: "image/png" })
      const result = await client.uploadMedia({ file: blob, title: filename })
      return result.source_url
    }

    if (document.destConnector.type === "GHOST") {
      const { createGhostClient } = await import("./ghost")
      const client = createGhostClient(config.siteUrl, rawCredentials)

      const blob = new Blob([buffer], { type: "image/png" })
      const result = await client.uploadImage({ file: blob, filename })
      return result.images?.[0]?.url || null
    }

    if (document.destConnector.type === "WEBFLOW") {
      const { createWebflowClient } = await import("./webflow")
      const client = createWebflowClient(rawCredentials, config.siteId)

      const blob = new Blob([buffer], { type: "image/png" })
      const result = await client.uploadMedia(blob, filename)
      return result.url
    }

    if (document.destConnector.type === "SHOPIFY") {
      const { createShopifyClient } = await import("./shopify")
      const client = createShopifyClient(config.shopDomain, rawCredentials)

      const base64 = buffer.toString("base64")
      const result = await client.uploadImage({ attachment: base64, filename })
      return result.asset?.src || null
    }
  } catch (error) {
    console.error(`Image upload failed for ${document.destConnector.type}:`, error)
  }

  return null
}

export async function uploadAllImages(
  documentId: string
): Promise<string[]> {
  const document = await prisma.document.findUnique({
    where: { id: documentId },
  })

  if (!document?.featuredImage) return []

  const urls: string[] = []

  // Upload featured image
  const featuredUrl = await uploadImageToDestination(document.featuredImage, documentId)
  if (featuredUrl) {
    urls.push(featuredUrl)
    await prisma.document.update({
      where: { id: documentId },
      data: { featuredImage: featuredUrl },
    })
  }

  return urls
}