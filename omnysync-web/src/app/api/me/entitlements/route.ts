/**
 * GET /api/me/entitlements
 *
 * Returns the current user's entitlements for the frontend.
 * Cache: 60 seconds client-side
 *
 * Response:
 * {
 *   planKey: "pro",
 *   features: { EXPORT_PDF: true, AI_SUMMARY: false },
 *   limits: { MAX_CONNECTORS: 10 },
 *   usage: { MAX_SYNCS: 5 },
 *   resetAt: { MAX_SYNCS: "2026-06-01T00:00:00Z" },
 *   experimentGroups: { NEW_DASHBOARD: "treatment" }
 * }
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getUserOrgId } from '@/lib/auth/org'
import { getFeatureGateService } from '@/lib/entitlements/FeatureGateService'
import { getExperimentService } from '@/lib/entitlements/ExperimentService'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    // Authentifier l'utilisateur avant toute chose
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'UNAUTHORIZED', message: 'Authentication required' },
        { status: 401 }
      )
    }

    // Résoudre l'organisation de façon sécurisée (jamais via un header forgeable)
    let orgId: string
    try {
      orgId = await getUserOrgId(session.user.id)
    } catch {
      return NextResponse.json(
        { error: 'UNAUTHORIZED', message: 'No organization' },
        { status: 401 }
      )
    }

    const featureGate = getFeatureGateService()
    const experimentService = getExperimentService()

    // Get entitlements from cache
    const entitlements = await featureGate.getAllEntitlements(orgId)

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

    // Build experiment groups for the authenticated user
    const experimentGroups: Record<string, string> = {}
    const userId = session.user.id

    for (const [key, config] of Object.entries(entitlements.experiments || {})) {
      const group = experimentService.getExperimentGroup(
        userId,
        config as { seed: string; percentage: number }
      )
      experimentGroups[key] = group
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

    // Entitlements are per-user/per-org data — must NOT be cached by shared/CDN
    // caches (a `public`/`s-maxage` header would let one user's entitlements be
    // served to another from the edge cache). Force a private, browser-only cache.
    return NextResponse.json(response, {
      headers: {
        'Cache-Control': 'private, max-age=60',
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
