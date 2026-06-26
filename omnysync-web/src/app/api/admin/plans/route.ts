/**
 * Admin Plans API
 * GET /admin/plans - List all plans with features
 * POST /admin/plans - Create a new plan
 */

import { NextRequest, NextResponse } from 'next/server'
import { getEntitlementRepository } from '@/lib/entitlements/EntitlementRepository'
import { prisma } from '@/lib/prisma'
import { PAGINATION_DEFAULTS } from '@/lib/entitlements/constants'
import { requireAdmin, AuthError } from '@/lib/auth/require-admin'

function safeParseInt(value: string | null, defaultValue: number): number {
  const parsed = parseInt(value ?? '', 10)
  return isNaN(parsed) ? defaultValue : Math.max(1, parsed)
}

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// ============================================================================
// GET /admin/plans
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    await requireAdmin()

    const { searchParams } = new URL(request.url)
    const page = safeParseInt(searchParams.get('page'), 1)
    const limit = Math.min(
      safeParseInt(searchParams.get('limit'), 20),
      PAGINATION_DEFAULTS.MAX_LIMIT
    )

    const repo = getEntitlementRepository()
    const plans = await repo.getAllPlansWithFeatures()

    // Paginate
    const total = plans.length
    const totalPages = Math.ceil(total / limit)
    const start = (page - 1) * limit
    const end = start + limit
    const paginatedPlans = plans.slice(start, end)

    return NextResponse.json({
      data: paginatedPlans,
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
    console.error('[Admin Plans GET] Error:', error)
    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: 'Failed to fetch plans' },
      { status: 500 }
    )
  }
}

// ============================================================================
// POST /admin/plans
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    await requireAdmin()

    const body = await request.json()
    const { key, name, priceMonthly, priceYearly, isActive, sortOrder } = body

    if (!key || !name) {
      return NextResponse.json(
        { error: 'VALIDATION_ERROR', message: 'key and name are required' },
        { status: 400 }
      )
    }

    // Check if key already exists
    const existing = await prisma.plan.findUnique({ where: { key } })
    if (existing) {
      return NextResponse.json(
        { error: 'DUPLICATE_KEY', message: `Plan '${key}' already exists` },
        { status: 409 }
      )
    }

    const plan = await prisma.plan.create({
      data: {
        key,
        name,
        priceMonthly:
          priceMonthly !== undefined && priceMonthly !== null
            ? parseFloat(String(priceMonthly))
            : null,
        priceYearly:
          priceYearly !== undefined && priceYearly !== null
            ? parseFloat(String(priceYearly))
            : null,
        isActive: isActive ?? true,
        sortOrder: sortOrder ?? 0,
      },
    })

    return NextResponse.json(plan, { status: 201 })
  } catch (error: unknown) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error('[Admin Plans POST] Error:', error)
    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: 'Failed to create plan' },
      { status: 500 }
    )
  }
}
