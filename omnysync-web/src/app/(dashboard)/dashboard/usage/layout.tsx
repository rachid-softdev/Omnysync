import type { ReactNode } from 'react'
import { pageMetadata } from '@/lib/metadata'

export function generateMetadata() {
  return pageMetadata({
    titleKey: 'META_USAGE_TITLE',
    descriptionKey: 'META_USAGE_DESC',
    path: '/dashboard/usage',
    index: false,
  })
}

export default function UsageLayout({ children }: { children: ReactNode }) {
  return children
}
