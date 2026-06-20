import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { Switch } from '../switch'

describe('Switch', () => {
  it('renders in unchecked state by default', () => {
    render(<Switch aria-label="Toggle switch" />)
    const switchEl = screen.getByRole('switch', {
      name: /toggle switch/i,
    })
    expect(switchEl).toBeInTheDocument()
    expect(switchEl).not.toBeChecked()
  })

  it('renders in checked state when checked prop is true', () => {
    render(<Switch checked aria-label="Enabled switch" />)
    const switchEl = screen.getByRole('switch', {
      name: /enabled switch/i,
    })
    expect(switchEl).toBeChecked()
  })

  it('renders disabled state', () => {
    render(<Switch disabled aria-label="Disabled switch" />)
    const switchEl = screen.getByRole('switch', {
      name: /disabled switch/i,
    })
    expect(switchEl).toBeDisabled()
  })

  it('calls onCheckedChange when clicked', async () => {
    const user = userEvent.setup()
    const handleChange = vi.fn()

    render(<Switch onCheckedChange={handleChange} aria-label="Clickable switch" />)

    await user.click(screen.getByRole('switch', { name: /clickable switch/i }))
    expect(handleChange).toHaveBeenCalledWith(true)
  })

  it('does not call onCheckedChange when disabled', async () => {
    const user = userEvent.setup()
    const handleChange = vi.fn()

    render(<Switch disabled onCheckedChange={handleChange} aria-label="Disabled switch" />)

    await user.click(screen.getByRole('switch', { name: /disabled switch/i }))
    expect(handleChange).not.toHaveBeenCalled()
  })

  it('applies custom className', () => {
    render(<Switch className="custom-switch" aria-label="Custom switch" />)
    const switchEl = screen.getByRole('switch', {
      name: /custom switch/i,
    })
    expect(switchEl).toHaveClass('custom-switch')
  })

  it('has proper ARIA role', () => {
    render(<Switch aria-label="ARIA switch" />)
    expect(screen.getByRole('switch', { name: /aria switch/i })).toBeInTheDocument()
  })

  it('has focus-visible styles via class', () => {
    render(<Switch aria-label="Focus switch" />)
    const switchEl = screen.getByRole('switch', {
      name: /focus switch/i,
    })
    expect(switchEl).toHaveClass('focus-visible:ring-2')
  })

  describe('keyboard interaction', () => {
    it('toggles on Space key press', async () => {
      const user = userEvent.setup()
      const handleChange = vi.fn()

      render(<Switch onCheckedChange={handleChange} aria-label="Space" />)
      const switchEl = screen.getByRole('switch', { name: /space/i })
      switchEl.focus()
      await user.keyboard(' ')

      expect(handleChange).toHaveBeenCalledWith(true)
    })

    it('does not toggle on Space when disabled', async () => {
      const user = userEvent.setup()
      const handleChange = vi.fn()

      render(<Switch disabled onCheckedChange={handleChange} aria-label="Disabled" />)
      const switchEl = screen.getByRole('switch', { name: /disabled/i })
      switchEl.focus()
      await user.keyboard(' ')

      expect(handleChange).not.toHaveBeenCalled()
    })
  })

  describe('accessibility', () => {
    it('updates aria-checked when clicked', async () => {
      const user = userEvent.setup()
      const handleChange = vi.fn()

      const { rerender } = render(
        <Switch checked={false} onCheckedChange={handleChange} aria-label="Accessible" />
      )
      const switchEl = screen.getByRole('switch', { name: /accessible/i })
      expect(switchEl).toHaveAttribute('aria-checked', 'false')

      await user.click(switchEl)
      expect(handleChange).toHaveBeenCalledWith(true)

      rerender(<Switch checked={true} onCheckedChange={handleChange} aria-label="Accessible" />)
      expect(screen.getByRole('switch', { name: /accessible/i })).toHaveAttribute(
        'aria-checked',
        'true'
      )
    })
  })
})
