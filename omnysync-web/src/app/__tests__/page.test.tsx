/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import Home from '../page'

vi.mock('@/lib/i18n', () => ({
  t: (key: string) => {
    const translations: Record<string, string> = {
      hero_badge: '⚡ Content Sync Platform',
      hero_headline: 'Sync your content',
      hero_tagline: 'everywhere, automatically',
      hero_subtitle: 'Publish once, sync to all your platforms.',
      hero_cta_primary: 'Start Free',
      hero_cta_secondary: 'See how it works',
      hero_no_credit_card: 'No credit card required',
      hero_platforms: 'Works with your favorite platforms',
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
    }
    return translations[key] || key
  },
}))

vi.mock('@/lib/i18n/useTranslations', () => ({
  useTranslations: vi.fn(() => ({
    t: (key: string) => key,
    loading: false,
    locale: 'en',
  })),
}))

describe('Home page', () => {
  it('renders hero section', () => {
    render(<Home />)
    expect(screen.getByText('Sync your content')).toBeInTheDocument()
    expect(screen.getByText('everywhere, automatically')).toBeInTheDocument()
  })

  it('renders CTA buttons', () => {
    render(<Home />)
    expect(screen.getByText('Start Free')).toBeInTheDocument()
    expect(screen.getByText('See how it works')).toBeInTheDocument()
  })

  it('renders features section', () => {
    render(<Home />)
    expect(screen.getByText('Everything you need')).toBeInTheDocument()
    expect(screen.getByText('Two-Way Sync')).toBeInTheDocument()
    expect(screen.getByText('Analytics')).toBeInTheDocument()
    expect(screen.getByText('Scheduling')).toBeInTheDocument()
  })

  it('renders how it works section', () => {
    render(<Home />)
    expect(screen.getByText('How it works')).toBeInTheDocument()
    expect(screen.getByText('Connect')).toBeInTheDocument()
    expect(screen.getByText('Configure')).toBeInTheDocument()
    expect(screen.getByText('Sync')).toBeInTheDocument()
  })

  it('renders platform logos', () => {
    render(<Home />)
    expect(screen.getByText('WordPress')).toBeInTheDocument()
    expect(screen.getByText('Ghost')).toBeInTheDocument()
    expect(screen.getByText('Webflow')).toBeInTheDocument()
    expect(screen.getByText('Shopify')).toBeInTheDocument()
    expect(screen.getByText('Notion')).toBeInTheDocument()
  })

  it('renders footer with links', () => {
    render(<Home />)
    expect(screen.getByText('Privacy')).toBeInTheDocument()
    expect(screen.getByText('Terms')).toBeInTheDocument()
    expect(screen.getByText('© 2026 Omnysync')).toBeInTheDocument()
  })
})
