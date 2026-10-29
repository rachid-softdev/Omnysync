import { describe, it, expect, vi } from 'vitest'

vi.mock('next/headers', () => ({
  headers: vi.fn(),
}))

import { buildPageMetadata } from '../metadata'

describe('buildPageMetadata', () => {
  it('builds English metadata with a canonical URL', () => {
    const metadata = buildPageMetadata({
      locale: 'en',
      titleKey: 'META_PRICING_TITLE',
      descriptionKey: 'META_PRICING_DESC',
      path: '/pricing',
    })

    expect(metadata.title).toBe('Pricing')
    expect(metadata.description).toBe(
      'Free, Pro and Business plans for content routing. Start free, scale when you grow.'
    )
    expect(String(metadata.alternates?.canonical)).toMatch(/\/pricing$/)
    expect(metadata.robots).toEqual({ index: true, follow: true })
  })

  it('builds French metadata', () => {
    const metadata = buildPageMetadata({
      locale: 'fr',
      titleKey: 'META_PRICING_TITLE',
      descriptionKey: 'META_PRICING_DESC',
      path: '/pricing',
    })

    expect(metadata.title).toBe('Tarifs')
    expect(metadata.description).toContain('offres Free')
  })

  it('marks private pages noindex and omits the canonical URL', () => {
    const metadata = buildPageMetadata({
      locale: 'fr',
      titleKey: 'META_DASHBOARD_TITLE',
      descriptionKey: 'META_DASHBOARD_DESC',
      path: '/dashboard',
      index: false,
    })

    expect(metadata.robots).toEqual({ index: false, follow: false })
    expect(metadata.alternates).toBeUndefined()
  })

  it('supports absolute titles for the homepage', () => {
    const metadata = buildPageMetadata({
      locale: 'fr',
      titleKey: 'META_HOME_TITLE',
      descriptionKey: 'META_HOME_DESC',
      path: '/',
      absoluteTitle: true,
    })

    expect(metadata.title).toEqual({
      absolute: 'Omnysync — Routage de contenu pour les éditeurs',
    })
  })
})
