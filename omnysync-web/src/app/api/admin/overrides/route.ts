/**
 * Admin Overrides API
 * POST /admin/overrides - Create override
 * GET /admin/overrides - List overrides
 */

import { NextRequest, NextResponse } from 'next/server'
import { getEntitlementRepository } from '@/lib/entitlements/EntitlementRepository'
import { getFeatureGateService } from '@/lib/entitlements/FeatureGateService'
import { prisma } from '@/lib/prisma'
import { PAGINATION_DEFAULTS } from '@/lib/entitlements/constants'
import { requireAdmin, AuthError } from '@/lib/auth/require-admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// ============================================================================
// GET /admin/overrides
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    await requireAdmin()

    const { searchParams } = new URL(request.url)
    const orgId = searchParams.get('orgId')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = Math.min(
      parseInt(searchParams.get('limit') || '20'),
      PAGINATION_DEFAULTS.MAX_LIMIT
    )

    let overrides

    if (orgId) {
      const repo = getEntitlementRepository()
      overrides = await repo.getAllOverridesForOrg(orgId)
    } else {
      overrides = await prisma.entitlementOverride.findMany({
        orderBy: { createdAt: 'desc' },
      })
    }

    // Paginate
    const total = overrides.length
    const totalPages = Math.ceil(total / limit)
    const start = (page - 1) * limit
    const end = start + limit
    const paginatedOverrides = overrides.slice(start, end)

    return NextResponse.json({
      data: paginatedOverrides,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    })
  } catch (error: unknown) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error('[Admin Overrides GET] Error:', error)
    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: 'Failed to fetch overrides' },
      { status: 500 }
    )
  }
}

// ============================================================================
// POST /admin/overrides
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdmin()

    const body = await request.json()
    const { scope, scopeId, featureKey, enabled, limitValue, expiresAt, reason } = body

    // Validate required fields
    if (!scope || !scopeId || !featureKey || reason === undefined) {
      return NextResponse.json(
        {
          error: 'VALIDATION_ERROR',
          message: 'scope, scopeId, featureKey, and reason are required',
        },
        { status: 400 }
      )
    }

    // Validate scope
    if (!['ORG', 'USER'].includes(scope)) {
      return NextResponse.json(
        { error: 'VALIDATION_ERROR', message: 'scope must be ORG or USER' },
        { status: 400 }
      )
    }

    // Reason is required (for audit)
    if (!reason || reason.trim().length === 0) {
      return NextResponse.json(
        { error: 'VALIDATION_ERROR', message: 'reason is required for audit trail' },
        { status: 400 }
      )
    }

    // Use session user id from requireAdmin() — NOT the forgeable x-user-id header
    const createdBy = admin.id

    const repo = getEntitlementRepository()
    const override = await repo.createOverride({
      scope,
      scopeId,
      featureKey,
      enabled,
      limitValue: limitValue ?? null,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      reason,
      createdBy,
    })

    // Invalidate cache for org-level overrides
    if (scope === 'ORG') {
      const featureGate = getFeatureGateService()
      await featureGate.invalidateCache(scopeId)
    }

    return NextResponse.json(override, { status: 201 })
  } catch (error: unknown) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error('[Admin Overrides POST] Error:', error)
    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: 'Failed to create override' },
      { status: 500 }
    )
  }
}
