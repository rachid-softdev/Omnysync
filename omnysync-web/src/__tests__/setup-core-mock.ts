// Mock global pour @omnysync/core/prisma dans les tests web
// Les tests d'intégration avec TEST_DATABASE_URL peuvent overrider ce mock
import { vi } from 'vitest'

vi.mock('@omnysync/core/prisma', () => ({
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
}))
