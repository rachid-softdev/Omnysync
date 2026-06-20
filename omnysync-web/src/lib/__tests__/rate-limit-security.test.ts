/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Tests de sécurité pour le rate limiting
 *
 * Couvre :
 *   - isValidIp : validation syntaxique IPv4/IPv6
 *   - getClientIp : rejet des IPs forgées / spoofées
 *   - Protection contre le bypass via x-forwarded-for falsifié
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// On importe les fonctions réelles (pas mockées) depuis le module source

let mod: any = null
async function getModule() {
  if (!mod) {
    mod = await import('@/lib/rate-limit')
  }
  return mod
}

function createMockRequest(headers: Record<string, string> = {}): NextRequest {
  const headerMap = new Map(Object.entries(headers))
  return {
    headers: {
      get: (name: string) => headerMap.get(name) ?? null,
      has: (name: string) => headerMap.has(name),
    },
    url: 'http://localhost:3000/api/test',
    nextUrl: { pathname: '/api/test', search: '' },
    method: 'GET',
  } as unknown as NextRequest
}

describe('isValidIp', () => {
  it('valide une IPv4 standard', async () => {
    const { isValidIp } = await getModule()
    expect(isValidIp('192.168.1.1')).toBe(true)
  })

  it('valide 0.0.0.0', async () => {
    const { isValidIp } = await getModule()
    expect(isValidIp('0.0.0.0')).toBe(true)
  })

  it('valide 255.255.255.255', async () => {
    const { isValidIp } = await getModule()
    expect(isValidIp('255.255.255.255')).toBe(true)
  })

  it('rejette une valeur non-IP (texte arbitraire)', async () => {
    const { isValidIp } = await getModule()
    // Si un attaquant met "evil-script" dans x-forwarded-for, ça doit être rejeté
    expect(isValidIp('evil-script')).toBe(false)
  })

  it("rejette une IP avec des lettres dans l'octet", async () => {
    const { isValidIp } = await getModule()
    expect(isValidIp('192.168.abc.1')).toBe(false)
  })

  it('rejette un nombre seul', async () => {
    const { isValidIp } = await getModule()
    expect(isValidIp('12345')).toBe(false)
  })

  it('rejette une chaîne vide', async () => {
    const { isValidIp } = await getModule()
    expect(isValidIp('')).toBe(false)
  })

  it('rejette une valeur avec espaces seulement', async () => {
    const { isValidIp } = await getModule()
    expect(isValidIp('   ')).toBe(false)
  })

  it('rejette 999.999.999.999 (hors plage)', async () => {
    const { isValidIp } = await getModule()
    expect(isValidIp('999.999.999.999')).toBe(false)
  })

  it('valide une IPv6 standard', async () => {
    const { isValidIp } = await getModule()
    expect(isValidIp('2001:0db8:85a3:0000:0000:8a2e:0370:7334')).toBe(true)
  })

  it('rejette une IPv6 tronquée', async () => {
    const { isValidIp } = await getModule()
    expect(isValidIp('2001:db8::1')).toBe(false) // forme abrégée non supportée ici
  })
})

describe('getClientIp — protection anti-spoofing', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("extrait l'IP valide depuis x-forwarded-for", async () => {
    const { getClientIp } = await getModule()
    const req = createMockRequest({ 'x-forwarded-for': '10.0.0.1, 192.168.1.1' })
    expect(getClientIp(req)).toBe('10.0.0.1')
  })

  it('rejette x-forwarded-for forgé avec du texte', async () => {
    const { getClientIp } = await getModule()
    // Attaquant essaie de spoof son IP avec une valeur arbitraire
    const req = createMockRequest({ 'x-forwarded-for': 'hack-me-please' })
    // Doit ignorer le header invalide et tomber sur unknown
    expect(getClientIp(req)).toBe('unknown')
  })

  it('rejette x-forwarded-for forgé avec des caractères spéciaux', async () => {
    const { getClientIp } = await getModule()
    const req = createMockRequest({ 'x-forwarded-for': '<script>alert(1)</script>' })
    expect(getClientIp(req)).toBe('unknown')
  })

  it('rejette x-forwarded-for avec IP invalide mais tombe sur x-real-ip valide', async () => {
    const { getClientIp } = await getModule()
    const req = createMockRequest({
      'x-forwarded-for': '999.999.999.999',
      'x-real-ip': '10.0.0.5',
    })
    expect(getClientIp(req)).toBe('10.0.0.5')
  })

  it('rejette x-forwarded-for et x-real-ip invalides mais tombe sur cf-connecting-ip', async () => {
    const { getClientIp } = await getModule()
    const req = createMockRequest({
      'x-forwarded-for': 'not-an-ip',
      'x-real-ip': 'also-fake',
      'cf-connecting-ip': '10.0.0.9',
    })
    expect(getClientIp(req)).toBe('10.0.0.9')
  })

  it('retourne unknown si tous les headers sont invalides', async () => {
    const { getClientIp } = await getModule()
    const req = createMockRequest({
      'x-forwarded-for': 'evil',
      'x-real-ip': 'hacker',
      'cf-connecting-ip': 'bad',
    })
    expect(getClientIp(req)).toBe('unknown')
  })

  it('préfère x-forwarded-for valide même si x-real-ip est présent', async () => {
    const { getClientIp } = await getModule()
    const req = createMockRequest({
      'x-forwarded-for': '10.0.0.99',
      'x-real-ip': '10.0.0.1',
    })
    expect(getClientIp(req)).toBe('10.0.0.99')
  })

  it("retourne unknown si aucun header IP n'est présent", async () => {
    const { getClientIp } = await getModule()
    const req = createMockRequest({})
    expect(getClientIp(req)).toBe('unknown')
  })
})
