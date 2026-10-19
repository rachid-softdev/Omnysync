'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { isNavItemActive } from '@/lib/nav'
import { resolveNavIcon, type NavIcon } from '@/components/nav-icons'

export interface NavItem {
  href: string
  /** Serializable icon name (server-safe) or a Lucide component (client). */
  icon: NavIcon
  label: string
}

export interface NavSection {
  /** Optional section heading. Omit for the primary (unlabeled) group. */
  title?: string
  items: NavItem[]
}

interface SidebarNavProps {
  /** Flat list — kept for callers that don't need grouping. */
  items?: NavItem[]
  /** Grouped navigation. Takes precedence over `items` when provided. */
  sections?: NavSection[]
}

export function SidebarNav({ items, sections }: SidebarNavProps) {
  const pathname = usePathname()

  const resolvedSections: NavSection[] = sections ?? (items ? [{ items }] : [])

  return (
    <nav className="flex-1 overflow-y-auto px-3 py-4">
      <div className="space-y-6">
        {resolvedSections.map((section, index) => (
          <div key={section.title ?? `section-${index}`}>
            {section.title && (
              <p className="mb-1.5 px-2.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">
                {section.title}
              </p>
            )}
            <ul className="space-y-0.5">
              {section.items.map((item) => {
                const isActive = isNavItemActive(pathname, item.href)
                const Icon = resolveNavIcon(item.icon)

                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={isActive ? 'page' : undefined}
                      className={cn(
                        'group flex h-9 items-center gap-2.5 rounded-md px-2.5 text-sm transition-colors duration-150',
                        isActive
                          ? 'bg-background font-medium text-foreground shadow-2xs'
                          : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                      )}
                    >
                      <Icon
                        className={cn(
                          'size-4 shrink-0 transition-colors',
                          isActive
                            ? 'text-primary'
                            : 'text-muted-foreground/80 group-hover:text-foreground'
                        )}
                      />
                      <span className="truncate">{item.label}</span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </div>
    </nav>
  )
}
