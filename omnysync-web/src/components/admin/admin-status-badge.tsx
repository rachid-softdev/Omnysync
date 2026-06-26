import { cn } from '@/lib/utils'

/**
 * Badge coloré selon le statut.
 * Utilise un <span> natif avec classes Tailwind.
 */
interface AdminStatusBadgeProps {
  status: 'active' | 'inactive' | 'trialing' | 'expired' | 'pending' | 'error'
  /** Texte affiché dans le badge. Par défaut, le statut est capitalisé. */
  label?: string
}

const statusStyles: Record<string, string> = {
  active:
    'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 border-green-200 dark:border-green-800',
  inactive:
    'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400 border-gray-200 dark:border-gray-800',
  trialing:
    'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200 dark:border-blue-800',
  expired:
    'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400 border-orange-200 dark:border-orange-800',
  pending:
    'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800',
  error:
    'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800',
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
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors',
        statusStyles[status]
      )}
    >
      {label ?? defaultLabels[status]}
    </span>
  )
}
