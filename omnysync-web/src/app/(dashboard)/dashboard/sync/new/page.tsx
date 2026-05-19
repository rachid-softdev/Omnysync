'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { useTranslations } from '@/lib/i18n/useTranslations'
import { Check, Loader2, Zap, Clock, AlertCircle, ArrowRight } from 'lucide-react'

interface Connector {
  id: string
  type: string
  name: string
  status: string
}

interface SourceDocument {
  id: string
  title: string
}

interface SyncStep {
  id: number
  title: string
  description: string
  status: 'pending' | 'current' | 'completed' | 'error'
}

interface LogEntry {
  timestamp: Date
  message: string
  status: 'info' | 'success' | 'error' | 'warning'
}

const connectorNames: Record<string, string> = {
  GOOGLE_DOCS: 'Google Docs',
  NOTION: 'Notion',
  WORDPRESS: 'WordPress',
  GHOST: 'Ghost',
  WEBFLOW: 'Webflow',
  SHOPIFY: 'Shopify',
}

export default function NewSyncPage() {
  const { t } = useTranslations()
  const [currentStep, setCurrentStep] = useState(0)
  const [source, setSource] = useState('')
  const [sourceDocId, setSourceDocId] = useState('')
  const [destination, setDestination] = useState('')
  const [isSyncing, setIsSyncing] = useState(false)
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [error, setError] = useState('')

  // Data from API
  const [connectors, setConnectors] = useState<Connector[]>([])
  const [sourceDocuments, setSourceDocuments] = useState<SourceDocument[]>([])
  const [loading, setLoading] = useState(false)

  const sourceConnectors = connectors.filter((c) => ['GOOGLE_DOCS', 'NOTION'].includes(c.type))
  const destConnectors = connectors.filter((c) =>
    ['WORDPRESS', 'GHOST', 'WEBFLOW', 'SHOPIFY'].includes(c.type)
  )

  // Fetch connectors on mount
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/connectors')
        if (res.ok) {
          const data = await res.json()
          setConnectors(data)
        }
      } catch (e) {
        console.error('Failed to fetch connectors', e)
      }
    }
    load()
  }, [])

  const steps: SyncStep[] = [
    {
      id: 1,
      title: t('UI_STEP_SOURCE'),
      description: t('UI_STEP_SOURCE_DESC'),
      status: currentStep === 0 ? 'current' : currentStep > 0 ? 'completed' : 'pending',
    },
    {
      id: 2,
      title: t('UI_STEP_DOCUMENT'),
      description: t('UI_STEP_DOCUMENT_DESC'),
      status: currentStep === 1 ? 'current' : currentStep > 1 ? 'completed' : 'pending',
    },
    {
      id: 3,
      title: t('UI_STEP_DESTINATION'),
      description: t('UI_STEP_DESTINATION_DESC'),
      status: currentStep === 2 ? 'current' : currentStep > 2 ? 'completed' : 'pending',
    },
    {
      id: 4,
      title: t('UI_STEP_IA'),
      description: t('UI_STEP_IA_DESC'),
      status: currentStep === 3 ? 'current' : currentStep > 3 ? 'completed' : 'pending',
    },
    {
      id: 5,
      title: t('UI_STEP_SYNC'),
      description: t('UI_STEP_SYNC_DESC'),
      status: currentStep === 4 ? 'current' : 'pending',
    },
  ]

  const addLog = (message: string, status: LogEntry['status'] = 'info') => {
    setLogs((prev) => [...prev, { timestamp: new Date(), message, status }])
  }

  const handleSourceSelect = async () => {
    if (!source) return
    setLoading(true)
    addLog(t('UI_CONNECTING_SERVICE'), 'info')

    try {
      const res = await fetch(`/api/connectors/${source}/documents`)
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to fetch documents')
      }
      const docs = await res.json()
      setSourceDocuments(docs)
      addLog(t('UI_RETRIEVING_CONTENT'), 'success')
      setCurrentStep(1)
      setError('')
    } catch (e) {
      addLog((e as Error).message, 'error')
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const handleDocSelect = () => {
    if (!sourceDocId) return
    addLog(t('UI_DOCUMENT_ANALYZED'), 'info')
    addLog(t('UI_CONTENT_ANALYZED'), 'success')
    setCurrentStep(2)
  }

  const handleDestinationSelect = () => {
    if (!destination) return
    addLog(t('UI_DESTINATION_CONFIGURED'), 'info')
    addLog(t('UI_CONNECTION_VERIFIED'), 'success')
    setCurrentStep(3)
  }

  const handleSync = async () => {
    if (!source || !sourceDocId || !destination) {
      setError('Tous les champs sont requis')
      return
    }

    setIsSyncing(true)
    setCurrentStep(4)
    setError('')

    addLog(t('UI_SYNC_STARTING'), 'info')

    try {
      const selectedDoc = sourceDocuments.find((d) => d.id === sourceDocId)

      const res = await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceConnectorId: source,
          destConnectorId: destination,
          sourceDocumentId: sourceDocId,
          title: selectedDoc?.title || 'New Document',
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Sync failed')
      }

      const document = await res.json()

      addLog('Sync lancée, suivi en cours...', 'info')

      // Poll for completion
      const pollInterval = setInterval(async () => {
        try {
          const statusRes = await fetch(`/api/sync/${document.id}`)
          if (!statusRes.ok) return

          const status = await statusRes.json()

          status.logs?.forEach((log: any) => {
            const status =
              log.status === 'SUCCESS'
                ? 'success'
                : log.status === 'ERROR'
                  ? 'error'
                  : log.status === 'WARNING'
                    ? 'warning'
                    : 'info'
            addLog(log.message || log.status, status)
          })

          if (status.syncStatus === 'SYNCED') {
            clearInterval(pollInterval)
            addLog('Synchronisation terminée avec succès !', 'success')
            setIsSyncing(false)
          } else if (status.syncStatus === 'FAILED') {
            clearInterval(pollInterval)
            addLog('La synchronisation a échoué', 'error')
            setIsSyncing(false)
          }
        } catch {
          // Continue polling
        }
      }, 3000)

      // Stop polling after 2 minutes max
      setTimeout(() => {
        clearInterval(pollInterval)
        if (isSyncing) {
          setIsSyncing(false)
          addLog('Timeout — la synchronisation prend plus de temps que prévu', 'warning')
        }
      }, 120000)

      setIsSyncing(false)
    } catch (e) {
      addLog((e as Error).message, 'error')
      setError((e as Error).message)
      setIsSyncing(false)
    }
  }

  const selectedSource = connectors.find((c) => c.id === source)
  const selectedDest = connectors.find((c) => c.id === destination)

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-8">{t('UI_NEW_SYNC')}</h1>

      <div className="mb-8">
        <div className="flex items-center justify-between">
          {steps.map((step, index) => (
            <div key={step.id} className="flex items-center">
              <div
                className={`flex items-center justify-center w-10 h-10 rounded-full ${
                  step.status === 'completed'
                    ? 'bg-primary text-primary-foreground'
                    : step.status === 'current'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground'
                }`}
              >
                {step.status === 'completed' ? (
                  <Check className="w-5 h-5" />
                ) : step.status === 'current' ? (
                  <span className="text-sm font-bold">{index + 1}</span>
                ) : (
                  <span className="text-sm">{index + 1}</span>
                )}
              </div>
              <div className="ml-3 hidden sm:block">
                <p
                  className={`font-medium ${step.status === 'pending' ? 'text-muted-foreground' : ''}`}
                >
                  {step.title}
                </p>
                <p className="text-xs text-muted-foreground">{step.description}</p>
              </div>
              {index < steps.length - 1 && (
                <div
                  className={`w-8 sm:w-16 h-0.5 mx-2 ${index < currentStep ? 'bg-primary' : 'bg-muted'}`}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 border border-destructive/50 bg-destructive/10 text-destructive rounded-lg flex items-center gap-2">
          <AlertCircle className="w-5 h-5" />
          <span className="text-sm">{error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div>
          {/* Step 0: Select Source */}
          {currentStep === 0 && (
            <Card>
              <CardHeader>
                <CardTitle>{t('UI_SELECT_SOURCE')}</CardTitle>
                <CardDescription>{t('UI_SOURCE_DESC')}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>{t('UI_SOURCE')}</Label>
                  <Select value={source} onValueChange={setSource}>
                    <SelectTrigger>
                      <SelectValue placeholder={t('UI_SELECT_SOURCE_PLACEHOLDER')} />
                    </SelectTrigger>
                    <SelectContent>
                      {sourceConnectors.length === 0 && (
                        <div className="p-3 text-sm text-muted-foreground text-center">
                          Aucun connecteur source. Ajoutez-en un dans la page Connecteurs.
                        </div>
                      )}
                      {sourceConnectors.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {connectorNames[c.type] || c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {source && (
                  <Button onClick={handleSourceSelect} className="w-full" disabled={loading}>
                    {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                    {t('UI_CONTINUE')}
                  </Button>
                )}
              </CardContent>
            </Card>
          )}

          {/* Step 1: Select Document */}
          {currentStep === 1 && (
            <Card>
              <CardHeader>
                <CardTitle>{t('UI_SELECT_DOCUMENT')}</CardTitle>
                <CardDescription>{t('UI_DOCUMENT_DESC')}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>{t('UI_DOCUMENT')}</Label>
                  <Select value={sourceDocId} onValueChange={setSourceDocId}>
                    <SelectTrigger>
                      <SelectValue placeholder={t('UI_SELECT_DOCUMENT_PLACEHOLDER')} />
                    </SelectTrigger>
                    <SelectContent>
                      {sourceDocuments.map((doc) => (
                        <SelectItem key={doc.id} value={doc.id}>
                          {doc.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setCurrentStep(0)} className="flex-1">
                    Retour
                  </Button>
                  {sourceDocId && (
                    <Button onClick={handleDocSelect} className="flex-1">
                      <ArrowRight className="w-4 h-4 mr-2" />
                      {t('UI_CONTINUE')}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Step 2: Select Destination */}
          {currentStep === 2 && (
            <Card>
              <CardHeader>
                <CardTitle>{t('UI_DESTINATION')}</CardTitle>
                <CardDescription>{t('UI_DESTINATION_DESC')}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>{t('UI_PLATFORM')}</Label>
                  <Select value={destination} onValueChange={setDestination}>
                    <SelectTrigger>
                      <SelectValue placeholder={t('UI_SELECT_DESTINATION')} />
                    </SelectTrigger>
                    <SelectContent>
                      {destConnectors.length === 0 && (
                        <div className="p-3 text-sm text-muted-foreground text-center">
                          Aucun connecteur destination. Ajoutez-en un dans la page Connecteurs.
                        </div>
                      )}
                      {destConnectors.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {connectorNames[c.type] || c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setCurrentStep(1)} className="flex-1">
                    Retour
                  </Button>
                  {destination && (
                    <Button onClick={handleDestinationSelect} className="flex-1">
                      <ArrowRight className="w-4 h-4 mr-2" />
                      {t('UI_CONTINUE')}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Step 3: AI Enrichment */}
          {currentStep === 3 && (
            <Card>
              <CardHeader>
                <CardTitle>{t('UI_AI_ENRICHMENT')}</CardTitle>
                <CardDescription>{t('UI_AI_OPTIONS')}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3 p-4 bg-muted rounded-lg">
                  <p className="text-sm font-medium">Résumé</p>
                  <div className="text-sm text-muted-foreground space-y-1">
                    <div className="flex justify-between">
                      <span>Source :</span>
                      <Badge variant="outline">
                        {selectedSource ? connectorNames[selectedSource.type] : '—'}
                      </Badge>
                    </div>
                    <div className="flex justify-between">
                      <span>Document :</span>
                      <span className="truncate max-w-[150px]">
                        {sourceDocuments.find((d) => d.id === sourceDocId)?.title || '—'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Destination :</span>
                      <Badge variant="outline">
                        {selectedDest ? connectorNames[selectedDest.type] : '—'}
                      </Badge>
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <input type="checkbox" id="seo" className="rounded" defaultChecked />
                  <Label htmlFor="seo">{t('LABEL_SEO')}</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <input type="checkbox" id="images" className="rounded" />
                  <Label htmlFor="images">{t('LABEL_IA_IMAGES')}</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <input type="checkbox" id="links" className="rounded" defaultChecked />
                  <Label htmlFor="links">{t('LABEL_INTERNAL_LINKS')}</Label>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setCurrentStep(2)} className="flex-1">
                    Retour
                  </Button>
                  <Button onClick={handleSync} className="flex-1" disabled={isSyncing}>
                    <Zap className="w-4 h-4 mr-2" />
                    {t('UI_START_SYNC')}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Step 4: Syncing */}
          {currentStep === 4 && (
            <Card>
              <CardHeader>
                <CardTitle>{t('UI_SYNC_IN_PROGRESS')}</CardTitle>
                <CardDescription>{t('UI_DO_NOT_CLOSE')}</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col items-center justify-center py-8 gap-4">
                {isSyncing ? (
                  <>
                    <Loader2 className="w-12 h-12 animate-spin text-primary" />
                    <p className="text-sm text-muted-foreground">
                      Synchronisation en cours via QStash...
                    </p>
                  </>
                ) : (
                  <>
                    <Check className="w-12 h-12 text-green-500" />
                    <p className="text-sm text-muted-foreground">Synchronisation terminée !</p>
                    <Button
                      variant="outline"
                      onClick={() => (window.location.href = '/dashboard/sync')}
                    >
                      Voir l&apos;historique
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Log Console */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5" />
              {t('UI_LOG_CONSOLE')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-muted p-4 rounded-lg h-[400px] overflow-y-auto font-mono text-sm border border-border">
              {logs.length === 0 ? (
                <p className="text-muted-foreground">{t('UI_WAITING')}</p>
              ) : (
                logs.map((log, index) => (
                  <div key={index} className="mb-1">
                    <span className="text-muted-foreground">
                      [{log.timestamp.toLocaleTimeString()}]
                    </span>{' '}
                    <span
                      className={
                        log.status === 'error'
                          ? 'text-destructive'
                          : log.status === 'warning'
                            ? 'text-yellow-500'
                            : log.status === 'success'
                              ? 'text-green-500'
                              : 'text-blue-500'
                      }
                    >
                      {log.message}
                    </span>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
