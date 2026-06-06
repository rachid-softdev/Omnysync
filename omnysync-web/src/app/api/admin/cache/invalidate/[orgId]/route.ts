/**
 * POST /admin/cache/invalidate/:orgId
 * Manually invalidate entitlements cache for an organization
 */

import { NextRequest, NextResponse } from 'next/server'
import { getFeatureGateService } from '@/lib/entitlements/FeatureGateService'
import { requireAdmin, AuthError } from '@/lib/auth/require-admin'

export const runtime = 'nodejs'

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    await requireAdmin()

    const { orgId } = await params

    const featureGate = getFeatureGateService()
    await featureGate.invalidateCache(orgId)

    return NextResponse.json({
      success: true,
      orgId,
      message: 'Cache invalidated successfully',
    })
  } catch (error: unknown) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error('[Admin Cache Invalidate] Error:', error)
    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: 'Failed to invalidate cache' },
      { status: 500 }
    )
  }
}
