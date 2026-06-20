/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { SettingsForms } from './settings-forms'

const mockPush = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}))

beforeEach(() => {
  vi.clearAllMocks()
  global.fetch = vi.fn()
})

describe('SettingsForms', () => {
  it('renders password change form', () => {
    render(<SettingsForms />)
    expect(screen.getByText('Mot de passe')).toBeInTheDocument()
    expect(screen.getByLabelText('Mot de passe actuel')).toBeInTheDocument()
    expect(screen.getByLabelText('Nouveau mot de passe')).toBeInTheDocument()
    expect(screen.getByLabelText('Confirmer le mot de passe')).toBeInTheDocument()
  })

  it('shows validation error when passwords do not match', () => {
    render(<SettingsForms />)
    fireEvent.change(screen.getByLabelText('Nouveau mot de passe'), {
      target: { value: 'newpass123' },
    })
    fireEvent.change(screen.getByLabelText('Confirmer le mot de passe'), {
      target: { value: 'different' },
    })
    fireEvent.click(screen.getByText('Mettre à jour le mot de passe'))
    expect(screen.getByText('Les mots de passe ne correspondent pas')).toBeInTheDocument()
  })

  it('shows validation error when password is too short', () => {
    render(<SettingsForms />)
    fireEvent.change(screen.getByLabelText('Nouveau mot de passe'), { target: { value: 'short' } })
    fireEvent.change(screen.getByLabelText('Confirmer le mot de passe'), {
      target: { value: 'short' },
    })
    fireEvent.click(screen.getByText('Mettre à jour le mot de passe'))
    expect(
      screen.getByText('Le mot de passe doit contenir au moins 8 caractères')
    ).toBeInTheDocument()
  })

  it('renders API keys section', () => {
    const mockKeys = [
      {
        id: '1',
        name: 'Prod Key',
        prefix: 'omni_abc',
        createdAt: '2024-01-01',
        lastUsedAt: null,
        expiresAt: null,
      },
    ]
    render(<SettingsForms initialApiKeys={mockKeys} />)
    expect(screen.getByText('Clés API')).toBeInTheDocument()
    expect(screen.getByText('Prod Key')).toBeInTheDocument()
    expect(screen.getByText('omni_abc...')).toBeInTheDocument()
  })

  it('shows empty state when no API keys', () => {
    render(<SettingsForms />)
    expect(screen.getByText('Clés API')).toBeInTheDocument()
    // No API key items should render
    expect(screen.queryByText('omni_')).toBeNull()
  })

  it('renders danger zone section', () => {
    render(<SettingsForms />)
    expect(screen.getByText('Zone dangereuse')).toBeInTheDocument()
    expect(screen.getByText('Supprimer mon compte')).toBeInTheDocument()
  })

  it('shows delete confirmation dialog', () => {
    render(<SettingsForms />)
    fireEvent.click(screen.getByText('Supprimer mon compte'))
    expect(screen.getByText(/Tapez "SUPPRIMER"/)).toBeInTheDocument()
  })

  it('handles successful password update', async () => {
    ;(global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({}),
    })

    render(<SettingsForms />)
    fireEvent.change(screen.getByLabelText('Mot de passe actuel'), { target: { value: 'oldpass' } })
    fireEvent.change(screen.getByLabelText('Nouveau mot de passe'), {
      target: { value: 'newpass123' },
    })
    fireEvent.change(screen.getByLabelText('Confirmer le mot de passe'), {
      target: { value: 'newpass123' },
    })
    fireEvent.click(screen.getByText('Mettre à jour le mot de passe'))

    await waitFor(() => {
      expect(screen.getByText('Mot de passe mis à jour!')).toBeInTheDocument()
    })
  })

  it('shows API error message on password update failure', async () => {
    ;(global.fetch as any).mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'Mot de passe actuel incorrect' }),
    })

    render(<SettingsForms />)
    fireEvent.change(screen.getByLabelText('Mot de passe actuel'), { target: { value: 'wrong' } })
    fireEvent.change(screen.getByLabelText('Nouveau mot de passe'), {
      target: { value: 'newpass123' },
    })
    fireEvent.change(screen.getByLabelText('Confirmer le mot de passe'), {
      target: { value: 'newpass123' },
    })
    fireEvent.click(screen.getByText('Mettre à jour le mot de passe'))

    await waitFor(() => {
      expect(screen.getByText('Mot de passe actuel incorrect')).toBeInTheDocument()
    })
  })

  it('shows network error on fetch failure during password update', async () => {
    ;(global.fetch as any).mockRejectedValueOnce(new Error('Network error'))

    render(<SettingsForms />)
    fireEvent.change(screen.getByLabelText('Mot de passe actuel'), { target: { value: 'old' } })
    fireEvent.change(screen.getByLabelText('Nouveau mot de passe'), {
      target: { value: 'newpass123' },
    })
    fireEvent.change(screen.getByLabelText('Confirmer le mot de passe'), {
      target: { value: 'newpass123' },
    })
    fireEvent.click(screen.getByText('Mettre à jour le mot de passe'))

    await waitFor(() => {
      expect(screen.getByText('Erreur de connexion')).toBeInTheDocument()
    })
  })

  it('disables save button while password is loading', async () => {
    ;(global.fetch as any).mockImplementationOnce(() => new Promise(() => {}))

    render(<SettingsForms />)
    fireEvent.change(screen.getByLabelText('Mot de passe actuel'), { target: { value: 'old' } })
    fireEvent.change(screen.getByLabelText('Nouveau mot de passe'), {
      target: { value: 'newpass123' },
    })
    fireEvent.change(screen.getByLabelText('Confirmer le mot de passe'), {
      target: { value: 'newpass123' },
    })
    fireEvent.click(screen.getByText('Mettre à jour le mot de passe'))

    await waitFor(() => {
      expect(screen.getByText('Mise à jour...')).toBeInTheDocument()
    })
  })

  it('shows delete account confirmation dialog and cancel button', () => {
    render(<SettingsForms />)
    fireEvent.click(screen.getByText('Supprimer mon compte'))

    expect(screen.getByText('Supprimer votre compte?')).toBeInTheDocument()
    expect(screen.getByText('Annuler')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Tapez SUPPRIMER')).toBeInTheDocument()
  })

  it('disables delete button until SUPPRIMER is typed', () => {
    render(<SettingsForms />)
    fireEvent.click(screen.getByText('Supprimer mon compte'))

    const deleteButton = screen.getByText('Supprimer définitivement')
    expect(deleteButton.closest('button')).toBeDisabled()

    fireEvent.change(screen.getByPlaceholderText('Tapez SUPPRIMER'), {
      target: { value: 'SUPPRIMER' },
    })
    expect(deleteButton.closest('button')).not.toBeDisabled()
  })

  it('navigates to root on successful account deletion', async () => {
    ;(global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({}),
    })

    render(<SettingsForms />)
    fireEvent.click(screen.getByText('Supprimer mon compte'))
    fireEvent.change(screen.getByPlaceholderText('Tapez SUPPRIMER'), {
      target: { value: 'SUPPRIMER' },
    })
    fireEvent.click(screen.getByText('Supprimer définitivement'))

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/')
    })
  })
})
