import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import Home from '../page'

const { translations } = vi.hoisted(() => ({
  translations: {
    hero_badge: 'One draft, one destination',
    hero_headline: 'Sync your content',
    hero_tagline: 'one destination at a time',
    hero_subtitle: 'Route a draft to the CMS you publish with.',
    hero_cta_primary: 'Start Free',
    hero_cta_secondary: 'See capabilities',
    hero_no_credit_card: 'No credit card required',
    hero_index: '01 / Content routing',
    hero_stat: '4 sources · 5 destinations',
    routing_console: 'Routing console',
    hero_platforms: 'Works with your favorite platforms',
    features_title: 'Everything you need',
    features_subtitle: 'Powerful features for content creators.',
    feature_analytics_title: 'Analytics',
    feature_analytics_desc: 'Track performance.',
    feature_scheduling_title: 'Scheduling',
    feature_scheduling_desc: 'Schedule your content.',
    how_it_works_title: 'How it works',
    how_it_works_subtitle: 'Get started in minutes.',
    step_1_title: 'Connect',
    step_1_desc: 'Connect your platforms.',
    step_2_title: 'Configure',
    step_2_desc: 'Set up your sync rules.',
    step_3_title: 'Sync',
    step_3_desc: 'Publish everywhere.',
    cta_final_button: 'Get Started Free',
    cta_section_title: 'Ready to sync?',
    cta_section_subtitle: 'Start your free trial today.',
    footer_privacy: 'Privacy',
    footer_terms: 'Terms',
    footer_copyright: '© 2026 Omnysync',
    nav_pricing: 'Pricing',
  } as Record<string, string>,
}))

vi.mock('@/lib/i18n', () => {
  const translate = (key: string) => translations[key] || key
  return {
    t: translate,
    // The page resolves its locale per request; the mock keeps the same strings.
    getT: async () => translate,
    getLocaleFromHeaders: () => 'en',
  }
})

vi.mock('@/lib/i18n/useTranslations', () => ({
  useTranslations: vi.fn(() => ({
    t: (key: string) => key,
    loading: false,
    locale: 'en',
  })),
}))

describe('Home page', () => {
  it('renders hero section with a truthful route claim', async () => {
    render(await Home())
    expect(screen.getByText('Sync your content')).toBeInTheDocument()
    expect(screen.getByText('one destination at a time')).toBeInTheDocument()
    expect(screen.getAllByText('4 sources · 5 destinations').length).toBeGreaterThan(0)
  })

  it('renders CTA buttons', async () => {
    render(await Home())
    expect(screen.getByText('Start Free')).toBeInTheDocument()
    expect(screen.getByText('See capabilities')).toBeInTheDocument()
  })

  it('renders only implemented feature claims', async () => {
    render(await Home())
    expect(screen.getByText('Everything you need')).toBeInTheDocument()
    expect(screen.getAllByText('Analytics').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Scheduling').length).toBeGreaterThan(0)
    expect(screen.queryByText('Two-Way Sync')).not.toBeInTheDocument()
  })

  it('renders how it works section', async () => {
    render(await Home())
    expect(screen.getByText('How it works')).toBeInTheDocument()
    expect(screen.getByText('Connect')).toBeInTheDocument()
    expect(screen.getByText('Configure')).toBeInTheDocument()
    expect(screen.getByText('Sync')).toBeInTheDocument()
  })

  it('renders platform logos', async () => {
    render(await Home())
    for (const platform of ['WordPress', 'Ghost', 'Webflow', 'Shopify', 'Notion']) {
      expect(screen.getAllByText(platform).length).toBeGreaterThan(0)
    }
  })

  it('does not render the unverified multi-destination demo video', async () => {
    const { container } = render(await Home())

    expect(container.querySelector('#demo')).toBeNull()
    expect(container.querySelector('video')).toBeNull()
  })

  it('renders footer with links', async () => {
    render(await Home())
    expect(screen.getByText('Privacy')).toBeInTheDocument()
    expect(screen.getByText('Terms')).toBeInTheDocument()
    expect(screen.getByText('© 2026 Omnysync')).toBeInTheDocument()
  })
})
