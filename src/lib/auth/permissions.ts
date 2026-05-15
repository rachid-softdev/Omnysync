/**
 * Système RBAC (Role-Based Access Control)
 * Omnysync - 2026
 */

import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { NextRequest, NextResponse } from "next/server"
import { apiError } from "@/lib/api-error"
import { z } from "zod"

// ============================================================================
// TYPES
// ============================================================================

export type Role = "OWNER" | "ADMIN" | "MEMBER"

export type Permission =
  // Organisation
  | "org:view"
  | "org:update"
  | "org:delete"
  | "org:billing"
  
  // Membres
  | "members:view"
  | "members:invite"
  | "members:remove"
  | "members:edit"
  
  // Connecteurs
  | "connectors:view"
  | "connectors:create"
  | "connectors:edit"
  | "connectors:delete"
  | "connectors:test"
  
  // Documents
  | "documents:view"
  | "documents:create"
  | "documents:edit"
  | "documents:delete"
  | "documents:sync"
  
  // Sync
  | "sync:run"
  | "sync:schedule"
  | "sync:cancel"
  | "sync:view-logs"
  
  // Approvals
  | "approvals:view"
  | "approvals:create"
  | "approvals:respond"
  
  // Analytics
  | "analytics:view"
  | "analytics:export"

// ============================================================================
// PERMISSIONS MATRIX
// ============================================================================

const rolePermissions: Record<Role, Permission[]> = {
  OWNER: [
    // Org
    "org:view", "org:update", "org:delete", "org:billing",
    // Members
    "members:view", "members:invite", "members:remove", "members:edit",
    // Connectors
    "connectors:view", "connectors:create", "connectors:edit", "connectors:delete", "connectors:test",
    // Documents
    "documents:view", "documents:create", "documents:edit", "documents:delete", "documents:sync",
    // Sync
    "sync:run", "sync:schedule", "sync:cancel", "sync:view-logs",
    // Approvals
    "approvals:view", "approvals:create", "approvals:respond",
    // Analytics
    "analytics:view", "analytics:export",
  ],
  
  ADMIN: [
    // Org
    "org:view", "org:update",
    // Members
    "members:view", "members:invite", "members:edit",
    // Connectors
    "connectors:view", "connectors:create", "connectors:edit", "connectors:delete", "connectors:test",
    // Documents
    "documents:view", "documents:create", "documents:edit", "documents:delete", "documents:sync",
    // Sync
    "sync:run", "sync:schedule", "sync:cancel", "sync:view-logs",
    // Approvals
    "approvals:view", "approvals:create", "approvals:respond",
    // Analytics
    "analytics:view", "analytics:export",
  ],
  
  MEMBER: [
    // Org
    "org:view",
    // Members
    "members:view",
    // Connectors
    "connectors:view",
    // Documents
    "documents:view", "documents:create", "documents:edit", "documents:sync",
    // Sync
    "sync:run", "sync:view-logs",
    // Approvals
    "approvals:view", "approvals:respond",
    // Analytics
    "analytics:view",
  ],
}

// ============================================================================
// CORE FUNCTIONS
// ============================================================================

/**
 * Récupère le rôle d'un utilisateur dans une organisation
 */
export async function getUserRole(userId: string, organizationId: string): Promise<Role | null> {
  const membership = await prisma.userOrganization.findFirst({
    where: {
      userId,
      organizationId,
    },
  })
  
  return membership?.role as Role | null
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
  
  return rolePermissions[role].includes(permission)
}

/**
 * Récupère toutes les permissions d'un utilisateur
 */
export async function getUserPermissions(userId: string, organizationId: string): Promise<Permission[]> {
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
  permission: Permission,
  resourceOrgId?: string
): Promise<boolean> {
  // Si une ressource spécifique est fournie, vérifier qu'elle appartient à l'org
  if (resourceOrgId && resourceOrgId !== organizationId) {
    return false
  }
  
  return hasPermission(userId, organizationId, permission)
}

// ============================================================================
// MIDDLEWARE HELPERS
// ============================================================================

/**
 * Résultat d'authentification et vérification
 */
export interface AuthCheck {
  success: boolean
  userId?: string
  organizationId?: string
  role?: Role
  error?: string
}

/**
 * Vérifie l'authentification et récupère le contexte
 */
