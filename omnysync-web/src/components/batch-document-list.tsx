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
import { FileText, Trash2 } from 'lucide-react'
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

const statusLabels: Record<string, string> = {
  NOT_SYNCED: 'Not synced',
  SYNCING: 'Syncing',
  SYNCED: 'Synced',
  FAILED: 'Failed',
}

const statusVariants: Record<string, 'secondary' | 'info' | 'success' | 'destructive'> = {
  NOT_SYNCED: 'secondary',
  SYNCING: 'info',
  SYNCED: 'success',
  FAILED: 'destructive',
}

const statusDots: Record<string, string> = {
  SYNCING: 'bg-info',
  SYNCED: 'bg-success',
  FAILED: 'bg-destructive',
}

export function BatchDocumentList({ documents: initialDocuments, locale }: BatchDocumentListProps) {
  const { t } = useTranslations()
  const [docs, setDocs] = useState(initialDocuments)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)

  const { selectedIds, selectedCount, isAllSelected, toggle, selectAll, clearSelection } =
    useBatchSelect(docs)

  const handleBatchDelete = useCallback(() => {
    setDocs((prev) => prev.filter((d) => !selectedIds.has(d.id)))
    toast.success(`${selectedCount} document(s) removed`)
    clearSelection()
    setDeleteConfirmOpen(false)
  }, [selectedIds, selectedCount, clearSelection])

  if (docs.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-card px-6 py-16 text-center">
        <span className="mx-auto grid size-10 place-items-center rounded-xl bg-muted">
          <FileText className="size-5 text-muted-foreground" />
        </span>
        <p className="mt-4 text-sm font-medium">{t('UI_NO_DOCS')}</p>
        <p className="mt-1 text-sm text-muted-foreground">{t('UI_IMPORT_DOCS')}</p>
        <Button asChild className="mt-6">
          <Link href="/dashboard/connectors">{t('UI_CONNECT_FIRST')}</Link>
        </Button>
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
              label: 'Delete',
              icon: <Trash2 className="size-4" />,
              variant: 'destructive',
              onClick: () => setDeleteConfirmOpen(true),
            },
          ]}
        />
      )}

      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-10 pr-0">
                <Checkbox
                  id="select-all-docs"
                  aria-label="Select all documents"
                  checked={isAllSelected}
                  onCheckedChange={(checked) => {
                    if (checked) selectAll()
                    else clearSelection()
                  }}
                />
              </TableHead>
              <TableHead>Document</TableHead>
              <TableHead className="hidden md:table-cell">Pipeline</TableHead>
              <TableHead className="hidden sm:table-cell">Updated</TableHead>
              <TableHead className="text-right">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {docs.map((doc) => (
              <TableRow key={doc.id} className="group">
                <TableCell className="pr-0">
                  <Checkbox
                    checked={selectedIds.has(doc.id)}
                    onCheckedChange={() => toggle(doc.id)}
                    aria-label={`Select ${doc.title}`}
                  />
                </TableCell>
                <TableCell>
                  <Link
                    href={`/dashboard/documents/${doc.id}`}
                    className="block max-w-[28rem] truncate text-[13px] font-medium outline-none focus-visible:text-primary focus-visible:underline"
                  >
                    {doc.title}
                  </Link>
                </TableCell>
                <TableCell className="hidden md:table-cell">
                  <span className="text-[13px] text-muted-foreground">
                    {doc.sourceConnector?.type || '—'}
                    <span className="mx-1.5 text-muted-foreground/60">→</span>
                    {doc.destConnector?.type || '—'}
                  </span>
                </TableCell>
                <TableCell className="hidden whitespace-nowrap text-[13px] text-muted-foreground sm:table-cell">
                  {formatDate(doc.updatedAt, locale)}
                </TableCell>
                <TableCell className="text-right">
                  <Badge variant={statusVariants[doc.syncStatus] || 'secondary'}>
                    {statusDots[doc.syncStatus] && (
                      <span
                        className={`size-1.5 rounded-full ${statusDots[doc.syncStatus]}`}
                        aria-hidden="true"
                      />
                    )}
                    {statusLabels[doc.syncStatus] || doc.syncStatus}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete documents</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove {selectedCount} document(s) from this list? This
              action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBatchDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
