'use client'

import { useState } from 'react'
import Link from 'next/link'
import { signIn } from 'next-auth/react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { RouteMap } from '@/components/route-map'
import { useTranslations } from '@/lib/i18n/useTranslations'
import { AlertCircle, ArrowRight, Check, Loader2 } from 'lucide-react'

type Status = 'idle' | 'sending' | 'sent'

export default function SignInPage() {
  const { t } = useTranslations()
  const [email, setEmail] = useState('')
  const [fieldError, setFieldError] = useState('')
  const [error, setError] = useState('')
  const [status, setStatus] = useState<Status>('idle')

  const validateEmail = (value: string): string | undefined => {
    if (!value.trim()) return t('auth_email_required')
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return t('auth_email_invalid')
    return undefined
  }

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setEmail(value)
    if (fieldError) setFieldError('')
    if (error) setError('')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const emailError = validateEmail(email)
    if (emailError) {
      setFieldError(emailError)
      return
    }

    setFieldError('')
    setError('')
    setStatus('sending')

    try {
      const result = await signIn('resend', {
        email: email.trim(),
        redirect: false,
        callbackUrl: '/dashboard',
      })

      if (result?.error) {
        setError(t('auth_magic_link_failed'))
        setStatus('idle')
      } else {
        setStatus('sent')
      }
    } catch {
      setError(t('auth_connect_failed'))
      setStatus('idle')
    }
  }

  const signInWithGoogle = async () => {
    setError('')
    try {
      await signIn('google', { callbackUrl: '/dashboard' })
    } catch {
      setError(t('auth_magic_link_google_failed'))
    }
  }

  const resetEmail = () => {
    setStatus('idle')
    setEmail('')
    setFieldError('')
    setError('')
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-[1fr_minmax(0,520px)]">
      {/* Form panel */}
      <main id="main-content" className="flex flex-col px-6 py-8 sm:px-10 lg:px-16">
        <div className="animate-enter-fade flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2" aria-label={t('auth_home')}>
            <span className="grid size-7 place-items-center rounded-md bg-primary text-[13px] font-bold text-primary-foreground">
              O
            </span>
            <span className="text-[15px] font-semibold tracking-tight">Omnysync</span>
          </Link>
          <Link
            href="/pricing"
            className="text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            {t('nav_pricing')}
          </Link>
        </div>

        <div className="flex flex-1 items-center py-10">
          <div className="mx-auto w-full max-w-sm">
            {status === 'sent' ? (
              <div className="animate-enter-up">
                <div className="grid size-9 place-items-center rounded-[2px] border border-success/30 bg-success-soft text-success">
                  <Check className="size-4" />
                </div>
                <h1 className="mt-6 text-2xl font-semibold tracking-tight">
                  {t('auth_magic_link_sent_title')}
                </h1>
                <p className="mt-1.5 text-sm text-muted-foreground">
                  {t('auth_magic_link_sent_body')}
                </p>
                <p className="mt-2 break-all font-mono text-sm text-foreground">{email}</p>
                <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
                  {t('auth_magic_link_expires')}
                </p>
                <Button
                  type="button"
                  variant="outline"
                  onClick={resetEmail}
                  className="mt-6 h-10 w-full"
                >
                  {t('auth_use_another_email')}
                </Button>
              </div>
            ) : (
              <>
                <h1
                  className="animate-enter-up text-2xl font-semibold tracking-tight"
                  style={{ animationDelay: '70ms' }}
                >
                  {t('auth_welcome')}
                </h1>
                <p
                  className="animate-enter-up mt-1.5 text-sm leading-relaxed text-muted-foreground"
                  style={{ animationDelay: '120ms' }}
                >
                  {t('auth_magic_sub')}
                </p>

                <Button
                  type="button"
                  variant="outline"
                  onClick={signInWithGoogle}
                  className="animate-enter-up mt-7 h-10 w-full gap-2.5"
                  style={{ animationDelay: '170ms' }}
                >
                  <svg className="size-4" viewBox="0 0 24 24" aria-hidden="true">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    />
                  </svg>
                  {t('auth_continue_google')}
                </Button>

                <div
                  className="animate-enter-fade relative my-6"
                  style={{ animationDelay: '220ms' }}
                >
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-border" />
                  </div>
                  <div className="relative flex justify-center">
                    <span className="bg-background px-3 text-xs text-muted-foreground">
                      {t('auth_or_email')}
                    </span>
                  </div>
                </div>

                <form
                  onSubmit={handleSubmit}
                  className="animate-enter-up space-y-4"
                  style={{ animationDelay: '260ms' }}
                  noValidate
                >
                  <div className="space-y-1.5">
                    <Label htmlFor="email">{t('UI_EMAIL')}</Label>
                    <Input
                      id="email"
                      type="email"
                      autoComplete="email"
                      placeholder={t('auth_email_placeholder')}
                      value={email}
                      onChange={handleEmailChange}
                      required
                      aria-invalid={!!fieldError}
                      aria-describedby={fieldError ? 'email-error' : undefined}
                      className="h-10"
                    />
                    {fieldError && (
                      <p id="email-error" className="text-xs text-destructive" role="alert">
                        {fieldError}
                      </p>
                    )}
                  </div>

                  {error && (
                    <div
                      key={error}
                      className="animate-shake flex items-start gap-2.5 rounded-[2px] border border-destructive/20 bg-destructive-soft p-3 text-sm text-destructive"
                      role="alert"
                    >
                      <AlertCircle className="mt-0.5 size-4 shrink-0" />
                      <span>{error}</span>
                    </div>
                  )}

                  <Button type="submit" disabled={status === 'sending'} className="h-10 w-full">
                    {status === 'sending' ? (
                      <>
                        <Loader2 className="size-4 animate-spin" />
                        {t('auth_sending_magic_link')}
                      </>
                    ) : (
                      <>
                        {t('auth_send_magic_link')}
                        <ArrowRight className="size-4" />
                      </>
                    )}
                  </Button>
                </form>

                <p
                  className="animate-enter-fade mt-6 text-center text-xs leading-relaxed text-muted-foreground"
                  style={{ animationDelay: '320ms' }}
                >
                  {t('auth_magic_link_no_account')}
                </p>
              </>
            )}

            <p
              className="animate-enter-fade mt-8 text-center text-xs leading-relaxed text-muted-foreground"
              style={{ animationDelay: '370ms' }}
            >
              {t('auth_terms_prefix')}
              <Link href="#" className="underline underline-offset-2">
                {t('auth_terms')}
              </Link>{' '}
              {t('auth_and')}{' '}
              <Link href="#" className="underline underline-offset-2">
                {t('auth_privacy')}
              </Link>
              .
            </p>
          </div>
        </div>
      </main>

      {/* Product panel — the routing console, not a stock testimonial. */}
      <div
        className="animate-enter-fade relative hidden overflow-hidden bg-[#06101b] lg:block"
        style={{ animationDelay: '120ms' }}
      >
        <div
          className="animate-drift absolute inset-0 opacity-70 will-change-transform"
          style={{
            background:
              'radial-gradient(120% 80% at 85% 0%, #0a3d8f 0%, transparent 60%), radial-gradient(90% 70% at 0% 100%, #063a7a 0%, transparent 55%)',
          }}
          aria-hidden="true"
        />
        <div
          className="animate-slide-in-right relative flex h-full flex-col justify-between gap-8 p-10 xl:p-12"
          style={{ animationDelay: '180ms' }}
        >
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/40">
              {t('auth_console_eyebrow')}
            </p>
            <h2 className="mt-4 text-[30px] font-semibold leading-[1.02] tracking-[-0.03em] text-white">
              {t('auth_console_title_1')}
              <br />
              {t('auth_console_title_2')}
            </h2>
            <p className="mt-3 max-w-sm text-sm leading-relaxed text-white/55">
              {t('auth_console_body')}
            </p>
          </div>

          <div className="animate-enter-scale" style={{ animationDelay: '320ms' }}>
            <RouteMap tone="dark" />
          </div>

          <div className="flex items-center justify-between border-t border-white/10 pt-4 font-mono text-[9px] uppercase tracking-[0.14em] text-white/35">
            <span>{t('auth_run_id')}</span>
            <span className="inline-flex items-center gap-1.5 text-emerald-300">
              <span className="size-1.5 rounded-full bg-emerald-400" />
              {t('auth_all_healthy')}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
