import { auth } from "@/lib/auth"
import { t } from "@/lib/i18n"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { RefreshCw } from "lucide-react"
import Link from "next/link"

export default async function SyncPage() {
  const session = await auth()

  const recentSyncs = []

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">{t("UI_SYNC")}</h1>
          <p className="text-muted-foreground mt-1">{t("UI_SYNC_HISTORY")}</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("UI_RECENT_SYNCS")}</CardTitle>
          <CardDescription>{t("UI_SYNC_HISTORY_TITLE")}</CardDescription>
        </CardHeader>
        <CardContent>
          {recentSyncs.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <RefreshCw className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>{t("UI_NO_RECENT_SYNC")}</p>
              <Link href="/dashboard/sync/new">
                <Button className="mt-4">{t("UI_START_SYNC")}</Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {recentSyncs.map((sync) => (
                <div key={sync.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <p className="text-muted-foreground">{sync.title}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}