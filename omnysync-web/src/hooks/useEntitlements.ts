/**
 * Entitlements hook
 * Omnysync - 2026
 *
 * Provides feature flag checking for the frontend.
 * Communicates with the entitlements API to check feature availability.
 */

import type { EntitlementsResponse } from '@/lib/entitlements/types'
import { useState, useEffect } from 'react'

interface UseEntitlementsResult {
  entitlements: EntitlementsResponse | null
  isLoading: boolean
  error: Error | null
}

/**
 * Hook to fetch and cache user entitlements
 */
export function useEntitlements(): UseEntitlementsResult {
  const [state, setState] = useState<UseEntitlementsResult>({
    entitlements: null,
    isLoading: true,
    error: null,
  })

  useEffect(() => {
    fetch('/api/me/entitlements')
      .then((res) => res.json())
      .then((data) =>
        setState({ entitlements: data as EntitlementsResponse, isLoading: false, error: null }),
      )
      .catch((err) =>
        setState({ entitlements: null, isLoading: false, error: err as Error }),
      )
  }, [])

  return state
}

/**
 * Hook to check if a specific feature is enabled
 */
export function useFeature(featureKey: string): boolean {
  const { entitlements } = useEntitlements()

  if (!entitlements) return false

  // Check if the feature is in the enabled features list
  return entitlements.features?.[featureKey] === true
}

/**
 * Hook to check quota for a specific feature
 */
export function useFeatureQuota(featureKey: string): {
  used: number
  limit: number
  remaining: number
} | null {
  const { entitlements } = useEntitlements()

  if (!entitlements?.limits) return null

  const quota = {
    used: entitlements.usage?.[featureKey] ?? 0,
    limit: entitlements.limits[featureKey],
    remaining: entitlements.limits[featureKey] !== null
      ? (entitlements.limits[featureKey]! - (entitlements.usage?.[featureKey] ?? 0))
      : null,
  }

  if (!quota) return null

  if (!quota) return null
  return {
    used: quota.used,
    limit: quota.limit ?? 0,
    remaining: quota.remaining ?? 0,
  }
}
