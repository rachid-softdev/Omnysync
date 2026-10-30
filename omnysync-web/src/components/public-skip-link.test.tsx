import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PublicSkipLink } from './public-skip-link'

const pathnameState = vi.hoisted(() => ({ current: '/' }))

vi.mock('next/navigation', () => ({
  usePathname: () => pathnameState.current,
}))

vi.mock('@/lib/i18n/useTranslations', () => ({
  useTranslations: () => ({
    t: (key: string) => (key === 'UI_SKIP_TO_CONTENT' ? 'Skip to content' : key),
    loading: false,
    locale: 'en',
  }),
}))

beforeEach(() => {
  pathnameState.current = '/'
})

describe('PublicSkipLink', () => {
  it('links to the main content on public pages', () => {
    render(<PublicSkipLink />)

    expect(screen.getByRole('link', { name: 'Skip to content' })).toHaveAttribute(
      'href',
      '#main-content'
    )
  })

  it('renders on auth pages', () => {
    pathnameState.current = '/auth/signin'

    render(<PublicSkipLink />)

    expect(screen.getByRole('link', { name: 'Skip to content' })).toBeInTheDocument()
  })

  it('stays out of app shells that already provide a skip link', () => {
    pathnameState.current = '/dashboard/documents'
    const { container, rerender } = render(<PublicSkipLink />)
    expect(container).toBeEmptyDOMElement()

    pathnameState.current = '/admin/users'
    rerender(<PublicSkipLink />)
    expect(container).toBeEmptyDOMElement()
  })
})
