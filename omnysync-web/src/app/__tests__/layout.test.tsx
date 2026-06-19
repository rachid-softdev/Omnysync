/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import RootLayout from '../layout'

vi.mock('next/font/google', () => ({
  Inter: () => ({ className: 'inter-font' }),
}))

vi.mock('next/headers', () => ({
  headers: vi.fn(() => ({
    get: vi.fn(() => 'en-US,en;q=0.9'),
  })),
}))

vi.mock('@/components/providers', () => ({
  Providers: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="providers">{children}</div>
  ),
}))

vi.mock('@/components/header', () => ({
  Header: () => <div data-testid="header">Header</div>,
}))

beforeEach(() => {
  vi.clearAllMocks()
})

describe('RootLayout', () => {
  it('renders html element with locale from accept-language header', async () => {
    const element = await RootLayout({ children: <div>Content</div> })
    render(element)

    expect(document.documentElement.getAttribute('lang')).toBe('en')
  })

  it('renders Providers wrapper', async () => {
    const element = await RootLayout({ children: <div>Content</div> })
    render(element)

    expect(screen.getByTestId('providers')).toBeInTheDocument()
  })

  it('renders Header component', async () => {
    const element = await RootLayout({ children: <div>Content</div> })
    render(element)

    expect(screen.getByTestId('header')).toBeInTheDocument()
  })

  it('renders children content', async () => {
    const element = await RootLayout({ children: <div data-testid="child">Content</div> })
    render(element)

    expect(screen.getByTestId('child')).toBeInTheDocument()
    expect(screen.getByText('Content')).toBeInTheDocument()
  })

  it('falls back to en locale when accept-language is empty', async () => {
    const mockHeaders = vi.mocked((await import('next/headers')).headers)
    mockHeaders.mockReturnValueOnce({
      get: vi.fn(() => null),
    } as any)

    const element = await RootLayout({ children: <div>Content</div> })
    render(element)

    expect(document.documentElement.getAttribute('lang')).toBe('en')
  })
})
