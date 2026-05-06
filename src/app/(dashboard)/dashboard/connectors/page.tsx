import { auth } from "@/lib/auth"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"

export default async function ConnectorsPage() {
  const session = await auth()

  const sources = [
    { name: "Google Docs", type: "GOOGLE_DOCS", icon: "📄", connected: false },
    { name: "Notion", type: "NOTION", icon: "📝", connected: false },
  ]

  const destinations = [
    { name: "WordPress", type: "WORDPRESS", icon: "🔵", connected: false },
    { name: "Ghost", type: "GHOST", icon: "👻", connected: false },
    { name: "Webflow", type: "WEBFLOW", icon: "🌐", connected: false },
    { name: "Shopify", type: "SHOPIFY", icon: "🛒", connected: false },
  ]

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Connecteurs</h1>
          <p className="text-slate-500 mt-1">Gérez vos sources et destinations</p>
        </div>
        <Button>
          <Plus className="w-4 h-4 mr-2" />
          Ajouter un connecteur
        </Button>
      </div>

      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Sources</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sources.map((source) => (
            <Card key={source.type} className="hover:shadow-md transition-shadow cursor-pointer">
              <CardContent className="flex items-center gap-4 p-6">
                <span className="text-3xl">{source.icon}</span>
                <div className="flex-1">
                  <p className="font-medium">{source.name}</p>
                  <p className="text-sm text-slate-500">
                    {source.connected ? "Connecté" : "Non connecté"}
                  </p>
                </div>
                <Button variant={source.connected ? "outline" : "default"} size="sm">
                  {source.connected ? "Gérer" : "Connecter"}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <div>
        <h2 className="text-xl font-semibold mb-4">Destinations</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {destinations.map((dest) => (
            <Card key={dest.type} className="hover:shadow-md transition-shadow cursor-pointer">
              <CardContent className="flex items-center gap-4 p-6">
                <span className="text-3xl">{dest.icon}</span>
                <div className="flex-1">
                  <p className="font-medium">{dest.name}</p>
                  <p className="text-sm text-slate-500">
                    {dest.connected ? "Connecté" : "Non connecté"}
                  </p>
                </div>
                <Button variant={dest.connected ? "outline" : "default"} size="sm">
                  {dest.connected ? "Gérer" : "Connecter"}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}