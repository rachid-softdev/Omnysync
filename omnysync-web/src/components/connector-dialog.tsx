'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, CheckCircle, CircleX } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useTranslations } from '@/lib/i18n/useTranslations'

const PLATFORM_FIELDS: Record<
  string,
  {
    labelKey: string
    key: string
    type: string
    placeholder?: string
    placeholderKey?: string
  }[]
> = {
  WORDPRESS: [
    {
      labelKey: 'CONNECTOR_FIELD_SITE_URL',
      key: 'siteUrl',
      type: 'text',
      placeholder: 'https://example.com',
    },
    { labelKey: 'CONNECTOR_FIELD_USERNAME', key: 'username', type: 'text', placeholder: 'admin' },
    {
      labelKey: 'CONNECTOR_FIELD_APP_PASSWORD',
      key: 'password',
      type: 'password',
      placeholder: 'XXXX XXXX XXXX XXXX',
    },
  ],
  GHOST: [
    {
      labelKey: 'CONNECTOR_FIELD_SITE_URL',
      key: 'siteUrl',
      type: 'text',
      placeholder: 'https://example.com',
    },
    {
      labelKey: 'CONNECTOR_FIELD_ADMIN_API_KEY',
      key: 'adminApiKey',
      type: 'password',
      placeholder: 'id:secret',
    },
  ],
  WEBFLOW: [
    { labelKey: 'CONNECTOR_FIELD_SITE_ID', key: 'siteId', type: 'text', placeholder: 'abc123...' },
    {
      labelKey: 'CONNECTOR_FIELD_COLLECTION_ID',
      key: 'collectionId',
      type: 'text',
      placeholderKey: 'CONNECTOR_PLACEHOLDER_COLLECTION_ID',
    },
    {
      labelKey: 'CONNECTOR_FIELD_ACCESS_TOKEN',
      key: 'accessToken',
      type: 'password',
      placeholder: 'token...',
    },
  ],
  SHOPIFY: [
    {
      labelKey: 'CONNECTOR_FIELD_SHOP_DOMAIN',
      key: 'shopDomain',
      type: 'text',
      placeholder: 'my-store.myshopify.com',
    },
    {
      labelKey: 'CONNECTOR_FIELD_ACCESS_TOKEN',
      key: 'accessToken',
      type: 'password',
      placeholder: 'shpat_...',
    },
  ],
  AIRTABLE: [
    { labelKey: 'CONNECTOR_FIELD_API_KEY', key: 'apiKey', type: 'password', placeholder: 'key...' },
    { labelKey: 'CONNECTOR_FIELD_BASE_ID', key: 'baseId', type: 'text', placeholder: 'app...' },
  ],
  CONTENTFUL: [
    {
      labelKey: 'CONNECTOR_FIELD_ACCESS_TOKEN',
      key: 'accessToken',
      type: 'password',
      placeholder: 'token...',
    },
    {
      labelKey: 'CONNECTOR_FIELD_SPACE_ID',
      key: 'spaceId',
      type: 'text',
      placeholderKey: 'CONNECTOR_PLACEHOLDER_SPACE_ID',
    },
  ],
  MEDIUM: [
    {
      labelKey: 'CONNECTOR_FIELD_ACCESS_TOKEN',
      key: 'accessToken',
      type: 'password',
      placeholder: 'token...',
    },
    {
      labelKey: 'CONNECTOR_FIELD_PUBLICATION_ID',
      key: 'publicationId',
      type: 'text',
      placeholderKey: 'CONNECTOR_PLACEHOLDER_PUBLICATION_ID',
    },
  ],
}

interface ConnectorDialogProps {
  type: string
  open: boolean
  onClose: () => void
  onSuccess: () => void
}

export function ConnectorDialog({ type, open, onClose, onSuccess }: ConnectorDialogProps) {
  const { t, tf } = useTranslations()
  const [fields, setFields] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const platformFields = PLATFORM_FIELDS[type]
  if (!platformFields) return null

  const updateField = (key: string, value: string) => {
    setFields((prev) => ({ ...prev, [key]: value }))
  }

  const handleConnect = async () => {
    setLoading(true)
    setError('')

    const config: Record<string, string> = {}
    const credentials: Record<string, string> = {}

    // Separate config vs credentials by type
    switch (type) {
      case 'WORDPRESS':
        config.siteUrl = fields.siteUrl || ''
        credentials.username = fields.username || ''
        credentials.password = fields.password || ''
        break
      case 'GHOST':
        config.siteUrl = fields.siteUrl || ''
        credentials.adminApiKey = fields.adminApiKey || ''
        break
      case 'WEBFLOW':
        config.siteId = fields.siteId || ''
        config.collectionId = fields.collectionId || ''
        credentials.accessToken = fields.accessToken || ''
        break
      case 'SHOPIFY':
        config.shopDomain = fields.shopDomain || ''
        credentials.accessToken = fields.accessToken || ''
        break
      case 'AIRTABLE':
        config.baseId = fields.baseId || ''
        credentials.apiKey = fields.apiKey || ''
        break
      case 'CONTENTFUL':
        config.spaceId = fields.spaceId || ''
        credentials.accessToken = fields.accessToken || ''
        break
      case 'MEDIUM':
        config.publicationId = fields.publicationId || ''
        credentials.accessToken = fields.accessToken || ''
        break
    }

    try {
      const res = await fetch('/api/connectors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, name: type, config, credentials }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || t('CONNECTOR_CONNECTION_FAILED'))
      }

      setSuccess(true)
      setTimeout(() => {
        onSuccess()
        onClose()
      }, 1500)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const connectorName: Record<string, string> = {
    WORDPRESS: 'WordPress',
    GHOST: 'Ghost',
    WEBFLOW: 'Webflow',
    SHOPIFY: 'Shopify',
    AIRTABLE: 'Airtable',
    CONTENTFUL: 'Contentful',
    MEDIUM: 'Medium',
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) onClose()
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {tf('CONNECTOR_DIALOG_TITLE', { name: connectorName[type] || type })}
          </DialogTitle>
          <DialogDescription>{t(`CONNECTOR_DESC_${type}`)}</DialogDescription>
        </DialogHeader>

        {success ? (
          <div className="flex flex-col items-center gap-3 py-8">
            <CheckCircle className="w-10 h-10 text-success" aria-hidden="true" />
            <p className="text-sm text-muted-foreground">{t('CONNECTOR_CONNECTED_SUCCESS')}</p>
          </div>
        ) : (
          <div className="space-y-4">
            {platformFields.map((field) => (
              <div key={field.key} className="space-y-1.5">
                <Label htmlFor={field.key}>{t(field.labelKey)}</Label>
                <Input
                  id={field.key}
                  type={field.type}
                  placeholder={field.placeholderKey ? t(field.placeholderKey) : field.placeholder}
                  value={fields[field.key] || ''}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    updateField(field.key, e.target.value)
                  }
                />
              </div>
            ))}

            {error && (
              <div
                className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 p-3 rounded-[2px]"
                role="alert"
              >
                <CircleX className="w-4 h-4" aria-hidden="true" />
                {error}
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1" onClick={onClose}>
                {t('UI_CANCEL')}
              </Button>
              <Button className="flex-1" onClick={handleConnect} disabled={loading}>
                {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" aria-hidden="true" />}
                {t('CONNECTOR_CONNECT_ACTION')}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
