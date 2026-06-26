import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AdminStatusBadge } from '@/components/admin/admin-status-badge'

describe('AdminStatusBadge', () => {
  it('displays "Actif" for status "active"', () => {
    render(<AdminStatusBadge status="active" />)
    expect(screen.getByText('Actif')).toBeInTheDocument()
  })

  it('displays "Inactif" for status "inactive"', () => {
    render(<AdminStatusBadge status="inactive" />)
    expect(screen.getByText('Inactif')).toBeInTheDocument()
  })

  it('displays "Essai" for status "trialing"', () => {
    render(<AdminStatusBadge status="trialing" />)
    expect(screen.getByText('Essai')).toBeInTheDocument()
  })

  it('displays "Expiré" for status "expired"', () => {
    render(<AdminStatusBadge status="expired" />)
    expect(screen.getByText('Expiré')).toBeInTheDocument()
  })

  it('displays "En attente" for status "pending"', () => {
    render(<AdminStatusBadge status="pending" />)
    expect(screen.getByText('En attente')).toBeInTheDocument()
  })

  it('displays "Erreur" for status "error"', () => {
    render(<AdminStatusBadge status="error" />)
    expect(screen.getByText('Erreur')).toBeInTheDocument()
  })

  it('displays a custom label when provided', () => {
    render(<AdminStatusBadge status="active" label="Custom Label" />)
    expect(screen.getByText('Custom Label')).toBeInTheDocument()
    // Default label should not appear
    expect(screen.queryByText('Actif')).not.toBeInTheDocument()
  })

  it('applies green background classes for "active" status', () => {
    const { container } = render(<AdminStatusBadge status="active" />)
    const badge = container.firstChild as HTMLElement
    expect(badge.className).toContain('bg-green')
  })

  it('applies gray background classes for "inactive" status', () => {
    const { container } = render(<AdminStatusBadge status="inactive" />)
    const badge = container.firstChild as HTMLElement
    expect(badge.className).toContain('bg-gray')
  })

  it('applies red background classes for "error" status', () => {
    const { container } = render(<AdminStatusBadge status="error" />)
    const badge = container.firstChild as HTMLElement
    expect(badge.className).toContain('bg-red')
  })

  it('applies blue background classes for "trialing" status', () => {
    const { container } = render(<AdminStatusBadge status="trialing" />)
    const badge = container.firstChild as HTMLElement
    expect(badge.className).toContain('bg-blue')
  })

  it('renders as a span element', () => {
    const { container } = render(<AdminStatusBadge status="active" />)
    expect(container.firstChild?.nodeName).toBe('SPAN')
  })
})
