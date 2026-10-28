/* eslint-disable @typescript-eslint/no-require-imports */
import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react'
import SettingsPage from '../../(dashboard)/dashboard/settings/page'

const mockPush = vi.hoisted(() => vi.fn())
const mockSignOut = vi.hoisted(() => vi.fn())

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}))

vi.mock('next-auth/react', () => ({
  signOut: mockSignOut,
}))

beforeAll(() => {
  document.documentElement.lang = 'en'
})

// Mock Radix UI Tabs to support click-based tab switching in jsdom
vi.mock('@/components/ui/tabs', () => {
  const React = require('react')
  const { createContext, useContext, useState } = React

  const TabsContext = createContext<{
    value: string
    onChange: (v: string) => void
  }>({ value: 'profile', onChange: () => {} })

  return {
    Tabs: ({ value, defaultValue, children, className, ...props }: any) => {
      const [current, onChange] = useState(value ?? defaultValue ?? 'profile')
      return (
        <TabsContext.Provider value={{ value: current, onChange }}>
          <div className={className} data-orientation="horizontal" {...props}>
            {children}
          </div>
        </TabsContext.Provider>
      )
    },
    TabsList: ({ children, className, ...props }: any) => (
      <div role="tablist" className={className} aria-orientation="horizontal" {...props}>
        {children}
      </div>
    ),
    TabsTrigger: ({ value: tabValue, children, className, ...props }: any) => {
      const { value, onChange } = useContext(TabsContext)
      return (
        <button
          role="tab"
          className={className}
          data-state={value === tabValue ? 'active' : 'inactive'}
          onClick={() => onChange(tabValue)}
          {...props}
        >
          {children}
        </button>
      )
    },
    TabsContent: ({ value: tabValue, children, className, ...props }: any) => {
      const { value } = useContext(TabsContext)
      if (value !== tabValue) return null
      return (
        <div className={className} {...props}>
          {children}
        </div>
      )
    },
  }
})

const usageResponse = {
  ok: true,
  json: async () => ({
    currentPlan: 'Pro',
    billingCycle: {
      start: '2026-06-01T00:00:00.000Z',
      end: '2026-07-01T00:00:00.000Z',
    },
    syncUsed: 12,
    syncLimit: 100,
    documentsUsed: 3,
    documentsLimit: 500,
    connectorsUsed: 2,
    connectorsLimit: 10,
  }),
} as Response

const profileResponse = {
  ok: true,
  json: async () => ({
    id: 'user-1',
    name: 'Ada Lovelace',
    email: 'ada@example.com',
    image: null,
    organization: { id: 'org-1', name: 'Analytical Engines' },
  }),
} as Response

beforeEach(() => {
  vi.clearAllMocks()
  mockSignOut.mockResolvedValue(undefined)
  Object.defineProperty(window, 'location', {
    value: { href: '' },
    writable: true,
  })
  global.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    if (url.includes('/api/usage')) return usageResponse
    if (url.includes('/api/user/profile')) {
      if (init?.method === 'PATCH') {
        return {
          ok: true,
          json: async () => ({
            id: 'user-1',
            name: 'Ada Lovelace',
            email: 'ada@example.com',
            image: null,
          }),
        } as Response
      }
      return profileResponse
    }
    return { ok: true, json: async () => ({}) } as Response
  })
})

async function renderSettings() {
  const result = render(<SettingsPage />)
  await waitFor(() => expect(screen.queryByText('Loading...')).not.toBeInTheDocument())
  await waitFor(() => expect(screen.getByLabelText('Email')).toHaveValue('ada@example.com'))
  return result
}

