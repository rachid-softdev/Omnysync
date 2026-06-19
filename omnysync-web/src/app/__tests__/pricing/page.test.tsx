/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import PricingPage from '../../pricing/page'

vi.mock('@/lib/i18n', () => ({
  t: (key: string) => {
    const translations: Record<string, string> = {
      pricing_title: 'Simple, transparent pricing',
      pricing_subtitle: 'Choose the plan that works for you.',
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
      'plan_free_feature_1': 'Up to 5 documents',
      'plan_free_feature_2': '1 connector',
      'plan_free_feature_3': 'Basic support',
      'plan_free_feature_4': 'Manual sync',
      'plan_free_feature_5': 'Community access',
      'plan_pro_feature_1': 'Unlimited documents',
      'plan_pro_feature_2': 'All connectors',
      'plan_pro_feature_3': 'Priority support',
      'plan_pro_feature_4': 'Auto sync',
      'plan_pro_feature_5': 'AI enrichment',
      'plan_pro_feature_6': 'Analytics',
      'plan_pro_feature_7': 'Team collaboration',
      'plan_business_feature_1': 'Everything in Pro',
      'plan_business_feature_2': 'Custom integrations',
      'plan_business_feature_3': 'Dedicated support',
      'plan_business_feature_4': 'SLA guarantee',
      'plan_business_feature_5': 'Advanced security',
      'plan_business_feature_6': 'API access',
      'plan_business_feature_7': 'Custom reporting',
    }
    return translations[key] || key
  },
}))

vi.mock('@/components/pro-checkout-button', () => ({
  ProCheckoutButton: ({ label }: { label: string }) => (
    <button>{label}</button>
  ),
}))

describe('PricingPage', () => {
  it('renders pricing title', () => {
    render(<PricingPage />)
    expect(screen.getByText('Simple, transparent pricing')).toBeInTheDocument()
  })

  it('renders all plan cards', () => {
    render(<PricingPage />)
    expect(screen.getByText('Free')).toBeInTheDocument()
    expect(screen.getByText('Pro')).toBeInTheDocument()
    expect(screen.getByText('Business')).toBeInTheDocument()
  })

  it('renders plan prices', () => {
    render(<PricingPage />)
    expect(screen.getByText('$0')).toBeInTheDocument()
    expect(screen.getByText('$29')).toBeInTheDocument()
    expect(screen.getByText('$99')).toBeInTheDocument()
  })

  it('renders popular badge on Pro plan', () => {
    render(<PricingPage />)
    expect(screen.getByText('Most Popular')).toBeInTheDocument()
  })
})
