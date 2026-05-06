import { auth } from "@/lib/auth"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { RefreshCw, Clock, CheckCircle, XCircle } from "lucide-react"

export default async function SyncPage() {
  const session = await auth()

  const recentSyncs = []

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Synchronisation</h1>
          <p className="text-slate-500 mt-1">Historique et gestion des synchronisations</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Synchronisations récentes</CardTitle>
          <CardDescription>Historique de vos synchronisations</CardDescription>
        </CardHeader>
        <CardContent>
          {recentSyncs.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <RefreshCw className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Aucune synchronisation récente</p>
              <Button className="mt-4">Lancer une synchronisation</Button>
            </div>
          ) : (
            <div className="space-y-4">
              {recentSyncs.map((sync) => (
                <div key={sync.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-4">
                    {sync.status === "success" && <CheckCircle className="text-green-500" />}
                    {sync.status === "pending" && <Clock className="text-yellow-500" />}
                    {sync.status === "failed" && <XCircle className="text-red-500" />}
                    <div>
                      <p className="font-medium">{sync.title}</p>
                      <p className="text-sm text-slate-500">{sync.date}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}