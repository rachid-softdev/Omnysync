import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import AdminDowngradePreviewPage from '@/app/(dashboard)/admin/orgs/[id]/downgrade/page'

beforeAll(() => {
  if (!globalThis.ResizeObserver) {
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver
  }
})

describe('Admin downgrade preview page', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ data: [{ key: 'free', name: 'Free' }] }),
      })
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    document.documentElement.lang = 'en'
  })

  it('renders the English selector and empty state', async () => {
    document.documentElement.lang = 'en'
    await act(async () => {
      render(<AdminDowngradePreviewPage params={Promise.resolve({ id: 'org-1' })} />)
    })

    expect(screen.getByRole('heading', { level: 1, name: 'Downgrade Preview' })).toBeInTheDocument()
    expect(await screen.findByText('Select a plan…')).toBeInTheDocument()
    expect(screen.getByText('Select a target plan')).toBeInTheDocument()
    expect(screen.getByText('Select a plan')).toBeInTheDocument()
  })

  it('renders the French selector and empty state', async () => {
    document.documentElement.lang = 'fr'
    await act(async () => {
      render(<AdminDowngradePreviewPage params={Promise.resolve({ id: 'org-1' })} />)
    })

    expect(
      screen.getByRole('heading', { level: 1, name: 'Aperçu du downgrade' })
    ).toBeInTheDocument()
    expect(await screen.findByText('Sélectionner un forfait…')).toBeInTheDocument()
    expect(screen.getByText('Sélectionner un forfait cible')).toBeInTheDocument()
    expect(screen.getByText('Sélectionnez un forfait')).toBeInTheDocument()
  })
})
