'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Menu, X, LogOut } from 'lucide-react'
import { useIsMobile } from '@/hooks/use-mobile'
import { logoutAction } from '@/lib/actions'
import { t } from '@/lib/i18n'

interface NavItem {
  href: string
  icon: React.ComponentType<{ className?: string }>
  label: string
}

interface MobileNavProps {
  navItems: NavItem[]
  user: {
    name?: string | null
    email?: string | null
    image?: string | null
  }
}

export function MobileNav({ navItems, user }: MobileNavProps) {
  const isMobile = useIsMobile()
  const [isOpen, setIsOpen] = useState(false)
  const pathname = usePathname()

  if (!isMobile) return null

  return (
    <>
      {/* Mobile header with hamburger */}
      <header className="md:hidden fixed top-0 left-0 right-0 z-40 bg-card border-b border-border flex items-center justify-between px-4 h-14">
        <h1 className="text-lg font-bold">Omnysync</h1>
        <Button variant="ghost" size="icon" onClick={() => setIsOpen(true)} aria-label="Open menu">
          <Menu className="w-5 h-5" />
        </Button>
      </header>

      {/* Mobile drawer overlay */}
      {isOpen && (
        <div
          className="md:hidden fixed inset-0 z-50 bg-black/50"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Mobile drawer */}
      <div
        className={`md:hidden fixed top-0 left-0 z-50 h-full w-72 bg-card border-r border-border transform transition-transform duration-200 ease-in-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h1 className="text-xl font-bold">Omnysync</h1>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsOpen(false)}
            aria-label="Close menu"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>
        <nav className="p-4">
          <ul className="space-y-2">
            {navItems.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={() => setIsOpen(false)}
                    className={`flex items-center gap-3 px-4 py-2 rounded-lg transition-colors ${
                      isActive ? 'bg-accent text-accent-foreground' : 'hover:bg-accent'
                    }`}
                  >
                    <item.icon className="w-5 h-5" />
                    {item.label}
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-border">
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
            size="sm"
            onClick={() => logoutAction()}
            className="w-full justify-start text-muted-foreground hover:text-foreground"
          >
            <LogOut className="w-4 h-4 mr-2" />
            {t('UI_LOGOUT')}
          </Button>
        </div>
      </div>
    </>
  )
}
