/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { FeatureGuard, FeatureSwitch, PlanBadge } from './FeatureGuard'

const mockUseFeature = vi.hoisted(() =>
  vi.fn((key: string) => {
    const features: Record<string, boolean> = {
      EXPORT_PDF: true,
      ADVANCED_ANALYTICS: false,
      UNKNOWN_FEATURE: false,
    }
    return features[key] ?? false
  })
)

vi.mock('@omnysync/core/hooks', () => ({
  useFeature: mockUseFeature,
  useEntitlements: vi.fn(() => ({
    data: { features: { EXPORT_PDF: true, ADVANCED_ANALYTICS: false }, limits: {}, usage: {} },
    isLoading: false,
    error: null,
  })),
  useLimit: vi.fn(() => ({ limit: null, used: 0, resetAt: null, remaining: null })),
  FeatureGuard: ({ feature, children, fallback }: any) => {
    const features: Record<string, boolean> = {
      EXPORT_PDF: true,
      ADVANCED_ANALYTICS: false,
    }
    return features[feature] ? <>{children}</> : <>{fallback}</>
  },
  UsageBar: () => null,
}))

describe('FeatureGuard', () => {
  it('shows children when feature is enabled', () => {
    render(
      <FeatureGuard feature="EXPORT_PDF">
        <div>Export button</div>
      </FeatureGuard>
    )
    expect(screen.getByText('Export button')).toBeInTheDocument()
  })

  it('shows fallback when feature is disabled (default)', () => {
    render(
      <FeatureGuard feature="ADVANCED_ANALYTICS" fallback={<div>Upgrade required</div>}>
        <div>Analytics</div>
      </FeatureGuard>
    )
    expect(screen.getByText('Upgrade required')).toBeInTheDocument()
    expect(screen.queryByText('Analytics')).not.toBeInTheDocument()
  })

  it('shows nothing when feature is disabled and hideWhenDisabled is true', () => {
    const { container } = render(
      <FeatureGuard feature="ADVANCED_ANALYTICS" hideWhenDisabled={true}>
        <div>Analytics</div>
      </FeatureGuard>
    )
    expect(container.innerHTML).toBe('')
  })

  it('renders PlanBadge with correct variant', () => {
    render(<PlanBadge variant="success" />)
    const badge = screen.getByText('Plan')
    expect(badge.className).toContain('bg-green-100')
  })

  it('renders PlanBadge with default variant', () => {
    render(<PlanBadge />)
    const badge = screen.getByText('Plan')
    expect(badge.className).toContain('bg-gray-100')
  })

  it('renders PlanBadge with warning variant', () => {
    render(<PlanBadge variant="warning" />)
    const badge = screen.getByText('Plan')
    expect(badge.className).toContain('bg-yellow-100')
  })

  it('renders PlanBadge with error variant', () => {
    render(<PlanBadge variant="error" />)
    const badge = screen.getByText('Plan')
    expect(badge.className).toContain('bg-red-100')
  })

  it('applies className to wrapper span', () => {
    render(
      <FeatureGuard feature="EXPORT_PDF" className="custom-class">
        <div>Content</div>
      </FeatureGuard>
    )
    const span = document.querySelector('span.custom-class')
    expect(span).toBeInTheDocument()
  })
})

describe('FeatureSwitch', () => {
  it('renders enabled content when feature is on', () => {
    render(
      <FeatureSwitch
        feature="EXPORT_PDF"
        enabled={<div>Enabled</div>}
        disabled={<div>Disabled</div>}
      />
    )
    expect(screen.getByText('Enabled')).toBeInTheDocument()
  })

  it('renders disabled content when feature is off', () => {
    render(
      <FeatureSwitch
        feature="ADVANCED_ANALYTICS"
        enabled={<div>Enabled</div>}
        disabled={<div>Disabled</div>}
      />
    )
    expect(screen.getByText('Disabled')).toBeInTheDocument()
    expect(screen.queryByText('Enabled')).not.toBeInTheDocument()
  })

  it('renders enabled for unknown feature returning false', () => {
    render(
      <FeatureSwitch
        feature="UNKNOWN_FEATURE"
        enabled={<div>Enabled</div>}
        disabled={<div>Disabled</div>}
      />
    )
    expect(screen.getByText('Disabled')).toBeInTheDocument()
    expect(screen.queryByText('Enabled')).not.toBeInTheDocument()
  })
})
