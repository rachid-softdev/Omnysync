/**
 * Error Boundary Component
 * Capture les erreurs React et affiche une UI appropriée
 */
'use client'

import { Component } from 'react'
import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertTriangle, RefreshCw, Home } from 'lucide-react'
import { t as translate } from '@/lib/i18n/index'

/** Determine locale from browser (client-side only) */
function getLocale(): string {
  if (typeof navigator === 'undefined') return 'en'
  return navigator.language.startsWith('fr') ? 'fr' : 'en'
}

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error?: Error
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  override componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Error caught by boundary:', error, errorInfo)

    // TODO: Envoyer à Sentry
    // if (window.Sentry) {
    //   window.Sentry.captureException(error, { extra: errorInfo })
    // }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: undefined })
  }

  override render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      const locale = getLocale()

      return (
        <div className="flex min-h-[400px] items-center justify-center p-4">
          <Card className="w-full max-w-md">
            <CardHeader>
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-destructive" aria-hidden="true" />
                <CardTitle>{translate('error.title', locale)}</CardTitle>
              </div>
              <CardDescription>{translate('error.description', locale)}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {process.env.NODE_ENV === 'development' && this.state.error && (
                <pre className="text-xs bg-muted p-2 rounded overflow-auto max-h-32">
                  {this.state.error.message}
                </pre>
              )}
              <div className="flex gap-2">
                <Button
                  onClick={this.handleReset}
                  className="flex-1"
                  aria-label={translate('error.retry', locale)}
                >
                  <RefreshCw className="w-4 h-4 mr-2" aria-hidden="true" />
                  {translate('error.retry', locale)}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => (window.location.href = '/')}
                  aria-label={translate('error.home', locale)}
                >
                  <Home className="w-4 h-4 mr-2" aria-hidden="true" />
                  {translate('error.home', locale)}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )
    }

    return this.props.children
  }
}

/**
 * Hook pour utiliser ErrorBoundary programmatiquement
 */
export function useErrorHandler() {
  const [error, setError] = React.useState<Error | null>(null)

  React.useEffect(() => {
    if (error) {
      console.error('Error caught by hook:', error)
      // TODO: Sentry capture
    }
  }, [error])

  const resetError = () => setError(null)

  return { error, setError, resetError }
}

// Need to import React for useState
import React from 'react'
