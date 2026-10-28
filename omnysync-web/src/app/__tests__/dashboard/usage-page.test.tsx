/* eslint-disable @typescript-eslint/no-require-imports */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import UsagePage from '../../(dashboard)/dashboard/usage/page'

const mockPush = vi.hoisted(() => vi.fn())

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}))

// Mock Radix UI Tabs to support click-based tab switching in jsdom
vi.mock('@/components/ui/tabs', () => {
  const React = require('react')
  const { createContext, useContext, useState } = React

  const TabsContext = createContext<{
    value: string
    onChange: (v: string) => void
  }>({ value: 'overview', onChange: () => {} })

  return {
    Tabs: ({ value, defaultValue, children, className, ...props }: any) => {
      const [current, onChange] = useState(value ?? defaultValue ?? 'overview')
      return (
        <TabsContext.Provider value={{ value: current, onChange }}>
          <div className={className} data-orientation="horizontal" {...props}>
            {children}
          </div>
        </TabsContext.Provider>
      )
    },
    TabsList: ({ children, className, ...props }: any) => (
      <div role="tablist" className={className} aria-orientation="horizontal" {...props}>
        {children}
      </div>
    ),
    TabsTrigger: ({ value: tabValue, children, className, ...props }: any) => {
      const { value, onChange } = useContext(TabsContext)
      return (
        <button
          role="tab"
          className={className}
          data-state={value === tabValue ? 'active' : 'inactive'}
          onClick={() => onChange(tabValue)}
          {...props}
        >
          {children}
        </button>
      )
    },
    TabsContent: ({ value: tabValue, children, className, ...props }: any) => {
      const { value } = useContext(TabsContext)
      if (value !== tabValue) return null
      return (
        <div className={className} {...props}>
          {children}
        </div>
      )
    },
  }
})

beforeEach(() => {
  vi.clearAllMocks()
  Object.defineProperty(window, 'location', {
    value: { href: '' },
    writable: true,
  })
  global.fetch = vi.fn()
})

const usageResponse = {
  ok: true,
  json: async () => ({
    currentPlan: 'Pro',
    billingCycle: { start: '2026-05-01', end: '2026-05-31' },
    syncUsed: 45,
    syncLimit: 100,
    documentsUsed: 20,
    documentsLimit: -1,
    connectorsUsed: 4,
    connectorsLimit: 10,
    teamUsed: 2,
    teamLimit: 5,
    aiSEO: 23,
    aiImages: 12,
    aiInterlinking: 8,
    history: [],
  }),
} as Response

