import { describe, it, expect } from 'vitest'
import { resolveRequestOrigin, toOrigin } from '@/lib/request-origin'

function makeRequest(
  headers: Record<string, string>,
  nextUrl: { origin: string; protocol: string } = {
    origin: 'http://localhost:3000',
    protocol: 'http:',
  }
) {
  const map = new Map(Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value]))
  return {
    headers: { get: (name: string) => map.get(name.toLowerCase()) ?? null },
    nextUrl,
  }
}

describe('resolveRequestOrigin', () => {
  it("utilise l'en-tete Host au lieu de nextUrl.origin", () => {
    const request = makeRequest({ host: '127.0.0.1:3101' })
    expect(resolveRequestOrigin(request)).toBe('http://127.0.0.1:3101')
  })

  it('prefere X-Forwarded-Host et X-Forwarded-Proto derriere un proxy', () => {
    const request = makeRequest({
      host: 'internal:3000',
      'x-forwarded-host': 'omnysync.app',
      'x-forwarded-proto': 'https',
    })
    expect(resolveRequestOrigin(request)).toBe('https://omnysync.app')
  })

  it("ne garde que la premiere valeur d'une chaine de proxies", () => {
    const request = makeRequest({
      host: 'internal:3000',
      'x-forwarded-host': 'omnysync.app, proxy.internal',
      'x-forwarded-proto': 'https, http',
    })
    expect(resolveRequestOrigin(request)).toBe('https://omnysync.app')
  })

  it('normalise le port HTTPS par defaut', () => {
    const request = makeRequest({
      host: 'omnysync.app:443',
      'x-forwarded-proto': 'https',
    })
    expect(resolveRequestOrigin(request)).toBe('https://omnysync.app')
  })

  it('retombe sur nextUrl.origin sans en-tete Host', () => {
    const request = makeRequest({})
    expect(resolveRequestOrigin(request)).toBe('http://localhost:3000')
  })
})

describe('toOrigin', () => {
  it('retourne null pour une valeur absente ou invalide', () => {
    expect(toOrigin(null)).toBeNull()
    expect(toOrigin('not a url')).toBeNull()
  })

  it('normalise une origine et supprime le port par defaut', () => {
    expect(toOrigin('https://omnysync.app:443/path')).toBe('https://omnysync.app')
  })
})
