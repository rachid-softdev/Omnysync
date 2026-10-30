'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Loader2, Trash2 } from 'lucide-react'
import { toast } from '@/components/toast-provider'
import { useTranslations } from '@/lib/i18n/useTranslations'

export function DeleteDocumentButton({
  documentId,
  locale,
}: {
  documentId: string
  locale?: string
}) {
  const router = useRouter()
  const { t } = useTranslations(locale)
  const [loading, setLoading] = useState(false)

  const remove = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/sync/${documentId}`, { method: 'DELETE' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data.error || t('DOC_DELETE_ERROR'))
      }

      toast.success(t('DOC_DELETE_SUCCESS'))
      router.push('/dashboard/documents')
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('DOC_DELETE_ERROR'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="sm" className="text-destructive hover:bg-destructive-soft">
          <Trash2 className="size-4" aria-hidden="true" />
          {t('DOC_DELETE_ACTION')}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('DOC_DELETE_TITLE')}</AlertDialogTitle>
          <AlertDialogDescription>{t('DOC_DELETE_DESC')}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>{t('DOC_DELETE_CANCEL')}</AlertDialogCancel>
          <AlertDialogAction
            onClick={(event) => {
              event.preventDefault()
              void remove()
            }}
            disabled={loading}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {loading && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
            {t('DOC_DELETE_ACTION')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
