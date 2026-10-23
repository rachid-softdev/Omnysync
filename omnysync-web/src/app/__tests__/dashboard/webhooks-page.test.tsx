import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import WebhooksPage from '../../(dashboard)/dashboard/webhooks/page'
import { toast } from '@/components/toast-provider'

vi.mock('@/lib/i18n/useTranslations', () => ({
  useTranslations: vi.fn(() => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        WEBHOOKS_TITLE: 'Webhooks',
        WEBHOOKS_SUBTITLE: 'Manage webhook endpoints',
        WEBHOOKS_CREATE: 'Create webhook',
        WEBHOOKS_CREATE_TITLE: 'New webhook',
        plan_gate_eyebrow: 'PLAN / ACCESS',
        plan_gate_badge: 'UPGRADE REQUIRED',
        plan_gate_cta: 'View plans',
        plan_gate_webhooks_title: 'Webhooks require the Pro plan',
        plan_gate_webhooks_desc: 'Upgrade to Pro to send signed sync events to your endpoints.',
      }
      return translations[key] || key
    },
    loading: false,
    locale: 'en',
  })),
}))

vi.mock('@/components/toast-provider', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

beforeEach(() => {
  vi.clearAllMocks()
  global.fetch = vi.fn()
})

const mockWebhooks = [
  {
    id: 'w1',
    connectorId: 'c1',
    connectorName: 'WordPress - mon-site.com',
    type: 'WORDPRESS',
    url: 'https://mon-site.com/webhook',
    secret: 'sec-123',
    isActive: true,
    createdAt: '2026-05-01T10:00:00Z',
    lastTriggeredAt: '2026-06-01T08:00:00Z',
  },
  {
    id: 'w2',
    connectorId: 'c2',
    connectorName: 'Ghost - mon-blog.ghost.io',
    type: 'GHOST',
    url: 'https://mon-blog.ghost.io/webhook',
    isActive: false,
    createdAt: '2026-04-15T10:00:00Z',
    lastTriggeredAt: undefined,
  },
]

describe('WebhooksPage', () => {
  it('shows loading spinner initially', () => {
    ;(global.fetch as any).mockImplementationOnce(() => new Promise(() => {}))

    render(<WebhooksPage />)
    const spinner = document.querySelector('.animate-spin')
    expect(spinner).toBeInTheDocument()
  })

  it('renders empty state when no webhooks', async () => {
    ;(global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ webhooks: [] }),
    })

    render(<WebhooksPage />)

    await waitFor(() => {
      expect(screen.getByText('No webhooks configured')).toBeInTheDocument()
      // "Create webhook" appears in both the header button and the empty state card
      expect(screen.getAllByText('Create webhook').length).toBeGreaterThanOrEqual(1)
    })
  })

  it('renders a plan gate when the plan lacks webhooks', async () => {
    ;(global.fetch as any).mockResolvedValueOnce({
      ok: false,
      status: 403,
      json: async () => ({ code: 'PLAN_FEATURE_REQUIRED', upgradeUrl: '/pricing' }),
    })

    render(<WebhooksPage />)

    await waitFor(() => {
      expect(screen.getByText('Webhooks require the Pro plan')).toBeInTheDocument()
    })
    expect(screen.getByRole('link', { name: /view plans/i })).toHaveAttribute('href', '/pricing')
    expect(vi.mocked(toast.error)).not.toHaveBeenCalled()
  })

  it('renders webhook list with type and URL', async () => {
    ;(global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ webhooks: mockWebhooks }),
    })

    render(<WebhooksPage />)

    await waitFor(() => {
      expect(screen.getByText('WORDPRESS')).toBeInTheDocument()
      expect(screen.getByText('GHOST')).toBeInTheDocument()
      expect(screen.getByText('https://mon-site.com/webhook')).toBeInTheDocument()
      expect(screen.getByText('https://mon-blog.ghost.io/webhook')).toBeInTheDocument()
    })
  })

  it('shows Active/Inactive badges', async () => {
    ;(global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ webhooks: mockWebhooks }),
    })

    render(<WebhooksPage />)

    await waitFor(() => {
      expect(screen.getByText('Active')).toBeInTheDocument()
      expect(screen.getByText('Inactive')).toBeInTheDocument()
    })
  })

  it('opens create dialog when clicking Create webhook', async () => {
    ;(global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ webhooks: mockWebhooks }),
    })

    render(<WebhooksPage />)

    await waitFor(() => {
      expect(screen.getByText('Webhooks')).toBeInTheDocument()
    })

    // "Create webhook" appears twice (header button + empty state card); pick the first
    const createButton = screen.getAllByText('Create webhook')[0]
    fireEvent.click(createButton)

    await waitFor(() => {
      expect(screen.getByText('New webhook')).toBeInTheDocument()
      expect(
        screen.getByText('Configure an endpoint to receive notifications from your platforms.')
      ).toBeInTheDocument()
    })
  })

  it('shows last triggered info for active webhooks', async () => {
    ;(global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ webhooks: mockWebhooks }),
    })

    render(<WebhooksPage />)

    await waitFor(() => {
      expect(screen.getByText(/Last triggered/)).toBeInTheDocument()
    })
  })
})
