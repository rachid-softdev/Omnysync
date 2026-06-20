import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { Badge } from '../badge'

describe('Badge', () => {
  it('renders with default variant', () => {
    render(<Badge>Default Badge</Badge>)
    const badge = screen.getByText('Default Badge')
    expect(badge).toBeInTheDocument()
    expect(badge).toHaveClass('bg-primary')
    expect(badge).toHaveClass('text-primary-foreground')
  })

  it('renders with secondary variant', () => {
    render(<Badge variant="secondary">Secondary</Badge>)
    const badge = screen.getByText('Secondary')
    expect(badge).toHaveClass('bg-secondary')
    expect(badge).toHaveClass('text-secondary-foreground')
  })

  it('renders with destructive variant', () => {
    render(<Badge variant="destructive">Destructive</Badge>)
    const badge = screen.getByText('Destructive')
    expect(badge).toHaveClass('bg-destructive')
    expect(badge).toHaveClass('text-destructive-foreground')
  })

  it('renders with outline variant', () => {
    render(<Badge variant="outline">Outline</Badge>)
    const badge = screen.getByText('Outline')
    expect(badge).toHaveClass('text-foreground')
  })

  it('renders with custom className', () => {
    render(<Badge className="custom-class">Custom</Badge>)
    const badge = screen.getByText('Custom')
    expect(badge).toHaveClass('custom-class')
  })

  it('has rounded-full class', () => {
    render(<Badge>Rounded</Badge>)
    expect(screen.getByText('Rounded')).toHaveClass('rounded-full')
  })

  it('renders with inline-flex layout', () => {
    render(<Badge>Layout</Badge>)
    expect(screen.getByText('Layout')).toHaveClass('inline-flex')
  })

  it('spreads additional props', () => {
    render(
      <Badge data-testid="test-badge" id="badge-id">
        Props
      </Badge>
    )
    const badge = screen.getByTestId('test-badge')
    expect(badge).toHaveAttribute('id', 'badge-id')
  })
})
