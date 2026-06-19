/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Header } from './header'

const mockUsePathname = vi.hoisted(() => vi.fn(() => '/'))

vi.mock('next/navigation', () => ({
  usePathname: mockUsePathname,
}))

vi.mock('next-themes', () => ({
  useTheme: vi.fn(() => ({ theme: 'light', setTheme: vi.fn() })),
}))

vi.mock('@/lib/i18n/useTranslations', () => ({
  useTranslations: vi.fn(() => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        nav_features: 'Features',
        nav_how_it_works: 'How it works',
        UI_SIGN_IN: 'Sign In',
        UI_GET_STARTED: 'Get Started',
      }
      return translations[key] || key
    },
    loading: false,
    locale: 'en',
  })),
}))

beforeEach(() => {
  vi.clearAllMocks()
  mockUsePathname.mockReturnValue('/')
})

describe('Header', () => {
  it('renders logo and navigation links on home page', () => {
    render(<Header />)
    expect(screen.getByText('Omnysync')).toBeInTheDocument()
    expect(screen.getByText('Features')).toBeInTheDocument()
    expect(screen.getByText('How it works')).toBeInTheDocument()
    expect(screen.getByText('Sign In')).toBeInTheDocument()
    expect(screen.getByText('Get Started')).toBeInTheDocument()
  })

  it('returns null on sign-in page', () => {
    mockUsePathname.mockReturnValue('/auth/signin')
    const { container } = render(<Header />)
    expect(container.innerHTML).toBe('')
  })

  it('does not show nav links on dashboard page', () => {
    mockUsePathname.mockReturnValue('/dashboard')
    render(<Header />)
    expect(screen.getByText('Omnysync')).toBeInTheDocument()
    expect(screen.queryByText('Features')).not.toBeInTheDocument()
    expect(screen.queryByText('How it works')).not.toBeInTheDocument()
  })
})
