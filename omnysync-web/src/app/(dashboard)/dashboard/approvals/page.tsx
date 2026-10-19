'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Textarea } from '@/components/ui/textarea'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Loader2, FileCheck, CheckCircle, XCircle, Eye } from 'lucide-react'
import { useTranslations } from '@/lib/i18n/useTranslations'
import { formatDateTime, detectClientLocale } from '@/lib/format-date'
import { useBatchSelect } from '@/hooks/use-batch-select'
import { BatchActionBar } from '@/components/batch-action-bar'
import { PageHeader, PageShell } from '@/components/page-header'
import { toast } from '@/components/toast-provider'

interface ApprovalRequest {
  id: string
  documentId: string
  documentTitle: string
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED'
  requestedBy: string
  requestedAt: string
  expiresAt: string
  approvedBy?: string
  approvedAt?: string
  comments?: string
}

export default function ApprovalsPage() {
  const { t } = useTranslations()
  const locale = detectClientLocale()
  const [loading, setLoading] = useState(true)
  const [approvals, setApprovals] = useState<ApprovalRequest[]>([])
  const [selectedApproval, setSelectedApproval] = useState<ApprovalRequest | null>(null)
  const [rejectOpen, setRejectOpen] = useState(false)
  const [rejectComment, setRejectComment] = useState('')
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const pendingApprovals = approvals.filter((a) => a.status === 'PENDING')
  const historyApprovals = approvals.filter((a) => a.status !== 'PENDING')

  const { selectedIds, selectedCount, isAllSelected, toggle, selectAll, clearSelection } =
    useBatchSelect(pendingApprovals)

  // Batch action loading
  const [batchLoading, setBatchLoading] = useState(false)

  const batchApprove = useCallback(async () => {
    setBatchLoading(true)
    const ids = Array.from(selectedIds)
    let success = 0
    for (const id of ids) {
      try {
        const res = await fetch(`/api/approvals/${id}/approve`, { method: 'POST' })
        if (res.ok) {
          setApprovals((prev) =>
            prev.map((a) =>
              a.id === id
                ? { ...a, status: 'APPROVED' as const, approvedAt: new Date().toISOString() }
                : a
            )
          )
          success++
        }
      } catch (e) {
        console.error(e)
      }
    }
    if (success === ids.length) {
      toast.success(`${success} request(s) approved`)
    } else {
      toast.warning(
        `Approved ${success} of ${ids.length} request(s). ${ids.length - success} failed.`
      )
    }
    clearSelection()
    setBatchLoading(false)
  }, [selectedIds, clearSelection])

  const batchReject = useCallback(async () => {
    setBatchLoading(true)
    const ids = Array.from(selectedIds)
    let success = 0
    for (const id of ids) {
      try {
        const res = await fetch(`/api/approvals/${id}/reject`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ comments: '' }),
        })
        if (res.ok) {
          setApprovals((prev) =>
            prev.map((a) => (a.id === id ? { ...a, status: 'REJECTED' as const } : a))
          )
          success++
        }
      } catch (e) {
        console.error(e)
      }
    }
    if (success === ids.length) {
      toast.success(`${success} request(s) rejected`)
    } else {
      toast.warning(
        `Rejected ${success} of ${ids.length} request(s). ${ids.length - success} failed.`
      )
    }
    clearSelection()
    setBatchLoading(false)
  }, [selectedIds, clearSelection])

  const fetchApprovals = async () => {
    try {
      const res = await fetch('/api/approvals')
      if (res.ok) {
        const data = await res.json()
        setApprovals(data.approvals || [])
      } else {
        toast.error(`Failed to load approvals (${res.status}). Refresh the page to try again.`)
      }
    } catch (e) {
      console.error(e)
      toast.error('Unable to load approvals. Check your connection and try again.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchApprovals()
  }, [])

  const approveRequest = async (id: string) => {
    setActionLoading(id)
    try {
      const res = await fetch(`/api/approvals/${id}/approve`, { method: 'POST' })
      if (res.ok) {
        setApprovals(
          approvals.map((a) =>
            a.id === id
              ? { ...a, status: 'APPROVED' as const, approvedAt: new Date().toISOString() }
              : a
          )
        )
        toast.success('Request approved')
      } else {
        toast.error(`Could not approve request (${res.status}). Try again.`)
      }
    } catch (e) {
      console.error(e)
      toast.error('Could not approve request. Check your connection and try again.')
    } finally {
      setActionLoading(null)
    }
  }

  const rejectRequest = async (id: string) => {
    setActionLoading(id)
    try {
      const res = await fetch(`/api/approvals/${id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comments: rejectComment }),
      })
      if (res.ok) {
        setApprovals(
          approvals.map((a) =>
            a.id === id ? { ...a, status: 'REJECTED' as const, comments: rejectComment } : a
          )
        )
        setRejectOpen(false)
        setRejectComment('')
        toast.success('Request rejected')
      } else {
        toast.error(`Could not reject request (${res.status}). Try again.`)
      }
    } catch (e) {
      console.error(e)
      toast.error('Could not reject request. Check your connection and try again.')
    } finally {
      setActionLoading(null)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING':
        return (
          <Badge variant="warning">
            <span className="size-1.5 rounded-full bg-warning" aria-hidden="true" />
            Pending
          </Badge>
        )
      case 'APPROVED':
        return (
          <Badge variant="success">
            <span className="size-1.5 rounded-full bg-success" aria-hidden="true" />
            Approved
          </Badge>
        )
      case 'REJECTED':
        return (
          <Badge variant="destructive">
            <span className="size-1.5 rounded-full bg-destructive-foreground" aria-hidden="true" />
            Rejected
          </Badge>
        )
      case 'EXPIRED':
        return (
          <Badge variant="secondary">
            <span className="size-1.5 rounded-full bg-muted-foreground" aria-hidden="true" />
            Expired
          </Badge>
        )
      default:
        return <Badge>{status}</Badge>
    }
  }

  if (loading) {
    return (
      <PageShell>
        <PageHeader title={t('APPROVALS_TITLE')} description={t('APPROVALS_SUBTITLE')} />
        <div className="flex min-h-[320px] items-center justify-center">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
        </div>
      </PageShell>
    )
  }

  return (
    <PageShell>
      <PageHeader title={t('APPROVALS_TITLE')} description={t('APPROVALS_SUBTITLE')} />

      {/* Pending */}
      <section className="relative mt-6">
        {selectedCount > 0 && (
          <BatchActionBar
            selectedCount={selectedCount}
            isAllSelected={isAllSelected}
            onSelectAll={selectAll}
            onClearSelection={clearSelection}
            actions={[
              {
                label: 'Approve',
                icon: <CheckCircle className="size-4" />,
                variant: 'default',
                onClick: batchApprove,
                loading: batchLoading,
              },
              {
                label: 'Reject',
                icon: <XCircle className="size-4" />,
                variant: 'destructive',
                onClick: batchReject,
                loading: batchLoading,
              },
            ]}
          />
        )}

        {pendingApprovals.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-card px-6 py-16 text-center">
            <span className="mx-auto grid size-10 place-items-center rounded-xl bg-muted">
              <FileCheck className="size-5 text-muted-foreground" />
            </span>
            <p className="mt-4 text-sm font-medium">No pending approval requests</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Pending approvals will appear here when documents are submitted for review.
            </p>
            <Button asChild className="mt-6">
              <Link href="/dashboard/documents">View documents</Link>
            </Button>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
            <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
              <h2 className="text-sm font-semibold">
                {t('APPROVALS_PENDING')}{' '}
                <span className="font-normal text-muted-foreground">
                  ({pendingApprovals.length})
                </span>
              </h2>
              <div className="flex items-center gap-2">
                <label
                  htmlFor="select-all-pending"
                  className="cursor-pointer select-none text-xs text-muted-foreground"
                >
                  Select all
                </label>
                <Checkbox
                  id="select-all-pending"
                  aria-label="Select all pending approvals"
                  checked={isAllSelected}
                  onCheckedChange={(checked) => {
                    if (checked) selectAll()
                    else clearSelection()
                  }}
                />
              </div>
            </div>

            <ul className="divide-y divide-border">
              {pendingApprovals.map((approval) => (
                <li
                  key={approval.id}
                  className="flex flex-wrap items-start justify-between gap-4 px-4 py-4 transition-colors hover:bg-muted/40"
                >
                  <div className="flex min-w-0 items-start gap-3">
                    <Checkbox
                      checked={selectedIds.has(approval.id)}
                      onCheckedChange={() => toggle(approval.id)}
                      aria-label={`Select ${approval.documentTitle}`}
                      className="mt-1"
                    />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-[13px] font-medium">{approval.documentTitle}</p>
                        {getStatusBadge(approval.status)}
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Requested by {approval.requestedBy} ·{' '}
                        {formatDateTime(approval.requestedAt, locale)}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Expires on {formatDateTime(approval.expiresAt, locale)}
                      </p>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedApproval(approval)}
                    >
                      <Eye />
                      View
                    </Button>
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => approveRequest(approval.id)}
                      disabled={actionLoading === approval.id}
                    >
                      {actionLoading === approval.id ? (
                        <Loader2 className="animate-spin" />
                      ) : (
                        <CheckCircle />
                      )}
                      Approve
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => {
                        setSelectedApproval(approval)
                        setRejectOpen(true)
                      }}
                      disabled={actionLoading === approval.id}
                    >
                      <XCircle />
                      Reject
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {/* History — only shown once there is something to look back at. */}
      {historyApprovals.length > 0 && (
        <section className="mt-8">
          <h2 className="text-sm font-semibold">{t('APPROVALS_HISTORY')}</h2>

          <div className="mt-3 overflow-hidden rounded-xl border border-border bg-card shadow-sm">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow className="hover:bg-transparent">
                  <TableHead>Document</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Resolution</TableHead>
                  <TableHead className="hidden text-right md:table-cell">Requested</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {historyApprovals.map((approval) => (
                  <TableRow key={approval.id}>
                    <TableCell className="max-w-[18rem] truncate text-[13px] font-medium">
                      {approval.documentTitle}
                    </TableCell>
                    <TableCell>{getStatusBadge(approval.status)}</TableCell>
                    <TableCell className="max-w-[22rem] truncate text-[13px] text-muted-foreground">
                      {approval.status === 'APPROVED'
                        ? `Approved by ${approval.approvedBy} on ${
                            approval.approvedAt ? formatDateTime(approval.approvedAt, locale) : ''
                          }`
                        : approval.status === 'REJECTED'
                          ? `Rejected${approval.comments ? `: ${approval.comments}` : ''}`
                          : `Expired on ${formatDateTime(approval.expiresAt, locale)}`}
                    </TableCell>
                    <TableCell className="hidden whitespace-nowrap text-right text-xs tabular-nums text-muted-foreground md:table-cell">
                      {formatDateTime(approval.requestedAt, locale)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </section>
      )}

      {/* Dialog de rejet */}
      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject request</DialogTitle>
            <DialogDescription>Please provide a reason for rejection.</DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Reason for rejection (optional)"
            value={rejectComment}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
              setRejectComment(e.target.value)
            }
            className="min-h-[100px]"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOpen(false)}>
              Cancel
            </Button>
            {selectedApproval && (
              <Button
                variant="destructive"
                onClick={() => rejectRequest(selectedApproval.id)}
                disabled={actionLoading === selectedApproval.id}
              >
                {actionLoading === selectedApproval.id && <Loader2 className="animate-spin" />}
                Reject
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageShell>
  )
}
