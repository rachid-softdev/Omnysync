/**
 * Route API: Mot de passe oublié
 * POST /api/auth/forgot-password
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createPasswordResetToken } from '@/lib/services/password-reset'
import { rateLimitRedisWithConfig } from '@/lib/rate-limit-redis'

const forgotPasswordSchema = z.object({
  email: z.string().email('Email invalide'),
})

export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
      request.headers.get('x-real-ip') ??
      'unknown'

    const rateResult = await rateLimitRedisWithConfig(
      `auth:forgot-password:${ip}`,
      {
        max: 3,
        windowMs: 60 * 60 * 1000, // 1 hour
      },
      request
    )

    if (!rateResult.allowed) {
      return NextResponse.json(
        { error: 'Trop de tentatives. Réessayez plus tard.' },
        { status: 429 }
      )
    }

    const body = await request.json()
    const { email } = forgotPasswordSchema.parse(body)

    const result = await createPasswordResetToken(email)

    // Toujours retourner succès pour éviter de révéler si l'email existe
    return NextResponse.json({
      success: true,
      message: result.message,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message }, { status: 400 })
    }

    console.error('Forgot password error:', error)
    return NextResponse.json({ error: 'Une erreur est survenue' }, { status: 500 })
  }
}
