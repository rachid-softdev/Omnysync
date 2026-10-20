import { describe, it, expect, vi, beforeEach } from 'vitest'

// Prevent the real @/lib/prisma (which re-exports @omnysync/core/prisma) from
// loading so no node: builtins are pulled in.
const mockPrisma = vi.hoisted(() => ({
  userOrganization: {
    findUnique: vi.fn(),
  },
  document: {
    findFirst: vi.fn(),
  },
  connector: {
    findFirst: vi.fn(),
  },
  sync: {
    findFirst: vi.fn(),
  },
}))

vi.mock('@/lib/prisma', () => ({ prisma: mockPrisma }))

// Prevent loading next-auth (node:-blocked) by stubbing the auth module.
const mockAuth = vi.hoisted(() => vi.fn())
vi.mock('@/lib/auth', () => ({ auth: mockAuth }))

const mockCache = vi.hoisted(() => ({
  get: vi.fn(),
  set: vi.fn(),
}))
vi.mock('@/lib/cache', () => ({ cache: mockCache }))

import {
  getUserRole,
  hasPermission,
  getUserPermissions,
  canAccessResource,
  filterByPermission,
  requirePermission,
  checkPermission,
} from '../permissions'

describe('getUserRole', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns the lowercased role when membership exists', async () => {
    mockPrisma.userOrganization.findUnique.mockResolvedValue({ role: 'OWNER' })

    const role = await getUserRole('user-1', 'org-1')

    expect(role).toBe('owner')
    expect(mockPrisma.userOrganization.findUnique).toHaveBeenCalledWith({
      where: { userId_organizationId: { userId: 'user-1', organizationId: 'org-1' } },
      select: { role: true },
    })
  })

  it('returns null when there is no membership', async () => {
    mockPrisma.userOrganization.findUnique.mockResolvedValue(null)

    const role = await getUserRole('user-1', 'org-1')

    expect(role).toBeNull()
  })
})

describe('getUserPermissions', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns the full permission list for a role', async () => {
    mockPrisma.userOrganization.findUnique.mockResolvedValue({ role: 'ADMIN' })

    const perms = await getUserPermissions('user-1', 'org-1')

    expect(Array.isArray(perms)).toBe(true)
    expect(perms).toContain('document:read')
    expect(perms).toContain('team:invite')
    // admin lacks owner-only billing:manage? admin has billing:read but not billing:manage
    expect(perms).not.toContain('billing:manage')
  })

  it('returns an empty array when the user has no role', async () => {
    mockPrisma.userOrganization.findUnique.mockResolvedValue(null)

    expect(await getUserPermissions('user-1', 'org-1')).toEqual([])
  })
})

describe('hasPermission', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns true when the role grants the permission (cache miss)', async () => {
    mockPrisma.userOrganization.findUnique.mockResolvedValue({ role: 'MEMBER' })
    mockCache.get.mockResolvedValue(null)

    const result = await hasPermission('user-1', 'org-1', 'document:read')

    expect(result).toBe(true)
    expect(mockCache.set).toHaveBeenCalledWith('perm:user-1:org-1:document:read', true, {
      ttl: 5 * 60,
    })
  })

  it('returns false when the role lacks the permission', async () => {
    mockPrisma.userOrganization.findUnique.mockResolvedValue({ role: 'VIEWER' })
    mockCache.get.mockResolvedValue(null)

    expect(await hasPermission('user-1', 'org-1', 'document:create')).toBe(false)
  })

  it('returns the cached value and does not re-cache on a cache hit', async () => {
    mockPrisma.userOrganization.findUnique.mockResolvedValue({ role: 'MEMBER' })
    mockCache.get.mockResolvedValue(true)

    const result = await hasPermission('user-1', 'org-1', 'document:read')

    expect(result).toBe(true)
    expect(mockCache.get).toHaveBeenCalledWith('perm:user-1:org-1:document:read')
    // Cache hit short-circuits before writing back to the cache.
    expect(mockCache.set).not.toHaveBeenCalled()
  })

  it('returns false when the user has no role (no membership)', async () => {
    mockPrisma.userOrganization.findUnique.mockResolvedValue(null)
    mockCache.get.mockResolvedValue(null)

    expect(await hasPermission('user-1', 'org-1', 'document:read')).toBe(false)
  })
})

