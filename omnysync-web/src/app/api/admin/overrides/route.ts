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

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

async function requireAdmin(request: NextRequest): Promise<string | null> {
  const adminHeader = request.headers.get('x-admin-role')
  if (adminHeader === 'admin') {
    return adminHeader
  }
  return null
}

// ============================================================================
// GET /admin/overrides
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const isAdmin = await requireAdmin(request)
    if (!isAdmin) {
      return NextResponse.json(
        { error: 'FORBIDDEN', message: 'Admin access required' },
        { status: 403 }
      )
    }

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
  } catch (error) {
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
    const isAdmin = await requireAdmin(request)
    if (!isAdmin) {
      return NextResponse.json(
        { error: 'FORBIDDEN', message: 'Admin access required' },
        { status: 403 }
      )
    }

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

    const createdBy = request.headers.get('x-user-id') || 'admin'

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
  } catch (error) {
    console.error('[Admin Overrides POST] Error:', error)
    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: 'Failed to create override' },
      { status: 500 }
    )
  }
}
