import { describe, it, expect, vi } from 'vitest'

// ── Mocks (vi.hoisted ensures they are initialized before hoisted vi.mock) ───

const mockSignOut = vi.hoisted(() => vi.fn().mockResolvedValue(undefined))

vi.mock('@/lib/auth', () => ({
  signOut: mockSignOut,
}))

// Next.js redirect throws a special error — we simulate that
const mockRedirect = vi.hoisted(() => vi.fn())
vi.mock('next/navigation', () => ({
  redirect: mockRedirect,
}))

// ── Imports ──────────────────────────────────────────────────────────────────

import { logoutAction } from '../actions'

// ── Suite ────────────────────────────────────────────────────────────────────

describe('logoutAction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Simulate Next.js redirect behavior: redirect() throws
    mockRedirect.mockImplementation(() => {
      throw new Error('NEXT_REDIRECT')
    })
  })

  it('calls signOut with correct redirect options', async () => {
    try {
      await logoutAction()
    } catch {
      // redirect throws, expected
    }

    expect(mockSignOut).toHaveBeenCalledTimes(1)
    expect(mockSignOut).toHaveBeenCalledWith({ redirectTo: '/' })
  })

  it('throws a redirect error after signOut', async () => {
    await expect(logoutAction()).rejects.toThrow('NEXT_REDIRECT')
  })

  it('calls signOut before redirect', async () => {
    const callOrder: string[] = []
    mockSignOut.mockImplementation(async () => {
      callOrder.push('signOut')
    })
    mockRedirect.mockImplementation(() => {
      callOrder.push('redirect')
      throw new Error('NEXT_REDIRECT')
    })

    try {
      await logoutAction()
    } catch {
      // expected
    }

    // signOut is awaited before redirect is called
    expect(callOrder).toEqual(['signOut', 'redirect'])
  })

  it('does not call redirect if signOut throws', async () => {
    const signOutError = new Error('Sign out failed')
    mockSignOut.mockRejectedValue(signOutError)

    await expect(logoutAction()).rejects.toThrow('Sign out failed')
    expect(mockRedirect).not.toHaveBeenCalled()
  })
})
