/**
 * Service d'authentification à deux facteurs (TOTP)
 * Utilise otpauth pour la génération et validation TOTP conformes RFC 6238
 */
import { prisma } from '@/lib/prisma'
import { encrypt, decrypt } from '@/lib/crypto'
import { randomBytes, createHash } from 'crypto'
import * as OTPAuth from 'otpauth'

/**
 * Génère un secret TOTP pour l'utilisateur (format Base32, compatible RFC 6238)
 */
export function generateTotpSecret(): { secret: string; otpauthUrl: string } {
  // Générer un secret TOTP avec otpauth pour garantir le format Base32 correct
  const secretObj = new OTPAuth.Secret({ size: 20 })
  const secret = secretObj.base32

  // URL pour les apps d'authentification (Google Authenticator, etc.)
  const totp = new OTPAuth.TOTP({
    secret: secretObj,
    issuer: 'Omnysync',
    label: 'Omnysync',
  })
  const otpauthUrl = totp.toString()

  return { secret, otpauthUrl }
}

/**
 * Configure le 2FA pour un utilisateur
 */
export async function setupTwoFactor(
  userId: string,
  secret: string
): Promise<{ success: boolean; backupCodes?: string[]; error?: string }> {
  // Générer les backup codes (10 codes de 8 caractères)
  const backupCodes = Array.from({ length: 10 }, () => randomBytes(4).toString('hex').toUpperCase())

  // Hasher les backup codes pour stockage sécurisé
  const hashedBackupCodes = backupCodes.map((code) =>
    createHash('sha256').update(code).digest('hex')
  )

  try {
    await prisma.twoFactorAuth.upsert({
      where: { userId },
      create: {
        userId,
        secret: encrypt(secret),
        backupCodes: hashedBackupCodes,
      },
      update: {
        secret: encrypt(secret),
        backupCodes: hashedBackupCodes,
      },
    })

    // Audit log
    const org = await prisma.userOrganization.findFirst({
      where: { userId, role: 'OWNER' },
      include: { organization: true },
    })

    if (org) {
      await prisma.auditLog.create({
        data: {
          organizationId: org.organizationId,
          userId,
          action: 'twofactor.enabled',
          targetType: 'user',
          targetId: userId,
        },
      })
    }

    return { success: true, backupCodes }
  } catch (error) {
    console.error('Failed to setup 2FA:', error)
    return { success: false, error: 'Échec de la configuration du 2FA' }
  }
}

/**
 * Vérifie un code TOTP
 */
export async function verifyTotpCode(
  userId: string,
  code: string
): Promise<{ valid: boolean; error?: string }> {
  const twoFactor = await prisma.twoFactorAuth.findUnique({
    where: { userId },
  })

  if (!twoFactor) {
    return { valid: false, error: '2FA non activé' }
  }

  // Vérifier d'abord les backup codes
  const codeHash = createHash('sha256').update(code.toUpperCase()).digest('hex')
  if (twoFactor.backupCodes.includes(codeHash)) {
    // Backup code utilisé - le supprimer
    await prisma.twoFactorAuth.update({
      where: { userId },
      data: {
        backupCodes: twoFactor.backupCodes.filter((c: string) => c !== codeHash),
      },
    })
    return { valid: true }
  }

  // Décrypter le secret et vérifier le code TOTP
  const secret = decrypt(twoFactor.secret)

  // Vérification TOTP avec otpauth (RFC 6238 compatible)
  const isValid = verifyTotp(secret, code)

  if (!isValid) {
    return { valid: false, error: 'Code invalide' }
  }

  return { valid: true }
}

/**
 * Vérifie un code TOTP (6 chiffres) contre un secret Base32
 * Utilise otpauth avec une fenêtre de +/- 1 pas (30s) pour tolérance
 */
function verifyTotp(secret: string, code: string): boolean {
  try {
    const totp = new OTPAuth.TOTP({
      secret: OTPAuth.Secret.fromBase32(secret),
      issuer: 'Omnysync',
      label: 'Omnysync',
    })

    // delta = 0 means exact match, null means invalid
    const delta = totp.validate({ token: code, window: 1 })
    return delta !== null
  } catch {
    return false
  }
}

/**
 * Désactive le 2FA — nécessite confirmation par mot de passe
 */
export async function disableTwoFactor(
  userId: string,
  password: string // Mot de passe requis pour confirmer la désactivation
): Promise<{ success: boolean; error?: string }> {
  const twoFactor = await prisma.twoFactorAuth.findUnique({
    where: { userId },
  })

  if (!twoFactor) {
    return { success: false, error: '2FA non activé' }
  }

  // Vérifier le mot de passe avant de désactiver le 2FA
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { password: true },
  })

  if (!user?.password) {
    return {
      success: false,
      error: 'Mot de passe non configuré. Utilisez OAuth pour vous connecter.',
    }
  }

  const { compare } = await import('bcrypt')
  const isValid = await compare(password, user.password)
  if (!isValid) {
    return { success: false, error: 'Mot de passe incorrect' }
  }

  // Supprimer le 2FA
  await prisma.twoFactorAuth.delete({
    where: { userId },
  })

  // Audit log
  const org = await prisma.userOrganization.findFirst({
    where: { userId, role: 'OWNER' },
    include: { organization: true },
  })

  if (org) {
    await prisma.auditLog.create({
      data: {
        organizationId: org.organizationId,
        userId,
        action: 'twofactor.disabled',
        targetType: 'user',
        targetId: userId,
      },
    })
  }

  return { success: true }
}

/**
 * Récupère le statut 2FA d'un utilisateur
 */
export async function getTwoFactorStatus(userId: string): Promise<{
  enabled: boolean
  enabledAt?: Date
}> {
  const twoFactor = await prisma.twoFactorAuth.findUnique({
    where: { userId },
    select: { enabledAt: true },
  })

  return {
    enabled: !!twoFactor,
    enabledAt: twoFactor?.enabledAt,
  }
}
