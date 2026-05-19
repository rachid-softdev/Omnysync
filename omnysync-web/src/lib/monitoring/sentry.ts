/**
 * Sentry Monitoring Integration
 * Omnysync - 2026
 */

// Ce fichier configure Sentry pour le tracking d'erreurs
// À utiliser uniquement si SENTRY_DSN est configuré

import * as Sentry from '@sentry/nextjs'

/**
 * Initialise Sentry avec la configuration recommandée
 */
export function initSentry() {
  if (!process.env.SENTRY_DSN) {
    console.warn('SENTRY_DSN not configured, skipping Sentry initialization')
    return
  }

  Sentry.init({
    dsn: process.env.SENTRY_DSN,

    // Performance monitoring
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

    // Session replay (optionnel, peut impacter les perfs)
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,

    // Environment
    environment: process.env.NODE_ENV,

    // Release tracking
    release: process.env.npm_package_version,

    // Ignore certain errors
    ignoreErrors: [
      /Network Error/,
      /fetch failed/,
      /Failed to fetch/,
      'ResizeObserver loop limit exceeded',
      'ResizeObserver loop completed with undelivered notifications',
    ],

    // Filter transactions
    beforeSendTransaction(event) {
      // Ne pas envoyer les transactions de health check
      if (event.transaction?.includes('health')) {
        return null
      }
      return event
    },

    // Attach user info when available
    initialScope: {
      tags: {
        app: 'omnysync',
      },
    },
  })
}

/**
 * Capture une erreur personnalisée
 */
export function captureError(error: Error, context?: Record<string, unknown>) {
  if (!process.env.SENTRY_DSN) {
    console.error('Error:', error, context)
    return
  }

  Sentry.captureException(error, {
    extra: context,
  })
}

/**
 * Capture un message
 */
export function captureMessage(
  message: string,
  level: Sentry.SeverityLevel = 'info',
  context?: Record<string, unknown>
) {
  if (!process.env.SENTRY_DSN) {
    console.log(`[${level}]`, message, context)
    return
  }

  Sentry.captureMessage(message, {
    level,
    extra: context,
  })
}

/**
 * Ajoute des données de contexte à toutes les erreurs suivantes
 */
export function setContext(key: string, data: Record<string, unknown>) {
  Sentry.setContext(key, data)
}

/**
 * Ajoute les infos utilisateur
 */
export function setUser(user: { id: string; email?: string; username?: string } | null) {
  Sentry.setUser(user)
}

/**
 * Ajoute un tag à toutes les erreurs suivantes
 */
export function setTag(key: string, value: string) {
  Sentry.setTag(key, value)
}

/**
 * Wrapper pour capturer les erreurs de promesses
 */
export function capturePromiseError(promise: Promise<unknown>): Promise<unknown> {
  return promise.catch((error) => {
    captureError(error as Error)
    throw error
  })
}

/**
 * Utilitaire pour les API routes
 */
export function withSentryCapture(handler: (req: Request) => Promise<Response>) {
  return async (req: Request): Promise<Response> => {
    try {
      return await handler(req)
    } catch (error) {
      captureError(error as Error, {
        url: req.url,
        method: req.method,
      })
      throw error
    }
  }
}

// Export par défaut pour la configuration Next.js
export default {
  initSentry,
  captureError,
  captureMessage,
  setContext,
  setUser,
  setTag,
  capturePromiseError,
  withSentryCapture,
}
