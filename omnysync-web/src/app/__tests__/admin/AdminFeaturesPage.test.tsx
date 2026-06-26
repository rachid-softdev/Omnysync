/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import AdminFeaturesPage from '../../(dashboard)/admin/features/page'

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const mockFeatures = {
  data: [
    {
      id: '1',
      key: 'EXPORT_PDF',
      name: 'Export PDF',
      description: null,
      type: 'BOOLEAN' as const,
      defaultConfig: null,
      plans: [{ planId: 'plan-1' }],
    },
    {
      id: '2',
      key: 'MAX_CONNECTORS',
      name: 'Max Connectors',
      description: 'Maximum number of connectors',
      type: 'LIMIT' as const,
      defaultConfig: 10,
      plans: [],
    },
  ],
  pagination: { page: 1, limit: 20, total: 2, totalPages: 1 },
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AdminFeaturesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = vi.fn()
  })

  it('affiche le titre "Features"', async () => {
    ;(global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockFeatures,
    })

    render(<AdminFeaturesPage />)

    await waitFor(() => {
      expect(screen.getByText('Features')).toBeInTheDocument()
    })
  })

  it('affiche la description du header', async () => {
    ;(global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockFeatures,
    })

    render(<AdminFeaturesPage />)

    await waitFor(() => {
      expect(screen.getByText('Manage feature flags and entitlements')).toBeInTheDocument()
    })
  })

  it('affiche la liste des features dans le tableau', async () => {
    ;(global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockFeatures,
    })

    render(<AdminFeaturesPage />)

    await waitFor(() => {
      expect(screen.getByText('EXPORT_PDF')).toBeInTheDocument()
      expect(screen.getByText('MAX_CONNECTORS')).toBeInTheDocument()
      expect(screen.getByText('Export PDF')).toBeInTheDocument()
      expect(screen.getByText('Max Connectors')).toBeInTheDocument()
    })
  })

  it('affiche les types de features (BOOLEAN, LIMIT)', async () => {
    ;(global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockFeatures,
    })

    render(<AdminFeaturesPage />)

    await waitFor(() => {
      expect(screen.getByText('BOOLEAN')).toBeInTheDocument()
      expect(screen.getByText('LIMIT')).toBeInTheDocument()
    })
  })

  it('affiche le nombre de plans associés', async () => {
    ;(global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockFeatures,
    })

    render(<AdminFeaturesPage />)

    await waitFor(() => {
      // EXPORT_PDF a 1 plan, MAX_CONNECTORS a 0 plans
      expect(screen.getByText('1 plan')).toBeInTheDocument()
      expect(screen.getByText('0 plans')).toBeInTheDocument()
    })
  })

  it('affiche le loading state initial avec des skeletons', () => {
    ;(global.fetch as any).mockImplementationOnce(() => new Promise(() => {}))

    render(<AdminFeaturesPage />)

    const skeletons = document.querySelectorAll('.animate-pulse')
    expect(skeletons.length).toBeGreaterThan(0)
  })

  it("affiche l'error state quand fetch échoue", async () => {
    ;(global.fetch as any).mockResolvedValueOnce({
      ok: false,
      json: async () => ({ message: 'Erreur test' }),
    })

    render(<AdminFeaturesPage />)

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

    render(<AdminFeaturesPage />)

    await waitFor(() => {
      expect(screen.getByText('Failed to fetch features')).toBeInTheDocument()
    })
  })

  it("affiche l'error state quand fetch rejette (network error)", async () => {
    ;(global.fetch as any).mockRejectedValueOnce(new Error('Network error'))

    render(<AdminFeaturesPage />)

    await waitFor(() => {
      expect(screen.getByText('Network error')).toBeInTheDocument()
    })
  })

  it("affiche l'error state avec message par défaut pour erreur non-Error", async () => {
    ;(global.fetch as any).mockRejectedValueOnce('String error')

    render(<AdminFeaturesPage />)

    await waitFor(() => {
      expect(screen.getByText('An unexpected error occurred')).toBeInTheDocument()
    })
  })

  it("affiche l'empty state quand aucune feature", async () => {
    ;(global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: [],
        pagination: { page: 1, limit: 20, total: 0, totalPages: 1 },
      }),
    })

    render(<AdminFeaturesPage />)

    await waitFor(() => {
      expect(screen.getByText('No features')).toBeInTheDocument()
      expect(
        screen.getByText('Create your first feature flag to start managing entitlements.')
      ).toBeInTheDocument()
    })
  })

  it('le bouton "New Feature" est présent dans le header', async () => {
    ;(global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockFeatures,
    })

    render(<AdminFeaturesPage />)

    await waitFor(() => {
      expect(screen.getByText('New Feature')).toBeInTheDocument()
    })
  })

  it('la recherche filtre les features par key', async () => {
    ;(global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockFeatures,
    })

    render(<AdminFeaturesPage />)

    await waitFor(() => {
      expect(screen.getByText('EXPORT_PDF')).toBeInTheDocument()
    })

    const searchInput = screen.getByPlaceholderText('Search features...')
    fireEvent.change(searchInput, { target: { value: 'EXPORT' } })

    await waitFor(() => {
      expect(screen.getByText('EXPORT_PDF')).toBeInTheDocument()
      expect(screen.queryByText('MAX_CONNECTORS')).not.toBeInTheDocument()
    })
  })

  it('la recherche filtre les features par name', async () => {
    ;(global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockFeatures,
    })

    render(<AdminFeaturesPage />)

    await waitFor(() => {
      expect(screen.getByText('Max Connectors')).toBeInTheDocument()
    })

    const searchInput = screen.getByPlaceholderText('Search features...')
    fireEvent.change(searchInput, { target: { value: 'Export' } })

    await waitFor(() => {
      expect(screen.getByText('Export PDF')).toBeInTheDocument()
      expect(screen.queryByText('Max Connectors')).not.toBeInTheDocument()
    })
  })

  it('affiche le bouton Retry en error state', async () => {
    ;(global.fetch as any).mockResolvedValueOnce({
      ok: false,
      json: async () => ({ message: 'DB error' }),
    })

    render(<AdminFeaturesPage />)

    await waitFor(() => {
      expect(screen.getByText('Retry')).toBeInTheDocument()
    })
  })

  it("la pagination affiche le nombre total d'éléments", async () => {
    ;(global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockFeatures,
    })

    render(<AdminFeaturesPage />)

    await waitFor(() => {
      expect(screen.getByText(/sur 2/)).toBeInTheDocument()
    })
  })

  it("affiche le bouton New Feature dans l'empty state", async () => {
    ;(global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: [],
        pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
      }),
    })

    render(<AdminFeaturesPage />)

    await waitFor(() => {
      const newFeatureButtons = screen.getAllByText('New Feature')
      expect(newFeatureButtons.length).toBeGreaterThanOrEqual(1)
    })
  })

  it('affiche defaultConfig sous forme JSON quand présent', async () => {
    const featureWithConfig = {
      ...mockFeatures,
      data: [
        {
          ...mockFeatures.data[0],
          defaultConfig: { limit: 5, unit: 'days' },
        },
      ],
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
    }

    ;(global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => featureWithConfig,
    })

    render(<AdminFeaturesPage />)

    await waitFor(() => {
      expect(screen.getByText(/"limit":5/)).toBeInTheDocument()
    })
  })
})
