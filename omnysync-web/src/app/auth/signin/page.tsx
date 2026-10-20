'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { signIn } from 'next-auth/react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { RouteMap } from '@/components/route-map'
import { AlertCircle, ArrowRight, Loader2 } from 'lucide-react'

export default function SignInPage() {
  const router = useRouter()
  const [isLogin, setIsLogin] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState<{
    email?: string
    password?: string
    name?: string
  }>({})
  const [loading, setLoading] = useState(false)

  const validateEmail = (value: string): string | undefined => {
    if (!value.trim()) return 'Email is required'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return 'Enter a valid email address'
    return undefined
  }

  const validatePassword = (value: string): string | undefined => {
    if (!value) return 'Password is required'
    if (value.length < 8) return 'Password must be at least 8 characters'
    return undefined
  }

  const validateName = (value: string): string | undefined => {
    if (!isLogin && !value.trim()) return 'Name is required'
    return undefined
  }

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setEmail(value)
    setFieldErrors((prev) => ({ ...prev, email: validateEmail(value) }))
  }

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setPassword(value)
    if (!isLogin) {
      setFieldErrors((prev) => ({ ...prev, password: validatePassword(value) }))
    } else {
      setFieldErrors((prev) => ({ ...prev, password: undefined }))
    }
  }

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setName(value)
    if (!isLogin) {
      setFieldErrors((prev) => ({ ...prev, name: validateName(value) }))
    }
  }

  const getSubmitError = (): string | undefined => {
    const emailErr = validateEmail(email)
    const passwordErr = validatePassword(password)
    const nameErr = validateName(name)
    if (emailErr || passwordErr || nameErr) return 'Please fix the errors above before continuing.'
    return undefined
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const submitErr = getSubmitError()
    if (submitErr) {
      setError(submitErr)
      return
    }
    setError('')
    setLoading(true)

    try {
      if (isLogin) {
        const result = await signIn('credentials', {
          redirect: false,
          email,
          password,
        })

        if (result?.error) {
          if (result.error === 'CredentialsSignin') {
            setError('Invalid email or password. Check your credentials and try again.')
          } else if (result.error === 'OAuthAccountNotLinked') {
            setError(
              'This email is already linked to another sign-in method. Try signing in with Google.'
            )
          } else {
            setError(`Unable to sign in: ${result.error}. Please try again or contact support.`)
          }
        } else {
          router.push('/dashboard')
        }
      } else {
        const res = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, email, password }),
        })

        const data = await res.json()

        if (!res.ok) {
          if (res.status === 409) {
            setError('An account with this email already exists. Try signing in instead.')
          } else {
            setError(data.error || 'Registration failed. Please try again or contact support.')
          }
        } else {
          const result = await signIn('credentials', {
            redirect: false,
            email,
            password,
          })

          if (result?.ok) {
            router.push('/dashboard')
          }
        }
      }
    } catch {
      setError('Unable to connect. Check your internet connection and try again.')
    } finally {
      setLoading(false)
    }
  }

  const signInWithGoogle = () => {
    signIn('google', { callbackUrl: '/dashboard' })
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-[1fr_minmax(0,520px)]">
      {/* Form panel */}
      <div className="flex flex-col px-6 py-8 sm:px-10 lg:px-16">
        <div className="animate-enter-fade flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2" aria-label="Omnysync home">
            <span className="grid size-7 place-items-center rounded-md bg-primary text-[13px] font-bold text-primary-foreground">
              O
            </span>
            <span className="text-[15px] font-semibold tracking-tight">Omnysync</span>
          </Link>
          <Link
            href="/pricing"
            className="text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            Pricing
          </Link>
        </div>

        <div className="flex flex-1 items-center py-10">
          <div className="mx-auto w-full max-w-sm">
            <h1
              className="animate-enter-up text-2xl font-semibold tracking-tight"
              style={{ animationDelay: '70ms' }}
            >
              {isLogin ? 'Welcome back' : 'Create your account'}
            </h1>
            <p
              className="animate-enter-up mt-1.5 text-sm text-muted-foreground"
              style={{ animationDelay: '120ms' }}
            >
              {isLogin
                ? 'Sign in to continue syncing your content.'
                : 'Start syncing your content across platforms in minutes.'}
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
              Continue with Google
            </Button>

            <div className="animate-enter-fade relative my-6" style={{ animationDelay: '220ms' }}>
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center">
                <span className="bg-background px-3 text-xs text-muted-foreground">
                  or continue with email
                </span>
              </div>
            </div>

            <form
              onSubmit={handleSubmit}
              className="animate-enter-up space-y-4"
              style={{ animationDelay: '260ms' }}
              noValidate
            >
              {!isLogin && (
                <div className="space-y-1.5">
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    type="text"
                    autoComplete="name"
                    placeholder="Your name"
                    value={name}
                    onChange={handleNameChange}
                    aria-invalid={!!fieldErrors.name}
                    aria-describedby={fieldErrors.name ? 'name-error' : undefined}
                    className="h-10"
                  />
                  {fieldErrors.name && (
                    <p id="name-error" className="text-xs text-destructive" role="alert">
                      {fieldErrors.name}
                    </p>
                  )}
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@company.com"
                  value={email}
                  onChange={handleEmailChange}
                  required
                  aria-invalid={!!fieldErrors.email}
                  aria-describedby={fieldErrors.email ? 'email-error' : undefined}
                  className="h-10"
                />
                {fieldErrors.email && (
                  <p id="email-error" className="text-xs text-destructive" role="alert">
                    {fieldErrors.email}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                  {isLogin && (
                    <Link
                      href="/auth/reset-password"
                      className="text-xs font-medium text-primary hover:underline"
                    >
                      Forgot password?
                    </Link>
                  )}
                </div>
                <Input
                  id="password"
                  type="password"
                  autoComplete={isLogin ? 'current-password' : 'new-password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={handlePasswordChange}
                  required
                  aria-invalid={!!fieldErrors.password}
                  aria-describedby={fieldErrors.password ? 'password-error' : undefined}
                  className="h-10"
                />
                {fieldErrors.password && (
                  <p id="password-error" className="text-xs text-destructive" role="alert">
                    {fieldErrors.password}
                  </p>
                )}
              </div>

              {error && (
                <div
                  key={error}
                  className="animate-shake flex items-start gap-2.5 rounded-lg border border-destructive/20 bg-destructive-soft p-3 text-sm text-destructive"
                  role="alert"
                >
                  <AlertCircle className="mt-0.5 size-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <Button type="submit" disabled={loading} className="h-10 w-full">
                {loading ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Please wait…
                  </>
                ) : (
                  <>
                    {isLogin ? 'Sign in' : 'Create account'}
                    <ArrowRight className="size-4" />
                  </>
                )}
              </Button>
            </form>

            <p
              className="animate-enter-fade mt-6 text-center text-sm text-muted-foreground"
              style={{ animationDelay: '320ms' }}
            >
              {isLogin ? "Don't have an account? " : 'Already have an account? '}
              <button
                type="button"
                onClick={() => {
                  setIsLogin(!isLogin)
                  setFieldErrors({})
                  setError('')
                }}
                className="font-medium text-primary hover:underline"
              >
                {isLogin ? 'Sign up' : 'Sign in'}
              </button>
            </p>

            <p
              className="animate-enter-fade mt-8 text-center text-xs leading-relaxed text-muted-foreground"
              style={{ animationDelay: '370ms' }}
            >
              By continuing, you agree to our{' '}
              <Link href="#" className="underline underline-offset-2">
                Terms
              </Link>{' '}
              and{' '}
              <Link href="#" className="underline underline-offset-2">
                Privacy Policy
              </Link>
              .
            </p>
          </div>
        </div>
      </div>

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
              Live routing console
            </p>
            <h2 className="mt-4 text-[30px] font-semibold leading-[1.02] tracking-[-0.03em] text-white">
              One draft in.
              <br />
              Every platform out.
            </h2>
            <p className="mt-3 max-w-sm text-sm leading-relaxed text-white/55">
              Watch a run move from source to destination, with per-platform status and no
              copy-paste.
            </p>
          </div>

          <div className="animate-enter-scale" style={{ animationDelay: '320ms' }}>
            <RouteMap tone="dark" />
          </div>

          <div className="flex items-center justify-between border-t border-white/10 pt-4 font-mono text-[9px] uppercase tracking-[0.14em] text-white/35">
            <span>Omnysync · run #2841</span>
            <span className="inline-flex items-center gap-1.5 text-emerald-300">
              <span className="size-1.5 rounded-full bg-emerald-400" />
              All destinations healthy
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
