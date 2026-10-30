import { prisma } from "../prisma";
import {
  ERR_DOC_NOT_FOUND,
  ERR_DOC_NOT_PUBLISHED,
  ERR_SYNC_NO_CHANGES,
  ERR_SYNC_SUCCESS,
  ERR_API_FAILED,
} from "../errors";
import { Prisma } from "@prisma/client";
import { decrypt } from "../crypto";
import { sendSyncCompleteEmail } from "../email";
import { shouldSendNotification } from "./notification-preferences";
import { dispatchSyncWebhooks } from "./webhooks";
import { detectContentChanges } from "./ai";
import { getGoogleDocContent } from "./google-docs";
import { getNotionPageContent } from "./notion";
import { createWordPressClient } from "./wordpress";
import { createGhostClient } from "./ghost";
import { createWebflowClient } from "./webflow";
import { createShopifyClient } from "./shopify";
import { requireDocumentAccess } from "./authz";
import { sanitizeErrorMessage } from "./sanitize";
import { assertSafeOutboundUrl } from "./outbound-url";

export interface SyncResult {
  success: boolean;
  error?: string;
  documentId: string;
  changesDetected?: boolean;
}

interface PublishDocument {
  id: string;
  title: string;
  slug: string | null;
  organizationId: string;
  userId: string;
  version: number;
  destConnector: {
    id: string;
    type: string;
    credentials: string | null;
    config: Prisma.JsonValue | null;
  } | null;
}

/**
 * Enrichit le contenu avec les fonctionnalités IA
 * Cette fonction est appelée pendant le processus de synchronisation
 */
async function enrichContentWithAI(
  documentId: string,
  htmlContent: string,
  title: string,
  organizationId: string,
  userId: string,
): Promise<{
  seoTitle: string;
  seoDescription: string;
  seoKeywords: string[];
  excerpt: string;
}> {
  const { generateSEO, generateExcerpt, findInterlinkingOpportunities } =
    await import("./ai");

  const enrichment = {
    seoTitle: title,
    seoDescription: "",
    seoKeywords: [] as string[],
    excerpt: "",
  };

  // 1. Generate SEO metadata
  try {
    await prisma.syncLog.create({
      data: {
        documentId,
        organizationId,
        userId,
        action: "ai_seo_started",
        status: "INFO",
        message: "Génération des métadonnées SEO...",
      },
    });

    const seo = await generateSEO(htmlContent, title);
    enrichment.seoTitle = seo.title;
    enrichment.seoDescription = seo.description;
    enrichment.seoKeywords = seo.keywords;

    await prisma.syncLog.create({
      data: {
        documentId,
        organizationId,
        userId,
        action: "ai_seo_completed",
        status: "INFO",
        message: `SEO généré: ${seo.title.substring(0, 50)}...`,
      },
    });
  } catch (error) {
    console.error("AI SEO generation failed:", error);
    await prisma.syncLog.create({
      data: {
        documentId,
        organizationId,
        userId,
        action: "ai_seo_failed",
        status: "WARNING",
        message: "Génération SEO échouée, utilisation du titre par défaut",
      },
    });
  }

  // 2. Generate excerpt
  try {
    const excerpt = await generateExcerpt(htmlContent, 160);
    enrichment.excerpt = excerpt;
  } catch (error) {
    console.error("AI excerpt generation failed:", error);
    // Fallback: use first 160 chars of plain text
    enrichment.excerpt = htmlContent.replace(/<[^>]+>/g, "").substring(0, 160);
  }

  // 3. Find interlinking opportunities (for published documents)
  try {
    const existingDocs = await prisma.document.findMany({
      where: {
        organizationId, // Use the parameter directly instead of re-querying the document
        status: "PUBLISHED",
        id: { not: documentId },
      },
      select: { title: true, slug: true, excerpt: true },
      take: 10,
    });

    if (existingDocs && existingDocs.length > 0) {
      const links = await findInterlinkingOpportunities(
        htmlContent,
        existingDocs.map(
          (d: {
            title: string;
            slug: string | null;
            excerpt: string | null;
          }) => ({
            title: d.title,
            url: d.slug || "",
            excerpt: d.excerpt || "",
          }),
        ),
      );

      if (links.links.length > 0) {
        // Log the found links
        await prisma.syncLog.create({
          data: {
            documentId,
            organizationId,
            userId,
            action: "ai_interlinking_found",
            status: "INFO",
            message: `${links.links.length} opportunités de liens internes détectées`,
          },
        });
      }
    }
  } catch (error) {
    console.error("AI interlinking failed:", error);
  }

  return enrichment;
}

