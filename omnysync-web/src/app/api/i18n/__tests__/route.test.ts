import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// Mock translation files
vi.mock('@/lib/i18n/en.json', () => ({
  default: {
    nav_features: 'Features',
    'error.title': 'Something went wrong',
  },
}))

vi.mock('@/lib/i18n/fr.json', () => ({
  default: {
    nav_features: 'Fonctionnalités',
    'error.title': 'Une erreur est survenue',
  },
}))

import { GET } from '../route'

describe('GET /api/i18n', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns English translations by default', async () => {
    const request = new NextRequest('http://localhost:3000/api/i18n')
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data['nav_features']).toBe('Features')
  })

  it('returns English translations for en locale', async () => {
    const request = new NextRequest('http://localhost:3000/api/i18n?locale=en')
    const response = await GET(request)
    const data = await response.json()

    expect(data['nav_features']).toBe('Features')
  })

  it('returns French translations for fr locale', async () => {
    const request = new NextRequest('http://localhost:3000/api/i18n?locale=fr')
    const response = await GET(request)
    const data = await response.json()

    expect(data['nav_features']).toBe('Fonctionnalités')
  })

  it('falls back to English for unknown locale', async () => {
    const request = new NextRequest('http://localhost:3000/api/i18n?locale=de')
    const response = await GET(request)
    const data = await response.json()

    expect(data['nav_features']).toBe('Features')
  })

  it('returns all translation keys for a locale', async () => {
    const request = new NextRequest('http://localhost:3000/api/i18n?locale=en')
    const response = await GET(request)
    const data = await response.json()

    expect(data['error.title']).toBe('Something went wrong')
    expect(Object.keys(data).length).toBeGreaterThanOrEqual(2)
  })
})
