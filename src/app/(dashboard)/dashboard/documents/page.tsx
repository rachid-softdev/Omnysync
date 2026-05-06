import { auth } from "@/lib/auth"
import { t } from "@/lib/i18n"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { FileText } from "lucide-react"

export default async function DocumentsPage() {
  const session = await auth()

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">{t("UI_DOCS_LABEL")}</h1>
          <p className="text-muted-foreground mt-1">{t("UI_MANAGE_DOCS")}</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("UI_ALL_DOCS")}</CardTitle>
          <CardDescription>{t("UI_ALL_DOCS_DESC")}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12 text-muted-foreground">
            <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>{t("UI_NO_DOCS")}</p>
            <p className="text-sm mt-1">{t("UI_IMPORT_DOCS")}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}