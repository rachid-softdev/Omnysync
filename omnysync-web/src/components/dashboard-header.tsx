'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { ChevronRight, Search } from 'lucide-react'
import { ThemeToggle } from '@/components/theme-toggle'
import { openCommandPalette } from '@/components/command-palette'
import { useTranslations } from '@/lib/i18n/useTranslations'

interface DashboardHeaderProps {
  user: {
    name?: string | null
    email?: string | null
    image?: string | null
  }
}

/** Maps a route segment to its translation key. */
const SEGMENT_LABELS: Record<string, string> = {
  dashboard: 'UI_DASHBOARD',
  documents: 'UI_DOCS_LABEL',
  connectors: 'UI_CONNECTORS',
  sync: 'UI_SYNC',
  analytics: 'UI_ANALYTICS',
  webhooks: 'UI_WEBHOOKS',
  approvals: 'UI_APPROVALS',
  usage: 'UI_USAGE',
  settings: 'UI_SETTINGS',
  admin: 'UI_ADMIN',
  new: 'UI_NEW',
  users: 'UI_USERS',
  orgs: 'UI_ORGS',
  plans: 'UI_PLANS',
  features: 'UI_FEATURES',
  overrides: 'UI_OVERRIDES',
  health: 'UI_HEALTH',
  logs: 'UI_LOGS',
  audit: 'UI_AUDIT',
  billing: 'UI_BILLING',
}

function useBreadcrumbs() {
  const pathname = usePathname()
  const segments = pathname.split('/').filter(Boolean)

  return segments.map((segment, index) => {
    const href = '/' + segments.slice(0, index + 1).join('/')
    const key = SEGMENT_LABELS[segment]
    // Unknown segments (IDs, slugs) are rendered as-is.
    return { href, segment, labelKey: key }
  })
}

export function DashboardHeader({ user }: DashboardHeaderProps) {
  const { t } = useTranslations()
  const crumbs = useBreadcrumbs()

  return (
    <header className="fixed left-0 right-0 top-0 z-20 hidden h-14 items-center gap-3 border-b border-border bg-background/85 px-4 backdrop-blur-md md:left-64 md:flex md:px-6">
      {/* Breadcrumbs */}
      <nav aria-label="Breadcrumb" className="min-w-0 flex-1">
        <ol className="flex items-center gap-1.5 text-sm">
          {crumbs.map((crumb, index) => {
            const isLast = index === crumbs.length - 1
            const label = crumb.labelKey ? t(crumb.labelKey) : crumb.segment

            return (
              <li key={crumb.href} className="flex min-w-0 items-center gap-1.5">
                {index > 0 && (
                  <ChevronRight
                    className="size-3.5 shrink-0 text-muted-foreground/50"
                    aria-hidden="true"
                  />
                )}
                {isLast ? (
                  <span className="truncate font-medium text-foreground" aria-current="page">
                    {label}
                  </span>
                ) : (
                  <Link
                    href={crumb.href}
                    className="truncate text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {label}
                  </Link>
                )}
              </li>
            )
          })}
        </ol>
      </nav>

      {/* Command palette trigger */}
      <button
        type="button"
        onClick={openCommandPalette}
        className="hidden h-8 items-center gap-2 rounded-md border border-border bg-background px-2.5 text-xs text-muted-foreground shadow-2xs transition-colors hover:bg-accent hover:text-foreground sm:flex"
        aria-label={t('UI_SEARCH_COMMANDS')}
      >
        <Search className="size-3.5" />
        <span>{t('UI_SEARCH')}</span>
        <kbd className="ml-1 rounded border border-border bg-muted px-1 py-0.5 font-mono text-[10px] leading-none">
          ⌘K
        </kbd>
      </button>

      <ThemeToggle />

      {user.image ? (
        <Image
          src={user.image}
          alt={user.name || 'User'}
          width={28}
          height={28}
          className="size-7 rounded-full object-cover"
        />
      ) : (
        <span className="grid size-7 place-items-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary">
          {(user.name || user.email || 'U').slice(0, 1).toUpperCase()}
        </span>
      )}
    </header>
  )
}
