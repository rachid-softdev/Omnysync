'use client'

import { LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { logoutAction } from '@/lib/actions'

interface LogoutButtonProps {
  label: string
  /** Icon-only variant used in the sidebar footer. */
  iconOnly?: boolean
  className?: string
}

/**
 * Client-side logout trigger.
 *
 * Server Components cannot pass event handlers to Client Components, so the
 * sidebar (rendered on the server) delegates the interactive part to this
 * small client component.
 */
export function LogoutButton({ label, iconOnly = false, className }: LogoutButtonProps) {
  if (iconOnly) {
    return (
      <Button
        variant="ghost"
        size="icon-sm"
        className={className}
        onClick={() => logoutAction()}
        aria-label={label}
        title={label}
      >
        <LogOut className="size-4" />
      </Button>
    )
  }

  return (
    <Button variant="ghost" size="sm" className={className} onClick={() => logoutAction()}>
      <LogOut className="size-4" />
      {label}
    </Button>
  )
}
