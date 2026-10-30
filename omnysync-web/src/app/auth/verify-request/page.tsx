import Link from 'next/link'
import { MailCheck } from 'lucide-react'
import { getT } from '@/lib/i18n'
import { pageMetadata } from '@/lib/metadata'

export function generateMetadata() {
  return pageMetadata({
    titleKey: 'META_VERIFY_TITLE',
    descriptionKey: 'META_VERIFY_DESC',
    path: '/auth/verify-request',
    index: false,
  })
}

export default async function VerifyRequestPage() {
  const t = await getT()

  return (
    <main
      id="main-content"
      className="grid min-h-screen place-items-center bg-background px-6 py-16"
    >
      <div className="w-full max-w-md border border-border bg-card p-8">
        <div className="grid size-9 place-items-center rounded-[2px] border border-success/30 bg-success-soft text-success">
          <MailCheck className="size-4" />
        </div>
        <p className="mt-5 font-mono text-[9px] uppercase tracking-[0.16em] text-primary">
          {t('auth_verify_eyebrow')}
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">
          {t('auth_magic_link_sent_title')}
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          {t('auth_magic_link_expires')}
        </p>
        <Link
          href="/auth/signin"
          className="mt-6 inline-flex h-10 w-full items-center justify-center rounded-[2px] bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
        >
          {t('auth_use_another_email')}
        </Link>
      </div>
    </main>
  )
}
