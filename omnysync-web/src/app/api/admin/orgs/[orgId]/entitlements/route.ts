/**
 * GET /admin/orgs/:orgId/entitlements
 * Get entitlements for a specific organization
 */

import { NextRequest, NextResponse } from 'next/server'
import { getFeatureGateService } from '@/lib/entitlements/FeatureGateService'
import { getEntitlementRepository } from '@/lib/entitlements/EntitlementRepository'

export const runtime = 'nodejs'

async function requireAdmin(request: NextRequest): Promise<string | null> {
  const adminHeader = request.headers.get('x-admin-role')
  if (adminHeader === 'admin') {
    return adminHeader
  }
  return null
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    const isAdmin = await requireAdmin(request)
    if (!isAdmin) {
      return NextResponse.json(
        { error: 'FORBIDDEN', message: 'Admin access required' },
        { status: 403 }
      )
    }

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
  } catch (error) {
    console.error('[Admin Org Entitlements] Error:', error)
    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: 'Failed to fetch entitlements' },
      { status: 500 }
    )
  }
}
