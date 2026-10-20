import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import Home from '../page'

const { translations } = vi.hoisted(() => ({
  translations: {
    hero_badge: 'Publish once, everywhere',
    hero_headline: 'Sync your content',
    hero_tagline: 'everywhere, automatically',
    hero_subtitle: 'Publish once, sync to all your platforms.',
    hero_cta_primary: 'Start Free',
    hero_cta_secondary: 'See how it works',
    hero_no_credit_card: 'No credit card required',
    hero_index: '01 / Content routing',
    hero_stat: '5 sources · 20 destinations',
    routing_console: 'Routing console',
    hero_platforms: 'Works with your favorite platforms',
    demo_eyebrow: 'Product tour',
    demo_title: 'See Omnysync in action',
    demo_subtitle: 'Watch a real sync.',
    demo_play: 'Play demo',
    demo_pause: 'Pause demo',
    demo_silent: 'Silent demo',
    demo_video_label: 'Product demo video',
    demo_fallback: 'Download the video',
    features_title: 'Everything you need',
    features_subtitle: 'Powerful features for content creators.',
    feature_two_way_title: 'Two-Way Sync',
    feature_two_way_desc: 'Bidirectional synchronization.',
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
  it('renders hero section', async () => {
    render(await Home())
    expect(screen.getByText('Sync your content')).toBeInTheDocument()
    expect(screen.getByText('everywhere, automatically')).toBeInTheDocument()
  })

  it('renders CTA buttons', async () => {
    render(await Home())
    expect(screen.getByText('Start Free')).toBeInTheDocument()
    expect(screen.getByText('See how it works')).toBeInTheDocument()
  })

  it('renders features section', async () => {
    render(await Home())
    expect(screen.getByText('Everything you need')).toBeInTheDocument()
    // Some labels also appear in the product mockup, so assert presence rather than uniqueness.
    expect(screen.getAllByText('Two-Way Sync').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Analytics').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Scheduling').length).toBeGreaterThan(0)
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

  it('renders product demo section', async () => {
    const { container } = render(await Home())
    const demo = container.querySelector('#demo')

    expect(demo).not.toBeNull()
    expect(screen.getByText('Product tour')).toBeInTheDocument()
    expect(screen.getByText('See Omnysync in action')).toBeInTheDocument()
    expect(demo?.querySelector('video source')?.getAttribute('src')).toMatch(/\/demo(-fr)?\.mp4$/)
    expect(screen.getByRole('button', { name: 'Play demo' })).toBeInTheDocument()
  })

  it('renders footer with links', async () => {
    render(await Home())
    expect(screen.getByText('Privacy')).toBeInTheDocument()
    expect(screen.getByText('Terms')).toBeInTheDocument()
    expect(screen.getByText('© 2026 Omnysync')).toBeInTheDocument()
  })
})
