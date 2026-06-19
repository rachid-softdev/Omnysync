/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import TeamSettingsPage from '../../(dashboard)/dashboard/settings/team/page'

vi.mock('@/lib/i18n/useTranslations', () => ({
  useTranslations: vi.fn(() => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        TEAM_TITLE: 'Team',
        TEAM_SUBTITLE: 'Manage your organization members',
      }
      return translations[key] || key
    },
    loading: false,
    locale: 'en',
  })),
}))

vi.mock('@/components/toast-provider', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

beforeEach(() => {
  vi.clearAllMocks()
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
      expect(screen.getByText('Invite member')).toBeInTheDocument()
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

  it('opens invite dialog when clicking Invite member', async () => {
    ;(global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockMembers,
    })

    render(<TeamSettingsPage />)

    await waitFor(() => {
      expect(screen.getByText('Invite member')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('Invite member'))
    expect(screen.getByText('Send an email invitation to join your organization.')).toBeInTheDocument()
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
})
