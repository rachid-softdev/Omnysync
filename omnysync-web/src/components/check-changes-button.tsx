'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Loader2, Sparkles } from 'lucide-react'
import { toast } from '@/components/toast-provider'
import { useTranslations } from '@/lib/i18n/useTranslations'

interface CheckChangesButtonProps {
  documentId: string
  locale?: string
}

/**
 * Queues AI-powered change detection for a published document.
 *
 * The endpoint is gated by the `aiFeatures` entitlement, so this control is only
 * rendered for plans that include AI. The server remains the source of truth if
 * the plan changes while the page is open.
 */
export function CheckChangesButton({ documentId, locale }: CheckChangesButtonProps) {
  const router = useRouter()
  const { t } = useTranslations(locale)
  const [loading, setLoading] = useState(false)

  const check = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/sync/${documentId}/check`, { method: 'POST' })
      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        throw new Error(data.error || data.message || t('DOC_CHECK_CHANGES_ERROR'))
      }

      toast.success(data.message || t('DOC_CHECK_CHANGES_QUEUED'))
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('DOC_CHECK_CHANGES_ERROR'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button variant="outline" size="sm" onClick={check} disabled={loading}>
      {loading ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
      {t('DOC_CHECK_CHANGES')}
    </Button>
  )
}
