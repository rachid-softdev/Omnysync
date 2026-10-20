import { NextRequest, NextResponse } from 'next/server'

export const RATE_LIMIT_WINDOW_MS = 60 * 1000 // 1 minute
export const RATE_LIMIT_MAX = 30 // requests per window

interface RateLimitRecord {
  count: number
  resetTime: number
}

// In-memory rate limit store with automatic cleanup
const rateLimitMap = new Map<string, RateLimitRecord>()

// Timer reference for cleanup interval
let cleanupInterval: ReturnType<typeof setInterval> | null = null

// IPv4 pattern: quatre octets séparés par des points (0-255)
const IPV4_PATTERN = /^(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)$/

/**
 * Valide une adresse IPv6, y compris les formes compressées (`::1`,
 * `2001:db8::1`) et les suffixes IPv4 embarqués (`::ffff:192.0.2.1`).
 *
 * L'ancienne regex à huit groupes fixes rejetait toutes les formes
 * compressées : la boucle locale `::1` et les clients IPv6 réels tombaient
 * alors sur la clé partagée "unknown", ce qui faussait le rate limiting.
 */
function isValidIpv6(ip: string): boolean {
  // L'identifiant de zone (ex. fe80::1%eth0) ne fait pas partie de l'adresse
  const zoneIndex = ip.indexOf('%')
  let address = zoneIndex === -1 ? ip : ip.slice(0, zoneIndex)
  if (!address.includes(':')) return false

  // Un suffixe IPv4 (ex. ::ffff:192.0.2.1) compte pour deux groupes
  const ipv4Suffix = address.match(/(\d{1,3}(?:\.\d{1,3}){3})$/)
  const ipv4Tail = ipv4Suffix?.[1]
  if (ipv4Tail) {
    if (!IPV4_PATTERN.test(ipv4Tail)) return false
    address = address.slice(0, -ipv4Tail.length) + '0:0'
  }

  const halves = address.split('::')
  if (halves.length > 2) return false

  const groups = [
    ...(halves[0] ? halves[0].split(':') : []),
    ...(halves[1] ? halves[1].split(':') : []),
  ]
  if (!groups.every((group) => /^[0-9a-fA-F]{1,4}$/.test(group))) return false

  // "::" remplace au moins un groupe nul
  return halves.length === 2 ? groups.length <= 7 : groups.length === 8
}

/**
 * Valide une adresse IPv4 ou IPv6.
 * Retourne true si l'adresse est syntaxiquement valide.
 */
export function isValidIp(ip: string): boolean {
  return IPV4_PATTERN.test(ip) || isValidIpv6(ip)
}

/**
 * Extract client IP from request headers.
 *
 * 🔒 Sécurité : valide que l'IP extraite est une adresse IP valide.
 * Si x-forwarded-for contient une valeur invalide (tentative de spoofing),
 * on ignore ce header et on passe au suivant.
 */
export function getClientIp(request: NextRequest): string {
  // Check various headers for client IP
  const forwarded = request.headers.get('x-forwarded-for')
  const realIp = request.headers.get('x-real-ip')
  const cfIp = request.headers.get('cf-connecting-ip')

  // x-forwarded-for peut contenir plusieurs IPs (proxy chain), prendre la première
  if (forwarded) {
    const firstIp = forwarded.split(',')[0]!.trim()
    // 🔒 Valider que c'est une IP légitime — rejeter les valeurs forgées
    if (isValidIp(firstIp)) {
      return firstIp
    }
    // Si invalide, logger et continuer vers les headers suivants
    console.warn(`[RATE-LIMIT] Rejet x-forwarded-for invalide: "${firstIp}"`)
  }

  // Fallback vers x-real-ip ou cf-connecting-ip avec validation
  if (realIp && isValidIp(realIp)) return realIp
  if (cfIp && isValidIp(cfIp)) return cfIp

  return 'unknown'
}

/**
 * Prune expired entries from the rate limit map
 * Call this periodically to prevent memory leaks
 */
export function pruneRateLimitEntries(): number {
  const now = Date.now()
  let prunedCount = 0

  for (const [ip, record] of rateLimitMap.entries()) {
    if (now > record.resetTime) {
      rateLimitMap.delete(ip)
      prunedCount++
    }
  }

  return prunedCount
}

/**
 * Start automatic cleanup of expired rate limit entries
 * Called once on first use, then runs every 5 minutes
 */
export function startRateLimitCleanup(): void {
  if (cleanupInterval) return

  // Initial cleanup
  pruneRateLimitEntries()

  // Run cleanup every 5 minutes
  cleanupInterval = setInterval(
    () => {
      pruneRateLimitEntries()
    },
    5 * 60 * 1000
  )
}

/**
 * Stop automatic cleanup (mainly for testing)
 */
export function stopRateLimitCleanup(): void {
  if (cleanupInterval) {
    clearInterval(cleanupInterval)
    cleanupInterval = null
  }
}

/**
 * Core rate limit check function
 * Returns the result with current state
 */
export function rateLimit(request: NextRequest): { allowed: boolean; remainingTime?: number } {
  const ip = getClientIp(request)
  const now = Date.now()

  // Ensure cleanup is running
  startRateLimitCleanup()

  const record = rateLimitMap.get(ip)

  // No record or expired - reset
  if (!record || now > record.resetTime) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS })
    return { allowed: true }
  }

  // Rate limit exceeded
  if (record.count >= RATE_LIMIT_MAX) {
    return { allowed: false, remainingTime: record.resetTime - now }
  }

  record.count++
  return { allowed: true }
}

/**
 * Create a 429 Too Many Requests response
 */
export function createRateLimitResponse(remainingTime: number): NextResponse {
  const retryAfter = Math.ceil((remainingTime || 1000) / 1000)
  return NextResponse.json(
    { error: 'Too many requests', message: 'Rate limit exceeded. Please try again later.' },
    {
      status: 429,
      headers: {
        'Retry-After': String(retryAfter),
        'X-RateLimit-Limit': String(RATE_LIMIT_MAX),
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': String(Date.now() + remainingTime),
      },
    }
  )
}

/**
 * Middleware wrapper for API routes
 * Returns the response if allowed, or 429 if rate limited
 */
export function checkRateLimit(request: NextRequest): NextResponse | null {
  const result = rateLimit(request)

  if (!result.allowed) {
    return createRateLimitResponse(result.remainingTime || RATE_LIMIT_WINDOW_MS)
  }

  return null
}

/**
 * Higher-order function to wrap API handlers with rate limiting
 * Usage: export const GET = withRateLimit(GET)
 */
export function withRateLimit<T extends (req: NextRequest) => Promise<NextResponse>>(
  handler: T
): T {
  return async function (req: NextRequest): Promise<NextResponse> {
    const rateLimitResult = rateLimit(req)

    if (!rateLimitResult.allowed) {
      return createRateLimitResponse(rateLimitResult.remainingTime || RATE_LIMIT_WINDOW_MS)
    }

    return handler(req)
  } as T
}
