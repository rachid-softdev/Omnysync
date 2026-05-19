'use client'

import { ThemeProvider } from 'next-themes'
import { ToastProvider } from '@/components/toast-provider'
import { ErrorBoundary } from '@/components/error-boundary'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ErrorBoundary>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
        <ToastProvider />
        {children}
      </ThemeProvider>
    </ErrorBoundary>
  )
}
