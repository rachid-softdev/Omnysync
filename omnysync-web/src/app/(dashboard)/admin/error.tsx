'use client'

import { useEffect } from 'react'
import { useTranslations } from '@/lib/i18n/useTranslations'

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const { t } = useTranslations()

  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
      <h2 className="text-lg font-semibold">{t('error.title')}</h2>
      <p className="text-sm text-muted-foreground">{t('error.description')}</p>
      <button
        onClick={reset}
        className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
      >
        {t('error.retry')}
      </button>
    </div>
  )
}
