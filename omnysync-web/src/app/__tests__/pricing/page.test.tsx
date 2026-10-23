import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import PricingPage from '../../pricing/page'

const { translations } = vi.hoisted(() => ({
  translations: {
    pricing_title: 'Plans for every route.',
    pricing_subtitle: 'Start free, then scale the same routing engine as volume grows.',
    pricing_note_1: 'No hidden seats.',
    pricing_note_2: 'Cancel anytime.',
    pricing_matrix_label: 'Plan / capability',
    pricing_matrix_eyebrow: 'Comparison',
    pricing_matrix_title: 'The full route, side by side.',
    pricing_matrix_subtitle: 'Same product surface. Different limits.',
    pricing_matrix_meta: '3 plans · 10 capabilities',
    value_included: 'Included',
    compare_syncs: 'Syncs per month',
    compare_platforms: 'Platforms',
    compare_ai: 'AI enrichment',
    compare_support: 'Support',
    plan_free_name: 'Free',
    plan_free_price: '$0',
    plan_free_period: 'month',
    plan_free_description: 'Get started with basic sync features.',
    plan_pro_name: 'Pro',
    plan_pro_price: '$29',
    plan_pro_period: 'month',
    plan_pro_description: 'For professionals who need more power.',
    plan_business_name: 'Business',
    plan_business_price: '$99',
    plan_business_period: 'month',
    plan_business_description: 'For teams with advanced needs.',
    popular_badge: 'Most Popular',
    cta_start_free: 'Get Started Free',
    cta_start_trial: 'Start Free Trial',
    cta_contact_sales: 'Contact Sales',
    plan_free_feature_1: 'Up to 5 documents',
    plan_free_feature_2: '1 connector',
    plan_free_feature_3: 'Basic support',
    plan_free_feature_4: 'Manual sync',
    plan_free_feature_5: 'Community access',
    plan_pro_feature_1: 'Unlimited documents',
    plan_pro_feature_2: 'All connectors',
    plan_pro_feature_3: 'Priority support',
    plan_pro_feature_4: 'Auto sync',
    plan_pro_feature_5: 'AI enrichment',
    plan_pro_feature_6: 'Analytics',
    plan_pro_feature_7: 'Team collaboration',
    plan_business_feature_1: 'Everything in Pro',
    plan_business_feature_2: 'Custom integrations',
    plan_business_feature_3: 'Dedicated support',
    plan_business_feature_4: 'SLA guarantee',
    plan_business_feature_5: 'Advanced security',
    plan_business_feature_6: 'API access',
    plan_business_feature_7: 'Custom reporting',
  } as Record<string, string>,
}))

vi.mock('@/lib/i18n', () => {
  const translate = (key: string) => translations[key] || key
  return {
    t: translate,
    // The page resolves its locale per request; the mock keeps the same strings.
    getT: async () => translate,
  }
})

vi.mock('@/components/pro-checkout-button', () => ({
  ProCheckoutButton: ({ label }: { label: string }) => <button>{label}</button>,
}))

describe('PricingPage', () => {
  it('renders pricing title', async () => {
    render(await PricingPage())
    expect(screen.getByText('Plans for every route.')).toBeInTheDocument()
  })

  it('renders all plans', async () => {
    render(await PricingPage())
    expect(screen.getByText('Free')).toBeInTheDocument()
    expect(screen.getByText('Pro')).toBeInTheDocument()
    expect(screen.getByText('Business')).toBeInTheDocument()
  })

  it('renders plan prices', async () => {
    render(await PricingPage())
    expect(screen.getByText('$0')).toBeInTheDocument()
    expect(screen.getByText('$29')).toBeInTheDocument()
    expect(screen.getByText('$99')).toBeInTheDocument()
  })

  it('renders popular badge on Pro plan', async () => {
    render(await PricingPage())
    expect(screen.getByText('Most Popular')).toBeInTheDocument()
  })

  it('renders the comparison matrix', async () => {
    render(await PricingPage())

    expect(screen.getByText('The full route, side by side.')).toBeInTheDocument()
    expect(screen.getByText('Syncs per month')).toBeInTheDocument()
    expect(screen.getByText('Platforms')).toBeInTheDocument()
    expect(screen.getAllByText('Included').length).toBeGreaterThan(0)
  })
})
