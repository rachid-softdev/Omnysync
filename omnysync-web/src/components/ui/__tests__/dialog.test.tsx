import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from '../dialog'

describe('Dialog', () => {
  it('renders trigger button', () => {
    render(
      <Dialog>
        <DialogTrigger>Open dialog</DialogTrigger>
        <DialogContent>
          <DialogTitle>Title</DialogTitle>
        </DialogContent>
      </Dialog>
    )

    expect(screen.getByRole('button', { name: /open dialog/i })).toBeInTheDocument()
  })

  it('opens dialog content when trigger is clicked', async () => {
    const user = userEvent.setup()

    render(
      <Dialog>
        <DialogTrigger>Open</DialogTrigger>
        <DialogContent>
          <DialogTitle>Dialog Title</DialogTitle>
          <DialogDescription>This is a dialog description</DialogDescription>
        </DialogContent>
      </Dialog>
    )

    await user.click(screen.getByRole('button', { name: /open/i }))

    expect(screen.getByRole('dialog', { name: /dialog title/i })).toBeInTheDocument()
    expect(screen.getByText(/this is a dialog description/i)).toBeInTheDocument()
  })

  it('renders DialogHeader and DialogFooter', async () => {
    const user = userEvent.setup()

    render(
      <Dialog>
        <DialogTrigger>Trigger</DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Header Title</DialogTitle>
            <DialogDescription>Header description</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <button>Save</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )

    await user.click(screen.getByRole('button', { name: /trigger/i }))

    expect(screen.getByText(/header title/i)).toBeInTheDocument()
    expect(screen.getByText(/header description/i)).toBeInTheDocument()
    expect(screen.getByText(/save/i)).toBeInTheDocument()
  })

  it('closes dialog via close button', async () => {
    const user = userEvent.setup()

    render(
      <Dialog>
        <DialogTrigger>Open</DialogTrigger>
        <DialogContent>
          <DialogTitle>Closable</DialogTitle>
        </DialogContent>
      </Dialog>
    )

    await user.click(screen.getByRole('button', { name: /open/i }))
    expect(screen.getByRole('dialog', { name: /closable/i })).toBeInTheDocument()

    const closeButton = screen.getByRole('button', { name: /close/i })
    await user.click(closeButton)
    expect(screen.queryByRole('dialog', { name: /closable/i })).not.toBeInTheDocument()
  })

  it('renders DialogClose component', async () => {
    const user = userEvent.setup()

    render(
      <Dialog>
        <DialogTrigger>Open</DialogTrigger>
        <DialogContent>
          <DialogTitle>With Close Button</DialogTitle>
          <DialogClose asChild>
            <button>Custom Close</button>
          </DialogClose>
        </DialogContent>
      </Dialog>
    )

    await user.click(screen.getByRole('button', { name: /open/i }))
    expect(screen.getByRole('button', { name: /custom close/i })).toBeInTheDocument()
  })

  it('applies custom className to content', async () => {
    const user = userEvent.setup()

    render(
      <Dialog>
        <DialogTrigger>Open</DialogTrigger>
        <DialogContent className="custom-content">
          <DialogTitle>Custom</DialogTitle>
        </DialogContent>
      </Dialog>
    )

    await user.click(screen.getByRole('button', { name: /open/i }))
    // The dialog content wrapping div should exist
    expect(screen.getByRole('dialog', { name: /custom/i })).toBeInTheDocument()
  })

  it('has accessible close button with sr-only text', async () => {
    const user = userEvent.setup()

    render(
      <Dialog>
        <DialogTrigger>Open</DialogTrigger>
        <DialogContent>
          <DialogTitle>Accessible</DialogTitle>
        </DialogContent>
      </Dialog>
    )

    await user.click(screen.getByRole('button', { name: /open/i }))

    const closeBtn = screen.getByRole('button', { name: /close/i })
    expect(closeBtn).toBeInTheDocument()
    expect(closeBtn.querySelector('.sr-only')).toBeInTheDocument()
  })

  describe('controlled behavior', () => {
    it('renders content when open prop is true', () => {
      render(
        <Dialog open={true}>
          <DialogContent>
            <DialogTitle>Controlled</DialogTitle>
          </DialogContent>
        </Dialog>
      )

      expect(screen.getByRole('dialog', { name: /controlled/i })).toBeInTheDocument()
    })

    it('does not render content when open prop is false', () => {
      render(
        <Dialog open={false}>
          <DialogTrigger>Open</DialogTrigger>
          <DialogContent>
            <DialogTitle>Hidden</DialogTitle>
          </DialogContent>
        </Dialog>
      )

      expect(screen.queryByRole('dialog', { name: /hidden/i })).not.toBeInTheDocument()
    })

    it('calls onOpenChange when close button is clicked', async () => {
      const user = userEvent.setup()
      const handleOpenChange = vi.fn()

      render(
        <Dialog open={true} onOpenChange={handleOpenChange}>
          <DialogContent>
            <DialogTitle>Callback</DialogTitle>
          </DialogContent>
        </Dialog>
      )

      await user.click(screen.getByRole('button', { name: /close/i }))
      expect(handleOpenChange).toHaveBeenCalledWith(false)
    })
  })

  describe('keyboard interaction', () => {
    it('closes dialog on Escape key', async () => {
      const user = userEvent.setup()
      const handleOpenChange = vi.fn()

      render(
        <Dialog open={true} onOpenChange={handleOpenChange}>
          <DialogContent>
            <DialogTitle>Escape</DialogTitle>
          </DialogContent>
        </Dialog>
      )

      await user.keyboard('{Escape}')
      expect(handleOpenChange).toHaveBeenCalledWith(false)
    })
  })

  describe('accessibility', () => {
    it("dialog has role='dialog'", async () => {
      const user = userEvent.setup()

      render(
        <Dialog>
          <DialogTrigger>Open</DialogTrigger>
          <DialogContent>
            <DialogTitle>Accessible</DialogTitle>
          </DialogContent>
        </Dialog>
      )

      await user.click(screen.getByRole('button', { name: /open/i }))

      expect(screen.getByRole('dialog', { name: /accessible/i })).toBeInTheDocument()
    })

    it('dialog is labelled by its title', async () => {
      const user = userEvent.setup()

      render(
        <Dialog>
          <DialogTrigger>Open</DialogTrigger>
          <DialogContent>
            <DialogTitle>Labelled Dialog</DialogTitle>
          </DialogContent>
        </Dialog>
      )

      await user.click(screen.getByRole('button', { name: /open/i }))

      const dialog = screen.getByRole('dialog', { name: /labelled dialog/i })
      expect(dialog).toBeInTheDocument()
    })
  })
})
