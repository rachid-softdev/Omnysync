'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { RefreshCw, Loader2 } from 'lucide-react'
import { toast } from '@/components/toast-provider'

interface SyncRunButtonProps {
  documentId: string
  label?: string
  variant?: 'default' | 'outline' | 'ghost' | 'secondary'
  size?: 'default' | 'sm' | 'lg' | 'icon'
  disabled?: boolean
}

/**
 * Runs a document sync through the authenticated, quota-gated API route.
 * The old sync-detail page called performSync() directly from a server action,
 * which bypassed plan and quota checks.
 */
export function SyncRunButton({
  documentId,
  label = 'Sync',
  variant = 'outline',
  size = 'sm',
  disabled = false,
}: SyncRunButtonProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const run = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/sync/${documentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'run' }),
      })

      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data.error || data.message || 'Sync could not be started')
      }

      if (data.success === false) {
        toast.error(data.error || 'Sync failed')
      } else {
        toast.success('Sync completed')
      }

      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Sync could not be started')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button variant={variant} size={size} onClick={run} disabled={disabled || loading}>
      {loading ? (
        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
      ) : (
        <RefreshCw className="size-4" aria-hidden="true" />
      )}
      {label}
    </Button>
  )
}
