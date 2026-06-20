import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { Input } from '../input'

describe('Input', () => {
  it('renders with placeholder', () => {
    render(<Input placeholder="Enter text" />)
    const input = screen.getByPlaceholderText('Enter text')
    expect(input).toBeInTheDocument()
  })

  it('renders with default type text', () => {
    render(<Input placeholder="Text input" />)
    const input = screen.getByPlaceholderText('Text input') as HTMLInputElement
    expect(input.type).toBe('text')
  })

  it('renders with different type', () => {
    render(<Input type="email" placeholder="Email" />)
    const input = screen.getByPlaceholderText('Email')
    expect(input).toHaveAttribute('type', 'email')
  })

  it('renders disabled state', () => {
    render(<Input disabled placeholder="Disabled" />)
    const input = screen.getByPlaceholderText('Disabled')
    expect(input).toBeDisabled()
    expect(input).toHaveClass('disabled:opacity-50')
  })

  it('accepts user input', async () => {
    const user = userEvent.setup()

    render(<Input placeholder="Type here" />)
    const input = screen.getByPlaceholderText('Type here')

    await user.type(input, 'Hello World')
    expect(input).toHaveValue('Hello World')
  })

  it('forwards ref correctly', () => {
    const ref = vi.fn()

    render(<Input ref={ref} placeholder="Ref test" />)
    expect(ref).toHaveBeenCalled()
    expect(ref.mock.calls[0][0]).toBeInstanceOf(HTMLInputElement)
  })

  it('applies custom className', () => {
    render(<Input className="custom-input" placeholder="Custom" />)
    const input = screen.getByPlaceholderText('Custom')
    expect(input).toHaveClass('custom-input')
  })

  it('handles change events', async () => {
    const user = userEvent.setup()
    const handleChange = vi.fn()

    render(<Input placeholder="Change" onChange={handleChange} />)
    const input = screen.getByPlaceholderText('Change')

    await user.type(input, 'a')
    expect(handleChange).toHaveBeenCalled()
  })

  describe('additional states', () => {
    it('renders in readonly state', () => {
      render(<Input readOnly placeholder="Readonly" />)
      const input = screen.getByPlaceholderText('Readonly')
      expect(input).toHaveAttribute('readonly')
    })

    it('renders with required attribute', () => {
      render(<Input required placeholder="Required" />)
      const input = screen.getByPlaceholderText('Required')
      expect(input).toHaveAttribute('required')
    })

    it('renders with maxLength constraint', () => {
      render(<Input maxLength={10} placeholder="Max 10" />)
      const input = screen.getByPlaceholderText('Max 10')
      expect(input).toHaveAttribute('maxLength', '10')
    })

    it('renders with aria-invalid when invalid', () => {
      render(<Input aria-invalid="true" placeholder="Invalid" />)
      const input = screen.getByPlaceholderText('Invalid')
      expect(input).toHaveAttribute('aria-invalid', 'true')
    })

    it('renders with aria-describedby', () => {
      render(<Input aria-describedby="error-msg" placeholder="Described" />)
      const input = screen.getByPlaceholderText('Described')
      expect(input).toHaveAttribute('aria-describedby', 'error-msg')
    })
  })

  describe('keyboard events', () => {
    it('handles key down events', async () => {
      const user = userEvent.setup()
      const handleKeyDown = vi.fn()

      render(<Input placeholder="Key test" onKeyDown={handleKeyDown} />)
      const input = screen.getByPlaceholderText('Key test')
      input.focus()
      await user.keyboard('{Enter}')

      expect(handleKeyDown).toHaveBeenCalled()
    })

    it('does not accept input when disabled', async () => {
      const user = userEvent.setup()

      render(<Input disabled placeholder="Disabled" />)
      const input = screen.getByPlaceholderText('Disabled')

      await user.type(input, 'test')
      expect(input).not.toHaveValue('test')
    })
  })

  describe('focus behavior', () => {
    it('can be focused and blurred', async () => {
      const user = userEvent.setup()
      const handleFocus = vi.fn()
      const handleBlur = vi.fn()

      render(<Input placeholder="Focus" onFocus={handleFocus} onBlur={handleBlur} />)
      const input = screen.getByPlaceholderText('Focus')

      await user.click(input)
      expect(handleFocus).toHaveBeenCalledTimes(1)

      await user.tab()
      expect(handleBlur).toHaveBeenCalledTimes(1)
    })
  })
})
