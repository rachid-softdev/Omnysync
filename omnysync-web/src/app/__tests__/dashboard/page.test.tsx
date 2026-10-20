import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import DashboardPage from '../../(dashboard)/dashboard/page'

vi.mock('@/lib/auth', () => ({
  auth: vi.fn().mockResolvedValue({
    user: { id: 'user-1', name: 'John Doe', email: 'john@example.com' },
  }),
}))

// Mock t() with the strings the test asserts, but fall back to the REAL
// translations (via importOriginal) for any key the page renders that isn't
// listed here. getLocaleFromHeaders comes from the real module automatically.
vi.mock('@/lib/i18n', async (importOriginal) => {
  const actual: any = await importOriginal()
  const translations: Record<string, string> = {
    UI_DOCS_LABEL: 'Documents',
    UI_CONNECTORS_LABEL: 'Connectors',
    UI_SYNCED: 'Synced',
    UI_ERRORS: 'Errors',
    UI_WELCOME: 'Welcome',
    UI_MANAGE_CONTENT: 'Manage your content',
    UI_NEW_SYNC: 'New Sync',
    UI_RECENT_ACTIVITY: 'Recent Activity',
    UI_LAST_SYNCS: 'Last syncs',
    UI_NO_ACTIVITY: 'No activity yet',
    UI_GETTING_STARTED: 'Getting Started',
    UI_FIRST_STEPS: 'First steps',
    UI_CONSOLE: 'Operations console',
    UI_CONSOLE_META: 'Live · all systems nominal',
    UI_SYNC_RATE_META: 'Synced / total documents',
    UI_RUN_LOG: 'Run log',
    UI_RUN_LOG_META: 'Latest events across your routes',
    UI_ROUTE_SETUP: 'Route setup',
    UI_ROUTE_SETUP_META: 'Three steps to the first sync',
    UI_DOCS_MARKETING: 'Create a document',
    UI_DESTINATIONS_SETUP: 'Set up destinations',
    UI_FIRST_SYNC: 'Run your first sync',
  }
  return {
    ...actual,
    t: (key: string, locale?: string) => translations[key] || actual.t(key, locale),
    getT: async () => (key: string) => translations[key] || actual.t(key),
  }
})

vi.mock('@/lib/auth/org', () => ({
  getUserOrgId: vi.fn().mockResolvedValue('org-1'),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    document: {
      count: vi.fn().mockImplementation(({ where }: any) => {
        if (where.syncStatus === 'SYNCED') return Promise.resolve(5)
        if (where.syncStatus === 'FAILED') return Promise.resolve(1)
        return Promise.resolve(10)
      }),
    },
    connector: {
      count: vi.fn().mockResolvedValue(3),
    },
    syncLog: {
      findMany: vi.fn().mockResolvedValue([
        {
          id: 'log-1',
          status: 'SUCCESS',
          message: 'Document synced',
          createdAt: new Date('2026-06-01'),
        },
        { id: 'log-2', status: 'ERROR', message: 'Sync failed', createdAt: new Date('2026-06-01') },
      ]),
    },
  },
}))

describe('DashboardPage', () => {
  it('renders welcome message with user name', async () => {
    const Component = await DashboardPage()
    render(Component)
    expect(screen.getByText(/Welcome/)).toBeInTheDocument()
  })

  it('renders stat cards', async () => {
    const Component = await DashboardPage()
    render(Component)
    expect(screen.getByText('10')).toBeInTheDocument() // doc count
    const threes = screen.getAllByText('3')
    expect(threes.length).toBeGreaterThanOrEqual(1) // connector count
    expect(threes[0]).toBeInTheDocument()
    expect(screen.getAllByText(/5 \/ 10/).length).toBeGreaterThan(0) // synced / total
    const ones = screen.getAllByText('1')
    expect(ones.length).toBeGreaterThanOrEqual(1) // errors count
  })

  it('renders new sync button', async () => {
    const Component = await DashboardPage()
    render(Component)
    expect(screen.getByText('New Sync')).toBeInTheDocument()
  })

  it('renders the run log', async () => {
    const Component = await DashboardPage()
    render(Component)
    expect(screen.getByText('Run log')).toBeInTheDocument()
    expect(screen.getByText('Document synced')).toBeInTheDocument()
    expect(screen.getByText('Sync failed')).toBeInTheDocument()
  })

  it('renders route setup progress', async () => {
    const Component = await DashboardPage()
    render(Component)
    expect(screen.getByText('Route setup')).toBeInTheDocument()
    expect(screen.getByText('3/3')).toBeInTheDocument()
  })
})
