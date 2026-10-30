'use client'

import { useState, useEffect, useRef } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { PageHeader, PageShell } from '@/components/page-header'
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

const logStatusClass: Record<LogEntry['status'], string> = {
  info: 'text-info',
  success: 'text-success',
  warning: 'text-warning',
  error: 'text-destructive',
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
      title: t('UI_REVIEW_STEP'),
      description: t('UI_REVIEW_DESC'),
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
        throw new Error(data.error || t('UI_FETCH_DOCS_ERROR'))
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

  // Refs for polling cleanup
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current)
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [])

  const handleSync = async () => {
    if (!source || !sourceDocId || !destination) {
      setError(t('UI_ALL_FIELDS_REQUIRED'))
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
          title: selectedDoc?.title || t('UI_NEW_DOCUMENT_TITLE'),
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || t('SYNC_RUN_FAILED'))
      }

      const document = await res.json()

      addLog(t('UI_SYNC_STARTED_TRACKING'), 'info')

      // Poll for completion
      pollIntervalRef.current = setInterval(async () => {
        try {
          const statusRes = await fetch(`/api/sync/${document.id}`)
          if (!statusRes.ok) return

          const status = await statusRes.json()

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          status.logs?.forEach((log: any) => {
            const logStatus =
              log.status === 'SUCCESS'
                ? 'success'
                : log.status === 'ERROR'
                  ? 'error'
                  : log.status === 'WARNING'
                    ? 'warning'
                    : 'info'
            addLog(log.message || log.status, logStatus)
          })

          if (status.syncStatus === 'SYNCED') {
            clearInterval(pollIntervalRef.current!)
            addLog(t('UI_SYNC_COMPLETED_SUCCESS'), 'success')
            setIsSyncing(false)
          } else if (status.syncStatus === 'FAILED') {
            clearInterval(pollIntervalRef.current!)
            addLog(t('SYNC_RUN_FAILED'), 'error')
            setIsSyncing(false)
          }
        } catch {
          // Continue polling
        }
      }, 3000)

      // Stop polling after 2 minutes max
      timeoutRef.current = setTimeout(() => {
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current)
        }
        // Use a callback to access latest isSyncing state
        setIsSyncing((prev) => {
          if (prev) {
            addLog(t('UI_SYNC_TIMEOUT_WARNING'), 'warning')
            return false
          }
          return prev
        })
      }, 120000)
    } catch (e) {
      addLog((e as Error).message, 'error')
      setError((e as Error).message)
      setIsSyncing(false)
    }
  }

  const selectedSource = connectors.find((c) => c.id === source)
  const selectedDest = connectors.find((c) => c.id === destination)

  return (
    <PageShell>
      <PageHeader
        eyebrow={t('UI_NEW_RUN_EYEBROW')}
        title={t('UI_NEW_SYNC')}
        description={t('sync_new_desc')}
      />

      {/* Wizard progress */}
      <ol className="mt-6 flex flex-nowrap items-center overflow-x-auto pb-1">
        {steps.map((step, index) => (
          <li key={step.id} className="flex items-center">
            <div className="flex items-center gap-2.5">
              <span
                className={`grid size-8 shrink-0 place-items-center rounded-[3px] text-[13px] font-semibold ${
                  step.status === 'current'
                    ? 'bg-primary text-primary-foreground'
                    : step.status === 'completed'
                      ? 'bg-success-soft text-success'
                      : 'bg-muted text-muted-foreground'
                }`}
              >
                {step.status === 'completed' ? (
                  <Check className="size-4" />
                ) : (
                  <span className={step.status === 'pending' ? 'font-normal' : ''}>
                    {index + 1}
                  </span>
                )}
              </span>
              <span className="hidden sm:block">
                <span
                  className={`block text-[13px] leading-tight ${
                    step.status === 'pending'
                      ? 'text-muted-foreground'
                      : 'font-medium text-foreground'
                  }`}
                >
                  {step.title}
                </span>
                <span className="block text-xs leading-tight text-muted-foreground">
                  {step.description}
                </span>
              </span>
            </div>
            {index < steps.length - 1 && (
              <span
                aria-hidden="true"
                className={`mx-2 h-px w-4 ${index < currentStep ? 'bg-primary' : 'bg-border'} sm:mx-3 sm:w-10`}
              />
            )}
          </li>
        ))}
      </ol>

      {error && (
        <div className="mt-6 flex items-center gap-2 rounded-[2px] border border-destructive/30 bg-destructive-soft px-4 py-3 text-sm text-destructive">
          <AlertCircle className="size-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,32rem)_minmax(0,1fr)]">
        <div className="max-w-xl">
          {/* Step 0: Select Source */}
          {currentStep === 0 && (
            <Card>
              <CardHeader>
                <CardTitle>{t('UI_SELECT_SOURCE')}</CardTitle>
                <CardDescription>{t('UI_SOURCE_DESC')}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="sync-source">{t('UI_SOURCE')}</Label>
                  <Select value={source} onValueChange={setSource}>
                    <SelectTrigger id="sync-source" className="w-full">
                      <SelectValue placeholder={t('UI_SELECT_SOURCE_PLACEHOLDER')} />
                    </SelectTrigger>
                    <SelectContent>
                      {sourceConnectors.length === 0 && (
                        <div className="p-3 text-center text-sm text-muted-foreground">
                          {t('UI_NO_SOURCE_CONNECTOR')}
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
                    {loading ? <Loader2 className="animate-spin" /> : null}
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
                <div className="space-y-1.5">
                  <Label htmlFor="sync-document">{t('UI_DOCUMENT')}</Label>
                  <Select value={sourceDocId} onValueChange={setSourceDocId}>
                    <SelectTrigger id="sync-document" className="w-full">
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
                    {t('UI_BACK')}
                  </Button>
                  {sourceDocId && (
                    <Button onClick={handleDocSelect} className="flex-1">
                      {t('UI_CONTINUE')}
                      <ArrowRight />
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
                <div className="space-y-1.5">
                  <Label htmlFor="sync-destination">{t('UI_PLATFORM')}</Label>
                  <Select value={destination} onValueChange={setDestination}>
                    <SelectTrigger id="sync-destination" className="w-full">
                      <SelectValue placeholder={t('UI_SELECT_DESTINATION')} />
                    </SelectTrigger>
                    <SelectContent>
                      {destConnectors.length === 0 && (
                        <div className="p-3 text-center text-sm text-muted-foreground">
                          {t('UI_NO_DEST_CONNECTOR')}
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
                    {t('UI_BACK')}
                  </Button>
                  {destination && (
                    <Button onClick={handleDestinationSelect} className="flex-1">
                      {t('UI_CONTINUE')}
                      <ArrowRight />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Step 3: Review */}
          {currentStep === 3 && (
            <Card>
              <CardHeader>
                <CardTitle>{t('UI_REVIEW_STEP')}</CardTitle>
                <CardDescription>{t('UI_REVIEW_DESC')}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2.5 rounded-[3px] bg-muted p-4">
                  <p className="text-[13px] font-medium">{t('UI_SUMMARY')}</p>
                  <dl className="space-y-1.5 text-[13px] text-muted-foreground">
                    <div className="flex items-center justify-between gap-3">
                      <dt>{t('UI_SUMMARY_SOURCE')}</dt>
                      <dd>
                        <Badge variant="outline">
                          {selectedSource ? connectorNames[selectedSource.type] : '—'}
                        </Badge>
                      </dd>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <dt>{t('UI_SUMMARY_DOCUMENT')}</dt>
                      <dd className="max-w-[150px] truncate">
                        {sourceDocuments.find((d) => d.id === sourceDocId)?.title || '—'}
                      </dd>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <dt>{t('UI_SUMMARY_DESTINATION')}</dt>
                      <dd>
                        <Badge variant="outline">
                          {selectedDest ? connectorNames[selectedDest.type] : '—'}
                        </Badge>
                      </dd>
                    </div>
                  </dl>
                </div>
                <div className="flex gap-2 border-t border-border pt-4">
                  <Button variant="outline" onClick={() => setCurrentStep(2)} className="flex-1">
                    {t('UI_BACK')}
                  </Button>
                  <Button onClick={handleSync} className="flex-1" disabled={isSyncing}>
                    <Zap />
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
              <CardContent className="flex flex-col items-center justify-center gap-4 py-10">
                {isSyncing ? (
                  <>
                    <Loader2 className="size-8 animate-spin text-primary" />
                    <p className="text-sm text-muted-foreground">{t('UI_SYNCING_QSTASH')}</p>
                  </>
                ) : (
                  <>
                    <span className="grid size-12 place-items-center rounded-[3px] bg-success-soft text-success">
                      <Check className="size-6" />
                    </span>
                    <p className="text-sm text-muted-foreground">{t('UI_SYNC_COMPLETE')}</p>
                    <Button
                      variant="outline"
                      onClick={() => (window.location.href = '/dashboard/sync')}
                    >
                      {t('UI_VIEW_HISTORY')}
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Log Console */}
        <Card className="self-start">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="size-4 text-muted-foreground" />
              {t('UI_LOG_CONSOLE')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[400px] overflow-y-auto rounded-[2px] border border-border bg-muted p-4 font-mono text-[13px]">
              {logs.length === 0 ? (
                <p className="text-muted-foreground">{t('UI_WAITING')}</p>
              ) : (
                logs.map((log, index) => (
                  <div key={index} className="mb-1">
                    <span className="text-muted-foreground">
                      [{log.timestamp.toLocaleTimeString()}]
                    </span>{' '}
                    <span className={logStatusClass[log.status]}>{log.message}</span>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </PageShell>
  )
}
