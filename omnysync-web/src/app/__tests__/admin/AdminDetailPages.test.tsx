import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import AdminOrgDetailPage from '@/app/(dashboard)/admin/orgs/[id]/page'
import AdminUserDetailPage from '@/app/(dashboard)/admin/users/[id]/page'

const mocks = vi.hoisted(() => ({
  acceptLanguage: 'en',
  userFindUnique: vi.fn(),
  orgFindUnique: vi.fn(),
}))

vi.mock('next/headers', () => ({
  headers: vi.fn(async () => ({
    get: (key: string) => {
      const name = key.toLowerCase()
      if (name === 'accept-language') return mocks.acceptLanguage
      if (name === 'host') return 'localhost:3000'
      if (name === 'cookie') return 'session=test'
      return null
    },
  })),
}))

vi.mock('@/lib/auth', () => ({
  auth: vi.fn().mockResolvedValue({
    user: { id: 'admin-1', name: 'Admin', email: 'admin@example.com', role: 'ADMIN' },
  }),
}))

vi.mock('@/lib/auth/require-admin', () => ({
  requireAdmin: vi.fn().mockResolvedValue({ id: 'admin-1', email: 'admin@example.com' }),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: { findUnique: mocks.userFindUnique },
    organization: { findUnique: mocks.orgFindUnique },
  },
}))

const createdAt = new Date('2026-01-15T12:00:00.000Z')

const userRecord = {
  id: 'user-1',
  name: 'Alice Martin',
  email: 'alice@example.com',
  role: 'ADMIN',
  createdAt,
  lastLoginAt: createdAt,
  disabledAt: null,
  organizations: [
    {
      organization: { id: 'org-1', name: 'Acme Inc', slug: 'acme' },
      role: 'OWNER',
    },
  ],
}

const orgRecord = {
  id: 'org-1',
  name: 'Acme Inc',
  slug: 'acme',
  createdAt,
}

const entitlements = {
  orgId: 'org-1',
  planKey: 'pro',
  subscription: {
    id: 'sub-1',
    planKey: 'pro',
    status: 'ACTIVE',
    currentPeriodStart: createdAt.toISOString(),
    currentPeriodEnd: createdAt.toISOString(),
    cancelAtPeriodEnd: false,
    trialStart: null,
    trialEnd: null,
  },
  entitlements: {
    planKey: 'pro',
    features: { EXPORT_PDF: true },
    limits: { EXPORT_PDF: null },
    experiments: {},
  },
  overrides: [
    {
      id: 'override-1',
      scope: 'ORG',
      scopeId: 'org-1',
      featureKey: 'EXPORT_PDF',
      enabled: true,
      limitValue: null,
      expiresAt: null,
      reason: 'Pilot program',
      createdAt: createdAt.toISOString(),
    },
  ],
}

function setLocale(locale: 'en' | 'fr') {
  mocks.acceptLanguage = locale
  document.documentElement.lang = locale
}

describe('Admin detail pages', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setLocale('en')
    mocks.userFindUnique.mockResolvedValue(userRecord)
    mocks.orgFindUnique.mockResolvedValue(orgRecord)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    setLocale('en')
  })

  it('renders the user record with English labels', async () => {
    const Component = await AdminUserDetailPage({ params: Promise.resolve({ id: 'user-1' }) })
    render(Component)

    expect(screen.getByRole('heading', { level: 1, name: 'Alice Martin' })).toBeInTheDocument()
    expect(screen.getByText('Information')).toBeInTheDocument()
    expect(screen.getByText('Last login')).toBeInTheDocument()
    expect(screen.getByText('Organizations')).toBeInTheDocument()
    expect(screen.getAllByText('Admin').length).toBeGreaterThan(0)
    expect(screen.getByText('Owner')).toBeInTheDocument()
  })

  it('renders the user record with French labels', async () => {
    setLocale('fr')
    const Component = await AdminUserDetailPage({ params: Promise.resolve({ id: 'user-1' }) })
    render(Component)

    expect(screen.getByRole('heading', { level: 1, name: 'Alice Martin' })).toBeInTheDocument()
    expect(screen.getByText('Informations')).toBeInTheDocument()
    expect(screen.getByText('Dernière connexion')).toBeInTheDocument()
    expect(screen.getByText('Organisations')).toBeInTheDocument()
    expect(screen.getAllByText('Administrateur').length).toBeGreaterThan(0)
    expect(screen.getByText('Propriétaire')).toBeInTheDocument()
  })

  it('renders the organization entitlements with English labels', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => entitlements,
      })
    )

    const Component = await AdminOrgDetailPage({ params: Promise.resolve({ id: 'org-1' }) })
    render(Component)

    expect(screen.getByRole('heading', { level: 1, name: 'Acme Inc' })).toBeInTheDocument()
    expect(screen.getByText('Feature entitlements')).toBeInTheDocument()
    expect(screen.getAllByText('Active overrides').length).toBeGreaterThan(0)
    expect(screen.getAllByText('EXPORT_PDF').length).toBeGreaterThan(0)
    expect(screen.getByText('Pilot program')).toBeInTheDocument()
    expect(screen.getAllByText('Enabled').length).toBeGreaterThan(0)
    expect(screen.getByText('Unlimited')).toBeInTheDocument()
  })

  it('renders the organization entitlements with French labels', async () => {
    setLocale('fr')
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => entitlements,
      })
    )

    const Component = await AdminOrgDetailPage({ params: Promise.resolve({ id: 'org-1' }) })
    render(Component)

    expect(screen.getByRole('heading', { level: 1, name: 'Acme Inc' })).toBeInTheDocument()
    expect(screen.getByText('Droits par fonctionnalité')).toBeInTheDocument()
    expect(screen.getAllByText('Dérogations actives').length).toBeGreaterThan(0)
    expect(screen.getAllByText('EXPORT_PDF').length).toBeGreaterThan(0)
    expect(screen.getByText('Pilot program')).toBeInTheDocument()
    expect(screen.getAllByText('Activé').length).toBeGreaterThan(0)
    expect(screen.getByText('Illimité')).toBeInTheDocument()
  })
})
