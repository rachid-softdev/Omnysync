'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ThemeToggle } from '@/components/theme-toggle'
import { useTranslations } from '@/lib/i18n/useTranslations'

export function Header() {
  const { t } = useTranslations()
  const pathname = usePathname()

  // Auth pages have their own layout
  if (pathname === '/auth/signin') return null

  const isHome = pathname === '/'

  return (
    <header className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-3 bg-background/80 backdrop-blur-sm border-b border-border">
      <Link href="/" className="text-xl font-bold">
        Omnysync
      </Link>
      {isHome && (
        <div className="hidden md:flex items-center gap-8">
          <Link
            href="#features"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            {t('nav_features')}
          </Link>
          <Link
            href="#how-it-works"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            {t('nav_how_it_works')}
          </Link>
        </div>
      )}
      <div className="flex items-center gap-4">
        <Link
          href="/auth/signin"
          className="text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          {t('UI_SIGN_IN')}
        </Link>
        <ThemeToggle />
        <Link
          href="/auth/signin"
          className="inline-flex items-center justify-center rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          {t('UI_GET_STARTED')}
        </Link>
      </div>
    </header>
  )
}
