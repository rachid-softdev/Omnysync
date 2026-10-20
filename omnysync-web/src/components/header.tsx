'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ThemeToggle } from '@/components/theme-toggle'
import { BrandLockup } from '@/components/signal-mark'
import { useTranslations } from '@/lib/i18n/useTranslations'

/** Routes that own their own chrome (app shell, auth split-screen). */
const APP_ROUTE_PREFIXES = ['/dashboard', '/admin', '/auth']

export function Header() {
  const { t } = useTranslations()
  const pathname = usePathname()

  if (APP_ROUTE_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return null
  }

  const isHome = pathname === '/'

  return (
    <header className="site-header fixed top-0 left-0 right-0 z-50 border-b border-border/70 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-[1200px] items-center gap-6 px-6">
        <Link href="/" className="group flex shrink-0 items-center" aria-label="Omnysync home">
          <BrandLockup className="transition-opacity duration-200 group-hover:opacity-80" />
        </Link>

        {isHome && (
          <nav className="hidden items-center gap-1 md:flex" aria-label="Main">
            <Link
              href="#features"
              aria-label={t('nav_features')}
              className="rounded-md px-2.5 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              {t('nav_features')}
            </Link>
            <Link
              href="#how-it-works"
              aria-label={t('nav_how_it_works')}
              className="rounded-md px-2.5 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              {t('nav_how_it_works')}
            </Link>
            <Link
              href="/pricing"
              className="rounded-md px-2.5 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              {t('nav_pricing')}
            </Link>
          </nav>
        )}

        <div className="ml-auto flex items-center gap-1.5">
          <Link
            href="/auth/signin"
            className="hidden rounded-md px-2.5 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground sm:inline-flex"
          >
            {t('UI_SIGN_IN')}
          </Link>
          <ThemeToggle />
          <Link
            href="/auth/signin"
            className="ml-1 inline-flex h-8 items-center justify-center whitespace-nowrap rounded-[3px] bg-primary px-3 text-[13px] font-medium text-primary-foreground shadow-xs transition-colors hover:bg-primary-hover sm:px-4"
          >
            {t('UI_GET_STARTED')}
          </Link>
        </div>
      </div>
    </header>
  )
}
