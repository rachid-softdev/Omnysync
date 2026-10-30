import type { ReactNode } from 'react'
import { pageMetadata } from '@/lib/metadata'

export function generateMetadata() {
  return pageMetadata({
    titleKey: 'META_SIGNIN_TITLE',
    descriptionKey: 'META_SIGNIN_DESC',
    path: '/auth/signin',
    index: false,
  })
}

export default function SignInLayout({ children }: { children: ReactNode }) {
  return children
}
