import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import AdminOverridesPage from '../../(dashboard)/admin/overrides/page'

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const mockOverrides = {
  data: [
    {
      id: '1',
      scope: 'ORG' as const,
      scopeId: 'org-1',
      featureKey: 'EXPORT_PDF',
      enabled: true,
      limitValue: null,
      expiresAt: null,
      reason: 'Business need',
      createdAt: '2026-01-01T00:00:00Z',
    },
    {
      id: '2',
      scope: 'USER' as const,
      scopeId: 'user-42',
      featureKey: 'MAX_CONNECTORS',
      enabled: false,
      limitValue: 50,
      expiresAt: '2026-12-31T00:00:00Z',
      reason: 'Campaign trial',
      createdAt: '2026-06-01T00:00:00Z',
    },
  ],
  pagination: { page: 1, limit: 20, total: 2, totalPages: 1 },
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AdminOverridesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = vi.fn()
  })

  it('affiche le titre "Entitlement Overrides"', async () => {
    ;(global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockOverrides,
    })

    render(<AdminOverridesPage />)

    await waitFor(() => {
      expect(screen.getByText('Entitlement Overrides')).toBeInTheDocument()
    })
  })

  it('affiche la description du header', async () => {
    ;(global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockOverrides,
    })

    render(<AdminOverridesPage />)

    await waitFor(() => {
      expect(
        screen.getByText('Override feature entitlements for specific organizations or users')
      ).toBeInTheDocument()
    })
  })

  it('affiche la liste des overrides dans le tableau', async () => {
    ;(global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockOverrides,
    })

    render(<AdminOverridesPage />)

    await waitFor(() => {
      expect(screen.getByText('EXPORT_PDF')).toBeInTheDocument()
      expect(screen.getByText('MAX_CONNECTORS')).toBeInTheDocument()
      expect(screen.getByText('org-1')).toBeInTheDocument()
      expect(screen.getByText('user-42')).toBeInTheDocument()
    })
  })

  it('affiche les badges de scope (ORG, USER)', async () => {
    ;(global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockOverrides,
    })

    render(<AdminOverridesPage />)

    await waitFor(() => {
      expect(screen.getByText('ORG')).toBeInTheDocument()
      expect(screen.getByText('USER')).toBeInTheDocument()
    })
  })

  it('affiche les icônes enabled/disabled', async () => {
    ;(global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockOverrides,
    })

    render(<AdminOverridesPage />)

    await waitFor(() => {
      // Le override enabled affiche une coche (Check icon → text-green-500)
      // Le override disabled affiche un X (X icon → text-destructive)
      const checkIcons = document.querySelectorAll('.text-green-500')
      const xIcons = document.querySelectorAll('.text-destructive')
      expect(checkIcons.length).toBeGreaterThan(0)
      expect(xIcons.length).toBeGreaterThan(0)
    })
  })

  it('affiche le loading state initial avec des skeletons', () => {
    ;(global.fetch as any).mockImplementationOnce(() => new Promise(() => {}))

    render(<AdminOverridesPage />)

    const skeletons = document.querySelectorAll('.animate-pulse')
    expect(skeletons.length).toBeGreaterThan(0)
  })

  it("affiche l'error state quand fetch échoue", async () => {
    ;(global.fetch as any).mockResolvedValueOnce({
      ok: false,
      json: async () => ({ message: 'Erreur test' }),
    })

    render(<AdminOverridesPage />)

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

    render(<AdminOverridesPage />)

    await waitFor(() => {
      expect(screen.getByText('Failed to fetch overrides')).toBeInTheDocument()
    })
  })

  it("affiche l'error state quand fetch rejette", async () => {
    ;(global.fetch as any).mockRejectedValueOnce(new Error('Network error'))

    render(<AdminOverridesPage />)

    await waitFor(() => {
      expect(screen.getByText('Network error')).toBeInTheDocument()
    })
  })

  it("affiche l'error state avec message par défaut pour erreur non-Error", async () => {
    ;(global.fetch as any).mockRejectedValueOnce('String error')

    render(<AdminOverridesPage />)

    await waitFor(() => {
      expect(screen.getByText('An unexpected error occurred')).toBeInTheDocument()
    })
  })

  it("affiche l'empty state quand aucun override", async () => {
    ;(global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: [],
        pagination: { page: 1, limit: 20, total: 0, totalPages: 1 },
      }),
    })

    render(<AdminOverridesPage />)

    await waitFor(() => {
      expect(screen.getByText('No overrides')).toBeInTheDocument()
      expect(
        screen.getByText(
          'Create your first entitlement override to grant or restrict feature access.'
        )
      ).toBeInTheDocument()
    })
  })

  it('le bouton "New Override" est présent dans le header', async () => {
    ;(global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockOverrides,
    })

    render(<AdminOverridesPage />)

    await waitFor(() => {
      expect(screen.getByText('New Override')).toBeInTheDocument()
    })
  })

  it('le champ de filtre orgId est présent', async () => {
    ;(global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockOverrides,
    })

    render(<AdminOverridesPage />)

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Filter by Organization ID...')).toBeInTheDocument()
    })
  })

  it('le filtre orgId déclenche un re-fetch avec le paramètre', async () => {
    const mockFetch = vi.fn()
    global.fetch = mockFetch

    // Premier appel (montage) — retourne toutes les overrides
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockOverrides,
    })

    render(<AdminOverridesPage />)

    await waitFor(() => {
      expect(screen.getByText('EXPORT_PDF')).toBeInTheDocument()
    })

    // Le premier fetch ne doit pas contenir orgId
    expect(mockFetch).toHaveBeenNthCalledWith(1, '/api/admin/overrides?page=1&limit=20')

    // Simuler la saisie d'un orgId
    const filterInput = screen.getByPlaceholderText('Filter by Organization ID...')
    fireEvent.change(filterInput, { target: { value: 'org-1' } })

    // Le changement de filtre déclenche un re-fetch avec le paramètre
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(2)
      expect(mockFetch).toHaveBeenNthCalledWith(
        2,
        '/api/admin/overrides?page=1&limit=20&orgId=org-1'
      )
    })
  })

  it('affiche le bouton Retry en error state', async () => {
    ;(global.fetch as any).mockResolvedValueOnce({
      ok: false,
      json: async () => ({ message: 'DB error' }),
    })

    render(<AdminOverridesPage />)

    await waitFor(() => {
      expect(screen.getByText('Retry')).toBeInTheDocument()
    })
  })

  it('affiche les valeurs limitValue dans le tableau', async () => {
    ;(global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockOverrides,
    })

    render(<AdminOverridesPage />)

    await waitFor(() => {
      // Le premier override a limitValue: null → affiche un tiret
      const dashes = screen.getAllByText('—')
      expect(dashes.length).toBeGreaterThan(0)
      // Le second a limitValue: 50
      expect(screen.getByText('50')).toBeInTheDocument()
    })
  })

  it('affiche les raisons des overrides', async () => {
    ;(global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockOverrides,
    })

    render(<AdminOverridesPage />)

    await waitFor(() => {
      expect(screen.getByText('Business need')).toBeInTheDocument()
      expect(screen.getByText('Campaign trial')).toBeInTheDocument()
    })
  })

  it("affiche le message personnalisé dans l'empty state avec filtre actif", async () => {
    const mockFetch = vi.fn()
    global.fetch = mockFetch

    // Premier appel (montage) - retourne des données vides
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: [],
        pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
      }),
    })

    render(<AdminOverridesPage />)

    await waitFor(() => {
      expect(screen.getByText('No overrides')).toBeInTheDocument()
    })

    // Deuxième appel (après filtre) - retourne aussi vide
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: [],
        pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
      }),
    })

    // Tape un orgId pour voir le message personnalisé
    const filterInput = screen.getByPlaceholderText('Filter by Organization ID...')
    fireEvent.change(filterInput, { target: { value: 'org-999' } })

    // Après le re-fetch avec orgId, le message change
    await waitFor(() => {
      expect(screen.getByText('No overrides found for this organization.')).toBeInTheDocument()
    })
  })

  it('affiche les dates de création formatées', async () => {
    ;(global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockOverrides,
    })

    render(<AdminOverridesPage />)

    await waitFor(() => {
      // La date formatée dépend du fuseau horaire d'exécution
      // Au moins 2 cellules contiennent "2026" (createdAt + createdAt + expiresAt)
      const dates = screen.getAllByText(/2026/)
      expect(dates.length).toBeGreaterThanOrEqual(2)
    })
  })

  it('affiche le badge expired pour les overrides expirées', async () => {
    const pastExpiry = {
      ...mockOverrides,
      data: [
        {
          ...mockOverrides.data[0],
          expiresAt: '2025-01-01T00:00:00Z', // Dans le passé
        },
      ],
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
    }

    ;(global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => pastExpiry,
    })

    render(<AdminOverridesPage />)

    await waitFor(() => {
      expect(screen.getByText(/(expired)/)).toBeInTheDocument()
    })
  })
})
