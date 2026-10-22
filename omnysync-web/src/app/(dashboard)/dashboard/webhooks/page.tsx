'use client'

import { useState, useEffect, useCallback, type ChangeEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Loader2, Plus, Webhook, Trash2, Play, Copy } from 'lucide-react'
import { toast } from '@/components/toast-provider'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { useTranslations } from '@/lib/i18n/useTranslations'
import { formatDateTime, detectClientLocale } from '@/lib/format-date'
import { useBatchSelect } from '@/hooks/use-batch-select'
import { BatchActionBar } from '@/components/batch-action-bar'
import { PageHeader, PageShell } from '@/components/page-header'
import { PlanGate } from '@/components/plan-gate'

interface WebhookEndpoint {
  id: string
  connectorId: string
  connectorName?: string
  type: string
  url: string
  secret?: string
  isActive: boolean
  createdAt: string
  lastTriggeredAt?: string
}

export default function WebhooksPage() {
  const { t } = useTranslations()
  const locale = detectClientLocale()
  const [loading, setLoading] = useState(true)
  const [webhooks, setWebhooks] = useState<WebhookEndpoint[]>([])
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [testingId, setTestingId] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [planGate, setPlanGate] = useState<string | null>(null)

  const [batchDeleteConfirmOpen, setBatchDeleteConfirmOpen] = useState(false)

  const { selectedIds, selectedCount, isAllSelected, toggle, selectAll, clearSelection } =
    useBatchSelect(webhooks)

  const handleBatchDelete = useCallback(async () => {
    const ids = Array.from(selectedIds)
    let success = 0
    for (const id of ids) {
      try {
        const res = await fetch(`/api/webhook-endpoints/${id}`, { method: 'DELETE' })
        if (res.ok) {
          setWebhooks((prev) => prev.filter((w) => w.id !== id))
          success++
        }
      } catch (e) {
        console.error(e)
      }
    }
    toast.success(`${success} webhook(s) deleted`)
    clearSelection()
    setBatchDeleteConfirmOpen(false)
  }, [selectedIds, clearSelection])

  // Form state
  const [newWebhook, setNewWebhook] = useState({
    connectorId: '',
    type: 'WORDPRESS',
    url: '',
  })

  const fetchWebhooks = async () => {
    try {
      const res = await fetch('/api/webhooks')
      if (res.ok) {
        const data = await res.json()
        setWebhooks(data.webhooks || [])
      } else {
        const payload = (await res.json().catch(() => null)) as {
          code?: string
          upgradeUrl?: string
        } | null
        if (res.status === 403 && payload?.code === 'PLAN_FEATURE_REQUIRED') {
          setPlanGate(payload.upgradeUrl || '/pricing')
          return
        }
        toast.error(`Failed to load webhooks (${res.status}). Refresh the page to try again.`)
      }
    } catch (e) {
      console.error(e)
      toast.error('Unable to connect to the server. Check your internet connection.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchWebhooks()
  }, [])

  const createWebhook = async () => {
    try {
      const res = await fetch('/api/webhooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newWebhook),
      })

      if (res.ok) {
        const data = await res.json()
        setWebhooks([...webhooks, data.webhook])
        setIsCreateOpen(false)
        setNewWebhook({ connectorId: '', type: 'WORDPRESS', url: '' })
      } else {
        toast.error(`Failed to create webhook (${res.status}). Check your input and try again.`)
      }
    } catch (e) {
      console.error(e)
      toast.error('Unable to create webhook. Check your connection and try again.')
    }
  }

  const confirmDeleteWebhook = async () => {
    if (!deleteTarget) return
    try {
      const res = await fetch(`/api/webhook-endpoints/${deleteTarget}`, { method: 'DELETE' })
      if (res.ok) {
        setWebhooks(webhooks.filter((w) => w.id !== deleteTarget))
        toast.success('Webhook deleted')
      } else {
        toast.error(`Could not delete webhook (${res.status}). Try again or contact support.`)
      }
    } catch (e) {
      console.error(e)
      toast.error('Could not delete webhook. Check your connection and try again.')
    } finally {
      setDeleteTarget(null)
    }
  }

  const toggleWebhook = async (id: string, isActive: boolean) => {
    try {
      const res = await fetch(`/api/webhook-endpoints/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive }),
      })

      if (res.ok) {
        setWebhooks(webhooks.map((w) => (w.id === id ? { ...w, isActive } : w)))
      } else {
        toast.error(`Could not ${isActive ? 'enable' : 'disable'} webhook (${res.status}).`)
      }
    } catch (e) {
      console.error(e)
      toast.error('Could not update webhook. Check your connection and try again.')
    }
  }

  const testWebhook = async (id: string) => {
    setTestingId(id)
    try {
      const res = await fetch(`/api/webhook-endpoints/${id}/test`, { method: 'POST' })
      const data = await res.json()

      if (res.ok && data.success) {
        toast.success('Test webhook sent successfully!')
      } else {
        toast.error(`Test failed: ${data.error || 'Unknown error. Verify the endpoint URL.'}`)
      }
    } catch {
      toast.error('Could not send test to webhook. Check that the endpoint URL is reachable.')
    } finally {
      setTestingId(null)
    }
  }

  const copySecret = (secret: string) => {
    navigator.clipboard.writeText(secret)
    toast.success('Secret copied to clipboard')
  }

  if (planGate) {
    return (
      <PageShell>
        <PageHeader
          eyebrow={`WEBHOOKS / ${String(webhooks.length).padStart(2, '0')}`}
          title={t('WEBHOOKS_TITLE')}
          description={t('WEBHOOKS_SUBTITLE')}
        />
        <PlanGate
          title={t('plan_gate_webhooks_title')}
          description={t('plan_gate_webhooks_desc')}
          upgradeUrl={planGate}
          className="mt-6"
        />
      </PageShell>
    )
  }

  return (
    <PageShell>
      <PageHeader
        eyebrow={`WEBHOOKS / ${String(webhooks.length).padStart(2, '0')}`}
        title={t('WEBHOOKS_TITLE')}
        description={t('WEBHOOKS_SUBTITLE')}
        actions={
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus />
                {t('WEBHOOKS_CREATE')}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t('WEBHOOKS_CREATE_TITLE')}</DialogTitle>
                <DialogDescription>
                  Configure an endpoint to receive notifications from your platforms.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-4">
                <div className="space-y-1.5">
                  <Label htmlFor="webhook-connector">Connector</Label>
                  <Select
                    value={newWebhook.connectorId}
                    onValueChange={(v) => setNewWebhook({ ...newWebhook, connectorId: v })}
                  >
                    <SelectTrigger id="webhook-connector" className="w-full">
                      <SelectValue placeholder="Select a connector" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="connector-1">WordPress - mon-site.com</SelectItem>
                      <SelectItem value="connector-2">Ghost - mon-blog.ghost.io</SelectItem>
                      <SelectItem value="connector-3">WebFlow - mon-site.webflow.io</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="webhook-type">Type</Label>
                  <Select
                    value={newWebhook.type}
                    onValueChange={(v) => setNewWebhook({ ...newWebhook, type: v })}
                  >
                    <SelectTrigger id="webhook-type" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="WORDPRESS">WordPress</SelectItem>
                      <SelectItem value="GHOST">Ghost</SelectItem>
                      <SelectItem value="WEBFLOW">Webflow</SelectItem>
                      <SelectItem value="SHOPIFY">Shopify</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="webhook-url">Endpoint URL</Label>
                  <Input
                    id="webhook-url"
                    placeholder="https://your-site.com/webhook"
                    value={newWebhook.url}
                    onChange={(e: ChangeEvent<HTMLInputElement>) =>
                      setNewWebhook({ ...newWebhook, url: e.target.value })
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    Omnysync sends a signed POST request to this URL on every sync event.
                  </p>
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={createWebhook}>Create</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      {loading ? (
        <div className="mt-6 flex min-h-[320px] items-center justify-center border border-border bg-card">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      ) : webhooks.length === 0 ? (
        <div className="mt-6 border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border px-5 py-3 font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground">
            <span>Endpoint registry</span>
            <span>00</span>
          </div>
          <div className="flex flex-col gap-4 p-6 sm:flex-row sm:items-start sm:p-8">
            <span className="grid size-10 shrink-0 place-items-center border border-border bg-muted text-muted-foreground">
              <Webhook className="size-5" />
            </span>
            <div className="max-w-xl">
              <p className="text-base font-semibold tracking-[-0.02em]">No webhooks configured</p>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                Create your first webhook to receive real-time notifications.
              </p>
              <Button className="mt-5" onClick={() => setIsCreateOpen(true)}>
                <Plus />
                Create webhook
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div className="relative mt-6">
          {selectedCount > 0 && (
            <BatchActionBar
              selectedCount={selectedCount}
              isAllSelected={isAllSelected}
              onSelectAll={selectAll}
              onClearSelection={clearSelection}
              actions={[
                {
                  label: 'Delete',
                  icon: <Trash2 className="size-4" />,
                  variant: 'destructive',
                  onClick: () => setBatchDeleteConfirmOpen(true),
                },
              ]}
            />
          )}

          <div className="border border-border bg-card">
            <Table>
              <TableHeader className="bg-muted/40">
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="hidden h-9 w-10 px-2 pr-0 sm:table-cell sm:px-4">
                    <Checkbox
                      id="select-all-webhooks"
                      aria-label="Select all webhooks"
                      checked={isAllSelected}
                      onCheckedChange={(checked) => {
                        if (checked) selectAll()
                        else clearSelection()
                      }}
                    />
                  </TableHead>
                  <TableHead className="h-9 px-2 font-mono text-[9px] uppercase tracking-[0.14em] sm:px-4">
                    Endpoint
                  </TableHead>
                  <TableHead className="h-9 w-8 px-1 font-mono text-[9px] uppercase tracking-[0.14em] sm:w-auto sm:px-4">
                    <span className="hidden sm:inline">Status</span>
                  </TableHead>
                  <TableHead className="hidden h-9 px-4 font-mono text-[9px] uppercase tracking-[0.14em] md:table-cell">
                    Last triggered
                  </TableHead>
                  <TableHead className="h-9 px-2 text-right font-mono text-[9px] uppercase tracking-[0.14em] sm:px-4">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {webhooks.map((webhook) => (
                  <TableRow key={webhook.id} className="border-border hover:bg-muted/30">
                    <TableCell className="hidden px-2 pr-0 sm:table-cell sm:px-4">
                      <Checkbox
                        checked={selectedIds.has(webhook.id)}
                        onCheckedChange={() => toggle(webhook.id)}
                        aria-label={`Select ${webhook.type}`}
                      />
                    </TableCell>
                    <TableCell className="px-2 py-2.5 sm:px-4">
                      <div className="flex items-center gap-3">
                        <span
                          className={`grid size-8 shrink-0 place-items-center rounded-[3px] ${
                            webhook.isActive
                              ? 'bg-success-soft text-success'
                              : 'bg-muted text-muted-foreground'
                          }`}
                        >
                          <Webhook className="size-4" />
                        </span>
                        <div className="min-w-0">
                          <p className="font-mono text-[10px] uppercase tracking-[0.06em]">
                            {webhook.type}
                          </p>
                          <p className="max-w-[8rem] truncate text-xs text-muted-foreground sm:max-w-[24rem]">
                            {webhook.url}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="w-8 px-1 sm:w-auto sm:px-4">
                      <span
                        className={`inline-flex items-center gap-1.5 whitespace-nowrap font-mono text-[9px] uppercase tracking-[0.12em] ${
                          webhook.isActive ? 'text-success' : 'text-muted-foreground'
                        }`}
                      >
                        <span
                          className={`size-1.5 ${
                            webhook.isActive ? 'bg-success' : 'border border-border-strong'
                          }`}
                          aria-hidden="true"
                        />
                        <span className="hidden sm:inline">
                          {webhook.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </span>
                    </TableCell>
                    <TableCell className="hidden whitespace-nowrap px-4 py-2.5 font-mono text-[10px] tabular-nums text-muted-foreground md:table-cell">
                      {webhook.lastTriggeredAt
                        ? formatDateTime(webhook.lastTriggeredAt, locale)
                        : 'Never'}
                    </TableCell>
                    <TableCell className="px-2 sm:px-4">
                      <div className="flex items-center justify-end gap-1">
                        <Switch
                          checked={webhook.isActive}
                          onCheckedChange={(checked) => toggleWebhook(webhook.id, checked)}
                          aria-label={`Toggle ${webhook.type} webhook`}
                        />
                        <Button
                          variant="outline"
                          size="icon-sm"
                          onClick={() => testWebhook(webhook.id)}
                          disabled={testingId === webhook.id}
                          aria-label="Send test event"
                        >
                          {testingId === webhook.id ? (
                            <Loader2 className="animate-spin" />
                          ) : (
                            <Play />
                          )}
                        </Button>
                        {webhook.secret && (
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            className="hidden text-muted-foreground sm:inline-flex"
                            onClick={() => copySecret(webhook.secret!)}
                            aria-label="Copy signing secret"
                          >
                            <Copy />
                          </Button>
                        )}
                        <AlertDialog
                          open={deleteTarget === webhook.id}
                          onOpenChange={(open) => {
                            if (!open) setDeleteTarget(null)
                          }}
                        >
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              className="text-destructive hover:bg-destructive-soft"
                              onClick={() => setDeleteTarget(webhook.id)}
                              aria-label="Delete webhook"
                            >
                              <Trash2 />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete webhook</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to delete this webhook? This action is
                                irreversible.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel onClick={() => setDeleteTarget(null)}>
                                Cancel
                              </AlertDialogCancel>
                              <AlertDialogAction onClick={confirmDeleteWebhook}>
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="flex items-center justify-between border-t border-border bg-muted/20 px-4 py-2.5 font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground">
              <span>
                {webhooks.length} endpoint{webhooks.length === 1 ? '' : 's'}
              </span>
              <span>{webhooks.filter((webhook) => webhook.isActive).length} active</span>
            </div>
          </div>

          <AlertDialog open={batchDeleteConfirmOpen} onOpenChange={setBatchDeleteConfirmOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete webhooks</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to delete {selectedCount} webhook(s)? This action is
                  irreversible.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleBatchDelete}>Delete</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      )}
    </PageShell>
  )
}
