import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import AuthErrorPage from '../../auth/error/page'
import VerifyRequestPage from '../../auth/verify-request/page'

vi.mock('@/lib/i18n', () => ({
  getT: async () => (key: string) => `t:${key}`,
}))

describe('auth fallback pages', () => {
  it('renders the verify-request page', async () => {
    render(await VerifyRequestPage())

    expect(screen.getByText('t:auth_magic_link_sent_title')).toBeInTheDocument()
    expect(screen.getByText('t:auth_magic_link_expires')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 't:auth_use_another_email' })).toHaveAttribute(
      'href',
      '/auth/signin'
    )
  })

  it('renders the generic auth error', async () => {
    render(await AuthErrorPage({ searchParams: Promise.resolve({ error: 'Configuration' }) }))

    expect(screen.getByText('t:auth_error_title')).toBeInTheDocument()
    expect(screen.getByText('t:auth_error_body')).toBeInTheDocument()
  })

  it('explains an OAuth account that is not linked', async () => {
    render(
      await AuthErrorPage({ searchParams: Promise.resolve({ error: 'OAuthAccountNotLinked' }) })
    )

    expect(screen.getByText('t:auth_oauth_linked')).toBeInTheDocument()
  })
})
