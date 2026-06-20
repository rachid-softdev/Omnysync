/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the auth module
vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}))

import { auth } from '@/lib/auth'
import { requireAdmin, AuthError } from '../require-admin'

describe('requireAdmin', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('throws AuthError(401) when there is no session', async () => {
    vi.mocked(auth).mockResolvedValue(null)

    await expect(requireAdmin()).rejects.toThrow(AuthError)
    await expect(requireAdmin()).rejects.toThrow('Non authentifié')
    await expect(requireAdmin()).rejects.toMatchObject({ status: 401 })
  })

  it('throws AuthError(401) when session exists but user is null', async () => {
    vi.mocked(auth).mockResolvedValue({} as any)

    await expect(requireAdmin()).rejects.toThrow('Non authentifié')
    await expect(requireAdmin()).rejects.toMatchObject({ status: 401 })
  })

  it('throws AuthError(401) when session user has no id', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { email: 'test@test.com', role: 'ADMIN' },
      expires: '2099-01-01',
    } as any)

    await expect(requireAdmin()).rejects.toThrow('Non authentifié')
    await expect(requireAdmin()).rejects.toMatchObject({ status: 401 })
  })

  it('throws AuthError(401) when session user id is explicitly null', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: null, email: 'test@test.com', role: 'ADMIN' },
      expires: '2099-01-01',
    } as any)

    await expect(requireAdmin()).rejects.toThrow('Non authentifié')
    await expect(requireAdmin()).rejects.toMatchObject({ status: 401 })
  })

  it('throws AuthError(403) when session user role is not ADMIN', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'user-1', email: 'user@test.com', role: 'USER' },
      expires: '2099-01-01',
    })

    await expect(requireAdmin()).rejects.toThrow('Accès non autorisé')
    await expect(requireAdmin()).rejects.toMatchObject({ status: 403 })
  })

  it('throws AuthError(403) when session user role is EDITOR', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'editor-1', email: 'editor@test.com', role: 'EDITOR' },
      expires: '2099-01-01',
    })

    await expect(requireAdmin()).rejects.toThrow('Accès non autorisé')
    await expect(requireAdmin()).rejects.toMatchObject({ status: 403 })
  })

  it('throws AuthError(403) when session user role is undefined', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'user-1', email: 'user@test.com', role: undefined },
      expires: '2099-01-01',
    } as any)

    await expect(requireAdmin()).rejects.toThrow('Accès non autorisé')
    await expect(requireAdmin()).rejects.toMatchObject({ status: 403 })
  })

  it('returns user info when session user role is ADMIN', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'admin-1', email: 'admin@test.com', role: 'ADMIN' },
      expires: '2099-01-01',
    })

    const result = await requireAdmin()
    expect(result).toEqual({ id: 'admin-1', email: 'admin@test.com' })
  })

  it('returns empty string email when admin user has no email', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'admin-1', email: null, role: 'ADMIN' },
      expires: '2099-01-01',
    } as any)

    const result = await requireAdmin()
    expect(result).toEqual({ id: 'admin-1', email: '' })
  })

  it('returns empty string email when admin user has undefined email', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'admin-1', role: 'ADMIN' },
      expires: '2099-01-01',
    } as any)

    const result = await requireAdmin()
    expect(result).toEqual({ id: 'admin-1', email: '' })
  })
})

describe('AuthError', () => {
  it('extends Error with status property', () => {
    const error = new AuthError('Test error', 418)
    expect(error).toBeInstanceOf(Error)
    expect(error.message).toBe('Test error')
    expect(error.status).toBe(418)
    expect(error.name).toBe('Error') // AuthError doesn't override name
  })

  it('preserves different status codes', () => {
    const error401 = new AuthError('Unauthorized', 401)
    const error403 = new AuthError('Forbidden', 403)

    expect(error401.status).toBe(401)
    expect(error403.status).toBe(403)
  })
})
