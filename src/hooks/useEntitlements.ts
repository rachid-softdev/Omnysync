/**
 * useEntitlements Hook
 */
"use client"

import { useState, useEffect, useCallback } from "react"

interface EntitlementsResponse {
  plan: string
  features: Record<string, boolean>
  limits: Record<string, number | null>
  usage: Record<string, number>
  resetAt: Record<string, string>
}

interface UseEntitlementsState {
  data: EntitlementsResponse | null
  isLoading: boolean
  error: Error | null
  refetch: () => Promise<void>
}

export function useEntitlements(options: { refreshInterval?: number } = {}): UseEntitlementsState {
  const { refreshInterval = 60 } = options
  const [data, setData] = useState<EntitlementsResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const fetchEntitlements = useCallback(async () => {
    try {
      setIsLoading(true)
      const response = await fetch("/api/me/entitlements")
      if (!response.ok) throw new Error("Failed to fetch entitlements")
      const result = await response.json()
      setData(result)
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Unknown error"))
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchEntitlements()
  }, [fetchEntitlements])

  useEffect(() => {
    if (refreshInterval <= 0) return
    const interval = setInterval(fetchEntitlements, refreshInterval * 1000)
    return () => clearInterval(interval)
  }, [fetchEntitlements, refreshInterval])

  return { data, isLoading, error, refetch: fetchEntitlements }
}

export function useFeature(featureKey: string): boolean {
  const { data } = useEntitlements()
  return data?.features[featureKey] ?? false
}

export function useLimit(featureKey: string): { limit: number | null; used: number; resetAt: string | null; remaining: number | null } {
  const { data } = useEntitlements()
  const limit = data?.limits[featureKey] ?? null
  const used = data?.usage[featureKey] ?? 0
  const resetAt = data?.resetAt[featureKey] ?? null
  const remaining = limit === null ? null : Math.max(0, limit - used)
  return { limit, used, resetAt, remaining }
}

interface FeatureGuardProps {
  feature: string
  children: React.ReactNode
  fallback?: React.ReactNode
}

export function FeatureGuard({ feature, children, fallback = null }: FeatureGuardProps) {
  const isEnabled = useFeature(feature)
  if (!isEnabled) return <>{fallback}</>
  return <>{children}</>
}