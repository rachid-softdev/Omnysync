import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { Textarea } from '../textarea'

describe('Textarea', () => {
  it('renders with placeholder', () => {
    render(<Textarea placeholder="Enter description" />)
    const textarea = screen.getByPlaceholderText('Enter description')
    expect(textarea).toBeInTheDocument()
  })

  it('renders disabled state', () => {
    render(<Textarea disabled placeholder="Disabled textarea" />)
    const textarea = screen.getByPlaceholderText('Disabled textarea')
    expect(textarea).toBeDisabled()
    expect(textarea).toHaveClass('disabled:opacity-50')
  })

  it('accepts user input', async () => {
    const user = userEvent.setup()

    render(<Textarea placeholder="Type here" />)
    const textarea = screen.getByPlaceholderText('Type here')

    await user.type(textarea, 'Hello World')
    expect(textarea).toHaveValue('Hello World')
  })

  it('renders with custom number of rows', () => {
    render(<Textarea rows={5} placeholder="Resizable" />)
    const textarea = screen.getByPlaceholderText('Resizable')
    expect(textarea).toHaveAttribute('rows', '5')
  })

  it('applies custom className', () => {
    render(<Textarea className="custom-textarea" placeholder="Custom styling" />)
    const textarea = screen.getByPlaceholderText('Custom styling')
    expect(textarea).toHaveClass('custom-textarea')
  })

  it('forwards ref correctly', () => {
    const ref = vi.fn()

    render(<Textarea ref={ref} placeholder="Ref test" />)
    expect(ref).toHaveBeenCalled()
    expect(ref.mock.calls[0][0]).toBeInstanceOf(HTMLTextAreaElement)
  })

  it('handles change events', async () => {
    const user = userEvent.setup()
    const handleChange = vi.fn()

    render(<Textarea placeholder="Change handler" onChange={handleChange} />)
    const textarea = screen.getByPlaceholderText('Change handler')

    await user.type(textarea, 'a')
    expect(handleChange).toHaveBeenCalled()
  })

  it('has min-height style', () => {
    render(<Textarea placeholder="Minimum height" />)
    const textarea = screen.getByPlaceholderText('Minimum height')
    expect(textarea).toHaveClass('min-h-[80px]')
  })

  it('has base text size for mobile', () => {
    render(<Textarea placeholder="Text size" />)
    const textarea = screen.getByPlaceholderText('Text size')
    expect(textarea).toHaveClass('text-base')
  })
})
