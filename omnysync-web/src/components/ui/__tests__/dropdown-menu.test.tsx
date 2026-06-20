import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuGroup,
  DropdownMenuGroupLabel,
  DropdownMenuShortcut,
} from '../dropdown-menu'

describe('DropdownMenu', () => {
  it('renders trigger button', () => {
    render(
      <DropdownMenu>
        <DropdownMenuTrigger>Menu</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem>Item 1</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    )

    expect(screen.getByRole('button', { name: /menu/i })).toBeInTheDocument()
  })

  it('opens menu content on trigger click', async () => {
    const user = userEvent.setup()

    render(
      <DropdownMenu>
        <DropdownMenuTrigger>Open</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem>Profile</DropdownMenuItem>
          <DropdownMenuItem>Settings</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    )

    await user.click(screen.getByRole('button', { name: /open/i }))

    expect(screen.getByRole('menuitem', { name: /profile/i })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: /settings/i })).toBeInTheDocument()
  })

  it('renders DropdownMenuLabel', async () => {
    const user = userEvent.setup()

    render(
      <DropdownMenu>
        <DropdownMenuTrigger>Trigger</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuLabel>Account</DropdownMenuLabel>
          <DropdownMenuItem>Logout</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    )

    await user.click(screen.getByRole('button', { name: /trigger/i }))

    // Labels are not given a specific role, check by text
    expect(screen.getByText(/account/i)).toBeInTheDocument()
  })

  it('renders DropdownMenuSeparator', async () => {
    const user = userEvent.setup()

    render(
      <DropdownMenu>
        <DropdownMenuTrigger>Trigger</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem>Item</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem>Separated</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    )

    await user.click(screen.getByRole('button', { name: /trigger/i }))

    // The separator should render (it's a div with h-px)
    expect(screen.getByRole('menuitem', { name: /item/i })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: /separated/i })).toBeInTheDocument()
  })

  it('renders DropdownMenuCheckboxItem', async () => {
    const user = userEvent.setup()
    const handleChange = vi.fn()

    render(
      <DropdownMenu>
        <DropdownMenuTrigger>Trigger</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuCheckboxItem checked={false} onCheckedChange={handleChange}>
            Check me
          </DropdownMenuCheckboxItem>
        </DropdownMenuContent>
      </DropdownMenu>
    )

    await user.click(screen.getByRole('button', { name: /trigger/i }))

    const item = screen.getByRole('menuitemcheckbox', { name: /check me/i })
    expect(item).toBeInTheDocument()
    expect(item).not.toBeChecked()
  })

  it('renders DropdownMenuRadioGroup and RadioItem', async () => {
    const user = userEvent.setup()

    render(
      <DropdownMenu>
        <DropdownMenuTrigger>Trigger</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuRadioGroup value="option1">
            <DropdownMenuRadioItem value="option1">Option 1</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="option2">Option 2</DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    )

    await user.click(screen.getByRole('button', { name: /trigger/i }))

    expect(screen.getByRole('menuitemradio', { name: /option 1/i })).toBeInTheDocument()
    expect(screen.getByRole('menuitemradio', { name: /option 2/i })).toBeInTheDocument()
  })

  it('renders DropdownMenuGroup with GroupLabel', async () => {
    const user = userEvent.setup()

    render(
      <DropdownMenu>
        <DropdownMenuTrigger>Trigger</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuGroup>
            <DropdownMenuGroupLabel>Group Label</DropdownMenuGroupLabel>
            <DropdownMenuItem>Group Item</DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    )

    await user.click(screen.getByRole('button', { name: /trigger/i }))

    expect(screen.getByText(/group label/i)).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: /group item/i })).toBeInTheDocument()
  })

  it('renders DropdownMenuShortcut', async () => {
    const user = userEvent.setup()

    render(
      <DropdownMenu>
        <DropdownMenuTrigger>Trigger</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem>
            Copy
            <DropdownMenuShortcut>⌘C</DropdownMenuShortcut>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    )

    await user.click(screen.getByRole('button', { name: /trigger/i }))

    expect(screen.getByText('⌘C')).toBeInTheDocument()
    expect(screen.getByText('⌘C')).toHaveClass('ml-auto')
    expect(screen.getByText('⌘C')).toHaveClass('text-xs')
  })

  it('handles inset prop on items', async () => {
    const user = userEvent.setup()

    render(
      <DropdownMenu>
        <DropdownMenuTrigger>Trigger</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem inset>Inset Item</DropdownMenuItem>
          <DropdownMenuItem>Normal Item</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    )

    await user.click(screen.getByRole('button', { name: /trigger/i }))

    const insetItem = screen.getByRole('menuitem', { name: /inset item/i })
    expect(insetItem).toHaveClass('pl-8')
  })
})
