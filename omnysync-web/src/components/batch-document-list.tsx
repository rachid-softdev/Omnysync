'use client'

import { useState, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { useBatchSelect } from '@/hooks/use-batch-select'
import { BatchActionBar } from '@/components/batch-action-bar'
import { Trash2 } from 'lucide-react'
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

const statusVariants: Record<string, 'secondary' | 'default' | 'destructive' | 'outline'> = {
  NOT_SYNCED: 'secondary',
  SYNCING: 'default',
  SYNCED: 'outline',
  FAILED: 'destructive',
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
      <Card>
        <CardHeader>
          <CardTitle>{t('UI_ALL_DOCS')}</CardTitle>
          <CardDescription>{t('UI_ALL_DOCS_DESC')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12 text-muted-foreground">
            <p>{t('UI_NO_DOCS')}</p>
            <p className="text-sm mt-1 mb-4">{t('UI_IMPORT_DOCS')}</p>
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
              label: 'Delete',
              icon: <Trash2 className="w-4 h-4 mr-1" />,
              variant: 'destructive',
              onClick: () => setDeleteConfirmOpen(true),
            },
          ]}
        />
      )}

      {/* Hidden select-all checkbox in header area — accessible via label */}
      <div className="flex items-center gap-2 mb-4">
        <Checkbox
          id="select-all-docs"
          aria-label="Select all documents"
          checked={isAllSelected}
          onCheckedChange={(checked) => {
            if (checked) selectAll()
            else clearSelection()
          }}
        />
        <label
          htmlFor="select-all-docs"
          className="text-sm text-muted-foreground cursor-pointer select-none"
        >
          {isAllSelected ? 'All selected' : `${docs.length} documents`}
        </label>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {docs.map((doc) => (
          <Card key={doc.id}>
            <CardContent className="flex items-center justify-between p-6">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <Checkbox
                  checked={selectedIds.has(doc.id)}
                  onCheckedChange={() => toggle(doc.id)}
                  aria-label={`Select ${doc.title}`}
                />
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{doc.title}</p>
                  <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                    <span>{doc.sourceConnector?.type || '—'}</span>
                    <span>→</span>
                    <span>{doc.destConnector?.type || '—'}</span>
                    <span>·</span>
                    <span>{formatDate(doc.updatedAt, locale)}</span>
                  </div>
                </div>
              </div>
              <Badge variant={statusVariants[doc.syncStatus] || 'secondary'}>
                {statusLabels[doc.syncStatus] || doc.syncStatus}
              </Badge>
            </CardContent>
          </Card>
        ))}
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