/**
 * Génère une image IA si le contenu contient un placeholder
 * [AI-Image: prompt description]
 */
async function generateAIImages(
  documentId: string,
  htmlContent: string,
  organizationId: string,
  userId: string,
): Promise<string | null> {
  const { generateAImage } = await import("./ai");

  // Check for AI image placeholders in content
  const aiImageRegex = /\[AI-Image:\s*([^\]]+)\]/gi;
  const matches = [...htmlContent.matchAll(aiImageRegex)];

  if (matches.length === 0) {
    return null;
  }

  try {
    const prompt = matches[0][1]; // Get first prompt
    const imageUrl = await generateAImage(prompt);

    await prisma.syncLog.create({
      data: {
        documentId,
        organizationId,
        userId,
        action: "ai_image_generated",
        status: "INFO",
        message: "Image générée via DALL-E 3",
      },
    });

    return imageUrl;
  } catch (error) {
    console.error("AI image generation failed:", error);
    await prisma.syncLog.create({
      data: {
        documentId,
        organizationId,
        userId,
        action: "ai_image_failed",
        status: "WARNING",
        message: "Génération d'image IA échouée",
      },
    });
    return null;
  }
}

export interface PerformSyncOptions {
  /**
   * AI enrichment (SEO, excerpt, interlinking, images) is opt-in.
   * Every caller must pass the caller's plan flag explicitly; omitting it is
   * treated as `false` so a forgotten option can never spend AI credits.
   */
  ai?: boolean;
}

