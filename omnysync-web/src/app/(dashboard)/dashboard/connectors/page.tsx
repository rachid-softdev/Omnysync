'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import dynamic from 'next/dynamic'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
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

  const handleBatchDisconnect = useCallback(() => {
    setConnectors((prev) => prev.filter((c) => !selectedIds.has(c.id)))
    toast.success(`${selectedCount} connector(s) disconnected`)
    clearSelection()
  }, [selectedIds, selectedCount, clearSelection])

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
        title={t('UI_CONNECTORS')}
        description={t('UI_MANAGE_CONNECTORS')}
        actions={
          <>
            <HelpTooltip text="Connectors link your content platforms (WordPress, Ghost, Webflow, etc.) to Omnysync. Add source connectors to pull content from, and destination connectors to push content to." />
            <Button variant="outline" size="sm" onClick={() => fetchConnectors()}>
              <RefreshCw />
              {t('UI_REFRESH')}
            </Button>
          </>
        }
      />

      {statusMsg && (
        <div className="mt-6 rounded-lg border border-success/30 bg-success-soft px-4 py-3 text-sm text-success">
          {statusMsg}
        </div>
      )}
      {errorMsg && (
        <div className="mt-6 rounded-lg border border-destructive/30 bg-destructive-soft px-4 py-3 text-sm text-destructive">
          {errorMsg}
        </div>
      )}

      {loading ? (
        <div className="flex min-h-[320px] items-center justify-center">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            {/* Sources catalog */}
            <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
              <div className="border-b border-border px-5 py-3.5">
                <h2 className="text-sm font-semibold">{t('UI_SOURCES')}</h2>
                <p className="mt-0.5 text-xs text-muted-foreground">{t('UI_SOURCES_DESC')}</p>
              </div>
              <ul className="divide-y divide-border">
                {[...sourceTypes].map((type) => {
                  const isConnected = connectedTypesSet.has(type)
                  return (
                    <li key={type} className="flex items-center gap-4 px-5 py-3.5">
                      <ConnectorIcon type={type} className="size-9 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] font-medium">{connectorNames[type]}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {connectorDescriptions[type]}
                        </p>
                      </div>
                      {isConnected && (
                        <Badge variant="success">
                          <span className="size-1.5 rounded-full bg-success" aria-hidden="true" />
                          {t('UI_ACTIVE')}
                        </Badge>
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
            </div>

            {/* Destinations catalog */}
            <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
              <div className="border-b border-border px-5 py-3.5">
                <h2 className="text-sm font-semibold">{t('UI_DESTINATIONS')}</h2>
                <p className="mt-0.5 text-xs text-muted-foreground">{t('UI_DESTINATIONS_DESC')}</p>
              </div>
              <ul className="divide-y divide-border">
                {[...destTypes].map((type) => {
                  const isConnected = connectedTypesSet.has(type)
                  return (
                    <li key={type} className="flex items-center gap-4 px-5 py-3.5">
                      <ConnectorIcon type={type} className="size-9 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] font-medium">{connectorNames[type]}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {connectorDescriptions[type]}
                        </p>
                      </div>
                      {isConnected && (
                        <Badge variant="success">
                          <span className="size-1.5 rounded-full bg-success" aria-hidden="true" />
                          {t('UI_ACTIVE')}
                        </Badge>
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
            </div>
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
                      onClick: handleBatchDisconnect,
                    },
                  ]}
                />
              )}

              <div className="flex items-baseline justify-between gap-3">
                <h2 className="text-sm font-semibold">{t('UI_MY_CONNECTORS')}</h2>
                <p className="text-xs text-muted-foreground">
                  {connectors.length} {connectors.length === 1 ? 'connector' : 'connectors'}
                </p>
              </div>

              <div className="mt-3 overflow-hidden rounded-xl border border-border bg-card shadow-sm">
                <Table>
                  <TableHeader className="bg-muted/50">
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="w-10 pr-0">
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
                      <TableHead>Connector</TableHead>
                      <TableHead className="hidden sm:table-cell">Type</TableHead>
                      <TableHead className="text-right">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {connectors.map((connector) => (
                      <TableRow key={connector.id}>
                        <TableCell className="pr-0">
                          <Checkbox
                            checked={selectedIds.has(connector.id)}
                            onCheckedChange={() => toggle(connector.id)}
                            aria-label={`Select ${connector.name}`}
                          />
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <ConnectorIcon type={connector.type} className="size-8 shrink-0" />
                            <p className="max-w-[20rem] truncate text-[13px] font-medium">
                              {connector.name}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell className="hidden text-[13px] text-muted-foreground sm:table-cell">
                          {connectorNames[connector.type]}
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge
                            variant={connector.status === 'ACTIVE' ? 'success' : 'destructive'}
                          >
                            {connector.status === 'ACTIVE' && (
                              <span
                                className="size-1.5 rounded-full bg-success"
                                aria-hidden="true"
                              />
                            )}
                            {connector.status === 'ACTIVE' ? 'Active' : 'Inactive'}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
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
    </PageShell>
  )
}
