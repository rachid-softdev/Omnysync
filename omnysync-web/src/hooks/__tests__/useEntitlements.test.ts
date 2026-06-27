/**
 * useEntitlements Tests
 *
 * Tests for the backward-compatible wrapper hook:
 * - useEntitlements: maps useCoreEntitlements result shape
 * - useFeatureQuota: maps useLimit result shape
 * - Re-exports: useFeature, useLimit, FeatureGuard, UsageBar
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'

// ============================================================================
// MOCKS
// ============================================================================

const mockUseCoreEntitlements = vi.fn()
const mockUseFeature = vi.fn()
const mockUseLimit = vi.fn()

vi.mock('@omnysync/core/hooks', () => ({
  useEntitlements: (...args: any[]) => mockUseCoreEntitlements(...args),
  useFeature: (...args: any[]) => mockUseFeature(...args),
  useLimit: (...args: any[]) => mockUseLimit(...args),
  FeatureGuard: ({ feature, children, fallback }: any) => {
    const isEnabled = mockUseFeature(feature)
    return isEnabled ? children : (fallback ?? null)
  },
  UsageBar: ({ feature }: any) => {
    const { limit, used, remaining } = mockUseLimit(feature)
    return limit === null ? null : `${used}/${limit} remaining:${remaining}`
  },
}))

// ============================================================================
// IMPORTS (must come after mocks)
// ============================================================================

import {
  useEntitlements,
  useFeatureQuota,
  useFeature,
  useLimit,
  FeatureGuard,
  UsageBar,
} from '../useEntitlements'

// ============================================================================
// TESTS
// ============================================================================

describe('useEntitlements', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('useEntitlements (wrapper)', () => {
    it('should map data → entitlements, isLoading, error from core hook', () => {
      const mockData = {
        plan: 'pro',
        features: { EXPORT_PDF: true },
        limits: { MAX_SYNCS: 100 },
        usage: { MAX_SYNCS: 5 },
        resetAt: { MAX_SYNCS: '2026-07-01' },
      }
      mockUseCoreEntitlements.mockReturnValue({
        data: mockData,
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      })

      const { result } = renderHook(() => useEntitlements())

      expect(result.current.entitlements).toEqual(mockData)
      expect(result.current.isLoading).toBe(false)
      expect(result.current.error).toBeNull()
    })

    it('should return null entitlements when data is null', () => {
      mockUseCoreEntitlements.mockReturnValue({
        data: null,
        isLoading: true,
        error: null,
        refetch: vi.fn(),
      })

      const { result } = renderHook(() => useEntitlements())

      expect(result.current.entitlements).toBeNull()
      expect(result.current.isLoading).toBe(true)
    })

    it('should forward error from core hook', () => {
      const testError = new Error('Failed to fetch')
      mockUseCoreEntitlements.mockReturnValue({
        data: null,
        isLoading: false,
        error: testError,
        refetch: vi.fn(),
      })

      const { result } = renderHook(() => useEntitlements())

      expect(result.current.error).toBe(testError)
      expect(result.current.entitlements).toBeNull()
    })
  })

  describe('useFeatureQuota', () => {
    it('should map useLimit result to { used, limit, remaining }', () => {
      mockUseLimit.mockReturnValue({
        limit: 100,
        used: 25,
        resetAt: '2026-07-01',
        remaining: 75,
      })

      const { result } = renderHook(() => useFeatureQuota('MAX_SYNCS'))

      expect(result.current).toEqual({
        used: 25,
        limit: 100,
        remaining: 75,
      })
    })

    it('should coerce null limit to 0', () => {
      mockUseLimit.mockReturnValue({
        limit: null,
        used: 0,
        resetAt: null,
        remaining: null,
      })

      const { result } = renderHook(() => useFeatureQuota('UNLIMITED_FEATURE'))

      expect(result.current).toEqual({
        used: 0,
        limit: 0,
        remaining: 0,
      })
    })

    it('should pass featureKey to useLimit', () => {
      mockUseLimit.mockReturnValue({
        limit: 10,
        used: 5,
        resetAt: null,
        remaining: 5,
      })

      renderHook(() => useFeatureQuota('MAX_SYNCS_PER_MONTH'))

      expect(mockUseLimit).toHaveBeenCalledWith('MAX_SYNCS_PER_MONTH')
    })
  })

  describe('re-exports', () => {
    it('should re-export useFeature from core', () => {
      expect(useFeature).toBeDefined()
      expect(typeof useFeature).toBe('function')
    })

    it('should re-export useLimit from core', () => {
      expect(useLimit).toBeDefined()
      expect(typeof useLimit).toBe('function')
    })

    it('should re-export FeatureGuard from core', () => {
      expect(FeatureGuard).toBeDefined()
    })

    it('should re-export UsageBar from core', () => {
      expect(UsageBar).toBeDefined()
    })
  })
})
