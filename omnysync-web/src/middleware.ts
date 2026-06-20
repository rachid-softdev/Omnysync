import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { checkRateLimitRedis } from '@/lib/rate-limit-redis'

// 🔒 Liste des origines autorisées (CSRF protection)
const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',').map((o) => o.trim()) ?? []

/**
 * Ajoute les en-têtes de sécurité à une réponse.
 */
function addSecurityHeaders(response: NextResponse): void {
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
  response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload')
  // CSP en mode report — n'empêche rien mais signale les violations
  response.headers.set(
    'Content-Security-Policy-Report-Only',
    "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self' https:; font-src 'self'; frame-ancestors 'none'; form-action 'self'"
  )
}

/**
 * Crée une réponse d'erreur avec les en-têtes de sécurité.
 */
function createErrorResponse(status: number, error: string): NextResponse {
  const response = NextResponse.json({ error }, { status })
  addSecurityHeaders(response)
  return response
}

/**
 * Vérifie l'origine des requêtes state-changing (CSRF protection).
 * Retourne null si la requête est autorisée, ou une réponse 403 sinon.
 */
function checkCsrfOrigin(request: NextRequest): NextResponse | null {
  const method = request.method.toUpperCase()
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    return null // GET/HEAD/OPTIONS sont autorisés
  }

  // Les appels avec API key sont exemptés du CSRF check
  if (request.headers.get('x-api-key')) {
    return null
  }

  const origin = request.headers.get('origin')
  const referer = request.headers.get('referer')

  // Si Origin est présent, vérifier qu'il correspond
  if (origin) {
    const isLocalDev =
      process.env.NODE_ENV === 'development' &&
      (origin === 'http://localhost:3000' || origin === 'http://localhost:3001')

    if (isLocalDev) return null

    // Vérifier les origines autorisées
    const isAllowed = allowedOrigins.some((o) => origin.startsWith(o))
    // Vérifier la même origine (Next.js URL)
    const requestOrigin = request.nextUrl.origin
    const isSameOrigin = requestOrigin && origin.startsWith(requestOrigin)

    if (isAllowed || isSameOrigin) return null

    // Si Origin est présent mais ne correspond pas → bloquer
    return createErrorResponse(403, 'Origine non autorisée')
  }

  // Si Origin absent mais Referer présent, vérifier le Referer
  if (referer) {
    const isLocalDev =
      process.env.NODE_ENV === 'development' && referer.startsWith('http://localhost:3000')

    if (isLocalDev) return null

    const isAllowed = allowedOrigins.some((o) => referer.startsWith(o))

    if (isAllowed) return null

    return createErrorResponse(403, 'Référent non autorisé')
  }

  // Ni Origin ni Referer → autoriser (appels natifs / programmatiques)
  return null
}

/**
 * Global middleware for API security.
 *
 * 1. Security headers — applied to every response.
 * 2. CSRF origin validation — for state-changing requests.
 * 3. Rate limiting — Redis-backed with in-memory fallback (API only).
 */
export async function middleware(request: NextRequest): Promise<NextResponse> {
  // ── 1. CSRF check (avant tout, pour les requêtes state-changing) ──────
  const csrfResponse = checkCsrfOrigin(request)
  if (csrfResponse) return csrfResponse

  // ── 2. Rate limiting (API routes only) ────────────────────────────────
  let response: NextResponse

  if (request.nextUrl.pathname.startsWith('/api/')) {
    const rateLimitResponse = await checkRateLimitRedis(request)
    if (rateLimitResponse) {
      response = rateLimitResponse // 429 Too Many Requests
    } else {
      response = NextResponse.next()
    }
  } else {
    response = NextResponse.next()
  }

  // ── 3. Security headers ──────────────────────────────────────────────
  addSecurityHeaders(response)

  return response
}

// Match all routes to apply security headers everywhere
export const config = {
  matcher: '/(.*)',
}
