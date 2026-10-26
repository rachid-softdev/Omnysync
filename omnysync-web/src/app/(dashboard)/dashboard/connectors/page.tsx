'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import dynamic from 'next/dynamic'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { PageHeader, PageShell } from '@/components/page-header'
import { RefreshCw, Loader2, XCircle } from 'lucide-react'
import { ConnectorIcon } from '@/components/connector-icon'
import { HelpTooltip } from '@/components/help-tooltip'
import { useTranslations } from '@/lib/i18n/useTranslations'
import { useBatchSelect } from '@/hooks/use-batch-select'
import { BatchActionBar } from '@/components/batch-action-bar'
import { toast } from '@/components/toast-provider'

const ConnectorDialog = dynamic(
  () => import('@/components/connector-dialog').then((mod) => ({ default: mod.ConnectorDialog })),
  { ssr: false, loading: () => <div className="p-4">Loading...</div> }
)

interface Connector {
  id: string
  type: string
  name: string
  status: string
}

const sourceTypes = ['GOOGLE_DOCS', 'NOTION', 'AIRTABLE', 'CONTENTFUL'] as const
const destTypes = ['WORDPRESS', 'GHOST', 'WEBFLOW', 'SHOPIFY', 'MEDIUM'] as const

const connectorNames: Record<string, string> = {
  GOOGLE_DOCS: 'Google Docs',
  NOTION: 'Notion',
  WORDPRESS: 'WordPress',
  GHOST: 'Ghost',
  WEBFLOW: 'Webflow',
  SHOPIFY: 'Shopify',
  AIRTABLE: 'Airtable',
  CONTENTFUL: 'Contentful',
  MEDIUM: 'Medium',
}

const connectorDescriptions: Record<string, string> = {
  GOOGLE_DOCS: 'Retrieve content from Google Docs',
  NOTION: 'Import your Notion pages',
  WORDPRESS: 'Publish to WordPress via REST API',
  GHOST: 'Export to Ghost via Admin API',
  WEBFLOW: 'Sync to Webflow CMS',
  SHOPIFY: 'Create Shopify articles',
  AIRTABLE: 'Sync your Airtable bases',
  CONTENTFUL: 'Publish to Contentful',
  MEDIUM: 'Publish to Medium',
}

