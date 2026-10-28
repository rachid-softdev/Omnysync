import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const preferencesSchema = z
  .object({
    syncSuccess: z.boolean().optional(),
    syncFailed: z.boolean().optional(),
    teamInvites: z.boolean().optional(),
  })
  .strict()

const DEFAULTS = {
  syncSuccess: true,
  syncFailed: true,
  teamInvites: true,
}

/**
 * GET /api/user/notifications
 * Returns the authenticated user's persisted email preferences. A missing row
 * means the user never changed them, so the defaults are returned.
 */
export async function GET() {
  const session = await auth()

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const preferences = await prisma.notificationPreference.findUnique({
      where: { userId: session.user.id },
      select: { syncSuccess: true, syncFailed: true, teamInvites: true },
    })

    return NextResponse.json(preferences ?? DEFAULTS)
  } catch (error) {
    console.error('GET user notifications error:', error)
    return NextResponse.json({ error: 'Failed to load notification preferences' }, { status: 500 })
  }
}

/**
 * PATCH /api/user/notifications
 * Persists only the notification preferences accepted by the schema.
 */
export async function PATCH(req: NextRequest) {
  const session = await auth()

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await req.json()
    const parsed = preferencesSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Invalid preferences' },
        { status: 400 }
      )
    }

    if (Object.keys(parsed.data).length === 0) {
      return NextResponse.json({ error: 'No preferences provided' }, { status: 400 })
    }

    const preferences = await prisma.notificationPreference.upsert({
      where: { userId: session.user.id },
      create: {
        userId: session.user.id,
        ...DEFAULTS,
        ...parsed.data,
      },
      update: parsed.data,
      select: { syncSuccess: true, syncFailed: true, teamInvites: true },
    })

    return NextResponse.json(preferences)
  } catch (error) {
    console.error('PATCH user notifications error:', error)
    return NextResponse.json({ error: 'Failed to save notification preferences' }, { status: 500 })
  }
}
