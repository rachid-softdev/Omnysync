'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import dynamic from 'next/dynamic'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { RefreshCw, Loader2 } from 'lucide-react'
import { ConnectorIcon } from '@/components/connector-icon'
import { useTranslations } from '@/lib/i18n/useTranslations'

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

  const handleConnect = useCallback((type: string) => {
    if (type === 'GOOGLE_DOCS') {
      window.location.href = '/api/auth/connect/google'
    } else if (type === 'NOTION') {
      window.location.href = '/api/auth/connect/notion'
    } else {
      setDialogType(type)
    }
  }, [])

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">{t('UI_CONNECTORS')}</h1>
          <p className="text-muted-foreground mt-1">{t('UI_MANAGE_CONNECTORS')}</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => fetchConnectors()}>
          <RefreshCw className="w-4 h-4 mr-2" />
          {t('UI_REFRESH')}
        </Button>
      </div>

      {statusMsg && (
        <div className="mb-6 p-4 bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/30 rounded-lg text-sm">
          {statusMsg}
        </div>
      )}

      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4">{t('UI_SOURCES')}</h2>
        <p className="text-sm text-muted-foreground mb-4">
           {t('UI_SOURCES_DESC')}
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...sourceTypes].map((type) => {
            const isConnected = connectedTypesSet.has(type)
            return (
              <Card key={type} className="hover:shadow-md transition-shadow">
                <CardContent className="flex flex-col items-center text-center p-6">
                  <ConnectorIcon type={type} className="w-14 h-14 mb-3" />
                  <p className="font-semibold">{connectorNames[type]}</p>
                  <p className="text-xs text-muted-foreground mt-1 mb-4">
                    {connectorDescriptions[type]}
                  </p>
                  <Button
                    variant={isConnected ? 'outline' : 'default'}
                    size="sm"
                    onClick={() => handleConnect(type)}
                    className="w-full"
                  >
                    {isConnected ? t('UI_CONNECTED') : t('UI_CONNECT')}
                  </Button>
                  {isConnected && (
                    <Badge variant="secondary" className="mt-2">
                      {t('UI_ACTIVE')}
                    </Badge>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>

      <div>
        <h2 className="text-xl font-semibold mb-4">{t('UI_DESTINATIONS')}</h2>
        <p className="text-sm text-muted-foreground mb-4">
           {t('UI_DESTINATIONS_DESC')}
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          {[...destTypes].map((type) => {
            const isConnected = connectedTypesSet.has(type)
            return (
              <Card key={type} className="hover:shadow-md transition-shadow">
                <CardContent className="flex flex-col items-center text-center p-6">
                  <ConnectorIcon type={type} className="w-14 h-14 mb-3" />
                  <p className="font-semibold">{connectorNames[type]}</p>
                  <p className="text-xs text-muted-foreground mt-1 mb-4">
                    {connectorDescriptions[type]}
                  </p>
                  <Button
                    variant={isConnected ? 'outline' : 'default'}
                    size="sm"
                    onClick={() => handleConnect(type)}
                    className="w-full"
                  >
                    {isConnected ? t('UI_CONFIGURED') : t('UI_CONFIGURE')}
                  </Button>
                  {isConnected && (
                    <Badge variant="secondary" className="mt-2">
                      {t('UI_ACTIVE')}
                    </Badge>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>

      {/* Already configured connectors */}
      {connectors.length > 0 && (
        <div className="mt-8">
          <h2 className="text-xl font-semibold mb-4">{t('UI_MY_CONNECTORS')}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {connectors.map((connector) => (
              <Card key={connector.id}>
                <CardContent className="flex items-center gap-4 p-4">
                  <ConnectorIcon type={connector.type} className="w-10 h-10" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{connector.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {connectorNames[connector.type]}
                    </p>
                  </div>
                  <Badge
                    variant={connector.status === 'ACTIVE' ? 'default' : 'destructive'}
                    className="capitalize"
                  >
                    {connector.status.toLowerCase()}
                  </Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      <ConnectorDialog
        type={dialogType || ''}
        open={!!dialogType}
        onClose={() => setDialogType(null)}
        onSuccess={fetchConnectors}
      />
    </div>
  )
}
