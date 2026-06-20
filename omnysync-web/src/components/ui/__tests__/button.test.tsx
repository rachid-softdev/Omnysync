import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { Button } from '../button'

describe('Button', () => {
  it('renders with default variant', () => {
    render(<Button>Click me</Button>)
    const button = screen.getByRole('button', { name: /click me/i })
    expect(button).toBeInTheDocument()
    expect(button).toHaveAttribute('data-variant', 'default')
  })

  it('renders disabled state', () => {
    render(<Button disabled>Disabled</Button>)
    const button = screen.getByRole('button', { name: /disabled/i })
    expect(button).toBeDisabled()
    expect(button).toHaveClass('disabled:opacity-50')
  })

  it('handles click events', async () => {
    const user = userEvent.setup()
    const handleClick = vi.fn()

    render(<Button onClick={handleClick}>Click</Button>)
    await user.click(screen.getByRole('button', { name: /click/i }))

    expect(handleClick).toHaveBeenCalledTimes(1)
  })

  it('does not fire click when disabled', async () => {
    const user = userEvent.setup()
    const handleClick = vi.fn()

    render(
      <Button disabled onClick={handleClick}>
        Disabled
      </Button>
    )
    await user.click(screen.getByRole('button', { name: /disabled/i }))

    expect(handleClick).not.toHaveBeenCalled()
  })

  it('renders all variants with appropriate classes', () => {
    const variants = [
      { variant: 'default' as const, classCheck: 'bg-primary' },
      { variant: 'outline' as const, classCheck: 'border-border' },
      { variant: 'secondary' as const, classCheck: 'bg-secondary' },
      { variant: 'ghost' as const, classCheck: 'hover:bg-muted' },
      { variant: 'destructive' as const, classCheck: 'bg-destructive/10' },
      { variant: 'link' as const, classCheck: 'underline-offset-4' },
    ]

    for (const { variant, classCheck } of variants) {
      const { unmount } = render(<Button variant={variant}>{variant}</Button>)
      const button = screen.getByRole('button', { name: variant })
      expect(button).toHaveClass(classCheck)
      expect(button).toHaveAttribute('data-variant', variant)
      unmount()
    }
  })

  it('renders all sizes with appropriate data-size', () => {
    const sizes = [
      { size: 'default' as const, expected: 'default' },
      { size: 'xs' as const, expected: 'xs' },
      { size: 'sm' as const, expected: 'sm' },
      { size: 'lg' as const, expected: 'lg' },
      { size: 'icon' as const, expected: 'icon' },
    ]

    for (const { size, expected } of sizes) {
      const { unmount } = render(
        <Button size={size}>{expected === 'icon' ? '+' : expected}</Button>
      )
      const button = screen.getByRole('button', { name: expected === 'icon' ? '+' : expected })
      expect(button).toHaveAttribute('data-size', expected)
      unmount()
    }
  })

  it('renders as child when asChild is true', () => {
    render(
      <Button asChild>
        <a href="/test">Link as button</a>
      </Button>
    )

    const link = screen.getByRole('link', { name: /link as button/i })
    expect(link).toBeInTheDocument()
    expect(link).toHaveAttribute('data-slot', 'button')
    expect(link).toHaveAttribute('href', '/test')
  })

  it('renders asChild with a native button element', () => {
    render(
      <Button asChild>
        <button type="submit">Native button</button>
      </Button>
    )

    const btn = screen.getByRole('button', { name: /native button/i })
    expect(btn).toBeInTheDocument()
    expect(btn).toHaveAttribute('type', 'submit')
    expect(btn).toHaveAttribute('data-slot', 'button')
  })

  it('renders with custom className', () => {
    render(<Button className="custom-class">Styled</Button>)
    expect(screen.getByRole('button', { name: /styled/i })).toHaveClass('custom-class')
  })

  it('passes additional HTML attributes', () => {
    render(
      <Button type="submit" aria-label="Submit form">
        Submit
      </Button>
    )
    const button = screen.getByRole('button', { name: /submit form/i })
    expect(button).toHaveAttribute('type', 'submit')
  })

  it('has data-slot attribute', () => {
    render(<Button>Slot</Button>)
    expect(screen.getByRole('button', { name: /slot/i })).toHaveAttribute('data-slot', 'button')
  })

  it('renders with icon size as a proper button', () => {
    render(<Button size="icon">+</Button>)
    const button = screen.getByRole('button', { name: '+' })
    expect(button).toHaveAttribute('data-size', 'icon')
    expect(button).toHaveClass('size-8')
  })

  describe('keyboard interaction', () => {
    it('fires click on Enter key', async () => {
      const user = userEvent.setup()
      const handleClick = vi.fn()

      render(<Button onClick={handleClick}>Press Enter</Button>)
      const button = screen.getByRole('button', { name: /press enter/i })
      button.focus()
      await user.keyboard('{Enter}')

      expect(handleClick).toHaveBeenCalledTimes(1)
    })

    it('fires click on Space key', async () => {
      const user = userEvent.setup()
      const handleClick = vi.fn()

      render(<Button onClick={handleClick}>Press Space</Button>)
      const button = screen.getByRole('button', { name: /press space/i })
      button.focus()
      await user.keyboard(' ')

      expect(handleClick).toHaveBeenCalledTimes(1)
    })

    it('does not fire click on Enter when disabled', async () => {
      const user = userEvent.setup()
      const handleClick = vi.fn()

      render(
        <Button disabled onClick={handleClick}>
          Disabled
        </Button>
      )
      const button = screen.getByRole('button', { name: /disabled/i })
      button.focus()
      await user.keyboard('{Enter}')

      expect(handleClick).not.toHaveBeenCalled()
    })
  })

  describe('accessibility', () => {
    it('has disabled attribute when disabled', () => {
      render(<Button disabled>Disabled</Button>)
      expect(screen.getByRole('button', { name: /disabled/i })).toBeDisabled()
    })

    it('supports aria-pressed for toggle buttons', () => {
      render(<Button aria-pressed="true">Toggle</Button>)
      const button = screen.getByRole('button', { name: /toggle/i })
      expect(button).toHaveAttribute('aria-pressed', 'true')
    })

    it('supports aria-label', () => {
      render(<Button aria-label="Close dialog">X</Button>)
      expect(screen.getByRole('button', { name: /close dialog/i })).toBeInTheDocument()
    })
  })

  describe('edge cases', () => {
    it('renders with no children', () => {
      const { container } = render(<Button />)
      const button = container.querySelector('button')
      expect(button).toBeInTheDocument()
      expect(button).toBeEmptyDOMElement()
    })

    it('renders with React fragment children', () => {
      render(
        <Button>
          <>Text</>
        </Button>
      )
      expect(screen.getByRole('button', { name: /text/i })).toBeInTheDocument()
    })

    it('applies additional data attributes', () => {
      render(<Button data-testid="custom-btn">Test</Button>)
      expect(screen.getByTestId('custom-btn')).toBeInTheDocument()
    })
  })
})
