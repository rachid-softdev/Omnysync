import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect } from 'vitest'
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
} from '../alert-dialog'

describe('AlertDialog', () => {
  it('renders trigger button', () => {
    render(
      <AlertDialog>
        <AlertDialogTrigger>Open dialog</AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogTitle>Title</AlertDialogTitle>
        </AlertDialogContent>
      </AlertDialog>
    )

    expect(screen.getByRole('button', { name: /open dialog/i })).toBeInTheDocument()
  })

  it('shows content when trigger is clicked', async () => {
    const user = userEvent.setup()

    render(
      <AlertDialog>
        <AlertDialogTrigger>Open</AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogTitle>Confirm action</AlertDialogTitle>
          <AlertDialogDescription>Are you sure you want to proceed?</AlertDialogDescription>
          <AlertDialogAction>Continue</AlertDialogAction>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
        </AlertDialogContent>
      </AlertDialog>
    )

    await user.click(screen.getByRole('button', { name: /open/i }))

    expect(screen.getByRole('alertdialog', { name: /confirm action/i })).toBeInTheDocument()
    expect(screen.getByText(/are you sure you want to proceed/i)).toBeInTheDocument()
  })

  it('renders alert dialog with header and footer', async () => {
    const user = userEvent.setup()

    render(
      <AlertDialog>
        <AlertDialogTrigger>Trigger</AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Alert Title</AlertDialogTitle>
            <AlertDialogDescription>Alert description text</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction>OK</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    )

    await user.click(screen.getByRole('button', { name: /trigger/i }))

    expect(screen.getByText(/alert title/i)).toBeInTheDocument()
    expect(screen.getByText(/alert description text/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /ok/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument()
  })

  it('closes dialog when cancel is clicked', async () => {
    const user = userEvent.setup()

    render(
      <AlertDialog>
        <AlertDialogTrigger>Open</AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogTitle>Title</AlertDialogTitle>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
        </AlertDialogContent>
      </AlertDialog>
    )

    await user.click(screen.getByRole('button', { name: /open/i }))
    expect(screen.getByRole('alertdialog', { name: /title/i })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /cancel/i }))
    expect(screen.queryByRole('alertdialog', { name: /title/i })).not.toBeInTheDocument()
  })

  it('has proper ARIA attributes on trigger', () => {
    render(
      <AlertDialog>
        <AlertDialogTrigger>Open me</AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogTitle>Title</AlertDialogTitle>
        </AlertDialogContent>
      </AlertDialog>
    )

    const trigger = screen.getByRole('button', { name: /open me/i })
    expect(trigger).toHaveAttribute('aria-haspopup', 'dialog')
  })

  it('renders AlertDialogAction with button styling', async () => {
    const user = userEvent.setup()

    render(
      <AlertDialog>
        <AlertDialogTrigger>Trigger</AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogTitle>Title</AlertDialogTitle>
          <AlertDialogAction>Confirm</AlertDialogAction>
        </AlertDialogContent>
      </AlertDialog>
    )

    await user.click(screen.getByRole('button', { name: /trigger/i }))

    const confirmBtn = screen.getByRole('button', { name: /confirm/i })
    expect(confirmBtn).toBeInTheDocument()
    expect(confirmBtn).toHaveClass('bg-primary')
  })

  it('renders AlertDialogCancel with outline styling', async () => {
    const user = userEvent.setup()

    render(
      <AlertDialog>
        <AlertDialogTrigger>Trigger</AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogTitle>Title</AlertDialogTitle>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
        </AlertDialogContent>
      </AlertDialog>
    )

    await user.click(screen.getByRole('button', { name: /trigger/i }))

    const cancelBtn = screen.getByRole('button', { name: /cancel/i })
    expect(cancelBtn).toBeInTheDocument()
    expect(cancelBtn).toHaveClass('border-border')
  })

  it('accepts custom class names', async () => {
    const user = userEvent.setup()

    render(
      <AlertDialog>
        <AlertDialogTrigger>Trigger</AlertDialogTrigger>
        <AlertDialogContent className="custom-content">
          <AlertDialogTitle className="custom-title">Custom Title</AlertDialogTitle>
          <AlertDialogDescription className="custom-desc">
            Custom description
          </AlertDialogDescription>
        </AlertDialogContent>
      </AlertDialog>
    )

    await user.click(screen.getByRole('button', { name: /trigger/i }))

    expect(screen.getByText(/custom title/i)).toHaveClass('custom-title')
    expect(screen.getByText(/custom description/i)).toHaveClass('custom-desc')
  })
})
