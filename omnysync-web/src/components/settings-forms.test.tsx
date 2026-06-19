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
    fireEvent.change(screen.getByLabelText('Nouveau mot de passe'), { target: { value: 'newpass123' } })
    fireEvent.change(screen.getByLabelText('Confirmer le mot de passe'), { target: { value: 'different' } })
    fireEvent.click(screen.getByText('Mettre à jour le mot de passe'))
    expect(screen.getByText('Les mots de passe ne correspondent pas')).toBeInTheDocument()
  })

  it('shows validation error when password is too short', () => {
    render(<SettingsForms />)
    fireEvent.change(screen.getByLabelText('Nouveau mot de passe'), { target: { value: 'short' } })
    fireEvent.change(screen.getByLabelText('Confirmer le mot de passe'), { target: { value: 'short' } })
    fireEvent.click(screen.getByText('Mettre à jour le mot de passe'))
    expect(screen.getByText('Le mot de passe doit contenir au moins 8 caractères')).toBeInTheDocument()
  })

  it('renders API keys section', () => {
    const mockKeys = [
      { id: '1', name: 'Prod Key', prefix: 'omni_abc', createdAt: '2024-01-01', lastUsedAt: null, expiresAt: null },
    ]
    render(<SettingsForms initialApiKeys={mockKeys} />)
    expect(screen.getByText('Clés API')).toBeInTheDocument()
    expect(screen.getByText('Prod Key')).toBeInTheDocument()
    expect(screen.getByText('omni_abc...')).toBeInTheDocument()
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
    fireEvent.change(screen.getByLabelText('Nouveau mot de passe'), { target: { value: 'newpass123' } })
    fireEvent.change(screen.getByLabelText('Confirmer le mot de passe'), { target: { value: 'newpass123' } })
    fireEvent.click(screen.getByText('Mettre à jour le mot de passe'))

    await waitFor(() => {
      expect(screen.getByText('Mot de passe mis à jour!')).toBeInTheDocument()
    })
  })
})
