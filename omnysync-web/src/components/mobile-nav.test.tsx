/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MobileNav } from './mobile-nav'
import { LayoutDashboard, FileText, Settings } from 'lucide-react'

const mockNavItems = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/dashboard/documents', icon: FileText, label: 'Documents' },
  { href: '/dashboard/settings', icon: Settings, label: 'Settings' },
]

const mockUser = {
  name: 'John Doe',
  email: 'john@example.com',
  image: null,
}

vi.mock('next/navigation', () => ({
  usePathname: vi.fn(() => '/dashboard'),
}))

vi.mock('@/hooks/use-mobile', () => ({
  useIsMobile: vi.fn(() => true),
}))

vi.mock('@/lib/actions', () => ({
  logoutAction: vi.fn(),
}))

vi.mock('@/lib/i18n', () => ({
  t: (key: string) => {
    const translations: Record<string, string> = {
      UI_LOGOUT: 'Logout',
    }
    return translations[key] || key
  },
}))

beforeEach(() => {
  vi.clearAllMocks()
})

describe('MobileNav', () => {
  it('renders hamburger menu button', () => {
    render(<MobileNav navItems={mockNavItems} user={mockUser} />)
    expect(screen.getByLabelText('Open menu')).toBeInTheDocument()
  })

  it('opens drawer when hamburger is clicked', () => {
    render(<MobileNav navItems={mockNavItems} user={mockUser} />)
    fireEvent.click(screen.getByLabelText('Open menu'))
    expect(screen.getByText('Dashboard')).toBeInTheDocument()
    expect(screen.getByText('Documents')).toBeInTheDocument()
    expect(screen.getByText('Settings')).toBeInTheDocument()
  })

  it('shows user name and email in drawer', () => {
    render(<MobileNav navItems={mockNavItems} user={mockUser} />)
    fireEvent.click(screen.getByLabelText('Open menu'))
    expect(screen.getByText('John Doe')).toBeInTheDocument()
    expect(screen.getByText('john@example.com')).toBeInTheDocument()
  })

  it('closes drawer when close button is clicked', () => {
    const { container } = render(<MobileNav navItems={mockNavItems} user={mockUser} />)
    // Open the drawer
    fireEvent.click(screen.getByLabelText('Open menu'))
    expect(screen.getByText('Dashboard')).toBeInTheDocument()

    // Close the drawer by clicking the close button
    fireEvent.click(screen.getByLabelText('Close menu'))

    // The drawer panel stays in DOM but is translated off-screen.
    // The overlay ({isOpen && ...}) is no longer rendered - verify via class
    const overlay = container.querySelector('.bg-black\\/50')
    expect(overlay).toBeNull()
  })

  it('renders logout button', () => {
    render(<MobileNav navItems={mockNavItems} user={mockUser} />)
    fireEvent.click(screen.getByLabelText('Open menu'))
    expect(screen.getByText('Logout')).toBeInTheDocument()
  })
})
