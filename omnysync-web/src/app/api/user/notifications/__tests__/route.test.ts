import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const mockAuth = vi.hoisted(() => vi.fn())

vi.mock('@/lib/auth', () => ({ auth: mockAuth }))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    notificationPreference: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
  },
}))

import { prisma } from '@/lib/prisma'
import { GET, PATCH } from '../route'

function makeRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost:3000/api/user/notifications', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('/api/user/notifications', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockResolvedValue({ user: { id: 'user-1' } })
    vi.mocked(prisma.notificationPreference.findUnique).mockResolvedValue(null)
    vi.mocked(prisma.notificationPreference.upsert).mockImplementation(async (args: any) => ({
      syncSuccess: args.create.syncSuccess,
      syncFailed: args.create.syncFailed,
      teamInvites: args.create.teamInvites,
    }))
  })

  it('returns defaults when the user has no preference row', async () => {
    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toEqual({ syncSuccess: true, syncFailed: true, teamInvites: true })
  })

  it('returns the persisted preferences', async () => {
    vi.mocked(prisma.notificationPreference.findUnique).mockResolvedValue({
      syncSuccess: false,
      syncFailed: true,
      teamInvites: false,
    } as never)

    const response = await GET()
    const body = await response.json()

    expect(body).toEqual({ syncSuccess: false, syncFailed: true, teamInvites: false })
  })

  it('returns 401 for unauthenticated requests', async () => {
    mockAuth.mockResolvedValue(null)

    expect((await GET()).status).toBe(401)
    expect((await PATCH(makeRequest({ syncSuccess: false }))).status).toBe(401)
  })

  it('upserts the provided preferences', async () => {
    const response = await PATCH(makeRequest({ syncFailed: false, teamInvites: false }))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toEqual({ syncSuccess: true, syncFailed: false, teamInvites: false })
    expect(prisma.notificationPreference.upsert).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
      create: {
        userId: 'user-1',
        syncSuccess: true,
        syncFailed: false,
        teamInvites: false,
      },
      update: { syncFailed: false, teamInvites: false },
      select: { syncSuccess: true, syncFailed: true, teamInvites: true },
    })
  })

  it('rejects unknown keys instead of silently persisting them', async () => {
    const response = await PATCH(makeRequest({ weeklyDigest: true }))

    expect(response.status).toBe(400)
    expect(prisma.notificationPreference.upsert).not.toHaveBeenCalled()
  })

  it('rejects an empty update', async () => {
    const response = await PATCH(makeRequest({}))

    expect(response.status).toBe(400)
    expect(prisma.notificationPreference.upsert).not.toHaveBeenCalled()
  })

  it('returns 500 when persistence fails', async () => {
    vi.mocked(prisma.notificationPreference.upsert).mockRejectedValue(new Error('DB error'))

    const response = await PATCH(makeRequest({ syncSuccess: false }))

    expect(response.status).toBe(500)
  })
})
