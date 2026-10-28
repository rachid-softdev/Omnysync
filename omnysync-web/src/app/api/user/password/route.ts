/**
 * Route API: Gestion du mot de passe utilisateur
 * PUT /api/user/password
 */
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { hashPassword, verifyPassword, validatePasswordStrength } from '@/lib/auth/password'
import { rateLimitRedisWithConfig } from '@/lib/rate-limit-redis'
import { z } from 'zod'

const passwordSchema = z.object({
  currentPassword: z.string().min(1, 'Mot de passe actuel requis'),
  newPassword: z.string().min(8, 'Nouveau mot de passe doit contenir au moins 8 caractères'),
})

export async function PUT(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    // Rate limiting: the current password must not be brute-forceable from an
    // authenticated session either.
    const rateResult = await rateLimitRedisWithConfig(
      `user:password:${session.user.id}`,
      { max: 5, windowMs: 60 * 1000 },
      request
    )

    if (!rateResult.allowed) {
      return NextResponse.json(
        { error: 'Trop de tentatives. Réessayez dans une minute.' },
        { status: 429 }
      )
    }

    const body = await request.json()
    const { currentPassword, newPassword } = passwordSchema.parse(body)

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { password: true },
    })

    if (!user) {
      return NextResponse.json({ error: 'Utilisateur introuvable' }, { status: 404 })
    }

    // OAuth-only accounts have no password to change.
    if (!user.password) {
      return NextResponse.json(
        {
          error:
            "Aucun mot de passe n'est défini pour ce compte (connexion via un fournisseur OAuth)",
        },
        { status: 400 }
      )
    }

    const isCurrentPasswordValid = await verifyPassword(currentPassword, user.password)
    if (!isCurrentPasswordValid) {
      return NextResponse.json({ error: 'Mot de passe actuel incorrect' }, { status: 400 })
    }

    const strength = validatePasswordStrength(newPassword)
    if (!strength.valid) {
      return NextResponse.json({ error: strength.errors.join(', ') }, { status: 400 })
    }

    const passwordHash = await hashPassword(newPassword)

    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        password: passwordHash,
        // Invalidate every JWT issued before this change. The auth callback
        // compares this timestamp with the token's copy on every access.
        passwordChangedAt: new Date(),
      },
    })

    return NextResponse.json({ success: true, message: 'Mot de passe mis à jour' })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message }, { status: 400 })
    }

    console.error('PUT password error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
