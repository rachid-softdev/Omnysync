import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import DocumentDetailPage from '../../(dashboard)/dashboard/documents/[id]/page'

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
    document: {
      findUnique: vi.fn(),
    },
    userOrganization: {
      findFirst: vi.fn(),
    },
  },
}))

vi.mock('lucide-react', () => {
  const icons: Record<string, any> = {
    ArrowLeft: () => <svg data-testid="icon-arrowleft" />,
    RefreshCw: () => <svg data-testid="icon-refresh" />,
    Trash2: () => <svg data-testid="icon-trash" />,
    Edit: () => <svg data-testid="icon-edit" />,
    Calendar: () => <svg data-testid="icon-calendar" />,
    Clock: () => <svg data-testid="icon-clock" />,
    CheckCircle: () => <svg data-testid="icon-checkcircle" />,
    AlertCircle: () => <svg data-testid="icon-alertcircle" />,
    Info: () => <svg data-testid="icon-info" />,
    Sparkles: () => <svg data-testid="icon-sparkles" />,
    Loader2: () => <svg data-testid="icon-loader" />,
  }
  // Fallback so any other lucide icon (e.g. used by shared components like
  // HelpTooltip) renders a generic SVG instead of throwing "No X export".
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

beforeEach(() => {
  vi.clearAllMocks()
  mockNotFound.mockReset()
  localeState.lang = 'en'
})

beforeEach(async () => {
  const { prisma } = await import('@/lib/prisma')
  ;(prisma.userOrganization.findFirst as any).mockResolvedValue({
    organization: {
      subscriptions: [{ status: 'ACTIVE', planKey: 'pro' }],
    },
  })
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

  it('renders working Sync and Delete actions without a dead Edit control', async () => {
    const { prisma } = await import('@/lib/prisma')
    ;(prisma.document.findUnique as any).mockResolvedValueOnce(mockDocument)

    const element = await DocumentDetailPage({ params: Promise.resolve({ id: 'doc-1' }) })
    render(element)

    const syncButtons = screen.getAllByText('Sync')
    expect(syncButtons.length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('Delete')).toBeInTheDocument()
    expect(screen.queryByText('Edit')).not.toBeInTheDocument()
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

  it('renders French copy and passes the locale to client actions', async () => {
    localeState.lang = 'fr'
    const { prisma } = await import('@/lib/prisma')
    ;(prisma.document.findUnique as any).mockResolvedValueOnce(mockDocument)

    const element = await DocumentDetailPage({ params: Promise.resolve({ id: 'doc-1' }) })
    render(element)

    expect(screen.getByText('Retour')).toBeInTheDocument()
    expect(screen.getByText('Synchroniser')).toBeInTheDocument()
    expect(screen.getByText('Supprimer')).toBeInTheDocument()
    expect(screen.getByText('Vérifier les modifications')).toBeInTheDocument()
    expect(screen.getByText('Statut')).toBeInTheDocument()
    expect(screen.getAllByText('Publié').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Synchronisé').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('Aperçu')).toBeInTheDocument()
    expect(screen.getByText('SEO')).toBeInTheDocument()
    expect(screen.getByText('Historique')).toBeInTheDocument()
    expect(screen.getByText('Paramètres')).toBeInTheDocument()
    expect(screen.getByText('Contenu')).toBeInTheDocument()
    expect(screen.getByText('Aperçu du contenu synchronisé')).toBeInTheDocument()
    expect(screen.getByText('Métadonnées')).toBeInTheDocument()
    expect(screen.getByText('Informations du document')).toBeInTheDocument()
    expect(screen.getByText('Dernière synchronisation')).toBeInTheDocument()
    expect(screen.getByText('Version')).toBeInTheDocument()
    expect(screen.getAllByText('Synchronisation auto').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('Progression de la synchronisation')).toBeInTheDocument()
    expect(screen.getByText(/Créé le/)).toBeInTheDocument()
  })

  it('explains an empty preview without contradicting a successful sync', async () => {
    const { prisma } = await import('@/lib/prisma')
    ;(prisma.document.findUnique as any).mockResolvedValueOnce({
      ...mockDocument,
      htmlContent: null,
      content: null,
    })

    const element = await DocumentDetailPage({ params: Promise.resolve({ id: 'doc-1' }) })
    render(element)

    expect(screen.getByText('No stored preview')).toBeInTheDocument()
    expect(screen.getByText(/sync status reflects delivery/i)).toBeInTheDocument()
  })

  it('renders plain content when no HTML preview exists', async () => {
    const { prisma } = await import('@/lib/prisma')
    ;(prisma.document.findUnique as any).mockResolvedValueOnce({
      ...mockDocument,
      htmlContent: null,
      content: 'Plain text body',
    })

    const element = await DocumentDetailPage({ params: Promise.resolve({ id: 'doc-1' }) })
    render(element)

    expect(screen.getByText('Plain text body')).toBeInTheDocument()
  })

  it('localizes the empty preview explanation', async () => {
    localeState.lang = 'fr'
    const { prisma } = await import('@/lib/prisma')
    ;(prisma.document.findUnique as any).mockResolvedValueOnce({
      ...mockDocument,
      htmlContent: null,
      content: null,
    })

    const element = await DocumentDetailPage({ params: Promise.resolve({ id: 'doc-1' }) })
    render(element)

    expect(screen.getByText('Aucun aperçu conservé')).toBeInTheDocument()
    expect(screen.getByText(/statut de synchronisation reflète la livraison/i)).toBeInTheDocument()
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
