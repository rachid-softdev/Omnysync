/**
 * Service de Synchronisation Bidirectionnelle (2-Way Sync)
 * Omnysync - 2026
 */

import { prisma } from '@/lib/prisma'
import { decrypt } from '@/lib/crypto'
import { auditSync } from '@/lib/audit'
import { createWordPressClient } from './wordpress'
import { createGhostClient } from './ghost'
import { createWebflowClient } from './webflow'
import { createShopifyClient } from './shopify'
import { getNotionPageContent } from './notion'
import { getGoogleDocContent } from './google-docs'
import { detectContentChanges } from './ai'

// ============================================================================
// TYPES
// ============================================================================

export interface RemoteContent {
  content: string
  title: string
  updatedAt: Date
  metadata?: Record<string, unknown>
}

export interface ConflictInfo {
  hasConflict: boolean
  sourceContent?: string
  destContent?: string
  sourceUpdatedAt?: Date
  destUpdatedAt?: Date
  conflictType?: 'source-changed' | 'dest-changed' | 'both-changed'
}

export interface TwoWaySyncResult {
  success: boolean
  direction: 'source-to-dest' | 'dest-to-source' | 'none'
  changesDetected: boolean
  message: string
}

// ============================================================================
// FETCH REMOTE CONTENT
// ============================================================================

/**
 * Récupère le contenu actuel depuis la destination
 */
async function fetchRemoteContent(documentId: string): Promise<RemoteContent | null> {
  const document = await prisma.document.findUnique({
    where: { id: documentId },
    include: { destConnector: true },
  })

  if (!document || !document.destConnector) {
    return null
  }

  const rawCredentials = decrypt(
    document.destConnector.config?.credentials?.toString() ||
      document.destConnector.credentials ||
      ''
  )
  const config = (document.destConnector.config as Record<string, string>) || {}

  // WordPress
  if (document.destConnector.type === 'WORDPRESS') {
    const creds = Buffer.from(rawCredentials, 'base64').toString().split(':')
    const client = createWordPressClient(config.siteUrl, creds[0], creds[1])
    const post = await client.getPost(parseInt(document.slug || '0'))
    return {
      content: post.content,
      title: post.title,
      updatedAt: new Date(), // WordPress ne donne pas la date de modif directement
      metadata: { status: post.status },
    }
  }

  // Ghost
  if (document.destConnector.type === 'GHOST') {
    const client = createGhostClient(config.siteUrl, rawCredentials)
    const post = await client.getPost(document.slug || '')
    return {
      content: post.posts?.[0]?.html || '',
      title: post.posts?.[0]?.title || '',
      updatedAt: post.posts?.[0]?.updated_at ? new Date(post.posts[0].updated_at) : new Date(),
    }
  }

  // Webflow - pas d'API pour récupérer le contenu facilement
  if (document.destConnector.type === 'WEBFLOW') {
    // Webflow CMS ne permet pas de récupérer le contenu facilement via API
    // On se base sur le lastSyncedAt comme référence
    return {
      content: document.htmlContent || '',
      title: document.title,
      updatedAt: document.lastSyncedAt || new Date(0),
    }
  }

  // Shopify
  if (document.destConnector.type === 'SHOPIFY') {
    const client = createShopifyClient(config.shopDomain, rawCredentials)
    const blogs = await client.getBlogs()
    const blogId = blogs.blogs[0]?.id
    if (!blogId) return null
    // Shopify articles sont en lecture seule via API
    return {
      content: document.htmlContent || '',
      title: document.title,
      updatedAt: document.lastSyncedAt || new Date(0),
    }
  }

  return null
}

/**
 * Récupère le contenu actuel depuis la source
 */
