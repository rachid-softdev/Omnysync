// Mock global pour @omnysync/core/prisma dans les tests web
// Les tests d'intégration avec TEST_DATABASE_URL peuvent overrider ce mock
import { vi } from 'vitest'

// The mock factory dynamically decides: when TEST_DATABASE_URL is set, use the real
// Prisma client so integration tests can connect to a real database. When not set,
// provide a proxy mock that returns null so unit tests don't need a database.
//
// NOTE: vi.mock factories are evaluated lazily, not hoisted, so env vars are
// available at factory invocation time.
vi.mock('@omnysync/core/prisma', async () => {
  if (process.env.TEST_DATABASE_URL) {
    // Integration mode — return the real module so route handlers connect to
    // the test database via DATABASE_URL (must be set alongside TEST_DATABASE_URL).
    return await vi.importActual<typeof import('@omnysync/core/prisma')>('@omnysync/core/prisma')
  }

  // Unit test mode — proxy mock that returns null for all prisma calls
  return {
    prisma: new Proxy({} as Record<string, unknown>, {
      get(_target, _prop) {
        return vi.fn().mockResolvedValue(null)
      },
    }),
    getPrisma: vi.fn(() => {
      throw new Error(
        'DATABASE_URL not set and @omnysync/core/prisma not mocked. ' +
          'Set TEST_DATABASE_URL for integration tests or mock @omnysync/core/prisma in unit tests.'
      )
    }),
    encryptData: vi.fn(),
    decryptResult: vi.fn(),
  }
})
