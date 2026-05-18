import { prisma } from "@/lib/prisma"
import { ERR_DOC_NOT_FOUND, ERR_DOC_NOT_PUBLISHED, ERR_SYNC_NO_CHANGES, ERR_SYNC_SUCCESS, ERR_API_FAILED } from "@/lib/errors"
import { decrypt } from "@/lib/crypto"
import { sendSyncCompleteEmail } from "@/lib/email"
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

/**
 * Enrichit le contenu avec les fonctionnalités IA
 * Cette fonction est appelée pendant le processus de synchronisation
 */
async function enrichContentWithAI(
  documentId: string,
  htmlContent: string,
  title: string
): Promise<{
  seoTitle: string
  seoDescription: string
  seoKeywords: string[]
  excerpt: string
}> {
  const { generateSEO, generateExcerpt, findInterlinkingOpportunities } = await import("./ai")
  
  const enrichment = {
    seoTitle: title,
    seoDescription: "",
    seoKeywords: [] as string[],
    excerpt: "",
  }

  // 1. Generate SEO metadata
  try {
    await prisma.syncLog.create({
      data: {
        documentId,
        action: "ai_seo_started",
        status: "INFO",
        message: "Génération des métadonnées SEO...",
      },
    })

    const seo = await generateSEO(htmlContent, title)
    enrichment.seoTitle = seo.title
    enrichment.seoDescription = seo.description
    enrichment.seoKeywords = seo.keywords

    await prisma.syncLog.create({
      data: {
        documentId,
        action: "ai_seo_completed",
        status: "INFO",
        message: `SEO généré: ${seo.title.substring(0, 50)}...`,
      },
    })
  } catch (error) {
    console.error("AI SEO generation failed:", error)
    await prisma.syncLog.create({
      data: {
        documentId,
        action: "ai_seo_failed",
        status: "WARNING",
        message: "Génération SEO échouée, utilisation du titre par défaut",
      },
    })
  }

  // 2. Generate excerpt
  try {
    const excerpt = await generateExcerpt(htmlContent, 160)
    enrichment.excerpt = excerpt
  } catch (error) {
    console.error("AI excerpt generation failed:", error)
    // Fallback: use first 160 chars of plain text
    enrichment.excerpt = htmlContent.replace(/<[^>]+>/g, "").substring(0, 160)
  }

  // 3. Find interlinking opportunities (for published documents)
  try {
    const existingDocs = await prisma.document.findMany({
      where: {
        organizationId: (await prisma.document.findUnique({ where: { id: documentId } }))?.organizationId,
        status: "PUBLISHED",
        id: { not: documentId },
      },
      select: { title: true, slug: true, excerpt: true },
      take: 10,
    })

    if (existingDocs.length > 0) {
      const links = await findInterlinkingOpportunities(
        htmlContent,
        existingDocs.map((d) => ({ title: d.title, url: d.slug || "", excerpt: d.excerpt || "" }))
      )
      
      if (links.links.length > 0) {
        // Log the found links
        await prisma.syncLog.create({
          data: {
            documentId,
            action: "ai_interlinking_found",
            status: "INFO",
            message: `${links.links.length} opportunités de liens internes détectées`,
          },
        })
      }
    }
  } catch (error) {
    console.error("AI interlinking failed:", error)
  }

  return enrichment
}

/**
 * Génère une image IA si le contenu contient un placeholder
 * [AI-Image: prompt description]
 */