describe('SettingsPage', () => {
  it('renders title and description', async () => {
    await renderSettings()
    expect(screen.getByText('Settings')).toBeInTheDocument()
    expect(screen.getByText('Manage your preferences and configurations')).toBeInTheDocument()
  })

  it('renders all tab triggers', async () => {
    await renderSettings()
    expect(screen.getByText('Profile')).toBeInTheDocument()
    expect(screen.getByText('Security')).toBeInTheDocument()
    expect(screen.getByText('Notifications')).toBeInTheDocument()
    expect(screen.getByText('Billing')).toBeInTheDocument()
    expect(screen.queryByText('API')).not.toBeInTheDocument()
  })

  it('renders profile tab by default with form fields', async () => {
    await renderSettings()
    expect(screen.getByText('Profile Information')).toBeInTheDocument()
    expect(screen.getByLabelText('Full name')).toBeInTheDocument()
    expect(screen.getByLabelText('Email')).toBeInTheDocument()
  })

  it('renders real profile data instead of placeholders', async () => {
    await renderSettings()
    expect(screen.getByLabelText('Full name')).toHaveValue('Ada Lovelace')
    expect(screen.getByLabelText('Email')).toHaveValue('ada@example.com')
    expect(screen.getByText('Analytical Engines')).toBeInTheDocument()
    expect(screen.queryByDisplayValue('user@example.com')).not.toBeInTheDocument()
    expect(screen.queryByText('My Organization')).not.toBeInTheDocument()
  })

  it('does not render a non-functional change photo control', async () => {
    await renderSettings()
    expect(screen.queryByText('Change photo')).not.toBeInTheDocument()
    expect(screen.queryByText(/JPG, PNG/)).not.toBeInTheDocument()
  })

  it('renders Danger Zone section', async () => {
    await renderSettings()
    expect(screen.getByText('Danger Zone')).toBeInTheDocument()
    expect(screen.getByText('Delete my account')).toBeInTheDocument()
  })

  it('shows "Saved!" after saving profile', async () => {
    await renderSettings()

    const saveButton = screen.getByText('Save')
    fireEvent.click(saveButton)

    await waitFor(() => {
      expect(screen.getByText('Saved!')).toBeInTheDocument()
    })
  })

  it('renders notification switches', async () => {
    await renderSettings()

    // Switch to notifications tab
    const notifTab = screen.getByText('Notifications')
    fireEvent.click(notifTab)

    expect(screen.getByText('Sync successful')).toBeInTheDocument()
    expect(screen.getByText('Sync failure')).toBeInTheDocument()
    expect(screen.queryByText('Weekly digest')).not.toBeInTheDocument()
    expect(screen.getByText('Team invites')).toBeInTheDocument()
  })

  it('persists notification preferences instead of saving the profile name', async () => {
    await renderSettings()

    fireEvent.click(screen.getByText('Notifications'))

    const syncFailure = await screen.findByRole('switch', { name: 'Sync failure' })
    await waitFor(() => expect(syncFailure).not.toBeDisabled())

    fireEvent.click(syncFailure)
    fireEvent.click(screen.getByText('Save preferences'))

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/user/notifications',
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify({
            syncSuccess: true,
            syncFailed: false,
            teamInvites: true,
          }),
        })
      )
      expect(screen.getByText('Saved!')).toBeInTheDocument()
    })

    expect(global.fetch).not.toHaveBeenCalledWith(
      '/api/user/profile',
      expect.objectContaining({ method: 'PATCH' })
    )
  })

  it('renders billing tab with real plan and usage data', async () => {
    await renderSettings()

    fireEvent.click(screen.getByText('Billing'))

    expect(await screen.findByText('Pro')).toBeInTheDocument()
    expect(screen.getByText('Current period ends 7/1/2026')).toBeInTheDocument()
    expect(screen.getByText('12 / 100')).toBeInTheDocument()
    expect(screen.getByText('3 / 500')).toBeInTheDocument()
    expect(screen.getByText('2 / 10')).toBeInTheDocument()
    expect(screen.queryByText(/\$29/)).not.toBeInTheDocument()
    expect(screen.queryByText('Invoice history')).not.toBeInTheDocument()
  })

  it('shows a retry state when billing is unavailable', async () => {
    global.fetch = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).includes('/api/user/profile')) return profileResponse
      return { ok: false, status: 500 } as Response
    })

    await renderSettings()

    fireEvent.click(screen.getByText('Billing'))

    expect(
      await screen.findByText('Billing details are unavailable right now.')
    ).toBeInTheDocument()
    expect(screen.getByText('Retry')).toBeInTheDocument()
  })

  it('opens the Stripe billing portal when changing plan', async () => {
    global.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/api/usage')) return usageResponse
      if (url.includes('/api/user/profile')) return profileResponse
      if (url.includes('/api/stripe/portal')) {
        return {
          ok: true,
          json: async () => ({ url: 'https://stripe.com/portal/sess_123' }),
        } as Response
      }
      return { ok: true, json: async () => ({}) } as Response
    })

    await renderSettings()

    fireEvent.click(screen.getByText('Billing'))
    fireEvent.click(await screen.findByText('Change plan'))

    await waitFor(() => {
      expect(window.location.href).toBe('https://stripe.com/portal/sess_123')
    })
  })

  it('falls back to pricing when the billing portal is unavailable', async () => {
    global.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/api/usage')) return usageResponse
      if (url.includes('/api/user/profile')) return profileResponse
      if (url.includes('/api/stripe/portal')) return { ok: false, status: 404 } as Response
      return { ok: true, json: async () => ({}) } as Response
    })

    await renderSettings()

    fireEvent.click(screen.getByText('Billing'))
    fireEvent.click(await screen.findByText('Change plan'))

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/pricing')
    })
  })

  it('updates the password and signs the user out to re-authenticate', async () => {
    await renderSettings()

    fireEvent.click(screen.getByText('Security'))
    fireEvent.change(screen.getByLabelText('Current password'), {
      target: { value: 'OldPassword1' },
    })
    fireEvent.change(screen.getByLabelText('New password'), {
      target: { value: 'NewPassword1' },
    })
    fireEvent.change(screen.getByLabelText('Confirm password'), {
      target: { value: 'NewPassword1' },
    })
    fireEvent.click(screen.getByText('Update password'))

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/user/password',
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify({
            currentPassword: 'OldPassword1',
            newPassword: 'NewPassword1',
          }),
        })
      )
      expect(mockSignOut).toHaveBeenCalledWith({ callbackUrl: '/auth/signin' })
    })
  })

  it('rejects mismatched new passwords without calling the API', async () => {
    await renderSettings()

    fireEvent.click(screen.getByText('Security'))
    fireEvent.change(screen.getByLabelText('Current password'), {
      target: { value: 'OldPassword1' },
    })
    fireEvent.change(screen.getByLabelText('New password'), {
      target: { value: 'NewPassword1' },
    })
    fireEvent.change(screen.getByLabelText('Confirm password'), {
      target: { value: 'DifferentPassword1' },
    })
    fireEvent.click(screen.getByText('Update password'))

    expect(await screen.findByText('New passwords do not match.')).toBeInTheDocument()
    expect(global.fetch).not.toHaveBeenCalledWith('/api/user/password', expect.anything())
  })

  it('enables 2FA with a real setup secret and verification code', async () => {
    global.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.includes('/api/usage')) return usageResponse
      if (url.includes('/api/user/profile')) return profileResponse
      if (url.includes('/api/auth/2fa/setup') && init?.method === 'POST') {
        return {
          ok: true,
          json: async () => ({ success: true, backupCodes: ['ABCD-EFGH', 'IJKL-MNOP'] }),
        } as Response
      }
      if (url.includes('/api/auth/2fa/setup')) {
        return {
          ok: true,
          json: async () => ({
            enabled: false,
            secret: 'JBSWY3DPEHPK3PXP',
            otpauthUrl: 'otpauth://totp/Omnysync?secret=JBSWY3DPEHPK3PXP',
          }),
        } as Response
      }
      return { ok: true, json: async () => ({}) } as Response
    })

    await renderSettings()

    fireEvent.click(screen.getByText('Security'))
    fireEvent.click(screen.getByText('Enable'))

    expect(await screen.findByText('JBSWY3DPEHPK3PXP')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('6-digit code'), {
      target: { value: '123456' },
    })
    fireEvent.click(screen.getByText('Verify and enable'))

    await waitFor(() => {
      expect(screen.getByText('2FA enabled')).toBeInTheDocument()
      expect(screen.getByText('ABCD-EFGH')).toBeInTheDocument()
    })
  })

  it('signs out everywhere through the session revocation endpoint', async () => {
    await renderSettings()

    fireEvent.click(screen.getByText('Security'))
    fireEvent.click(screen.getByText('Sign out everywhere'))

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/user/sessions', {
        method: 'DELETE',
      })
      expect(mockSignOut).toHaveBeenCalledWith({ callbackUrl: '/auth/signin' })
    })
  })

  it('deletes the account only after the SUPPRIMER confirmation', async () => {
    await renderSettings()

    fireEvent.click(screen.getByText('Delete'))

    const dialog = await screen.findByRole('dialog')
    const confirmButton = within(dialog).getByRole('button', { name: 'Delete' })
    expect(confirmButton).toBeDisabled()

    fireEvent.change(within(dialog).getByLabelText('Type SUPPRIMER to confirm'), {
      target: { value: 'SUPPRIMER' },
    })
    expect(confirmButton).toBeEnabled()

    fireEvent.click(confirmButton)

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/user?confirmText=SUPPRIMER', {
        method: 'DELETE',
      })
      expect(mockSignOut).toHaveBeenCalledWith({ callbackUrl: '/' })
    })
  })
})
