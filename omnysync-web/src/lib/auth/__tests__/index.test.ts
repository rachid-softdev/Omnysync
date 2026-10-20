import { describe, it, expect, vi } from 'vitest'

// Stub the next-auth stack so the real (node:-importing) implementation never
// loads. This lets us unit-test the barrel of exports without invoking NextAuth
// internals.
const mockAuthFn = vi.hoisted(() => vi.fn().mockResolvedValue(null))

vi.mock('next-auth', () => ({
  default: vi.fn(() => ({
    handlers: {},
    signIn: vi.fn(),
    signOut: vi.fn(),
    auth: mockAuthFn,
  })),
}))
vi.mock('next-auth/providers/google', () => ({ default: vi.fn() }))
vi.mock('next-auth/providers/credentials', () => ({ default: vi.fn() }))
vi.mock('@auth/prisma-adapter', () => ({ PrismaAdapter: vi.fn(() => ({})) }))
vi.mock('@/lib/prisma', () => ({ prisma: {} }))
vi.mock('@/lib/email', () => ({ sendWelcomeEmail: vi.fn() }))
vi.mock('@/lib/auth/password', () => ({ verifyPassword: vi.fn() }))
vi.mock('@/lib/auth/adapter-encryption', () => ({ withOAuthEncryption: vi.fn((a) => a) }))

import { auth, signIn, signOut, handlers } from '@/lib/auth'

describe('auth index (NextAuth configuration)', () => {
  it('exports the configured auth function from NextAuth', () => {
    expect(typeof auth).toBe('function')
  })

  it('exports signIn, signOut and handlers', () => {
    expect(typeof signIn).toBe('function')
    expect(typeof signOut).toBe('function')
    expect(typeof handlers).toBe('object')
  })

  it('returns a null session when unauthenticated', async () => {
    // The mocked NextAuth auth() resolves to null (no active session).
    const session = await auth()
    expect(session).toBeNull()
  })
})
