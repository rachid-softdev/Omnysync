'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

interface NavItem {
  href: string
  icon: React.ComponentType<{ className?: string }>
  label: string
}

interface SidebarNavProps {
  items: NavItem[]
}

export function SidebarNav({ items }: SidebarNavProps) {
  const pathname = usePathname()

  return (
    <nav className="flex-1 p-4">
      <ul className="space-y-2">
        {items.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={`flex items-center gap-3 px-4 py-2 rounded-lg transition-colors ${
                  isActive
                    ? 'bg-accent text-accent-foreground font-medium'
                    : 'hover:bg-accent text-muted-foreground hover:text-foreground'
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
  )
}
