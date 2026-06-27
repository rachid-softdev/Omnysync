import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import SyncPage from '../../(dashboard)/dashboard/sync/page'

vi.mock('next/link', () => ({
  default: ({ children, href }: any) => <a href={href}>{children}</a>,
}))

vi.mock('@/lib/auth', () => ({
  auth: vi.fn().mockResolvedValue({
    user: { id: 'user-1', name: 'John Doe', email: 'john@example.com' },
  }),
}))

vi.mock('@/lib/i18n', () => ({
  t: (key: string) => {
    const translations: Record<string, string> = {
      UI_SYNC: 'Sync',
      UI_SYNC_HISTORY: 'View your sync history',
      UI_RECENT_SYNCS: 'Recent syncs',
      UI_SYNC_HISTORY_TITLE: 'Last sync operations',
      UI_NO_RECENT_SYNC: 'No recent syncs',
      UI_START_SYNC: 'Start a sync',
    }
    return translations[key] || key
  },
}))

vi.mock('@/lib/auth/org', () => ({
  getUserOrgId: vi.fn().mockResolvedValue('org-1'),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    syncLog: {
      findMany: vi.fn().mockResolvedValue([]),
    },
  },
}))

vi.mock('lucide-react', () => ({
  RefreshCw: () => <svg data-testid="icon-refresh" />,
  CheckCircle: () => <svg data-testid="icon-checkcircle" />,
  AlertCircle: () => <svg data-testid="icon-alertcircle" />,
  Clock: () => <svg data-testid="icon-clock" />,
}))

beforeEach(() => {
  vi.clearAllMocks()
})

describe('SyncPage', () => {
  it('renders title and description', async () => {
    const element = await SyncPage()
    render(element)

    expect(screen.getByText('Sync')).toBeInTheDocument()
    expect(screen.getByText('View your sync history')).toBeInTheDocument()
  })

  it('renders empty state when no sync logs', async () => {
    const element = await SyncPage()
    render(element)

    expect(screen.getByText('No recent syncs')).toBeInTheDocument()
    expect(screen.getByText('Start a sync')).toBeInTheDocument()
  })

  it('renders sync log entries with status badges', async () => {
    const { prisma } = await import('@/lib/prisma')
    // Use mockResolvedValueOnce so the default [] mock is restored after this test
    ;(prisma.syncLog.findMany as any).mockResolvedValueOnce([
      {
        id: 'log-1',
        status: 'SUCCESS',
        action: 'publish',
        message: 'Document published',
        createdAt: new Date('2026-06-01T10:00:00Z'),
        document: { id: 'doc-1', title: 'My Article' },
      },
      {
        id: 'log-2',
        status: 'ERROR',
        action: 'sync',
        message: 'Connection failed',
        createdAt: new Date('2026-06-01T09:00:00Z'),
        document: null,
      },
    ])

    const element = await SyncPage()
    render(element)

    expect(screen.getByText('My Article')).toBeInTheDocument()
    // log-2 has document:null so the action "sync" is shown as the title text
    expect(screen.getByText('sync')).toBeInTheDocument()
    expect(screen.getByText('SUCCESS')).toBeInTheDocument()
    expect(screen.getByText('ERROR')).toBeInTheDocument()
    expect(screen.getByText('Connection failed')).toBeInTheDocument()
  })

  it('renders "Start a sync" link button in empty state', async () => {
    const element = await SyncPage()
    render(element)

    const link = screen.getByText('Start a sync').closest('a')
    expect(link).toHaveAttribute('href', '/dashboard/sync/new')
  })

  it('returns null when no user session', async () => {
    const mockAuth = vi.mocked((await import('@/lib/auth')).auth)
    mockAuth.mockResolvedValueOnce({ user: { id: null } } as any)

    const element = await SyncPage()
    expect(element).toBeNull()
  })
})
