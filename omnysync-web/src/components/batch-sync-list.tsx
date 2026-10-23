'use client'

import { useState, useCallback } from 'react'
import Link from 'next/link'
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

const statusDots: Record<string, string> = {
  SUCCESS: 'bg-success',
  WARNING: 'bg-warning',
  ERROR: 'bg-destructive',
  INFO: 'bg-info',
}

const statusTones: Record<string, string> = {
  SUCCESS: 'text-success',
  WARNING: 'text-warning',
  ERROR: 'text-destructive',
  INFO: 'text-info',
}

export function BatchSyncList({ syncLogs: initialLogs, locale }: BatchSyncListProps) {
  const { t } = useTranslations()
  const [logs, setLogs] = useState(initialLogs)
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false)

  const { selectedIds, selectedCount, isAllSelected, toggle, selectAll, clearSelection } =
    useBatchSelect(logs)

  const statusLabels: Record<string, string> = {
    SUCCESS: t('UI_STATUS_SUCCESS'),
    WARNING: t('UI_STATUS_WARNING'),
    ERROR: t('UI_STATUS_ERROR'),
    INFO: t('UI_STATUS_INFO'),
  }

  const handleBatchClear = useCallback(() => {
    setLogs((prev) => prev.filter((l) => !selectedIds.has(l.id)))
    toast.success(`${selectedCount} log(s) cleared`)
    clearSelection()
    setClearConfirmOpen(false)
  }, [selectedIds, selectedCount, clearSelection])

  if (logs.length === 0) {
    return (
      <div className="border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-5 py-3 font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground">
          <span>{t('UI_RECENT_SYNCS')}</span>
          <span className="tabular-nums">00</span>
        </div>
        <div className="flex flex-col gap-4 p-6 sm:flex-row sm:items-start sm:p-8">
          <span className="grid size-10 shrink-0 place-items-center border border-border bg-muted text-muted-foreground">
            <RefreshCw className="size-5" />
          </span>
          <div className="max-w-xl">
            <p className="text-base font-semibold tracking-[-0.02em]">{t('UI_NO_RECENT_SYNC')}</p>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              {t('UI_SYNC_HISTORY_TITLE')}
            </p>
            <Button asChild className="mt-5">
              <Link href="/dashboard/sync/new">{t('UI_NEW_SYNC')}</Link>
            </Button>
          </div>
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

      <div className="border border-border bg-card">
        <div className="flex items-center justify-between gap-3 border-b border-border bg-muted/30 px-4 py-2.5">
          <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground">
            {t('UI_RECENT_SYNCS')} / {String(logs.length).padStart(2, '0')}
          </span>
          <label className="flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.12em] text-muted-foreground">
            <span className="hidden sm:inline">{t('UI_SELECT_ALL')}</span>
            <Checkbox
              id="select-all-syncs"
              aria-label="Select all sync logs"
              checked={isAllSelected}
              onCheckedChange={(checked) => {
                if (checked) selectAll()
                else clearSelection()
              }}
            />
          </label>
        </div>
        <Table>
          <TableHeader className="bg-muted/40">
            <TableRow className="border-border hover:bg-transparent">
              <TableHead className="w-10 px-2 pr-0 sm:px-4">
                <span className="sr-only">Select</span>
              </TableHead>
              <TableHead className="h-9 px-2 font-mono text-[9px] uppercase tracking-[0.14em] sm:px-4">
                {t('UI_OPERATION')}
              </TableHead>
              <TableHead className="hidden h-9 px-4 font-mono text-[9px] uppercase tracking-[0.14em] lg:table-cell">
                {t('UI_DOCUMENT')}
              </TableHead>
              <TableHead className="h-9 px-2 font-mono text-[9px] uppercase tracking-[0.14em] sm:px-4">
                {t('UI_STATUS')}
              </TableHead>
              <TableHead className="hidden h-9 px-4 text-right font-mono text-[9px] uppercase tracking-[0.14em] sm:table-cell">
                {t('UI_TIME')}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {logs.map((log) => (
              <TableRow key={log.id} className="group border-border hover:bg-muted/30">
                <TableCell className="px-2 pr-0 sm:px-4">
                  <Checkbox
                    checked={selectedIds.has(log.id)}
                    onCheckedChange={() => toggle(log.id)}
                    aria-label={`Select sync log ${log.action}`}
                  />
                </TableCell>
                <TableCell className="px-2 py-2.5 sm:px-4">
                  <p className="max-w-[12rem] truncate font-mono text-[9px] uppercase tracking-[0.12em] text-muted-foreground sm:max-w-[28rem]">
                    {log.action}
                  </p>
                  <p className="mt-0.5 max-w-[12rem] truncate text-[13px] sm:max-w-[28rem]">
                    {log.message}
                  </p>
                  <p className="mt-0.5 font-mono text-[9px] tabular-nums text-muted-foreground sm:hidden">
                    {formatDateTime(log.createdAt, locale)}
                  </p>
                </TableCell>
                <TableCell className="hidden lg:table-cell">
                  <span className="block max-w-[18rem] truncate text-[13px] text-muted-foreground">
                    {log.document ? log.document.title : '—'}
                  </span>
                </TableCell>
                <TableCell className="px-2 text-right sm:px-4">
                  <span
                    className={`inline-flex items-center gap-1.5 whitespace-nowrap font-mono text-[9px] uppercase tracking-[0.12em] ${
                      statusTones[log.status] || 'text-muted-foreground'
                    }`}
                  >
                    <span
                      className={`size-1.5 ${statusDots[log.status] || 'bg-muted-foreground/40'}`}
                      aria-hidden="true"
                    />
                    {statusLabels[log.status]?.toUpperCase() || log.status}
                  </span>
                </TableCell>
                <TableCell className="hidden whitespace-nowrap px-4 text-right font-mono text-[10px] tabular-nums text-muted-foreground sm:table-cell">
                  {formatDateTime(log.createdAt, locale)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <div className="flex items-center justify-between border-t border-border bg-muted/20 px-4 py-2.5 font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground">
          <span>
            {logs.length} {t('UI_RECENT_SYNCS').toLowerCase()}
          </span>
          <span>{t('UI_ACTIVE')}</span>
        </div>
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
