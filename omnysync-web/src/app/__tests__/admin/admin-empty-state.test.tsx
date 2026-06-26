import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AdminEmptyState } from '@/components/admin/admin-empty-state'

describe('AdminEmptyState', () => {
  it('renders the title', () => {
    render(<AdminEmptyState title="Aucun résultat" />)
    expect(screen.getByText('Aucun résultat')).toBeInTheDocument()
  })

  it('renders the optional description', () => {
    render(
      <AdminEmptyState
        title="Aucun utilisateur"
        description="Il n'y a pas encore d'utilisateurs sur la plateforme."
      />
    )
    expect(
      screen.getByText("Il n'y a pas encore d'utilisateurs sur la plateforme.")
    ).toBeInTheDocument()
  })

  it('does not render description when not provided', () => {
    const { container } = render(<AdminEmptyState title="Titre seul" />)
    // Only one paragraph should exist (none for description)
    const paragraphs = container.querySelectorAll('p')
    expect(paragraphs.length).toBe(0)
  })

  it('renders the optional action (button)', () => {
    render(<AdminEmptyState title="Aucune donnée" action={<button>Créer</button>} />)
    expect(screen.getByText('Créer')).toBeInTheDocument()
  })

  it('does not render action when not provided', () => {
    render(<AdminEmptyState title="Sans action" />)
    // The title is still rendered
    expect(screen.getByText('Sans action')).toBeInTheDocument()
    // No button should be present
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('renders a custom icon when provided', () => {
    const CustomIcon = () => <svg data-testid="custom-icon" />
    const { container } = render(
      <AdminEmptyState
        title="Custom Icon"
        icon={CustomIcon as React.ComponentType<{ className?: string }>}
      />
    )
    expect(container.querySelector('[data-testid="custom-icon"]')).toBeInTheDocument()
  })

  it('renders default FileText icon when no icon is provided', () => {
    const { container } = render(<AdminEmptyState title="Default Icon" />)
    // FileText icon from lucide-react renders an SVG with specific attributes
    const svg = container.querySelector('svg')
    expect(svg).toBeInTheDocument()
  })

  it('renders the title in an h3 element', () => {
    render(<AdminEmptyState title="Titre Hiérarchique" />)
    const heading = screen.getByText('Titre Hiérarchique')
    expect(heading.tagName).toBe('H3')
  })
})
