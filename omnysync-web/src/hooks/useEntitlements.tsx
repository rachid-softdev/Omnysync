/**
 * useEntitlements Hook
 *
 * React hook to fetch and cache user's entitlements.
 * Provides full entitlement map with features, limits, and usage.
 */

"use client"

import { useState, useEffect, useCallback } from "react"
import type { EntitlementsResponse } from "@/lib/entitlements/types"

interface UseEntitlementsOptions {
  /** Refresh interval in seconds (default: 60) */
  refreshInterval?: number
  /** Whether to refetch on window focus */
  refetchOnFocus?: boolean
}

interface UseEntitlementsState {
  data: EntitlementsResponse | null
  isLoading: boolean
  error: Error | null
  refetch: () => Promise<void>
}

const ENTITLEMENTS_CACHE_KEY = "user-entitlements"
const DEFAULT_REFRESH_INTERVAL = 60 // seconds

/**
 * Hook to get user's entitlements
 *
 * @example
 * const { data, isLoading, error, refetch } = useEntitlements()
 *
 * if (data) {
 *   console.log("Plan:", data.plan)
 *   console.log("Features:", data.features)
 * }
 */
export function useEntitlements(options: UseEntitlementsOptions = {}): UseEntitlementsState {
  const { refreshInterval = DEFAULT_REFRESH_INTERVAL, refetchOnFocus = true } = options

  const [data, setData] = useState<EntitlementsResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const fetchEntitlements = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)

      const response = await fetch("/api/me/entitlements", {
        headers: {
          // Add auth headers as needed
        },
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || "Failed to fetch entitlements")
      }

      const result = await response.json()

      // Cache in localStorage for offline access
      localStorage.setItem(ENTITLEMENTS_CACHE_KEY, JSON.stringify(result))

      setData(result)
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Unknown error"))

      // Try to restore from cache
      const cached = localStorage.getItem(ENTITLEMENTS_CACHE_KEY)
      if (cached) {
        try {
          setData(JSON.parse(cached))
        } catch {
          // Ignore parse errors
        }
      }
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Initial fetch
  useEffect(() => {
    fetchEntitlements()
  }, [fetchEntitlements])

  // Periodic refresh
  useEffect(() => {
    if (refreshInterval <= 0) return

    const interval = setInterval(() => {
      fetchEntitlements()
    }, refreshInterval * 1000)

    return () => clearInterval(interval)
  }, [fetchEntitlements, refreshInterval])

  // Refetch on focus
  useEffect(() => {
    if (!refetchOnFocus) return

    const handleFocus = () => {
      fetchEntitlements()
    }

    window.addEventListener("focus", handleFocus)
    return () => window.removeEventListener("focus", handleFocus)
  }, [fetchEntitlements, refetchOnFocus])

  return {
    data,
    isLoading,
    error,
    refetch: fetchEntitlements,
  }
}

/**
 * Hook to check if a specific feature is enabled
 *
 * @example
 * const canExport = useFeature("EXPORT_PDF")
 *
 * if (canExport) {
 *   return <ExportButton />
 * }
 */
export function useFeature(featureKey: string): boolean {
  const { data } = useEntitlements()

  return data?.features[featureKey] ?? false
}

/**
 * Hook to get limit info for a feature
 *
 * @example
 * const { limit, used, resetAt } = useLimit("MAX_SYNCS_PER_MONTH")
 *
 * return (
 *   <div>
 *     <p>Used: {used} / {limit ?? "unlimited"}</p>
 *     <p>Resets: {resetAt}</p>
 *   </div>
 * )
 */
export function useLimit(featureKey: string): {
  limit: number | null
  used: number
  resetAt: string | null
  remaining: number | null
} {
  const { data } = useEntitlements()

  const limit = data?.limits[featureKey] ?? null
  const used = data?.usage[featureKey] ?? 0
  const resetAt = data?.resetAt[featureKey] ?? null

  let remaining: number | null
  if (limit === null) {
    remaining = null // Unlimited
  } else {
    remaining = Math.max(0, limit - used)
  }

  return { limit, used, resetAt, remaining }
}

/**
 * Component to conditionally render content based on feature availability
 *
 * @example
 * <FeatureGuard feature="EXPORT_PDF" fallback={<UpgradeBanner />}>
 *   <ExportButton />
 * </FeatureGuard>
 */
interface FeatureGuardProps {
  feature: string
  children: React.ReactNode
  fallback?: React.ReactNode
  /** Show fallback even while loading (default: false) */
  showFallbackWhileLoading?: boolean
}

export function FeatureGuard({
  feature,
  children,
  fallback = null,
  showFallbackWhileLoading = false,
}: FeatureGuardProps) {
  const isEnabled = useFeature(feature)

  if (!isEnabled) {
    return <>{fallback}</>
  }

  return <>{children}</>
}

/**
 * Component to show usage bar for limit-type features
 *
 * @example
 * <UsageBar feature="MAX_SYNCS_PER_MONTH" showUpgradeOnLimit />
 */
interface UsageBarProps {
  feature: string
  showUpgradeOnLimit?: boolean
  className?: string
}

export function UsageBar({ feature, showUpgradeOnLimit = false, className = "" }: UsageBarProps) {
  const { limit, used, remaining } = useLimit(feature)

  if (limit === null) {
    return null // Unlimited - no need to show bar
  }

  const percentage = Math.round((used / limit) * 100)
  const isAtLimit = remaining === 0

  return (
    <div className={className}>
      <div className="flex justify-between text-sm mb-1">
        <span>
          {used} / {limit}
        </span>
        <span>{percentage}%</span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div
          className={`h-2 rounded-full ${isAtLimit ? "bg-red-500" : "bg-blue-500"}`}
          style={{ width: `${Math.min(percentage, 100)}%` }}
        />
      </div>
      {isAtLimit && showUpgradeOnLimit && (
        <a href="/billing/upgrade" className="text-sm text-blue-500 hover:underline">
          Upgrade to get more
        </a>
      )}
    </div>
  )
}