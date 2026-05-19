'use client'

import { Suspense as ReactSuspense } from 'react'

interface SuspenseWrapperProps {
  children: React.ReactNode
  fallback?: React.ReactNode
}

export function Suspense({ children, fallback }: SuspenseWrapperProps) {
  return <ReactSuspense fallback={fallback || <Skeleton />}>{children}</ReactSuspense>
}

function Skeleton() {
  return (
    <div className="animate-pulse">
      <div className="h-4 bg-muted rounded w-3/4 mb-2"></div>
      <div className="h-4 bg-muted rounded w-1/2"></div>
    </div>
  )
}
