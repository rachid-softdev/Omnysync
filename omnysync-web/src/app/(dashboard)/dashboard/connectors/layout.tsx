import type { ReactNode } from 'react'
import { pageMetadata } from '@/lib/metadata'

export function generateMetadata() {
  return pageMetadata({
    titleKey: 'META_CONNECTORS_TITLE',
    descriptionKey: 'META_CONNECTORS_DESC',
    path: '/dashboard/connectors',
    index: false,
  })
}

export default function ConnectorsLayout({ children }: { children: ReactNode }) {
  return children
}
