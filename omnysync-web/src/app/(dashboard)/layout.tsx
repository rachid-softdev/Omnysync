import { auth } from '@/lib/auth'
import { t } from '@/lib/i18n'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import {
  LayoutDashboard,
  FileText,
  Plug,
  Settings,
  LogOut,
  ArrowRightLeft,
  BarChart3,
  Webhook,
  FileCheck,
  Zap,
  Shield,
  ExternalLink,
} from 'lucide-react'
import { logoutAction } from '@/lib/actions'
import { MobileNav } from '@/components/mobile-nav'
import { SidebarNav } from '@/components/sidebar-nav'
import { KeyboardShortcuts } from '@/components/keyboard-shortcuts'
import { CommandPalette, CommandPaletteTrigger } from '@/components/command-palette'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()

  if (!session?.user) {
    redirect('/auth/signin')
  }

  const user = session.user
  const trans = t

  const navItems = [
    { href: '/dashboard', icon: LayoutDashboard, label: trans('UI_DASHBOARD') },
    { href: '/dashboard/documents', icon: FileText, label: trans('UI_DOCS_LABEL') },
    { href: '/dashboard/connectors', icon: Plug, label: trans('UI_CONNECTORS') },
    { href: '/dashboard/sync', icon: ArrowRightLeft, label: trans('UI_SYNC') },
    {
      href: '/dashboard/analytics',
      icon: BarChart3,
      label: trans('UI_ANALYTICS'),
    },
    { href: '/dashboard/webhooks', icon: Webhook, label: trans('UI_WEBHOOKS') },
    {
      href: '/dashboard/approvals',
      icon: FileCheck,
      label: trans('UI_APPROVALS'),
    },
    { href: '/dashboard/usage', icon: Zap, label: trans('UI_USAGE') },
    { href: '/dashboard/settings', icon: Settings, label: trans('UI_SETTINGS') },
    ...(user.role === 'ADMIN' ? [{ href: '/admin', icon: Shield, label: 'Admin' }] : []),
  ]

  return (
    <div className="min-h-screen flex">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-background focus:text-foreground focus:ring-2 focus:ring-ring focus:rounded-lg"
      >
        {t('UI_SKIP_TO_CONTENT')}
      </a>
      {/* Desktop sidebar - hidden on mobile */}
      <aside className="hidden md:flex w-64 bg-card border-r border-border flex-col">
        <div className="p-6 border-b border-border">
          <h1 className="text-xl font-bold">Omnysync</h1>
        </div>
        <SidebarNav items={navItems} />
        <div className="p-4 border-t border-border">
          <Link
            href="https://docs.omnysync.com"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 px-4 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors mb-2"
          >
            <ExternalLink className="w-4 h-4" />
            <span>Help & Documentation</span>
          </Link>
          <div className="flex items-center gap-3 mb-4">
            {user.image && (
              <Image
                src={user.image}
                alt={user.name || 'User'}
                width={32}
                height={32}
                className="rounded-full"
              />
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{user.name}</p>
              <p className="text-xs text-muted-foreground truncate">{user.email}</p>
            </div>
          </div>
          <Button
            variant="ghost"
            className="w-full justify-start text-muted-foreground hover:text-foreground"
            size="sm"
            onClick={() => logoutAction()}
          >
            <LogOut className="w-4 h-4 mr-2" />
            {trans('UI_LOGOUT')}
          </Button>
          <CommandPaletteTrigger />
        </div>
      </aside>
      {/* Mobile navigation */}
      <MobileNav navItems={navItems} user={user} />
      <CommandPalette />
      <KeyboardShortcuts />
      <main id="main-content" className="flex-1 bg-background md:pt-0 pt-14">
        {children}
      </main>
    </div>
  )
}
