import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const updateProfileSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100, 'Name is too long'),
})

/**
 * GET /api/user/profile
 * Returns the authenticated user's safe profile fields and current organization.
 */
export async function GET() {
  const session = await auth()

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const [user, membership] = await Promise.all([
      prisma.user.findUnique({
        where: { id: session.user.id },
        select: { id: true, name: true, email: true, image: true },
      }),
      prisma.userOrganization.findFirst({
        where: { userId: session.user.id },
        select: { organization: { select: { id: true, name: true } } },
      }),
    ])

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    return NextResponse.json({
      ...user,
      organization: membership?.organization ?? null,
    })
  } catch (error) {
    console.error('GET user profile error:', error)
    return NextResponse.json({ error: 'Failed to load profile' }, { status: 500 })
  }
}

/**
 * PATCH /api/user/profile
 * Updates the authenticated user's profile. Only the fields accepted by the
 * schema can be changed (never email, role, or password).
 */
export async function PATCH(req: NextRequest) {
  const session = await auth()

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = updateProfileSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid request' },
      { status: 400 }
    )
  }

  try {
    const user = await prisma.user.update({
      where: { id: session.user.id },
      data: { name: parsed.data.name },
      select: { id: true, name: true, email: true, image: true },
    })

    return NextResponse.json(user)
  } catch (error) {
    console.error('PATCH user profile error:', error)
    return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 })
  }
}
