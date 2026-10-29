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
import { ArrowRight, FileText, Trash2 } from 'lucide-react'
import { useTranslations } from '@/lib/i18n/useTranslations'
import { formatDate } from '@/lib/format-date'
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

interface BatchDocument {
  id: string
  title: string
  syncStatus: string
  updatedAt: string
  sourceConnector: { type: string } | null
  destConnector: { type: string } | null
}

interface BatchDocumentListProps {
  documents: BatchDocument[]
  locale: string
}

const statusDots: Record<string, string> = {
  NOT_SYNCED: 'border border-border-strong',
  SYNCING: 'bg-info',
  SYNCED: 'bg-success',
  FAILED: 'bg-destructive',
}

const statusTones: Record<string, string> = {
  NOT_SYNCED: 'text-muted-foreground',
  SYNCING: 'text-info',
  SYNCED: 'text-success',
  FAILED: 'text-destructive',
}

export function BatchDocumentList({ documents: initialDocuments, locale }: BatchDocumentListProps) {
  const { t } = useTranslations(locale)
  const [docs, setDocs] = useState(initialDocuments)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)

  const { selectedIds, selectedCount, isAllSelected, toggle, selectAll, clearSelection } =
    useBatchSelect(docs)

  const statusLabels: Record<string, string> = {
    NOT_SYNCED: t('UI_STATUS_NOT_SYNCED'),
    SYNCING: t('UI_STATUS_SYNCING'),
    SYNCED: t('UI_STATUS_SYNCED'),
    FAILED: t('UI_STATUS_FAILED'),
  }

  const handleBatchDelete = useCallback(() => {
    setDocs((prev) => prev.filter((d) => !selectedIds.has(d.id)))
    toast.success(
      t(
        selectedCount === 1 ? 'UI_DOCUMENTS_REMOVED_TOAST_ONE' : 'UI_DOCUMENTS_REMOVED_TOAST_OTHER'
      ).replace('{count}', String(selectedCount))
    )
    clearSelection()
    setDeleteConfirmOpen(false)
  }, [selectedIds, selectedCount, clearSelection, t])

  if (docs.length === 0) {
    return (
      <div className="border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-5 py-3 font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground">
          <span>{t('UI_ALL_DOCS')}</span>
          <span className="tabular-nums">00</span>
        </div>
        <div className="flex flex-col gap-4 p-6 sm:flex-row sm:items-start sm:p-8">
          <span className="grid size-10 shrink-0 place-items-center border border-border bg-muted text-muted-foreground">
            <FileText className="size-5" />
          </span>
          <div className="max-w-xl">
            <p className="text-base font-semibold tracking-[-0.02em]">{t('UI_NO_DOCS')}</p>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              {t('UI_IMPORT_DOCS')}
            </p>
            <Button asChild className="mt-5">
              <Link href="/dashboard/connectors">
                {t('UI_CONNECT_FIRST')}
                <ArrowRight className="size-4" />
              </Link>
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
          locale={locale}
          actions={[
            {
              label: t('UI_DELETE'),
              icon: <Trash2 className="size-4" />,
              variant: 'destructive',
              onClick: () => setDeleteConfirmOpen(true),
            },
          ]}
        />
      )}

      <div className="border border-border bg-card">
        <Table>
          <TableHeader className="bg-muted/40">
            <TableRow className="border-border hover:bg-transparent">
              <TableHead className="h-9 w-10 px-2 pr-0 sm:px-4">
                <Checkbox
                  id="select-all-docs"
                  aria-label={t('UI_SELECT_ALL_DOCUMENTS')}
                  checked={isAllSelected}
                  onCheckedChange={(checked) => {
                    if (checked) selectAll()
                    else clearSelection()
                  }}
                />
              </TableHead>
              <TableHead className="h-9 px-2 font-mono text-[9px] uppercase tracking-[0.14em] sm:px-4">
                {t('UI_DOCUMENT')}
              </TableHead>
              <TableHead className="hidden h-9 px-4 font-mono text-[9px] uppercase tracking-[0.14em] md:table-cell">
                {t('UI_PIPELINE')}
              </TableHead>
              <TableHead className="hidden h-9 px-4 font-mono text-[9px] uppercase tracking-[0.14em] sm:table-cell">
                {t('UI_UPDATED')}
              </TableHead>
              <TableHead className="h-9 px-2 text-right font-mono text-[9px] uppercase tracking-[0.14em] sm:px-4">
                {t('UI_STATUS')}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {docs.map((doc) => (
              <TableRow key={doc.id} className="group border-border hover:bg-muted/30">
                <TableCell className="px-2 pr-0 sm:px-4">
                  <Checkbox
                    checked={selectedIds.has(doc.id)}
                    onCheckedChange={() => toggle(doc.id)}
                    aria-label={t('UI_SELECT_DOCUMENT_ITEM').replace('{title}', doc.title)}
                  />
                </TableCell>
                <TableCell className="px-2 py-2.5 sm:px-4">
                  <div className="min-w-0">
                    <Link
                      href={`/dashboard/documents/${doc.id}`}
                      className="block max-w-[12rem] truncate text-[13px] font-medium outline-none focus-visible:text-primary focus-visible:underline sm:max-w-[28rem]"
                    >
                      {doc.title}
                    </Link>
                    <p className="mt-0.5 max-w-[12rem] truncate font-mono text-[9px] uppercase tracking-[0.1em] text-muted-foreground/60 sm:max-w-none">
                      DOC / {doc.id.slice(0, 8)}
                    </p>
                  </div>
                </TableCell>
                <TableCell className="hidden md:table-cell">
                  <span className="font-mono text-[10px] uppercase tracking-[0.06em] text-muted-foreground">
                    {doc.sourceConnector?.type?.replace(/_/g, ' ') || '—'}
                    <span className="mx-2 text-border-strong">→</span>
                    {doc.destConnector?.type?.replace(/_/g, ' ') || '—'}
                  </span>
                </TableCell>
                <TableCell className="hidden whitespace-nowrap font-mono text-[10px] tabular-nums text-muted-foreground sm:table-cell">
                  {formatDate(doc.updatedAt, locale)}
                </TableCell>
                <TableCell className="px-2 text-right sm:px-4">
                  <span
                    className={`inline-flex items-center gap-1.5 whitespace-nowrap font-mono text-[9px] uppercase tracking-[0.12em] ${
                      statusTones[doc.syncStatus] || 'text-muted-foreground'
                    }`}
                  >
                    <span
                      className={`size-1.5 ${statusDots[doc.syncStatus] || 'bg-muted-foreground/40'}`}
                      aria-hidden="true"
                    />
                    {statusLabels[doc.syncStatus] || doc.syncStatus}
                  </span>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <div className="flex items-center justify-between border-t border-border bg-muted/20 px-4 py-2.5 font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground">
          <span>
            {docs.length} {t('UI_DOCS_LABEL').toLowerCase()}
          </span>
          <span>{t('UI_ACTIVE')}</span>
        </div>
      </div>

      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('UI_DELETE_DOCUMENTS_TITLE')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t(
                selectedCount === 1
                  ? 'UI_DELETE_DOCUMENTS_DESC_ONE'
                  : 'UI_DELETE_DOCUMENTS_DESC_OTHER'
              ).replace('{count}', String(selectedCount))}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('UI_CANCEL')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBatchDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t('UI_DELETE')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
