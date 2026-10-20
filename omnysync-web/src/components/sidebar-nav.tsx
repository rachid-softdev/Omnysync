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
              <p className="mb-1.5 px-2.5 font-mono text-[9px] font-medium uppercase tracking-[0.16em] text-sidebar-foreground/35">
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
                        'group relative flex h-9 items-center gap-2.5 rounded-[3px] px-2.5 text-sm transition-colors duration-150',
                        isActive
                          ? 'bg-white/[0.06] font-medium text-sidebar-foreground'
                          : 'text-sidebar-foreground/55 hover:bg-white/[0.04] hover:text-sidebar-foreground'
                      )}
                    >
                      {isActive && (
                        <span
                          aria-hidden="true"
                          className="absolute inset-y-1.5 left-0 w-0.5 bg-primary"
                        />
                      )}
                      <Icon
                        className={cn(
                          'size-4 shrink-0 transition-colors',
                          isActive
                            ? 'text-primary'
                            : 'text-sidebar-foreground/45 group-hover:text-sidebar-foreground'
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
