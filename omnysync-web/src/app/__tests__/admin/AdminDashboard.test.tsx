/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import AdminDashboardPage from '../../(dashboard)/admin/page'

vi.mock('@/lib/auth', () => ({
  auth: vi.fn().mockResolvedValue({
    user: { id: 'admin-1', name: 'Admin', email: 'admin@example.com', role: 'ADMIN' },
  }),
}))

vi.mock('@/lib/auth/require-admin', () => ({
  requireAdmin: vi.fn().mockResolvedValue({ id: 'admin-1', email: 'admin@example.com' }),
}))

vi.mock('@/lib/prisma', () => {
  const date = new Date('2026-06-26')
  return {
    prisma: {
      user: {
        count: vi.fn().mockResolvedValue(10),
        findMany: vi.fn().mockResolvedValue([
          { id: 'u1', name: 'Alice', email: 'alice@test.com', role: 'USER', createdAt: date },
          { id: 'u2', name: 'Bob', email: 'bob@test.com', role: 'ADMIN', createdAt: date },
        ]),
      },
      organization: {
        count: vi.fn().mockResolvedValue(5),
        findMany: vi.fn().mockResolvedValue([
          { id: 'o1', name: 'Acme Inc', slug: 'acme', createdAt: date },
          { id: 'o2', name: 'Globex Corp', slug: 'globex', createdAt: date },
        ]),
      },
      plan: {
        count: vi.fn().mockResolvedValue(3),
      },
      feature: {
        count: vi.fn().mockResolvedValue(8),
      },
    },
  }
})

describe('AdminDashboardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the admin header with title "Administration"', async () => {
    const Component = await AdminDashboardPage()
    render(Component)
    expect(screen.getByText('Administration')).toBeInTheDocument()
  })

  it('renders all 4 stats cards', async () => {
    const Component = await AdminDashboardPage()
    render(Component)
    expect(screen.getByText('Utilisateurs')).toBeInTheDocument()
    expect(screen.getByText('Organisations')).toBeInTheDocument()
    expect(screen.getByText('Plans actifs')).toBeInTheDocument()
    expect(screen.getByText('Features')).toBeInTheDocument()
  })

  it('displays the correct stat values (10, 5, 3, 8)', async () => {
    const Component = await AdminDashboardPage()
    render(Component)
    expect(screen.getByText('10')).toBeInTheDocument()
    expect(screen.getByText('5')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
    expect(screen.getByText('8')).toBeInTheDocument()
  })

  it('renders the "Recent Users" section', async () => {
    const Component = await AdminDashboardPage()
    render(Component)
    expect(screen.getByText('Derniers utilisateurs')).toBeInTheDocument()
    expect(screen.getByText('Alice')).toBeInTheDocument()
    expect(screen.getByText('Bob')).toBeInTheDocument()
  })

  it('renders the "Recent Organizations" section', async () => {
    const Component = await AdminDashboardPage()
    render(Component)
    expect(screen.getByText('Dernières organisations')).toBeInTheDocument()
    expect(screen.getByText('Acme Inc')).toBeInTheDocument()
    expect(screen.getByText('Globex Corp')).toBeInTheDocument()
  })

  it('renders empty state when no recent users', async () => {
    const prismaModule = await import('@/lib/prisma')
    ;(prismaModule.prisma.user.findMany as any).mockResolvedValue([])

    const Component = await AdminDashboardPage()
    render(Component)
    expect(screen.getByText('Aucun utilisateur')).toBeInTheDocument()
  })

  it('renders empty state when no recent organizations', async () => {
    const prismaModule = await import('@/lib/prisma')
    ;(prismaModule.prisma.organization.findMany as any).mockResolvedValue([])

    const Component = await AdminDashboardPage()
    render(Component)
    expect(screen.getByText('Aucune organisation')).toBeInTheDocument()
  })

  it('stats cards link to the correct admin pages', async () => {
    const Component = await AdminDashboardPage()
    render(Component)
    // Each stat card is wrapped in a Link; finding by the label text
    const usersLink = screen.getByText('Utilisateurs').closest('a')
    expect(usersLink).toHaveAttribute('href', '/admin/users')

    const orgsLink = screen.getByText('Organisations').closest('a')
    expect(orgsLink).toHaveAttribute('href', '/admin/orgs')
  })
})
