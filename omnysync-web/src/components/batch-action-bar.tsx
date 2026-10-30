'use client'

import { Button } from '@/components/ui/button'
import { X } from 'lucide-react'
import { useTranslations } from '@/lib/i18n/useTranslations'

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
  locale?: string
}

/**
 * Sticky contextual toolbar shown while list rows are selected.
 * Sits below the fixed top bar (h-14) so it stays visible while scrolling.
 */
export function BatchActionBar({
  selectedCount,
  isAllSelected,
  onSelectAll,
  onClearSelection,
  actions,
  locale,
}: BatchActionBarProps) {
  const { t } = useTranslations(locale)

  if (selectedCount === 0) return null

  return (
    <div className="sticky top-14 z-20 -mx-6 mb-4 border-b border-border bg-background px-6 lg:-mx-8 lg:px-8">
      <div className="flex h-12 items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onClearSelection}
            aria-label={t('UI_CLEAR_SELECTION')}
          >
            <X />
          </Button>
          <span className="text-[13px] font-medium">
            {selectedCount} {t(selectedCount === 1 ? 'UI_SELECTED_ONE' : 'UI_SELECTED_OTHER')}
            {!isAllSelected && (
              <button
                type="button"
                onClick={onSelectAll}
                className="ml-2 text-xs font-normal text-primary hover:underline"
              >
                {t('UI_SELECT_ALL')}
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
