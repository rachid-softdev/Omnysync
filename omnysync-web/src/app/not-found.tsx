import Link from 'next/link'
import { headers } from 'next/headers'
import { Home, LogIn } from 'lucide-react'
import { getLocaleFromHeaders, t } from '@/lib/i18n'
import type { Metadata } from 'next'

export async function generateMetadata(): Promise<Metadata> {
  const locale = getLocaleFromHeaders(await headers())

  return {
    title: t('NOT_FOUND_TITLE', locale),
    description: t('NOT_FOUND_DESC', locale),
    robots: { index: false, follow: false },
  }
}

export default async function NotFound() {
  const locale = getLocaleFromHeaders(await headers())
  const tr = (key: string) => t(key, locale)

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-6">
      <div className="text-center max-w-md">
        <h1 className="text-9xl font-bold text-primary">404</h1>
        <h2 className="text-2xl font-semibold mt-4 mb-2">{tr('NOT_FOUND_TITLE')}</h2>
        <p className="text-muted-foreground mb-8">{tr('NOT_FOUND_DESC')}</p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-[3px] bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <Home className="w-4 h-4 mr-2" />
            {tr('NOT_FOUND_HOME')}
          </Link>
          <Link
            href="/auth/signin"
            className="inline-flex items-center justify-center rounded-[3px] border border-input px-6 py-3 text-sm font-medium hover:bg-accent"
          >
            <LogIn className="w-4 h-4 mr-2" />
            {tr('NOT_FOUND_SIGNIN')}
          </Link>
        </div>
      </div>
    </div>
  )
}
