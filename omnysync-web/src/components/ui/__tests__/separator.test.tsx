import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { Separator } from '../separator'

describe('Separator', () => {
  it('renders with horizontal orientation by default', () => {
    const { container } = render(<Separator />)

    const separator = container.firstChild as HTMLElement
    expect(separator).toBeInTheDocument()
    expect(separator).toHaveAttribute('data-orientation', 'horizontal')
  })

  it('renders with horizontal orientation explicitly', () => {
    const { container } = render(<Separator orientation="horizontal" />)

    const separator = container.firstChild as HTMLElement
    expect(separator).toHaveAttribute('data-orientation', 'horizontal')
    expect(separator).toHaveClass('h-[1px]')
    expect(separator).toHaveClass('w-full')
  })

  it('renders with vertical orientation', () => {
    const { container } = render(<Separator orientation="vertical" />)

    const separator = container.firstChild as HTMLElement
    expect(separator).toHaveAttribute('data-orientation', 'vertical')
    expect(separator).toHaveClass('h-full')
    expect(separator).toHaveClass('w-[1px]')
  })

  it('applies custom className', () => {
    const { container } = render(<Separator className="custom-separator" />)

    const separator = container.firstChild as HTMLElement
    expect(separator).toHaveClass('custom-separator')
  })

  it('is decorative by default', () => {
    const { container } = render(<Separator />)

    const separator = container.firstChild as HTMLElement
    expect(separator).toHaveAttribute('data-orientation')
  })

  it('has shrink-0 class', () => {
    const { container } = render(<Separator />)

    const separator = container.firstChild as HTMLElement
    expect(separator).toHaveClass('shrink-0')
  })

  it('has bg-border class', () => {
    const { container } = render(<Separator />)

    const separator = container.firstChild as HTMLElement
    expect(separator).toHaveClass('bg-border')
  })

  it('renders as hr element', () => {
    const { container } = render(<Separator />)

    const separator = container.firstChild as HTMLElement
    expect(separator.tagName).toBe('DIV')
  })
})
