/**
 * Entitlements hook - compatibility wrapper
 *
 * Re-exports from @omnysync/core/hooks with backward-compatible API.
 * The core hook returns { data, isLoading, error, refetch } but the
 * web app expects { entitlements, isLoading, error }.
 */

import {
  useEntitlements as useCoreEntitlements,
  useFeature,
  useLimit,
  FeatureGuard,
  UsageBar,
} from '@omnysync/core/hooks'
import type { EntitlementsResponse } from '@/lib/entitlements/types'

export type { EntitlementsResponse } from '@/lib/entitlements/types'

// Re-export core hooks/ components with matching API
export { useFeature, useLimit, FeatureGuard, UsageBar }

/**
 * Hook to fetch and cache user entitlements
 * Backward-compatible wrapper returning { entitlements, isLoading, error }
 */
export function useEntitlements(): {
  entitlements: EntitlementsResponse | null
  isLoading: boolean
  error: Error | null
} {
  const result = useCoreEntitlements() as { data: Record<string, unknown>; isLoading: boolean; error: Error | null; refetch: () => void }

  return {
    entitlements: result.data as EntitlementsResponse | null,
    isLoading: result.isLoading,
    error: result.error as Error | null,
  }
}

/**
 * Hook to check quota for a specific feature
 * Backward-compatible wrapper returning { used, limit, remaining } | null
 */
export function useFeatureQuota(featureKey: string): {
  used: number
  limit: number
  remaining: number
} | null {
  const { limit, used, remaining } = useLimit(featureKey) as { limit: number | null; used: number; remaining: number; isLoading: boolean }

  return {
    used,
    limit: limit ?? 0,
    remaining: remaining ?? 0,
  }
}
