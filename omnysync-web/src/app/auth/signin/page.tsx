'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { signIn } from 'next-auth/react'
import { Input } from '@/components/ui/input'
import { Zap, Globe, BarChart3, Shield, AlertCircle } from 'lucide-react'

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
        // Login with credentials
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
        // Register
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
          // Auto login after registration
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
    <div className="min-h-screen flex">
      {/* Left side - Form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <div className="mb-8">
            <Link href="/" className="text-2xl font-bold">
              Omnysync
            </Link>
          </div>

          <h1 className="text-3xl font-bold mb-2">
            {isLogin ? 'Welcome back' : 'Create your account'}
          </h1>
          <p className="text-muted-foreground mb-8">
            {isLogin
              ? 'Sign in to continue syncing your content'
              : 'Start syncing your content in minutes'}
          </p>

          <button
            onClick={signInWithGoogle}
            className="w-full flex items-center justify-center gap-3 rounded-full border border-input px-6 py-3 text-sm font-medium hover:bg-accent transition-colors mb-6"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
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
            <span>Continue with Google</span>
          </button>

          {/* Divider */}
          <div className="relative my-8">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-background px-4 text-muted-foreground">or</span>
            </div>
          </div>

          {/* Email/Password Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <div>
                <label htmlFor="name" className="text-sm font-medium mb-1 block">
                  Name
                </label>
                <Input
                  id="name"
                  type="text"
                  placeholder="Your name"
                  value={name}
                  onChange={handleNameChange}
                  required={!isLogin}
                  aria-invalid={!!fieldErrors.name}
                />
                {fieldErrors.name && (
                  <p className="text-xs text-destructive mt-1" role="alert">
                    {fieldErrors.name}
                  </p>
                )}
              </div>
            )}

            <div>
              <label htmlFor="email" className="text-sm font-medium mb-1 block">
                Email
              </label>
              <Input
                id="email"
                type="email"
                placeholder="you@company.com"
                value={email}
                onChange={handleEmailChange}
                required
                aria-invalid={!!fieldErrors.email}
              />
              {fieldErrors.email && (
                <p className="text-xs text-destructive mt-1" role="alert">
                  {fieldErrors.email}
                </p>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label htmlFor="password" className="text-sm font-medium">
                  Password
                </label>
                {isLogin && (
                  <Link
                    href="/auth/reset-password"
                    className="text-xs text-primary hover:underline"
                  >
                    Forgot password?
                  </Link>
                )}
              </div>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={handlePasswordChange}
                required
                aria-invalid={!!fieldErrors.password}
              />
              {fieldErrors.password && (
                <p className="text-xs text-destructive mt-1" role="alert">
                  {fieldErrors.password}
                </p>
              )}
            </div>

            {error && (
              <div
                className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm"
                role="alert"
              >
                <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-full bg-primary text-primary-foreground font-medium py-3 hover:bg-primary/90 disabled:opacity-50"
            >
              {loading ? 'Please wait...' : isLogin ? 'Sign in' : 'Create account'}
            </button>
          </form>

          <p className="text-sm text-muted-foreground mt-6 text-center">
            {isLogin ? "Don't have an account? " : 'Already have an account? '}
            <button
              type="button"
              onClick={() => {
                setIsLogin(!isLogin)
                setFieldErrors({})
                setError('')
              }}
              className="text-primary hover:underline font-medium"
            >
              {isLogin ? 'Sign up' : 'Sign in'}
            </button>
          </p>

          <p className="text-xs text-muted-foreground mt-6 text-center">
            By continuing, you agree to our{' '}
            <Link href="#" className="underline">
              Terms
            </Link>{' '}
            and{' '}
            <Link href="#" className="underline">
              Privacy Policy
            </Link>
          </p>
        </div>
      </div>

      {/* Right side - Benefits */}
      <div className="hidden lg:flex flex-1 bg-primary text-primary-foreground p-12 items-center justify-center">
        <div className="max-w-md">
          <h2 className="text-3xl font-bold mb-6">Sync smarter, not harder</h2>

          <div className="space-y-6">
            <div className="flex gap-4">
              <div className="w-10 h-10 rounded-full bg-primary-foreground/20 flex items-center justify-center flex-shrink-0">
                <Zap className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-semibold mb-1">Save hours every week</h3>
                <p className="text-sm text-primary-foreground/80">
                  One publish, everywhere. No more copying and pasting.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="w-10 h-10 rounded-full bg-primary-foreground/20 flex items-center justify-center flex-shrink-0">
                <Globe className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-semibold mb-1">All your platforms</h3>
                <p className="text-sm text-primary-foreground/80">
                  WordPress, Ghost, Webflow, Shopify & more.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="w-10 h-10 rounded-full bg-primary-foreground/20 flex items-center justify-center flex-shrink-0">
                <BarChart3 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-semibold mb-1">Track everything</h3>
                <p className="text-sm text-primary-foreground/80">
                  Analytics across all platforms in one place.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="w-10 h-10 rounded-full bg-primary-foreground/20 flex items-center justify-center flex-shrink-0">
                <Shield className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-semibold mb-1">Secure & private</h3>
                <p className="text-sm text-primary-foreground/80">
                  Enterprise-grade security. Your data stays yours.
                </p>
              </div>
            </div>
          </div>

          <div className="mt-12 pt-8 border-t border-primary-foreground/20">
            <div className="flex items-center gap-4">
              <div className="flex -space-x-2">
                {[1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className="w-8 h-8 rounded-full bg-primary-foreground/30 border-2 border-primary"
                  />
                ))}
              </div>
              <div className="text-sm">
                <span className="font-semibold">2,000+</span> creators syncing
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
