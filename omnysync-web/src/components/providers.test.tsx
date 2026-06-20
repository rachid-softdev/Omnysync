/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Providers } from './providers'

const mockThemeProviderProps: Record<string, any> = {}

vi.mock('next-themes', () => ({
  ThemeProvider: (props: { children: React.ReactNode; [key: string]: any }) => {
    Object.assign(mockThemeProviderProps, props)
    const { children, ...rest } = props
    return (
      <div data-testid="theme-provider" {...rest}>
        {children}
      </div>
    )
  },
}))

vi.mock('@/components/toast-provider', () => ({
  ToastProvider: () => <div data-testid="toast-provider" />,
}))

vi.mock('@/components/error-boundary', () => ({
  ErrorBoundary: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="error-boundary">{children}</div>
  ),
}))

beforeEach(() => {
  vi.clearAllMocks()
  // Reset captured props
  Object.keys(mockThemeProviderProps).forEach((key) => delete mockThemeProviderProps[key])
})

describe('Providers', () => {
  it('renders children within provider hierarchy', () => {
    render(
      <Providers>
        <div data-testid="child">Child content</div>
      </Providers>
    )
    expect(screen.getByTestId('error-boundary')).toBeInTheDocument()
    expect(screen.getByTestId('theme-provider')).toBeInTheDocument()
    expect(screen.getByTestId('toast-provider')).toBeInTheDocument()
    expect(screen.getByText('Child content')).toBeInTheDocument()
  })

  it('passes correct props to ThemeProvider', () => {
    render(
      <Providers>
        <div>content</div>
      </Providers>
    )
    expect(mockThemeProviderProps.attribute).toBe('class')
    expect(mockThemeProviderProps.defaultTheme).toBe('system')
    expect(mockThemeProviderProps.enableSystem).toBe(true)
  })

  it('renders ToastProvider inside ThemeProvider', () => {
    render(
      <Providers>
        <div>content</div>
      </Providers>
    )
    // ToastProvider should be a sibling of children inside ThemeProvider
    const themeProvider = screen.getByTestId('theme-provider')
    const toastProvider = screen.getByTestId('toast-provider')
    expect(themeProvider).toContainElement(toastProvider)
  })

  it('renders ErrorBoundary as the outermost wrapper', () => {
    render(
      <Providers>
        <div>content</div>
      </Providers>
    )
    const errorBoundary = screen.getByTestId('error-boundary')
    const themeProvider = screen.getByTestId('theme-provider')
    expect(errorBoundary).toContainElement(themeProvider)
  })

  it('renders with no children without crashing', () => {
    const { container } = render(<Providers />)
    expect(screen.getByTestId('error-boundary')).toBeInTheDocument()
    expect(container.querySelector('[data-testid="child"]')).toBeNull()
  })

  it('renders multiple children', () => {
    render(
      <Providers>
        <div data-testid="child1">First</div>
        <div data-testid="child2">Second</div>
      </Providers>
    )
    expect(screen.getByText('First')).toBeInTheDocument()
    expect(screen.getByText('Second')).toBeInTheDocument()
  })
})
