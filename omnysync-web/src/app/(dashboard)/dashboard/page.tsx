import { auth } from "@/lib/auth"
import { t } from "@/lib/i18n"
import { prisma } from "@/lib/prisma"
import { getUserOrgId } from "@/lib/auth/org"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { FileText, Plug, CheckCircle, AlertCircle, ArrowRight } from "lucide-react"
import Link from "next/link"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Dashboard",
  description: "Manage your content sync, connectors, and monitor your synchronization status.",
}

export default async function DashboardPage() {
  const session = await auth()

  if (!session?.user?.id) {
    return null
  }

  const orgId = await getUserOrgId(session.user.id)

  const [docCount, connectorCount, syncedCount, errorCount, recentLogs] = await Promise.all([
    prisma.document.count({ where: { organizationId: orgId } }),
    prisma.connector.count({ where: { organizationId: orgId } }),
    prisma.document.count({ where: { organizationId: orgId, syncStatus: "SYNCED" } }),
    prisma.document.count({ where: { organizationId: orgId, syncStatus: "FAILED" } }),
    prisma.syncLog.findMany({
      where: { organizationId: orgId },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { document: true },
    }),
  ])

  const stats = [
    { label: t("UI_DOCS_LABEL"), value: docCount.toString(), icon: FileText, color: "text-primary" },
    { label: t("UI_CONNECTORS_LABEL"), value: connectorCount.toString(), icon: Plug, color: "text-primary" },
    { label: t("UI_SYNCED"), value: syncedCount.toString(), icon: CheckCircle, color: "text-primary" },
    { label: t("UI_ERRORS"), value: errorCount.toString(), icon: AlertCircle, color: "text-destructive" },
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
            {recentLogs.length === 0 ? (
              <p className="text-muted-foreground text-sm">{t("UI_NO_ACTIVITY")}</p>
            ) : (
              <div className="space-y-3">
                {recentLogs.map((log) => (
                  <div key={log.id} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      {log.status === "SUCCESS" ? (
                        <CheckCircle className="w-4 h-4 text-green-500" />
                      ) : log.status === "ERROR" ? (
                        <AlertCircle className="w-4 h-4 text-destructive" />
                      ) : (
                        <AlertCircle className="w-4 h-4 text-muted-foreground" />
                      )}
                      <span>{log.message}</span>
                    </div>
                    <span className="text-muted-foreground text-xs">
                      {log.createdAt.toLocaleDateString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
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