async function generateAIImages(documentId: string, htmlContent: string): Promise<string | null> {
  const { generateAImage } = await import("./ai")

  // Check for AI image placeholders in content
  const aiImageRegex = /\[AI-Image:\s*([^\]]+)\]/gi
  const matches = [...htmlContent.matchAll(aiImageRegex)]

  if (matches.length === 0) {
    return null
  }

  try {
    const prompt = matches[0][1] // Get first prompt
    const imageUrl = await generateAImage(prompt)

    await prisma.syncLog.create({
      data: {
        documentId,
        action: "ai_image_generated",
        status: "INFO",
        message: "Image générée via DALL-E 3",
      },
    })

    return imageUrl
  } catch (error) {
    console.error("AI image generation failed:", error)
    await prisma.syncLog.create({
      data: {
        documentId,
        action: "ai_image_failed",
        status: "WARNING",
        message: "Génération d'image IA échouée",
      },
    })
    return null
  }
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

  // Log start of sync
  await prisma.syncLog.create({
    data: {
      userId: document.userId,
      organizationId: document.organizationId,
      documentId,
      action: "sync_started",
      status: "INFO",
      message: "Synchronisation démarrée",
    },
  })

  try {
    let content = ""
    let title = document.title

    // Step 1: Retrieve content from source
    await prisma.syncLog.create({
      data: {
        documentId,
        action: "fetch_content_started",
        status: "INFO",
        message: "Récupération du contenu depuis la source...",
      },
    })

    if (document.sourceConnector?.type === "GOOGLE_DOCS") {
      const raw = decrypt(document.sourceConnector.credentials || "{}")
      const credentials = JSON.parse(raw)
      const docData = await getGoogleDocContent(document.sourceId!, credentials.accessToken)
      content = docData.content
      title = docData.title
    } else if (document.sourceConnector?.type === "NOTION") {
      const raw = decrypt(String(document.sourceConnector.credentials || document.sourceConnector.config || "{}"))
      const config = JSON.parse(raw)
      const pageData = await getNotionPageContent(document.sourceId!, config.accessToken)
      content = pageData.content
      title = pageData.title
    }

    await prisma.syncLog.create({
      data: {
        documentId,
        action: "fetch_content_completed",
        status: "INFO",
        message: `Contenu récupéré (${content.length} caractères)`,
      },
    })

    // Step 2: Parse to HTML
    await prisma.syncLog.create({
      data: {
        documentId,
        action: "parsing_html_started",
        status: "INFO",
        message: "Conversion en HTML...",
      },
    })

    const { parseMarkdownToHtml, parseGoogleDocToHtml } = await import("./html-parser")
    let htmlContent = content

    if (document.sourceConnector?.type === "NOTION") {
      htmlContent = parseMarkdownToHtml(content)
    } else if (document.sourceConnector?.type === "GOOGLE_DOCS" && document.sourceId) {
      const raw = decrypt(document.sourceConnector.credentials || "{}")
      const credentials = JSON.parse(raw)
      const fullDocData = await getGoogleDocContent(document.sourceId, credentials.accessToken)
      const parsed = parseGoogleDocToHtml(fullDocData)
      htmlContent = parsed.html
    }

    await prisma.syncLog.create({
      data: {
        documentId,
        action: "parsing_html_completed",
        status: "INFO",
        message: "HTML généré avec succès",
      },
    })

    // Step 3: AI Enrichment (NEW!)
    await prisma.syncLog.create({
      data: {
        documentId,
        action: "ai_enrichment_started",
        status: "INFO",
        message: "Enrichissement IA...",
      },
    })

    const aiEnrichment = await enrichContentWithAI(documentId, htmlContent, title)

    // Check for AI image generation
    const aiImageUrl = await generateAIImages(documentId, htmlContent)

    await prisma.syncLog.create({
      data: {
        documentId,
        action: "ai_enrichment_completed",
        status: "INFO",
        message: "Enrichissement IA terminé",
      },
    })

    // Step 4: Update document with content and AI enrichment
    await prisma.document.update({
      where: { id: documentId },
      data: {
        title,
        content,
        htmlContent,
        seoTitle: aiEnrichment.seoTitle,
        seoDescription: aiEnrichment.seoDescription,
        seoKeywords: aiEnrichment.seoKeywords,
        excerpt: aiEnrichment.excerpt,
        featuredImage: aiImageUrl || document.featuredImage,
      },
    })

    // Step 5: Publish to destination
    await prisma.syncLog.create({
      data: {
        documentId,
        action: "publish_started",
        status: "INFO",
        message: "Publication vers la destination...",
      },
    })

    await publishToDestination(document, htmlContent)

    // Step 6: Update status to synced
    await prisma.document.update({
      where: { id: documentId },
      data: {
        syncStatus: "SYNCED",
        lastSyncedAt: new Date(),
        status: "PUBLISHED",
      },
    })

    await prisma.syncLog.create({
      data: {
        userId: document.userId,
        organizationId: document.organizationId,
        documentId,
        action: "sync_completed",
        status: "SUCCESS",
        message: "Document synchronisé avec succès (avec enrichissement IA)",
      },
    })

    // Send success email
    const user = await prisma.user.findUnique({ where: { id: document.userId } })
    if (user?.email) {
      sendSyncCompleteEmail(user.email, document.title, true).catch(console.error)
    }

    return {
      success: true,
      error: ERR_SYNC_SUCCESS,
      documentId,
    }
  } catch (error) {
    await prisma.document.update({
      where: { id: documentId },
      data: { syncStatus: "FAILED", lastSyncError: (error as Error).message },
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

    // Send failure email
    const user = await prisma.user.findUnique({ where: { id: document.userId } })
    if (user?.email) {
      sendSyncCompleteEmail(user.email, document.title, false).catch(console.error)
    }

    return {
      success: false,
      error: ERR_API_FAILED,
      documentId,
    }
  }
}

async function publishToDestination(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  document: any,
  htmlContent: string
) {
  if (!document.destConnector) return

  const rawCredentials = decrypt(document.destConnector.credentials || "")
  const config = document.destConnector.config || {}

  if (document.destConnector.type === "WORDPRESS") {
    const { createWordPressClient } = await import("./wordpress")
    const creds = Buffer.from(rawCredentials, "base64").toString().split(":")
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
    const client = createGhostClient(config.siteUrl, rawCredentials)

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
    const client = createWebflowClient(rawCredentials, config.siteId)

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
    const client = createShopifyClient(config.shopDomain, rawCredentials)

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

  // Contentful integration
  if (document.destConnector.type === "CONTENTFUL") {
    const { createContentfulEntry, updateContentfulEntry } = await import("./contentful")
    const spaceId = config.spaceId
    const accessToken = rawCredentials
    const contentTypeId = config.contentTypeId || "article"

    const fields = {
      title: { "en-US": document.title },
      body: { "en-US": htmlContent },
      slug: { "en-US": document.slug || document.title.toLowerCase().replace(/[^a-z0-9]+/g, "-") },
    }

    if (document.slug) {
      // Update existing entry - get current version first
      const entry = await prisma.document.findUnique({
        where: { id: document.id },
        select: { version: true },
      })
      if (entry) {
        await updateContentfulEntry(accessToken, spaceId, document.slug, fields, entry.version)
      }
    } else {
      const result = await createContentfulEntry(accessToken, spaceId, contentTypeId, fields)
      await prisma.document.update({
        where: { id: document.id },
        data: { slug: result.id },
      })
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
      const raw = decrypt(document.sourceConnector.credentials || "{}")
      const credentials = JSON.parse(raw)
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

    if (!document.sourceConnectorId || !document.destConnectorId) {
      return {
        success: false,
        error: "Missing connector IDs",
        documentId,
      }
    }

    return performSync(documentId, document.sourceConnectorId, document.destConnectorId)
  } catch (error) {
    return {
      success: false,
      error: (error as Error).message,
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

  const credentials = decrypt(document.destConnector.credentials || "")
  const config = (document.destConnector.config || {}) as Record<string, string>

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