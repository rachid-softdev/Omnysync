import type { ReactNode } from 'react'
import { pageMetadata } from '@/lib/metadata'

export function generateMetadata() {
  return pageMetadata({
    titleKey: 'META_ANALYTICS_TITLE',
    descriptionKey: 'META_ANALYTICS_DESC',
    path: '/dashboard/analytics',
    index: false,
  })
}

export default function AnalyticsLayout({ children }: { children: ReactNode }) {
  return children
}
