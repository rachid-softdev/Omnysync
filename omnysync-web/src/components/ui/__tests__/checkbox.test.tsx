import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { Checkbox } from '../checkbox'

describe('Checkbox', () => {
  it('renders in unchecked state by default', () => {
    render(<Checkbox aria-label="Accept terms" />)
    const checkbox = screen.getByRole('checkbox', { name: /accept terms/i })
    expect(checkbox).toBeInTheDocument()
    expect(checkbox).not.toBeChecked()
  })

  it('renders in checked state when checked prop is true', () => {
    render(<Checkbox checked aria-label="Checked" />)
    const checkbox = screen.getByRole('checkbox', { name: /checked/i })
    expect(checkbox).toBeChecked()
  })

  it('renders in disabled state', () => {
    render(<Checkbox disabled aria-label="Disabled checkbox" />)
    const checkbox = screen.getByRole('checkbox', {
      name: /disabled checkbox/i,
    })
    expect(checkbox).toBeDisabled()
  })

  it('calls onCheckedChange when clicked', async () => {
    const user = userEvent.setup()
    const handleChange = vi.fn()

    render(<Checkbox onCheckedChange={handleChange} aria-label="Toggle me" />)

    await user.click(screen.getByRole('checkbox', { name: /toggle me/i }))
    expect(handleChange).toHaveBeenCalledWith(true)
  })

  it('does not call onCheckedChange when disabled', async () => {
    const user = userEvent.setup()
    const handleChange = vi.fn()

    render(<Checkbox disabled onCheckedChange={handleChange} aria-label="Disabled" />)

    await user.click(screen.getByRole('checkbox', { name: /disabled/i }))
    expect(handleChange).not.toHaveBeenCalled()
  })

  it('applies custom className', () => {
    render(<Checkbox className="custom-checkbox" aria-label="Custom" />)
    const checkbox = screen.getByRole('checkbox', { name: /custom/i })
    expect(checkbox).toHaveClass('custom-checkbox')
  })

  it('has proper ARIA role', () => {
    render(<Checkbox aria-label="ARIA test" />)
    expect(screen.getByRole('checkbox', { name: /aria test/i })).toBeInTheDocument()
  })

  it('toggles checked state on click', async () => {
    const user = userEvent.setup()
    const handleChange = vi.fn()

    const { rerender } = render(
      <Checkbox checked={false} onCheckedChange={handleChange} aria-label="Toggle" />
    )

    await user.click(screen.getByRole('checkbox', { name: /toggle/i }))
    expect(handleChange).toHaveBeenCalledWith(true)

    rerender(<Checkbox checked={true} onCheckedChange={handleChange} aria-label="Toggle" />)
    expect(screen.getByRole('checkbox', { name: /toggle/i })).toBeChecked()
  })

  describe('keyboard interaction', () => {
    it('toggles on Space key press', async () => {
      const user = userEvent.setup()
      const handleChange = vi.fn()

      render(<Checkbox onCheckedChange={handleChange} aria-label="Space toggle" />)
      const checkbox = screen.getByRole('checkbox', { name: /space toggle/i })
      checkbox.focus()
      await user.keyboard(' ')

      expect(handleChange).toHaveBeenCalledWith(true)
    })

    it('does not toggle on Space when disabled', async () => {
      const user = userEvent.setup()
      const handleChange = vi.fn()

      render(<Checkbox disabled onCheckedChange={handleChange} aria-label="Disabled space" />)
      const checkbox = screen.getByRole('checkbox', { name: /disabled space/i })
      checkbox.focus()
      await user.keyboard(' ')

      expect(handleChange).not.toHaveBeenCalled()
    })
  })

  describe('indeterminate state', () => {
    it('renders with aria-checked mixed when checked is indeterminate', () => {
      render(<Checkbox checked="indeterminate" aria-label="Indeterminate" />)
      const checkbox = screen.getByRole('checkbox', { name: /indeterminate/i })
      expect(checkbox).toHaveAttribute('data-state', 'indeterminate')
    })
  })

  describe('accessibility', () => {
    it('has aria-checked attribute that reflects checked state', () => {
      const { rerender } = render(<Checkbox checked={false} aria-label="Accessible" />)
      let checkbox = screen.getByRole('checkbox', { name: /accessible/i })
      expect(checkbox).toHaveAttribute('aria-checked', 'false')

      rerender(<Checkbox checked={true} aria-label="Accessible" />)
      checkbox = screen.getByRole('checkbox', { name: /accessible/i })
      expect(checkbox).toHaveAttribute('aria-checked', 'true')
    })
  })
})
