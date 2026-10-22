'use client'

import { Badge } from '@/components/ui/badge'
import { useTranslations } from '@/lib/i18n/useTranslations'

/**
 * Statut coloré selon l'état, rendu avec les variantes sémantiques du Badge.
 */
interface AdminStatusBadgeProps {
  status: 'active' | 'inactive' | 'trialing' | 'expired' | 'pending' | 'error'
  /** Texte affiché dans le badge. Par défaut, le statut est traduit. */
  label?: string
}

const statusVariants: Record<
  AdminStatusBadgeProps['status'],
  'success' | 'secondary' | 'info' | 'warning' | 'destructive'
> = {
  active: 'success',
  inactive: 'secondary',
  trialing: 'info',
  expired: 'warning',
  pending: 'warning',
  error: 'destructive',
}

const statusKeys: Record<AdminStatusBadgeProps['status'], string> = {
  active: 'admin_status_active',
  inactive: 'admin_status_inactive',
  trialing: 'admin_status_trialing',
  expired: 'admin_status_expired',
  pending: 'admin_status_pending',
  error: 'admin_status_error',
}

export function AdminStatusBadge({ status, label }: AdminStatusBadgeProps) {
  const { t } = useTranslations()
  return (
    <Badge variant={statusVariants[status]} className="font-medium">
      {label ?? t(statusKeys[status])}
    </Badge>
  )
}
