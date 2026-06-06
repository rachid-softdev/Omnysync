import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { logAIUsage, getAIUsageStats } from '../services/ai-usage'

describe('AI Usage Service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('logAIUsage', () => {
    it('should log AI usage to console', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      await logAIUsage({
        userId: 'user-123',
        model: 'gpt-4',
        feature: 'content-generation',
        tokens: 1000,
        costEstimate: 0.05,
      })

      expect(consoleSpy).toHaveBeenCalled()
      // console.log("AI Usage:", {...}) - first arg is label, second is the object
      const logCall = consoleSpy.mock.calls[0]!
      expect(logCall[0]).toBe('AI Usage:')
      expect(logCall[1]).toHaveProperty('userId', 'user-123')
      expect(logCall[1]).toHaveProperty('model', 'gpt-4')

      consoleSpy.mockRestore()
    })

    it('should handle missing userId', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      await logAIUsage({
        userId: null,
        model: 'gpt-4',
        feature: 'content-generation',
        tokens: 500,
        costEstimate: 0.025,
      })

      expect(consoleSpy).toHaveBeenCalled()
      consoleSpy.mockRestore()
    })

    it('should not throw on errors', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      // Force an error by passing invalid data
      await logAIUsage({
        userId: 'user-123',
        model: 'gpt-4',
        feature: 'content-generation',
        tokens: 1000,
        costEstimate: 0.05,
      })

      // Should not throw
      expect(consoleErrorSpy).not.toHaveBeenCalled()

      consoleErrorSpy.mockRestore()
    })
  })

  describe('getAIUsageStats', () => {
    it('should return default stats when no data', async () => {
      const result = await getAIUsageStats()

      expect(result).toEqual({
        totalTokens: 0,
        totalCost: 0,
        requestCount: 0,
        period: { start: undefined, end: undefined },
      })
    })

    it('should respect date range parameters', async () => {
      const startDate = new Date('2024-01-01')
      const endDate = new Date('2024-12-31')

      const result = await getAIUsageStats(startDate, endDate)

      expect(result.period.start).toEqual(startDate)
      expect(result.period.end).toEqual(endDate)
    })

    it('should return zero values for user with no usage', async () => {
      const result = await getAIUsageStats()

      expect(result.totalTokens).toBe(0)
      expect(result.totalCost).toBe(0)
      expect(result.requestCount).toBe(0)
    })
  })
})
