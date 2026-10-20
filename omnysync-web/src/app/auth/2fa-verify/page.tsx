'use client'

import { useState, type ChangeEvent } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { AlertCircle, ArrowLeft, ArrowRight, Loader2, ShieldCheck } from 'lucide-react'

const steps = [
  { label: 'Identity verified', state: 'done' },
  { label: 'Second factor required', state: 'current' },
  { label: 'Dashboard access', state: 'pending' },
] as const

export default function TwoFactorVerifyPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const continueTo = searchParams.get('continue') || '/dashboard'

  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const res = await fetch('/api/auth/2fa/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      })

      const data = await res.json()

      if (res.ok && data.success) {
        router.push(continueTo)
      } else {
        setError(data.error || 'Invalid code')
      }
    } catch {
      setError('Connection error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-[1fr_minmax(0,520px)]">
      <div className="flex flex-col px-6 py-8 sm:px-10 lg:px-16">
        <div className="animate-enter-fade flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2" aria-label="Omnysync home">
            <span className="grid size-7 place-items-center rounded-[3px] bg-primary text-[13px] font-bold text-primary-foreground">
              O
            </span>
            <span className="text-[15px] font-semibold tracking-tight">Omnysync</span>
          </Link>
          <Link
            href="/auth/signin"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" />
            Sign in
          </Link>
        </div>

        <div className="flex flex-1 items-center py-10">
          <div className="mx-auto w-full max-w-sm">
            <div
              className="animate-enter-up flex items-start gap-3"
              style={{ animationDelay: '70ms' }}
            >
              <span className="grid size-9 shrink-0 place-items-center border border-primary/25 bg-primary/10 text-primary">
                <ShieldCheck className="size-4" />
              </span>
              <div>
                <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground">
                  Security checkpoint
                </p>
                <h1 className="mt-1 text-xl font-semibold tracking-[-0.02em]">
                  Two-Factor Authentication
                </h1>
              </div>
            </div>

            <p
              className="animate-enter-up mt-4 text-sm leading-relaxed text-muted-foreground"
              style={{ animationDelay: '120ms' }}
            >
              Enter the 6-digit code from your authenticator app to finish signing in.
            </p>

            <form
              onSubmit={handleVerify}
              className="animate-enter-up mt-7 space-y-4"
              style={{ animationDelay: '170ms' }}
            >
              <div className="space-y-2">
                <Label htmlFor="2fa-code">Authenticator code</Label>
                <Input
                  id="2fa-code"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="000000"
                  value={code}
                  onChange={(e: ChangeEvent<HTMLInputElement>) =>
                    setCode(e.target.value.replace(/\D/g, '').slice(0, 6))
                  }
                  className="h-12 text-center font-mono text-2xl tracking-[0.4em]"
                  maxLength={6}
                  required
                />
                <label htmlFor="2fa-code" className="sr-only">
                  6-digit code
                </label>
                <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground/70">
                  6 digits · refreshes every 30s
                </p>
              </div>

              {error && (
                <div
                  key={error}
                  className="animate-shake flex items-start gap-2.5 border border-destructive/20 bg-destructive-soft p-3 text-sm text-destructive"
                  role="alert"
                >
                  <AlertCircle className="mt-0.5 size-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <Button type="submit" className="h-10 w-full" disabled={loading || code.length !== 6}>
                {loading ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Verifying…
                  </>
                ) : (
                  <>
                    Verify
                    <ArrowRight className="size-4" />
                  </>
                )}
              </Button>
            </form>

            <div
              className="animate-enter-fade mt-6 border-t border-border pt-4"
              style={{ animationDelay: '220ms' }}
            >
              <p className="text-xs leading-relaxed text-muted-foreground">
                Open Google Authenticator, Authy, or any TOTP app. Lost access to your device?{' '}
                <Link href="/auth/signin" className="font-medium text-primary hover:underline">
                  Use a recovery method
                </Link>
                .
              </p>
            </div>
          </div>
        </div>

        <p className="animate-enter-fade font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground/50">
          Omnysync · secure session
        </p>
      </div>

      {/* Context panel — the login is a checkpoint, not a marketing page. */}
      <aside className="relative hidden overflow-hidden bg-[#06101b] lg:block">
        <div
          className="animate-drift absolute inset-0 opacity-70 will-change-transform"
          style={{
            background:
              'radial-gradient(110% 80% at 80% 0%, #0a3d8f 0%, transparent 58%), radial-gradient(80% 70% at 0% 100%, #063a7a 0%, transparent 55%)',
          }}
          aria-hidden="true"
        />
        <div
          className="animate-slide-in-right relative flex h-full flex-col justify-between gap-8 p-10 xl:p-12"
          style={{ animationDelay: '180ms' }}
        >
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/40">
              Access sequence
            </p>
            <h2 className="mt-4 max-w-sm text-[30px] font-semibold leading-[1.02] tracking-[-0.03em] text-white">
              One more check before your workspace opens.
            </h2>
            <p className="mt-3 max-w-sm text-sm leading-relaxed text-white/55">
              A second factor keeps scheduled runs, connected accounts and publishing keys behind
              your control.
            </p>
          </div>

          <ol className="space-y-0 border-y border-white/10">
            {steps.map((step, index) => {
              const isDone = step.state === 'done'
              const isCurrent = step.state === 'current'
              return (
                <li
                  key={step.label}
                  className={`flex items-center gap-4 border-b border-white/10 py-4 last:border-b-0 ${
                    isDone ? 'text-white/45' : isCurrent ? 'text-white' : 'text-white/30'
                  }`}
                >
                  <span
                    className={`grid size-6 shrink-0 place-items-center border font-mono text-[9px] ${
                      isDone
                        ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300'
                        : isCurrent
                          ? 'border-white/40 bg-white/10 text-white'
                          : 'border-white/15 text-white/35'
                    }`}
                  >
                    {isDone ? '✓' : String(index + 1).padStart(2, '0')}
                  </span>
                  <span className="flex-1 text-[13px] font-medium">{step.label}</span>
                  <span className="font-mono text-[9px] uppercase tracking-[0.12em]">
                    {isDone ? 'Verified' : isCurrent ? 'Waiting' : 'Locked'}
                  </span>
                </li>
              )
            })}
          </ol>

          <div className="flex items-center justify-between border-t border-white/10 pt-4 font-mono text-[9px] uppercase tracking-[0.14em] text-white/35">
            <span>2FA / TOTP</span>
            <span className="inline-flex items-center gap-1.5 text-emerald-300">
              <span className="size-1.5 rounded-full bg-emerald-400" />
              Secure channel
            </span>
          </div>
        </div>
      </aside>
    </div>
  )
}
