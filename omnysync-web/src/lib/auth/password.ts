/**
 * Utilitaires pour la gestion des mots de passe
 * Utilise bcrypt pour le hashage
 */
import { hash, compare } from 'bcrypt'

const ROUNDS = 12

/**
 * Hashe un mot de passe en texte clair
 * @param password - Le mot de passe à hasher
 * @returns Le hash du mot de passe
 */
export async function hashPassword(password: string): Promise<string> {
  return hash(password, ROUNDS)
}

/**
 * Vérifie si un mot de passe correspond à un hash
 * @param password - Le mot de passe en texte clair
 * @param hash - Le hash stocké en base de données
 * @returns true si les mots de passe correspondent
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return compare(password, hash)
}

/**
 * Valide laforce d'un mot de passe
 * @param password - Le mot de passe à valider
 * @returns { valid: boolean, errors: string[] }
 */
export function validatePasswordStrength(password: string): {
  valid: boolean
  errors: string[]
  warnings: string[]
} {
  const errors: string[] = []
  const warnings: string[] = []

  if (password.length < 8) {
    errors.push('Le mot de passe doit contenir au moins 8 caractères')
  }

  if (!/[A-Z]/.test(password)) {
    errors.push('Le mot de passe doit contenir au moins une majuscule')
  }

  if (!/[a-z]/.test(password)) {
    errors.push('Le mot de passe doit contenir au moins une minuscule')
  }

  if (!/[0-9]/.test(password)) {
    errors.push('Le mot de passe doit contenir au moins un chiffre')
  }

  // Le mot de passe est valide même sans caractère spécial
  // mais on peut ajouter une suggestion
  if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    warnings.push('Suggestion: ajoutez un caractère spécial pour plus de sécurité')
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  }
}
