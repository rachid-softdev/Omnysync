/**
 * GET /admin/orgs/:orgId/entitlements
 * Get entitlements for a specific organization
 */

import { NextRequest, NextResponse } from 'next/server'
import { getFeatureGateService } from '@/lib/entitlements/FeatureGateService'
import { getEntitlementRepository } from '@/lib/entitlements/EntitlementRepository'
import { requireAdmin, AuthError } from '@/lib/auth/require-admin'

export const runtime = 'nodejs'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    await requireAdmin()

    const { orgId } = await params

    const featureGate = getFeatureGateService()
    const repo = getEntitlementRepository()

    // Get subscription info
    const subscription = await repo.getActiveSubscription(orgId)
    const planKey = await repo.getPlanKey(orgId)

    // Get entitlements
    const entitlements = await featureGate.getAllEntitlements(orgId)

    // Get overrides
    const overrides = await repo.getAllOverridesForOrg(orgId)

    return NextResponse.json({
      orgId,
      subscription,
      planKey,
      entitlements,
      overrides,
    })
  } catch (error: unknown) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error('[Admin Org Entitlements] Error:', error)
    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: 'Failed to fetch entitlements' },
      { status: 500 }
    )
  }
}
