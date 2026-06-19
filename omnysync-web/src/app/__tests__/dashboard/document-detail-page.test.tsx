/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import DocumentDetailPage from '../../(dashboard)/dashboard/documents/[id]/page'

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
    document: {
      findUnique: vi.fn(),
    },
  },
}))

vi.mock('lucide-react', () => ({
  ArrowLeft: () => <svg data-testid="icon-arrowleft" />,
  RefreshCw: () => <svg data-testid="icon-refresh" />,
  Trash2: () => <svg data-testid="icon-trash" />,
  Edit: () => <svg data-testid="icon-edit" />,
  Calendar: () => <svg data-testid="icon-calendar" />,
  Clock: () => <svg data-testid="icon-clock" />,
  CheckCircle: () => <svg data-testid="icon-checkcircle" />,
  AlertCircle: () => <svg data-testid="icon-alertcircle" />,
}))

beforeEach(() => {
  vi.clearAllMocks()
  mockNotFound.mockReset()
})

const mockDocument = {
  id: 'doc-1',
  title: 'Test Document',
  status: 'PUBLISHED',
  syncStatus: 'SYNCED',
  version: 3,
  htmlContent: '<p>Hello world</p>',
  categories: ['tech'],
  tags: ['guide'],
  excerpt: 'A test document',
  seoTitle: 'Test Doc SEO',
  seoDescription: 'SEO description',
  seoKeywords: ['test', 'document'],
  autoSyncEnabled: true,
  syncFrequency: 'DAILY',
  nextSyncAt: new Date('2026-07-01'),
  lastSyncedAt: new Date('2026-06-01'),
  createdAt: new Date('2026-05-01'),
  updatedAt: new Date('2026-06-01'),
  sourceConnectorId: 'src-1',
  destConnectorId: 'dst-1',
  organizationId: 'org-1',
  sourceConnector: { type: 'GOOGLE_DOCS' },
  destConnector: { type: 'WORDPRESS' },
  syncLogs: [
    {
      id: 'log-1',
      status: 'SUCCESS',
      action: 'publish',
      message: 'Published successfully',
      createdAt: new Date('2026-06-01T10:00:00Z'),
    },
  ],
  organization: {
    users: [{ user: { id: 'u1' }, role: 'OWNER' }],
  },
}

describe('DocumentDetailPage', () => {
  it('renders document title and header info', async () => {
    const { prisma } = await import('@/lib/prisma')
    ;(prisma.document.findUnique as any).mockResolvedValueOnce(mockDocument)

    const element = await DocumentDetailPage({ params: Promise.resolve({ id: 'doc-1' }) })
    render(element)

    expect(screen.getByText('Test Document')).toBeInTheDocument()
    expect(screen.getByText('Back')).toBeInTheDocument()
    expect(screen.getAllByText('Google Docs').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('WordPress').length).toBeGreaterThanOrEqual(1)
  })

  it('renders Edit, Sync and Delete buttons', async () => {
    const { prisma } = await import('@/lib/prisma')
    ;(prisma.document.findUnique as any).mockResolvedValueOnce(mockDocument)

    const element = await DocumentDetailPage({ params: Promise.resolve({ id: 'doc-1' }) })
    render(element)

    expect(screen.getByText('Edit')).toBeInTheDocument()
    const syncButtons = screen.getAllByText('Sync')
    expect(syncButtons.length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('Delete')).toBeInTheDocument()
  })

  it('renders status cards', async () => {
    const { prisma } = await import('@/lib/prisma')
    ;(prisma.document.findUnique as any).mockResolvedValueOnce(mockDocument)

    const element = await DocumentDetailPage({ params: Promise.resolve({ id: 'doc-1' }) })
    render(element)

    expect(screen.getByText('Status')).toBeInTheDocument()
    expect(screen.getByText('Published')).toBeInTheDocument()
    expect(screen.getByText('Synced')).toBeInTheDocument()
    expect(screen.getByText('v3')).toBeInTheDocument()
  })

  it('renders tabs', async () => {
    const { prisma } = await import('@/lib/prisma')
    ;(prisma.document.findUnique as any).mockResolvedValueOnce(mockDocument)

    const element = await DocumentDetailPage({ params: Promise.resolve({ id: 'doc-1' }) })
    render(element)

    expect(screen.getByText('Overview')).toBeInTheDocument()
    expect(screen.getByText('SEO')).toBeInTheDocument()
    expect(screen.getByText('History')).toBeInTheDocument()
    expect(screen.getByText('Settings')).toBeInTheDocument()
  })

  it('calls notFound when document is not found', async () => {
    mockNotFound.mockImplementationOnce(() => {
      throw new Error('NOT_FOUND')
    })

    const { prisma } = await import('@/lib/prisma')
    ;(prisma.document.findUnique as any).mockResolvedValueOnce(null)

    await expect(
      DocumentDetailPage({ params: Promise.resolve({ id: 'non-existent' }) })
    ).rejects.toThrow('NOT_FOUND')
    expect(mockNotFound).toHaveBeenCalled()
  })

  it('returns null when no user session', async () => {
    const mockAuth = vi.mocked((await import('@/lib/auth')).auth)
    mockAuth.mockResolvedValueOnce({ user: { id: null } } as any)

    const element = await DocumentDetailPage({ params: Promise.resolve({ id: 'doc-1' }) })
    expect(element).toBeNull()
  })
})
