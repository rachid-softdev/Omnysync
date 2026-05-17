/**
 * Admin Plans API - GET/POST /admin/plans
 */
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

async function requireAdmin(request: NextRequest): Promise<boolean> {
  return request.headers.get("x-admin-role") === "admin"
}

export async function GET(request: NextRequest) {
  try {
    if (!await requireAdmin(request)) {
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 })
    }

    const plans = await prisma.plan.findMany({
      orderBy: [{ sortOrder: "asc" }, { key: "asc" }],
      include: { features: { include: { feature: true } } }
    })

    return NextResponse.json({ data: plans })
  } catch (error) {
    return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!await requireAdmin(request)) {
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 })
    }

    const body = await request.json()
    const { key, name, priceMonthly, priceYearly } = body

    if (!key || !name) {
      return NextResponse.json({ error: "VALIDATION_ERROR", message: "key and name required" }, { status: 400 })
    }

    const plan = await prisma.plan.create({
      data: { key, name, priceMonthly: priceMonthly ? parseFloat(priceMonthly) : null, priceYearly: priceYearly ? parseFloat(priceYearly) : null }
    })

    return NextResponse.json(plan, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 })
  }
}