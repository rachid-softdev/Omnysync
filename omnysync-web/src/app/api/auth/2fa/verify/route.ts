/**
 * Route API: Vérification 2FA
 * POST /api/auth/2fa/verify
 */
import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { verifyTotpCode } from "@/lib/services/two-factor"
import { z } from "zod"

const verifySchema = z.object({
  code: z.string().min(6, "Code invalide").max(6),
})

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 })
    }

    const body = await request.json()
    const { code } = verifySchema.parse(body)

    // Get user's 2FA configuration
    const twoFactor = await prisma.twoFactorAuth.findUnique({
      where: { userId: session.user.id },
    })

    if (!twoFactor) {
      return NextResponse.json(
        { error: "2FA non configuré pour cet utilisateur" },
        { status: 400 }
      )
    }

    // Verify the code
    const isValid = await verifyTotpCode(twoFactor.secret, code)

    if (!isValid) {
      // Increment failed attempts (could add lockout logic here)
      return NextResponse.json(
        { error: "Code invalide. Veuillez réessayer." },
        { status: 400 }
      )
    }

    // Update session (mark as verified)
    // The session will automatically include the verified status due to our callback

    return NextResponse.json({
      success: true,
      message: "Vérification 2FA réussie",
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      )
    }

    console.error("2FA verification error:", error)
    return NextResponse.json(
      { error: "Erreur lors de la vérification" },
      { status: 500 }
    )
  }
}