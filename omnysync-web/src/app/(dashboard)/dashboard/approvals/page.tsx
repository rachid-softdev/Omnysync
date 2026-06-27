'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Loader2, FileCheck, Clock, CheckCircle, XCircle, AlertCircle, Eye } from 'lucide-react'
import { useTranslations } from '@/lib/i18n/useTranslations'
import { formatDateTime, detectClientLocale } from '@/lib/format-date'
import { useBatchSelect } from '@/hooks/use-batch-select'
import { BatchActionBar } from '@/components/batch-action-bar'
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
          <Badge variant="secondary" className="bg-yellow-500/10 text-yellow-500">
            <Clock className="w-3 h-3 mr-1" />
            Pending
          </Badge>
        )
      case 'APPROVED':
        return (
          <Badge variant="default" className="bg-green-500/10 text-green-500">
            <CheckCircle className="w-3 h-3 mr-1" />
            Approved
          </Badge>
        )
      case 'REJECTED':
        return (
          <Badge variant="destructive">
            <XCircle className="w-3 h-3 mr-1" />
            Rejected
          </Badge>
        )
      case 'EXPIRED':
        return (
          <Badge variant="outline" className="text-muted-foreground">
            <AlertCircle className="w-3 h-3 mr-1" />
            Expired
          </Badge>
        )
      default:
        return <Badge>{status}</Badge>
    }
  }

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">{t('APPROVALS_TITLE')}</h1>
        <p className="text-muted-foreground mt-1">{t('APPROVALS_SUBTITLE')}</p>
      </div>

      {/* Pending */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Clock className="w-5 h-5" />
            {t('APPROVALS_PENDING')} ({pendingApprovals.length})
          </h2>
          {pendingApprovals.length > 0 && (
            <Checkbox
              id="select-all-pending"
              aria-label="Select all pending approvals"
              checked={isAllSelected}
              onCheckedChange={(checked) => {
                if (checked) selectAll()
                else clearSelection()
              }}
              className="ml-auto"
            />
          )}
        </div>

        {selectedCount > 0 && (
          <BatchActionBar
            selectedCount={selectedCount}
            isAllSelected={isAllSelected}
            onSelectAll={selectAll}
            onClearSelection={clearSelection}
            actions={[
              {
                label: 'Approve',
                icon: <CheckCircle className="w-4 h-4 mr-1" />,
                variant: 'default',
                onClick: batchApprove,
                loading: batchLoading,
              },
              {
                label: 'Reject',
                icon: <XCircle className="w-4 h-4 mr-1" />,
                variant: 'destructive',
                onClick: batchReject,
                loading: batchLoading,
              },
            ]}
          />
        )}

        {pendingApprovals.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <FileCheck className="w-10 h-10 text-muted-foreground mb-3" />
              <p className="text-muted-foreground">No pending approval requests</p>
              <p className="text-sm text-muted-foreground mt-1">
                Pending approvals will appear here when documents are submitted for review.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {pendingApprovals.map((approval) => (
              <Card key={approval.id}>
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3 flex-1">
                      <Checkbox
                        checked={selectedIds.has(approval.id)}
                        onCheckedChange={() => toggle(approval.id)}
                        aria-label={`Select ${approval.documentTitle}`}
                        className="mt-1"
                      />
                      <div>
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="font-semibold">{approval.documentTitle}</h3>
                          {getStatusBadge(approval.status)}
                        </div>
                        <p className="text-sm text-muted-foreground mb-2">
                          Requested by {approval.requestedBy} •{' '}
                          {formatDateTime(approval.requestedAt, locale)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Expires on {formatDateTime(approval.expiresAt, locale)}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedApproval(approval)}
                      >
                        <Eye className="w-4 h-4 mr-1" />
                        View
                      </Button>
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => approveRequest(approval.id)}
                        disabled={actionLoading === approval.id}
                      >
                        {actionLoading === approval.id ? (
                          <Loader2 className="w-4 h-4 animate-spin mr-1" />
                        ) : (
                          <CheckCircle className="w-4 h-4 mr-1" />
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
                        <XCircle className="w-4 h-4 mr-1" />
                        Reject
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* History */}
      <div>
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <FileCheck className="w-5 h-5" />
          {t('APPROVALS_HISTORY')}
        </h2>

        {historyApprovals.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <p className="text-muted-foreground">No approval history</p>
              <p className="text-sm text-muted-foreground mt-1">
                Resolved approvals will be listed here for reference.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {historyApprovals.map((approval) => (
              <Card key={approval.id}>
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-medium">{approval.documentTitle}</h3>
                        {getStatusBadge(approval.status)}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {approval.status === 'APPROVED'
                          ? `Approved by ${approval.approvedBy} on ${approval.approvedAt ? formatDateTime(approval.approvedAt, locale) : ''}`
                          : approval.status === 'REJECTED'
                            ? `Rejected${approval.comments ? `: ${approval.comments}` : ''}`
                            : `Expired on ${formatDateTime(approval.expiresAt, locale)}`}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

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
                {actionLoading === selectedApproval.id && (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                )}
                Reject
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
