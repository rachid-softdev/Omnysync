import type { ReactNode } from 'react'
import { pageMetadata } from '@/lib/metadata'

export function generateMetadata() {
  return pageMetadata({
    titleKey: 'META_2FA_TITLE',
    descriptionKey: 'META_2FA_DESC',
    path: '/auth/2fa-verify',
    index: false,
  })
}

export default function TwoFactorLayout({ children }: { children: ReactNode }) {
  return children
}
