import { auth } from "@/lib/auth"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { FileText, Plug, CheckCircle, AlertCircle, ArrowRight } from "lucide-react"
import Link from "next/link"

export default async function DashboardPage() {
  const session = await auth()
  
  const stats = [
    { label: "Documents", value: "0", icon: FileText, color: "text-blue-500" },
    { label: "Connecteurs", value: "0", icon: Plug, color: "text-green-500" },
    { label: "Synchronisés", value: "0", icon: CheckCircle, color: "text-emerald-500" },
    { label: "Erreurs", value: "0", icon: AlertCircle, color: "text-red-500" },
  ]

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Bienvenue, {session?.user?.name}</h1>
          <p className="text-slate-500 mt-1">Gérez vos synchronisations de contenu</p>
        </div>
        <Link href="/dashboard/sync/new">
          <Button>
            <ArrowRight className="w-4 h-4 mr-2" />
            Nouvelle synchronisation
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardContent className="flex items-center gap-4 p-6">
              <div className={`p-3 rounded-lg bg-slate-100 ${stat.color}`}>
                <stat.icon className="w-6 h-6" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stat.value}</p>
                <p className="text-sm text-slate-500">{stat.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Activités récentes</CardTitle>
            <CardDescription>Vos dernières synchronisations</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-slate-500 text-sm">Aucune activité récente</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Guide de démarrage</CardTitle>
            <CardDescription>Premiers pas avec OmniSync</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-start gap-3">
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-slate-900 text-white text-xs">1</span>
              <p className="text-sm">Connectez vos sources (Google Docs, Notion)</p>
            </div>
            <div className="flex items-start gap-3">
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-slate-900 text-white text-xs">2</span>
              <p className="text-sm">Configurez vos destinations (WordPress, Ghost...)</p>
            </div>
            <div className="flex items-start gap-3">
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-slate-900 text-white text-xs">3</span>
              <p className="text-sm">Lancez votre première synchronisation</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}