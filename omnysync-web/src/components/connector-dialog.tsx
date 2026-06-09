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

const PLATFORM_FIELDS: Record<
  string,
  { label: string; key: string; type: string; placeholder: string }[]
> = {
  WORDPRESS: [
    { label: 'URL du site', key: 'siteUrl', type: 'text', placeholder: 'https://monsite.com' },
    { label: "Nom d'utilisateur", key: 'username', type: 'text', placeholder: 'admin' },
    {
      label: "Mot de passe d'application",
      key: 'password',
      type: 'password',
      placeholder: 'XXXX XXXX XXXX XXXX',
    },
  ],
  GHOST: [
    { label: 'URL du site', key: 'siteUrl', type: 'text', placeholder: 'https://monsite.com' },
    { label: 'Admin API Key', key: 'adminApiKey', type: 'password', placeholder: 'id:secret' },
  ],
  WEBFLOW: [
    { label: 'Site ID', key: 'siteId', type: 'text', placeholder: 'abc123...' },
    { label: 'Access Token', key: 'accessToken', type: 'password', placeholder: 'token...' },
  ],
  SHOPIFY: [
    { label: 'Domaine', key: 'shopDomain', type: 'text', placeholder: 'ma-boutique.myshopify.com' },
    { label: 'Access Token', key: 'accessToken', type: 'password', placeholder: 'shpat_...' },
  ],
  AIRTABLE: [
    { label: 'API Key', key: 'apiKey', type: 'password', placeholder: 'key...' },
    { label: 'Base ID (optionnel)', key: 'baseId', type: 'text', placeholder: 'app...' },
  ],
  CONTENTFUL: [
    { label: 'Access Token', key: 'accessToken', type: 'password', placeholder: 'token...' },
    { label: 'Space ID (optionnel)', key: 'spaceId', type: 'text', placeholder: 'space ID' },
  ],
  MEDIUM: [
    { label: 'Access Token', key: 'accessToken', type: 'password', placeholder: 'token...' },
    {
      label: 'Publication ID (optionnel)',
      key: 'publicationId',
      type: 'text',
      placeholder: 'publication ID',
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

    // Séparer config vs credentials selon le type
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
        throw new Error(data.error || 'Connection failed')
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

  const connectorDescriptions: Record<string, string> = {
    WORDPRESS: 'Connectez votre site WordPress via REST API',
    GHOST: "Connectez votre blog Ghost via l'API Admin",
    WEBFLOW: 'Connectez votre CMS Webflow',
    SHOPIFY: 'Connectez votre boutique Shopify',
    AIRTABLE: 'Syncronisez vos bases Airtable',
    CONTENTFUL: 'Connectez votre espace Contentful',
    MEDIUM: 'Publiez vos articles sur Medium',
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
          <DialogTitle>Connecter {connectorName[type] || type}</DialogTitle>
          <DialogDescription>{connectorDescriptions[type]}</DialogDescription>
        </DialogHeader>

        {success ? (
          <div className="flex flex-col items-center gap-3 py-8">
            <CheckCircle className="w-10 h-10 text-green-500" aria-hidden="true" />
            <p className="text-sm text-muted-foreground">Connecté avec succès !</p>
          </div>
        ) : (
          <div className="space-y-4">
            {platformFields.map((field) => (
              <div key={field.key} className="space-y-1.5">
                <Label htmlFor={field.key}>{field.label}</Label>
                <Input
                  id={field.key}
                  type={field.type}
                  placeholder={field.placeholder}
                  value={fields[field.key] || ''}
                  onChange={(e) => updateField(field.key, e.target.value)}
                />
              </div>
            ))}

            {error && (
              <div
                className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 p-3 rounded-lg"
                role="alert"
              >
                <CircleX className="w-4 h-4" aria-hidden="true" />
                {error}
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1" onClick={onClose}>
                Annuler
              </Button>
              <Button className="flex-1" onClick={handleConnect} disabled={loading}>
                {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" aria-hidden="true" />}
                Connecter
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
