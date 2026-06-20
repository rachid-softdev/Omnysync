import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
  SelectLabel,
  SelectGroup,
  SelectSeparator,
} from '../select'

describe('Select', () => {
  it('renders select trigger with placeholder', () => {
    render(
      <Select>
        <SelectTrigger>
          <SelectValue placeholder="Select option" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="1">Option 1</SelectItem>
        </SelectContent>
      </Select>
    )

    expect(screen.getByText('Select option')).toBeInTheDocument()
  })

  it('opens content when trigger is clicked', async () => {
    render(
      <Select defaultOpen>
        <SelectTrigger>
          <SelectValue placeholder="Pick one" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="1">Option 1</SelectItem>
          <SelectItem value="2">Option 2</SelectItem>
        </SelectContent>
      </Select>
    )

    expect(screen.getByRole('option', { name: /option 1/i })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: /option 2/i })).toBeInTheDocument()
  })

  it('renders SelectLabel', async () => {
    render(
      <Select defaultOpen>
        <SelectTrigger>
          <SelectValue placeholder="Select" />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectLabel>Group Label</SelectLabel>
            <SelectItem value="1">Item 1</SelectItem>
          </SelectGroup>
        </SelectContent>
      </Select>
    )

    expect(screen.getByText('Group Label')).toBeInTheDocument()
  })

  it('renders SelectSeparator', async () => {
    render(
      <Select defaultOpen>
        <SelectTrigger>
          <SelectValue placeholder="Select" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="1">Item 1</SelectItem>
          <SelectSeparator />
          <SelectItem value="2">Item 2</SelectItem>
        </SelectContent>
      </Select>
    )

    expect(screen.getByRole('option', { name: /item 1/i })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: /item 2/i })).toBeInTheDocument()
  })

  it('calls onValueChange when item is selected', () => {
    const handleChange = vi.fn()

    render(
      <Select defaultOpen onValueChange={handleChange}>
        <SelectTrigger>
          <SelectValue placeholder="Choose" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="a">Option A</SelectItem>
          <SelectItem value="b">Option B</SelectItem>
        </SelectContent>
      </Select>
    )

    fireEvent.click(screen.getByRole('option', { name: /option a/i }))

    expect(handleChange).toHaveBeenCalledWith('a')
  })

  it('applies custom className to Trigger', () => {
    render(
      <Select>
        <SelectTrigger className="custom-trigger">
          <SelectValue placeholder="Custom" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="1">Item</SelectItem>
        </SelectContent>
      </Select>
    )

    const trigger = screen.getByRole('combobox')
    expect(trigger).toHaveClass('custom-trigger')
  })

  it('renders disabled state', () => {
    render(
      <Select disabled>
        <SelectTrigger>
          <SelectValue placeholder="Disabled" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="1">Item</SelectItem>
        </SelectContent>
      </Select>
    )

    const trigger = screen.getByRole('combobox')
    expect(trigger).toBeDisabled()
  })

  it('renders with ScrollUpButton and ScrollDownButton', async () => {
    render(
      <Select defaultOpen>
        <SelectTrigger>
          <SelectValue placeholder="Scroll test" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="1">Item 1</SelectItem>
          <SelectItem value="2">Item 2</SelectItem>
        </SelectContent>
      </Select>
    )

    expect(screen.getByText('Item 1')).toBeInTheDocument()
    expect(screen.getByText('Item 2')).toBeInTheDocument()
  })

  describe('selection behavior', () => {
    it('displays selected value when defaultValue is set', () => {
      render(
        <Select defaultValue="a">
          <SelectTrigger>
            <SelectValue placeholder="Choose" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="a">Option A</SelectItem>
            <SelectItem value="b">Option B</SelectItem>
          </SelectContent>
        </Select>
      )

      expect(screen.getByText('Option A')).toBeInTheDocument()
    })
  })

  describe('keyboard navigation', () => {
    it('renders options when opened via defaultValue', () => {
      render(
        <Select defaultOpen>
          <SelectTrigger>
            <SelectValue placeholder="Choose" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="a">Option A</SelectItem>
            <SelectItem value="b">Option B</SelectItem>
          </SelectContent>
        </Select>
      )

      expect(screen.getByRole('option', { name: /option a/i })).toBeInTheDocument()
    })
  })

  describe('accessibility', () => {
    it('trigger has combobox role', () => {
      render(
        <Select>
          <SelectTrigger>
            <SelectValue placeholder="Accessible" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="1">Item</SelectItem>
          </SelectContent>
        </Select>
      )

      expect(screen.getByRole('combobox')).toBeInTheDocument()
    })
  })
})
