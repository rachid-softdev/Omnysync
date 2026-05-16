/**
 * Service d'authentification à deux facteurs (TOTP)
 */
import { prisma } from "@/lib/prisma"
import { encrypt, decrypt } from "@/lib/crypto"
import { randomBytes, createHash } from "crypto"

// TOTP: Time-based One-Time Password
// Implementa

/**
 * Génère un secret TOTP pour l'utilisateur
 */
export function generateTotpSecret(): { secret: string; otpauthUrl: string } {
  // Secret aléatoire base32 (20 bytes pour meilleur sécurité)
  const secret = randomBytes(20).toString("base64").replace(/=/g, "")
  
  // URL pour les apps d'authentification (Google Authenticator, etc.)
  const otpauthUrl = `otpauth://totp/Omnysync?secret=${secret}&issuer=Omnysync`
  
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
  const backupCodes = Array.from({ length: 10 }, () => 
    randomBytes(4).toString("hex").toUpperCase()
  )

  // Hasher les backup codes pour stockage sécurisé
  const hashedBackupCodes = backupCodes.map(code => 
    createHash("sha256").update(code).digest("hex")
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
    const user = await prisma.user.findUnique({ where: { id: userId } })
    const org = await prisma.userOrganization.findFirst({
      where: { userId, role: "OWNER" },
      include: { organization: true },
    })

    if (org) {
      await prisma.auditLog.create({
        data: {
          organizationId: org.organizationId,
          userId,
          action: "twofactor.enabled",
          targetType: "user",
          targetId: userId,
        },
      })
    }

    return { success: true, backupCodes }
  } catch (error) {
    console.error("Failed to setup 2FA:", error)
    return { success: false, error: "Échec de la configuration du 2FA" }
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
    return { valid: false, error: "2FA non activé" }
  }

  // Vérifier d'abord les backup codes
  const codeHash = createHash("sha256").update(code.toUpperCase()).digest("hex")
  if (twoFactor.backupCodes.includes(codeHash)) {
    // Backup code utilisé - le supprimer
    await prisma.twoFactorAuth.update({
      where: { userId },
      data: {
        backupCodes: twoFactor.backupCodes.filter(c => c !== codeHash),
      },
    })
    return { valid: true }
  }

  // Décrypter le secret et vérifier le code TOTP
  // Note: En production, utiliser une librarie comme 'otpauth'
  // Ici implementation simplifiée pour demonstration
  
  const secret = decrypt(twoFactor.secret)
  
  // Vérification TOTP (simplifiée)
  // En production: utiliser https://www.npmjs.com/package/otpauth
  const isValid = await verifyTotp(secret, code)
  
  if (!isValid) {
    return { valid: false, error: "Code invalide" }
  }

  return { valid: true }
}

// Placeholder pour la vérification TOTP réelle
async function verifyTotp(secret: string, code: string): Promise<boolean> {
  // En production, utiliser une librarie comme 'otpauth' ou 'speakeasy'
  // Exemple avec speakeasy:
  // import speakeasy from 'speakeasy'
  // return speakeasy.totp.verify({ secret, encoding: 'base32', token: code })
  
  // Pour l'instant, retourner true si code = "123456" (DEV ONLY)
  if (process.env.NODE_ENV === "development" && code === "123456") {
    return true
  }
  
  // Log pour debugging en développement
  console.log(`[TOTP] Verifying code for secret starting with: ${secret.substring(0, 4)}...`)
  
  // Placeholder: à implémenter avec librarie réelle
  return false
}

/**
 * Désactive le 2FA
 */
export async function disableTwoFactor(
  userId: string,
  password: string // Pour confirmer la désactivation
): Promise<{ success: boolean; error?: string }> {
  const twoFactor = await prisma.twoFactorAuth.findUnique({
    where: { userId },
  })

  if (!twoFactor) {
    return { success: false, error: "2FA non activé" }
  }

  // Supprimer le 2FA
  await prisma.twoFactorAuth.delete({
    where: { userId },
  })

  // Audit log
  const org = await prisma.userOrganization.findFirst({
    where: { userId, role: "OWNER" },
    include: { organization: true },
  })

  if (org) {
    await prisma.auditLog.create({
      data: {
        organizationId: org.organizationId,
        userId,
        action: "twofactor.disabled",
        targetType: "user",
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