'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { RefreshCw, Loader2 } from 'lucide-react'
import { toast } from '@/components/toast-provider'
import { useTranslations } from '@/lib/i18n/useTranslations'

interface SyncRunButtonProps {
  documentId: string
  label?: string
  variant?: 'default' | 'outline' | 'ghost' | 'secondary'
  size?: 'default' | 'sm' | 'lg' | 'icon'
  disabled?: boolean
  locale?: string
}

/**
 * Runs a document sync through the authenticated, quota-gated API route.
 * The old sync-detail page called performSync() directly from a server action,
 * which bypassed plan and quota checks.
 */
export function SyncRunButton({
  documentId,
  label,
  variant = 'outline',
  size = 'sm',
  disabled = false,
  locale,
}: SyncRunButtonProps) {
  const router = useRouter()
  const { t } = useTranslations(locale)
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
        throw new Error(data.error || data.message || t('SYNC_RUN_START_ERROR'))
      }

      if (data.success === false) {
        toast.error(data.error || t('SYNC_RUN_FAILED'))
      } else {
        toast.success(t('SYNC_RUN_COMPLETED'))
      }

      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('SYNC_RUN_START_ERROR'))
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
      {label ?? t('SYNC_RUN_DEFAULT')}
    </Button>
  )
}
