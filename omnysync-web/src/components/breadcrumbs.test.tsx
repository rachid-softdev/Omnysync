import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Breadcrumbs } from './breadcrumbs'

const mockUsePathname = vi.hoisted(() => vi.fn(() => '/dashboard/connectors'))

vi.mock('next/navigation', () => ({
  usePathname: mockUsePathname,
}))

beforeEach(() => {
  vi.clearAllMocks()
})

describe('Breadcrumbs', () => {
  it('renders crumbs for /dashboard/connectors path', () => {
    mockUsePathname.mockReturnValue('/dashboard/connectors')
    render(<Breadcrumbs />)
    expect(screen.getByText('Dashboard')).toBeInTheDocument()
    expect(screen.getByText('Connectors')).toBeInTheDocument()
    expect(screen.getByRole('navigation')).toBeInTheDocument()
  })

  it('renders separator between crumbs', () => {
    mockUsePathname.mockReturnValue('/dashboard/connectors')
    render(<Breadcrumbs />)
    const separators = screen.getAllByText('/')
    expect(separators).toHaveLength(1)
  })

  it('returns null for root path', () => {
    mockUsePathname.mockReturnValue('/')
    const { container } = render(<Breadcrumbs />)
    expect(container.innerHTML).toBe('')
  })

  it('renders last crumb with distinct styling (text-foreground class)', () => {
    mockUsePathname.mockReturnValue('/dashboard/connectors')
    render(<Breadcrumbs />)
    const lastCrumb = screen.getByText('Connectors')
    expect(lastCrumb.className).toContain('text-foreground')
  })

  it('returns null for single segment path', () => {
    mockUsePathname.mockReturnValue('/dashboard')
    const { container } = render(<Breadcrumbs />)
    expect(container.innerHTML).toBe('')
  })

  it('returns null for path with only one segment', () => {
    mockUsePathname.mockReturnValue('/settings')
    const { container } = render(<Breadcrumbs />)
    expect(container.innerHTML).toBe('')
  })

  it('renders many items with correct separators', () => {
    mockUsePathname.mockReturnValue('/dashboard/connectors/settings/new')
    render(<Breadcrumbs />)
    expect(screen.getByText('Dashboard')).toBeInTheDocument()
    expect(screen.getByText('Connectors')).toBeInTheDocument()
    expect(screen.getByText('Settings')).toBeInTheDocument()
    expect(screen.getByText('New')).toBeInTheDocument()

    const separators = screen.getAllByText('/')
    expect(separators).toHaveLength(3)
  })

  it('renders unknown segment names as-is', () => {
    mockUsePathname.mockReturnValue('/dashboard/unknown-path')
    render(<Breadcrumbs />)
    expect(screen.getByText('Dashboard')).toBeInTheDocument()
    expect(screen.getByText('unknown-path')).toBeInTheDocument()
  })

  it('renders last unknown segment with text-foreground styling', () => {
    mockUsePathname.mockReturnValue('/dashboard/custom-route')
    render(<Breadcrumbs />)
    const lastCrumb = screen.getByText('custom-route')
    expect(lastCrumb.className).toContain('text-foreground')
  })
})
