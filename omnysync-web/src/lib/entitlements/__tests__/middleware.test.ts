import { describe, it, expect, vi } from 'vitest'

// The barrel only forwards the factories from middleware-factories, but importing
// it pulls in that module's dependencies, so we stub them to avoid loading
// next-auth (which transitively imports node: builtins).
const fakeService = { assertFeature: vi.fn() }
vi.mock('@/lib/entitlements/FeatureGateService', () => ({
  getFeatureGateService: vi.fn(() => fakeService),
}))
vi.mock('@/lib/entitlements/errors', () => ({
  handleFeatureGateError: vi.fn(() => ({ statusCode: 403, body: {} })),
  FeatureGateError: class extends Error {},
}))
vi.mock('@/lib/auth', () => ({ auth: vi.fn() }))
vi.mock('@/lib/auth/org', () => ({ getUserOrgId: vi.fn() }))

import * as middleware from '../middleware'

describe('entitlements middleware barrel', () => {
  it('re-exports all middleware factory functions', () => {
    const expected = [
      'createOrgIdResolver',
      'requireFeature',
      'requireLimit',
      'consumeFeature',
      'withFeature',
      'withConsume',
      'withLimit',
      'toExpress',
    ]
    for (const name of expected) {
      expect(typeof (middleware as Record<string, unknown>)[name]).toBe('function')
    }
  })
})