export async function performSync(
  documentId: string,
  sourceConnectorId: string,
  destConnectorId: string,
  userId: string,
  options: PerformSyncOptions = { ai: false },
): Promise<SyncResult> {
  const document = await prisma.document.findUnique({
    where: { id: documentId },
    include: {
      sourceConnector: true,
      destConnector: true,
    },
  });

  if (!document) {
    return { success: false, error: ERR_DOC_NOT_FOUND, documentId };
  }

  // Vérifier les droits d'accès
  await requireDocumentAccess(documentId, userId);

  // ⏰ Auto-reset stale SYNCING status (> 5 minutes without completion).
  // Prevents documents from being permanently stuck if the process crashed
  // mid-sync (syncStatus="SYNCING" blocks all future sync attempts).
  await prisma.document.updateMany({
    where: {
      id: documentId,
      syncStatus: "SYNCING",
      updatedAt: { lt: new Date(Date.now() - 5 * 60 * 1000) },
    },
    data: {
      syncStatus: "FAILED",
      lastSyncError:
        "Sync timed out — the previous process may have crashed. Please retry.",
    },
  });

  // Optimistic locking: increment version atomically
  const updated = await prisma.document.updateMany({
    where: {
      id: documentId,
      syncStatus: { not: "SYNCING" },
      version: document.version,
    },
    data: {
      syncStatus: "SYNCING",
      version: { increment: 1 },
    },
  });

  if (updated.count === 0) {
    return {
      success: false,
      error:
        "Document is currently being synced by another process. Please try again.",
      documentId,
    };
  }

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
  });

  // Keep the latest title outside the try block so failure webhooks can report
  // the title fetched from the source even if publishing later fails.
  let title = document.title;

  try {
    let content = "";

    // Step 1: Retrieve content from source
    await prisma.syncLog.create({
      data: {
        documentId,
        organizationId: document.organizationId,
        userId: document.userId,
        action: "fetch_content_started",
        status: "INFO",
        message: "Récupération du contenu depuis la source...",
      },
    });

    if (document.sourceConnector?.type === "GOOGLE_DOCS") {
      const raw = decrypt(document.sourceConnector.credentials || "{}");
      const credentials = JSON.parse(raw);
      const docData = await getGoogleDocContent(
        document.sourceId!,
        credentials.accessToken,
      );
      content = docData.content;
      title = docData.title;
    } else if (document.sourceConnector?.type === "NOTION") {
      const raw = decrypt(
        String(
          document.sourceConnector.credentials ||
            document.sourceConnector.config ||
            "{}",
        ),
      );
      const config = JSON.parse(raw);
      const pageData = await getNotionPageContent(
        document.sourceId!,
        config.accessToken,
      );
      content = pageData.content;
      title = pageData.title;
    } else if (document.sourceConnector?.type === "AIRTABLE") {
      const { getAirtableRecordContent } = await import("./airtable");
      const record = await getAirtableRecordContent(
        document.sourceConnector.id,
        document.sourceId!,
      );
      content = record.content;
      title = record.title;
    } else if (document.sourceConnector?.type === "CONTENTFUL") {
      const { getContentfulEntryContent } = await import("./contentful");
      const entry = await getContentfulEntryContent(
        document.sourceConnector.id,
        document.sourceId!,
      );
      content = entry.content;
      title = entry.title;
    }

    await prisma.syncLog.create({
      data: {
        documentId,
        organizationId: document.organizationId,
        userId: document.userId,
        action: "fetch_content_completed",
        status: "INFO",
        message: `Contenu récupéré (${content?.length ?? 0} caractères)`,
      },
    });

    // Step 2: Parse to HTML
    await prisma.syncLog.create({
      data: {
        documentId,
        organizationId: document.organizationId,
        userId: document.userId,
        action: "parsing_html_started",
        status: "INFO",
        message: "Conversion en HTML...",
      },
    });

    const { parseMarkdownToHtml, parseGoogleDocToHtml } =
      await import("./html-parser");
    let htmlContent = content ?? "";

    if (document.sourceConnector?.type === "NOTION") {
      htmlContent = parseMarkdownToHtml(content);
    } else if (
      document.sourceConnector?.type === "GOOGLE_DOCS" &&
      document.sourceId
    ) {
      const raw = decrypt(document.sourceConnector.credentials || "{}");
      const credentials = JSON.parse(raw);
      const fullDocData = await getGoogleDocContent(
        document.sourceId,
        credentials.accessToken,
      );
      const parsed = parseGoogleDocToHtml(fullDocData);
      htmlContent = parsed.html;
    }

    await prisma.syncLog.create({
      data: {
        documentId,
        organizationId: document.organizationId,
        userId: document.userId,
        action: "parsing_html_completed",
        status: "INFO",
        message: "HTML généré avec succès",
      },
    });

    // Step 3: AI Enrichment (paid plan feature — see PerformSyncOptions.ai)
    let aiEnrichment = {
      seoTitle: title,
      seoDescription: "",
      seoKeywords: [] as string[],
      excerpt: "",
    };
    let aiImageUrl: string | null = null;

    if (options.ai === true) {
      await prisma.syncLog.create({
        data: {
          documentId,
          organizationId: document.organizationId,
          userId: document.userId,
          action: "ai_enrichment_started",
          status: "INFO",
          message: "Enrichissement IA...",
        },
      });

      aiEnrichment = await enrichContentWithAI(
        documentId,
        htmlContent,
        title,
        document.organizationId,
        document.userId,
      );

      // Check for AI image generation
      aiImageUrl = await generateAIImages(
        documentId,
        htmlContent,
        document.organizationId,
        document.userId,
      );

      await prisma.syncLog.create({
        data: {
          documentId,
          organizationId: document.organizationId,
          userId: document.userId,
          action: "ai_enrichment_completed",
          status: "INFO",
          message: "Enrichissement IA terminé",
        },
      });
    } else {
      await prisma.syncLog.create({
        data: {
          documentId,
          organizationId: document.organizationId,
          userId: document.userId,
          action: "ai_enrichment_skipped",
          status: "INFO",
          message: "AI enrichment is disabled for this run",
        },
      });
    }

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
    });

    // Step 5: Publish to destination
    await prisma.syncLog.create({
      data: {
        documentId,
        organizationId: document.organizationId,
        userId: document.userId,
        action: "publish_started",
        status: "INFO",
        message: "Publication vers la destination...",
      },
    });

    await publishToDestination(document, htmlContent);

    // Step 6: Update status to synced
    await prisma.document.update({
      where: { id: documentId },
      data: {
        syncStatus: "SYNCED",
        lastSyncedAt: new Date(),
        status: "PUBLISHED",
      },
    });

    await prisma.syncLog.create({
      data: {
        userId: document.userId,
        organizationId: document.organizationId,
        documentId,
        action: "sync_completed",
        status: "SUCCESS",
        message: "Document synchronisé avec succès",
      },
    });

    // Notify outbound webhooks after the document is marked SYNCED. A webhook
    // failure is logged per endpoint and never changes the sync result.
    if (document.destConnector) {
      try {
        await dispatchSyncWebhooks({
          organizationId: document.organizationId,
          connectorId: document.destConnector.id,
          documentId,
          documentTitle: title,
          userId: document.userId,
          success: true,
        });
      } catch (webhookError) {
        console.error("Failed to dispatch sync webhooks:", webhookError);
      }
    }

    // Send success email
    try {
      const user = await prisma.user.findUnique({
        where: { id: document.userId },
      });
      if (
        user?.email &&
        (await shouldSendNotification(document.userId, "syncSuccess"))
      ) {
        await sendSyncCompleteEmail(user.email, document.title, true);
      }
    } catch (emailError) {
      console.error("Failed to send sync complete email:", emailError);
    }

    return {
      success: true,
      error: ERR_SYNC_SUCCESS,
      documentId,
    };
  } catch (error) {
    // Rollback the version increment that was done during optimistic locking.
    // Without this, each failed sync permanently increments the version number,
    // making it an unreliable indicator of actual sync count and potentially
    // causing false conflict detection in two-way sync.
    try {
      await prisma.document.update({
        where: { id: documentId },
        data: {
          syncStatus: "FAILED",
          lastSyncError: sanitizeErrorMessage(error),
          version: { decrement: 1 },
        },
      });

      await prisma.syncLog.create({
        data: {
          userId: document.userId,
          organizationId: document.organizationId,
          documentId,
          action: "sync_failed",
          status: "ERROR",
          message: sanitizeErrorMessage(error),
        },
      });
    } catch (rollbackError) {
      console.error("Rollback failed:", rollbackError);
    }

    // Notify outbound webhooks about the failure. As with success delivery,
    // webhook errors are isolated from the sync result.
    if (document.destConnector) {
      try {
        await dispatchSyncWebhooks({
          organizationId: document.organizationId,
          connectorId: document.destConnector.id,
          documentId,
          documentTitle: title,
          userId: document.userId,
          success: false,
          error: sanitizeErrorMessage(error),
        });
      } catch (webhookError) {
        console.error("Failed to dispatch sync webhooks:", webhookError);
      }
    }

    // Send failure email
    try {
      const user = await prisma.user.findUnique({
        where: { id: document.userId },
      });
      if (
        user?.email &&
        (await shouldSendNotification(document.userId, "syncFailed"))
      ) {
        await sendSyncCompleteEmail(user.email, document.title, false);
      }
    } catch (emailError) {
      console.error("Failed to send sync failure email:", emailError);
    }

    return {
      success: false,
      error: ERR_API_FAILED,
      documentId,
    };
  }
}

