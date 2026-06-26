import { prisma } from "../prisma";
import { encrypt, decrypt } from "../crypto";
import { fetchWithRetry } from "../http";

const MEDIUM_API = "https://api.medium.com/v1";

export interface MediumUser {
  id: string;
  username: string;
  name: string;
  url: string;
  imageUrl: string;
}

export interface MediumPost {
  id: string;
  title: string;
  authorId: string;
  tags: string[];
  url: string;
  canonicalUrl: string;
  publishStatus: "public" | "draft" | "unlisted";
  publishedAt: string;
  content: string;
  contentFormat: "html" | "markdown";
}

export interface MediumPublication {
  id: string;
  name: string;
  description: string;
  url: string;
  imageUrl: string;
}

/**
 * Récupère le profil de l'utilisateur Medium
 */
export async function getMediumUser(accessToken: string): Promise<MediumUser> {
  try {
    const data = await fetchWithRetry<{ data: MediumUser }>(
      `${MEDIUM_API}/me`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    );
    return data.data;
  } catch (error) {
    throw new Error(`Failed to fetch Medium user: ${(error as Error).message}`);
  }
}

/**
 * Liste les publications de l'utilisateur
 */
export async function listMediumPublications(
  accessToken: string,
  userId: string,
): Promise<MediumPublication[]> {
  try {
    const data = await fetchWithRetry<{ data: MediumPublication[] }>(
      `${MEDIUM_API}/users/${userId}/publications`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    );
    return data.data || [];
  } catch (error) {
    throw new Error(
      `Failed to fetch publications: ${(error as Error).message}`,
    );
  }
}

/**
 * Crée un post sur Medium
 */
export async function createMediumPost(
  accessToken: string,
  userId: string,
  post: {
    title: string;
    contentFormat: "html" | "markdown";
    content: string;
    tags?: string[];
    canonicalUrl?: string;
    publishStatus?: "public" | "draft" | "unlisted";
  },
): Promise<MediumPost> {
  try {
    const data = await fetchWithRetry<{ data: MediumPost }>(
      `${MEDIUM_API}/users/${userId}/posts`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(post),
      },
    );
    return data.data;
  } catch (error) {
    throw new Error(
      `Failed to create Medium post: ${(error as Error).message}`,
    );
  }
}

/**
 * Crée un post dans une publication
 */
export async function createMediumPublicationPost(
  accessToken: string,
  publicationId: string,
  post: {
    title: string;
    contentFormat: "html" | "markdown";
    content: string;
    tags?: string[];
    canonicalUrl?: string;
    publishStatus?: "public" | "draft" | "unlisted";
  },
): Promise<MediumPost> {
  try {
    const data = await fetchWithRetry<{ data: MediumPost }>(
      `${MEDIUM_API}/publications/${publicationId}/posts`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(post),
      },
    );
    return data.data;
  } catch (error) {
    throw new Error(
      `Failed to create publication post: ${(error as Error).message}`,
    );
  }
}

/**
 * Teste la connexion à Medium
 */
export async function testMediumConnection(
  accessToken: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    await getMediumUser(accessToken);
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: (error as Error).message,
    };
  }
}

/**
 * Sauvegarde un connecteur Medium
 */
export async function saveMediumConnector(
  userId: string,
  organizationId: string,
  accessToken: string,
  config: {
    publicationId?: string;
  } = {},
) {
  // Vérifier que le token est valide
  const user = await getMediumUser(accessToken);

  return prisma.connector.create({
    data: {
      userId,
      organizationId,
      type: "MEDIUM",
      name: `Medium (@${user.username})`,
      status: "ACTIVE",
      credentials: encrypt(accessToken),
      config: JSON.stringify({
        ...config,
        userId: user.id,
        username: user.username,
      }),
    },
  });
}

/**
 * Publie un document sur Medium
 */
export async function publishToMedium(
  connectorId: string,
  documentId: string,
): Promise<{ url: string }> {
  const connector = await prisma.connector.findUnique({
    where: { id: connectorId },
  });

  if (!connector || connector.type !== "MEDIUM") {
    throw new Error("Invalid Medium connector");
  }

  const document = await prisma.document.findUnique({
    where: { id: documentId },
  });

  if (!document) {
    throw new Error("Document not found");
  }

  const accessToken = decrypt(connector.credentials || "");
  const config = JSON.parse(decrypt(connector.config || "{}"));

  const postPayload = {
    title: document.title,
    contentFormat: "html" as const,
    content: document.htmlContent || document.content || "",
    publishStatus: "public" as const,
    tags: document.tags,
    canonicalUrl: undefined as string | undefined,
  };

  let result: MediumPost;

  if (config.publicationId) {
    result = await createMediumPublicationPost(
      accessToken,
      config.publicationId,
      postPayload,
    );
  } else {
    result = await createMediumPost(accessToken, config.userId, postPayload);
  }

  // Mettre à jour le document avec l'ID Medium
  await prisma.document.update({
    where: { id: documentId },
    data: {
      destConnectorId: connectorId,
      slug: result.id,
      syncStatus: "SYNCED",
      lastSyncedAt: new Date(),
    },
  });

  return { url: result.url };
}
