"use client"

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Plus, RefreshCw, Loader2 } from "lucide-react"
import { ConnectorDialog } from "@/components/connector-dialog"
import { useTranslations } from "@/lib/i18n/useTranslations"

interface Connector {
  id: string
  type: string
  name: string
  status: string
}

const sourceTypes = ["GOOGLE_DOCS", "NOTION"] as const
const destTypes = ["WORDPRESS", "GHOST", "WEBFLOW", "SHOPIFY"] as const

const connectorNames: Record<string, string> = {
  GOOGLE_DOCS: "Google Docs",
  NOTION: "Notion",
  WORDPRESS: "WordPress",
  GHOST: "Ghost",
  WEBFLOW: "Webflow",
  SHOPIFY: "Shopify",
}

const connectorIcons: Record<string, string> = {
  GOOGLE_DOCS: "📄",
  NOTION: "📝",
  WORDPRESS: "🔵",
  GHOST: "👻",
  WEBFLOW: "🌐",
  SHOPIFY: "🛒",
}

export default function ConnectorsPage() {
  const { t } = useTranslations()
  const [connectors, setConnectors] = useState<Connector[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogType, setDialogType] = useState<string | null>(null)
  const [statusMsg, setStatusMsg] = useState("")

  const fetchConnectors = async () => {
    try {
      const res = await fetch("/api/connectors")
      if (res.ok) {
        const data = await res.json()
        setConnectors(data)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchConnectors()

    // Check for callback params
    const params = new URLSearchParams(window.location.search)
    if (params.get("connected") === "google_docs") {
      setStatusMsg("Google Docs connecté avec succès !")
      setTimeout(() => setStatusMsg(""), 5000)
      window.history.replaceState({}, "", "/dashboard/connectors")
    } else if (params.get("connected") === "notion") {
      setStatusMsg("Notion connecté avec succès !")
      setTimeout(() => setStatusMsg(""), 5000)
      window.history.replaceState({}, "", "/dashboard/connectors")
    } else if (params.get("error")) {
      setStatusMsg("Erreur de connexion. Réessayez.")
      setTimeout(() => setStatusMsg(""), 5000)
      window.history.replaceState({}, "", "/dashboard/connectors")
    }
  }, [])

  const connectedTypes = new Set(connectors.map((c) => c.type))

  const handleConnect = (type: string) => {
    if (type === "GOOGLE_DOCS") {
      window.location.href = "/api/auth/connect/google"
    } else if (type === "NOTION") {
      window.location.href = "/api/auth/connect/notion"
    } else {
      setDialogType(type)
    }
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
          <h1 className="text-3xl font-bold">{t("UI_CONNECTORS")}</h1>
          <p className="text-muted-foreground mt-1">{t("UI_MANAGE_CONNECTORS")}</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchConnectors}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Actualiser
        </Button>
      </div>

      {statusMsg && (
        <div className="mb-6 p-4 bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/30 rounded-lg text-sm">
          {statusMsg}
        </div>
      )}

      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4">{t("UI_SOURCES")}</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sourceTypes.map((type) => {
            const isConnected = connectedTypes.has(type)
            return (
              <Card key={type} className="hover:shadow-md transition-shadow">
                <CardContent className="flex items-center gap-4 p-6">
                  <span className="text-3xl">{connectorIcons[type]}</span>
                  <div className="flex-1">
                    <p className="font-medium">{connectorNames[type]}</p>
                    <p className="text-sm text-muted-foreground">
                      {isConnected ? t("UI_CONNECTED") : t("UI_NOT_CONNECTED")}
                    </p>
                  </div>
                  <Button
                    variant={isConnected ? "outline" : "default"}
                    size="sm"
                    onClick={() => handleConnect(type)}
                  >
                    {isConnected ? "Reconnecter" : "Connecter"}
                  </Button>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>

      <div>
        <h2 className="text-xl font-semibold mb-4">{t("UI_DESTINATIONS")}</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {destTypes.map((type) => {
            const isConnected = connectedTypes.has(type)
            return (
              <Card key={type} className="hover:shadow-md transition-shadow">
                <CardContent className="flex items-center gap-4 p-6">
                  <span className="text-3xl">{connectorIcons[type]}</span>
                  <div className="flex-1">
                    <p className="font-medium">{connectorNames[type]}</p>
                    <p className="text-sm text-muted-foreground">
                      {isConnected ? t("UI_CONNECTED") : t("UI_NOT_CONNECTED")}
                    </p>
                  </div>
                  <Button
                    variant={isConnected ? "outline" : "default"}
                    size="sm"
                    onClick={() => handleConnect(type)}
                  >
                    {isConnected ? "Reconnecter" : "Connecter"}
                  </Button>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>

      <ConnectorDialog
        type={dialogType || ""}
        open={!!dialogType}
        onClose={() => setDialogType(null)}
        onSuccess={fetchConnectors}
      />
    </div>
  )
}
