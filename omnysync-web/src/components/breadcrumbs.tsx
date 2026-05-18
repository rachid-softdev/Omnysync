"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

const pathLabels: Record<string, string> = {
  dashboard: "Dashboard",
  documents: "Documents",
  connectors: "Connectors",
  sync: "Sync",
  settings: "Settings",
  new: "New",
}

export function Breadcrumbs() {
  const pathname = usePathname()
  const segments = pathname.split("/").filter(Boolean)

  if (segments.length <= 1) return null

  return (
    <nav className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
      {segments.map((segment, index) => (
        <span key={segment} className="flex items-center gap-2">
          {index > 0 && <span>/</span>}
          <span className={index === segments.length - 1 ? "text-foreground font-medium" : ""}>
            {pathLabels[segment] || segment}
          </span>
        </span>
      ))}
    </nav>
  )
}