async function publishToDestination(
  document: PublishDocument,
  htmlContent: string,
) {
  if (!document.destConnector) {
    throw new Error("No destination connector configured");
  }

  const rawCredentials = decrypt(document.destConnector.credentials || "");
  const config = (document.destConnector.config || {}) as Record<
    string,
    string
  >;

  if (!rawCredentials) {
    throw new Error("Destination connector credentials are missing");
  }

  // Publishing is fail-closed: a sync is only marked SYNCED after one of the
  // branches below has actually created or updated the remote post.
  let published = false;

  if (document.destConnector.type === "WORDPRESS") {
    await assertSafeOutboundUrl(config.siteUrl);
    const { createWordPressClient } = await import("./wordpress");
    const creds = Buffer.from(rawCredentials, "base64").toString().split(":");
    if (!creds[0] || !creds[1]) {
      throw new Error("WordPress credentials are incomplete");
    }
    const client = createWordPressClient(config.siteUrl, creds[0], creds[1]);

    if (document.slug) {
      const postId = Number.parseInt(document.slug, 10);
      if (!Number.isFinite(postId)) {
        throw new Error("WordPress post id is invalid");
      }
      await client.updatePost(postId, {
        title: document.title,
        content: htmlContent,
        status: "publish",
      });
    } else {
      const result = await client.createPost({
        title: document.title,
        content: htmlContent,
        status: "publish",
      });
      await prisma.document.update({
        where: { id: document.id },
        data: { slug: result.id.toString() },
      });
    }
    published = true;
  }

  if (document.destConnector.type === "GHOST") {
    await assertSafeOutboundUrl(config.siteUrl);
    const { createGhostClient } = await import("./ghost");
    const client = createGhostClient(config.siteUrl, rawCredentials);

    if (document.slug) {
      await client.updatePost(document.slug, {
        title: document.title,
        html: htmlContent,
        status: "published",
      });
    } else {
      const result = await client.createPost({
        title: document.title,
        html: htmlContent,
        status: "published",
      });
      const postId = result.posts[0]?.id;
      if (!postId) {
        throw new Error("Ghost did not return a post id");
      }
      await prisma.document.update({
        where: { id: document.id },
        data: { slug: postId },
      });
    }
    published = true;
  }

  if (document.destConnector.type === "WEBFLOW") {
    const { createWebflowClient } = await import("./webflow");
    const client = createWebflowClient(rawCredentials, config.siteId);

    const slug = document.title.toLowerCase().replace(/[^a-z0-9]+/g, "-");

    // A Webflow item must belong to a collection chosen by the user. Picking
    // the first collection silently published into the wrong CMS collection.
    const collectionId = config.collectionId;
    if (!collectionId) {
      throw new Error(
        "Webflow collection ID is required. Reconnect Webflow with a collection selected.",
      );
    }

    if (document.slug) {
      await client.updateItem(collectionId, document.slug, {
        name: document.title,
        slug,
        content: htmlContent,
        status: "published",
      });
    } else {
      const result = await client.createItem(collectionId, {
        name: document.title,
        slug,
        content: htmlContent,
        status: "published",
      });
      const itemId = result.items[0]?.id;
      if (!itemId) {
        throw new Error("Webflow did not return an item id");
      }
      await prisma.document.update({
        where: { id: document.id },
        data: { slug: itemId },
      });
    }
    published = true;
  }

  if (document.destConnector.type === "SHOPIFY") {
    if (!config.shopDomain) {
      throw new Error("Shopify shop domain is required");
    }
    await assertSafeOutboundUrl(`https://${config.shopDomain}`);
    const { createShopifyClient } = await import("./shopify");
    const client = createShopifyClient(config.shopDomain, rawCredentials);

    const blogs = await client.getBlogs();
    const blogId = blogs.blogs[0]?.id;

    if (!blogId) {
      throw new Error(
        "No Shopify blog found. Create a blog in Shopify before syncing articles.",
      );
    }

    if (document.slug) {
      await client.updateArticle(blogId, document.slug, {
        title: document.title,
        body_html: htmlContent,
      });
    } else {
      const result = await client.createArticle(blogId, {
        title: document.title,
        body_html: htmlContent,
      });
      const articleId = result.article?.id;
      if (articleId === undefined || articleId === null) {
        throw new Error("Shopify did not return an article id");
      }
      await prisma.document.update({
        where: { id: document.id },
        data: { slug: articleId.toString() },
      });
    }
    published = true;
  }

  // Contentful integration
  if (document.destConnector.type === "CONTENTFUL") {
    const { createContentfulEntry, updateContentfulEntry, getContentfulEntry } =
      await import("./contentful");
    // Contentful connectors store their config as a JSON string, unlike the
    // object-shaped configs of WordPress/Ghost/Webflow/Shopify.
    const contentfulConfig: Record<string, string> =
      typeof document.destConnector.config === "string"
        ? JSON.parse(decrypt(document.destConnector.config))
        : ((document.destConnector.config || {}) as Record<string, string>);
    const spaceId = contentfulConfig.spaceId;
    const accessToken = rawCredentials;
    const contentTypeId = contentfulConfig.contentTypeId || "article";

    if (!spaceId) {
      throw new Error("Contentful space ID is required");
    }

    const fields = {
      title: { "en-US": document.title },
      body: { "en-US": htmlContent },
      slug: {
        "en-US":
          document.slug ||
          document.title.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      },
    };

    if (document.slug) {
      // Update existing entry — fetch the real Contentful entry version
      // for optimistic concurrency control (X-Contentful-Version).
      // Using the Omnysync document version is incorrect because Contentful
      // manages its own version counter independently.
      const contentfulEntry = await getContentfulEntry(
        accessToken,
        spaceId,
        document.slug,
      );
      if (!contentfulEntry) {
        throw new Error("Contentful entry not found");
      }
      await updateContentfulEntry(
        accessToken,
        spaceId,
        document.slug,
        fields,
        contentfulEntry.version,
      );
    } else {
      const result = await createContentfulEntry(
        accessToken,
        spaceId,
        contentTypeId,
        fields,
      );
      await prisma.document.update({
        where: { id: document.id },
        data: { slug: result.id },
      });
    }
    published = true;
  }

  // Medium integration
  if (document.destConnector.type === "MEDIUM") {
    const { createMediumPost, createMediumPublicationPost } =
      await import("./medium");
    // Medium connectors store their config as a JSON string
    // ({ userId, username, publicationId? }).
    const mediumConfig: Record<string, string> =
      typeof document.destConnector.config === "string"
        ? JSON.parse(decrypt(document.destConnector.config))
        : ((document.destConnector.config || {}) as Record<string, string>);

    if (document.slug) {
      // The Medium API has no update endpoint: re-publishing would create a
      // duplicate post. Fail rather than report a sync that did not publish.
      throw new Error(
        "Medium does not support updating an existing post. Create a new document to publish a new version.",
      );
    }

    const post = {
      title: document.title,
      contentFormat: "html" as const,
      content: htmlContent,
      publishStatus: "public" as const,
    };

    const result = mediumConfig.publicationId
      ? await createMediumPublicationPost(
          rawCredentials,
          mediumConfig.publicationId,
          post,
        )
      : await createMediumPost(rawCredentials, mediumConfig.userId, post);

    await prisma.document.update({
      where: { id: document.id },
      data: { slug: result.id },
    });
    published = true;
  }

  if (!published) {
    throw new Error(
      `Unsupported destination connector type: ${document.destConnector.type}`,
    );
  }
}

