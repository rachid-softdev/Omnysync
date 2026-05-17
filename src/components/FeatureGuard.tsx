/**
 * FeatureGuard Component
 *
 * A React component that conditionally renders content based on feature availability.
 * Uses the useFeature hook under the hood.
 */

"use client"

import { useFeature } from "@/hooks/useEntitlements"
import type { ReactNode } from "react"

export interface FeatureGuardProps {
  /** Feature key to check */
  feature: string
  /** Children to render when feature is enabled */
  children: ReactNode
  /** Fallback to show when feature is not available */
  fallback?: ReactNode
  /** Show fallback while loading (default: false) */
  showFallbackWhileLoading?: boolean
  /** Hide completely when not available (doesn't render fallback) */
  hideWhenDisabled?: boolean
  /** CSS class for the wrapper */
  className?: string
}

/**
 * FeatureGuard - Conditionally render content based on feature availability
 *
 * @example
 * // Simple usage
 * <FeatureGuard feature="EXPORT_PDF" fallback={<UpgradeBanner />}>
 *   <ExportButton />
 * </FeatureGuard>
 *
 * @example
 * // With loading state handling
 * <FeatureGuard
 *   feature="EXPORT_PDF"
 *   fallback={<UpgradeBanner />}
 *   showFallbackWhileLoading={false}
 * >
 *   <ExportButton />
 * </FeatureGuard>
 */
export function FeatureGuard({
  feature,
  children,
  fallback = null,
  showFallbackWhileLoading = false,
  hideWhenDisabled = false,
  className = "",
}: FeatureGuardProps) {
  const isEnabled = useFeature(feature)

  if (!isEnabled && hideWhenDisabled) {
    return null
  }

  if (!isEnabled) {
    return <span className={className}>{fallback}</span>
  }

  return <span className={className}>{children}</span>
}

/**
 * FeatureSwitch - Render different content based on feature state
 *
 * @example
 * <FeatureSwitch
 *   feature="EXPORT_PDF"
 *   enabled={<ExportButton />}
 *   disabled={<UpgradeBanner />}
 * />
 */
interface FeatureSwitchProps {
  feature: string
  enabled: ReactNode
  disabled: ReactNode
  className?: string
}

export function FeatureSwitch({
  feature,
  enabled,
  disabled,
  className = "",
}: FeatureSwitchProps) {
  const isEnabled = useFeature(feature)

  return <span className={className}>{isEnabled ? enabled : disabled}</span>
}

/**
 * PlanBadge - Show user's current plan
 *
 * @example
 * <PlanBadge />
 */
interface PlanBadgeProps {
  className?: string
  variant?: "default" | "success" | "warning" | "error"
}

export function PlanBadge({ className = "", variant = "default" }: PlanBadgeProps) {
  // This would use useEntitlements internally
  // For now, placeholder - implement based on your UI
  const variantClasses = {
    default: "bg-gray-100 text-gray-800",
    success: "bg-green-100 text-green-800",
    warning: "bg-yellow-100 text-yellow-800",
    error: "bg-red-100 text-red-800",
  }

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${variantClasses[variant]} ${className}`}>
      Plan
    </span>
  )
}

export default FeatureGuard