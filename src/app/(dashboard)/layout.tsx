import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { 
  LayoutDashboard, 
  FileText, 
  Plug, 
  Settings, 
  LogOut,
  ArrowRightLeft
} from "lucide-react"
import { signOut } from "@/lib/auth"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()
  
  if (!session) {
    redirect("/auth/signin")
  }

  const navItems = [
    { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
    { href: "/dashboard/documents", icon: FileText, label: "Documents" },
    { href: "/dashboard/connectors", icon: Plug, label: "Connecteurs" },
    { href: "/dashboard/sync", icon: ArrowRightLeft, label: "Synchronisation" },
    { href: "/dashboard/settings", icon: Settings, label: "Paramètres" },
  ]

  return (
    <div className="min-h-screen flex">
      <aside className="w-64 bg-slate-900 text-white flex flex-col">
        <div className="p-6 border-b border-slate-800">
          <h1 className="text-xl font-bold">OmniSync</h1>
        </div>
        <nav className="flex-1 p-4">
          <ul className="space-y-2">
            {navItems.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="flex items-center gap-3 px-4 py-2 rounded-lg hover:bg-slate-800 transition-colors"
                >
                  <item.icon className="w-5 h-5" />
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="p-4 border-t border-slate-800">
          <div className="flex items-center gap-3 mb-4">
            {session.user.image && (
              <img
                src={session.user.image}
                alt={session.user.name || "User"}
                className="w-8 h-8 rounded-full"
              />
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{session.user.name}</p>
              <p className="text-xs text-slate-400 truncate">{session.user.email}</p>
            </div>
          </div>
          <form
            action={async () => {
              "use server"
              await signOut({ redirectTo: "/" })
            }}
          >
            <Button
              variant="ghost"
              className="w-full justify-start text-slate-300 hover:text-white"
              size="sm"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Déconnexion
            </Button>
          </form>
        </div>
      </aside>
      <main className="flex-1 bg-slate-50">
        {children}
      </main>
    </div>
  )
}