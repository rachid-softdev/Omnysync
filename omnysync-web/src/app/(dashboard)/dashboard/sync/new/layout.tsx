import type { ReactNode } from 'react'
import { pageMetadata } from '@/lib/metadata'

export function generateMetadata() {
  return pageMetadata({
    titleKey: 'META_SYNC_NEW_TITLE',
    descriptionKey: 'META_SYNC_NEW_DESC',
    path: '/dashboard/sync/new',
    index: false,
  })
}

export default function NewSyncLayout({ children }: { children: ReactNode }) {
  return children
}
