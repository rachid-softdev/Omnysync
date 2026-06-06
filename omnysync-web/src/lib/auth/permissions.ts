/**
 * Système de permissions granulaire (RBAC)
 * Omnysync - 2026
 */

import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { cache } from '@/lib/cache'

// ============================================================================
// TYPES
// ============================================================================

export type Permission =
  // Documents
  | 'document:read'
  | 'document:create'
  | 'document:update'
  | 'document:delete'
  | 'document:publish'

  // Connectors
  | 'connector:read'
  | 'connector:create'
  | 'connector:update'
  | 'connector:delete'
  | 'connector:test'

  // Sync
  | 'sync:read'
  | 'sync:create'
  | 'sync:run'
  | 'sync:update'
  | 'sync:delete'

  // Team
  | 'team:read'
  | 'team:invite'
  | 'team:update'
  | 'team:remove'

  // Billing
  | 'billing:read'
  | 'billing:manage'

  // Settings
  | 'settings:read'
  | 'settings:update'

  // Webhooks
  | 'webhook:read'
  | 'webhook:create'
  | 'webhook:delete'

  // Analytics
  | 'analytics:read'

  // API Keys
  | 'apikey:read'
  | 'apikey:create'
  | 'apikey:delete'

  // Approval
  | 'approval:read'
  | 'approval:manage'

export type Role = 'owner' | 'admin' | 'member' | 'viewer'

// Matrice de permissions par rôle
const rolePermissions: Record<Role, Permission[]> = {
  owner: [
    // Documents
    'document:read',
    'document:create',
    'document:update',
    'document:delete',
    'document:publish',
    // Connectors
    'connector:read',
    'connector:create',
    'connector:update',
    'connector:delete',
    'connector:test',
    // Sync
    'sync:read',
    'sync:create',
    'sync:run',
    'sync:update',
    'sync:delete',
    // Team
    'team:read',
    'team:invite',
    'team:update',
    'team:remove',
    // Billing
    'billing:read',
    'billing:manage',
    // Settings
    'settings:read',
    'settings:update',
    // Webhooks
    'webhook:read',
    'webhook:create',
    'webhook:delete',
    // Analytics
    'analytics:read',
    // API Keys
    'apikey:read',
    'apikey:create',
    'apikey:delete',
    // Approval
    'approval:read',
    'approval:manage',
  ],
  admin: [
    // Documents
    'document:read',
    'document:create',
    'document:update',
    'document:delete',
    'document:publish',
    // Connectors
    'connector:read',
    'connector:create',
    'connector:update',
    'connector:delete',
    'connector:test',
    // Sync
    'sync:read',
    'sync:create',
    'sync:run',
    'sync:update',
    'sync:delete',
    // Team
    'team:read',
    'team:invite',
    'team:update',
    // Billing
    'billing:read',
    // Settings
    'settings:read',
    'settings:update',
    // Webhooks
    'webhook:read',
    'webhook:create',
    'webhook:delete',
    // Analytics
    'analytics:read',
    // API Keys
    'apikey:read',
    'apikey:create',
    // Approval
    'approval:read',
    'approval:manage',
  ],
  member: [
    // Documents
    'document:read',
    'document:create',
    'document:update',
    'document:publish',
    // Connectors
    'connector:read',
    'connector:create',
    // Sync
    'sync:read',
    'sync:create',
    'sync:run',
    // Team
    'team:read',
    // Settings
    'settings:read',
    // Analytics
    'analytics:read',
    // Approval
    'approval:read',
  ],
  viewer: [
    // Documents
    'document:read',
    // Connectors
    'connector:read',
    // Sync
    'sync:read',
    // Team
    'team:read',
    // Analytics
    'analytics:read',
  ],
}

// ============================================================================
// FONCTIONS
// ============================================================================

/**
 * Récupère le rôle d'un utilisateur dans une organisation
 */
