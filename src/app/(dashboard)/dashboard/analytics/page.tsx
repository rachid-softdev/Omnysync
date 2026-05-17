"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Loader2, TrendingUp, TrendingDown, Clock, CheckCircle, AlertCircle, FileText, Plug } from "lucide-react"

interface AnalyticsData {
  totalSyncs: number
  successRate: number
  avgDuration: number
  totalDocuments: number
  activeConnectors: number
  failedSyncs: number
  recentActivity: Array<{
    id: string
    action: string
    status: string
    createdAt: string
  }>
  syncByDay: Array<{ date: string; count: number }>
  connectorsUsage: Array<{ type: string; count: number }>
}

export default function AnalyticsPage() {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [period, setPeriod] = useState("30")

  useEffect(() => {
    fetchAnalytics()
  }, [period])

  const fetchAnalytics = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/analytics?period=${period}`)
      if (res.ok) {
        const data = await res.json()
        setData(data)
      } else {
        setError("Erreur lors du chargement des données analytiques")
      }
    } catch (e) {
      setError("Impossible de charger les données analytiques")
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  // Show error state
  if (error) {
    return (
      <div className="p-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold">Analytique</h1>
          <Button onClick={fetchAnalytics} variant="outline">
            Réessayer
          </Button>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
            <p className="text-lg font-medium">{error}</p>
            <p className="text-sm text-muted-foreground mt-2">
              Les données analytiques ne sont pas disponibles pour le moment.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Show empty state when no data
  if (!data || (data.totalSyncs === 0 && data.totalDocuments === 0)) {
    return (
      <div className="p-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold">Analytique</h1>
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="px-3 py-2 border rounded-md"
          >
            <option value="7">7 derniers jours</option>
            <option value="30">30 derniers jours</option>
            <option value="90">90 derniers jours</option>
          </select>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="w-12 h-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium">Aucune donnée disponible</p>
            <p className="text-sm text-muted-foreground mt-2">
              Commencez à synchroniser des documents pour voir vos statistiques.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Use actual data - no fallback
  const displayData = data
  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">Analytiques</h1>
          <p className="text-muted-foreground mt-1">
            Suivez les performances de vos synchronisations
          </p>
        </div>
        <select 
          className="px-3 py-2 rounded-md border bg-background"
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
        >
          <option value="7">7 derniers jours</option>
          <option value="30">30 derniers jours</option>
          <option value="90">90 derniers jours</option>
        </select>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total synchronisations</p>
                <p className="text-3xl font-bold">{displayData.totalSyncs}</p>
              </div>
              <div className="p-3 rounded-lg bg-primary/10">
                <FileText className="w-6 h-6 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Taux de réussite</p>
                <p className="text-3xl font-bold">{displayData.successRate}%</p>
              </div>
              <div className={`p-3 rounded-lg ${displayData.successRate >= 80 ? "bg-green-500/10" : "bg-yellow-500/10"}`}>
                {displayData.successRate >= 80 ? (
                  <TrendingUp className="w-6 h-6 text-green-500" />
                ) : (
                  <TrendingDown className="w-6 h-6 text-yellow-500" />
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Temps moyen (sec)</p>
                <p className="text-3xl font-bold">{displayData.avgDuration}s</p>
              </div>
              <div className="p-3 rounded-lg bg-secondary">
                <Clock className="w-6 h-6 text-muted-foreground" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Documents actifs</p>
                <p className="text-3xl font-bold">{displayData.totalDocuments}</p>
              </div>
              <div className="p-3 rounded-lg bg-secondary">
                <Plug className="w-6 h-6 text-muted-foreground" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="overview">Aperçu</TabsTrigger>
          <TabsTrigger value="connectors">Connecteurs</TabsTrigger>
          <TabsTrigger value="activity">Activité récente</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <Card>
            <CardHeader>
              <CardTitle>Synchronisations par jour</CardTitle>
              <CardDescription>Nombre de synchronisations sur la période</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-64 flex items-end justify-between gap-2">
                {displayData.syncByDay.map((day, index) => {
                  const maxCount = Math.max(...displayData.syncByDay.map(d => d.count))
                  const height = (day.count / maxCount) * 100
                  
                  return (
                    <div key={index} className="flex-1 flex flex-col items-center gap-2">
                      <div 
                        className="w-full bg-primary rounded-t"
                        style={{ height: `${height}%`, minHeight: "4px" }}
                      />
                      <span className="text-xs text-muted-foreground">
                        {new Date(day.date).toLocaleDateString("fr-FR", { weekday: "short" })}
                      </span>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="connectors">
          <Card>
            <CardHeader>
              <CardTitle>Utilisation des connecteurs</CardTitle>
              <CardDescription>Nombre de sync par connecteur</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {displayData.connectorsUsage.map((connector, index) => {
                  const total = displayData.connectorsUsage.reduce((acc, c) => acc + c.count, 0)
                  const percentage = Math.round((connector.count / total) * 100)
                  
                  return (
                    <div key={index} className="flex items-center gap-4">
                      <div className="w-32 font-medium">{connector.type}</div>
                      <div className="flex-1 h-4 bg-secondary rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-primary"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                      <div className="w-16 text-right text-sm text-muted-foreground">
                        {connector.count} ({percentage}%)
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="activity">
          <Card>
            <CardHeader>
              <CardTitle>Activité récente</CardTitle>
              <CardDescription>Dernières opérations</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {displayData.recentActivity.map((activity) => (
                  <div 
                    key={activity.id}
                    className="flex items-center justify-between p-3 rounded-lg border"
                  >
                    <div className="flex items-center gap-3">
                      {activity.status === "SUCCESS" ? (
                        <CheckCircle className="w-4 h-4 text-green-500" />
                      ) : activity.status === "ERROR" ? (
                        <AlertCircle className="w-4 h-4 text-red-500" />
                      ) : (
                        <Clock className="w-4 h-4 text-muted-foreground" />
                      )}
                      <span className="text-sm">{activity.action}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {new Date(activity.createdAt).toLocaleString("fr-FR")}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}