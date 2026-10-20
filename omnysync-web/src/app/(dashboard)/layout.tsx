import { auth } from '@/lib/auth'
import { getT } from '@/lib/i18n'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { BookOpen } from 'lucide-react'
import { MobileNav } from '@/components/mobile-nav'
import { SidebarNav, type NavSection } from '@/components/sidebar-nav'
import { KeyboardShortcuts } from '@/components/keyboard-shortcuts'
import { CommandPalette, CommandPaletteTrigger } from '@/components/command-palette'
import { DashboardHeader } from '@/components/dashboard-header'
import { LogoutButton } from '@/components/logout-button'
import { BrandLockup } from '@/components/signal-mark'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()

  if (!session?.user) {
    redirect('/auth/signin')
  }

  const user = session.user
  const t = await getT()

  // Icons are referenced by name so this data can cross the server/client
  // boundary (component references are not serializable).
  const sections: NavSection[] = [
    {
      items: [
        { href: '/dashboard', icon: 'dashboard', label: t('UI_DASHBOARD') },
        { href: '/dashboard/documents', icon: 'documents', label: t('UI_DOCS_LABEL') },
        { href: '/dashboard/connectors', icon: 'connectors', label: t('UI_CONNECTORS') },
      ],
    },
    {
      title: t('UI_NAV_WORKSPACE'),
      items: [
        { href: '/dashboard/sync', icon: 'sync', label: t('UI_SYNC') },
        { href: '/dashboard/analytics', icon: 'analytics', label: t('UI_ANALYTICS') },
        { href: '/dashboard/webhooks', icon: 'webhooks', label: t('UI_WEBHOOKS') },
        { href: '/dashboard/approvals', icon: 'approvals', label: t('UI_APPROVALS') },
      ],
    },
    {
      title: t('UI_NAV_ACCOUNT'),
      items: [
        { href: '/dashboard/usage', icon: 'usage', label: t('UI_USAGE') },
        { href: '/dashboard/settings', icon: 'settings', label: t('UI_SETTINGS') },
        ...(user.role === 'ADMIN'
          ? [{ href: '/admin', icon: 'admin' as const, label: t('UI_ADMIN') }]
          : []),
      ],
    },
  ]

  const navItems = sections.flatMap((section) => section.items)

  return (
    <div className="min-h-screen bg-muted/40">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-background focus:px-4 focus:py-2 focus:text-foreground focus:ring-2 focus:ring-ring"
      >
        {t('UI_SKIP_TO_CONTENT')}
      </a>

      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground md:flex">
        <div className="flex h-14 items-center border-b border-sidebar-border px-5">
          <Link href="/dashboard" className="flex items-center">
            <BrandLockup tone="sidebar" />
          </Link>
        </div>

        <SidebarNav sections={sections} />

        <div className="border-t border-sidebar-border p-3">
          <CommandPaletteTrigger />
          <Link
            href="https://docs.omnysync.com"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 flex h-9 items-center gap-2.5 rounded-[3px] px-2.5 text-sm text-sidebar-foreground/55 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
          >
            <BookOpen className="size-4 shrink-0" />
            <span className="truncate">{t('UI_DOCS_LINK')}</span>
          </Link>

          <div className="mt-3 flex items-center gap-2.5 rounded-[3px] border border-sidebar-border bg-white/[0.04] p-2">
            {user.image ? (
              <Image
                src={user.image}
                alt={user.name || 'User'}
                width={32}
                height={32}
                className="size-8 rounded-[3px] object-cover"
              />
            ) : (
              <span className="grid size-8 shrink-0 place-items-center rounded-[3px] bg-primary/20 text-xs font-semibold text-primary">
                {(user.name || user.email || 'U').slice(0, 1).toUpperCase()}
              </span>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-medium leading-tight text-sidebar-foreground">
                {user.name}
              </p>
              <p className="truncate text-[11px] leading-tight text-sidebar-foreground/45">
                {user.email}
              </p>
            </div>
            <LogoutButton
              label={t('UI_LOGOUT')}
              iconOnly
              className="shrink-0 text-sidebar-foreground/50 hover:bg-sidebar-accent hover:text-sidebar-foreground"
            />
          </div>
        </div>
      </aside>

      <MobileNav navItems={navItems} user={user} />
      <CommandPalette />
      <KeyboardShortcuts />

      <div className="md:pl-64">
        <DashboardHeader user={{ name: user.name, email: user.email, image: user.image }} />
        <main id="main-content" className="pt-14">
          {children}
        </main>
      </div>
    </div>
  )
}
