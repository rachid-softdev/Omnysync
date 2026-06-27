import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock prisma avant d'importer scheduler
vi.mock('@/lib/prisma', () => ({
  prisma: {
    document: { update: vi.fn(), findMany: vi.fn() },
    syncLog: { create: vi.fn() },
  },
}))

import { calculateNextSync } from '../services/scheduler'

describe('scheduler', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-15T10:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('calculateNextSync', () => {
    it('returns next day at 9am for DAILY', () => {
      const result = calculateNextSync('DAILY')
      expect(result.getHours()).toBe(9)
      expect(result.getMinutes()).toBe(0)
      expect(result.getDate()).toBe(16)
    })

    it('returns next Monday at 9am for WEEKLY', () => {
      // 2026-05-15 is a Friday
      const result = calculateNextSync('WEEKLY')
      expect(result.getHours()).toBe(9)
      expect(result.getDay()).toBe(1) // Monday
    })

    it('returns first of next month at 9am for MONTHLY', () => {
      const result = calculateNextSync('MONTHLY')
      expect(result.getHours()).toBe(9)
      expect(result.getDate()).toBe(1)
      expect(result.getMonth()).toBe(5) // June (0-indexed)
    })

    it('returns a future date for all frequencies', () => {
      const now = new Date()
      expect(calculateNextSync('DAILY').getTime()).toBeGreaterThan(now.getTime())
      expect(calculateNextSync('WEEKLY').getTime()).toBeGreaterThan(now.getTime())
      expect(calculateNextSync('MONTHLY').getTime()).toBeGreaterThan(now.getTime())
    })
  })
})