export async function getUserRole(userId: string, organizationId: string): Promise<Role | null> {
  const membership = await prisma.userOrganization.findUnique({
    where: {
      userId_organizationId: {
        userId,
        organizationId,
      },
    },
    select: { role: true },
  })

  if (!membership) return null

  return membership.role.toLowerCase() as Role
}

/**
 * Vérifie si un utilisateur a une permission spécifique
 */
export async function hasPermission(
  userId: string,
  organizationId: string,
  permission: Permission
): Promise<boolean> {
  const role = await getUserRole(userId, organizationId)

  if (!role) return false

  // Cache pendant 5 minutes
  const cacheKey = `perm:${userId}:${organizationId}:${permission}`

  const cached = await cache.get<boolean>(cacheKey)
  if (cached !== null) return cached

  const permissions = rolePermissions[role]
  const result = permissions.includes(permission)

  await cache.set(cacheKey, result, { ttl: 5 * 60 })
  return result
}

/**
 * Wrapper pour vérifier les permissions dans une API route
 */
export async function requirePermission(
  permission: Permission,
  organizationId: string
): Promise<{ authorized: boolean; userId?: string; error?: string }> {
  const session = await auth()

  if (!session?.user?.id) {
    return { authorized: false, error: 'Non autorisé' }
  }

  const hasAccess = await hasPermission(session.user.id, organizationId, permission)

  if (!hasAccess) {
    return {
      authorized: false,
      error: `Permission requise: ${permission}`,
    }
  }

  return { authorized: true, userId: session.user.id }
}

/**
 * Middleware pour vérifier les permissions
 */
export function withPermission(permission: Permission) {
  return async (organizationId: string) => {
    const result = await requirePermission(permission, organizationId)

    if (!result.authorized) {
      throw new Error(result.error)
    }

    return result.userId!
  }
}

/**
 * Récupère toutes les permissions d'un utilisateur dans une org
 */
export async function getUserPermissions(
  userId: string,
  organizationId: string
): Promise<Permission[]> {
  const role = await getUserRole(userId, organizationId)

  if (!role) return []

  return rolePermissions[role]
}

/**
 * Vérifie si l'utilisateur peut effectuer une action sur une ressource
 */
export async function canAccessResource(
  userId: string,
  organizationId: string,
  resourceType: 'document' | 'connector' | 'sync',
  resourceId: string,
  action: 'read' | 'update' | 'delete'
): Promise<boolean> {
  const role = await getUserRole(userId, organizationId)

  if (!role) return false

  // Le owner et admin peuvent tout faire
  if (role === 'owner' || role === 'admin') return true

  // Vérifier que la ressource appartient à l'organisation
  switch (resourceType) {
    case 'document': {
      const doc = await prisma.document.findFirst({
        where: { id: resourceId, organizationId },
        select: { userId: true },
      })
      return doc !== null
    }
    case 'connector': {
      const connector = await prisma.connector.findFirst({
        where: { id: resourceId, organizationId },
        select: { userId: true },
      })
      return connector !== null
    }
    case 'sync': {
      // Les sync sont au niveau org, seul le rôle compte
      return rolePermissions[role].includes(`${resourceType}:${action}`)
    }
    default:
      return false
  }
}

// ============================================================================
// HELPERS POUR LES ROUTES
// ============================================================================

/**
 * Utilitaire pour vérifier les permissions et retourner 403 si non autorisé
 */
export async function checkPermission(
  organizationId: string,
  permission: Permission
): Promise<string> {
  const result = await requirePermission(permission, organizationId)

  if (!result.authorized) {
    throw new Error(result.error)
  }

  return result.userId!
}

/**
 * Filtrer les résultats selon les permissions
 */
export async function filterByPermission<T extends { organizationId: string }>(
  userId: string,
  organizationId: string,
  items: T[],
  permission: Permission
): Promise<T[]> {
  const hasAccess = await hasPermission(userId, organizationId, permission)

  if (hasAccess) return items

  // Si pas de permission, retourner seulement les items créés par l'utilisateur
  return items.filter((item) => 'userId' in item && item.userId === userId)
}
