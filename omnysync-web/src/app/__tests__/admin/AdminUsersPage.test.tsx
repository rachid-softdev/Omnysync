/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import AdminUsersPage from '../../(dashboard)/admin/users/page'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockPush = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}))

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const mockUsers = {
  users: [
    {
      id: '1',
      email: 'john@test.com',
      name: 'John Doe',
      role: 'USER' as const,
      createdAt: '2026-01-01T00:00:00Z',
    },
    {
      id: '2',
      email: 'admin@test.com',
      name: 'Admin User',
      role: 'ADMIN' as const,
      createdAt: '2026-01-02T00:00:00Z',
    },
  ],
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AdminUsersPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = vi.fn()
  })

  it('affiche le titre "Utilisateurs"', async () => {
    ;(global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockUsers,
    })

    render(<AdminUsersPage />)

    await waitFor(() => {
      expect(screen.getByText('Utilisateurs')).toBeInTheDocument()
    })
  })

  it("affiche le nombre total d'utilisateurs dans la description", async () => {
    ;(global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockUsers,
    })

    render(<AdminUsersPage />)

    await waitFor(() => {
      expect(screen.getByText('2 utilisateurs sur la plateforme')).toBeInTheDocument()
    })
  })

  it('affiche les utilisateurs dans le tableau après chargement', async () => {
    ;(global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockUsers,
    })

    render(<AdminUsersPage />)

    await waitFor(() => {
      expect(screen.getByText('john@test.com')).toBeInTheDocument()
      expect(screen.getByText('admin@test.com')).toBeInTheDocument()
      expect(screen.getByText('John Doe')).toBeInTheDocument()
      expect(screen.getByText('Admin User')).toBeInTheDocument()
    })
  })

  it('affiche les badges de rôle USER et ADMIN', async () => {
    ;(global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockUsers,
    })

    render(<AdminUsersPage />)

    await waitFor(() => {
      expect(screen.getByText('USER')).toBeInTheDocument()
      expect(screen.getByText('ADMIN')).toBeInTheDocument()
    })
  })

  it('affiche le loading state initial avec des skeletons', () => {
    ;(global.fetch as any).mockImplementationOnce(() => new Promise(() => {}))

    render(<AdminUsersPage />)

    // Le composant AdminDataTable affiche des divs avec animate-pulse en loading
    const skeletons = document.querySelectorAll('.animate-pulse')
    expect(skeletons.length).toBeGreaterThan(0)
  })

  it("affiche l'error state quand fetch échoue (res.ok = false)", async () => {
    ;(global.fetch as any).mockResolvedValueOnce({
      ok: false,
    })

    render(<AdminUsersPage />)

    await waitFor(() => {
      expect(screen.getByText('Erreur lors du chargement des utilisateurs')).toBeInTheDocument()
    })
  })

  it("affiche l'error state quand fetch rejette (network error)", async () => {
    ;(global.fetch as any).mockRejectedValueOnce(new Error('Network failure'))

    render(<AdminUsersPage />)

    await waitFor(() => {
      expect(screen.getByText('Network failure')).toBeInTheDocument()
    })
  })

  it("affiche l'empty state quand aucun utilisateur", async () => {
    ;(global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ users: [] }),
    })

    render(<AdminUsersPage />)

    await waitFor(() => {
      expect(screen.getByText('Aucune donnée')).toBeInTheDocument()
    })
  })

  it('la recherche filtre les utilisateurs par email', async () => {
    ;(global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockUsers,
    })

    render(<AdminUsersPage />)

    await waitFor(() => {
      expect(screen.getByText('john@test.com')).toBeInTheDocument()
    })

    const searchInput = screen.getByPlaceholderText('Rechercher par email ou nom…')
    fireEvent.change(searchInput, { target: { value: 'admin' } })

    await waitFor(() => {
      expect(screen.queryByText('john@test.com')).not.toBeInTheDocument()
      expect(screen.getByText('admin@test.com')).toBeInTheDocument()
    })
  })

  it('la recherche filtre les utilisateurs par nom', async () => {
    ;(global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockUsers,
    })

    render(<AdminUsersPage />)

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument()
    })

    const searchInput = screen.getByPlaceholderText('Rechercher par email ou nom…')
    fireEvent.change(searchInput, { target: { value: 'Admin' } })

    await waitFor(() => {
      expect(screen.queryByText('John Doe')).not.toBeInTheDocument()
      expect(screen.getByText('Admin User')).toBeInTheDocument()
    })
  })

  it('la recherche vide réaffiche tous les utilisateurs', async () => {
    ;(global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockUsers,
    })

    render(<AdminUsersPage />)

    await waitFor(() => {
      expect(screen.getByText('john@test.com')).toBeInTheDocument()
    })

    const searchInput = screen.getByPlaceholderText('Rechercher par email ou nom…')

    // Tape une recherche
    fireEvent.change(searchInput, { target: { value: 'admin' } })

    await waitFor(() => {
      expect(screen.queryByText('john@test.com')).not.toBeInTheDocument()
    })

    // Efface la recherche
    fireEvent.change(searchInput, { target: { value: '' } })

    await waitFor(() => {
      expect(screen.getByText('john@test.com')).toBeInTheDocument()
      expect(screen.getByText('admin@test.com')).toBeInTheDocument()
    })
  })

  it('affiche les dates de création formatées en français', async () => {
    ;(global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockUsers,
    })

    render(<AdminUsersPage />)

    await waitFor(() => {
      // toLocaleDateString('fr-FR') → ex: "1 janv. 2026"
      expect(screen.getByText(/1 janv\.? 2026/)).toBeInTheDocument()
      expect(screen.getByText(/2 janv\.? 2026/)).toBeInTheDocument()
    })
  })

  it('contient le bouton Voir pour chaque utilisateur', async () => {
    ;(global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockUsers,
    })

    render(<AdminUsersPage />)

    await waitFor(() => {
      const voirButtons = screen.getAllByText('Voir')
      expect(voirButtons).toHaveLength(2)
    })
  })
})
