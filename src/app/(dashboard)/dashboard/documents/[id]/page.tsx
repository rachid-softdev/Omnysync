import { auth } from "@/lib/auth"
import { t } from "@/lib/i18n"
import { prisma } from "@/lib/prisma"
import { getUserOrgId } from "@/lib/auth/org"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Progress } from "@/components/ui/progress"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { DocumentActions } from "@/components/document-actions"
import { 
  ArrowLeft, 
  RefreshCw, 
  Trash2, 
  Edit, 
  Eye, 
  Calendar, 
  Clock, 
  CheckCircle, 
  AlertCircle,
  ExternalLink,
  Settings
} from "lucide-react"
import Link from "next/link"
import { notFound } from "next/navigation"

export const dynamic = "force-dynamic"

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function DocumentDetailPage({ params }: PageProps) {
  const { id } = await params
  const session = await auth()

  if (!session?.user?.id) {
    return null
  }

  const orgId = await getUserOrgId(session.user.id)

  const document = await prisma.document.findUnique({
    where: { id, organizationId: orgId },
    include: {
      sourceConnector: true,
      destConnector: true,
      syncLogs: {
        orderBy: { createdAt: "desc" },
        take: 10,
      },
      organization: {
        include: {
          users: {
            include: { user: true },
            where: { role: "OWNER" },
            take: 1,
          },
        },
      },
    },
  })

  if (!document) {
    notFound()
  }

  const statusLabels: Record<string, string> = {
    DRAFT: "Brouillon",
    READY: "Prêt",
    PUBLISHED: "Publié",
    ARCHIVED: "Archivé",
  }

  const syncStatusLabels: Record<string, string> = {
    NOT_SYNCED: "Non synchronisé",
    SYNCING: "En cours",
    SYNCED: "Synchronisé",
    FAILED: "Échec",
  }

  const syncStatusVariants: Record<string, "secondary" | "default" | "destructive" | "outline"> = {
    NOT_SYNCED: "secondary",
    SYNCING: "default",
    SYNCED: "outline",
    FAILED: "destructive",
  }

  const connectorNames: Record<string, string> = {
    GOOGLE_DOCS: "Google Docs",
    NOTION: "Notion",
    WORDPRESS: "WordPress",
    GHOST: "Ghost",
    WEBFLOW: "Webflow",
    SHOPIFY: "Shopify",
  }

  // Calculate sync progress
  const syncProgress = document.syncStatus === "SYNCED" ? 100 : 
    document.syncStatus === "SYNCING" ? 50 : 0

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/documents">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Retour
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold">{document.title}</h1>
            <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
              <span>{connectorNames[document.sourceConnector?.type || "UNKNOWN"] || "Source"}</span>
              <span>→</span>
              <span>{connectorNames[document.destConnector?.type || "UNKNOWN"] || "Destination"}</span>
              <span>·</span>
              <span>Créé le {document.createdAt.toLocaleDateString("fr-FR")}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <DocumentActions documentId={document.id} />
        </div>
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className={`p-2 rounded-lg ${
              document.status === "PUBLISHED" ? "bg-green-500/10" : "bg-secondary"
            }`}>
              {document.status === "PUBLISHED" ? (
                <CheckCircle className="w-5 h-5 text-green-500" />
              ) : (
                <Clock className="w-5 h-5 text-muted-foreground" />
              )}
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Statut</p>
              <p className="font-medium">{statusLabels[document.status] || document.status}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className={`p-2 rounded-lg ${
              document.syncStatus === "SYNCED" ? "bg-green-500/10" : 
              document.syncStatus === "FAILED" ? "bg-red-500/10" : "bg-secondary"
            }`}>
              {document.syncStatus === "SYNCED" ? (
                <CheckCircle className="w-5 h-5 text-green-500" />
              ) : document.syncStatus === "FAILED" ? (
                <AlertCircle className="w-5 h-5 text-red-500" />
              ) : (
                <RefreshCw className="w-5 h-5 text-muted-foreground" />
              )}
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Sync</p>
              <p className="font-medium">{syncStatusLabels[document.syncStatus] || document.syncStatus}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="p-2 rounded-lg bg-secondary">
              <Calendar className="w-5 h-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Dernière sync</p>
              <p className="font-medium">
                {document.lastSyncedAt 
                  ? document.lastSyncedAt.toLocaleDateString("fr-FR")
                  : "Jamais"}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="p-2 rounded-lg bg-secondary">
              <RefreshCw className="w-5 h-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Version</p>
              <p className="font-medium">v{document.version}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Progress Bar */}
      <Card className="mb-8">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Progression de synchronisation</span>
            <span className="text-sm text-muted-foreground">{syncProgress}%</span>
          </div>
          <Progress value={syncProgress} className="h-2" />
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="overview">Aperçu</TabsTrigger>
          <TabsTrigger value="seo">SEO</TabsTrigger>
          <TabsTrigger value="logs">Historique</TabsTrigger>
          <TabsTrigger value="settings">Paramètres</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Content Preview */}
            <Card>
              <CardHeader>
                <CardTitle>Contenu</CardTitle>
                <CardDescription>Aperçu du contenu synchronisé</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="prose prose-sm max-w-none dark:prose-invert">
                  {document.htmlContent ? (
                    <div 
                      className="max-h-96 overflow-y-auto"
                      dangerouslySetInnerHTML={{ __html: document.htmlContent.substring(0, 2000) + "..." }}
                    />
                  ) : (
                    <p className="text-muted-foreground">Aucun contenu disponible</p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Metadata */}
            <Card>
              <CardHeader>
                <CardTitle>Métadonnées</CardTitle>
                <CardDescription>Informations du document</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Source</p>
                    <p className="font-medium">{connectorNames[document.sourceConnector?.type || "UNKNOWN"] || "—"}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Destination</p>
                    <p className="font-medium">{connectorNames[document.destConnector?.type || "UNKNOWN"] || "—"}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Catégories</p>
                    <p className="font-medium">{document.categories?.join(", ") || "Aucune"}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Tags</p>
                    <p className="font-medium">{document.tags?.join(", ") || "Aucun"}</p>
                  </div>
                </div>

                {document.excerpt && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Excerpt</p>
                    <p className="text-sm">{document.excerpt}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="seo">
          <Card>
            <CardHeader>
              <CardTitle>Optimisation SEO</CardTitle>
              <CardDescription>Métadonnées pour les moteurs de recherche</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Titre SEO</p>
                <p className="font-medium">{document.seoTitle || document.title}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Description SEO</p>
                <p className="text-sm">{document.seoDescription || "Aucune description"}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Mots-clés</p>
                <div className="flex flex-wrap gap-2">
                  {document.seoKeywords && document.seoKeywords.length > 0 ? (
                    document.seoKeywords.map((keyword, index) => (
                      <Badge key={index} variant="secondary">{keyword}</Badge>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">Aucun mot-clé</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="logs">
          <Card>
            <CardHeader>
              <CardTitle>Historique des synchronisations</CardTitle>
              <CardDescription>Journal des opérations récentes</CardDescription>
            </CardHeader>
            <CardContent>
              {document.syncLogs.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  Aucun historique disponible
                </p>
              ) : (
                <div className="space-y-3">
                  {document.syncLogs.map((log) => (
                    <div 
                      key={log.id} 
                      className="flex items-center justify-between p-3 rounded-lg border"
                    >
                      <div className="flex items-center gap-3">
                        {log.status === "SUCCESS" ? (
                          <CheckCircle className="w-4 h-4 text-green-500" />
                        ) : log.status === "ERROR" ? (
                          <AlertCircle className="w-4 h-4 text-red-500" />
                        ) : (
                          <Clock className="w-4 h-4 text-muted-foreground" />
                        )}
                        <div>
                          <p className="text-sm font-medium">{log.action}</p>
                          <p className="text-xs text-muted-foreground">{log.message}</p>
                        </div>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {log.createdAt.toLocaleDateString("fr-FR", {
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Sync Settings */}
            <Card>
              <CardHeader>
                <CardTitle>Synchronisation automatique</CardTitle>
                <CardDescription>Configurez la fréquence de synchronisation</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Sync automatique</p>
                    <p className="text-sm text-muted-foreground">
                      Détecter automatiquement les changements
                    </p>
                  </div>
                  <input 
                    type="checkbox" 
                    checked={document.autoSyncEnabled}
                    className="h-4 w-4"
                    readOnly
                  />
                </div>
                {document.autoSyncEnabled && document.syncFrequency && (
                  <div>
                    <p className="text-sm text-muted-foreground">Fréquence</p>
                    <p className="font-medium">
                      {document.syncFrequency === "DAILY" ? "Quotidien" :
                       document.syncFrequency === "WEEKLY" ? "Hebdomadaire" :
                       document.syncFrequency === "MONTHLY" ? "Mensuel" : "Manuel"}
                    </p>
                  </div>
                )}
                {document.nextSyncAt && (
                  <div>
                    <p className="text-sm text-muted-foreground">Prochaine synchronisation</p>
                    <p className="font-medium">
                      {document.nextSyncAt.toLocaleDateString("fr-FR", {
                        day: "numeric",
                        month: "long",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Auto-publish Settings */}
            <Card>
              <CardHeader>
                <CardTitle>Publication</CardTitle>
                <CardDescription>Options de publication automatique</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Publication automatique</p>
                    <p className="text-sm text-muted-foreground">
                      Publier immédiatement après sync
                    </p>
                  </div>
                  <input 
                    type="checkbox" 
                    className="h-4 w-4"
                    defaultChecked
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}