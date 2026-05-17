/**
 * GET /api/debug/entitlements - Debug endpoint for feature resolution
 */
import { NextRequest, NextResponse } from "next/server"
import { getFeatureGateService } from "@/lib/entitlements/FeatureGateService"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    if (request.headers.get("x-admin-role") !== "admin") {
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const orgId = searchParams.get("orgId")
    const feature = searchParams.get("feature")

    if (!orgId || !feature) {
      return NextResponse.json({ error: "VALIDATION_ERROR", message: "orgId and feature required" }, { status: 400 })
    }

    const featureGate = getFeatureGateService()
    const trace = await featureGate.getDebugTrace(orgId, feature)

    return NextResponse.json(trace)
  } catch (error: unknown) {
    return NextResponse.json({ error: "ERROR", message: error instanceof Error ? error.message : "Unknown" }, { status: 400 })
  }
}