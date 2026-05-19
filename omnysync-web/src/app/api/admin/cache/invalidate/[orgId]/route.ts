/**
 * POST /admin/cache/invalidate/:orgId
 * Manually invalidate entitlements cache for an organization
 */

import { NextRequest, NextResponse } from 'next/server'
import { getFeatureGateService } from '@/lib/entitlements/FeatureGateService'

export const runtime = 'nodejs'

async function requireAdmin(request: NextRequest): Promise<string | null> {
  const adminHeader = request.headers.get('x-admin-role')
  if (adminHeader === 'admin') {
    return adminHeader
  }
  return null
}

export async function POST(
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
    await featureGate.invalidateCache(orgId)

    return NextResponse.json({
      success: true,
      orgId,
      message: 'Cache invalidated successfully',
    })
  } catch (error) {
    console.error('[Admin Cache Invalidate] Error:', error)
    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: 'Failed to invalidate cache' },
      { status: 500 }
    )
  }
}
