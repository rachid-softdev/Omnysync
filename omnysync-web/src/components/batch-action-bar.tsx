'use client'

import { Button } from '@/components/ui/button'
import { X } from 'lucide-react'

interface BatchAction {
  label: string
  icon?: React.ReactNode
  variant?: 'default' | 'destructive' | 'outline'
  onClick: () => void
  loading?: boolean
}

interface BatchActionBarProps {
  selectedCount: number
  isAllSelected: boolean
  onSelectAll: () => void
  onClearSelection: () => void
  actions: BatchAction[]
}

export function BatchActionBar({
  selectedCount,
  isAllSelected,
  onSelectAll,
  onClearSelection,
  actions,
}: BatchActionBarProps) {
  if (selectedCount === 0) return null

  return (
    <div className="sticky top-0 z-10 -mx-8 px-8 py-3 mb-4 bg-primary/5 border-b border-primary/20 backdrop-blur-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onClearSelection} aria-label="Clear selection">
            <X className="w-4 h-4" />
          </Button>
          <span className="text-sm font-medium">
            {selectedCount} selected
            {!isAllSelected && (
              <button onClick={onSelectAll} className="ml-2 text-xs text-primary hover:underline">
                Select all
              </button>
            )}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {actions.map((action, i) => (
            <Button
              key={i}
              variant={action.variant || 'outline'}
              size="sm"
              onClick={action.onClick}
              disabled={action.loading}
            >
              {action.icon}
              {action.label}
            </Button>
          ))}
        </div>
      </div>
    </div>
  )
}