export default function ConnectorsPage() {
  const { t } = useTranslations()
  const [connectors, setConnectors] = useState<Connector[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogType, setDialogType] = useState<string | null>(null)
  const [statusMsg, setStatusMsg] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [pendingDisconnect, setPendingDisconnect] = useState<string[]>([])
  const [disconnecting, setDisconnecting] = useState(false)

  const fetchConnectors = useCallback(async (signal?: AbortSignal) => {
    try {
      const res = await fetch('/api/connectors', { signal })
      if (res.ok) {
        const data = await res.json()
        setConnectors(data)
      }
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    fetchConnectors(controller.signal)

    // Check for callback params
    const params = new URLSearchParams(window.location.search)
    if (params.get('connected') === 'google_docs') {
      setStatusMsg(t('UI_CONNECTED_GOOGLE_DOCS'))
      setTimeout(() => setStatusMsg(''), 5000)
      window.history.replaceState({}, '', '/dashboard/connectors')
    } else if (params.get('connected') === 'notion') {
      setStatusMsg(t('UI_CONNECTED_NOTION'))
      setTimeout(() => setStatusMsg(''), 5000)
      window.history.replaceState({}, '', '/dashboard/connectors')
    } else if (params.get('error')) {
      setStatusMsg(t('UI_CONNECTION_ERROR'))
      setTimeout(() => setStatusMsg(''), 5000)
      window.history.replaceState({}, '', '/dashboard/connectors')
    }

    return () => controller.abort()
  }, [fetchConnectors])

  const connectedTypesSet = useMemo(() => new Set(connectors.map((c) => c.type)), [connectors])

  const { selectedIds, selectedCount, isAllSelected, toggle, selectAll, clearSelection } =
    useBatchSelect(connectors)

  const handleDisconnect = useCallback(async () => {
    if (pendingDisconnect.length === 0) return

    setDisconnecting(true)

    const results = await Promise.all(
      pendingDisconnect.map(async (id) => {
        try {
          const res = await fetch(`/api/connectors/${id}`, { method: 'DELETE' })
          const data = await res.json().catch(() => ({}))
          return {
            id,
            ok: res.ok,
            error: typeof data?.error === 'string' ? data.error : 'Disconnect failed',
          }
        } catch {
          return { id, ok: false, error: 'Network error' }
        }
      })
    )

    const removedIds = results.filter((result) => result.ok).map((result) => result.id)
    const failures = results.filter((result) => !result.ok)

    if (removedIds.length > 0) {
      setConnectors((prev) => prev.filter((connector) => !removedIds.includes(connector.id)))
    }

    if (failures.length === 0) {
      toast.success(
        removedIds.length === 1
          ? 'Connector disconnected'
          : `${removedIds.length} connectors disconnected`
      )
      clearSelection()
    } else if (removedIds.length > 0) {
      toast.warning(
        `${removedIds.length} disconnected, ${failures.length} could not be disconnected: ${failures
          .map((failure) => failure.error)
          .join('; ')}`
      )
      clearSelection()
    } else {
      toast.error(failures.map((failure) => failure.error).join('; '))
    }

    setDisconnecting(false)
    setPendingDisconnect([])
  }, [pendingDisconnect, clearSelection])

  const handleConnect = useCallback((type: string) => {
    try {
      if (type === 'GOOGLE_DOCS') {
        window.location.href = '/api/auth/connect/google'
      } else if (type === 'NOTION') {
        window.location.href = '/api/auth/connect/notion'
      } else {
        setDialogType(type)
      }
    } catch (err) {
      setErrorMsg('Failed to initiate connection. Please try again.')
      setTimeout(() => setErrorMsg(''), 5000)
    }
  }, [])

  return (
    <PageShell>
      <PageHeader
        eyebrow={`${t('UI_CONNECTORS_INDEX')} / ${String(connectors.length).padStart(2, '0')}`}
        title={t('UI_CONNECTORS')}
        description={t('UI_MANAGE_CONNECTORS')}
        actions={
          <>
            <HelpTooltip
              side="left"
              text="Connectors link your content platforms (WordPress, Ghost, Webflow, etc.) to Omnysync. Add source connectors to pull content from, and destination connectors to push content to."
            />
            <Button variant="outline" size="sm" onClick={() => fetchConnectors()}>
              <RefreshCw />
              {t('UI_REFRESH')}
            </Button>
          </>
        }
      />

      {statusMsg && (
        <div className="mt-6 border border-success/30 bg-success-soft px-4 py-3 text-sm text-success">
          {statusMsg}
        </div>
      )}
      {errorMsg && (
        <div className="mt-6 border border-destructive/30 bg-destructive-soft px-4 py-3 text-sm text-destructive">
          {errorMsg}
        </div>
      )}

      {loading ? (
        <div className="mt-6 flex min-h-[320px] items-center justify-center border border-border bg-card">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            {/* Sources catalog */}
            <section className="min-w-0 border border-border bg-card">
              <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3 sm:px-5">
                <div className="min-w-0">
                  <h2 className="text-sm font-semibold">{t('UI_SOURCES')}</h2>
                  <p className="mt-0.5 text-xs text-muted-foreground">{t('UI_SOURCES_DESC')}</p>
                </div>
                <span className="font-mono text-[10px] tabular-nums text-muted-foreground">
                  {String(sourceTypes.length).padStart(2, '0')}
                </span>
              </div>
              <ul className="divide-y divide-border">
                {[...sourceTypes].map((type, index) => {
                  const isConnected = connectedTypesSet.has(type)
                  return (
                    <li key={type} className="flex items-center gap-3 px-4 py-3.5 sm:px-5">
                      <span className="hidden w-4 font-mono text-[9px] tabular-nums text-muted-foreground/50 sm:block">
                        {String(index + 1).padStart(2, '0')}
                      </span>
                      <ConnectorIcon type={type} className="size-8 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] font-medium">{connectorNames[type]}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {connectorDescriptions[type]}
                        </p>
                      </div>
                      {isConnected && (
                        <span className="hidden items-center gap-1.5 whitespace-nowrap font-mono text-[9px] uppercase tracking-[0.12em] text-success sm:flex">
                          <span className="size-1.5 bg-success" aria-hidden="true" />
                          {t('UI_ACTIVE')}
                        </span>
                      )}
                      <Button
                        variant={isConnected ? 'outline' : 'default'}
                        size="sm"
                        onClick={() => handleConnect(type)}
                      >
                        {isConnected ? t('UI_CONNECTED') : t('UI_CONNECT')}
                      </Button>
                    </li>
                  )
                })}
              </ul>
            </section>

            {/* Destinations catalog */}
            <section className="min-w-0 border border-border bg-card">
              <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3 sm:px-5">
                <div className="min-w-0">
                  <h2 className="text-sm font-semibold">{t('UI_DESTINATIONS')}</h2>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {t('UI_DESTINATIONS_DESC')}
                  </p>
                </div>
                <span className="font-mono text-[10px] tabular-nums text-muted-foreground">
                  {String(destTypes.length).padStart(2, '0')}
                </span>
              </div>
              <ul className="divide-y divide-border">
                {[...destTypes].map((type, index) => {
                  const isConnected = connectedTypesSet.has(type)
                  return (
                    <li key={type} className="flex items-center gap-3 px-4 py-3.5 sm:px-5">
                      <span className="hidden w-4 font-mono text-[9px] tabular-nums text-muted-foreground/50 sm:block">
                        {String(index + 1).padStart(2, '0')}
                      </span>
                      <ConnectorIcon type={type} className="size-8 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] font-medium">{connectorNames[type]}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {connectorDescriptions[type]}
                        </p>
                      </div>
                      {isConnected && (
                        <span className="hidden items-center gap-1.5 whitespace-nowrap font-mono text-[9px] uppercase tracking-[0.12em] text-success sm:flex">
                          <span className="size-1.5 bg-success" aria-hidden="true" />
                          {t('UI_ACTIVE')}
                        </span>
                      )}
                      <Button
                        variant={isConnected ? 'outline' : 'default'}
                        size="sm"
                        onClick={() => handleConnect(type)}
                      >
                        {isConnected ? t('UI_CONFIGURED') : t('UI_CONFIGURE')}
                      </Button>
                    </li>
                  )
                })}
              </ul>
            </section>
          </div>

          {/* Already configured connectors */}
          {connectors.length > 0 && (
            <div className="relative mt-8">
              {selectedCount > 0 && (
                <BatchActionBar
                  selectedCount={selectedCount}
                  isAllSelected={isAllSelected}
                  onSelectAll={selectAll}
                  onClearSelection={clearSelection}
                  actions={[
                    {
                      label: 'Disconnect',
                      icon: <XCircle className="size-4" />,
                      variant: 'destructive',
                      onClick: () => setPendingDisconnect([...selectedIds]),
                    },
                  ]}
                />
              )}

              <div className="flex items-end justify-between gap-3 border-b border-border pb-3">
                <h2 className="text-lg font-semibold tracking-[-0.02em]">
                  {t('UI_MY_CONNECTORS')}
                </h2>
                <span className="font-mono text-[10px] tabular-nums text-muted-foreground">
                  {String(connectors.length).padStart(2, '0')}
                </span>
              </div>

              <div className="mt-3 border border-border bg-card">
                <Table>
                  <TableHeader className="bg-muted/40">
                    <TableRow className="border-border hover:bg-transparent">
                      <TableHead className="h-9 w-10 px-2 pr-0 sm:px-4">
                        <Checkbox
                          id="select-all-connectors"
                          aria-label="Select all connectors"
                          checked={isAllSelected}
                          onCheckedChange={(checked) => {
                            if (checked) selectAll()
                            else clearSelection()
                          }}
                        />
                      </TableHead>
                      <TableHead className="h-9 px-2 font-mono text-[9px] uppercase tracking-[0.14em] sm:px-4">
                        {t('UI_CONNECTOR')}
                      </TableHead>
                      <TableHead className="hidden h-9 px-4 font-mono text-[9px] uppercase tracking-[0.14em] sm:table-cell">
                        {t('UI_TYPE')}
                      </TableHead>
                      <TableHead className="h-9 px-2 text-right font-mono text-[9px] uppercase tracking-[0.14em] sm:px-4">
                        {t('UI_STATUS')}
                      </TableHead>
                      <TableHead className="h-9 w-10 px-2 text-right font-mono text-[9px] uppercase tracking-[0.14em] sm:px-4">
                        <span className="sr-only">Actions</span>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {connectors.map((connector) => (
                      <TableRow
                        key={connector.id}
                        className="group border-border hover:bg-muted/30"
                      >
                        <TableCell className="px-2 pr-0 sm:px-4">
                          <Checkbox
                            checked={selectedIds.has(connector.id)}
                            onCheckedChange={() => toggle(connector.id)}
                            aria-label={`Select ${connector.name}`}
                          />
                        </TableCell>
                        <TableCell className="px-2 py-2.5 sm:px-4">
                          <div className="flex items-center gap-3">
                            <ConnectorIcon type={connector.type} className="size-8 shrink-0" />
                            <div className="min-w-0">
                              <p className="max-w-[12rem] truncate text-[13px] font-medium sm:max-w-[20rem]">
                                {connector.name}
                              </p>
                              <p className="mt-0.5 font-mono text-[9px] uppercase tracking-[0.1em] text-muted-foreground/60">
                                CON / {connector.id.slice(0, 8)}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="hidden px-4 font-mono text-[10px] uppercase tracking-[0.06em] text-muted-foreground sm:table-cell">
                          {connectorNames[connector.type]}
                        </TableCell>
                        <TableCell className="px-2 text-right sm:px-4">
                          <span
                            className={`inline-flex items-center gap-1.5 whitespace-nowrap font-mono text-[9px] uppercase tracking-[0.12em] ${
                              connector.status === 'ACTIVE'
                                ? 'text-success'
                                : 'text-muted-foreground'
                            }`}
                          >
                            <span
                              className={`size-1.5 ${
                                connector.status === 'ACTIVE'
                                  ? 'bg-success'
                                  : 'border border-border-strong'
                              }`}
                              aria-hidden="true"
                            />
                            {connector.status === 'ACTIVE' ? t('UI_ACTIVE') : t('UI_INACTIVE')}
                          </span>
                        </TableCell>
                        <TableCell className="px-2 text-right sm:px-4">
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Disconnect ${connector.name}`}
                            title="Disconnect"
                            onClick={() => setPendingDisconnect([connector.id])}
                          >
                            <XCircle className="size-4 text-destructive" aria-hidden="true" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <div className="flex items-center justify-between border-t border-border bg-muted/20 px-4 py-2.5 font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground">
                  <span>
                    {connectors.length} {t('UI_CONNECTOR').toLowerCase()}
                    {connectors.length === 1 ? '' : 's'}
                  </span>
                  <span>{t('UI_ACTIVE')}</span>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      <ConnectorDialog
        type={dialogType || ''}
        open={!!dialogType}
        onClose={() => setDialogType(null)}
        onSuccess={fetchConnectors}
      />

      <AlertDialog
        open={pendingDisconnect.length > 0}
        onOpenChange={(open) => {
          if (!open && !disconnecting) setPendingDisconnect([])
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingDisconnect.length === 1
                ? 'Disconnect this connector?'
                : `Disconnect ${pendingDisconnect.length} connectors?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              This removes the connection from Omnysync. Content already published on the
              destination is not deleted. Connectors linked to documents cannot be disconnected
              until those documents are removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={disconnecting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault()
                void handleDisconnect()
              }}
              disabled={disconnecting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {disconnecting && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
              Disconnect
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageShell>
  )
}
