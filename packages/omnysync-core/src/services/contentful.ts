import { prisma } from "../../prisma"
import { encrypt, decrypt } from "../crypto"
import { fetchWithRetry } from "../http"
import { ERR_FETCH_CONTENT } from "../errors"

class APIError extends Error {
  constructor(
    public code: string,
    message: string
  ) {
    super(message)
    this.name = "APIError"
  }
}

const CONTENTFUL_CDN = "https://cdn.contentful.com"
const CONTENTFUL_MANAGEMENT = "https://api.contentful.com"

export interface ContentfulSpace {
  id: string
  name: string
}

export interface ContentfulContentType {
  id: string
  name: string
  description?: string
}

export interface ContentfulEntry {
  id: string
  title: string
  content: string
  createdAt: string
  updatedAt: string
  fields: Record<string, unknown>
}

/**
 * Liste les espaces Contentful accessibles
 */
export async function listContentfulSpaces(accessToken: string): Promise<ContentfulSpace[]> {
  try {
    const data = await fetchWithRetry<{ items: ContentfulSpace[] }>(
      `${CONTENTFUL_MANAGEMENT}/spaces`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    )
    return data.items || []
  } catch (error) {
    throw new APIError(ERR_FETCH_CONTENT, "Failed to fetch Contentful spaces")
  }
}

/**
 * Liste les types de contenu d'un espace
 */
export async function listContentfulContentTypes(
  accessToken: string,
  spaceId: string
): Promise<ContentfulContentType[]> {
  try {
    const data = await fetchWithRetry<{ items: ContentfulContentType[] }>(
      `${CONTENTFUL_MANAGEMENT}/spaces/${spaceId}/content_types`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    )
    return data.items || []
  } catch (error) {
    throw new APIError(ERR_FETCH_CONTENT, "Failed to fetch content types")
  }
}

/**
 * Liste les entrées d'un type de contenu
 */
