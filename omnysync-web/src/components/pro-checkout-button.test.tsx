/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ProCheckoutButton } from './pro-checkout-button'

const mockPush = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}))

vi.mock('@/lib/i18n/useTranslations', () => ({
  useTranslations: vi.fn(() => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        UI_REDIRECTING: 'Redirecting...',
      }
      return translations[key] || key
    },
    loading: false,
    locale: 'en',
  })),
}))

beforeEach(() => {
  vi.clearAllMocks()
  global.fetch = vi.fn()
  // Mock window.location
  Object.defineProperty(window, 'location', {
    value: { href: '' },
    writable: true,
  })
})

describe('ProCheckoutButton', () => {
  it('renders button with label', () => {
    render(<ProCheckoutButton label="Upgrade to Pro" />)
    expect(screen.getByText('Upgrade to Pro')).toBeInTheDocument()
  })

  it('shows loading state during checkout', async () => {
    ;(global.fetch as any).mockImplementationOnce(
      () => new Promise(() => {}) // Never resolves (loading state)
    )

    render(<ProCheckoutButton label="Upgrade to Pro" />)
    fireEvent.click(screen.getByText('Upgrade to Pro'))

    await waitFor(() => {
      expect(screen.getByText('Redirecting...')).toBeInTheDocument()
    })
  })

  it('redirects to checkout URL on success', async () => {
    ;(global.fetch as any).mockResolvedValueOnce({
      json: async () => ({ url: 'https://stripe.com/checkout' }),
    })

    render(<ProCheckoutButton label="Upgrade" />)
    fireEvent.click(screen.getByText('Upgrade'))
  })

  it('navigates to signin on fetch error', async () => {
    ;(global.fetch as any).mockRejectedValueOnce(new Error('Network error'))

    render(<ProCheckoutButton label="Upgrade" />)
    fireEvent.click(screen.getByText('Upgrade'))

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/auth/signin')
    })
  })

  it('disables button while loading', async () => {
    ;(global.fetch as any).mockImplementationOnce(
      () => new Promise(() => {})
    )

    render(<ProCheckoutButton label="Upgrade" />)
    const button = screen.getByText('Upgrade')
    fireEvent.click(button)

    await waitFor(() => {
      expect(screen.getByRole('button')).toBeDisabled()
    })
  })
})