async function fetchSourceContent(documentId: string): Promise<RemoteContent | null> {
  const document = await prisma.document.findUnique({
    where: { id: documentId },
    include: { sourceConnector: true },
  })

  if (!document || !document.sourceConnector || !document.sourceId) {
    return null
  }

  const rawCredentials = decrypt(document.sourceConnector.credentials || '{}')
  const config = (document.sourceConnector.config as Record<string, string>) || {}

  if (document.sourceConnector.type === 'GOOGLE_DOCS') {
    const credentials = JSON.parse(rawCredentials)
    const docData = await getGoogleDocContent(document.sourceId, credentials.accessToken)
    return {
      content: docData.content,
      title: docData.title,
      updatedAt: docData.modifiedTime ? new Date(docData.modifiedTime) : new Date(),
    }
  }

  if (document.sourceConnector.type === 'NOTION') {
    const pageData = await getNotionPageContent(document.sourceId, rawCredentials)
    return {
      content: pageData.content,
      title: pageData.title,
      updatedAt: new Date(pageData.lastEditedTime),
    }
  }

  return null
}

// ============================================================================
// DETECT CONFLICTS
// ============================================================================

/**
 * Détecte les conflits entre source et destination
 */
export async function detectConflicts(documentId: string): Promise<ConflictInfo> {
  const document = await prisma.document.findUnique({
    where: { id: documentId },
  })

  if (!document) {
    return { hasConflict: false }
  }

  const [sourceContent, destContent] = await Promise.all([
    fetchSourceContent(documentId),
    fetchRemoteContent(documentId),
  ])

  // Pas de contenu distant (jamais sync)
  if (!destContent) {
    return { hasConflict: false }
  }

  // Comparer les contenus
  const normalizedStored = document.htmlContent || document.content || ''
  const normalizedDest = destContent.content || ''

  // Si le contenu en base != contenu distant, il y a un changement
  const hasDestChanged = normalizedStored.trim() !== normalizedDest.trim()

  // Si la source a été modifiée depuis le dernier sync
  const hasSourceChanged =
    document.sourceUpdatedAt && sourceContent && sourceContent.updatedAt > document.sourceUpdatedAt

  if (hasDestChanged && hasSourceChanged) {
    return {
      hasConflict: true,
      sourceContent: sourceContent?.content,
      destContent: normalizedDest,
      sourceUpdatedAt: sourceContent?.updatedAt,
      destUpdatedAt: destContent.updatedAt,
      conflictType: 'both-changed',
    }
  }

  if (hasDestChanged) {
    return {
      hasConflict: true,
      sourceContent: document.htmlContent || document.content,
      destContent: normalizedDest,
      sourceUpdatedAt: document.lastSyncedAt,
      destUpdatedAt: destContent.updatedAt,
      conflictType: 'dest-changed',
    }
  }

  if (hasSourceChanged) {
    return {
      hasConflict: true,
      sourceContent: sourceContent?.content,
      destContent: normalizedDest,
      sourceUpdatedAt: sourceContent?.updatedAt,
      destUpdatedAt: destContent.updatedAt,
      conflictType: 'source-changed',
    }
  }

  return { hasConflict: false }
}

// ============================================================================
// SYNC OPERATIONS
// ============================================================================

/**
 * Synchronise les changements détectés vers la destination
 */
export async function syncFromSource(documentId: string): Promise<TwoWaySyncResult> {
  const document = await prisma.document.findUnique({
    where: { id: documentId },
    include: { sourceConnector: true, destConnector: true },
  })

  if (!document || !document.sourceConnectorId || !document.destConnectorId) {
    return {
      success: false,
      direction: 'none',
      changesDetected: false,
      message: 'Document not found',
    }
  }

  // Récupérer le contenu source actuel
  const sourceContent = await fetchSourceContent(documentId)
  if (!sourceContent) {
    return {
      success: false,
      direction: 'none',
      changesDetected: false,
      message: 'Source content not available',
    }
  }

  // Importer la fonction de sync existante
  const { performSync } = await import('./sync')

  try {
    await performSync(documentId, document.sourceConnectorId, document.destConnectorId)

    // Mettre à jour sourceUpdatedAt
    await prisma.document.update({
      where: { id: documentId },
      data: { sourceUpdatedAt: sourceContent.updatedAt },
    })

    await auditSync.completed(document.organizationId, documentId, {
      sourceType: document.sourceConnector.type,
      destType: document.destConnector?.type,
      direction: 'source-to-dest',
    })

    return {
      success: true,
      direction: 'source-to-dest',
      changesDetected: true,
      message: 'Changes synced from source to destination',
    }
  } catch (error) {
    await auditSync.failed(document.organizationId, documentId, (error as Error).message)
    return {
      success: false,
      direction: 'source-to-dest',
      changesDetected: true,
      message: (error as Error).message,
    }
  }
}

