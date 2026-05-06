import { prisma } from "@/lib/prisma"
import { ERR_DOC_NOT_FOUND, ERR_DOC_NOT_PUBLISHED, ERR_SYNC_NO_CHANGES, ERR_SYNC_SUCCESS, ERR_API_FAILED } from "@/lib/errors"
import { detectContentChanges } from "./ai"
import { getGoogleDocContent } from "./google-docs"
import { getNotionPageContent } from "./notion"
import { createWordPressClient } from "./wordpress"
import { createGhostClient } from "./ghost"
import { createWebflowClient } from "./webflow"
import { createShopifyClient } from "./shopify"

export interface SyncResult {
  success: boolean
  error?: string
  documentId: string
  changesDetected?: boolean
}

export async function performSync(
  documentId: string,
  sourceConnectorId: string,
  destConnectorId: string
): Promise<SyncResult> {
  const document = await prisma.document.findUnique({
    where: { id: documentId },
    include: {
      sourceConnector: true,
      destConnector: true,
    },
  })

  if (!document) {
    return { success: false, error: ERR_DOC_NOT_FOUND, documentId }
  }

  await prisma.document.update({
    where: { id: documentId },
    data: { syncStatus: "SYNCING" },
  })

  try {
    let content = ""
    let title = document.title

    if (document.sourceConnector?.type === "GOOGLE_DOCS") {
      const credentials = JSON.parse(document.sourceConnector.credentials || "{}")
      const docData = await getGoogleDocContent(document.sourceId!, credentials.accessToken)
      content = docData.content
      title = docData.title
    } else if (document.sourceConnector?.type === "NOTION") {
      const config = JSON.parse(document.sourceConnector.config || "{}")
      const pageData = await getNotionPageContent(document.sourceId!, config.accessToken)
      content = pageData.content
      title = pageData.title
    }

    const { parseMarkdownToHtml, parseGoogleDocToHtml } = await import("./html-parser")
    let htmlContent = content

    if (document.sourceConnector?.type === "NOTION") {
      htmlContent = parseMarkdownToHtml(content)
    } else if (document.sourceConnector?.type === "GOOGLE_DOCS" && document.sourceId) {
      const credentials = JSON.parse(document.sourceConnector.credentials || "{}")
      const fullDocData = await getGoogleDocContent(document.sourceId, credentials.accessToken)
      const parsed = parseGoogleDocToHtml(fullDocData)
      htmlContent = parsed.html
    }

    await prisma.document.update({
      where: { id: documentId },
      data: {
        title,
        content,
        htmlContent,
        syncStatus: "SYNCED",
        lastSyncedAt: new Date(),
      },
    })

    await publishToDestination(document, htmlContent)

    await prisma.syncLog.create({
      data: {
        userId: document.userId,
        organizationId: document.organizationId,
        documentId,
        action: "sync_completed",
        status: "SUCCESS",
        message: "Document synchronized successfully",
      },
    })

    return {
      success: true,
      error: ERR_SYNC_SUCCESS,
      documentId,
    }
  } catch (error) {
    await prisma.document.update({
      where: { id: documentId },
      data: { syncStatus: "FAILED" },
    })

    await prisma.syncLog.create({
      data: {
        userId: document.userId,
        organizationId: document.organizationId,
        documentId,
        action: "sync_failed",
        status: "ERROR",
        message: (error as Error).message,
      },
    })

    return {
      success: false,
      error: ERR_API_FAILED,
      documentId,
    }
  }
}

