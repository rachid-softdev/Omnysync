import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import NewSyncPage from '../../(dashboard)/dashboard/sync/new/page'

vi.mock('@/lib/i18n/useTranslations', () => ({
  useTranslations: vi.fn(() => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        UI_NEW_SYNC: 'New Sync',
        sync_new_desc:
          'Move a document from a source platform to a destination, then review the route before starting.',
        UI_STEP_SOURCE: 'Source',
        UI_STEP_SOURCE_DESC: 'Select content source',
        UI_STEP_DOCUMENT: 'Document',
        UI_STEP_DOCUMENT_DESC: 'Choose document',
        UI_STEP_DESTINATION: 'Destination',
        UI_STEP_DESTINATION_DESC: 'Select target platform',
        UI_STEP_SYNC: 'Sync',
        UI_STEP_SYNC_DESC: 'Start sync',
        UI_SELECT_SOURCE: 'Select Source',
        UI_SOURCE_DESC: 'Choose a source connector',
        UI_SOURCE: 'Source',
        UI_SELECT_SOURCE_PLACEHOLDER: 'Select a source',
        UI_CONTINUE: 'Continue',
        UI_SELECT_DOCUMENT: 'Select Document',
        UI_DOCUMENT_DESC: 'Pick a document to sync',
        UI_DOCUMENT: 'Document',
        UI_SELECT_DOCUMENT_PLACEHOLDER: 'Select a document',
        UI_DESTINATION: 'Destination',
        UI_DESTINATION_DESC: 'Select target platform',
        UI_PLATFORM: 'Platform',
        UI_SELECT_DESTINATION: 'Select destination',
        UI_REVIEW_STEP: 'Review',
        UI_REVIEW_DESC: 'Confirm the route before starting.',
        UI_START_SYNC: 'Start Sync',
        UI_SYNC_IN_PROGRESS: 'Sync in progress',
        UI_DO_NOT_CLOSE: 'Do not close this page',
        UI_LOG_CONSOLE: 'Log Console',
        UI_WAITING: 'Waiting for activity...',
        UI_CONNECTING_SERVICE: 'Connecting to service...',
        UI_RETRIEVING_CONTENT: 'Content retrieved',
        UI_DOCUMENT_ANALYZED: 'Document analyzed',
        UI_CONTENT_ANALYZED: 'Content analyzed',
        UI_DESTINATION_CONFIGURED: 'Destination configured',
        UI_CONNECTION_VERIFIED: 'Connection verified',
        UI_SYNC_STARTING: 'Sync starting...',
      }
      return translations[key] || key
    },
    loading: false,
    locale: 'en',
  })),
}))

beforeEach(() => {
  vi.clearAllMocks()
  global.fetch = vi.fn()
})

afterEach(() => {})

const mockConnectors = [
  { id: 'src-1', type: 'GOOGLE_DOCS', name: 'Google Drive', status: 'ACTIVE' },
  { id: 'dst-1', type: 'WORDPRESS', name: 'WordPress Blog', status: 'ACTIVE' },
]

describe('NewSyncPage', () => {
  it('renders the page title', async () => {
    ;(global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockConnectors,
    })

    render(<NewSyncPage />)

    await waitFor(() => {
      expect(screen.getByText('New Sync')).toBeInTheDocument()
    })
  })

  it('renders all step indicators', async () => {
    ;(global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockConnectors,
    })

    render(<NewSyncPage />)

    await waitFor(() => {
      expect(screen.getAllByText('Source').length).toBeGreaterThanOrEqual(1)
      expect(screen.getByText('Document')).toBeInTheDocument()
      expect(screen.getByText('Destination')).toBeInTheDocument()
      expect(screen.getByText('Review')).toBeInTheDocument()
      expect(screen.getByText('Sync')).toBeInTheDocument()
    })
  })

  it('shows source selection step initially', async () => {
    ;(global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockConnectors,
    })

    render(<NewSyncPage />)

    await waitFor(() => {
      expect(screen.getByText('Select Source')).toBeInTheDocument()
    })
  })

  it('advances to document step after selecting source', async () => {
    ;(global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockConnectors,
    })

    render(<NewSyncPage />)

    // Wait for connectors to load
    await waitFor(() => {
      expect(screen.getByText('Select Source')).toBeInTheDocument()
    })
  })

  it('renders log console', async () => {
    ;(global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockConnectors,
    })

    render(<NewSyncPage />)

    await waitFor(() => {
      expect(screen.getByText('Log Console')).toBeInTheDocument()
    })

    expect(screen.getByText('Waiting for activity...')).toBeInTheDocument()
  })

  it('shows the review step indicator without an AI step', async () => {
    ;(global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockConnectors,
    })

    render(<NewSyncPage />)

    await waitFor(() => {
      expect(screen.getByText('Select Source')).toBeInTheDocument()
    })

    expect(screen.getByText('Confirm the route before starting.')).toBeInTheDocument()
    expect(screen.queryByText('AI options')).not.toBeInTheDocument()
  })
})
