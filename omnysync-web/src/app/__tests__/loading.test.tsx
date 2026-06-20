import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('@/lib/i18n/useTranslations', () => ({
  useTranslations: () => ({ t: (key: string) => key, loading: false, locale: 'en' }),
}))

import Loading from '../loading'

describe('Loading page', () => {
  it('renders loading indicator', () => {
    render(<Loading />)
    expect(screen.getByText('loading.default')).toBeInTheDocument()
  })

  it('renders spinning icon', () => {
    const { container } = render(<Loading />)
    const svg = container.querySelector('svg.animate-spin')
    expect(svg).toBeInTheDocument()
  })
})
