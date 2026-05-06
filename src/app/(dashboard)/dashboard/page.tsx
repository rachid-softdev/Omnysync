import { auth } from "@/lib/auth"
import { t } from "@/lib/i18n"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { FileText, Plug, CheckCircle, AlertCircle, ArrowRight } from "lucide-react"
import Link from "next/link"

export default async function DashboardPage() {
  const session = await auth()
  
  const stats = [
    { label: t("UI_DOCS_LABEL"), value: "0", icon: FileText, color: "text-primary" },
    { label: t("UI_CONNECTORS_LABEL"), value: "0", icon: Plug, color: "text-primary" },
    { label: t("UI_SYNCED"), value: "0", icon: CheckCircle, color: "text-primary" },
    { label: t("UI_ERRORS"), value: "0", icon: AlertCircle, color: "text-destructive" },
  ]

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">{t("UI_WELCOME")}, {session?.user?.name}</h1>
          <p className="text-muted-foreground mt-1">{t("UI_MANAGE_CONTENT")}</p>
        </div>
        <Link href="/dashboard/sync/new">
          <Button>
            <ArrowRight className="w-4 h-4 mr-2" />
            {t("UI_NEW_SYNC")}
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardContent className="flex items-center gap-4 p-6">
              <div className={`p-3 rounded-lg bg-accent ${stat.color}`}>
                <stat.icon className="w-6 h-6" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stat.value}</p>
                <p className="text-sm text-muted-foreground">{stat.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>{t("UI_RECENT_ACTIVITY")}</CardTitle>
            <CardDescription>{t("UI_LAST_SYNCS")}</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-sm">{t("UI_NO_ACTIVITY")}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("UI_GETTING_STARTED")}</CardTitle>
            <CardDescription>{t("UI_FIRST_STEPS")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-start gap-3">
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs">1</span>
              <p className="text-sm">{t("UI_DOCS_MARKETING")}</p>
            </div>
            <div className="flex items-start gap-3">
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs">2</span>
              <p className="text-sm">{t("UI_DESTINATIONS_SETUP")}</p>
            </div>
            <div className="flex items-start gap-3">
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs">3</span>
              <p className="text-sm">{t("UI_FIRST_SYNC")}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}