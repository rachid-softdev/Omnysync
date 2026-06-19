/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import SyncDetailPage from '../../(dashboard)/dashboard/sync/[id]/page'

const mockNotFound = vi.hoisted(() => vi.fn())

vi.mock('next/navigation', () => ({
  notFound: mockNotFound,
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

vi.mock('lucide-react', () => ({
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
}))

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

  it('renders status card with progress', async () => {
    const { prisma } = await import('@/lib/prisma')
    ;(prisma.syncLog.findMany as any).mockResolvedValueOnce([])
    ;(prisma.document.findUnique as any).mockResolvedValueOnce(mockDocument)

    const element = await SyncDetailPage({ params: Promise.resolve({ id: 'doc-1' }) })
    render(element)

    expect(screen.getByText('Synced')).toBeInTheDocument()
    expect(screen.getByText('100%')).toBeInTheDocument()
    expect(screen.getByText('Progress')).toBeInTheDocument()
  })

  it('renders sync steps with all completed status', async () => {
    const { prisma } = await import('@/lib/prisma')
    ;(prisma.syncLog.findMany as any).mockResolvedValueOnce([])
    ;(prisma.document.findUnique as any).mockResolvedValueOnce(mockDocument)

    const element = await SyncDetailPage({ params: Promise.resolve({ id: 'doc-1' }) })
    render(element)

    expect(screen.getByText('Sync Steps')).toBeInTheDocument()
    expect(screen.getByText('Content Retrieval')).toBeInTheDocument()
    expect(screen.getByText('HTML Parsing')).toBeInTheDocument()
    expect(screen.getByText('AI Enrichment')).toBeInTheDocument()
    expect(screen.getByText('Image Upload')).toBeInTheDocument()
    expect(screen.getByText('Publishing')).toBeInTheDocument()
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
