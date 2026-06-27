'use client'

import { useEffect } from 'react'

interface Shortcut {
  key: string
  ctrl?: boolean
  meta?: boolean
  handler: () => void
  description: string
}

export function useKeyboardShortcuts(shortcuts: Shortcut[]) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Skip if user is typing in an input/textarea/select
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return

      for (const shortcut of shortcuts) {
        const ctrlOrMeta = shortcut.ctrl || shortcut.meta
        const matchesCtrl = ctrlOrMeta
          ? (shortcut.ctrl && e.ctrlKey) || (shortcut.meta && e.metaKey)
          : true
        const matchesKey = e.key.toLowerCase() === shortcut.key.toLowerCase()

        if (matchesKey && matchesCtrl) {
          e.preventDefault()
          shortcut.handler()
          return
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [shortcuts])
}