export async function detectAndSyncChanges(
  documentId: string,
  userId: string,
): Promise<SyncResult> {
  const document = await prisma.document.findUnique({
    where: { id: documentId },
    include: {
      sourceConnector: true,
      destConnector: true,
    },
  });

  if (!document) {
    return { success: false, error: ERR_DOC_NOT_FOUND, documentId };
  }

  // Vérifier les droits d'accès
  await requireDocumentAccess(documentId, userId);

  if (document.status !== "PUBLISHED") {
    return { success: false, error: ERR_DOC_NOT_PUBLISHED, documentId };
  }

  try {
    let newContent = "";
    let newTitle = document.title;

    if (document.sourceConnector?.type === "GOOGLE_DOCS") {
      const raw = decrypt(document.sourceConnector.credentials || "{}");
      const credentials = JSON.parse(raw);
      const docData = await getGoogleDocContent(
        document.sourceId!,
        credentials.accessToken,
      );
      newContent = docData.content;
      newTitle = docData.title;
    }

    const { detectContentChanges: detectChanges } = await import("./ai");
    const result = await detectChanges(document.content || "", newContent);

    if (!result.hasChanges) {
      return {
        success: true,
        error: ERR_SYNC_NO_CHANGES,
        documentId,
        changesDetected: false,
      };
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
    });

    if (!document.sourceConnectorId || !document.destConnectorId) {
      return {
        success: false,
        error: "Missing connector IDs",
        documentId,
      };
    }

    return performSync(
      documentId,
      document.sourceConnectorId,
      document.destConnectorId,
      userId,
    );
  } catch (error) {
    return {
      success: false,
      error: (error as Error).message,
      documentId,
    };
  }
}

export async function checkRemoteChanges(documentId: string, userId: string) {
  const document = await prisma.document.findUnique({
    where: { id: documentId },
    include: {
      destConnector: true,
    },
  });

  if (!document || !document.destConnector) return null;

  // Vérifier les droits d'accès
  await requireDocumentAccess(documentId, userId);

  const credentials = decrypt(document.destConnector.credentials || "");
  const config = (document.destConnector.config || {}) as Record<
    string,
    string
  >;

  if (document.destConnector.type === "WORDPRESS") {
    const { createWordPressClient } = await import("./wordpress");
    const creds = Buffer.from(credentials, "base64").toString().split(":");
    const client = createWordPressClient(config.siteUrl, creds[0], creds[1]);
    return client.getPost(parseInt(document.slug || "0"));
  }

  if (document.destConnector.type === "GHOST") {
    const { createGhostClient } = await import("./ghost");
    const client = createGhostClient(config.siteUrl, credentials);
    return client.getPost(document.slug || "");
  }

  return null;
}
