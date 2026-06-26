/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import AdminPlansPage from '../../(dashboard)/admin/plans/page'

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const mockPlans = {
  data: [
    {
      id: '1',
      key: 'free',
      name: 'Free',
      priceMonthly: 0,
      priceYearly: 0,
      isActive: true,
      sortOrder: 1,
      features: [],
    },
    {
      id: '2',
      key: 'pro',
      name: 'Pro',
      priceMonthly: 29,
      priceYearly: 290,
      isActive: true,
      sortOrder: 2,
      features: [{ featureId: 'feat-1' }],
    },
  ],
  pagination: { page: 1, limit: 20, total: 2, totalPages: 1 },
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AdminPlansPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = vi.fn()
  })

  it('affiche le titre "Plans"', async () => {
    ;(global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockPlans,
    })

    render(<AdminPlansPage />)

    await waitFor(() => {
      expect(screen.getByText('Plans')).toBeInTheDocument()
    })
  })

  it('affiche la description du header', async () => {
    ;(global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockPlans,
    })

    render(<AdminPlansPage />)

    await waitFor(() => {
      expect(screen.getByText('Manage subscription plans and pricing')).toBeInTheDocument()
    })
  })

  it('affiche la liste des plans dans le tableau', async () => {
    ;(global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockPlans,
    })

    render(<AdminPlansPage />)

    await waitFor(() => {
      expect(screen.getByText('Free')).toBeInTheDocument()
      expect(screen.getByText('Pro')).toBeInTheDocument()
      expect(screen.getByText('free')).toBeInTheDocument()
      expect(screen.getByText('pro')).toBeInTheDocument()
    })
  })

  it('affiche les prix mensuels formatés', async () => {
    ;(global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockPlans,
    })

    render(<AdminPlansPage />)

    await waitFor(() => {
      // $0.00 apparaît 2 fois (monthly + yearly pour le plan Free)
      const zeroPrices = screen.getAllByText('$0.00')
      expect(zeroPrices.length).toBe(2)
      expect(screen.getByText('$29.00')).toBeInTheDocument()
    })
  })

  it('affiche les prix annuels formatés', async () => {
    ;(global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockPlans,
    })

    render(<AdminPlansPage />)

    await waitFor(() => {
      expect(screen.getByText('$290.00')).toBeInTheDocument()
    })
  })

  it('affiche le nombre de features par plan', async () => {
    ;(global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockPlans,
    })

    render(<AdminPlansPage />)

    await waitFor(() => {
      // Free a 0 features (plural car 0 !== 1), Pro a 1 feature (pas de 's')
      expect(screen.getByText('0 features')).toBeInTheDocument()
      expect(screen.getByText('1 feature')).toBeInTheDocument()
    })
  })

  it('affiche les badges de statut Actif', async () => {
    ;(global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockPlans,
    })

    render(<AdminPlansPage />)

    await waitFor(() => {
      // AdminStatusBadge avec status='active' → label par défaut 'Actif'
      const actifBadges = screen.getAllByText('Actif')
      expect(actifBadges.length).toBe(2)
    })
  })

  it('affiche le loading state initial avec des skeletons', () => {
    ;(global.fetch as any).mockImplementationOnce(() => new Promise(() => {}))

    render(<AdminPlansPage />)

    const skeletons = document.querySelectorAll('.animate-pulse')
    expect(skeletons.length).toBeGreaterThan(0)
  })

  it("affiche l'error state quand fetch échoue", async () => {
    ;(global.fetch as any).mockResolvedValueOnce({
      ok: false,
      json: async () => ({ message: 'Erreur test' }),
    })

    render(<AdminPlansPage />)

    await waitFor(() => {
      expect(screen.getByText('Erreur test')).toBeInTheDocument()
    })
  })

  it("affiche l'error state avec message par défaut si pas de json", async () => {
    ;(global.fetch as any).mockResolvedValueOnce({
      ok: false,
      json: async () => {
        throw new Error()
      },
    })

    render(<AdminPlansPage />)

    await waitFor(() => {
      expect(screen.getByText('Failed to fetch plans')).toBeInTheDocument()
    })
  })

  it("affiche l'error state quand fetch rejette", async () => {
    ;(global.fetch as any).mockRejectedValueOnce(new Error('Network error'))

    render(<AdminPlansPage />)

    await waitFor(() => {
      expect(screen.getByText('Network error')).toBeInTheDocument()
    })
  })

  it("affiche l'error state avec message par défaut pour erreur non-Error", async () => {
    ;(global.fetch as any).mockRejectedValueOnce('String error')

    render(<AdminPlansPage />)

    await waitFor(() => {
      expect(screen.getByText('An unexpected error occurred')).toBeInTheDocument()
    })
  })

  it("affiche l'empty state quand aucun plan", async () => {
    ;(global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: [],
        pagination: { page: 1, limit: 20, total: 0, totalPages: 1 },
      }),
    })

    render(<AdminPlansPage />)

    await waitFor(() => {
      expect(screen.getByText('No plans')).toBeInTheDocument()
      expect(
        screen.getByText('Create your first subscription plan to define feature entitlements.')
      ).toBeInTheDocument()
    })
  })

  it('le bouton "New Plan" est présent dans le header', async () => {
    ;(global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockPlans,
    })

    render(<AdminPlansPage />)

    await waitFor(() => {
      expect(screen.getByText('New Plan')).toBeInTheDocument()
    })
  })

  it('affiche le bouton Retry en error state', async () => {
    ;(global.fetch as any).mockResolvedValueOnce({
      ok: false,
      json: async () => ({ message: 'DB error' }),
    })

    render(<AdminPlansPage />)

    await waitFor(() => {
      expect(screen.getByText('Retry')).toBeInTheDocument()
    })
  })

  it("la pagination affiche le nombre total d'éléments", async () => {
    ;(global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockPlans,
    })

    render(<AdminPlansPage />)

    await waitFor(() => {
      expect(screen.getByText(/sur 2/)).toBeInTheDocument()
    })
  })

  it('affiche le sortOrder pour chaque plan', async () => {
    ;(global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockPlans,
    })

    render(<AdminPlansPage />)

    await waitFor(() => {
      expect(screen.getByText('1')).toBeInTheDocument()
      expect(screen.getByText('2')).toBeInTheDocument()
    })
  })

  it("affiche le bouton New Plan dans l'empty state", async () => {
    ;(global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: [],
        pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
      }),
    })

    render(<AdminPlansPage />)

    await waitFor(() => {
      const newPlanButtons = screen.getAllByText('New Plan')
      expect(newPlanButtons.length).toBeGreaterThanOrEqual(1)
    })
  })

  it('affiche un plan inactif avec le badge Inactif', async () => {
    const plansWithInactive = {
      data: [
        {
          id: '3',
          key: 'legacy',
          name: 'Legacy',
          priceMonthly: null,
          priceYearly: null,
          isActive: false,
          sortOrder: 3,
          features: [],
        },
      ],
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
    }

    ;(global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => plansWithInactive,
    })

    render(<AdminPlansPage />)

    await waitFor(() => {
      expect(screen.getByText('Inactif')).toBeInTheDocument()
    })
  })

  it('affiche un tiret pour les prix null', async () => {
    const plansWithNullPrices = {
      data: [
        {
          id: '3',
          key: 'enterprise',
          name: 'Enterprise',
          priceMonthly: null,
          priceYearly: null,
          isActive: true,
          sortOrder: 3,
          features: [],
        },
      ],
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
    }

    ;(global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => plansWithNullPrices,
    })

    render(<AdminPlansPage />)

    await waitFor(() => {
      const emDashes = screen.getAllByText('—')
      expect(emDashes.length).toBeGreaterThanOrEqual(2)
    })
  })
})
