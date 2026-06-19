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
})
