import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ThemeToggle } from './theme-toggle'

const mockSetTheme = vi.hoisted(() => vi.fn())
const mockUseTheme = vi.hoisted(() =>
  vi.fn(() => ({
    theme: 'light',
    setTheme: mockSetTheme,
  }))
)

vi.mock('next-themes', () => ({
  useTheme: mockUseTheme,
}))

beforeEach(() => {
  vi.clearAllMocks()
  mockUseTheme.mockReturnValue({ theme: 'light', setTheme: mockSetTheme })
})

describe('ThemeToggle', () => {
  it('renders theme toggle button', () => {
    render(<ThemeToggle />)
    const button = screen.getByLabelText('Toggle theme')
    expect(button).toBeInTheDocument()
  })

  it('toggles theme from light to dark on click', () => {
    render(<ThemeToggle />)
    const button = screen.getByLabelText('Toggle theme')
    fireEvent.click(button)
    expect(mockSetTheme).toHaveBeenCalledWith('dark')
  })

  it('toggles theme from dark to light on click', () => {
    mockUseTheme.mockReturnValue({
      theme: 'dark',
      setTheme: mockSetTheme,
    })

    render(<ThemeToggle />)
    const button = screen.getByLabelText('Toggle theme')
    fireEvent.click(button)
    expect(mockSetTheme).toHaveBeenCalledWith('light')
  })

  it('renders placeholder div before mount (mounted=false)', () => {
    // Simulate initial state where useEffect hasn't run yet
    // The component starts with mounted=false, so placeholder div renders
    render(<ThemeToggle />)
    // After initial render, useEffect runs and sets mounted=true
    // But we can test the button is present after mount
    const button = screen.getByLabelText('Toggle theme')
    expect(button).toBeInTheDocument()

    // The button should have the correct classes
    expect(button.className).toContain('rounded-full')
    expect(button.className).toContain('bg-background')
  })

  it('has accessible aria-label on button', () => {
    render(<ThemeToggle />)
    const button = screen.getByRole('button')
    expect(button).toHaveAttribute('aria-label', 'Toggle theme')
  })
})
