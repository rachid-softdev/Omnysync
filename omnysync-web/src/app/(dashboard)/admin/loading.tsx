import { getT } from '@/lib/i18n'

export default async function AdminLoading() {
  const t = await getT()

  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="flex flex-col items-center gap-4">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary/30 border-t-primary" />
        <p className="text-sm text-muted-foreground">{t('loading.default')}</p>
      </div>
    </div>
  )
}
