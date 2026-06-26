/**
 * Route API: Configuration 2FA
 * POST /api/auth/2fa/setup
 */
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { rateLimitRedisWithConfig } from '@/lib/rate-limit-redis'
import {
  generateTotpSecret,
  setupTwoFactor,
  getTwoFactorStatus,
  pendingSecrets,
} from '@omnysync/core/services/two-factor'
import * as OTPAuth from 'otpauth'
import { z } from 'zod'

const setupSchema = z.object({
  action: z.enum(['initiate', 'verify', 'cancel']),
  code: z.string().optional(),
})

export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    // Vérifier le statut actuel du 2FA
    const status = await getTwoFactorStatus(session.user.id)

    if (status.enabled) {
      return NextResponse.json({
        enabled: true,
        enabledAt: status.enabledAt,
      })
    }

    // Générer un nouveau secret
    const { secret, otpauthUrl } = await generateTotpSecret(session.user.id)

    return NextResponse.json({
      enabled: false,
      secret,
      otpauthUrl,
    })
  } catch (error) {
    console.error('2FA setup GET error:', error)
    return NextResponse.json({ error: 'Une erreur est survenue' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    // Rate limiting: 10 tentatives par minute par IP
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
      request.headers.get('x-real-ip') ??
      'unknown'

    const rateResult = await rateLimitRedisWithConfig(
      `2fa:setup:${ip}`,
      { max: 10, windowMs: 60000 },
      request
    )

    if (!rateResult.allowed) {
      return NextResponse.json(
        { error: 'Trop de tentatives. Réessayez dans une minute.' },
        { status: 429 }
      )
    }

    const body = await request.json()
    const { action, code } = setupSchema.parse(body)

    if (action === 'verify' && !code) {
      return NextResponse.json({ error: 'Code de vérification requis' }, { status: 400 })
    }

    if (action === 'initiate') {
      // Générer le secret pour l'initiation
      const { secret, otpauthUrl } = await generateTotpSecret(session.user.id)

      // Stocker le secret temporairement (expire dans 10 minutes)
      ;(pendingSecrets as any).set(session.user.id, {
        secret,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      })

      return NextResponse.json({
        secret,
        otpauthUrl,
        message: "Scannez ce code avec votre application d'authentification",
      })
    }

    if (action === 'verify' && code) {
      // Récupérer le secret stocké lors de l'initiation
      const pending = pendingSecrets.get(session.user.id)
      if (!pending) {
        return NextResponse.json(
          {
            error: 'Session expirée. Veuillez recommencer la configuration du 2FA.',
          },
          { status: 400 }
        )
      }

      const pendingData = pending as any
      if (pendingData.expiresAt < new Date()) {
        pendingSecrets.delete(session.user.id)
        return NextResponse.json(
          {
            error: 'Session expirée. Veuillez recommencer la configuration du 2FA.',
          },
          { status: 400 }
        )
      }

      // Vérifier le code TOTP avec le secret stocké
      const totp = new OTPAuth.TOTP({
        secret: OTPAuth.Secret.fromBase32(pendingData.secret),
        issuer: 'Omnysync',
        label: 'Omnysync',
      })

      const delta = totp.validate({ token: code, window: 1 })
      if (delta === null) {
        return NextResponse.json({ error: 'Code invalide. Veuillez réessayer.' }, { status: 400 })
      }

      // Configurer le 2FA avec le vrai secret vérifié
      // Le nettoyage de pendingSecrets est géré par setupTwoFactor (finally)
      const result = await setupTwoFactor(session.user.id, pendingData.secret)

      if (!result.success) {
        return NextResponse.json({ error: result.error }, { status: 500 })
      }

      return NextResponse.json({
        success: true,
        message: '2FA activé avec succès',
        backupCodes: result.backupCodes,
      })
    }

    return NextResponse.json({ error: 'Action invalide' }, { status: 400 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message }, { status: 400 })
    }

    console.error('2FA setup POST error:', error)
    return NextResponse.json({ error: 'Une erreur est survenue' }, { status: 500 })
  }
}
