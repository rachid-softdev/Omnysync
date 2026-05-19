/**
 * Admin Features API
 * GET /admin/features - List all features
 * POST /admin/features - Create a new feature
 */

import { NextRequest, NextResponse } from 'next/server'
import { getEntitlementRepository } from '@/lib/entitlements/EntitlementRepository'
import { prisma } from '@/lib/prisma'
import { FeatureType } from '@/lib/entitlements/types'
import { PAGINATION_DEFAULTS } from '@/lib/entitlements/constants'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

async function requireAdmin(request: NextRequest): Promise<string | null> {
  const adminHeader = request.headers.get('x-admin-role')
  if (adminHeader === 'admin') {
    return 'admin'
  }
  return null
}

// ============================================================================
// GET /admin/features
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
    const page = parseInt(searchParams.get('page') || '1')
    const limit = Math.min(
      parseInt(searchParams.get('limit') || '20'),
      PAGINATION_DEFAULTS.MAX_LIMIT
    )
    const sort = searchParams.get('sort') || 'key:asc'

    const repo = getEntitlementRepository()
    let features = await repo.getAllFeaturesWithPlans()

    // Sort
    const [sortField, sortDir] = sort.split(':')
    features = features.sort((a, b) => {
      const aVal = a[sortField as keyof typeof a]
      const bVal = b[sortField as keyof typeof b]
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal)
      }
      return 0
    })

    // Paginate
    const total = features.length
    const totalPages = Math.ceil(total / limit)
    const start = (page - 1) * limit
    const end = start + limit
    const paginatedFeatures = features.slice(start, end)

    return NextResponse.json({
      data: paginatedFeatures,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    })
  } catch (error) {
    console.error('[Admin Features GET] Error:', error)
    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: 'Failed to fetch features' },
      { status: 500 }
    )
  }
}

// ============================================================================
// POST /admin/features
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
    const { key, name, description, type, defaultConfig } = body

    if (!key || !name || !type) {
      return NextResponse.json(
        { error: 'VALIDATION_ERROR', message: 'key, name, and type are required' },
        { status: 400 }
      )
    }

    // Validate type
    if (!['BOOLEAN', 'LIMIT', 'EXPERIMENT'].includes(type)) {
      return NextResponse.json(
        { error: 'VALIDATION_ERROR', message: 'type must be BOOLEAN, LIMIT, or EXPERIMENT' },
        { status: 400 }
      )
    }

    // Check if key already exists
    const existing = await prisma.feature.findUnique({ where: { key } })
    if (existing) {
      return NextResponse.json(
        { error: 'DUPLICATE_KEY', message: `Feature '${key}' already exists` },
        { status: 409 }
      )
    }

    const feature = await prisma.feature.create({
      data: {
        key,
        name,
        description,
        type: type as FeatureType,
        defaultConfig,
      },
    })

    return NextResponse.json(feature, { status: 201 })
  } catch (error) {
    console.error('[Admin Features POST] Error:', error)
    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: 'Failed to create feature' },
      { status: 500 }
    )
  }
}
