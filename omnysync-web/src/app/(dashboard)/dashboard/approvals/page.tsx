'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
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
import { PlanGate } from '@/components/plan-gate'
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
  const { t, tf } = useTranslations()
  const locale = detectClientLocale()
  const [loading, setLoading] = useState(true)
  const [approvals, setApprovals] = useState<ApprovalRequest[]>([])
  const [selectedApproval, setSelectedApproval] = useState<ApprovalRequest | null>(null)
  const [rejectOpen, setRejectOpen] = useState(false)
  const [rejectComment, setRejectComment] = useState('')
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [planGate, setPlanGate] = useState<string | null>(null)

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
      toast.success(
        tf(success === 1 ? 'APPROVALS_BATCH_APPROVED_ONE' : 'APPROVALS_BATCH_APPROVED_OTHER', {
          count: success,
        })
      )
    } else {
      toast.warning(
        tf('APPROVALS_BATCH_PARTIAL_APPROVED', {
          success,
          total: ids.length,
          failed: ids.length - success,
        })
      )
    }
    clearSelection()
    setBatchLoading(false)
  }, [selectedIds, clearSelection, tf])

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
      toast.success(
        tf(success === 1 ? 'APPROVALS_BATCH_REJECTED_ONE' : 'APPROVALS_BATCH_REJECTED_OTHER', {
          count: success,
        })
      )
    } else {
      toast.warning(
        tf('APPROVALS_BATCH_PARTIAL_REJECTED', {
          success,
          total: ids.length,
          failed: ids.length - success,
        })
      )
    }
    clearSelection()
    setBatchLoading(false)
  }, [selectedIds, clearSelection, tf])

  const fetchApprovals = async () => {
    try {
      const res = await fetch('/api/approvals')
      if (res.ok) {
        const data = await res.json()
        setApprovals(data.approvals || [])
      } else {
        const payload = (await res.json().catch(() => null)) as {
          code?: string
          upgradeUrl?: string
        } | null
        if (res.status === 403 && payload?.code === 'PLAN_FEATURE_REQUIRED') {
          setPlanGate(payload.upgradeUrl || '/pricing')
          return
        }
        toast.error(tf('APPROVALS_TOAST_LOAD_FAILED', { status: res.status }))
      }
    } catch (e) {
      console.error(e)
      toast.error(t('APPROVALS_TOAST_LOAD_ERROR'))
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
        toast.success(t('APPROVALS_TOAST_APPROVED'))
      } else {
        toast.error(tf('APPROVALS_TOAST_APPROVE_FAILED', { status: res.status }))
      }
    } catch (e) {
      console.error(e)
      toast.error(t('APPROVALS_TOAST_APPROVE_ERROR'))
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
        toast.success(t('APPROVALS_TOAST_REJECTED'))
      } else {
        toast.error(tf('APPROVALS_TOAST_REJECT_FAILED', { status: res.status }))
      }
    } catch (e) {
      console.error(e)
      toast.error(t('APPROVALS_TOAST_REJECT_ERROR'))
    } finally {
      setActionLoading(null)
    }
  }

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; tone: string; dot: string }> = {
      PENDING: { label: t('APPROVALS_PENDING'), tone: 'text-warning', dot: 'bg-warning' },
      APPROVED: {
        label: t('APPROVALS_STATUS_APPROVED'),
        tone: 'text-success',
        dot: 'bg-success',
      },
      REJECTED: {
        label: t('APPROVALS_STATUS_REJECTED'),
        tone: 'text-destructive',
        dot: 'bg-destructive',
      },
      EXPIRED: {
        label: t('APPROVALS_STATUS_EXPIRED'),
        tone: 'text-muted-foreground',
        dot: 'border border-border-strong',
      },
    }
    const entry = statusMap[status] || {
      label: status,
      tone: 'text-muted-foreground',
      dot: 'bg-muted-foreground/40',
    }
    return (
      <span
        className={`inline-flex items-center gap-1.5 whitespace-nowrap font-mono text-[9px] uppercase tracking-[0.12em] ${entry.tone}`}
      >
        <span className={`size-1.5 ${entry.dot}`} aria-hidden="true" />
        {entry.label}
      </span>
    )
  }

  const getResolution = (approval: ApprovalRequest) => {
    if (approval.status === 'APPROVED') {
      return tf('APPROVALS_APPROVED_BY', {
        name: approval.approvedBy || '—',
        date: approval.approvedAt ? formatDateTime(approval.approvedAt, locale) : '',
      })
    }
    if (approval.status === 'REJECTED') {
      return approval.comments
        ? tf('APPROVALS_REJECTED_WITH_REASON', { reason: approval.comments })
        : t('APPROVALS_REJECTED')
    }
    return tf('APPROVALS_EXPIRED_ON', {
      date: formatDateTime(approval.expiresAt, locale),
    })
  }

  if (loading) {
    return (
      <PageShell>
        <PageHeader
          eyebrow={t('APPROVALS_EYEBROW_QUEUE')}
          title={t('APPROVALS_TITLE')}
          description={t('APPROVALS_SUBTITLE')}
        />
        <div className="mt-6 flex min-h-[320px] items-center justify-center border border-border bg-card">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      </PageShell>
    )
  }

  if (planGate) {
    return (
      <PageShell>
        <PageHeader
          eyebrow={tf('APPROVALS_EYEBROW_PENDING', {
            count: String(pendingApprovals.length).padStart(2, '0'),
          })}
          title={t('APPROVALS_TITLE')}
          description={t('APPROVALS_SUBTITLE')}
        />
        <PlanGate
          title={t('plan_gate_approvals_title')}
          description={t('plan_gate_approvals_desc')}
          upgradeUrl={planGate}
          className="mt-6"
        />
      </PageShell>
    )
  }

  return (
    <PageShell>
      <PageHeader
        eyebrow={tf('APPROVALS_EYEBROW_PENDING', {
          count: String(pendingApprovals.length).padStart(2, '0'),
        })}
        title={t('APPROVALS_TITLE')}
        description={t('APPROVALS_SUBTITLE')}
      />

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
                label: t('APPROVALS_APPROVE'),
                icon: <CheckCircle className="size-4" />,
                variant: 'default',
                onClick: batchApprove,
                loading: batchLoading,
              },
              {
                label: t('APPROVALS_REJECT'),
                icon: <XCircle className="size-4" />,
                variant: 'destructive',
                onClick: batchReject,
                loading: batchLoading,
              },
            ]}
          />
        )}

        {pendingApprovals.length === 0 ? (
          <div className="border border-border bg-card">
            <div className="flex items-center justify-between border-b border-border px-5 py-3 font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground">
              <span>{t('APPROVALS_QUEUE')}</span>
              <span>00</span>
            </div>
            <div className="flex flex-col gap-4 p-6 sm:flex-row sm:items-start sm:p-8">
              <span className="grid size-10 shrink-0 place-items-center border border-border bg-muted text-muted-foreground">
                <FileCheck className="size-5" />
              </span>
              <div className="max-w-xl">
                <p className="text-base font-semibold tracking-[-0.02em]">
                  {t('APPROVALS_EMPTY_TITLE')}
                </p>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  {t('APPROVALS_EMPTY_DESC')}
                </p>
                <Button asChild className="mt-5">
                  <Link href="/dashboard/documents">{t('APPROVALS_VIEW_DOCUMENTS')}</Link>
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="border border-border bg-card">
            <div className="flex flex-wrap items-end justify-between gap-3 border-b border-border px-5 py-3">
              <div>
                <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground">
                  {t('APPROVALS_QUEUE_PENDING')}
                </p>
                <h2 className="mt-1 text-sm font-semibold">
                  {t('APPROVALS_PENDING')}{' '}
                  <span className="font-normal text-muted-foreground">
                    ({pendingApprovals.length})
                  </span>
                </h2>
              </div>
              <span className="font-mono text-[10px] tabular-nums text-muted-foreground">
                {pendingApprovals.length}{' '}
                {pendingApprovals.length === 1
                  ? t('APPROVALS_REQUEST_ONE')
                  : t('APPROVALS_REQUESTS_OTHER')}
              </span>
            </div>

            <Table>
              <TableHeader className="bg-muted/40">
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="hidden h-9 w-10 px-2 pr-0 sm:table-cell sm:px-4">
                    <Checkbox
                      id="select-all-pending"
                      aria-label={t('APPROVALS_SELECT_ALL')}
                      checked={isAllSelected}
                      onCheckedChange={(checked) => {
                        if (checked) selectAll()
                        else clearSelection()
                      }}
                    />
                  </TableHead>
                  <TableHead className="h-9 px-2 font-mono text-[9px] uppercase tracking-[0.14em] sm:px-4">
                    {t('APPROVALS_DOCUMENT')}
                  </TableHead>
                  <TableHead className="hidden h-9 px-4 font-mono text-[9px] uppercase tracking-[0.14em] sm:table-cell">
                    {t('UI_STATUS')}
                  </TableHead>
                  <TableHead className="hidden h-9 px-4 font-mono text-[9px] uppercase tracking-[0.14em] md:table-cell">
                    {t('APPROVALS_REQUESTED')}
                  </TableHead>
                  <TableHead className="h-9 px-2 text-right font-mono text-[9px] uppercase tracking-[0.14em] sm:px-4">
                    <span className="hidden sm:inline">{t('APPROVALS_ACTIONS')}</span>
                    <span className="sr-only sm:hidden">{t('APPROVALS_ACTIONS')}</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingApprovals.map((approval) => (
                  <TableRow key={approval.id} className="border-border hover:bg-muted/30">
                    <TableCell className="hidden px-2 pr-0 sm:table-cell sm:px-4">
                      <Checkbox
                        checked={selectedIds.has(approval.id)}
                        onCheckedChange={() => toggle(approval.id)}
                        aria-label={tf('APPROVALS_SELECT_ONE', {
                          title: approval.documentTitle,
                        })}
                      />
                    </TableCell>
                    <TableCell className="px-2 py-2.5 sm:px-4">
                      <div className="min-w-0">
                        <p className="max-w-[14rem] truncate text-[13px] font-medium sm:max-w-[24rem]">
                          <Link
                            href={`/dashboard/documents/${approval.documentId}`}
                            className="hover:underline"
                          >
                            {approval.documentTitle}
                          </Link>
                        </p>
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">
                          {tf('APPROVALS_REQUESTED_BY', {
                            name: approval.requestedBy,
                            date: formatDateTime(approval.requestedAt, locale),
                          })}
                        </p>
                        <p className="mt-0.5 truncate font-mono text-[9px] uppercase tracking-[0.08em] text-muted-foreground/60">
                          {tf('APPROVALS_EXPIRES', {
                            date: formatDateTime(approval.expiresAt, locale),
                          })}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="hidden px-4 sm:table-cell">
                      {getStatusBadge(approval.status)}
                    </TableCell>
                    <TableCell className="hidden whitespace-nowrap px-4 font-mono text-[10px] tabular-nums text-muted-foreground md:table-cell">
                      {formatDateTime(approval.requestedAt, locale)}
                    </TableCell>
                    <TableCell className="px-2 sm:px-4">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedApproval(approval)}
                          aria-label={tf('APPROVALS_VIEW_ARIA', {
                            title: approval.documentTitle,
                          })}
                          className="hidden sm:inline-flex"
                        >
                          <Eye />
                          <span className="hidden sm:inline">{t('APPROVALS_VIEW')}</span>
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => approveRequest(approval.id)}
                          disabled={actionLoading === approval.id}
                          aria-label={tf('APPROVALS_APPROVE_ARIA', {
                            title: approval.documentTitle,
                          })}
                        >
                          {actionLoading === approval.id ? (
                            <Loader2 className="animate-spin" />
                          ) : (
                            <CheckCircle />
                          )}
                          <span className="hidden sm:inline">{t('APPROVALS_APPROVE')}</span>
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => {
                            setSelectedApproval(approval)
                            setRejectOpen(true)
                          }}
                          disabled={actionLoading === approval.id}
                          aria-label={tf('APPROVALS_REJECT_ARIA', {
                            title: approval.documentTitle,
                          })}
                        >
                          <XCircle />
                          <span className="hidden sm:inline">{t('APPROVALS_REJECT')}</span>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <div className="flex items-center justify-between border-t border-border bg-muted/20 px-4 py-2.5 font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground">
              <span>{tf('APPROVALS_PENDING_COUNT', { count: pendingApprovals.length })}</span>
              <span>{t('APPROVALS_REVIEW_QUEUE')}</span>
            </div>
          </div>
        )}
      </section>

      {/* History — only shown once there is something to look back at. */}
      {historyApprovals.length > 0 && (
        <section className="mt-8">
          <div className="flex items-end justify-between gap-3 border-b border-border pb-3">
            <div>
              <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground">
                {t('APPROVALS_RESOLUTION_LOG')}
              </p>
              <h2 className="mt-1 text-sm font-semibold">{t('APPROVALS_HISTORY')}</h2>
            </div>
            <span className="font-mono text-[10px] tabular-nums text-muted-foreground">
              {String(historyApprovals.length).padStart(2, '0')}
            </span>
          </div>

          <div className="mt-3 border border-border bg-card">
            <Table>
              <TableHeader className="bg-muted/40">
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="h-9 px-4 font-mono text-[9px] uppercase tracking-[0.14em]">
                    {t('APPROVALS_DOCUMENT')}
                  </TableHead>
                  <TableHead className="h-9 px-4 font-mono text-[9px] uppercase tracking-[0.14em]">
                    {t('UI_STATUS')}
                  </TableHead>
                  <TableHead className="hidden h-9 px-4 font-mono text-[9px] uppercase tracking-[0.14em] sm:table-cell">
                    {t('APPROVALS_RESOLUTION')}
                  </TableHead>
                  <TableHead className="hidden h-9 px-4 text-right font-mono text-[9px] uppercase tracking-[0.14em] md:table-cell">
                    {t('APPROVALS_REQUESTED')}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {historyApprovals.map((approval) => (
                  <TableRow key={approval.id} className="border-border hover:bg-muted/30">
                    <TableCell className="px-4 py-2.5 text-[13px] font-medium sm:max-w-[18rem]">
                      <p className="truncate">{approval.documentTitle}</p>
                      <p className="mt-0.5 text-[10px] font-normal leading-snug text-muted-foreground sm:hidden">
                        {getResolution(approval)}
                      </p>
                    </TableCell>
                    <TableCell className="px-4 py-2.5">{getStatusBadge(approval.status)}</TableCell>
                    <TableCell className="hidden max-w-[22rem] truncate px-4 py-2.5 text-[13px] text-muted-foreground sm:table-cell">
                      {getResolution(approval)}
                    </TableCell>
                    <TableCell className="hidden whitespace-nowrap px-4 py-2.5 text-right font-mono text-[10px] tabular-nums text-muted-foreground md:table-cell">
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
            <DialogTitle>{t('APPROVALS_REJECT_TITLE')}</DialogTitle>
            <DialogDescription>{t('APPROVALS_REJECT_DESC')}</DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder={t('APPROVALS_REJECT_PLACEHOLDER')}
            value={rejectComment}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
              setRejectComment(e.target.value)
            }
            className="min-h-[100px]"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOpen(false)}>
              {t('APPROVALS_CANCEL')}
            </Button>
            {selectedApproval && (
              <Button
                variant="destructive"
                onClick={() => rejectRequest(selectedApproval.id)}
                disabled={actionLoading === selectedApproval.id}
              >
                {actionLoading === selectedApproval.id && <Loader2 className="animate-spin" />}
                {t('APPROVALS_REJECT')}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageShell>
  )
}
