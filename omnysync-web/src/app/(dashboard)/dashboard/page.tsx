import { auth } from '@/lib/auth'
import { getLocaleFromHeaders, getT } from '@/lib/i18n'
import { prisma } from '@/lib/prisma'
import { getUserOrgId } from '@/lib/auth/org'
import { Button } from '@/components/ui/button'
import { PageShell } from '@/components/page-header'
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

const blueprintGrid = {
  backgroundImage:
    'linear-gradient(to right, rgb(255 255 255 / 0.055) 1px, transparent 1px), linear-gradient(to bottom, rgb(255 255 255 / 0.055) 1px, transparent 1px)',
  backgroundSize: '32px 32px',
} as const

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

  const metrics = [
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
  ]

  const setupSteps = [
    { label: t('UI_DOCS_MARKETING'), done: docCount > 0 },
    { label: t('UI_DESTINATIONS_SETUP'), done: connectorCount > 0 },
    { label: t('UI_FIRST_SYNC'), done: syncedCount > 0 },
  ]
  const doneSteps = setupSteps.filter((step) => step.done).length

  return (
    <PageShell className="pb-12">
      <header>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
          <div className="flex items-center gap-2.5 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
            <span className="relative flex size-2" aria-hidden="true">
              <span className="absolute inset-0 animate-ping rounded-full bg-success/40 motion-reduce:animate-none" />
              <span className="relative size-2 rounded-full bg-success" />
            </span>
            <span>{t('UI_CONSOLE_META')}</span>
          </div>
          <span className="hidden font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground sm:block">
            OMNYSYNC / {t('UI_CONSOLE')}
          </span>
        </div>

        <div className="mt-6 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              {t('UI_CONSOLE')} / {firstName || 'OPERATOR'}
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">
              {firstName ? `${t('UI_WELCOME')}, ${firstName}.` : t('UI_WELCOME')}
            </h1>
            <p className="mt-2 max-w-xl text-sm text-muted-foreground">{t('UI_MANAGE_CONTENT')}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" asChild>
              <Link href="/dashboard/connectors">
                <Plug className="size-4" />
                {t('UI_CONNECTORS_LABEL')}
              </Link>
            </Button>
            <Button asChild>
              <Link href="/dashboard/sync/new">
                {t('UI_NEW_SYNC')}
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>
        </div>
      </header>

      {isFirstRun ? (
        <section className="mt-8 border border-border bg-card">
          <div className="grid lg:grid-cols-[1.05fr_0.95fr]">
            <div className="p-6 sm:p-8 lg:p-10">
              <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground">
                ROUTE / 000
              </p>
              <h2 className="mt-3 max-w-lg text-2xl font-semibold tracking-[-0.03em] sm:text-3xl">
                {t('UI_EMPTY_TITLE')}
              </h2>
              <p className="mt-3 max-w-lg text-sm leading-relaxed text-muted-foreground">
                {t('UI_EMPTY_DESC')}
              </p>
              <div className="mt-6 flex flex-col gap-2 sm:flex-row">
                <Button asChild className="w-full sm:w-auto">
                  <Link href="/dashboard/connectors">
                    {t('UI_CONNECT_FIRST')}
                    <ArrowRight className="size-4" />
                  </Link>
                </Button>
                <Button variant="outline" asChild className="w-full sm:w-auto">
                  <Link href="/dashboard/sync/new">{t('UI_IMPORT_DOCS')}</Link>
                </Button>
              </div>

              <ol className="mt-9 grid gap-px border border-border bg-border sm:grid-cols-3">
                {[t('UI_DOCS_MARKETING'), t('UI_DESTINATIONS_SETUP'), t('UI_FIRST_SYNC')].map(
                  (label, index) => (
                    <li key={label} className="bg-card p-4">
                      <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground">
                        0{index + 1}
                      </span>
                      <p className="mt-2 text-[12px] leading-snug text-muted-foreground">{label}</p>
                    </li>
                  )
                )}
              </ol>
            </div>

            <div className="relative flex min-h-[280px] flex-col overflow-hidden border-t border-border bg-sidebar p-6 text-sidebar-foreground lg:border-l lg:border-t-0">
              <div aria-hidden="true" className="absolute inset-0" style={blueprintGrid} />
              <div className="relative flex items-center justify-between font-mono text-[9px] uppercase tracking-[0.16em] text-sidebar-foreground/40">
                <span>ROUTE / 000</span>
                <span>{t('UI_NOT_CONNECTED')}</span>
              </div>

              <div className="relative flex flex-1 items-center">
                <div className="flex w-full items-center gap-3">
                  <div className="border border-sidebar-border bg-white/[0.03] px-3 py-2 font-mono text-[10px] uppercase tracking-[0.12em]">
                    SOURCE
                  </div>
                  <div className="relative h-px flex-1 bg-sidebar-border">
                    <span className="absolute left-0 top-1/2 size-1.5 -translate-y-1/2 bg-primary" />
                    <span className="absolute right-0 top-1/2 size-1.5 -translate-y-1/2 border border-sidebar-border bg-sidebar" />
                  </div>
                  <div className="border border-sidebar-border bg-white/[0.03] px-3 py-2 font-mono text-[10px] uppercase tracking-[0.12em]">
                    DEST
                  </div>
                </div>
              </div>

              <div className="relative flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.16em] text-sidebar-foreground/35">
                <span className="size-1 bg-primary" aria-hidden="true" />
                {t('UI_CONNECT_FIRST')}
              </div>
            </div>
          </div>
        </section>
      ) : (
        <>
          <section className="mt-8 grid border border-border lg:grid-cols-[1.15fr_0.85fr]">
            <div className="relative overflow-hidden bg-sidebar p-6 text-sidebar-foreground sm:p-8">
              <div aria-hidden="true" className="absolute inset-0" style={blueprintGrid} />
              <div className="relative flex items-center justify-between font-mono text-[9px] uppercase tracking-[0.16em] text-sidebar-foreground/40">
                <span>{t('UI_SYNC_RATE')}</span>
                <span className="flex items-center gap-1.5">
                  <span className="size-1 bg-primary" aria-hidden="true" />
                  SIGNAL
                </span>
              </div>

              <div className="relative mt-8 flex items-end justify-between gap-4">
                <p className="text-6xl font-semibold tracking-[-0.06em] tabular-nums sm:text-7xl">
                  {syncRate}
                  <span className="ml-1 text-2xl font-normal text-sidebar-foreground/40">%</span>
                </p>
                <p className="pb-1 text-right font-mono text-[9px] uppercase leading-relaxed tracking-[0.14em] text-sidebar-foreground/35">
                  {t('UI_SYNC_RATE_META')}
                  <br />
                  <span className="text-sidebar-foreground/70">
                    {syncedCount} / {docCount}
                  </span>
                </p>
              </div>

              <div className="relative mt-6 h-1 bg-white/10" aria-hidden="true">
                <div
                  className="h-full bg-primary transition-[width] duration-500"
                  style={{ width: `${syncRate}%` }}
                />
              </div>
              <div className="relative mt-3 flex justify-between font-mono text-[9px] uppercase tracking-[0.14em] text-sidebar-foreground/30">
                <span>0</span>
                <span>
                  {syncedCount} / {docCount}
                </span>
                <span>100</span>
              </div>
            </div>

            <div className="divide-y divide-border">
              {metrics.map((stat) => (
                <Link
                  key={stat.label}
                  href={stat.href}
                  className="group flex items-center justify-between gap-4 px-5 py-5 transition-colors hover:bg-muted/40 sm:px-6"
                >
                  <div>
                    <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground">
                      {stat.label}
                    </p>
                    <p
                      className={`mt-2 text-3xl font-semibold tracking-[-0.04em] tabular-nums ${
                        stat.tone ?? ''
                      }`}
                    >
                      {stat.value}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground/60">
                    <stat.icon className="size-4" />
                    <ArrowUpRight className="size-3.5 opacity-0 transition-opacity group-hover:opacity-100" />
                  </div>
                </Link>
              ))}
            </div>
          </section>

          <div className="mt-10 grid gap-10 lg:grid-cols-[1.55fr_0.85fr]">
            <section>
              <div className="flex items-end justify-between gap-4 border-b border-border pb-3">
                <div>
                  <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground">
                    {t('UI_RUN_LOG_META')}
                  </p>
                  <h2 className="mt-1 text-lg font-semibold tracking-[-0.02em]">
                    {t('UI_RUN_LOG')}
                  </h2>
                </div>
                <Link
                  href="/dashboard/sync"
                  className="inline-flex items-center gap-1 whitespace-nowrap font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground transition-colors hover:text-foreground"
                >
                  {t('UI_VIEW_ALL')}
                  <ArrowUpRight className="size-3" />
                </Link>
              </div>

              {recentLogs.length === 0 ? (
                <div className="border-b border-border py-12 text-center">
                  <Clock className="mx-auto size-5 text-muted-foreground/50" />
                  <p className="mt-2 text-sm text-muted-foreground">{t('UI_NO_ACTIVITY')}</p>
                </div>
              ) : (
                <ul className="divide-y divide-border border-b border-border">
                  {recentLogs.map((log) => {
                    const isSuccess = log.status === 'SUCCESS'
                    const isError = log.status === 'ERROR'
                    return (
                      <li
                        key={log.id}
                        className="grid grid-cols-[auto_1fr_auto] items-center gap-3 py-3.5"
                      >
                        <span
                          className={`size-1.5 ${
                            isSuccess
                              ? 'bg-success'
                              : isError
                                ? 'bg-destructive'
                                : 'bg-muted-foreground/40'
                          }`}
                          aria-hidden="true"
                        />
                        <div className="min-w-0">
                          <p className="truncate text-[13px]">{log.message}</p>
                          {log.document?.title && (
                            <p className="truncate font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
                              {log.document.title}
                            </p>
                          )}
                        </div>
                        <span className="whitespace-nowrap font-mono text-[10px] tabular-nums text-muted-foreground">
                          {formatDate(log.createdAt, locale)}
                        </span>
                      </li>
                    )
                  })}
                </ul>
              )}
            </section>

            <aside>
              <div className="flex items-end justify-between gap-4 border-b border-border pb-3">
                <div>
                  <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground">
                    {t('UI_ROUTE_SETUP_META')}
                  </p>
                  <h2 className="mt-1 text-lg font-semibold tracking-[-0.02em]">
                    {t('UI_ROUTE_SETUP')}
                  </h2>
                </div>
                <span className="font-mono text-[10px] tabular-nums text-muted-foreground">
                  {doneSteps}/3
                </span>
              </div>

              <ol className="border-b border-border">
                {setupSteps.map((item, index) => (
                  <li
                    key={item.label}
                    className="flex items-center gap-3 border-t border-border py-4 first:border-t-0"
                  >
                    <span
                      className={`grid size-6 shrink-0 place-items-center border font-mono text-[10px] ${
                        item.done
                          ? 'border-success/30 bg-success-soft text-success'
                          : 'border-border bg-muted text-muted-foreground'
                      }`}
                    >
                      {item.done ? <CheckCircle2 className="size-3.5" /> : `0${index + 1}`}
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
            </aside>
          </div>
        </>
      )}
    </PageShell>
  )
}
