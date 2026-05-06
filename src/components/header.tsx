"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { ThemeToggle } from "@/components/theme-toggle"

export function Header() {
  const pathname = usePathname()
  
  if (pathname === "/" || pathname === "/auth/signin") return null

  return (
    <header className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-3 bg-background/80 backdrop-blur-sm border-b border-border">
      <Link href="/" className="text-xl font-bold">
        Omnysync
      </Link>
      <div className="flex items-center gap-4">
        <Link href="/auth/signin" className="text-sm font-medium text-muted-foreground hover:text-foreground">
          Sign In
        </Link>
        <ThemeToggle />
        <Link href="/auth/signin" className="inline-flex items-center justify-center rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
          Get Started
        </Link>
      </div>
    </header>
  )
}