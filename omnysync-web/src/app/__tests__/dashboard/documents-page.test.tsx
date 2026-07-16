import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import DocumentsPage from '../../(dashboard)/dashboard/documents/page'

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
    UI_MANAGE_DOCS: 'Manage your documents',
    UI_ALL_DOCS: 'All documents',
    UI_ALL_DOCS_DESC: 'List of synced documents',
    UI_NO_DOCS: 'No documents yet',
    UI_IMPORT_DOCS: 'Connect a source to import documents',
  }
  return {
    ...actual,
    t: (key: string, locale?: string) => translations[key] || actual.t(key, locale),
  }
})

vi.mock('@/lib/auth/org', () => ({
  getUserOrgId: vi.fn().mockResolvedValue('org-1'),
}))

// The client BatchDocumentList uses the useTranslations() hook, which in jsdom
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
    document: {
      findMany: vi.fn().mockResolvedValue([]),
    },
  },
}))

beforeEach(() => {
  vi.clearAllMocks()
})

describe('DocumentsPage', () => {
  it('renders title and description', async () => {
    const element = await DocumentsPage()
    render(element)

    expect(screen.getByText('Documents')).toBeInTheDocument()
    expect(screen.getByText('Manage your documents')).toBeInTheDocument()
  })

  it('renders empty state when no documents', async () => {
    const element = await DocumentsPage()
    render(element)

    expect(screen.getByText('No documents yet')).toBeInTheDocument()
    expect(screen.getByText('Connect a source to import documents')).toBeInTheDocument()
  })

  it('renders document list with titles and status badges', async () => {
    const { prisma } = await import('@/lib/prisma')
    ;(prisma.document.findMany as any).mockResolvedValue([
      {
        id: 'doc-1',
        title: 'My First Doc',
        syncStatus: 'SYNCED',
        updatedAt: new Date('2026-06-01'),
        sourceConnector: { type: 'GOOGLE_DOCS' },
        destConnector: { type: 'WORDPRESS' },
      },
      {
        id: 'doc-2',
        title: 'Second Doc',
        syncStatus: 'FAILED',
        updatedAt: new Date('2026-06-02'),
        sourceConnector: { type: 'NOTION' },
        destConnector: { type: 'GHOST' },
      },
    ])

    const element = await DocumentsPage()
    render(element)

    expect(screen.getByText('My First Doc')).toBeInTheDocument()
    expect(screen.getByText('Second Doc')).toBeInTheDocument()
    expect(screen.getByText('Synced')).toBeInTheDocument()
    expect(screen.getByText('Failed')).toBeInTheDocument()
  })

  it('returns null when no user session', async () => {
    const mockAuth = vi.mocked((await import('@/lib/auth')).auth)
    mockAuth.mockResolvedValueOnce({ user: { id: null } } as any)

    const element = await DocumentsPage()
    expect(element).toBeNull()
  })
})
