/**
 * Auth test helpers — pure utilities, no vi.mock() calls.
 *
 * Mock @/lib/auth in your test file at the top level instead:
 *
 *   const mockAuth = vi.fn()
 *   vi.mock('@/lib/auth', () => ({ auth: mockAuth }))
 *
 *   // then in each test:
 *   mockAuth.mockResolvedValue(mockSession({ ... }))
 */

export interface MockSession {
  user: {
    id: string
    email: string
    role: 'USER' | 'ADMIN'
    name?: string | null
    has2FA?: boolean
    twoFactorVerified?: boolean
  }
  expires: string
}

export function mockSession(overrides?: Partial<MockSession>): MockSession {
  return {
    user: {
      id: 'test-user-1',
      email: 'test@omnysync.com',
      role: 'USER',
      name: 'Test User',
      has2FA: false,
      twoFactorVerified: false,
      ...overrides?.user,
    },
    expires: new Date(Date.now() + 86400000).toISOString(),
  }
}

export function mockAdminSession(): MockSession {
  return mockSession({
    user: { id: 'admin-1', email: 'admin@omnysync.com', role: 'ADMIN' },
  })
}
