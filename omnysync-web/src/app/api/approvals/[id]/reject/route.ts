import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { getUserOrgId } from '@/lib/auth/org'
import { hasPermission } from '@/lib/auth/permissions'
import { checkPlanFeature } from '@/lib/auth/subscription'
import { respondToApprovalById } from '@/lib/approvals/respond'

const rejectSchema = z.object({
  comments: z.string().max(500).optional(),
})

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // The approval portal is a Business-plan feature (pricing page).
  const approvalAccess = await checkPlanFeature(session.user.id, 'approvalPortal')
  if (!approvalAccess.allowed) {
    return NextResponse.json(
      {
        error: 'The approval portal requires the Business plan',
        code: 'PLAN_FEATURE_REQUIRED',
        upgradeUrl: approvalAccess.upgradeUrl,
      },
      { status: 403 }
    )
  }

  const orgId = await getUserOrgId(session.user.id)

  if (!(await hasPermission(session.user.id, orgId, 'approval:manage'))) {
    return NextResponse.json({ error: 'You cannot reject requests' }, { status: 403 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    body = {}
  }

  const parsed = rejectSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid request' },
      { status: 400 }
    )
  }

  const { id } = await params

  try {
    const result = await respondToApprovalById(
      id,
      orgId,
      session.user.id,
      'REJECTED',
      parsed.data.comments
    )

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('POST approval reject error:', error)
    return NextResponse.json({ error: 'Failed to reject request' }, { status: 500 })
  }
}
