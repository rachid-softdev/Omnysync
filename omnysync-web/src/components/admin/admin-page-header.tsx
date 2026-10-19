import { PageHeader } from '@/components/page-header'

/**
 * En-tête réutilisable pour les pages admin.
 * Délègue au PageHeader partagé pour garantir le même rythme typographique.
 */
interface AdminPageHeaderProps {
  title: string
  description?: string
  actions?: React.ReactNode
}

export function AdminPageHeader({ title, description, actions }: AdminPageHeaderProps) {
  return <PageHeader title={title} description={description} actions={actions} />
}
