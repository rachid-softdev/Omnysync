"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import { Loader2, CheckCircle, XCircle } from "lucide-react"

const PLATFORM_FIELDS: Record<string, { label: string; key: string; type: string; placeholder: string }[]> = {
  WORDPRESS: [
    { label: "URL du site", key: "siteUrl", type: "text", placeholder: "https://monsite.com" },
    { label: "Nom d'utilisateur", key: "username", type: "text", placeholder: "admin" },
    { label: "Mot de passe d'application", key: "password", type: "password", placeholder: "XXXX XXXX XXXX XXXX" },
  ],
  GHOST: [
    { label: "URL du site", key: "siteUrl", type: "text", placeholder: "https://monsite.com" },
    { label: "Admin API Key", key: "adminApiKey", type: "password", placeholder: "id:secret" },
  ],
  WEBFLOW: [
    { label: "Site ID", key: "siteId", type: "text", placeholder: "abc123..." },
    { label: "Access Token", key: "accessToken", type: "password", placeholder: "token..." },
  ],
  SHOPIFY: [
    { label: "Domaine", key: "shopDomain", type: "text", placeholder: "ma-boutique.myshopify.com" },
    { label: "Access Token", key: "accessToken", type: "password", placeholder: "shpat_..." },
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
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)

  if (!open) return null

  const platformFields = PLATFORM_FIELDS[type]
  if (!platformFields) return null

  const updateField = (key: string, value: string) => {
    setFields((prev) => ({ ...prev, [key]: value }))
  }

  const handleConnect = async () => {
    setLoading(true)
    setError("")

    const config: Record<string, string> = {}
    const credentials: Record<string, string> = {}

    // Separate config vs credentials
    if (type === "WORDPRESS") {
      config.siteUrl = fields.siteUrl || ""
      credentials.username = fields.username || ""
      credentials.password = fields.password || ""
    } else if (type === "GHOST") {
      config.siteUrl = fields.siteUrl || ""
      credentials.adminApiKey = fields.adminApiKey || ""
    } else if (type === "WEBFLOW") {
      config.siteId = fields.siteId || ""
      credentials.accessToken = fields.accessToken || ""
    } else if (type === "SHOPIFY") {
      config.shopDomain = fields.shopDomain || ""
      credentials.accessToken = fields.accessToken || ""
    }

    try {
      const res = await fetch("/api/connectors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, name: type, config, credentials }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Connection failed")
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
    WORDPRESS: "WordPress",
    GHOST: "Ghost",
    WEBFLOW: "Webflow",
    SHOPIFY: "Shopify",
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-card border border-border rounded-xl shadow-xl p-6 w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-semibold mb-4">Connecter {connectorName[type] || type}</h3>

        {success ? (
          <div className="flex flex-col items-center gap-3 py-4">
            <CheckCircle className="w-10 h-10 text-green-500" />
            <p className="text-sm text-muted-foreground">Connecté avec succès !</p>
          </div>
        ) : (
          <div className="space-y-4">
            {platformFields.map((field) => (
              <div key={field.key} className="space-y-1.5">
                <Label>{field.label}</Label>
                <Input
                  type={field.type}
                  placeholder={field.placeholder}
                  value={fields[field.key] || ""}
                  onChange={(e) => updateField(field.key, e.target.value)}
                />
              </div>
            ))}

            {error && (
              <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 p-3 rounded-lg">
                <XCircle className="w-4 h-4" />
                {error}
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1" onClick={onClose}>
                Annuler
              </Button>
              <Button className="flex-1" onClick={handleConnect} disabled={loading}>
                {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                Connecter
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
