import { describe, it, expect, vi, beforeEach } from 'vitest'

const mocks = vi.hoisted(() => {
  const fakeService = {
    assertFeature: vi.fn(),
    hasFeature: vi.fn(),
    canConsume: vi.fn(),
    consume: vi.fn(),
    getLimit: vi.fn(),
    getAllEntitlements: vi.fn(),
  }
  const getFeatureGateService = vi.fn(() => fakeService)
  const auth = vi.fn()
  const getUserOrgId = vi.fn()
  const handleFeatureGateError = vi.fn((error: any) => ({
    statusCode: error?.statusCode ?? 500,
    body: error?.toJSON ? error.toJSON() : { error: 'UNKNOWN' },
  }))
  class FeatureGateError extends Error {
    public code: string
    public statusCode: number
    public context: unknown
    constructor(code: string, message: string, context: unknown = {}, statusCode = 403) {
      super(message)
      this.code = code
      this.statusCode = statusCode
      this.context = context
    }
    toJSON() {
      return { error: this.code, message: this.message }
    }
  }
  return {
    fakeService,
    getFeatureGateService,
    auth,
    getUserOrgId,
    handleFeatureGateError,
    FeatureGateError,
  }
})

vi.mock('@/lib/entitlements/FeatureGateService', () => ({
  getFeatureGateService: mocks.getFeatureGateService,
}))
vi.mock('@/lib/entitlements/errors', () => ({
  handleFeatureGateError: mocks.handleFeatureGateError,
  FeatureGateError: mocks.FeatureGateError,
}))
vi.mock('@/lib/auth', () => ({ auth: mocks.auth }))
vi.mock('@/lib/auth/org', () => ({ getUserOrgId: mocks.getUserOrgId }))

import {
  createOrgIdResolver,
  requireFeature,
  requireLimit,
  consumeFeature,
  withFeature,
  withLimit,
  withConsume,
  toExpress,
} from '../middleware-factories'

const okHandler = () => Promise.resolve(new Response('OK', { status: 200 }))
const makeRequest = () => new Request('http://localhost')

describe('createOrgIdResolver', () => {
  beforeEach(() => vi.clearAllMocks())

  it('resolves the orgId from the authenticated session', async () => {
    mocks.auth.mockResolvedValue({ user: { id: 'user-1' } })
    mocks.getUserOrgId.mockResolvedValue('org-1')

    const resolve = createOrgIdResolver()
    const orgId = await resolve(makeRequest())

    expect(orgId).toBe('org-1')
    expect(mocks.auth).toHaveBeenCalled()
    expect(mocks.getUserOrgId).toHaveBeenCalledWith('user-1')
  })

  it('returns null when there is no session', async () => {
    mocks.auth.mockResolvedValue(null)

    const resolve = createOrgIdResolver()
    const orgId = await resolve(makeRequest())

    expect(orgId).toBeNull()
    expect(mocks.getUserOrgId).not.toHaveBeenCalled()
  })

  it('returns null when the session lookup throws', async () => {
    mocks.auth.mockRejectedValue(new Error('boom'))

    const resolve = createOrgIdResolver()
    const orgId = await resolve(makeRequest())

    expect(orgId).toBeNull()
  })
})

describe('requireFeature', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when the org cannot be resolved', async () => {
    mocks.auth.mockResolvedValue(null)

    const mw = requireFeature('EXPORT_PDF')
    const res = await mw(makeRequest(), okHandler)

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe('INVALID_ORG')
    expect(mocks.fakeService.assertFeature).not.toHaveBeenCalled()
  })

  it('proceeds to the handler when the feature is enabled', async () => {
    mocks.auth.mockResolvedValue({ user: { id: 'user-1' } })
    mocks.getUserOrgId.mockResolvedValue('org-1')
    mocks.fakeService.assertFeature.mockResolvedValue(undefined)

    const mw = requireFeature('EXPORT_PDF')
    const res = await mw(makeRequest(), okHandler)

    expect(res.status).toBe(200)
    expect(mocks.fakeService.assertFeature).toHaveBeenCalledWith('org-1', 'EXPORT_PDF')
  })

  it('returns 403 when the feature gate throws', async () => {
    mocks.auth.mockResolvedValue({ user: { id: 'user-1' } })
    mocks.getUserOrgId.mockResolvedValue('org-1')
    const err = new mocks.FeatureGateError('FEATURE_NOT_AVAILABLE', 'nope', {}, 403)
    mocks.fakeService.assertFeature.mockRejectedValue(err)

    const mw = requireFeature('EXPORT_PDF')
    const res = await mw(makeRequest(), okHandler)

    expect(res.status).toBe(403)
  })
})

