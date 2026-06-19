/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-require-imports */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import SettingsPage from '../../(dashboard)/dashboard/settings/page'

// Mock Radix UI Tabs to support click-based tab switching in jsdom
vi.mock('@/components/ui/tabs', () => {
  const React = require('react')
  const { createContext, useContext, useState } = React

  const TabsContext = createContext<{
    value: string
    onChange: (v: string) => void
  }>({ value: 'profile', onChange: () => {} })

  return {
    Tabs: ({ defaultValue, children, className, ...props }: any) => {
      const [value, onChange] = useState(defaultValue)
      return (
        <TabsContext.Provider value={{ value, onChange }}>
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

  it('renders Danger Zone section', () => {
    render(<SettingsPage />)
    expect(screen.getByText('Danger Zone')).toBeInTheDocument()
    expect(screen.getByText('Delete my account')).toBeInTheDocument()
  })

  it('shows "Saved!" after saving profile', async () => {
    render(<SettingsPage />)

    const saveButton = screen.getByText('Save')
    fireEvent.click(saveButton)

    await waitFor(() => {
      expect(screen.getByText('Saved!')).toBeInTheDocument()
    })
  })

  it('renders notification switches', () => {
    render(<SettingsPage />)

    // Switch to notifications tab
    const notifTab = screen.getByText('Notifications')
    fireEvent.click(notifTab)

    expect(screen.getByText('Sync successful')).toBeInTheDocument()
    expect(screen.getByText('Sync failure')).toBeInTheDocument()
    expect(screen.getByText('Weekly digest')).toBeInTheDocument()
    expect(screen.getByText('Team invites')).toBeInTheDocument()
  })

  it('renders billing tab with plan info', () => {
    render(<SettingsPage />)

    const billingTab = screen.getByText('Billing')
    fireEvent.click(billingTab)

    expect(screen.getByText('Current plan')).toBeInTheDocument()
    expect(screen.getByText('Pro Plan')).toBeInTheDocument()
    expect(screen.getByText('$29/month - renews June 15, 2026')).toBeInTheDocument()
  })
})
