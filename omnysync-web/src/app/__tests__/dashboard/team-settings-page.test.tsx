import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import TeamSettingsPage from '../../(dashboard)/dashboard/settings/team/page'

vi.mock('@/components/toast-provider', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

beforeEach(() => {
  vi.clearAllMocks()
  document.documentElement.lang = 'en'
  global.fetch = vi.fn()
})

const mockMembers = [
  {
    id: 'u1',
    name: 'Alice Johnson',
    email: 'alice@example.com',
    image: null,
    role: 'OWNER',
    joinedAt: '2026-01-15T10:00:00Z',
  },
  {
    id: 'u2',
    name: 'Bob Smith',
    email: 'bob@example.com',
    image: 'https://example.com/avatar.jpg',
    role: 'ADMIN',
    joinedAt: '2026-03-01T10:00:00Z',
  },
  {
    id: 'u3',
    name: 'Charlie Brown',
    email: 'charlie@example.com',
    image: null,
    role: 'MEMBER',
    joinedAt: '2026-04-10T10:00:00Z',
  },
]

describe('TeamSettingsPage', () => {
  it('shows loading spinner initially', () => {
    ;(global.fetch as any).mockImplementationOnce(() => new Promise(() => {}))

    render(<TeamSettingsPage />)
    const spinner = document.querySelector('.animate-spin')
    expect(spinner).toBeInTheDocument()
  })

  it('renders title and invite button', async () => {
    ;(global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockMembers,
    })

    render(<TeamSettingsPage />)

    await waitFor(() => {
      expect(screen.getByText('Team')).toBeInTheDocument()
      expect(screen.getByText('Add member')).toBeInTheDocument()
    })
  })

  it('renders team member list with roles', async () => {
    ;(global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockMembers,
    })

    render(<TeamSettingsPage />)

    await waitFor(() => {
      expect(screen.getByText('Alice Johnson')).toBeInTheDocument()
      expect(screen.getByText('Bob Smith')).toBeInTheDocument()
      expect(screen.getByText('Charlie Brown')).toBeInTheDocument()
      expect(screen.getByText('Owner')).toBeInTheDocument()
      // Admin appears in badge AND in select trigger for Bob (ADMIN role)
      expect(screen.getAllByText('Admin').length).toBeGreaterThanOrEqual(1)
      // Member appears in badge AND in select trigger for Charlie (MEMBER role)
      expect(screen.getAllByText('Member').length).toBeGreaterThanOrEqual(1)
    })
  })

  it('renders "3 members" description', async () => {
    ;(global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockMembers,
    })

    render(<TeamSettingsPage />)

    await waitFor(() => {
      expect(screen.getByText('3 members')).toBeInTheDocument()
    })
  })

  it('opens the add-member dialog with truthful copy', async () => {
    ;(global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockMembers,
    })

    render(<TeamSettingsPage />)

    await waitFor(() => {
      expect(screen.getByText('Add member')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('Add member'))
    expect(
      screen.getByText(/Add an existing Omnysync account to your organization/i)
    ).toBeInTheDocument()
  })

  it('shows empty state when no members', async () => {
    ;(global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => [],
    })

    render(<TeamSettingsPage />)

    await waitFor(() => {
      expect(screen.getByText('No members found')).toBeInTheDocument()
    })
  })

  it('renders French labels and roles', async () => {
    document.documentElement.lang = 'fr'
    ;(global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockMembers,
    })

    render(<TeamSettingsPage />)

    await waitFor(() => {
      expect(screen.getByText('Équipe')).toBeInTheDocument()
      expect(screen.getByText('Ajouter un membre')).toBeInTheDocument()
      expect(screen.getByText('3 membres')).toBeInTheDocument()
      expect(screen.getByText('Propriétaire')).toBeInTheDocument()
      expect(screen.getByText('Membres de l’organisation')).toBeInTheDocument()
    })
  })
})
