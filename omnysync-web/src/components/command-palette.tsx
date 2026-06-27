'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Search,
  LayoutDashboard,
  FileText,
  Plug,
  ArrowRightLeft,
  Plus,
  BarChart3,
  FileCheck,
  Zap,
  Webhook,
  Settings,
} from 'lucide-react'
import { Dialog, DialogContent } from '@/components/ui/dialog'

// ---------------------------------------------------------------------------
// Module-level imperative handle so sibling components (e.g. KeyboardShortcuts,
// sidebar badge) can open the palette without shared state or context.
// ---------------------------------------------------------------------------
let _setOpen: ((open: boolean) => void) | null = null

/** Programmatic opener – call from any React component or handler. */
export function openCommandPalette() {
  _setOpen?.(true)
}

// ---------------------------------------------------------------------------
// Command definitions
// ---------------------------------------------------------------------------
interface Command {
  id: string
  icon: React.ComponentType<{ className?: string }>
  label: string
  shortcut: string
  href: string
}

const COMMANDS: Command[] = [
  {
    id: 'dashboard',
    icon: LayoutDashboard,
    label: 'Dashboard',
    shortcut: '⌘G',
    href: '/dashboard',
  },
  {
    id: 'documents',
    icon: FileText,
    label: 'Documents',
    shortcut: '⌘D',
    href: '/dashboard/documents',
  },
  {
    id: 'connectors',
    icon: Plug,
    label: 'Connectors',
    shortcut: '⌘C',
    href: '/dashboard/connectors',
  },
  {
    id: 'sync',
    icon: ArrowRightLeft,
    label: 'Sync',
    shortcut: '⌘S',
    href: '/dashboard/sync',
  },
  {
    id: 'new-sync',
    icon: Plus,
    label: 'New Sync',
    shortcut: '⌘N',
    href: '/dashboard/sync/new',
  },
  {
    id: 'analytics',
    icon: BarChart3,
    label: 'Analytics',
    shortcut: '⌘⇧A',
    href: '/dashboard/analytics',
  },
  {
    id: 'approvals',
    icon: FileCheck,
    label: 'Approvals',
    shortcut: '⌘⇧P',
    href: '/dashboard/approvals',
  },
  {
    id: 'usage',
    icon: Zap,
    label: 'Usage',
    shortcut: '⌘U',
    href: '/dashboard/usage',
  },
  {
    id: 'webhooks',
    icon: Webhook,
    label: 'Webhooks',
    shortcut: '⌘W',
    href: '/dashboard/webhooks',
  },
  {
    id: 'settings',
    icon: Settings,
    label: 'Settings',
    shortcut: '⌘,',
    href: '/dashboard/settings',
  },
]

// ---------------------------------------------------------------------------
// CommandPalette – the dialog component
// ---------------------------------------------------------------------------
export function CommandPalette() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  // Register the module-level setter so openCommandPalette() works.
  useEffect(() => {
    _setOpen = setOpen
    return () => {
      _setOpen = null
    }
  }, [])

  // Toggle on Ctrl+K / Cmd+K.
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen((prev) => !prev)
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Auto-focus the search input when the dialog opens.
  useEffect(() => {
    if (open) {
      // Use a microtask to let Radix mount the dialog portal first.
      queueMicrotask(() => inputRef.current?.focus())
    }
  }, [open])

  const filteredCommands = query
    ? COMMANDS.filter((cmd) => cmd.label.toLowerCase().includes(query.toLowerCase()))
    : COMMANDS

  const executeCommand = useCallback(
    (cmd: Command) => {
      router.push(cmd.href)
      setOpen(false)
    },
    [router]
  )

  const handleOpenChange = useCallback((open: boolean) => {
    setOpen(open)
    if (!open) {
      setQuery('')
      setActiveIndex(0)
    }
  }, [])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault()
          setActiveIndex((prev) => (prev < filteredCommands.length - 1 ? prev + 1 : prev))
          break
        case 'ArrowUp':
          e.preventDefault()
          setActiveIndex((prev) => (prev > 0 ? prev - 1 : prev))
          break
        case 'Enter':
          e.preventDefault()
          if (filteredCommands[activeIndex]) {
            executeCommand(filteredCommands[activeIndex])
          }
          break
      }
    },
    [filteredCommands, activeIndex, executeCommand]
  )

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md p-0 overflow-hidden motion-reduce:animate-none [&>button]:hidden">
        {/* Search bar */}
        <div
          className="flex items-center gap-3 px-4 border-b border-border"
          onKeyDown={handleKeyDown}
        >
          <Search className="w-4 h-4 shrink-0 text-muted-foreground" />
          <input
            ref={inputRef}
            type="text"
            role="combobox"
            aria-expanded="true"
            aria-haspopup="listbox"
            placeholder="Search commands…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setActiveIndex(0)
            }}
            className="flex-1 h-12 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>

        {/* Results list */}
        <div className="max-h-80 overflow-y-auto p-2">
          {filteredCommands.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No results found</p>
          ) : (
            <ul role="listbox" aria-label="Commands">
              {filteredCommands.map((cmd, index) => {
                const Icon = cmd.icon
                const isActive = index === activeIndex
                return (
                  <li key={cmd.id} role="option" aria-selected={isActive}>
                    <button
                      className={`flex items-center w-full gap-3 px-3 py-2.5 rounded-md text-sm transition-colors ${
                        isActive
                          ? 'bg-accent text-accent-foreground'
                          : 'text-foreground hover:bg-accent'
                      }`}
                      onClick={() => executeCommand(cmd)}
                      onMouseEnter={() => setActiveIndex(index)}
                    >
                      <Icon className="w-4 h-4 shrink-0 text-muted-foreground" />
                      <span className="flex-1 text-left">{cmd.label}</span>
                      <kbd className="text-[10px] leading-none font-mono text-muted-foreground bg-muted px-1.5 py-1 rounded">
                        {cmd.shortcut}
                      </kbd>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ---------------------------------------------------------------------------
// CommandPaletteTrigger – small ⌘K badge for the sidebar footer.
// ---------------------------------------------------------------------------
export function CommandPaletteTrigger() {
  return (
    <button
      type="button"
      onClick={openCommandPalette}
      className="mt-3 flex items-center justify-center gap-1.5 w-full px-3 py-1.5 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
      aria-label="Open command palette"
    >
      <kbd className="text-[10px] leading-none font-mono bg-muted px-1 py-0.5 rounded">⌘K</kbd>
      <span>Commands</span>
    </button>
  )
}
