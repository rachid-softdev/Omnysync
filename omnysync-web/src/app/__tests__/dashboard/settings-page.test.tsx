import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SettingsPage from '../../(dashboard)/dashboard/settings/page'

vi.mock('@/lib/i18n/useTranslations', () => ({
  useTranslations: vi.fn(() => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        UI_SETTINGS: 'Settings',
        UI_PREFERENCES: 'Manage your preferences',
      }
      return translations[key] || key
    },
    loading: false,
    locale: 'en',
  })),
}))

beforeEach(() => {
  vi.clearAllMocks()
})

describe('SettingsPage', () => {
  it('renders title and description', () => {
    render(<SettingsPage />)
    expect(screen.getByText('Settings')).toBeInTheDocument()
    expect(screen.getByText('Manage your preferences')).toBeInTheDocument()
  })

  it('renders all tab triggers', () => {
    render(<SettingsPage />)
    expect(screen.getByText('Profile')).toBeInTheDocument()
    expect(screen.getByText('Security')).toBeInTheDocument()
    expect(screen.getByText('Notifications')).toBeInTheDocument()
    expect(screen.getByText('Billing')).toBeInTheDocument()
    expect(screen.getByText('API')).toBeInTheDocument()
  })

  it('renders profile tab by default with form fields', () => {
    render(<SettingsPage />)
    expect(screen.getByText('Profile Information')).toBeInTheDocument()
    expect(screen.getByLabelText('Full name')).toBeInTheDocument()
    expect(screen.getByLabelText('Email')).toBeInTheDocument()
  })

  it('switches to the security tab when clicked', async () => {
    const user = userEvent.setup()
    render(<SettingsPage />)

    await user.click(screen.getByRole('tab', { name: /security/i }))

    expect(screen.getByText('Two-factor authentication')).toBeInTheDocument()
    expect(screen.queryByText('Profile Information')).not.toBeInTheDocument()
  })

  it('renders Danger Zone section', () => {
    render(<SettingsPage />)
    expect(screen.getByText('Danger Zone')).toBeInTheDocument()
    expect(screen.getByText('Delete my account')).toBeInTheDocument()
  })

  it('shows "Saved!" after saving profile', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({}),
    })

    render(<SettingsPage />)

    const saveButton = screen.getByText('Save')
    fireEvent.click(saveButton)

    await waitFor(() => {
      expect(screen.getByText('Saved!')).toBeInTheDocument()
    })
  })

  it('renders notification switches', async () => {
    const user = userEvent.setup()
    render(<SettingsPage />)

    // Switch to notifications tab
    await user.click(screen.getByRole('tab', { name: /notifications/i }))

    expect(screen.getByText('Sync successful')).toBeInTheDocument()
    expect(screen.getByText('Sync failure')).toBeInTheDocument()
    expect(screen.getByText('Weekly digest')).toBeInTheDocument()
    expect(screen.getByText('Team invites')).toBeInTheDocument()
  })

  it('renders billing tab with plan info', async () => {
    const user = userEvent.setup()
    render(<SettingsPage />)

    await user.click(screen.getByRole('tab', { name: /billing/i }))

    expect(screen.getByText('Current plan')).toBeInTheDocument()
    expect(screen.getByText('Pro Plan')).toBeInTheDocument()
    expect(screen.getByText('$29/month - renews June 15, 2026')).toBeInTheDocument()
  })
})
