/**
 * Route API: Suppression de compte utilisateur
 * DELETE /api/user
 */
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function DELETE(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const body = await request.json()
    const { confirmText } = body

    // Vérifier que l'utilisateur a tapé "SUPPRIMER" pour confirmer
    if (confirmText !== 'SUPPRIMER') {
      return NextResponse.json(
        { error: 'Veuillez taper SUPPRIMER pour confirmer' },
        { status: 400 }
      )
    }

    // Supprimer l'utilisateur (les relations en cascade supprimeront les données associées)
    await prisma.user.delete({
      where: { id: session.user.id },
    })

    return NextResponse.json({ success: true, message: 'Compte supprimé' })
  } catch (error) {
    console.error('DELETE user error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
