import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mockSession } from '../helpers/auth-helper'

// Use local mock variables to avoid type issues with vi.mocked()
const mockAuthFn = vi.fn()
const mockFindMany = vi.fn()
const mockFindFirst = vi.fn()

vi.mock('@/lib/auth', () => ({
  auth: mockAuthFn,
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    connector: {
      findMany: mockFindMany,
    },
    userOrganization: {
      findFirst: mockFindFirst,
    },
  },
}))

describe('GET /api/connectors', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return 401 when unauthenticated', async () => {
    mockAuthFn.mockResolvedValue(null)

    const { GET } = await import('@/app/api/connectors/route')
    const response = await GET()
    const data = await response.json()

    expect(response.status).toBe(401)
    expect(data.error).toBe('Unauthorized')
  })

  it('should return connectors for authenticated user', async () => {
    mockAuthFn.mockResolvedValue(mockSession())
    mockFindMany.mockResolvedValue([
      { id: '1', type: 'NOTION', name: 'My Notion', enabled: true },
      { id: '2', type: 'GOOGLE_DOCS', name: 'Google Docs', enabled: false },
    ])
    mockFindFirst.mockResolvedValue({ organizationId: 'org-1' })

    const { GET } = await import('@/app/api/connectors/route')
    const response = await GET()
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(Array.isArray(data)).toBe(true)
    expect(data).toHaveLength(2)
  })
})
