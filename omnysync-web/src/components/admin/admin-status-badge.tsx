import { Badge } from '@/components/ui/badge'

/**
 * Statut coloré selon l'état, rendu avec les variantes sémantiques du Badge.
 */
interface AdminStatusBadgeProps {
  status: 'active' | 'inactive' | 'trialing' | 'expired' | 'pending' | 'error'
  /** Texte affiché dans le badge. Par défaut, le statut est capitalisé. */
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

const defaultLabels: Record<string, string> = {
  active: 'Actif',
  inactive: 'Inactif',
  trialing: 'Essai',
  expired: 'Expiré',
  pending: 'En attente',
  error: 'Erreur',
}

export function AdminStatusBadge({ status, label }: AdminStatusBadgeProps) {
  return (
    <Badge variant={statusVariants[status]} className="font-medium">
      {label ?? defaultLabels[status]}
    </Badge>
  )
}
