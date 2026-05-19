/**
 * Route API: Gestion du mot de passe utilisateur
 * PUT /api/user/password
 */
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
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

    const body = await request.json()
    const { currentPassword, newPassword } = passwordSchema.parse(body)

    // Vérifier le mot de passe actuel
    // NOTE: Since we only have Google OAuth, we cannot verify the current password
    // This endpoint would need a proper password auth system to work

    // Pour l'instant, retourner un message indiquant que le système n'est pas configuré
    return NextResponse.json({
      error:
        "La modification de mot de passe nécessite un système d'authentification par mot de passe",
      requiresPasswordAuth: true,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 })
    }
    console.error('PUT password error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
