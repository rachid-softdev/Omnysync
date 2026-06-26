/**
 * GET /api/me/entitlements
 *
 * Returns the current user's entitlements for the frontend.
 * Cache: 60 seconds client-side
 *
 * Response:
 * {
 *   plan: "pro",
 *   features: { EXPORT_PDF: true, AI_SUMMARY: false },
 *   limits: { MAX_CONNECTORS: 10 },
 *   usage: { MAX_SYNCS: 5 },
 *   resetAt: { MAX_SYNCS: "2026-06-01T00:00:00Z" },
 *   experimentGroups: { NEW_DASHBOARD: "treatment" }
 * }
 */

import { NextRequest, NextResponse } from 'next/server'
import { getFeatureGateService } from '@/lib/entitlements/FeatureGateService'
import { getExperimentService } from '@/lib/entitlements/ExperimentService'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Get user from session (implementation depends on your auth setup)
async function getUserOrgId(request: NextRequest): Promise<string | null> {
  // Try to get from header first (for API clients)
  const headerOrgId = request.headers.get('x-org-id')

  if (headerOrgId) {
    return headerOrgId
  }

  // In a real implementation, get from session
  // For now, return null to require proper auth
  return null
}

export async function GET(request: NextRequest) {
  try {
    const orgId = await getUserOrgId(request)

    if (!orgId) {
      return NextResponse.json(
        { error: 'UNAUTHORIZED', message: 'Organization not identified' },
        { status: 401 }
      )
    }

    const featureGate = getFeatureGateService()
    const experimentService = getExperimentService()

    // Get entitlements from cache
    const entitlements = (await featureGate.getAllEntitlements(orgId)) as { planKey: string; features: Record<string, boolean>; limits: Record<string, number | null>; experiments: Record<string, unknown> }

    // Build usage map
    const usage: Record<string, number> = {}
    const resetAt: Record<string, string> = {}

    for (const [key, limit] of Object.entries(entitlements.limits || {})) {
      if (limit !== null) {
        // Get current usage
        const feature = await featureGate.hasFeature(orgId, key)
        if (feature) {
          // Usage tracking would be fetched here
          // For now, just pass limits
        }
      }
    }

    // Build experiment groups (if user ID available)
    const experimentGroups: Record<string, string> = {}

    // For experiments, we need a user ID to determine group
    // This would typically come from the session
    const userId = request.headers.get('x-user-id')

    if (userId) {
      for (const [key, config] of Object.entries(entitlements.experiments || {})) {
        const group = experimentService.getExperimentGroup(userId, config as { seed: string; percentage: number })
        experimentGroups[key] = group
      }
    }

    // Build response
    const response = {
      planKey: entitlements.planKey,
      features: entitlements.features,
      limits: entitlements.limits,
      usage,
      resetAt,
      experimentGroups: Object.keys(experimentGroups).length > 0 ? experimentGroups : undefined,
    }

    // Cache-Control: public, max-age=60 (60 seconds)
    return NextResponse.json(response, {
      headers: {
        'Cache-Control': 'public, max-age=60, s-maxage=60',
      },
    })
  } catch (error) {
    console.error('[Entitlements API] Error:', error)

    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: 'Failed to fetch entitlements' },
      { status: 500 }
    )
  }
}
