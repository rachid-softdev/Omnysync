/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Tests for the Connector [id] API route
 * Covers DELETE /api/connectors/[id]
 *
 * Pattern: mock auth + prisma + org + apiError at module level.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    connector: {
      findFirst: vi.fn(),
      delete: vi.fn(),
    },
  },
}))

vi.mock('@/lib/auth/org', () => ({
  getUserOrgId: vi.fn(),
}))

vi.mock('@/lib/api-error', () => ({
  apiError: vi.fn((message: string, status: number, code?: string) => ({
    status,
    json: () =>
      Promise.resolve({
        error: message,
        ...(code ? { code } : {}),
      }),
  })),
}))

vi.mock('@prisma/client', () => ({
  Prisma: {
    PrismaClientKnownRequestError: class extends Error {
      code: string
      constructor(message: string, meta: { code: string }) {
        super(message)
        this.code = meta.code
      }
    },
  },
}))

// ── Imports ──────────────────────────────────────────────────────────────────

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getUserOrgId } from '@/lib/auth/org'
import { apiError } from '@/lib/api-error'
import { Prisma } from '@prisma/client'

// ============================================================================
// DELETE /api/connectors/[id]
// ============================================================================

describe('DELETE /api/connectors/[id]', () => {
  const makeRequest = () =>
    new NextRequest('http://localhost:3000/api/connectors/conn-to-delete', {
      method: 'DELETE',
    })

  beforeEach(() => {
    vi.clearAllMocks()

    // Default: authenticated user
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'user-1', email: 'test@omnysync.com' },
    } as any)

    vi.mocked(getUserOrgId).mockResolvedValue('org-1')

    // Default: connector exists and belongs to org
    vi.mocked(prisma.connector.findFirst).mockResolvedValue({
      id: 'conn-to-delete',
      organizationId: 'org-1',
      type: 'WORDPRESS',
      name: 'My WordPress',
    } as any)

    vi.mocked(prisma.connector.delete).mockResolvedValue({
      id: 'conn-to-delete',
    } as any)
  })

  // ── Unauthenticated ─────────────────────────────────────────────────────

  it('should return 401 when unauthenticated', async () => {
    vi.mocked(auth).mockResolvedValue(null)

    const { DELETE } = await import('@/app/api/connectors/[id]/route')
    const response = await DELETE(makeRequest(), {
      params: Promise.resolve({ id: 'conn-to-delete' }),
    })

    expect(response.status).toBe(401)
  })

  // ── Connector not found ─────────────────────────────────────────────────

  it('should return 404 when connector does not exist', async () => {
    vi.mocked(prisma.connector.findFirst).mockResolvedValue(null)

    const { DELETE } = await import('@/app/api/connectors/[id]/route')
    const response = await DELETE(makeRequest(), {
      params: Promise.resolve({ id: 'nonexistent-connector' }),
    })

    expect(response.status).toBe(404)
    expect(apiError).toHaveBeenCalledWith('Connector not found', 404)
  })

  // ── Connector belongs to another org ────────────────────────────────────

  it('should return 404 when connector belongs to another organization', async () => {
    // findFirst returns null because org doesn't match
    vi.mocked(prisma.connector.findFirst).mockResolvedValue(null)

    const { DELETE } = await import('@/app/api/connectors/[id]/route')
    const response = await DELETE(makeRequest(), {
      params: Promise.resolve({ id: 'conn-other-org' }),
    })

    expect(response.status).toBe(404)
  })

  // ── Deletes connector successfully ──────────────────────────────────────

  it('should delete the connector and return success', async () => {
    const { DELETE } = await import('@/app/api/connectors/[id]/route')
    const response = await DELETE(makeRequest(), {
      params: Promise.resolve({ id: 'conn-to-delete' }),
    })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)

    // Verify the connector belongs to the org before deleting
    expect(prisma.connector.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 'conn-to-delete',
          organizationId: 'org-1',
        },
      })
    )

    // Verify delete was called with the right id
    expect(prisma.connector.delete).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'conn-to-delete' },
      })
    )
  })

  // ── Cannot delete connector with linked documents (P2003) ───────────────

  it('should return 400 when connector has linked documents (P2003)', async () => {
    const p2003Error = new (vi.mocked(Prisma).PrismaClientKnownRequestError)(
      'Foreign key constraint failed',
      { code: 'P2003' }
    )
    vi.mocked(prisma.connector.delete).mockRejectedValue(p2003Error)

    const { DELETE } = await import('@/app/api/connectors/[id]/route')
    const response = await DELETE(makeRequest(), {
      params: Promise.resolve({ id: 'conn-to-delete' }),
    })

    expect(response.status).toBe(400)
    expect(apiError).toHaveBeenCalledWith(expect.stringContaining('linked documents'), 400)
  })

  // ── Server error (unexpected prisma error) ──────────────────────────────

  it('should throw when prisma.delete fails with a non-P2003 error', async () => {
    const dbError = new Error('Connection lost')
    vi.mocked(prisma.connector.delete).mockRejectedValue(dbError)

    const { DELETE } = await import('@/app/api/connectors/[id]/route')

    // The route re-throws non-P2003 errors, so the promise should reject
    await expect(
      DELETE(makeRequest(), {
        params: Promise.resolve({ id: 'conn-to-delete' }),
      })
    ).rejects.toThrow('Connection lost')
  })
})
