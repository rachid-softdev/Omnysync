import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockPrisma = vi.hoisted(() => ({
  userOrganization: {
    findFirst: vi.fn(),
  },
  organization: {
    create: vi.fn(),
  },
}))

vi.mock('@/lib/prisma', () => ({ prisma: mockPrisma }))

import { getUserOrgId, ensureUserOrg } from '../org'

describe('getUserOrgId', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns organizationId when membership exists', async () => {
    mockPrisma.userOrganization.findFirst.mockResolvedValue({ organizationId: 'org-123' })

    const result = await getUserOrgId('user-1')

    expect(result).toBe('org-123')
    expect(mockPrisma.userOrganization.findFirst).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
    })
  })

  it('throws when no membership exists', async () => {
    mockPrisma.userOrganization.findFirst.mockResolvedValue(null)

    await expect(getUserOrgId('user-1')).rejects.toThrow('User has no organization membership')
  })
})

describe('ensureUserOrg', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns existing organizationId when membership found', async () => {
    mockPrisma.userOrganization.findFirst.mockResolvedValue({ organizationId: 'org-456' })

    const result = await ensureUserOrg('user-2')

    expect(result).toBe('org-456')
    expect(mockPrisma.organization.create).not.toHaveBeenCalled()
  })

  it('creates a Personal organization when no membership exists', async () => {
    mockPrisma.userOrganization.findFirst.mockResolvedValue(null)
    mockPrisma.organization.create.mockResolvedValue({ id: 'org-new' })

    const result = await ensureUserOrg('user-3')

    expect(result).toBe('org-new')
    expect(mockPrisma.organization.create).toHaveBeenCalledWith({
      data: {
        name: 'Personal',
        users: {
          create: {
            userId: 'user-3',
            role: 'OWNER',
          },
        },
      },
    })
  })
})