describe('requireLimit', () => {
  beforeEach(() => vi.clearAllMocks())

  it('proceeds when the feature is enabled and within limit', async () => {
    mocks.auth.mockResolvedValue({ user: { id: 'user-1' } })
    mocks.getUserOrgId.mockResolvedValue('org-1')
    mocks.fakeService.hasFeature.mockResolvedValue(true)
    mocks.fakeService.canConsume.mockResolvedValue(true)

    const mw = requireLimit('EXPORT_PDF')
    const res = await mw(makeRequest(), okHandler)

    expect(res.status).toBe(200)
    expect(mocks.fakeService.canConsume).toHaveBeenCalledWith('org-1', 'EXPORT_PDF')
  })

  it('returns 403 when the feature is not available on the plan', async () => {
    mocks.auth.mockResolvedValue({ user: { id: 'user-1' } })
    mocks.getUserOrgId.mockResolvedValue('org-1')
    mocks.fakeService.hasFeature.mockResolvedValue(false)
    mocks.fakeService.getAllEntitlements.mockResolvedValue({ planKey: 'free' })

    const mw = requireLimit('EXPORT_PDF')
    const res = await mw(makeRequest(), okHandler)

    expect(res.status).toBe(403)
  })

  it('returns 402 when the limit is reached', async () => {
    mocks.auth.mockResolvedValue({ user: { id: 'user-1' } })
    mocks.getUserOrgId.mockResolvedValue('org-1')
    mocks.fakeService.hasFeature.mockResolvedValue(true)
    mocks.fakeService.canConsume.mockResolvedValue(false)
    mocks.fakeService.getLimit.mockResolvedValue(5)
    mocks.fakeService.getAllEntitlements.mockResolvedValue({ limits: { EXPORT_PDF: 5 } })

    const mw = requireLimit('EXPORT_PDF')
    const res = await mw(makeRequest(), okHandler)

    expect(res.status).toBe(402)
  })
})

describe('consumeFeature', () => {
  beforeEach(() => vi.clearAllMocks())

  it('consumes quota and forwards consumption headers to the response', async () => {
    mocks.auth.mockResolvedValue({ user: { id: 'user-1' } })
    mocks.getUserOrgId.mockResolvedValue('org-1')
    mocks.fakeService.consume.mockResolvedValue({ remaining: 8 })

    const mw = consumeFeature('EXPORT_PDF', 2)
    const res = await mw(makeRequest(), okHandler)

    expect(res.status).toBe(200)
    expect(mocks.fakeService.consume).toHaveBeenCalledWith('org-1', 'EXPORT_PDF', 2)
    expect(res.headers.get('X-Consumed-Units')).toBe('2')
    expect(res.headers.get('X-Remaining-Units')).toBe('8')
  })
})

