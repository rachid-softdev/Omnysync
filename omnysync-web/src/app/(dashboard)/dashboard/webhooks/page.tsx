'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
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
  const [loading, setLoading] = useState(true)
  const [webhooks, setWebhooks] = useState<WebhookEndpoint[]>([])
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [testingId, setTestingId] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)

  // Form state
  const [newWebhook, setNewWebhook] = useState({
    connectorId: '',
    type: 'WORDPRESS',
    url: '',
  })

  useEffect(() => {
    fetchWebhooks()
  }, [])

  const fetchWebhooks = async () => {
    try {
      const res = await fetch('/api/webhooks')
      if (res.ok) {
        const data = await res.json()
        setWebhooks(data.webhooks || [])
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

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
      }
    } catch (e) {
      console.error(e)
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
        toast.error('Error deleting webhook')
      }
    } catch (e) {
      console.error(e)
      toast.error('Error deleting webhook')
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
      }
    } catch (e) {
      console.error(e)
    }
  }

  const testWebhook = async (id: string) => {
    setTestingId(id)
    try {
      const res = await fetch(`/api/webhook-endpoints/${id}/test`, { method: 'POST' })
      const data = await res.json()

      if (res.ok && data.success) {
        toast.success('Test sent successfully!')
      } else {
        toast.error(`Error: ${data.error}`)
      }
    } catch {
      toast.error('Error during test')
    } finally {
      setTestingId(null)
    }
  }

  const copySecret = (secret: string) => {
    navigator.clipboard.writeText(secret)
    toast.success('Secret copied to clipboard')
  }

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
          <h1 className="text-3xl font-bold">{t('WEBHOOKS_TITLE')}</h1>
          <p className="text-muted-foreground mt-1">{t('WEBHOOKS_SUBTITLE')}</p>
        </div>

        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
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
              <div className="space-y-2">
                <Label>Connector</Label>
                <Select
                  value={newWebhook.connectorId}
                  onValueChange={(v) => setNewWebhook({ ...newWebhook, connectorId: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a connector" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="connector-1">WordPress - mon-site.com</SelectItem>
                    <SelectItem value="connector-2">Ghost - mon-blog.ghost.io</SelectItem>
                    <SelectItem value="connector-3">WebFlow - mon-site.webflow.io</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Type</Label>
                <Select
                  value={newWebhook.type}
                  onValueChange={(v) => setNewWebhook({ ...newWebhook, type: v })}
                >
                  <SelectTrigger>
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

              <div className="space-y-2">
                <Label>Endpoint URL</Label>
                <Input
                  placeholder="https://your-site.com/webhook"
                  value={newWebhook.url}
                  onChange={(e) => setNewWebhook({ ...newWebhook, url: e.target.value })}
                />
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
      </div>

      {webhooks.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Webhook className="w-12 h-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No webhooks configured</h3>
            <p className="text-muted-foreground text-center mb-4">
              Create your first webhook to receive real-time notifications.
            </p>
            <Button onClick={() => setIsCreateOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Create webhook
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {webhooks.map((webhook) => (
            <Card key={webhook.id}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div
                      className={`p-3 rounded-lg ${webhook.isActive ? 'bg-green-500/10' : 'bg-muted'}`}
                    >
                      <Webhook
                        className={`w-5 h-5 ${webhook.isActive ? 'text-green-500' : 'text-muted-foreground'}`}
                      />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{webhook.type}</p>
                        <Badge variant={webhook.isActive ? 'default' : 'secondary'}>
                          {webhook.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{webhook.url}</p>
                      {webhook.lastTriggeredAt && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Last triggered:{' '}
                          {new Date(webhook.lastTriggeredAt).toLocaleString('en-US')}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Switch
                      checked={webhook.isActive}
                      onCheckedChange={(checked) => toggleWebhook(webhook.id, checked)}
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => testWebhook(webhook.id)}
                      disabled={testingId === webhook.id}
                    >
                      {testingId === webhook.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Play className="w-4 h-4" />
                      )}
                    </Button>
                    {webhook.secret && (
                      <Button variant="ghost" size="sm" onClick={() => copySecret(webhook.secret!)}>
                        <Copy className="w-4 h-4" />
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
                          size="sm"
                          className="text-destructive"
                          onClick={() => setDeleteTarget(webhook.id)}
                        >
                          <Trash2 className="w-4 h-4" />
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
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
