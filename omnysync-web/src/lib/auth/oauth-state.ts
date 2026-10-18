import crypto from 'node:crypto'

/**
 * OAuth "state" helpers for the connector connect flows.
 *
 * The state is HMAC-signed with the application secret and bound to the user
 * who started the flow. Without a signature (or without checking the state at
 * all) an attacker can complete the flow with their own provider account and
 * trick a logged-in victim into linking the attacker's account to the victim's
 * organization (OAuth connect CSRF).
 */

const MAX_AGE_MS = 10 * 60 * 1000

function getSecret(): string {
  return process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET || ''
}

function sign(encodedPayload: string): string {
  return crypto.createHmac('sha256', getSecret()).update(encodedPayload).digest('base64url')
}

export function createOAuthState(userId: string): string {
  const payload = JSON.stringify({
    userId,
    nonce: crypto.randomUUID(),
    issuedAt: Date.now(),
  })
  const encoded = Buffer.from(payload).toString('base64url')

  return `${encoded}.${sign(encoded)}`
}

export function verifyOAuthState(state: string): { userId: string } | null {
  const [encoded, signature] = state.split('.')
  if (!encoded || !signature) {
    return null
  }

  const expected = sign(encoded)
  const provided = Buffer.from(signature)
  const computed = Buffer.from(expected)

  if (provided.length !== computed.length || !crypto.timingSafeEqual(provided, computed)) {
    return null
  }

  try {
    const decoded = JSON.parse(Buffer.from(encoded, 'base64url').toString())
    if (typeof decoded?.userId !== 'string' || typeof decoded?.issuedAt !== 'number') {
      return null
    }
    if (Date.now() - decoded.issuedAt > MAX_AGE_MS) {
      return null
    }
    return { userId: decoded.userId }
  } catch {
    return null
  }
}
