'use client'

import { usePathname } from 'next/navigation'
import { useTranslations } from '@/lib/i18n/useTranslations'

/** Routes that already own their chrome and provide their own skip link. */
const APP_SHELL_PREFIXES = ['/dashboard', '/admin', '/dev']

export function PublicSkipLink() {
  const pathname = usePathname()
  const { t } = useTranslations()

  if (APP_SHELL_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return null
  }

  return (
    <a
      href="#main-content"
      className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-[2px] focus:bg-background focus:px-4 focus:py-2 focus:text-foreground focus:ring-2 focus:ring-ring"
    >
      {t('UI_SKIP_TO_CONTENT')}
    </a>
  )
}
