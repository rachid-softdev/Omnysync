import { auth } from '@/lib/auth'
import { getLocaleFromHeaders, getT } from '@/lib/i18n'
import { prisma } from '@/lib/prisma'
import { getUserOrgId } from '@/lib/auth/org'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  FileText,
  Plug,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  ArrowUpRight,
  Clock,
} from 'lucide-react'
import Link from 'next/link'
import { headers } from 'next/headers'
import type { Metadata } from 'next'
import { formatDate } from '@/lib/format-date'

export const metadata: Metadata = {
  title: 'Dashboard',
  description: 'Manage your content sync, connectors, and monitor your synchronization status.',
}

export default async function DashboardPage() {
  const session = await auth()

  if (!session?.user?.id) {
    return null
  }

  const locale = getLocaleFromHeaders(await headers())
  const t = await getT()
  const orgId = await getUserOrgId(session.user.id)

  const [docCount, connectorCount, syncedCount, errorCount, recentLogs] = await Promise.all([
    prisma.document.count({ where: { organizationId: orgId } }),
    prisma.connector.count({ where: { organizationId: orgId } }),
    prisma.document.count({ where: { organizationId: orgId, syncStatus: 'SYNCED' } }),
    prisma.document.count({ where: { organizationId: orgId, syncStatus: 'FAILED' } }),
    prisma.syncLog.findMany({
      where: { organizationId: orgId },
      orderBy: { createdAt: 'desc' },
      take: 6,
      include: { document: true },
    }),
  ])

  const syncRate = docCount > 0 ? Math.round((syncedCount / docCount) * 100) : 0
  const firstName = session.user.name?.split(' ')[0] ?? ''
  const isFirstRun = docCount === 0 && connectorCount === 0

  return (
    <div className="mx-auto max-w-6xl px-6 py-8 lg:px-8">
      {/* Page header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {firstName ? `${t('UI_WELCOME')}, ${firstName}` : t('UI_WELCOME')}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('UI_MANAGE_CONTENT')}</p>
        </div>
        <Button asChild>
          <Link href="/dashboard/sync/new">
            {t('UI_NEW_SYNC')}
            <ArrowRight className="size-4" />
          </Link>
        </Button>
      </div>

      {isFirstRun ? (
        /* First-run state: one clear path forward instead of four empty cards. */
        <div className="mt-8 rounded-xl border border-border bg-card p-8 shadow-sm">
          <div className="mx-auto max-w-md text-center">
            <span className="mx-auto grid size-12 place-items-center rounded-xl bg-primary/10 text-primary">
              <Plug className="size-6" />
            </span>
            <h2 className="mt-4 text-lg font-semibold tracking-tight">{t('UI_EMPTY_TITLE')}</h2>
            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
              {t('UI_EMPTY_DESC')}
            </p>
            <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
              <Button asChild className="w-full sm:w-auto">
                <Link href="/dashboard/connectors">
                  {t('UI_CONNECT_FIRST')}
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button
                variant="outline"
                asChild
                className="h-auto w-full whitespace-normal py-2 text-center sm:h-9 sm:w-auto sm:whitespace-nowrap"
              >
                <Link href="/dashboard/sync/new">{t('UI_IMPORT_DOCS')}</Link>
              </Button>
            </div>
          </div>

          <div className="mt-8 grid gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-3">
            {[
              { step: '1', label: t('UI_DOCS_MARKETING') },
              { step: '2', label: t('UI_DESTINATIONS_SETUP') },
              { step: '3', label: t('UI_FIRST_SYNC') },
            ].map((item) => (
              <div key={item.step} className="flex items-start gap-3 bg-card p-4">
                <span className="grid size-6 shrink-0 place-items-center rounded-full border border-border bg-muted text-[11px] font-semibold text-muted-foreground">
                  {item.step}
                </span>
                <p className="text-[13px] leading-snug text-muted-foreground">{item.label}</p>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <>
          {/* Metric strip: one dominant number, supporting metrics beside it. */}
          <div className="mt-8 grid gap-4 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
            <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <p className="text-[13px] font-medium text-muted-foreground">{t('UI_SYNC_RATE')}</p>
                <Badge
                  variant={syncRate >= 90 ? 'success' : syncRate >= 60 ? 'warning' : 'destructive'}
                >
                  {syncRate}%
                </Badge>
              </div>
              <p className="mt-3 text-3xl font-semibold tracking-tight tabular-nums">
                {syncedCount}
                <span className="ml-1 text-base font-normal text-muted-foreground">
                  / {docCount}
                </span>
              </p>
              <div
                className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted"
                role="progressbar"
                aria-valuenow={syncRate}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={t('UI_SYNC_RATE')}
              >
                <div
                  className="h-full rounded-full bg-primary transition-[width] duration-300"
                  style={{ width: `${syncRate}%` }}
                />
              </div>
            </div>

            {[
              {
                label: t('UI_DOCS_LABEL'),
                value: docCount,
                icon: FileText,
                href: '/dashboard/documents',
              },
              {
                label: t('UI_CONNECTORS_LABEL'),
                value: connectorCount,
                icon: Plug,
                href: '/dashboard/connectors',
              },
              {
                label: t('UI_ERRORS'),
                value: errorCount,
                icon: AlertCircle,
                href: '/dashboard/documents',
                tone: errorCount > 0 ? 'text-destructive' : undefined,
              },
            ].map((stat) => (
              <Link
                key={stat.label}
                href={stat.href}
                className="group rounded-xl border border-border bg-card p-5 shadow-sm transition-colors hover:border-border-strong"
              >
                <div className="flex items-center justify-between">
                  <p className="text-[13px] font-medium text-muted-foreground">{stat.label}</p>
                  <stat.icon className="size-4 text-muted-foreground/60" />
                </div>
                <p
                  className={`mt-3 text-3xl font-semibold tracking-tight tabular-nums ${stat.tone ?? ''}`}
                >
                  {stat.value}
                </p>
                <span className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100">
                  {t('UI_VIEW_ALL')}
                  <ArrowUpRight className="size-3" />
                </span>
              </Link>
            ))}
          </div>

          {/* Activity + getting started */}
          <div className="mt-4 grid gap-4 lg:grid-cols-[1.6fr_1fr]">
            <div className="rounded-xl border border-border bg-card shadow-sm">
              <div className="flex items-center justify-between border-b border-border px-5 py-4">
                <div>
                  <h2 className="text-sm font-semibold">{t('UI_RECENT_ACTIVITY')}</h2>
                  <p className="mt-0.5 text-xs text-muted-foreground">{t('UI_LAST_SYNCS')}</p>
                </div>
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/dashboard/sync">
                    {t('UI_VIEW_ALL')}
                    <ArrowRight className="size-3.5" />
                  </Link>
                </Button>
              </div>

              {recentLogs.length === 0 ? (
                <div className="px-5 py-12 text-center">
                  <Clock className="mx-auto size-5 text-muted-foreground/50" />
                  <p className="mt-2 text-sm text-muted-foreground">{t('UI_NO_ACTIVITY')}</p>
                </div>
              ) : (
                <ul className="divide-y divide-border">
                  {recentLogs.map((log) => {
                    const isSuccess = log.status === 'SUCCESS'
                    const isError = log.status === 'ERROR'
                    return (
                      <li
                        key={log.id}
                        className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-muted/40"
                      >
                        <span
                          className={`grid size-7 shrink-0 place-items-center rounded-full ${
                            isSuccess
                              ? 'bg-success-soft text-success'
                              : isError
                                ? 'bg-destructive-soft text-destructive'
                                : 'bg-muted text-muted-foreground'
                          }`}
                        >
                          {isSuccess ? (
                            <CheckCircle2 className="size-3.5" />
                          ) : (
                            <AlertCircle className="size-3.5" />
                          )}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[13px]">{log.message}</p>
                          {log.document?.title && (
                            <p className="truncate text-[11px] text-muted-foreground">
                              {log.document.title}
                            </p>
                          )}
                        </div>
                        <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                          {formatDate(log.createdAt, locale)}
                        </span>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>

            <div className="rounded-xl border border-border bg-card shadow-sm">
              <div className="border-b border-border px-5 py-4">
                <h2 className="text-sm font-semibold">{t('UI_GETTING_STARTED')}</h2>
                <p className="mt-0.5 text-xs text-muted-foreground">{t('UI_FIRST_STEPS')}</p>
              </div>
              <ol className="divide-y divide-border">
                {[
                  { label: t('UI_DOCS_MARKETING'), done: docCount > 0 },
                  { label: t('UI_DESTINATIONS_SETUP'), done: connectorCount > 0 },
                  { label: t('UI_FIRST_SYNC'), done: syncedCount > 0 },
                ].map((item, index) => (
                  <li key={item.label} className="flex items-start gap-3 px-5 py-3.5">
                    <span
                      className={`grid size-6 shrink-0 place-items-center rounded-full text-[11px] font-semibold ${
                        item.done
                          ? 'bg-success-soft text-success'
                          : 'border border-border bg-muted text-muted-foreground'
                      }`}
                    >
                      {item.done ? <CheckCircle2 className="size-3.5" /> : index + 1}
                    </span>
                    <p
                      className={`text-[13px] leading-snug ${
                        item.done ? 'text-muted-foreground line-through' : ''
                      }`}
                    >
                      {item.label}
                    </p>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
