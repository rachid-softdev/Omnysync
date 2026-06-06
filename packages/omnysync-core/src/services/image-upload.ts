import { decrypt } from "../crypto";
import { prisma } from "../prisma";
import { requireDocumentAccess } from "./authz";

const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10 MB
const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
];

/**
 * Valide une URL d'image pour prévenir les attaques SSRF
 */
function validateImageUrl(url: string): void {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("Invalid image URL");
  }

  // Bloquer les adresses IP privées
  const hostname = parsed.hostname.toLowerCase();
  const blockedPatterns = [
    /^127\./,
    /^10\./,
    /^172\.(1[6-9]|2\d|3[01])\./,
    /^192\.168\./,
    /^0\./,
    /^localhost$/,
    /^169\.254\./,
    /^::1$/,
    /^fc00:/,
    /^fe80:/,
  ];

  for (const pattern of blockedPatterns) {
    if (pattern.test(hostname)) {
      throw new Error("Image URL points to a private network");
    }
  }

  // Only allow HTTPS
  if (parsed.protocol !== "https:") {
    throw new Error("Only HTTPS image URLs are allowed");
  }
}

export async function uploadImageToDestination(
  imageUrl: string,
  documentId: string,
  userId: string,
): Promise<string | null> {
  const document = await prisma.document.findUnique({
    where: { id: documentId },
    include: { destConnector: true },
  });

  if (!document?.destConnector) return null;

  await requireDocumentAccess(documentId, userId);

  // Download the image with SSRF protection
  validateImageUrl(imageUrl);

  const imageResponse = await fetch(imageUrl);
  if (!imageResponse.ok) return null;

  // Validate content type
  const contentType = imageResponse.headers.get("content-type") || "";
  if (!ALLOWED_IMAGE_TYPES.includes(contentType)) {
    console.warn(`Rejected image with content-type: ${contentType}`);
    return null;
  }

  // Validate content length
  const contentLength = parseInt(
    imageResponse.headers.get("content-length") || "0",
  );
  if (contentLength > MAX_IMAGE_SIZE) {
    console.warn(`Image too large: ${contentLength} bytes`);
    return null;
  }

  const arrayBuffer = await imageResponse.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const filename = `omnysync-${Date.now()}.png`;

  const rawCredentials = decrypt(document.destConnector.credentials || "");
  const config = (document.destConnector.config || {}) as Record<string, any>;

  try {
    if (document.destConnector.type === "WORDPRESS") {
      const { createWordPressClient } = await import("./wordpress");
      const creds = Buffer.from(rawCredentials, "base64").toString().split(":");
      const client = createWordPressClient(config.siteUrl, creds[0], creds[1]);

      const blob = new Blob([buffer], { type: "image/png" });
      const result = await client.uploadMedia({ file: blob, title: filename });
      return result.source_url;
    }

    if (document.destConnector.type === "GHOST") {
      const { createGhostClient } = await import("./ghost");
      const client = createGhostClient(config.siteUrl, rawCredentials);

      const blob = new Blob([buffer], { type: "image/png" });
      const result = await client.uploadImage({ file: blob, filename });
      return result.images?.[0]?.url || null;
    }

    if (document.destConnector.type === "WEBFLOW") {
      const { createWebflowClient } = await import("./webflow");
      const client = createWebflowClient(rawCredentials, config.siteId);

      const blob = new Blob([buffer], { type: "image/png" });
      const result = await client.uploadMedia(blob, filename);
      return result.url;
    }

    if (document.destConnector.type === "SHOPIFY") {
      const { createShopifyClient } = await import("./shopify");
      const client = createShopifyClient(config.shopDomain, rawCredentials);

      const base64 = buffer.toString("base64");
      const result = await client.uploadImage({ attachment: base64, filename });
      return result.asset?.src || null;
    }
  } catch (error) {
    console.error(
      `Image upload failed for ${document.destConnector.type}:`,
      error,
    );
  }

  return null;
}

export async function uploadAllImages(
  documentId: string,
  userId: string,
): Promise<string[]> {
  const document = await prisma.document.findUnique({
    where: { id: documentId },
  });

  if (!document?.featuredImage) return [];

  const urls: string[] = [];

  // Upload featured image
  const featuredUrl = await uploadImageToDestination(
    document.featuredImage,
    documentId,
    userId,
  );
  if (featuredUrl) {
    urls.push(featuredUrl);
    await prisma.document.update({
      where: { id: documentId },
      data: { featuredImage: featuredUrl },
    });
  }

  return urls;
}
