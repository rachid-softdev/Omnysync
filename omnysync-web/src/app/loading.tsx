'use client'

import { RefreshCw } from 'lucide-react'
import { useTranslations } from '@/lib/i18n/useTranslations'

export default function Loading() {
  const { t } = useTranslations()

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background">
      <div className="text-center">
        <RefreshCw
          className="w-8 h-8 animate-spin mx-auto mb-4 text-primary"
          aria-label={t('loading.default')}
        />
        <p className="text-muted-foreground">{t('loading.default')}</p>
      </div>
    </div>
  )
}
