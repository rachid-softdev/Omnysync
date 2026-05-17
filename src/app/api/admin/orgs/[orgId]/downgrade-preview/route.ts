/**
 * GET /admin/orgs/:orgId/downgrade-preview
 * Preview what features will be affected when downgrading to a target plan
 */

import { NextRequest, NextResponse } from "next/server"
import { getDowngradeService } from "@/lib/entitlements/DowngradeService"

export const runtime = "nodejs"

async function requireAdmin(request: NextRequest): Promise<string | null> {
  const adminHeader = request.headers.get("x-admin-role")
  if (adminHeader === "admin") {
    return adminHeader
  }
  return null
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    const isAdmin = await requireAdmin(request)
    if (!isAdmin) {
      return NextResponse.json({ error: "FORBIDDEN", message: "Admin access required" }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const targetPlanKey = searchParams.get("plan")

    if (!targetPlanKey) {
      return NextResponse.json({ error: "VALIDATION_ERROR", message: "plan query param required" }, { status: 400 })
    }

    const { orgId } = await params

    const downgradeService = getDowngradeService()
    const preview = await downgradeService.getDowngradePreview(orgId, targetPlanKey)

    // Get validation
    const validation = await downgradeService.validateDowngrade(orgId, targetPlanKey)

    return NextResponse.json({
      orgId,
      targetPlan: targetPlanKey,
      preview,
      canProceed: validation.canProceed,
      warnings: validation.warnings,
      affectedFeaturesCount: validation.affectedFeatures,
      recommendedStrategy: preview.recommendedStrategy,
    })
  } catch (error) {
    console.error("[Admin Downgrade Preview] Error:", error)
    return NextResponse.json({ error: "INTERNAL_ERROR", message: "Failed to generate preview" }, { status: 500 })
  }
}