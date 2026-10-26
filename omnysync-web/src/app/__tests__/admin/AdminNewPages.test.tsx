import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import NewFeaturePage from '@/app/(dashboard)/admin/features/new/page'
import NewOverridePage from '@/app/(dashboard)/admin/overrides/new/page'
import NewPlanPage from '@/app/(dashboard)/admin/plans/new/page'

const push = vi.fn()

beforeAll(() => {
  if (!globalThis.ResizeObserver) {
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver
  }
})

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
}))

vi.mock('@/components/toast-provider', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

describe('Admin new record pages', () => {
  beforeEach(() => {
    document.documentElement.lang = 'en'
    push.mockClear()
  })

  afterEach(() => {
    document.documentElement.lang = 'en'
  })

  it('renders the English titles and submit actions', () => {
    const { unmount } = render(<NewFeaturePage />)
    expect(screen.getByRole('heading', { level: 1, name: 'New Feature' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Create Feature' })).toBeInTheDocument()
    unmount()

    render(<NewOverridePage />)
    expect(screen.getByRole('heading', { level: 1, name: 'New Override' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Create Override' })).toBeInTheDocument()
    unmount()

    render(<NewPlanPage />)
    expect(screen.getByRole('heading', { level: 1, name: 'New Plan' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Create Plan' })).toBeInTheDocument()
  })

  it('renders the French titles and field labels', () => {
    document.documentElement.lang = 'fr'

    const { unmount } = render(<NewFeaturePage />)
    expect(
      screen.getByRole('heading', { level: 1, name: 'Nouvelle fonctionnalité' })
    ).toBeInTheDocument()
    expect(screen.getByLabelText(/Clé/)).toBeInTheDocument()
    expect(screen.getByLabelText(/Nom/)).toBeInTheDocument()
    unmount()

    render(<NewOverridePage />)
    expect(
      screen.getByRole('heading', { level: 1, name: 'Nouvelle dérogation' })
    ).toBeInTheDocument()
    expect(screen.getByRole('combobox')).toBeInTheDocument()
    expect(screen.getAllByText('Organisation').length).toBeGreaterThan(0)
    unmount()

    render(<NewPlanPage />)
    expect(screen.getByRole('heading', { level: 1, name: 'Nouveau forfait' })).toBeInTheDocument()
    expect(screen.getByLabelText(/Prix mensuel/)).toBeInTheDocument()
  })

  it('shows French validation errors for the feature form', () => {
    document.documentElement.lang = 'fr'
    render(<NewFeaturePage />)

    fireEvent.click(screen.getByRole('button', { name: 'Créer la fonctionnalité' }))

    expect(screen.getByText('La clé est requise')).toBeInTheDocument()
    expect(screen.getByText('Le nom est requis')).toBeInTheDocument()
    expect(push).not.toHaveBeenCalled()
  })
})
