/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import DashboardPage from '../../(dashboard)/dashboard/page'

vi.mock('@/lib/auth', () => ({
  auth: vi.fn().mockResolvedValue({
    user: { id: 'user-1', name: 'John Doe', email: 'john@example.com' },
  }),
}))

vi.mock('@/lib/i18n', () => ({
  t: (key: string) => {
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
      UI_DOCS_MARKETING: 'Create a document',
      UI_DESTINATIONS_SETUP: 'Set up destinations',
      UI_FIRST_SYNC: 'Run your first sync',
    }
    return translations[key] || key
  },
}))

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
    expect(threes.length).toBeGreaterThanOrEqual(1) // connector count + step numbers
    expect(threes[0]).toBeInTheDocument()
    expect(screen.getByText('5')).toBeInTheDocument() // synced
    const ones = screen.getAllByText('1')
    expect(ones.length).toBeGreaterThanOrEqual(1) // errors count + step numbers
  })

  it('renders new sync button', async () => {
    const Component = await DashboardPage()
    render(Component)
    expect(screen.getByText('New Sync')).toBeInTheDocument()
  })

  it('renders recent activity section', async () => {
    const Component = await DashboardPage()
    render(Component)
    expect(screen.getByText('Recent Activity')).toBeInTheDocument()
    expect(screen.getByText('Document synced')).toBeInTheDocument()
    expect(screen.getByText('Sync failed')).toBeInTheDocument()
  })

  it('renders getting started section', async () => {
    const Component = await DashboardPage()
    render(Component)
    expect(screen.getByText('Getting Started')).toBeInTheDocument()
  })
})
