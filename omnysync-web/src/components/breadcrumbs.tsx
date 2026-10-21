'use client'

import { usePathname } from 'next/navigation'
import { useTranslations } from '@/lib/i18n/useTranslations'

const pathLabelKeys: Record<string, string> = {
  dashboard: 'UI_DASHBOARD',
  documents: 'UI_DOCUMENTS',
  connectors: 'UI_CONNECTORS',
  sync: 'UI_SYNC',
  settings: 'UI_SETTINGS',
  new: 'UI_NEW',
}

export function Breadcrumbs() {
  const pathname = usePathname()
  const { t } = useTranslations()
  const segments = pathname.split('/').filter(Boolean)

  if (segments.length <= 1) return null

  return (
    <nav className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
      {segments.map((segment, index) => (
        <span key={segment} className="flex items-center gap-2">
          {index > 0 && <span>/</span>}
          <span className={index === segments.length - 1 ? 'text-foreground font-medium' : ''}>
            {pathLabelKeys[segment] ? t(pathLabelKeys[segment]) : segment}
          </span>
        </span>
      ))}
    </nav>
  )
}
