import { auth } from "@/lib/auth"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { FileText, MoreVertical, ExternalLink } from "lucide-react"

export default async function DocumentsPage() {
  const session = await auth()

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Documents</h1>
          <p className="text-slate-500 mt-1">Gérez vos documents synchronisés</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Tous les documents</CardTitle>
          <CardDescription>Liste de tous vos documents importés</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12 text-slate-500">
            <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>Aucun document pour le moment</p>
            <p className="text-sm mt-1">Importez un document depuis Google Docs ou Notion</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}