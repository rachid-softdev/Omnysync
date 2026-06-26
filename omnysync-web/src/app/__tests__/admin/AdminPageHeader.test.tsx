import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AdminPageHeader } from '@/components/admin/admin-page-header'

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AdminPageHeader', () => {
  it('affiche le titre', () => {
    render(<AdminPageHeader title="Features" />)

    expect(screen.getByText('Features')).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Features')
  })

  it('affiche la description quand fournie', () => {
    render(<AdminPageHeader title="Features" description="Manage feature flags and entitlements" />)

    expect(screen.getByText('Manage feature flags and entitlements')).toBeInTheDocument()
  })

  it("n'affiche pas la description quand non fournie", () => {
    render(<AdminPageHeader title="Features" />)

    const description = screen.queryByText('Manage feature flags and entitlements')
    expect(description).not.toBeInTheDocument()
  })

  it('affiche les actions (children) quand fournies', () => {
    render(<AdminPageHeader title="Plans" actions={<button>New Plan</button>} />)

    expect(screen.getByText('New Plan')).toBeInTheDocument()
  })

  it("n'affiche pas le conteneur d'actions quand actions est undefined", () => {
    const { container } = render(<AdminPageHeader title="Plans" />)

    // Le conteneur des actions n'existe pas
    // On vérifie que le seul div enfant du conteneur flex ne contient pas d'actions
    const flexContainer = container.firstChild as HTMLElement
    // Le deuxième enfant potentiel (actions) n'existe pas
    expect(flexContainer.children.length).toBe(1)
  })

  it("n'affiche pas le conteneur d'actions quand actions est null", () => {
    const { container } = render(<AdminPageHeader title="Plans" actions={null} />)

    const flexContainer = container.firstChild as HTMLElement
    expect(flexContainer.children.length).toBe(1)
  })

  it('affiche plusieurs actions', () => {
    render(
      <AdminPageHeader
        title="Overrides"
        actions={
          <>
            <button>New</button>
            <button>Export</button>
          </>
        }
      />
    )

    expect(screen.getByText('New')).toBeInTheDocument()
    expect(screen.getByText('Export')).toBeInTheDocument()
  })

  it('affiche un titre long sans le tronquer', () => {
    const longTitle = 'A very long title that should still be rendered in full'
    render(<AdminPageHeader title={longTitle} />)

    expect(screen.getByText(longTitle)).toBeInTheDocument()
  })

  it('affiche une description vide comme chaîne vide si passée explicitement', () => {
    const { container } = render(<AdminPageHeader title="Test" description="" />)

    // La description vide ne génère pas d'élément <p> supplémentaire
    const paragraphs = container.querySelectorAll('p')
    expect(paragraphs).toHaveLength(0)

    // Le titre est toujours présent
    expect(screen.getByText('Test')).toBeInTheDocument()
  })
})
