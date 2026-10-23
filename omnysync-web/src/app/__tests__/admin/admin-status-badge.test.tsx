import { describe, it, expect, beforeAll } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AdminStatusBadge } from '@/components/admin/admin-status-badge'

beforeAll(() => {
  document.documentElement.lang = 'en'
})

describe('AdminStatusBadge', () => {
  it('displays "Active" for status "active"', () => {
    render(<AdminStatusBadge status="active" />)
    expect(screen.getByText('Active')).toBeInTheDocument()
  })

  it('displays "Inactive" for status "inactive"', () => {
    render(<AdminStatusBadge status="inactive" />)
    expect(screen.getByText('Inactive')).toBeInTheDocument()
  })

  it('displays "Trialing" for status "trialing"', () => {
    render(<AdminStatusBadge status="trialing" />)
    expect(screen.getByText('Trialing')).toBeInTheDocument()
  })

  it('displays "Expired" for status "expired"', () => {
    render(<AdminStatusBadge status="expired" />)
    expect(screen.getByText('Expired')).toBeInTheDocument()
  })

  it('displays "Pending" for status "pending"', () => {
    render(<AdminStatusBadge status="pending" />)
    expect(screen.getByText('Pending')).toBeInTheDocument()
  })

  it('displays "Error" for status "error"', () => {
    render(<AdminStatusBadge status="error" />)
    expect(screen.getByText('Error')).toBeInTheDocument()
  })

  it('displays a custom label when provided', () => {
    render(<AdminStatusBadge status="active" label="Custom Label" />)
    expect(screen.getByText('Custom Label')).toBeInTheDocument()
    // Default label should not appear
    expect(screen.queryByText('Active')).not.toBeInTheDocument()
  })

  it('displays French labels when the document language is French', () => {
    document.documentElement.lang = 'fr'
    render(<AdminStatusBadge status="active" />)
    expect(screen.getByText('Actif')).toBeInTheDocument()
    document.documentElement.lang = 'en'
  })

  it('applies the success variant for "active" status', () => {
    const { container } = render(<AdminStatusBadge status="active" />)
    const badge = container.firstChild as HTMLElement
    expect(badge.className).toContain('bg-success-soft')
  })

  it('applies the secondary variant for "inactive" status', () => {
    const { container } = render(<AdminStatusBadge status="inactive" />)
    const badge = container.firstChild as HTMLElement
    expect(badge.className).toContain('bg-secondary')
  })

  it('applies the destructive variant for "error" status', () => {
    const { container } = render(<AdminStatusBadge status="error" />)
    const badge = container.firstChild as HTMLElement
    expect(badge.className).toContain('bg-destructive')
  })

  it('applies the info variant for "trialing" status', () => {
    const { container } = render(<AdminStatusBadge status="trialing" />)
    const badge = container.firstChild as HTMLElement
    expect(badge.className).toContain('bg-info-soft')
  })

  it('renders a badge element', () => {
    const { container } = render(<AdminStatusBadge status="active" />)
    expect(container.firstChild?.nodeName).toBe('DIV')
  })
})
