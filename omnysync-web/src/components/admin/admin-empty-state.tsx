import { FileText } from 'lucide-react'

/**
 * État vide aligné à gauche pour les pages admin.
 * Respecte la règle Signal : pas d'illustration centrée, une action claire.
 */
interface AdminEmptyStateProps {
  icon?: React.ComponentType<{ className?: string }>
  title: string
  description?: string
  action?: React.ReactNode
}

export function AdminEmptyState({
  icon: Icon = FileText,
  title,
  description,
  action,
}: AdminEmptyStateProps) {
  return (
    <div className="flex items-start gap-3 px-4 py-10 text-left">
      <div className="shrink-0 rounded-[3px] border border-border bg-muted/50 p-2.5">
        <Icon className="size-5 text-muted-foreground" />
      </div>
      <div className="min-w-0">
        <h3 className="text-sm font-semibold">{title}</h3>
        {description && (
          <p className="mt-1 max-w-sm text-xs text-muted-foreground">{description}</p>
        )}
        {action && <div className="mt-4">{action}</div>}
      </div>
    </div>
  )
}
