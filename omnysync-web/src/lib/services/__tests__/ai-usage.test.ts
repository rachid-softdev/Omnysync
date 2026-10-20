import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockPrisma = vi.hoisted(() => ({
  connector: { create: vi.fn().mockResolvedValue({ id: 'c-1' }) },
}))

vi.mock('@omnysync/core/prisma', () => ({
  prisma: mockPrisma,
  getPrisma: vi.fn(),
  encryptData: vi.fn(),
  decryptResult: vi.fn(),
}))

import { logAIUsage, getAIUsageStats } from '@/lib/services/ai-usage'

describe('logAIUsage', () => {
  beforeEach(() => vi.clearAllMocks())

  it('logs usage and never throws on the happy path', async () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {})

    await expect(
      logAIUsage({
        userId: 'u-1',
        model: 'gpt-4o',
        feature: 'blog',
        tokens: 123,
        costEstimate: 0.01,
      })
    ).resolves.toBeUndefined()

    expect(spy).toHaveBeenCalled()
    spy.mockRestore()
  })

  it('swallows errors without rejecting the caller', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    // Force the inner try/catch path to throw by passing a value that breaks
    // console.log (JSON.stringify of a circular ref still works, so instead we
    // simulate the catch by spying on the logger to throw).
    const logSpy = vi.spyOn(console, 'log').mockImplementationOnce(() => {
      throw new Error('log transport down')
    })
    errSpy.mockImplementation(() => {})

    await expect(
      logAIUsage({
        userId: null,
        model: 'm',
        feature: 'f',
        tokens: 1,
        costEstimate: 0,
      })
    ).resolves.toBeUndefined()

    expect(errSpy).toHaveBeenCalled()
    logSpy.mockRestore()
    errSpy.mockRestore()
  })
})

describe('getAIUsageStats', () => {
  it('returns zeroed stats (placeholder implementation)', async () => {
    const stats = await getAIUsageStats('u-1', new Date('2024-01-01'), new Date('2024-02-01'))

    expect(stats).toEqual({
      totalTokens: 0,
      totalCost: 0,
      requestCount: 0,
      period: { start: expect.any(Date), end: expect.any(Date) },
    })
  })
})
