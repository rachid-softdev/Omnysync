/**
 * Admin Features API - GET/POST /admin/features
 */
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"

async function requireAdmin(request: NextRequest): Promise<boolean> {
  return request.headers.get("x-admin-role") === "admin"
}

export async function GET(request: NextRequest) {
  try {
    if (!await requireAdmin(request)) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 })
    const features = await prisma.feature.findMany({ orderBy: { key: "asc" } })
    return NextResponse.json({ data: features })
  } catch (error) {
    return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!await requireAdmin(request)) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 })
    const body = await request.json()
    const { key, name, description, type } = body
    if (!key || !name || !type) return NextResponse.json({ error: "VALIDATION_ERROR" }, { status: 400 })

    const feature = await prisma.feature.create({ data: { key, name, description, type } })
    return NextResponse.json(feature, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 })
  }
}