/**
 * Route API: Suppression de compte utilisateur
 * DELETE /api/user
 *
 * Soft delete: the User row is kept (its `deletedAt` timestamp invalidates all
 * JWT sessions via the auth callback) so that organization-owned data the user
 * created (connectors, documents) is preserved for the other members of the
 * organization. Hard-deleting the row would cascade on `Connector.userId` and
 * `Document.userId` and destroy data belonging to the whole organization.
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

    const confirmText = request.nextUrl.searchParams.get('confirmText')

    // Vérifier que l'utilisateur a tapé "SUPPRIMER" pour confirmer
    if (confirmText !== 'SUPPRIMER') {
      return NextResponse.json(
        { error: 'Veuillez taper SUPPRIMER pour confirmer' },
        { status: 400 }
      )
    }

    const userId = session.user.id

    // Soft delete + PII scrub. The email is released so the address can be used
    // again by a new account; the row itself is kept for audit references.
    await prisma.user.update({
      where: { id: userId },
      data: {
        deletedAt: new Date(),
        email: null,
        emailVerified: null,
        name: null,
        image: null,
        password: null,
      },
    })

    // Revoke every authentication artifact.
    await prisma.session.deleteMany({ where: { userId } })
    await prisma.account.deleteMany({ where: { userId } })
    await prisma.twoFactorAuth.deleteMany({ where: { userId } })
    await prisma.passwordReset.deleteMany({ where: { userId } })
    await prisma.apiKey.deleteMany({ where: { userId } })

    // Leave the organization (organization-owned data is kept).
    await prisma.userOrganization.deleteMany({ where: { userId } })

    return NextResponse.json({ success: true, message: 'Compte supprimé' })
  } catch (error) {
    console.error('DELETE user error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
