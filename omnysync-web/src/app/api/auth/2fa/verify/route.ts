/**
 * Route API: Vérification 2FA
 * POST /api/auth/2fa/verify
 */
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { rateLimitRedisWithConfig } from '@/lib/rate-limit-redis'
import { verifyTotpCode } from '@omnysync/core/services/two-factor'
import { z } from 'zod'

const verifySchema = z.object({
  code: z.string().min(6, 'Code invalide').max(6),
})

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    // Rate limiting: 5 tentatives par minute par IP
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
      request.headers.get('x-real-ip') ??
      'unknown'

    const rateResult = await rateLimitRedisWithConfig(
      `2fa:verify:${ip}`,
      { max: 5, windowMs: 60000 },
      request
    )

    if (!rateResult.allowed) {
      return NextResponse.json(
        { error: 'Trop de tentatives. Réessayez dans une minute.' },
        { status: 429 }
      )
    }

    const body = await request.json()
    const { code } = verifySchema.parse(body)

    // Get user's 2FA configuration
    const twoFactor = await prisma.twoFactorAuth.findUnique({
      where: { userId: session.user.id },
    })

    if (!twoFactor) {
      return NextResponse.json({ error: '2FA non configuré pour cet utilisateur' }, { status: 400 })
    }

    // Verify the code
    const result = await verifyTotpCode(session.user.id, code)

    if (!result.valid) {
      return NextResponse.json(
        { error: result.error || 'Code invalide. Veuillez réessayer.' },
        { status: 400 }
      )
    }

    // Update session (mark as verified)
    await (session as any).update({ twoFactorVerified: true })

    return NextResponse.json({
      success: true,
      message: 'Vérification 2FA réussie',
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message }, { status: 400 })
    }

    console.error('2FA verification error:', error)
    return NextResponse.json({ error: 'Erreur lors de la vérification' }, { status: 500 })
  }
}
