import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import SyncDetailPage from '../../(dashboard)/dashboard/sync/[id]/page'

const mockNotFound = vi.hoisted(() => vi.fn())
const localeState = vi.hoisted(() => ({ lang: 'en' }))

vi.mock('next/headers', () => ({
  headers: vi.fn(async () => new Headers({ 'Accept-Language': localeState.lang })),
}))

vi.mock('next/navigation', () => ({
  notFound: mockNotFound,
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}))

vi.mock('next/link', () => ({
  default: ({ children, href }: any) => <a href={href}>{children}</a>,
}))

vi.mock('@/lib/auth', () => ({
  auth: vi.fn().mockResolvedValue({
    user: { id: 'user-1', name: 'John Doe', email: 'john@example.com' },
  }),
}))

vi.mock('@/lib/auth/org', () => ({
  getUserOrgId: vi.fn().mockResolvedValue('org-1'),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    syncLog: {
      findMany: vi.fn(),
    },
    document: {
      findUnique: vi.fn(),
    },
  },
}))

vi.mock('lucide-react', () => {
  const icons: Record<string, any> = {
    ArrowLeft: () => <svg data-testid="icon-arrowleft" />,
    RefreshCw: () => <svg data-testid="icon-refresh" />,
    CheckCircle: () => <svg data-testid="icon-checkcircle" />,
    AlertCircle: () => <svg data-testid="icon-alertcircle" />,
    Clock: () => <svg data-testid="icon-clock" />,
    FileText: () => <svg data-testid="icon-filetxt" />,
    Database: () => <svg data-testid="icon-database" />,
    Wand2: () => <svg data-testid="icon-wand" />,
    Upload: () => <svg data-testid="icon-upload" />,
    Send: () => <svg data-testid="icon-send" />,
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
  })
})

vi.mock('@/components/connector-icon', () => ({
  ConnectorIcon: ({ type, className }: any) => (
    <span data-testid={`connector-icon-${type?.toLowerCase()}`} className={className}>
      {type}
    </span>
  ),
}))

beforeEach(() => {
  vi.clearAllMocks()
  mockNotFound.mockReset()
  localeState.lang = 'en'
})

const mockDocument = {
  id: 'doc-1',
  title: 'Sync Test Document',
  syncStatus: 'SYNCED',
  version: 2,
  lastSyncedAt: new Date('2026-06-01T12:00:00Z'),
  lastSyncError: null,
  sourceConnectorId: 'src-1',
  destConnectorId: 'dst-1',
  organizationId: 'org-1',
  sourceConnector: { type: 'GOOGLE_DOCS', name: 'My Google Drive' },
  destConnector: { type: 'WORDPRESS', name: 'My Blog' },
  syncLogs: [] as any[],
  document: null as any,
  action: 'sync' as string,
  message: '' as string,
  status: '' as string,
  createdAt: new Date() as Date,
}

const completedSyncLogs = [
  {
    id: 'log-start',
    status: 'INFO',
    action: 'sync_started',
    message: 'Sync started',
    createdAt: new Date('2026-06-01T10:00:00Z'),
  },
  {
    id: 'log-fetch',
    status: 'INFO',
    action: 'fetch_content_completed',
    message: 'Content fetched',
    createdAt: new Date('2026-06-01T10:00:01Z'),
  },
  {
    id: 'log-parse',
    status: 'INFO',
    action: 'parsing_html_completed',
    message: 'HTML generated',
    createdAt: new Date('2026-06-01T10:00:02Z'),
  },
  {
    id: 'log-ai',
    status: 'INFO',
    action: 'ai_enrichment_skipped',
    message: 'AI enrichment is disabled for this run',
    createdAt: new Date('2026-06-01T10:00:03Z'),
  },
  {
    id: 'log-publish',
    status: 'SUCCESS',
    action: 'sync_completed',
    message: 'Sync completed',
    createdAt: new Date('2026-06-01T10:00:04Z'),
  },
]