export async function listContentfulEntries(
  accessToken: string,
  spaceId: string,
  contentTypeId: string,
  options: {
    limit?: number
    skip?: number
  } = {}
): Promise<ContentfulEntry[]> {
  const params = new URLSearchParams({
    content_type: contentTypeId,
    limit: (options.limit || 100).toString(),
    skip: (options.skip || 0).toString(),
  })

  try {
    const data = await fetchWithRetry<{ items: ContentfulEntry[] }>(
      `${CONTENTFUL_CDN}/spaces/${spaceId}/entries?${params}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    )
    
    return (data.items || []).map((entry) => ({
      id: entry.sys?.id || "",
      title: entry.fields?.title || entry.fields?.name || "Untitled",
      content: JSON.stringify(entry.fields, null, 2),
      createdAt: entry.sys?.createdAt || "",
      updatedAt: entry.sys?.updatedAt || "",
      fields: entry.fields || {},
    }))
  } catch (error) {
    throw new APIError(ERR_FETCH_CONTENT, "Failed to fetch entries")
  }
}

/**
 * Convertit une entrée Contentful en format document
 */
export function contentfulEntryToDocument(entry: ContentfulEntry): {
  title: string
  content: string
  metadata: Record<string, unknown>
} {
  // Chercher le champ "body" ou "content" ou "description"
  const contentFields = entry.fields.body || entry.fields.content || 
                        entry.fields.description || entry.fields.text
  
  let content = ""
  
  if (typeof contentFields === "string") {
    content = contentFields
  } else if (typeof contentFields === "object") {
    // Contentful peut avoir du Rich Text
    content = JSON.stringify(contentFields)
  } else {
    content = JSON.stringify(entry.fields)
  }

  return {
    title: entry.title,
    content,
    metadata: {
      contentfulId: entry.id,
      createdAt: entry.createdAt,
      updatedAt: entry.updatedAt,
      fields: entry.fields,
    },
  }
}

/**
 * Crée une nouvelle entrée dans Contentful (pour publication)
 */
export async function createContentfulEntry(
  accessToken: string,
  spaceId: string,
  contentTypeId: string,
  fields: Record<string, unknown>
): Promise<{ id: string }> {
  try {
    const data = await fetchWithRetry<{ sys: { id: string } }>(
      `${CONTENTFUL_MANAGEMENT}/spaces/${spaceId}/entries`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/vnd.contentful.management.v1+json",
          "X-Contentful-Content-Type": contentTypeId,
        },
        body: JSON.stringify({ fields }),
      }
    )
    
    return { id: data.sys.id }
  } catch (error) {
    throw new APIError(ERR_FETCH_CONTENT, "Failed to create entry")
  }
}

/**
 * Met à jour une entrée existante
 */
export async function updateContentfulEntry(
  accessToken: string,
  spaceId: string,
  entryId: string,
  fields: Record<string, unknown>,
  version: number
): Promise<{ id: string }> {
  try {
    const data = await fetchWithRetry<{ sys: { id: string } }>(
      `${CONTENTFUL_MANAGEMENT}/spaces/${spaceId}/entries/${entryId}`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/vnd.contentful.management.v1+json",
          "X-Contentful-Version": version.toString(),
        },
        body: JSON.stringify({ fields }),
      }
    )
    
    return { id: data.sys.id }
  } catch (error) {
    throw new APIError(ERR_FETCH_CONTENT, "Failed to update entry")
  }
}

/**
 * Sauvegarde un connecteur Contentful
 */
export async function saveContentfulConnector(
  userId: string,
  organizationId: string,
  accessToken: string,
  config: {
    spaceId: string
    contentTypeId?: string
    environment?: string
  }
) {
  // Vérifier que le token est valide en listant les espaces
  await listContentfulSpaces(accessToken)

  return prisma.connector.create({
    data: {
      userId,
      organizationId,
      type: "CONTENTFUL",
      name: "Contentful",
      status: "ACTIVE",
      credentials: encrypt(accessToken),
      config: JSON.stringify(config),
    },
  })
}

/**
 * Liste les documents disponibles depuis Contentful
 */
export async function listContentfulDocuments(
  connectorId: string
): Promise<Array<{ id: string; title: string }>> {
  const connector = await prisma.connector.findUnique({
    where: { id: connectorId },
  })

  if (!connector || connector.type !== "CONTENTFUL") {
    throw new Error("Invalid Contentful connector")
  }

  const accessToken = decrypt(connector.credentials || "")
  const config = JSON.parse(decrypt(connector.config || "{}"))

  if (!config.spaceId) {
    return []
  }

  // Si pas de content type, lister tous les types et leurs entrées
  if (!config.contentTypeId) {
    const contentTypes = await listContentfulContentTypes(accessToken, config.spaceId)
    
    const documents: Array<{ id: string; title: string }> = []
    
    for (const ct of contentTypes.slice(0, 3)) { // Limiter à 3 types
      const entries = await listContentfulEntries(accessToken, config.spaceId, ct.id, {
        limit: 10,
      })
      
      for (const entry of entries) {
        documents.push({
          id: `${ct.id}:${entry.id}`,
          title: `${ct.name} - ${entry.title}`,
        })
      }
    }
    
    return documents
  }

  // Sinon, récupérer les entrées du type spécifié
  const entries = await listContentfulEntries(accessToken, config.spaceId, config.contentTypeId)
  
  return entries.map((entry) => ({
    id: entry.id,
    title: entry.title,
  }))
}

/**
 * Récupère le contenu complet d'une entrée
 */
export async function getContentfulEntryContent(
  connectorId: string,
  entryId: string
): Promise<{ id: string; title: string; content: string; metadata: Record<string, unknown> }> {
  const connector = await prisma.connector.findUnique({
    where: { id: connectorId },
  })

  if (!connector || connector.type !== "CONTENTFUL") {
    throw new Error("Invalid Contentful connector")
  }

  const accessToken = decrypt(connector.credentials || "")
  const config = JSON.parse(decrypt(connector.config || "{}"))

  if (!config.spaceId) {
    throw new Error("Missing space ID")
  }

  // Parse entryId (peut être contentTypeId:entryId ou juste entryId)
  const [contentTypeId, actualEntryId] = entryId.includes(":")
    ? entryId.split(":")
    : [config.contentTypeId, entryId]

  if (!contentTypeId || !actualEntryId) {
    throw new Error("Invalid entry ID")
  }

  const entries = await listContentfulEntries(accessToken, config.spaceId, contentTypeId, {
    limit: 1,
  })

  const entry = entries.find((e) => e.id === actualEntryId)
  
  if (!entry) {
    throw new Error("Entry not found")
  }

  const doc = contentfulEntryToDocument(entry)
  
  return {
    id: actualEntryId,
    title: doc.title,
    content: doc.content,
    metadata: doc.metadata,
  }
}

/**
 * Teste la connexion à Contentful
 */
export async function testContentfulConnection(
  accessToken: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await listContentfulSpaces(accessToken)
    return { success: true }
  } catch (error) {
    return {
      success: false,
      error: (error as Error).message,
    }
  }
}