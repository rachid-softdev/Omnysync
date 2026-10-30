import { auth } from '@/lib/auth'
import { pageMetadata } from '@/lib/metadata'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'

/**
 * Guards the whole /admin segment. API routes keep using requireAdmin()
 * (which returns a 403 through AuthError), while pages redirect non-admins
 * instead of rendering a server error.
 */
export function generateMetadata(): Promise<Metadata> {
  return pageMetadata({
    titleKey: 'META_ADMIN_TITLE',
    descriptionKey: 'META_ADMIN_DESC',
    path: '/admin',
    index: false,
  })
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()

  if (!session?.user) {
    redirect('/auth/signin')
  }

  if (session.user.role !== 'ADMIN') {
    redirect('/dashboard')
  }

  return <>{children}</>
}
