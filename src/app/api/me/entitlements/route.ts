/**
 * GET /api/me/entitlements
 * Returns user's entitlements for frontend
 */

import { NextRequest, NextResponse } from "next/server"
import { getFeatureGateService } from "@/lib/entitlements/FeatureGateService"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const orgId = request.headers.get("x-org-id")
    if (!orgId) {
      return NextResponse.json({ error: "UNAUTHORIZED", message: "Organization not identified" }, { status: 401 })
    }

    const featureGate = getFeatureGateService()
    const entitlements = await featureGate.getAllEntitlements(orgId)

    const response = {
      plan: entitlements.planKey,
      features: entitlements.features,
      limits: entitlements.limits,
      usage: {},
      resetAt: {},
    }

    return NextResponse.json(response, { headers: { "Cache-Control": "public, max-age=60, s-maxage=60" } })
  } catch (error) {
    console.error("[Entitlements API] Error:", error)
    return NextResponse.json({ error: "INTERNAL_ERROR", message: "Failed to fetch entitlements" }, { status: 500 })
  }
}