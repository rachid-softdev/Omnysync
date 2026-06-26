/**
 * Route API: Réinitialiser le mot de passe
 * POST /api/auth/reset-password
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { resetPassword, validateResetToken } from '@omnysync/core/services/password-reset'
import { rateLimitRedisWithConfig } from '@/lib/rate-limit-redis'

const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Token requis'),
  password: z.string().min(8, 'Le mot de passe doit contenir au moins 8 caractères'),
})

export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
      request.headers.get('x-real-ip') ??
      'unknown'

    const rateResult = await rateLimitRedisWithConfig(
      `auth:reset-password:${ip}`,
      {
        max: 5,
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
    const { token, password } = resetPasswordSchema.parse(body)

    // Valider le token d'abord
    const validation = (await validateResetToken(token)) as any
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 })
    }

    const result = (await resetPassword(token, password)) as any

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      message: 'Mot de passe réinitialisé avec succès',
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message }, { status: 400 })
    }

    console.error('Reset password error:', error)
    return NextResponse.json({ error: 'Une erreur est survenue' }, { status: 500 })
  }
}
