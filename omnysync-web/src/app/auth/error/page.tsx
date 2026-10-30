import Link from 'next/link'
import { AlertCircle } from 'lucide-react'
import { getT } from '@/lib/i18n'
import { pageMetadata } from '@/lib/metadata'

export function generateMetadata() {
  return pageMetadata({
    titleKey: 'META_AUTH_ERROR_TITLE',
    descriptionKey: 'META_AUTH_ERROR_DESC',
    path: '/auth/error',
    index: false,
  })
}

interface AuthErrorPageProps {
  searchParams: Promise<{ error?: string | string[] }>
}

export default async function AuthErrorPage({ searchParams }: AuthErrorPageProps) {
  const t = await getT()
  const params = await searchParams
  const code = Array.isArray(params.error) ? params.error[0] : params.error
  const body = code === 'OAuthAccountNotLinked' ? t('auth_oauth_linked') : t('auth_error_body')

  return (
    <main
      id="main-content"
      className="grid min-h-screen place-items-center bg-background px-6 py-16"
    >
      <div className="w-full max-w-md border border-border bg-card p-8">
        <div className="grid size-9 place-items-center rounded-[2px] border border-destructive/20 bg-destructive-soft text-destructive">
          <AlertCircle className="size-4" />
        </div>
        <p className="mt-5 font-mono text-[9px] uppercase tracking-[0.16em] text-primary">
          {t('auth_error_eyebrow')}
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">{t('auth_error_title')}</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{body}</p>
        <Link
          href="/auth/signin"
          className="mt-6 inline-flex h-10 w-full items-center justify-center rounded-[2px] bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
        >
          {t('auth_error_back')}
        </Link>
      </div>
    </main>
  )
}