export async function checkAuth(req: NextRequest): Promise<AuthCheck> {
  const session = await auth()
  
  if (!session?.user?.id) {
    return { success: false, error: "Unauthorized" }
  }
  
  // Extraire organizationId depuis l'URL ou le header
  const orgId = req.headers.get("x-org-id") || req.nextUrl.searchParams.get("orgId")
  
  if (!orgId) {
    return { success: false, error: "Organization ID required" }
  }
  
  const role = await getUserRole(session.user.id, orgId)
  
  if (!role) {
    return { success: false, error: "Not a member of this organization" }
  }
  
  return {
    success: true,
    userId: session.user.id,
    organizationId: orgId,
    role,
  }
}

/**
 * Middleware de protection des routes API
 */
export async function withPermission(
  req: NextRequest,
  permission: Permission
): Promise<AuthCheck> {
  const auth = await checkAuth(req)
  
  if (!auth.success) {
    return auth
  }
  
  const hasAccess = await hasPermission(
    auth.userId!,
    auth.organizationId!,
    permission
  )
  
  if (!hasAccess) {
    return {
      success: false,
      error: `Permission denied: ${permission} required`,
    }
  }
  
  return auth
}

/**
 * Helper pour les API routes Next.js
 */
export async function requirePermission(
  req: NextRequest,
  permission: Permission
): Promise<NextResponse> {
  const check = await withPermission(req, permission)
  
  if (!check.success) {
    return apiError(check.error || "Forbidden", 403)
  }
  
  return NextResponse.next()
}

/**
 * Wrapper pour les handlers d'API routes avec vérification de permission
 */
export function withAuth(
  permission: Permission,
  handler: (req: NextRequest, auth: AuthCheck) => Promise<NextResponse>
) {
  return async (req: NextRequest): Promise<NextResponse> => {
    const auth = await withPermission(req, permission)
    
    if (!auth.success) {
      return apiError(auth.error || "Forbidden", 403)
    }
    
    return handler(req, auth)
  }
}

// ============================================================================
// PERMISSION DECORATORS FOR UI
// ============================================================================

/**
 * Vérifie les permissions et retourne un objet pour l'UI
 */
export async function getPermissionsForUI(userId: string, organizationId: string) {
  const permissions = await getUserPermissions(userId, organizationId)
  
  return {
    isOwner: await hasPermission(userId, organizationId, "org:delete"),
    isAdmin: await hasPermission(userId, organizationId, "members:edit"),
    canInviteMembers: await hasPermission(userId, organizationId, "members:invite"),
    canDeleteOrg: await hasPermission(userId, organizationId, "org:delete"),
    canManageBilling: await hasPermission(userId, organizationId, "org:billing"),
    canCreateDocuments: await hasPermission(userId, organizationId, "documents:create"),
    canSync: await hasPermission(userId, organizationId, "documents:sync"),
    canManageConnectors: await hasPermission(userId, organizationId, "connectors:create"),
    canViewAnalytics: await hasPermission(userId, organizationId, "analytics:view"),
    canExportAnalytics: await hasPermission(userId, organizationId, "analytics:export"),
    permissions,
  }
}

// ============================================================================
// VALIDATION HELPERS
// ============================================================================

/**
 * Schema pour valider les permissions dans les神outes
 */
export const permissionSchema = z.object({
  permission: z.enum([
    "org:view", "org:update", "org:delete", "org:billing",
    "members:view", "members:invite", "members:remove", "members:edit",
    "connectors:view", "connectors:create", "connectors:edit", "connectors:delete", "connectors:test",
    "documents:view", "documents:create", "documents:edit", "documents:delete", "documents:sync",
    "sync:run", "sync:schedule", "sync:cancel", "sync:view-logs",
    "approvals:view", "approvals:create", "approvals:respond",
    "analytics:view", "analytics:export",
  ]),
})

/**
 * Middleware pour vérifier les permissions spécifiques à une action
 */
export async function requireRole(roles: Role[]) {
  return async (req: NextRequest): Promise<NextResponse> => {
    const auth = await checkAuth(req)
    
    if (!auth.success) {
      return apiError(auth.error || "Unauthorized", 401)
    }
    
    if (!auth.role || !roles.includes(auth.role)) {
      return apiError(`Role must be one of: ${roles.join(", ")}`, 403)
    }
    
    return NextResponse.next()
  }
}