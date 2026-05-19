'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Progress } from '@/components/ui/progress'
import {
  Loader2,
  TrendingUp,
  Zap,
  FileText,
  Users,
  Image,
  Link2,
  BarChart3,
  Calendar,
  Clock,
} from 'lucide-react'
import { useTranslations } from '@/lib/i18n/useTranslations'

interface UsageData {
  currentPlan: string
  billingCycle: { start: string; end: string }

  // Syncs
  syncUsed: number
  syncLimit: number

  // Documents
  documentsUsed: number
  documentsLimit: number

  // Connectors
  connectorsUsed: number
  connectorsLimit: number

  // Team
  teamUsed: number
  teamLimit: number

  // AI Usage
  aiSEO: number
  aiImages: number
  aiInterlinking: number

  // History
  history: Array<{
    month: string
    syncs: number
    documents: number
    aiCalls: number
  }>
}

export default function UsagePage() {
  const { t } = useTranslations()
  const [loading, setLoading] = useState(true)
  const [usage, setUsage] = useState<UsageData | null>(null)

  useEffect(() => {
    fetchUsage()
  }, [])

  const fetchUsage = async () => {
    try {
      const res = await fetch('/api/usage')
      if (res.ok) {
        const data = await res.json()
        setUsage(data)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  // Données de demo
  const demoUsage: UsageData = {
    currentPlan: 'Pro',
    billingCycle: {
      start: '2026-05-01',
      end: '2026-05-31',
    },
    syncUsed: 67,
    syncLimit: 100,
    documentsUsed: 45,
    documentsLimit: -1, // Unlimited
    connectorsUsed: 6,
    connectorsLimit: 10,
    teamUsed: 3,
    teamLimit: 5,
    aiSEO: 23,
    aiImages: 12,
    aiInterlinking: 8,
    history: [
      { month: '2026-05', syncs: 67, documents: 45, aiCalls: 43 },
      { month: '2026-04', syncs: 52, documents: 38, aiCalls: 31 },
      { month: '2026-03', syncs: 48, documents: 32, aiCalls: 28 },
      { month: '2026-02', syncs: 35, documents: 25, aiCalls: 19 },
      { month: '2026-01', syncs: 28, documents: 20, aiCalls: 12 },
    ],
  }

  const displayUsage = usage || demoUsage

  const getUsagePercentage = (used: number, limit: number) => {
    if (limit === -1) return 0 // Unlimited
    return Math.round((used / limit) * 100)
  }

  const getUsageColor = (percentage: number) => {
    if (percentage >= 90) return 'text-red-500'
    if (percentage >= 75) return 'text-yellow-500'
    return 'text-muted-foreground'
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
      <div className="mb-8">
        <h1 className="text-3xl font-bold">{t('USAGE_TITLE') || 'Utilisation'}</h1>
        <p className="text-muted-foreground mt-1">
          {t('USAGE_SUBTITLE') || 'Suivez votre consommation et vos limites'}
        </p>
      </div>

      {/* Plan Info */}
      <Card className="mb-8">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3">
                <h2 className="text-2xl font-bold">Plan {displayUsage.currentPlan}</h2>
                <Badge variant="default">Actif</Badge>
              </div>
              <p className="text-muted-foreground mt-1">
                Cycle de facturation:{' '}
                {new Date(displayUsage.billingCycle.start).toLocaleDateString('fr-FR')} -{' '}
                {new Date(displayUsage.billingCycle.end).toLocaleDateString('fr-FR')}
              </p>
            </div>
            <Button variant="outline">Changer de plan</Button>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="mb-6">
          <TabsTrigger value="overview">Aperçu</TabsTrigger>
          <TabsTrigger value="ai">IA</TabsTrigger>
          <TabsTrigger value="history">Historique</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Syncs */}
            <Card>
              <CardHeader className="pb-3">
                <CardDescription className="flex items-center gap-2">
                  <Zap className="w-4 h-4" />
                  Synchronisations
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold mb-2">
                  {displayUsage.syncUsed}
                  <span className="text-lg text-muted-foreground">/{displayUsage.syncLimit}</span>
                </div>
                <Progress
                  value={getUsagePercentage(displayUsage.syncUsed, displayUsage.syncLimit)}
                  className="h-2"
                />
                <p
                  className={`text-sm mt-2 ${getUsageColor(getUsagePercentage(displayUsage.syncUsed, displayUsage.syncLimit))}`}
                >
                  {displayUsage.syncLimit - displayUsage.syncUsed} restantes ce mois
                </p>
              </CardContent>
            </Card>

            {/* Documents */}
            <Card>
              <CardHeader className="pb-3">
                <CardDescription className="flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  Documents
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold mb-2">
                  {displayUsage.documentsUsed}
                  <span className="text-lg text-muted-foreground">
                    {displayUsage.documentsLimit === -1 ? '/∞' : `/${displayUsage.documentsLimit}`}
                  </span>
                </div>
                {displayUsage.documentsLimit !== -1 && (
                  <>
                    <Progress
                      value={getUsagePercentage(
                        displayUsage.documentsUsed,
                        displayUsage.documentsLimit
                      )}
                      className="h-2"
                    />
                    <p
                      className={`text-sm mt-2 ${getUsageColor(getUsagePercentage(displayUsage.documentsUsed, displayUsage.documentsLimit))}`}
                    >
                      {displayUsage.documentsLimit - displayUsage.documentsUsed} restantes
                    </p>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Connectors */}
            <Card>
              <CardHeader className="pb-3">
                <CardDescription className="flex items-center gap-2">
                  <Link2 className="w-4 h-4" />
                  Connecteurs
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold mb-2">
                  {displayUsage.connectorsUsed}
                  <span className="text-lg text-muted-foreground">
                    /{displayUsage.connectorsLimit}
                  </span>
                </div>
                <Progress
                  value={getUsagePercentage(
                    displayUsage.connectorsUsed,
                    displayUsage.connectorsLimit
                  )}
                  className="h-2"
                />
                <p
                  className={`text-sm mt-2 ${getUsageColor(getUsagePercentage(displayUsage.connectorsUsed, displayUsage.connectorsLimit))}`}
                >
                  {displayUsage.connectorsLimit - displayUsage.connectorsUsed} disponibles
                </p>
              </CardContent>
            </Card>

            {/* Team */}
            <Card>
              <CardHeader className="pb-3">
                <CardDescription className="flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  Équipe
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold mb-2">
                  {displayUsage.teamUsed}
                  <span className="text-lg text-muted-foreground">/{displayUsage.teamLimit}</span>
                </div>
                <Progress
                  value={getUsagePercentage(displayUsage.teamUsed, displayUsage.teamLimit)}
                  className="h-2"
                />
                <p
                  className={`text-sm mt-2 ${getUsageColor(getUsagePercentage(displayUsage.teamUsed, displayUsage.teamLimit))}`}
                >
                  {displayUsage.teamLimit - displayUsage.teamUsed} places restantes
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="ai">
          <Card>
            <CardHeader>
              <CardTitle>Utilisation IA</CardTitle>
              <CardDescription>Nombre d'appels aux fonctionnalités IA ce mois-ci</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-3 gap-6">
                <div className="p-6 rounded-lg border bg-muted/50">
                  <div className="flex items-center gap-3 mb-4">
                    <BarChart3 className="w-5 h-5 text-primary" />
                    <h3 className="font-semibold">SEO</h3>
                  </div>
                  <p className="text-4xl font-bold">{displayUsage.aiSEO}</p>
                  <p className="text-sm text-muted-foreground mt-2">
                    Générations de métadonnées SEO
                  </p>
                </div>

                <div className="p-6 rounded-lg border bg-muted/50">
                  <div className="flex items-center gap-3 mb-4">
                    <Image className="w-5 h-5 text-primary" />
                    <h3 className="font-semibold">Images</h3>
                  </div>
                  <p className="text-4xl font-bold">{displayUsage.aiImages}</p>
                  <p className="text-sm text-muted-foreground mt-2">Images générées avec DALL-E</p>
                </div>

                <div className="p-6 rounded-lg border bg-muted/50">
                  <div className="flex items-center gap-3 mb-4">
                    <Link2 className="w-5 h-5 text-primary" />
                    <h3 className="font-semibold">Maillage</h3>
                  </div>
                  <p className="text-4xl font-bold">{displayUsage.aiInterlinking}</p>
                  <p className="text-sm text-muted-foreground mt-2">
                    Suggestions de liens internes
                  </p>
                </div>
              </div>

              <div className="mt-8 p-4 rounded-lg bg-muted">
                <h4 className="font-semibold mb-2">
                  {' '}
                  Fonctionnalités IA (Plan {displayUsage.currentPlan})
                </h4>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  <li>✓ SEO automatique</li>
                  <li>✓ Génération d'images</li>
                  {displayUsage.currentPlan === 'Pro' && <li>✓ Maillage interne</li>}
                  {displayUsage.currentPlan !== 'Free' && <li>✓ Amélioration de contenu</li>}
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle>Historique d'utilisation</CardTitle>
              <CardDescription>Vos statistiques mensuelles</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-4 font-medium">Mois</th>
                      <th className="text-right py-3 px-4 font-medium">Syncs</th>
                      <th className="text-right py-3 px-4 font-medium">Documents</th>
                      <th className="text-right py-3 px-4 font-medium">Appels IA</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayUsage.history.map((month) => (
                      <tr key={month.month} className="border-b">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-muted-foreground" />
                            {new Date(month.month + '-01').toLocaleDateString('fr-FR', {
                              month: 'long',
                              year: 'numeric',
                            })}
                          </div>
                        </td>
                        <td className="text-right py-3 px-4 font-medium">{month.syncs}</td>
                        <td className="text-right py-3 px-4 font-medium">{month.documents}</td>
                        <td className="text-right py-3 px-4 font-medium">{month.aiCalls}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
