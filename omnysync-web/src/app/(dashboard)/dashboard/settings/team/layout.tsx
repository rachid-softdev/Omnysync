import type { ReactNode } from 'react'
import { pageMetadata } from '@/lib/metadata'

export function generateMetadata() {
  return pageMetadata({
    titleKey: 'META_TEAM_TITLE',
    descriptionKey: 'META_TEAM_DESC',
    path: '/dashboard/settings/team',
    index: false,
  })
}

export default function TeamLayout({ children }: { children: ReactNode }) {
  return children
}
