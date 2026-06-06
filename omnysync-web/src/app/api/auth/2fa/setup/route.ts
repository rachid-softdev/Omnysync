/**
 * Route API: Configuration 2FA
 * POST /api/auth/2fa/setup
 */
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { generateTotpSecret, setupTwoFactor, getTwoFactorStatus } from '@/lib/services/two-factor'
import * as OTPAuth from 'otpauth'
import { z } from 'zod'

// Stockage temporaire des secrets 2FA en mémoire
// En production, utiliser Redis ou une session chiffrée
const pendingSecrets = new Map<string, { secret: string; expiresAt: Date }>()
// Nettoyer les secrets expirés toutes les 5 minutes
setInterval(
  () => {
    const now = new Date()
    for (const [key, value] of pendingSecrets) {
      if (value.expiresAt < now) pendingSecrets.delete(key)
    }
  },
  5 * 60 * 1000
)

const setupSchema = z.object({
  action: z.enum(['initiate', 'verify', 'cancel']),
  code: z.string().optional(),
})

export async function GET(_request: NextRequest) {
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
    const { secret, otpauthUrl } = generateTotpSecret()

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

    const body = await request.json()
    const { action, code } = setupSchema.parse(body)

    if (action === 'verify' && !code) {
      return NextResponse.json({ error: 'Code de vérification requis' }, { status: 400 })
    }

    if (action === 'initiate') {
      // Générer le secret pour l'initiation
      const { secret, otpauthUrl } = generateTotpSecret()

      // Stocker le secret temporairement (expire dans 10 minutes)
      pendingSecrets.set(session.user.id, {
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

      if (pending.expiresAt < new Date()) {
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
        secret: OTPAuth.Secret.fromBase32(pending.secret),
        issuer: 'Omnysync',
        label: 'Omnysync',
      })

      const delta = totp.validate({ token: code, window: 1 })
      if (delta === null) {
        return NextResponse.json({ error: 'Code invalide. Veuillez réessayer.' }, { status: 400 })
      }

      // Configurer le 2FA avec le vrai secret vérifié
      const result = await setupTwoFactor(session.user.id, pending.secret)
      pendingSecrets.delete(session.user.id) // Nettoyer

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
