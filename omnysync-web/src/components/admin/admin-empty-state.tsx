import { FileText } from 'lucide-react'

/**
 * État vide centré pour les pages admin.
 * Affiche une icône, un titre, une description optionnelle et une action optionnelle.
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
    <div className="flex flex-col items-center justify-center px-4 py-12">
      <div className="mb-3 rounded-[3px] border border-border bg-muted/50 p-2.5">
        <Icon className="size-5 text-muted-foreground" />
      </div>
      <h3 className="text-sm font-semibold">{title}</h3>
      {description && (
        <p className="mt-1 max-w-sm text-center text-xs text-muted-foreground">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