/**
 * Synchronise les changements depuis la destination vers la source
 * Note: Cela ne fonctionne que pour Notion (modifiable via API)
 */
export async function syncFromDest(documentId: string): Promise<TwoWaySyncResult> {
  const document = await prisma.document.findUnique({
    where: { id: documentId },
    include: { sourceConnector: true, destConnector: true },
  })

  if (!document || !document.sourceConnector || !document.destConnector) {
    return {
      success: false,
      direction: 'none',
      changesDetected: false,
      message: 'Document not found',
    }
  }

  // Pour le moment, seulement Notion peut être modifié via API
  if (document.sourceConnector.type !== 'NOTION') {
    return {
      success: false,
      direction: 'none',
      changesDetected: false,
      message: 'Reverse sync not supported for this source type',
    }
  }

  const destContent = await fetchRemoteContent(documentId)
  if (!destContent) {
    return {
      success: false,
      direction: 'none',
      changesDetected: false,
      message: 'Destination content not available',
    }
  }

  // Mettre à jour le document local avec le contenu distant
  await prisma.document.update({
    where: { id: documentId },
    data: {
      content: destContent.content,
      htmlContent: destContent.content,
      title: destContent.title,
      lastSyncedAt: new Date(),
    },
  })

  await auditSync.completed(document.organizationId, documentId, {
    sourceType: document.sourceConnector.type,
    destType: document.destConnector.type,
    direction: 'dest-to-source',
  })

  return {
    success: true,
    direction: 'dest-to-source',
    changesDetected: true,
    message: 'Changes synced from destination to source',
  }
}

/**
 * Résout un conflit avec une stratégie donnée
 */
export async function resolveConflict(
  documentId: string,
  strategy: 'source-wins' | 'dest-wins' | 'keep-both'
): Promise<TwoWaySyncResult> {
  const document = await prisma.document.findUnique({
    where: { id: documentId },
    include: { sourceConnector: true, destConnector: true },
  })

  if (!document) {
    return {
      success: false,
      direction: 'none',
      changesDetected: false,
      message: 'Document not found',
    }
  }

  const conflict = await detectConflicts(documentId)

  if (!conflict.hasConflict) {
    return {
      success: true,
      direction: 'none',
      changesDetected: false,
      message: 'No conflict to resolve',
    }
  }

  switch (strategy) {
    case 'source-wins':
      return syncFromSource(documentId)

    case 'dest-wins':
      return syncFromDest(documentId)

    case 'keep-both':
      // Créer une copie du document avec le contenu distant
      const destContent = await fetchRemoteContent(documentId)
      if (!destContent) {
        return {
          success: false,
          direction: 'none',
          changesDetected: false,
          message: 'Could not fetch destination content',
        }
      }

      await prisma.document.create({
        data: {
          organizationId: document.organizationId,
          userId: document.userId,
          sourceConnectorId: document.sourceConnectorId,
          destConnectorId: document.destConnectorId,
          title: `${document.title} (copy)`,
          content: destContent.content,
          htmlContent: destContent.content,
          status: 'DRAFT',
          syncStatus: 'NOT_SYNCED',
        },
      })

      await auditSync.completed(document.organizationId, document.id, {
        resolution: 'keep-both',
      })

      return {
        success: true,
        direction: 'none',
        changesDetected: true,
        message: 'New document created with destination content',
      }

    default:
      return {
        success: false,
        direction: 'none',
        changesDetected: false,
        message: 'Unknown strategy',
      }
  }
}

/**
 * Vérifie et synchronise automatiquement les changements
 */
export async function checkAndAutoSync(documentId: string): Promise<TwoWaySyncResult> {
  const conflict = await detectConflicts(documentId)

  if (!conflict.hasConflict) {
    return {
      success: true,
      direction: 'none',
      changesDetected: false,
      message: 'No changes detected',
    }
  }

  // Par défaut, on sync depuis la source (comportement standard)
  await auditSync.changesDetected(
    (await prisma.document.findUnique({ where: { id: documentId } }))!.organizationId,
    documentId
  )

  return syncFromSource(documentId)
}
