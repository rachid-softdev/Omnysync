'use client'

import { useState, useCallback } from 'react'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useBatchSelect } from '@/hooks/use-batch-select'
import { BatchActionBar } from '@/components/batch-action-bar'
import { RefreshCw, Trash2 } from 'lucide-react'
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

const statusVariants: Record<string, 'secondary' | 'success' | 'warning' | 'destructive'> = {
  INFO: 'secondary',
  SUCCESS: 'success',
  WARNING: 'warning',
  ERROR: 'destructive',
}

const statusDots: Record<string, string> = {
  SUCCESS: 'bg-success',
  WARNING: 'bg-warning',
  ERROR: 'bg-destructive',
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
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div className="border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold">{t('UI_RECENT_SYNCS')}</h2>
          <p className="text-xs text-muted-foreground">{t('UI_SYNC_HISTORY_TITLE')}</p>
        </div>
        <div className="px-6 py-16 text-center">
          <span className="mx-auto grid size-10 place-items-center rounded-xl bg-muted">
            <RefreshCw className="size-5 text-muted-foreground" />
          </span>
          <p className="mt-4 text-sm font-medium">{t('UI_NO_RECENT_SYNC')}</p>
          <Button asChild className="mt-6">
            <Link href="/dashboard/sync/new">{t('UI_NEW_SYNC')}</Link>
          </Button>
        </div>
      </div>
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
              icon: <Trash2 className="size-4" />,
              variant: 'destructive',
              onClick: () => setClearConfirmOpen(true),
            },
          ]}
        />
      )}

      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold">{t('UI_RECENT_SYNCS')}</h2>
            <p className="text-xs text-muted-foreground">{t('UI_SYNC_HISTORY_TITLE')}</p>
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
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-10 pr-0">
                <span className="sr-only">Select</span>
              </TableHead>
              <TableHead>Operation</TableHead>
              <TableHead className="hidden lg:table-cell">Document</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Time</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {logs.map((log) => (
              <TableRow key={log.id}>
                <TableCell className="pr-0">
                  <Checkbox
                    checked={selectedIds.has(log.id)}
                    onCheckedChange={() => toggle(log.id)}
                    aria-label={`Select sync log ${log.action}`}
                  />
                </TableCell>
                <TableCell>
                  <p className="max-w-[28rem] truncate text-[13px] font-medium capitalize">
                    {log.action}
                  </p>
                  <p className="max-w-[28rem] truncate text-xs text-muted-foreground">
                    {log.message}
                  </p>
                </TableCell>
                <TableCell className="hidden lg:table-cell">
                  <span className="text-[13px] text-muted-foreground">
                    {log.document ? log.document.title : '—'}
                  </span>
                </TableCell>
                <TableCell>
                  <Badge variant={statusVariants[log.status] || 'secondary'}>
                    {statusDots[log.status] && (
                      <span
                        className={`size-1.5 rounded-full ${statusDots[log.status]}`}
                        aria-hidden="true"
                      />
                    )}
                    {log.status}
                  </Badge>
                </TableCell>
                <TableCell className="whitespace-nowrap text-right text-xs tabular-nums text-muted-foreground">
                  {formatDateTime(log.createdAt, locale)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

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
