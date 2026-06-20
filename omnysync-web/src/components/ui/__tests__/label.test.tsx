import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { Label } from '../label'

describe('Label', () => {
  it('renders with text', () => {
    render(<Label>Username</Label>)
    expect(screen.getByText('Username')).toBeInTheDocument()
  })

  it('renders with htmlFor attribute', () => {
    render(<Label htmlFor="username">Username</Label>)
    const label = screen.getByText('Username')
    expect(label).toHaveAttribute('for', 'username')
  })

  it('applies custom className', () => {
    render(<Label className="custom-label">Styled</Label>)
    expect(screen.getByText('Styled')).toHaveClass('custom-label')
  })

  it('renders with correct font size class', () => {
    render(<Label>Font Check</Label>)
    expect(screen.getByText('Font Check')).toHaveClass('text-sm')
  })

  it('renders with font-medium class', () => {
    render(<Label>Medium Check</Label>)
    expect(screen.getByText('Medium Check')).toHaveClass('font-medium')
  })

  it('associates with input via htmlFor', () => {
    render(
      <>
        <Label htmlFor="email">Email</Label>
        <input id="email" type="email" />
      </>
    )
    const label = screen.getByText('Email')
    expect(label).toHaveAttribute('for', 'email')
  })

  it('spreads additional props', () => {
    render(
      <Label data-testid="test-label" id="label-id">
        Props
      </Label>
    )
    const label = screen.getByTestId('test-label')
    expect(label).toHaveAttribute('id', 'label-id')
  })

  it('renders as a LabelPrimitive Root from Radix', () => {
    const { container } = render(<Label>Radix Label</Label>)
    // The Radix Label renders as a <label> element
    const labelEl = container.querySelector('label')
    expect(labelEl).toBeInTheDocument()
  })
})
