/**
 * Route API: Configuration 2FA
 * POST /api/auth/2fa/setup
 */
import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { generateTotpSecret, setupTwoFactor, getTwoFactorStatus } from "@/lib/services/two-factor"
import { z } from "zod"

const setupSchema = z.object({
  action: z.enum(["initiate", "verify", "cancel"]),
  code: z.string().optional(),
})

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 })
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
    console.error("2FA setup GET error:", error)
    return NextResponse.json(
      { error: "Une erreur est survenue" },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 })
    }

    const body = await request.json()
    const { action, code } = setupSchema.parse(body)

    if (action === "verify" && !code) {
      return NextResponse.json(
        { error: "Code de vérification requis" },
        { status: 400 }
      )
    }

    if (action === "initiate") {
      // Générer le secret pour l'initiation
      const { secret, otpauthUrl } = generateTotpSecret()
      
      // Stocker temporairement le secret en session (non implémenté ici)
      // En production, utiliser une session chiffrée ou Redis
      
      return NextResponse.json({
        secret,
        otpauthUrl,
        message: "Scannez ce code avec votre application d'authentification",
      })
    }

    if (action === "verify" && code) {
      // Ici, en production, vérifier le code avec le secret stocké temporairement
      // Pour l'instant, on simule la vérification
      
      // TODO: Implémenter la vérification réelle du code TOTP
      // const { secret } = getStoredSecret(session.user.id)
      // const isValid = await verifyTotp(secret, code)
      
      // Pour démo: accepter "123456" en développement
      const isValid = process.env.NODE_ENV === "development" && code === "123456"
      
      if (!isValid) {
        return NextResponse.json(
          { error: "Code invalide. Veuillez réessayer." },
          { status: 400 }
        )
      }

      // Configurer le 2FA
      // TODO: Utiliser le secret stocké
      const result = await setupTwoFactor(session.user.id, "DEMO_SECRET_" + Date.now())

      if (!result.success) {
        return NextResponse.json(
          { error: result.error },
          { status: 500 }
        )
      }

      return NextResponse.json({
        success: true,
        message: "2FA activé avec succès",
        backupCodes: result.backupCodes,
      })
    }

    return NextResponse.json(
      { error: "Action invalide" },
      { status: 400 }
    )
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 }
      )
    }

    console.error("2FA setup POST error:", error)
    return NextResponse.json(
      { error: "Une erreur est survenue" },
      { status: 500 }
    )
  }
}