describe('UsagePage', () => {
  it('shows loading spinner initially', () => {
    ;(global.fetch as any).mockImplementationOnce(() => new Promise(() => {}))

    render(<UsagePage />)
    const spinner = document.querySelector('.animate-spin')
    expect(spinner).toBeInTheDocument()
  })

  it('shows an unavailable state instead of invented usage when fetch fails', async () => {
    ;(global.fetch as any).mockResolvedValueOnce({
      ok: false,
      json: async () => ({}),
    })

    render(<UsagePage />)

    await waitFor(() => {
      expect(
        screen.getByText('Unable to load live data. No usage figures are shown.')
      ).toBeInTheDocument()
    })
    expect(screen.queryByText('Plan Pro')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument()
  })

  it('renders plan info banner', async () => {
    ;(global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        currentPlan: 'Business',
        billingCycle: { start: '2026-05-01', end: '2026-05-31' },
        syncUsed: 67,
        syncLimit: 100,
        documentsUsed: 45,
        documentsLimit: -1,
        connectorsUsed: 6,
        connectorsLimit: 10,
        teamUsed: 3,
        teamLimit: 5,
        aiSEO: 23,
        aiImages: 12,
        aiInterlinking: 8,
        history: [],
      }),
    })

    render(<UsagePage />)

    await waitFor(() => {
      expect(screen.getByText('Plan Business')).toBeInTheDocument()
      expect(screen.getByText('Change plan')).toBeInTheDocument()
    })
  })

  it('renders overview tab with usage metrics', async () => {
    ;(global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        currentPlan: 'Pro',
        billingCycle: { start: '2026-05-01', end: '2026-05-31' },
        syncUsed: 45,
        syncLimit: 100,
        documentsUsed: 20,
        documentsLimit: -1,
        connectorsUsed: 4,
        connectorsLimit: 10,
        teamUsed: 2,
        teamLimit: 5,
        aiSEO: 23,
        aiImages: 12,
        aiInterlinking: 8,
        history: [],
      }),
    })

    render(<UsagePage />)

    await waitFor(() => {
      expect(screen.getByText('45')).toBeInTheDocument()
      expect(screen.getByText('/100')).toBeInTheDocument()
      // Documents shows /∞ since limit is -1
      expect(screen.getByText('/∞')).toBeInTheDocument()
    })
  })

  it('renders the AI metadata tab without image or interlinking claims', async () => {
    ;(global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        currentPlan: 'Pro',
        billingCycle: { start: '2026-05-01', end: '2026-05-31' },
        syncUsed: 0,
        syncLimit: 100,
        documentsUsed: 0,
        documentsLimit: -1,
        connectorsUsed: 0,
        connectorsLimit: 10,
        teamUsed: 0,
        teamLimit: 5,
        aiSEO: 15,
        aiImages: 8,
        aiInterlinking: 3,
        history: [],
      }),
    })

    render(<UsagePage />)

    // Wait for data to load, then click AI tab via role
    await waitFor(() => {
      expect(screen.getByText('Usage')).toBeInTheDocument()
    })

    const aiTab = screen.getByRole('tab', { name: 'AI' })
    fireEvent.click(aiTab)

    await waitFor(() => {
      expect(screen.getByText('AI Usage')).toBeInTheDocument()
      expect(screen.getByText('15')).toBeInTheDocument()
      expect(
        screen.getByText('AI metadata is in beta and is not included in plan limits.')
      ).toBeInTheDocument()
    })
    expect(screen.queryByText('Images')).not.toBeInTheDocument()
    expect(screen.queryByText('Interlinking')).not.toBeInTheDocument()
  })

  it('opens the Stripe billing portal when changing plan', async () => {
    ;(global.fetch as any).mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/api/usage')) return usageResponse
      if (url.includes('/api/stripe/portal')) {
        return {
          ok: true,
          json: async () => ({ url: 'https://stripe.com/portal/sess_123' }),
        }
      }
      return { ok: true, json: async () => ({}) }
    })

    render(<UsagePage />)

    fireEvent.click(await screen.findByText('Change plan'))

    await waitFor(() => {
      expect(window.location.href).toBe('https://stripe.com/portal/sess_123')
    })
  })

  it('falls back to pricing when the billing portal is unavailable', async () => {
    ;(global.fetch as any).mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/api/usage')) return usageResponse
      if (url.includes('/api/stripe/portal')) return { ok: false, status: 404 }
      return { ok: true, json: async () => ({}) }
    })

    render(<UsagePage />)

    fireEvent.click(await screen.findByText('Change plan'))

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/pricing')
    })
  })

  it('renders history tab with monthly data', async () => {
    ;(global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        currentPlan: 'Pro',
        billingCycle: { start: '2026-05-01', end: '2026-05-31' },
        syncUsed: 0,
        syncLimit: 100,
        documentsUsed: 0,
        documentsLimit: -1,
        connectorsUsed: 0,
        connectorsLimit: 10,
        teamUsed: 0,
        teamLimit: 5,
        aiSEO: 0,
        aiImages: 0,
        aiInterlinking: 0,
        history: [
          { month: '2026-05', syncs: 67, documents: 45, aiCalls: 43 },
          { month: '2026-04', syncs: 52, documents: 38, aiCalls: 31 },
        ],
      }),
    })

    render(<UsagePage />)

    // Wait for data to load
    await waitFor(() => {
      expect(screen.getByText('Usage')).toBeInTheDocument()
    })

    const historyTab = screen.getByRole('tab', { name: 'History' })
    fireEvent.click(historyTab)

    await waitFor(() => {
      expect(screen.getByText('Usage History')).toBeInTheDocument()
      expect(screen.getByText('May 2026')).toBeInTheDocument()
      expect(screen.getByText('April 2026')).toBeInTheDocument()
    })
  })
})
