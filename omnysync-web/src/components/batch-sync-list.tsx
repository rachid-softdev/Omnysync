'use client'

import { useState, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { useBatchSelect } from '@/hooks/use-batch-select'
import { BatchActionBar } from '@/components/batch-action-bar'
import { RefreshCw, CheckCircle, AlertCircle, Clock, Trash2 } from 'lucide-react'
import { useTranslations } from '@/lib/i18n/useTranslations'
import { formatDateTime } from '@/lib/format-date'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { toast } from '@/components/toast-provider'

interface BatchSyncLog {
  id: string
  status: string
  action: string
  message: string
  createdAt: string
  document: { title: string } | null
}

interface BatchSyncListProps {
  syncLogs: BatchSyncLog[]
  locale: string
}

const statusIcons: Record<string, React.ReactNode> = {
  INFO: <Clock className="w-4 h-4 text-blue-500" />,
  SUCCESS: <CheckCircle className="w-4 h-4 text-green-500" />,
  WARNING: <AlertCircle className="w-4 h-4 text-yellow-500" />,
  ERROR: <AlertCircle className="w-4 h-4 text-destructive" />,
}

const statusVariants: Record<string, 'secondary' | 'default' | 'destructive' | 'outline'> = {
  INFO: 'secondary',
  SUCCESS: 'outline',
  WARNING: 'default',
  ERROR: 'destructive',
}

export function BatchSyncList({ syncLogs: initialLogs, locale }: BatchSyncListProps) {
  const { t } = useTranslations()
  const [logs, setLogs] = useState(initialLogs)
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false)

  const { selectedIds, selectedCount, isAllSelected, toggle, selectAll, clearSelection } =
    useBatchSelect(logs)

  const handleBatchClear = useCallback(() => {
    setLogs((prev) => prev.filter((l) => !selectedIds.has(l.id)))
    toast.success(`${selectedCount} log(s) cleared`)
    clearSelection()
    setClearConfirmOpen(false)
  }, [selectedIds, selectedCount, clearSelection])

  if (logs.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t('UI_RECENT_SYNCS')}</CardTitle>
          <CardDescription>{t('UI_SYNC_HISTORY_TITLE')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12 text-muted-foreground">
            <RefreshCw className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>{t('UI_NO_RECENT_SYNC')}</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="relative">
      {selectedCount > 0 && (
        <BatchActionBar
          selectedCount={selectedCount}
          isAllSelected={isAllSelected}
          onSelectAll={selectAll}
          onClearSelection={clearSelection}
          actions={[
            {
              label: 'Clear selected logs',
              icon: <Trash2 className="w-4 h-4 mr-1" />,
              variant: 'destructive',
              onClick: () => setClearConfirmOpen(true),
            },
          ]}
        />
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>{t('UI_RECENT_SYNCS')}</CardTitle>
              <CardDescription>{t('UI_SYNC_HISTORY_TITLE')}</CardDescription>
            </div>
            <Checkbox
              id="select-all-syncs"
              aria-label="Select all sync logs"
              checked={isAllSelected}
              onCheckedChange={(checked) => {
                if (checked) selectAll()
                else clearSelection()
              }}
            />
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {logs.map((log) => (
              <div
                key={log.id}
                className="flex items-center justify-between p-3 border border-border rounded-lg"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <Checkbox
                    checked={selectedIds.has(log.id)}
                    onCheckedChange={() => toggle(log.id)}
                    aria-label={`Select sync log ${log.action}`}
                  />
                  {statusIcons[log.status]}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {log.document?.title || log.action}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">{log.message}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant={statusVariants[log.status] || 'secondary'}>{log.status}</Badge>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {formatDateTime(log.createdAt, locale)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={clearConfirmOpen} onOpenChange={setClearConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear sync logs</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove {selectedCount} log(s) from this list? This action
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBatchClear}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Clear
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
