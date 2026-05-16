import { auth } from "@/lib/auth"
import { t } from "@/lib/i18n"
import { redirect } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import {
  LayoutDashboard,
  FileText,
  Plug,
  Settings,
  LogOut,
  ArrowRightLeft,
  BarChart3,
  Webhook,
  FileCheck,
  Zap,
} from "lucide-react"
import { logoutAction } from "@/lib/actions"
import { MobileNav } from "@/components/mobile-nav"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()

  if (!session?.user) {
    redirect("/auth/signin")
  }

  const user = session.user
  const trans = t

  const navItems = [
    { href: "/dashboard", icon: LayoutDashboard, label: trans("UI_DASHBOARD") },
    { href: "/dashboard/documents", icon: FileText, label: trans("UI_DOCS_LABEL") },
    { href: "/dashboard/connectors", icon: Plug, label: trans("UI_CONNECTORS") },
    { href: "/dashboard/sync", icon: ArrowRightLeft, label: trans("UI_SYNC") },
    { href: "/dashboard/analytics", icon: BarChart3, label: trans("UI_ANALYTICS") || "Analytiques" },
    { href: "/dashboard/webhooks", icon: Webhook, label: trans("UI_WEBHOOKS") || "Webhooks" },
    { href: "/dashboard/approvals", icon: FileCheck, label: trans("UI_APPROVALS") || "Approbations" },
    { href: "/dashboard/usage", icon: Zap, label: trans("UI_USAGE") || "Utilisation" },
    { href: "/dashboard/settings", icon: Settings, label: trans("UI_SETTINGS") },
  ]

  return (
    <div className="min-h-screen flex">
      {/* Desktop sidebar - hidden on mobile */}
      <aside className="hidden md:flex w-64 bg-card border-r border-border flex-col">
        <div className="p-6 border-b border-border">
          <h1 className="text-xl font-bold">Omnysync</h1>
        </div>
        <nav className="flex-1 p-4">
          <ul className="space-y-2">
            {navItems.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="flex items-center gap-3 px-4 py-2 rounded-lg hover:bg-accent transition-colors"
                >
                  <item.icon className="w-5 h-5" />
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="p-4 border-t border-border">
          <div className="flex items-center gap-3 mb-4">
            {user.image && (
              <Image
                src={user.image}
                alt={user.name || "User"}
                width={32}
                height={32}
                className="rounded-full"
              />
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{user.name}</p>
              <p className="text-xs text-muted-foreground truncate">{user.email}</p>
            </div>
          </div>
          <Button
            variant="ghost"
            className="w-full justify-start text-muted-foreground hover:text-foreground"
            size="sm"
            onClick={() => logoutAction()}
          >
            <LogOut className="w-4 h-4 mr-2" />
            {trans("UI_LOGOUT")}
          </Button>
        </div>
      </aside>
      {/* Mobile navigation */}
      <MobileNav navItems={navItems} user={user} />
      <main className="flex-1 bg-background md:pt-0 pt-14">
        {children}
      </main>
    </div>
  )
}