async function publishToDestination(document: any, htmlContent: string) {
  if (!document.destConnector) return

  const credentials = document.destConnector.credentials || ""
  const config = document.destConnector.config || {}

  if (document.destConnector.type === "WORDPRESS") {
    const { createWordPressClient } = await import("./wordpress")
    const creds = Buffer.from(credentials, "base64").toString().split(":")
    const client = createWordPressClient(config.siteUrl, creds[0], creds[1])

    if (document.slug) {
      await client.updatePost(parseInt(document.slug), {
        title: document.title,
        content: htmlContent,
        status: "publish",
      })
    } else {
      const result = await client.createPost({
        title: document.title,
        content: htmlContent,
        status: "publish",
      })
      await prisma.document.update({
        where: { id: document.id },
        data: { slug: result.id.toString() },
      })
    }
  }

  if (document.destConnector.type === "GHOST") {
    const { createGhostClient } = await import("./ghost")
    const client = createGhostClient(config.siteUrl, credentials)

    if (document.slug) {
      await client.updatePost(document.slug, {
        title: document.title,
        html: htmlContent,
        status: "published",
      })
    } else {
      const result = await client.createPost({
        title: document.title,
        html: htmlContent,
        status: "published",
      })
      await prisma.document.update({
        where: { id: document.id },
        data: { slug: result.posts[0].id },
      })
    }
  }

  if (document.destConnector.type === "WEBFLOW") {
    const { createWebflowClient } = await import("./webflow")
    const client = createWebflowClient(credentials, config.siteId)

    const slug = document.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")

    if (document.slug) {
      await client.updateItem(config.collectionId, document.slug, {
        name: document.title,
        slug,
        content: htmlContent,
        status: "published",
      })
    } else {
      const result = await client.createItem(config.collectionId, {
        name: document.title,
        slug,
        content: htmlContent,
        status: "published",
      })
      await prisma.document.update({
        where: { id: document.id },
        data: { slug: result.items[0].id },
      })
    }
  }

  if (document.destConnector.type === "SHOPIFY") {
    const { createShopifyClient } = await import("./shopify")
    const client = createShopifyClient(config.shopDomain, credentials)

    const blogs = await client.getBlogs()
    const blogId = blogs.blogs[0]?.id

    if (blogId) {
      if (document.slug) {
        await client.updateArticle(blogId, document.slug, {
          title: document.title,
          body_html: htmlContent,
        })
      } else {
        const result = await client.createArticle(blogId, {
          title: document.title,
          body_html: htmlContent,
        })
        await prisma.document.update({
          where: { id: document.id },
          data: { slug: result.article.id.toString() },
        })
      }
    }
  }
}

export async function detectAndSyncChanges(documentId: string): Promise<SyncResult> {
  const document = await prisma.document.findUnique({
    where: { id: documentId },
    include: {
      sourceConnector: true,
      destConnector: true,
    },
  })

  if (!document) {
    return { success: false, error: ERR_DOC_NOT_FOUND, documentId }
  }

  if (document.status !== "PUBLISHED") {
    return { success: false, error: ERR_DOC_NOT_PUBLISHED, documentId }
  }

  try {
    let newContent = ""
    let newTitle = document.title

    if (document.sourceConnector?.type === "GOOGLE_DOCS") {
      const credentials = JSON.parse(document.sourceConnector.credentials || "{}")
      const docData = await getGoogleDocContent(document.sourceId!, credentials.accessToken)
      newContent = docData.content
      newTitle = docData.title
    }

    const { detectContentChanges: detectChanges } = await import("./ai")
    const result = await detectChanges(document.content || "", newContent)

    if (!result.hasChanges) {
      return {
        success: true,
        error: ERR_SYNC_NO_CHANGES,
        documentId,
        changesDetected: false,
      }
    }

    await prisma.syncLog.create({
      data: {
        userId: document.userId,
        organizationId: document.organizationId,
        documentId,
        action: "changes_detected",
        status: "INFO",
        message: result.summary,
      },
    })

    return performSync(documentId, document.sourceConnectorId, document.destConnectorId)
  } catch (error) {
    return {
      success: false,
      message: (error as Error).message,
      documentId,
    }
  }
}

export async function checkRemoteChanges(documentId: string) {
  const document = await prisma.document.findUnique({
    where: { id: documentId },
    include: {
      destConnector: true,
    },
  })

  if (!document || !document.destConnector) return null

  const credentials = document.destConnector.credentials || ""
  const config = document.destConnector.config || {}

  if (document.destConnector.type === "WORDPRESS") {
    const { createWordPressClient } = await import("./wordpress")
    const creds = Buffer.from(credentials, "base64").toString().split(":")
    const client = createWordPressClient(config.siteUrl, creds[0], creds[1])
    return client.getPost(parseInt(document.slug || "0"))
  }

  if (document.destConnector.type === "GHOST") {
    const { createGhostClient } = await import("./ghost")
    const client = createGhostClient(config.siteUrl, credentials)
    return client.getPost(document.slug || "")
  }

  return null
}