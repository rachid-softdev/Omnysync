import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'

/**
 * Guards the whole /admin segment. API routes keep using requireAdmin()
 * (which returns a 403 through AuthError), while pages redirect non-admins
 * instead of rendering a server error.
 */
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