describe('withFeature / withLimit / withConsume decorators', () => {
  beforeEach(() => vi.clearAllMocks())

  it('withFeature invokes the handler when the feature is enabled', async () => {
    mocks.auth.mockResolvedValue({ user: { id: 'user-1' } })
    mocks.getUserOrgId.mockResolvedValue('org-1')
    mocks.fakeService.assertFeature.mockResolvedValue(undefined)

    const decorated = withFeature('EXPORT_PDF')(() =>
      Promise.resolve(new Response('handled', { status: 200 }))
    )
    const res = await decorated(makeRequest())

    expect(res.status).toBe(200)
  })

  it('withFeature returns 401 when no org is resolved', async () => {
    mocks.auth.mockResolvedValue(null)

    const decorated = withFeature('EXPORT_PDF')(() =>
      Promise.resolve(new Response('handled', { status: 200 }))
    )
    const res = await decorated(makeRequest())

    expect(res.status).toBe(401)
  })

  it('withConsume consumes quota before invoking the handler', async () => {
    mocks.auth.mockResolvedValue({ user: { id: 'user-1' } })
    mocks.getUserOrgId.mockResolvedValue('org-1')
    mocks.fakeService.consume.mockResolvedValue({ remaining: 3 })

    const decorated = withConsume(
      'EXPORT_PDF',
      1
    )(() => Promise.resolve(new Response('ok', { status: 200 })))
    const res = await decorated(makeRequest())

    expect(res.status).toBe(200)
    expect(mocks.fakeService.consume).toHaveBeenCalledWith('org-1', 'EXPORT_PDF', 1)
  })

  it('withLimit allows the handler when within limit', async () => {
    mocks.auth.mockResolvedValue({ user: { id: 'user-1' } })
    mocks.getUserOrgId.mockResolvedValue('org-1')
    mocks.fakeService.canConsume.mockResolvedValue(true)

    const decorated = withLimit('EXPORT_PDF')(() =>
      Promise.resolve(new Response('ok', { status: 200 }))
    )
    const res = await decorated(makeRequest())

    expect(res.status).toBe(200)
  })

  it('withLimit returns 402 when the limit is reached', async () => {
    mocks.auth.mockResolvedValue({ user: { id: 'user-1' } })
    mocks.getUserOrgId.mockResolvedValue('org-1')
    mocks.fakeService.canConsume.mockResolvedValue(false)
    mocks.fakeService.getLimit.mockResolvedValue(10)
    mocks.fakeService.getAllEntitlements.mockResolvedValue({ limits: { EXPORT_PDF: 10 } })

    const decorated = withLimit('EXPORT_PDF')(() =>
      Promise.resolve(new Response('ok', { status: 200 }))
    )
    const res = await decorated(makeRequest())

    expect(res.status).toBe(402)
  })
})

describe('toExpress', () => {
  beforeEach(() => vi.clearAllMocks())

  it('calls next() when the middleware resolves successfully', async () => {
    mocks.auth.mockResolvedValue({ user: { id: 'user-1' } })
    mocks.getUserOrgId.mockResolvedValue('org-1')
    mocks.fakeService.assertFeature.mockResolvedValue(undefined)

    const next = vi.fn()
    const res = { status: vi.fn(() => ({ json: vi.fn() })) }
    const expressMiddleware = toExpress(requireFeature('EXPORT_PDF'))
    const inner = expressMiddleware()

    inner({ headers: {} }, res, next)

    await vi.waitFor(() => expect(next).toHaveBeenCalled())
    expect(res.status).not.toHaveBeenCalled()
  })

  it('responds with an error status when the feature is denied', async () => {
    mocks.auth.mockResolvedValue({ user: { id: 'user-1' } })
    mocks.getUserOrgId.mockResolvedValue('org-1')
    const err = new mocks.FeatureGateError('FEATURE_NOT_AVAILABLE', 'nope', {}, 403)
    mocks.fakeService.assertFeature.mockRejectedValue(err)

    const next = vi.fn()
    const statusJson = vi.fn()
    const res = { status: vi.fn(() => ({ json: statusJson })) }
    const expressMiddleware = toExpress(requireFeature('EXPORT_PDF'))
    const inner = expressMiddleware()

    inner({ headers: {} }, res, next)

    await vi.waitFor(() => expect(res.status).toHaveBeenCalledWith(403))
    expect(next).not.toHaveBeenCalled()
  })
})
