/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import DashboardLayout from '../../(dashboard)/layout'

const mockRedirect = vi.hoisted(() => vi.fn())

vi.mock('next/navigation', () => ({
  redirect: mockRedirect,
}))

vi.mock('next/image', () => ({
  default: (props: any) => <img {...props} />,
}))

vi.mock('@/lib/auth', () => ({
  auth: vi.fn().mockResolvedValue({
    user: { id: 'user-1', name: 'John Doe', email: 'john@example.com', image: null },
  }),
}))

vi.mock('@/lib/i18n', () => ({
  t: (key: string) => {
    const translations: Record<string, string> = {
      UI_DASHBOARD: 'Dashboard',
      UI_DOCS_LABEL: 'Documents',
      UI_CONNECTORS: 'Connectors',
      UI_SYNC: 'Sync',
      UI_ANALYTICS: 'Analytics',
      UI_WEBHOOKS: 'Webhooks',
      UI_APPROVALS: 'Approvals',
      UI_USAGE: 'Usage',
      UI_SETTINGS: 'Settings',
      UI_SKIP_TO_CONTENT: 'Skip to content',
      UI_LOGOUT: 'Logout',
    }
    return translations[key] || key
  },
}))

vi.mock('@/lib/auth/org', () => ({
  getUserOrgId: vi.fn().mockResolvedValue('org-1'),
}))

vi.mock('@/components/mobile-nav', () => ({
  MobileNav: ({ navItems, user }: any) => (
    <div data-testid="mobile-nav">
      <span data-testid="mobile-nav-user">{user.name}</span>
      <span data-testid="mobile-nav-count">{navItems.length}</span>
    </div>
  ),
}))

vi.mock('@/lib/actions', () => ({
  logoutAction: vi.fn(),
}))

vi.mock('lucide-react', () => ({
  LayoutDashboard: () => <svg data-testid="icon-dashboard" />,
  FileText: () => <svg data-testid="icon-filetxt" />,
  Plug: () => <svg data-testid="icon-plug" />,
  Settings: () => <svg data-testid="icon-settings" />,
  LogOut: () => <svg data-testid="icon-logout" />,
  ArrowRightLeft: () => <svg data-testid="icon-sync" />,
  BarChart3: () => <svg data-testid="icon-analytics" />,
  Webhook: () => <svg data-testid="icon-webhook" />,
  FileCheck: () => <svg data-testid="icon-approvals" />,
  Zap: () => <svg data-testid="icon-zap" />,
}))

beforeEach(() => {
  vi.clearAllMocks()
})

describe('DashboardLayout', () => {
  it('renders sidebar with all navigation items', async () => {
    const element = await DashboardLayout({ children: <div>Content</div> })
    render(element)

    expect(screen.getByText('Omnysync')).toBeInTheDocument()
    expect(screen.getByText('Dashboard')).toBeInTheDocument()
    expect(screen.getByText('Documents')).toBeInTheDocument()
    expect(screen.getByText('Connectors')).toBeInTheDocument()
    expect(screen.getByText('Sync')).toBeInTheDocument()
    expect(screen.getByText('Analytics')).toBeInTheDocument()
    expect(screen.getByText('Webhooks')).toBeInTheDocument()
    expect(screen.getByText('Approvals')).toBeInTheDocument()
    expect(screen.getByText('Usage')).toBeInTheDocument()
    expect(screen.getByText('Settings')).toBeInTheDocument()
  })

  it('renders skip-to-content link', async () => {
    const element = await DashboardLayout({ children: <div>Content</div> })
    render(element)

    const skipLink = screen.getByText('Skip to content')
    expect(skipLink).toBeInTheDocument()
    expect(skipLink.getAttribute('href')).toBe('#main-content')
  })

  it('renders user name and email in sidebar', async () => {
    const element = await DashboardLayout({ children: <div>Content</div> })
    render(element)

    const johnDoes = screen.getAllByText('John Doe')
    expect(johnDoes.length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('john@example.com')).toBeInTheDocument()
  })

  it('renders logout button', async () => {
    const element = await DashboardLayout({ children: <div>Content</div> })
    render(element)

    expect(screen.getByText('Logout')).toBeInTheDocument()
  })

  it('renders MobileNav with nav items and user', async () => {
    const element = await DashboardLayout({ children: <div>Content</div> })
    render(element)

    const mobileNav = screen.getByTestId('mobile-nav')
    expect(mobileNav).toBeInTheDocument()
    expect(screen.getByTestId('mobile-nav-user')).toHaveTextContent('John Doe')
    expect(screen.getByTestId('mobile-nav-count')).toHaveTextContent('9')
  })

  it('renders main content area', async () => {
    const element = await DashboardLayout({ children: <div data-testid="child">Content</div> })
    render(element)

    expect(screen.getByTestId('child')).toBeInTheDocument()
  })

  it('renders user avatar image when user.image is provided', async () => {
    const mockAuth = vi.mocked((await import('@/lib/auth')).auth)
    mockAuth.mockResolvedValueOnce({
      user: { id: 'user-1', name: 'Jane', email: 'jane@example.com', image: '/avatar.jpg' },
    })

    const element = await DashboardLayout({ children: <div>Content</div> })
    render(element)

    const img = screen.getByAltText('Jane')
    expect(img).toBeInTheDocument()
    expect(img).toHaveAttribute('src', '/avatar.jpg')
  })

  it('redirects to sign-in when no session', async () => {
    mockRedirect.mockImplementationOnce(() => {
      throw new Error('NEXT_REDIRECT')
    })

    const mockAuth = vi.mocked((await import('@/lib/auth')).auth)
    mockAuth.mockResolvedValueOnce({ user: null } as any)

    await expect(DashboardLayout({ children: <div>Content</div> })).rejects.toThrow(
      'NEXT_REDIRECT'
    )
    expect(mockRedirect).toHaveBeenCalledWith('/auth/signin')
  })
})
