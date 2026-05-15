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
  const [period, setPeriod] = useState("30")

  useEffect(() => {
    fetchAnalytics()
  }, [period])

  const fetchAnalytics = async () => {
    try {
      const res = await fetch(`/api/analytics?period=${period}`)
      if (res.ok) {
        const data = await res.json()
        setData(data)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  // Fallback data for demo
  const fallbackData: AnalyticsData = {
    totalSyncs: 42,
    successRate: 85,
    avgDuration: 12,
    totalDocuments: 28,
    activeConnectors: 5,
    failedSyncs: 6,
    recentActivity: [
      { id: "1", action: "sync_completed", status: "SUCCESS", createdAt: new Date().toISOString() },
      { id: "2", action: "sync_failed", status: "ERROR", createdAt: new Date(Date.now() - 3600000).toISOString() },
      { id: "3", action: "connector_created", status: "INFO", createdAt: new Date(Date.now() - 7200000).toISOString() },
    ],
    syncByDay: [
      { date: "2026-05-15", count: 5 },
      { date: "2026-05-14", count: 8 },
      { date: "2026-05-13", count: 3 },
      { date: "2026-05-12", count: 12 },
      { date: "2026-05-11", count: 6 },
      { date: "2026-05-10", count: 4 },
      { date: "2026-05-09", count: 7 },
    ],
    connectorsUsage: [
      { type: "WORDPRESS", count: 15 },
      { type: "GHOST", count: 8 },
      { type: "GOOGLE_DOCS", count: 12 },
      { type: "NOTION", count: 7 },
    ],
  }

  const displayData = data || fallbackData

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