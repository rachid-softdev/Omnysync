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

  it('renders ThemeToggle component', () => {
    render(<Header />)
    expect(screen.getByLabelText('Toggle theme')).toBeInTheDocument()
  })

  it('has correct link hrefs on home page', () => {
    render(<Header />)
    const homeLink = screen.getByLabelText('Omnysync home')
    expect(homeLink).toHaveAttribute('href', '/')

    const signInLink = screen.getByText('Sign In')
    expect(signInLink.closest('a')).toHaveAttribute('href', '/auth/signin')

    const getStartedLink = screen.getByText('Get Started')
    expect(getStartedLink.closest('a')).toHaveAttribute('href', '/auth/signin')
  })

  it('has correct aria-labels on navigation links', () => {
    render(<Header />)
    expect(screen.getByLabelText('Omnysync home')).toBeInTheDocument()
    expect(screen.getByLabelText('Features')).toBeInTheDocument()
    expect(screen.getByLabelText('How it works')).toBeInTheDocument()
  })

  it('renders with proper accessible heading structure', () => {
    render(<Header />)
    const header = document.querySelector('header')
    expect(header).toBeInTheDocument()
    expect(header?.className).toContain('fixed top-0')
  })
})