describe('canAccessResource', () => {
  beforeEach(() => vi.clearAllMocks())

  it('allows owner/admin for any resource regardless of ownership', async () => {
    mockPrisma.userOrganization.findUnique.mockResolvedValue({ role: 'OWNER' })

    expect(await canAccessResource('user-1', 'org-1', 'document', 'doc-x', 'delete')).toBe(true)
  })

  it('allows a member when the document belongs to the org', async () => {
    mockPrisma.userOrganization.findUnique.mockResolvedValue({ role: 'MEMBER' })
    mockPrisma.document.findFirst.mockResolvedValue({ userId: 'user-1' })

    expect(await canAccessResource('user-1', 'org-1', 'document', 'doc-x', 'read')).toBe(true)
  })

  it('denies a member when the document does not belong to the org', async () => {
    mockPrisma.userOrganization.findUnique.mockResolvedValue({ role: 'MEMBER' })
    mockPrisma.document.findFirst.mockResolvedValue(null)

    expect(await canAccessResource('user-1', 'org-1', 'document', 'doc-x', 'read')).toBe(false)
  })

  it('checks the permission matrix for sync resources', async () => {
    mockPrisma.userOrganization.findUnique.mockResolvedValue({ role: 'MEMBER' })

    expect(await canAccessResource('user-1', 'org-1', 'sync', 'sync-x', 'read')).toBe(true)
    expect(await canAccessResource('user-1', 'org-1', 'sync', 'sync-x', 'delete')).toBe(false)
  })
})

describe('filterByPermission', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns all items when the user has the permission', async () => {
    mockPrisma.userOrganization.findUnique.mockResolvedValue({ role: 'MEMBER' })
    mockCache.get.mockResolvedValue(null)

    const items = [
      { id: '1', organizationId: 'org-1', userId: 'user-1' },
      { id: '2', organizationId: 'org-1', userId: 'user-2' },
    ]
    const result = await filterByPermission('user-1', 'org-1', items, 'document:read')

    expect(result).toHaveLength(2)
  })

  it('filters to the user own items when lacking permission', async () => {
    mockPrisma.userOrganization.findUnique.mockResolvedValue({ role: 'VIEWER' })
    mockCache.get.mockResolvedValue(null)

    const items = [
      { id: '1', organizationId: 'org-1', userId: 'user-1' },
      { id: '2', organizationId: 'org-1', userId: 'user-2' },
    ]
    const result = await filterByPermission('user-1', 'org-1', items, 'document:update')

    expect(result).toEqual([{ id: '1', organizationId: 'org-1', userId: 'user-1' }])
  })
})

describe('requirePermission / checkPermission', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns authorized with userId when session exists and permission granted', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'user-1' } })
    mockPrisma.userOrganization.findUnique.mockResolvedValue({ role: 'MEMBER' })
    mockCache.get.mockResolvedValue(null)

    const result = await requirePermission('document:read', 'org-1')

    expect(result).toEqual({ authorized: true, userId: 'user-1' })
  })

  it('returns unauthorized when there is no session', async () => {
    mockAuth.mockResolvedValue(null)

    const result = await requirePermission('document:read', 'org-1')

    expect(result).toEqual({ authorized: false, error: 'Non autorisé' })
  })

  it('returns unauthorized with the required permission in the error', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'user-1' } })
    mockPrisma.userOrganization.findUnique.mockResolvedValue({ role: 'VIEWER' })
    mockCache.get.mockResolvedValue(null)

    const result = await requirePermission('document:create', 'org-1')

    expect(result.authorized).toBe(false)
    expect(result.error).toContain('document:create')
  })

  it('checkPermission throws when not authorized', async () => {
    mockAuth.mockResolvedValue(null)

    await expect(checkPermission('org-1', 'document:read')).rejects.toThrow('Non autorisé')
  })

  it('checkPermission resolves with userId when authorized', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'user-7' } })
    mockPrisma.userOrganization.findUnique.mockResolvedValue({ role: 'ADMIN' })
    mockCache.get.mockResolvedValue(null)

    await expect(checkPermission('org-1', 'document:read')).resolves.toBe('user-7')
  })
})
