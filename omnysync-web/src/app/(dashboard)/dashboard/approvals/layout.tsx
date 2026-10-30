import type { ReactNode } from 'react'
import { pageMetadata } from '@/lib/metadata'

export function generateMetadata() {
  return pageMetadata({
    titleKey: 'META_APPROVALS_TITLE',
    descriptionKey: 'META_APPROVALS_DESC',
    path: '/dashboard/approvals',
    index: false,
  })
}

export default function ApprovalsLayout({ children }: { children: ReactNode }) {
  return children
}
