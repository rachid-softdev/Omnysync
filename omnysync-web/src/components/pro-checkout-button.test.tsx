import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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
  describe('rendering', () => {
    it('renders button with label', () => {
      render(<ProCheckoutButton label="Upgrade to Pro" />)
      expect(screen.getByText('Upgrade to Pro')).toBeInTheDocument()
    })

    it('renders Zap icon inside the button', () => {
      render(<ProCheckoutButton label="Upgrade to Pro" />)
      const button = screen.getByRole('button', { name: /upgrade to pro/i })
      // Zap icon renders as an SVG inside the button
      const svg = button.querySelector('svg')
      expect(svg).toBeInTheDocument()
      expect(svg).toHaveClass('lucide-zap')
    })

    it('applies correct base className', () => {
      render(<ProCheckoutButton label="Upgrade" />)
      const button = screen.getByRole('button', { name: /upgrade/i })
      expect(button).toHaveClass('w-full')
      expect(button).toHaveClass('rounded-full')
    })
  })

  describe('loading state', () => {
    it('shows loading text during checkout', async () => {
      ;(global.fetch as any).mockImplementationOnce(
        () => new Promise(() => {}) // Never resolves (loading state)
      )

      render(<ProCheckoutButton label="Upgrade to Pro" />)
      fireEvent.click(screen.getByText('Upgrade to Pro'))

      await waitFor(() => {
        expect(screen.getByText('Redirecting...')).toBeInTheDocument()
      })
    })

    it('disables button while loading', async () => {
      ;(global.fetch as any).mockImplementationOnce(() => new Promise(() => {}))

      render(<ProCheckoutButton label="Upgrade" />)
      const button = screen.getByText('Upgrade')
      fireEvent.click(button)

      await waitFor(() => {
        expect(screen.getByRole('button')).toBeDisabled()
      })
    })

    it('prevents double-click during loading', async () => {
      const user = userEvent.setup()
      ;(global.fetch as any).mockImplementationOnce(() => new Promise(() => {}))

      render(<ProCheckoutButton label="Upgrade" />)
      const button = screen.getByRole('button', { name: /upgrade/i })

      await user.click(button)
      await user.click(button)

      // fetch should only be called once
      expect(global.fetch).toHaveBeenCalledTimes(1)
    })
  })

  describe('success path', () => {
    it('redirects to checkout URL on success', async () => {
      ;(global.fetch as any).mockResolvedValueOnce({
        json: async () => ({ url: 'https://stripe.com/checkout' }),
      })

      render(<ProCheckoutButton label="Upgrade" />)
      fireEvent.click(screen.getByText('Upgrade'))

      await waitFor(() => {
        expect(window.location.href).toBe('https://stripe.com/checkout')
      })
    })

    it('navigates to signin when response has no URL', async () => {
      ;(global.fetch as any).mockResolvedValueOnce({
        json: async () => ({}), // No url field
      })

      render(<ProCheckoutButton label="Upgrade" />)
      fireEvent.click(screen.getByText('Upgrade'))

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/auth/signin')
      })
    })

    it('navigates to signin when url is null', async () => {
      ;(global.fetch as any).mockResolvedValueOnce({
        json: async () => ({ url: null }),
      })

      render(<ProCheckoutButton label="Upgrade" />)
      fireEvent.click(screen.getByText('Upgrade'))

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/auth/signin')
      })
    })
  })

  describe('error path', () => {
    it('navigates to signin on fetch network error', async () => {
      ;(global.fetch as any).mockRejectedValueOnce(new Error('Network error'))

      render(<ProCheckoutButton label="Upgrade" />)
      fireEvent.click(screen.getByText('Upgrade'))

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/auth/signin')
      })
    })

    it('navigates to signin on JSON parsing error', async () => {
      ;(global.fetch as any).mockResolvedValueOnce({
        json: async () => {
          throw new Error('Invalid JSON')
        },
      })

      render(<ProCheckoutButton label="Upgrade" />)
      fireEvent.click(screen.getByText('Upgrade'))

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/auth/signin')
      })
    })
  })
})
