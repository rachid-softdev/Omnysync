'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Menu, X, LogOut } from 'lucide-react'
import { useIsMobile } from '@/hooks/use-mobile'
import { logoutAction } from '@/lib/actions'
import { useTranslations } from '@/lib/i18n/useTranslations'
import { cn } from '@/lib/utils'
import { isNavItemActive } from '@/lib/nav'
import { resolveNavIcon, type NavIcon } from '@/components/nav-icons'
import { BrandLockup } from '@/components/signal-mark'

interface NavItem {
  href: string
  icon: NavIcon
  label: string
}

interface MobileNavProps {
  navItems: NavItem[]
  user: {
    name?: string | null
    email?: string | null
    image?: string | null
  }
  locale?: string
}

export function MobileNav({ navItems, user, locale }: MobileNavProps) {
  const isMobile = useIsMobile()
  const [isOpen, setIsOpen] = useState(false)
  const pathname = usePathname()
  const { t } = useTranslations(locale)

  if (!isMobile) return null

  return (
    <>
      {/* Mobile top bar */}
      <header className="fixed left-0 right-0 top-0 z-40 flex h-14 items-center justify-between border-b border-border bg-background/90 px-4 backdrop-blur-md md:hidden">
        <Link href="/dashboard" className="flex items-center">
          <BrandLockup />
        </Link>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => setIsOpen(true)}
          aria-label={t('UI_OPEN_MENU')}
        >
          <Menu className="size-5" />
        </Button>
      </header>

      {/* Drawer overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-[2px] md:hidden"
          onClick={() => setIsOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Drawer */}
      <div
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-border bg-sidebar transition-transform duration-200 ease-out-quart md:hidden',
          isOpen ? 'translate-x-0' : '-translate-x-full'
        )}
        aria-hidden={!isOpen}
      >
        <div className="flex h-14 items-center justify-between border-b border-sidebar-border px-4">
          <BrandLockup tone="sidebar" />
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setIsOpen(false)}
            aria-label={t('UI_CLOSE_MENU')}
            className="text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground"
          >
            <X className="size-5" />
          </Button>
        </div>

        <nav className="flex-1 overflow-y-auto p-3">
          <ul className="space-y-0.5">
            {navItems.map((item) => {
              const isActive = isNavItemActive(pathname, item.href)
              const Icon = resolveNavIcon(item.icon)
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={() => setIsOpen(false)}
                    aria-current={isActive ? 'page' : undefined}
                    className={cn(
                      'flex h-9 items-center gap-2.5 rounded-[3px] px-2.5 text-sm transition-colors',
                      isActive
                        ? 'bg-white/[0.06] font-medium text-sidebar-foreground'
                        : 'text-sidebar-foreground/55 hover:bg-white/[0.04] hover:text-sidebar-foreground'
                    )}
                  >
                    <Icon
                      className={cn(
                        'size-4 shrink-0',
                        isActive ? 'text-primary' : 'text-sidebar-foreground/45'
                      )}
                    />
                    <span className="truncate">{item.label}</span>
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>

        <div className="border-t border-sidebar-border p-3">
          <div className="mb-3 flex items-center gap-2.5 rounded-[3px] border border-sidebar-border bg-white/[0.04] p-2">
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
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => logoutAction()}
            className="w-full justify-start text-sidebar-foreground/55 hover:bg-sidebar-accent hover:text-sidebar-foreground"
          >
            <LogOut className="size-4" />
            {t('UI_LOGOUT')}
          </Button>
        </div>
      </div>
    </>
  )
}
