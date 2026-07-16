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

// Mock t() with the strings the test asserts, but fall back to the REAL
// translations (via importOriginal) for any key the page renders that isn't
// listed here. getLocaleFromHeaders comes from the real module automatically.
vi.mock('@/lib/i18n', async (importOriginal) => {
  const actual: any = await importOriginal()
  const translations: Record<string, string> = {
    UI_SYNC: 'Sync',
    UI_SYNC_HISTORY: 'View your sync history',
    UI_RECENT_SYNCS: 'Recent syncs',
    UI_SYNC_HISTORY_TITLE: 'Last sync operations',
    UI_NO_RECENT_SYNC: 'No recent syncs',
    UI_START_SYNC: 'Start a sync',
  }
  return {
    ...actual,
    t: (key: string, locale?: string) => translations[key] || actual.t(key, locale),
  }
})

vi.mock('@/lib/auth/org', () => ({
  getUserOrgId: vi.fn().mockResolvedValue('org-1'),
}))

// The client BatchSyncList uses the useTranslations() hook, which in jsdom
// would normally fetch /api/i18n and fail. Delegate to the (already mocked)
// server i18n module so the same custom + real translations apply here.
vi.mock('@/lib/i18n/useTranslations', async () => {
  const i18n: any = await import('@/lib/i18n')
  return {
    useTranslations: () => ({
      t: (key: string) => i18n.t(key, 'en'),
      loading: false,
      locale: 'en',
    }),
  }
})

vi.mock('@/lib/prisma', () => ({
  prisma: {
    syncLog: {
      findMany: vi.fn().mockResolvedValue([]),
    },
  },
}))

vi.mock('lucide-react', () => {
  const icons: Record<string, any> = {
    RefreshCw: () => <svg data-testid="icon-refresh" />,
    CheckCircle: () => <svg data-testid="icon-checkcircle" />,
    AlertCircle: () => <svg data-testid="icon-alertcircle" />,
    Clock: () => <svg data-testid="icon-clock" />,
    Info: () => <svg data-testid="icon-info" />,
  }
  return new Proxy(icons, {
    get(target, prop) {
      if (typeof prop === 'string' && prop in target) return (target as any)[prop]
      if (typeof prop === 'string' && /^[A-Z]/.test(prop)) {
        return function LucideIcon() {
          return <svg data-testid={`icon-${prop.toLowerCase()}`} />
        }
      }
      return (target as any)[prop]
    },
    has(target, prop) {
      return typeof prop === 'string' ? true : prop in target
    },
  })
})

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

  it('renders recent syncs header and description in empty state', async () => {
    const element = await SyncPage()
    render(element)

    // The sync history page does not render a "Start a sync" CTA (that lives on
    // /dashboard/sync/new). The empty state shows the recent-syncs header instead.
    expect(screen.getByText('Recent syncs')).toBeInTheDocument()
    expect(screen.getByText('Last sync operations')).toBeInTheDocument()
  })

  it('returns null when no user session', async () => {
    const mockAuth = vi.mocked((await import('@/lib/auth')).auth)
    mockAuth.mockResolvedValueOnce({ user: { id: null } } as any)

    const element = await SyncPage()
    expect(element).toBeNull()
  })
})
