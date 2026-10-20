import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { checkRateLimitRedis } from '@/lib/rate-limit-redis'
import { resolveRequestOrigin, toOrigin } from '@/lib/request-origin'

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

// Exact origin comparison: a prefix match would accept
// `https://app.omnysync.com.evil.com` as a trusted origin.
function isTrustedOrigin(value: string | null, requestOrigin: string): boolean {
  const origin = toOrigin(value)
  if (!origin) return false

  const isLocalDev =
    process.env.NODE_ENV === 'development' &&
    (origin === 'http://localhost:3000' || origin === 'http://localhost:3001')

  if (isLocalDev) return true

  if (origin === requestOrigin) return true

  return allowedOrigins.some((allowed) => toOrigin(allowed) === origin)
}

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
  const requestOrigin = resolveRequestOrigin(request)

  // Si Origin est présent, il doit correspondre exactement.
  if (origin) {
    if (isTrustedOrigin(origin, requestOrigin)) return null

    return createErrorResponse(403, 'Origine non autorisée')
  }

  // Si Origin absent mais Referer présent, appliquer la même règle.
  if (referer) {
    if (isTrustedOrigin(referer, requestOrigin)) return null

    return createErrorResponse(403, 'Référent non autorisé')
  }

  // Ni Origin ni Referer: autoriser (appels natifs / programmatiques)
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
  const { pathname } = request.nextUrl

  // ── 0. Dev-only routes: block /dev/* in production ────────────────────
  if (
    process.env.NODE_ENV === 'production' &&
    (pathname === '/dev' || pathname.startsWith('/dev/'))
  ) {
    return NextResponse.rewrite(new URL('/404', request.url))
  }

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
