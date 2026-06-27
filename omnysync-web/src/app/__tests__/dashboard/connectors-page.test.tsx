import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import ConnectorsPage from '../../(dashboard)/dashboard/connectors/page'

vi.mock('@/lib/i18n/useTranslations', () => ({
  useTranslations: vi.fn(() => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        UI_CONNECTORS: 'Connectors',
        UI_MANAGE_CONNECTORS: 'Manage your connectors',
        UI_REFRESH: 'Refresh',
        UI_SOURCES: 'Sources',
        UI_SOURCES_DESC: 'Import content from these platforms',
        UI_DESTINATIONS: 'Destinations',
        UI_DESTINATIONS_DESC: 'Publish content to these platforms',
        UI_MY_CONNECTORS: 'My Connectors',
        UI_CONNECT: 'Connect',
        UI_CONNECTED: 'Connected',
        UI_CONFIGURE: 'Configure',
        UI_CONFIGURED: 'Configured',
        UI_ACTIVE: 'Active',
      }
      return translations[key] || key
    },
    loading: false,
    locale: 'en',
  })),
}))

vi.mock('@/components/connector-icon', () => ({
  ConnectorIcon: ({ type, className }: any) => (
    <span data-testid={`conn-icon-${type?.toLowerCase()}`} className={className}>
      {type}
    </span>
  ),
}))

vi.mock('@/components/connector-dialog', () => ({
  ConnectorDialog: ({ open, type, onClose, onSuccess }: any) =>
    open ? (
      <div data-testid="connector-dialog">
        <span>Configure {type}</span>
        <button onClick={onClose}>Close</button>
        <button onClick={onSuccess}>Refresh</button>
      </div>
    ) : null,
}))

beforeEach(() => {
  vi.clearAllMocks()
  global.fetch = vi.fn()
  // Mock window.location for OAuth redirect
  Object.defineProperty(window, 'location', {
    writable: true,
    value: { href: '' },
  })
  // Mock window.history for URL cleanup
  Object.defineProperty(window, 'history', {
    writable: true,
    value: { replaceState: vi.fn() },
  })
})

const mockConnectors = [
  { id: 'c1', type: 'GOOGLE_DOCS', name: 'My Google Drive', status: 'ACTIVE' },
  { id: 'c2', type: 'WORDPRESS', name: 'My Blog', status: 'ACTIVE' },
]

describe('ConnectorsPage', () => {
  it('shows loading spinner initially', () => {
    ;(global.fetch as any).mockImplementationOnce(() => new Promise(() => {}))

    render(<ConnectorsPage />)
    const spinner = document.querySelector('.animate-spin')
    expect(spinner).toBeInTheDocument()
  })

  it('renders source and destination connector cards', async () => {
    ;(global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockConnectors,
    })

    render(<ConnectorsPage />)

    await waitFor(() => {
      expect(screen.getByText('Sources')).toBeInTheDocument()
      expect(screen.getByText('Destinations')).toBeInTheDocument()
    })

    // Source types should be displayed
    const googleDocses = screen.getAllByText('Google Docs')
    expect(googleDocses.length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('Notion')).toBeInTheDocument()
    expect(screen.getByText('Airtable')).toBeInTheDocument()
    expect(screen.getByText('Contentful')).toBeInTheDocument()

    // Destination types — "WordPress" appears in card + My Connectors section
    expect(screen.getAllByText('WordPress').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('Ghost')).toBeInTheDocument()
    expect(screen.getByText('Webflow')).toBeInTheDocument()
    expect(screen.getByText('Shopify')).toBeInTheDocument()
    expect(screen.getByText('Medium')).toBeInTheDocument()
  })

  it('shows "Connected" for connected sources and "Connect" for unconnected', async () => {
    ;(global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockConnectors,
    })

    render(<ConnectorsPage />)

    await waitFor(() => {
      // Google Docs and WordPress are connected
      const connectedButtons = screen.getAllByText('Connected')
      expect(connectedButtons.length).toBeGreaterThanOrEqual(1)

      // Other sources should show "Connect"
      const connectButtons = screen.getAllByText('Connect')
      expect(connectButtons.length).toBeGreaterThan(0)
    })
  })

  it('renders My Connectors section when connectors exist', async () => {
    ;(global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockConnectors,
    })

    render(<ConnectorsPage />)

    await waitFor(() => {
      expect(screen.getByText('My Connectors')).toBeInTheDocument()
      expect(screen.getByText('My Google Drive')).toBeInTheDocument()
      expect(screen.getByText('My Blog')).toBeInTheDocument()
    })
  })

  it('renders refresh button', async () => {
    ;(global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockConnectors,
    })

    render(<ConnectorsPage />)

    await waitFor(() => {
      expect(screen.getByText('Refresh')).toBeInTheDocument()
    })
  })
})
