import type { ReactNode } from 'react'
import { pageMetadata } from '@/lib/metadata'

export function generateMetadata() {
  return pageMetadata({
    titleKey: 'META_SETTINGS_TITLE',
    descriptionKey: 'META_SETTINGS_DESC',
    path: '/dashboard/settings',
    index: false,
  })
}

export default function SettingsLayout({ children }: { children: ReactNode }) {
  return children
}
