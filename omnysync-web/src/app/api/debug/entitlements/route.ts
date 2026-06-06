/**
 * GET /api/debug/entitlements
 *
 * Debug endpoint - returns detailed trace of how a feature was resolved
 * Admin only
 *
 * Query params:
 * - orgId: Organization ID
 * - feature: Feature key
 */

import { NextRequest, NextResponse } from 'next/server'
import { getFeatureGateService } from '@/lib/entitlements/FeatureGateService'
import { requireAdmin, AuthError } from '@/lib/auth/require-admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    await requireAdmin()

    const { searchParams } = new URL(request.url)
    const orgId = searchParams.get('orgId')
    const feature = searchParams.get('feature')

    if (!orgId || !feature) {
      return NextResponse.json(
        { error: 'VALIDATION_ERROR', message: 'orgId and feature query params are required' },
        { status: 400 }
      )
    }

    const featureGate = getFeatureGateService()

    const trace = await featureGate.getDebugTrace(orgId, feature)

    return NextResponse.json(trace)
  } catch (error: unknown) {
    console.error('[Debug Entitlements] Error:', error)

    // Handle known error types
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    if (error instanceof Error) {
      return NextResponse.json({ error: 'ERROR', message: error.message }, { status: 400 })
    }

    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: 'Failed to get debug trace' },
      { status: 500 }
    )
  }
}