describe('SyncDetailPage', () => {
  it('renders header with document title and back button', async () => {
    const { prisma } = await import('@/lib/prisma')
    ;(prisma.syncLog.findMany as any).mockResolvedValueOnce([])
    ;(prisma.document.findUnique as any).mockResolvedValueOnce(mockDocument)

    const element = await SyncDetailPage({ params: Promise.resolve({ id: 'doc-1' }) })
    render(element)

    expect(screen.getByText('Sync Details')).toBeInTheDocument()
    expect(screen.getByText('Sync Test Document')).toBeInTheDocument()
    expect(screen.getByText('Back')).toBeInTheDocument()
  })

  it('derives progress from the latest sync logs', async () => {
    const { prisma } = await import('@/lib/prisma')
    ;(prisma.syncLog.findMany as any).mockResolvedValueOnce(completedSyncLogs)
    ;(prisma.document.findUnique as any).mockResolvedValueOnce(mockDocument)

    const element = await SyncDetailPage({ params: Promise.resolve({ id: 'doc-1' }) })
    render(element)

    expect(screen.getByText('Synced')).toBeInTheDocument()
    expect(screen.getByText('100%')).toBeInTheDocument()
    expect(screen.getByText('Progress')).toBeInTheDocument()
  })

  it('renders only real sync steps and marks skipped AI explicitly', async () => {
    const { prisma } = await import('@/lib/prisma')
    ;(prisma.syncLog.findMany as any).mockResolvedValueOnce(completedSyncLogs)
    ;(prisma.document.findUnique as any).mockResolvedValueOnce(mockDocument)

    const element = await SyncDetailPage({ params: Promise.resolve({ id: 'doc-1' }) })
    render(element)

    expect(screen.getByText('Sync Steps')).toBeInTheDocument()
    expect(screen.getByText('Content Retrieval')).toBeInTheDocument()
    expect(screen.getByText('HTML Parsing')).toBeInTheDocument()
    expect(screen.getByText('AI Enrichment')).toBeInTheDocument()
    expect(screen.getByText('Skipped — AI enrichment disabled')).toBeInTheDocument()
    expect(screen.getByText('Publishing')).toBeInTheDocument()
    expect(screen.queryByText('Image Upload')).not.toBeInTheDocument()
  })

  it('renders source and destination connector info', async () => {
    const { prisma } = await import('@/lib/prisma')
    ;(prisma.syncLog.findMany as any).mockResolvedValueOnce([])
    ;(prisma.document.findUnique as any).mockResolvedValueOnce(mockDocument)

    const element = await SyncDetailPage({ params: Promise.resolve({ id: 'doc-1' }) })
    render(element)

    expect(screen.getByText('Source')).toBeInTheDocument()
    expect(screen.getByText('Destination')).toBeInTheDocument()
    expect(screen.getByText('My Google Drive')).toBeInTheDocument()
    expect(screen.getByText('My Blog')).toBeInTheDocument()
  })

  it('renders error card when sync failed', async () => {
    const { prisma } = await import('@/lib/prisma')
    ;(prisma.syncLog.findMany as any).mockResolvedValueOnce([])
    ;(prisma.document.findUnique as any).mockResolvedValueOnce({
      ...mockDocument,
      syncStatus: 'FAILED',
      lastSyncError: 'Connection timeout',
    })

    const element = await SyncDetailPage({ params: Promise.resolve({ id: 'doc-1' }) })
    render(element)

    expect(screen.getByText('Sync Error')).toBeInTheDocument()
    expect(screen.getByText('Connection timeout')).toBeInTheDocument()
  })

  it('renders log console', async () => {
    const { prisma } = await import('@/lib/prisma')
    ;(prisma.syncLog.findMany as any).mockResolvedValueOnce([
      {
        id: 'log-1',
        status: 'INFO',
        action: 'start',
        message: 'Sync started',
        createdAt: new Date('2026-06-01T10:00:00Z'),
      },
    ])
    ;(prisma.document.findUnique as any).mockResolvedValueOnce(mockDocument)

    const element = await SyncDetailPage({ params: Promise.resolve({ id: 'doc-1' }) })
    render(element)

    expect(screen.getByText('Log Console')).toBeInTheDocument()
    expect(screen.getByText(/Sync started/)).toBeInTheDocument()
    // Legacy logs without a `sync_started` marker cannot be attributed to a
    // run, so the empty state must not claim that no logs exist.
    expect(
      screen.getAllByText('No run start recorded in the available logs.').length
    ).toBeGreaterThanOrEqual(1)
    expect(
      screen.queryByText('No execution logs available for this document.')
    ).not.toBeInTheDocument()
  })

  it('shows an honest empty state instead of a fake 0% progress when no run logs exist', async () => {
    const { prisma } = await import('@/lib/prisma')
    ;(prisma.syncLog.findMany as any).mockResolvedValueOnce([])
    ;(prisma.document.findUnique as any).mockResolvedValueOnce({
      ...mockDocument,
      syncStatus: 'SYNCED',
    })

    const element = await SyncDetailPage({ params: Promise.resolve({ id: 'doc-1' }) })
    render(element)

    expect(
      screen.getAllByText('No execution logs available for this document.').length
    ).toBeGreaterThanOrEqual(1)
    expect(screen.queryByText('Progress')).not.toBeInTheDocument()
    expect(screen.queryByText('0%')).not.toBeInTheDocument()
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
  })

  it('uses the latest run over an older completed run', async () => {
    const { prisma } = await import('@/lib/prisma')
    ;(prisma.syncLog.findMany as any).mockResolvedValueOnce([
      {
        id: 'log-new-start',
        status: 'INFO',
        action: 'sync_started',
        message: 'Sync started',
        createdAt: new Date('2026-06-02T10:00:00Z'),
      },
      {
        id: 'log-old-complete',
        status: 'SUCCESS',
        action: 'sync_completed',
        message: 'Sync completed',
        createdAt: new Date('2026-06-01T10:00:00Z'),
      },
    ])
    ;(prisma.document.findUnique as any).mockResolvedValueOnce(mockDocument)

    const element = await SyncDetailPage({ params: Promise.resolve({ id: 'doc-1' }) })
    render(element)

    expect(screen.getByText('Syncing')).toBeInTheDocument()
    expect(screen.queryByText('Synced')).not.toBeInTheDocument()
    expect(screen.getByText('0%')).toBeInTheDocument()
  })

  it('marks the latest failed run as failed even if the document was previously synced', async () => {
    const { prisma } = await import('@/lib/prisma')
    ;(prisma.syncLog.findMany as any).mockResolvedValueOnce([
      {
        id: 'log-new-start',
        status: 'INFO',
        action: 'sync_started',
        message: 'Sync started',
        createdAt: new Date('2026-06-02T10:00:00Z'),
      },
      {
        id: 'log-new-fail',
        status: 'ERROR',
        action: 'sync_failed',
        message: 'Publish failed',
        createdAt: new Date('2026-06-02T10:00:05Z'),
      },
      {
        id: 'log-old-complete',
        status: 'SUCCESS',
        action: 'sync_completed',
        message: 'Sync completed',
        createdAt: new Date('2026-06-01T10:00:00Z'),
      },
    ])
    ;(prisma.document.findUnique as any).mockResolvedValueOnce({
      ...mockDocument,
      lastSyncError: 'Publish failed',
    })

    const element = await SyncDetailPage({ params: Promise.resolve({ id: 'doc-1' }) })
    render(element)

    expect(screen.getByText('Failed')).toBeInTheDocument()
    expect(screen.queryByText('Synced')).not.toBeInTheDocument()
    expect(screen.getByText('Sync Error')).toBeInTheDocument()
    expect(screen.getAllByText(/Publish failed/).length).toBeGreaterThanOrEqual(1)
    expect(screen.queryByText('100%')).not.toBeInTheDocument()
    // The run failed before any step started, so no step should be marked as
    // errored just because the document status is FAILED.
    expect(screen.getAllByText('Pending')).toHaveLength(4)
    expect(screen.queryByText('Error occurred')).not.toBeInTheDocument()
  })

  it('renders French copy when Accept-Language is French', async () => {
    localeState.lang = 'fr'
    const { prisma } = await import('@/lib/prisma')
    ;(prisma.syncLog.findMany as any).mockResolvedValueOnce(completedSyncLogs)
    ;(prisma.document.findUnique as any).mockResolvedValueOnce(mockDocument)

    const element = await SyncDetailPage({ params: Promise.resolve({ id: 'doc-1' }) })
    render(element)

    expect(screen.getByText('Détails de la synchronisation')).toBeInTheDocument()
    expect(screen.getByText('Retour')).toBeInTheDocument()
    expect(screen.getByText('Lancer la synchronisation')).toBeInTheDocument()
    expect(screen.getByText('Progression')).toBeInTheDocument()
    expect(screen.getByText('Étapes de la synchronisation')).toBeInTheDocument()
    expect(screen.getByText('Récupération du contenu')).toBeInTheDocument()
    expect(screen.getByText('Analyse HTML')).toBeInTheDocument()
    expect(screen.getByText('Enrichissement IA')).toBeInTheDocument()
    expect(screen.getByText('Ignoré — enrichissement IA désactivé')).toBeInTheDocument()
    expect(screen.getByText('Publication')).toBeInTheDocument()
  })

  it('calls notFound when document is missing', async () => {
    mockNotFound.mockImplementationOnce(() => {
      throw new Error('NOT_FOUND')
    })

    const { prisma } = await import('@/lib/prisma')
    ;(prisma.syncLog.findMany as any).mockResolvedValueOnce([])
    ;(prisma.document.findUnique as any).mockResolvedValueOnce(null)

    await expect(
      SyncDetailPage({ params: Promise.resolve({ id: 'non-existent' }) })
    ).rejects.toThrow('NOT_FOUND')
    expect(mockNotFound).toHaveBeenCalled()
  })

  it('returns null when no user session', async () => {
    const mockAuth = vi.mocked((await import('@/lib/auth')).auth)
    mockAuth.mockResolvedValueOnce({ user: { id: null } } as any)

    const element = await SyncDetailPage({ params: Promise.resolve({ id: 'doc-1' }) })
    expect(element).toBeNull()
  })
})
