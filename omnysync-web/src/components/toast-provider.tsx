'use client'

import { Toaster as Sonner } from 'sonner'
import { toast as sonnerToast } from 'sonner'
import { useState, useCallback } from 'react'

type ToasterProps = React.ComponentProps<typeof Sonner>

const toastOptions: ToasterProps = {
  richColors: true,
  duration: 5000,
  position: 'bottom-right',
  theme: 'light',
  visibleToasts: 3,
}

export function ToastProvider(props: ToasterProps) {
  return <Sonner {...toastOptions} {...props} className="toaster group" />
}

// Toast functions
export const toast = {
  success: (
    message: string,
    options?: { description?: string; action?: { label: string; onClick: () => void } }
  ) => {
    sonnerToast.success(message, {
      description: options?.description,
      action: options?.action,
    })
  },
  error: (
    message: string,
    options?: { description?: string; action?: { label: string; onClick: () => void } }
  ) => {
    sonnerToast.error(message, {
      description: options?.description,
      action: options?.action,
    })
  },
  warning: (
    message: string,
    options?: { description?: string; action?: { label: string; onClick: () => void } }
  ) => {
    sonnerToast.warning(message, {
      description: options?.description,
      action: options?.action,
    })
  },
  info: (
    message: string,
    options?: { description?: string; action?: { label: string; onClick: () => void } }
  ) => {
    sonnerToast.info(message, {
      description: options?.description,
      action: options?.action,
    })
  },
  loading: (message: string) => {
    return sonnerToast.loading(message)
  },
  dismiss: (id: string) => {
    sonnerToast.dismiss(id)
  },
}

// Custom hook for managing loading states
interface UseAsyncOptions<T> {
  onSuccess?: (data: T) => void
  onError?: (error: Error) => void
  showToast?: boolean
}

export function useAsync<T>(asyncFn: () => Promise<T>, options: UseAsyncOptions<T> = {}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const execute = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const data = await asyncFn()
      options.onSuccess?.(data)
      return data
    } catch (err) {
      const error = err as Error
      setError(error)
      options.onError?.(error)

      if (options.showToast) {
        toast.error(error.message)
      }

      throw error
    } finally {
      setLoading(false)
    }
  }, [asyncFn, options])

  return { execute, loading, error }
}

// API fetch wrapper with toast errors
export async function fetchWithToast<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, options)

  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    const errorMessage = data.error || `Erreur ${res.status}`
    throw new Error(errorMessage)
  }

  return res.json()
}
