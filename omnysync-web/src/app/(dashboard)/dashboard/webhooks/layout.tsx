import type { ReactNode } from 'react'
import { pageMetadata } from '@/lib/metadata'

export function generateMetadata() {
  return pageMetadata({
    titleKey: 'META_WEBHOOKS_TITLE',
    descriptionKey: 'META_WEBHOOKS_DESC',
    path: '/dashboard/webhooks',
    index: false,
  })
}

export default function WebhooksLayout({ children }: { children: ReactNode }) {
  return children
}
