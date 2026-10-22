import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import ApprovalsPage from '../../(dashboard)/dashboard/approvals/page'
import { toast } from '@/components/toast-provider'

vi.mock('@/components/toast-provider', () => ({
  toast: {
    success: vi.fn(),
    warning: vi.fn(),
    error: vi.fn(),
  },
}))

vi.mock('@/lib/i18n/useTranslations', () => ({
  useTranslations: vi.fn(() => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        APPROVALS_TITLE: 'Approvals',
        APPROVALS_SUBTITLE: 'Manage approval requests',
        APPROVALS_PENDING: 'Pending',
        APPROVALS_HISTORY: 'History',
        plan_gate_eyebrow: 'PLAN / ACCESS',
        plan_gate_badge: 'UPGRADE REQUIRED',
        plan_gate_cta: 'View plans',
        plan_gate_approvals_title: 'Approvals require the Business plan',
        plan_gate_approvals_desc:
          'Upgrade to Business to route documents through a review queue before publishing.',
      }
      return translations[key] || key
    },
    loading: false,
    locale: 'en',
  })),
}))

beforeEach(() => {
  vi.clearAllMocks()
  global.fetch = vi.fn()
})

const pendingApprovals = [
  {
    id: 'a1',
    documentId: 'd1',
    documentTitle: 'Q2 Blog Post',
    status: 'PENDING' as const,
    requestedBy: 'Alice',
    requestedAt: '2026-06-01T10:00:00Z',
    expiresAt: '2026-06-08T10:00:00Z',
  },
  {
    id: 'a2',
    documentId: 'd2',
    documentTitle: 'Product Update',
    status: 'PENDING' as const,
    requestedBy: 'Bob',
    requestedAt: '2026-06-02T08:00:00Z',
    expiresAt: '2026-06-09T08:00:00Z',
  },
]

const historyApprovals = [
  {
    id: 'a3',
    documentId: 'd3',
    documentTitle: 'Old Article',
    status: 'APPROVED' as const,
    requestedBy: 'Charlie',
    requestedAt: '2026-05-15T10:00:00Z',
    expiresAt: '2026-05-22T10:00:00Z',
    approvedBy: 'Admin',
    approvedAt: '2026-05-16T10:00:00Z',
  },
]

describe('ApprovalsPage', () => {
  it('shows loading spinner initially', () => {
    ;(global.fetch as any).mockImplementationOnce(() => new Promise(() => {}))

    render(<ApprovalsPage />)
    const spinner = document.querySelector('.animate-spin')
    expect(spinner).toBeInTheDocument()
  })

  it('renders empty pending section when no approvals', async () => {
    ;(global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ approvals: [] }),
    })

    render(<ApprovalsPage />)

    await waitFor(() => {
      expect(screen.getByText('No pending approval requests')).toBeInTheDocument()
    })
  })

  it('renders a plan gate when the plan lacks the approval portal', async () => {
    ;(global.fetch as any).mockResolvedValueOnce({
      ok: false,
      status: 403,
      json: async () => ({ code: 'PLAN_FEATURE_REQUIRED', upgradeUrl: '/pricing' }),
    })

    render(<ApprovalsPage />)

    await waitFor(() => {
      expect(screen.getByText('Approvals require the Business plan')).toBeInTheDocument()
    })
    expect(screen.queryByText('No pending approval requests')).not.toBeInTheDocument()
    expect(vi.mocked(toast.error)).not.toHaveBeenCalled()
  })

  it('renders pending approval requests with approve/reject buttons', async () => {
    ;(global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ approvals: pendingApprovals }),
    })

    render(<ApprovalsPage />)

    await waitFor(() => {
      expect(screen.getByText('Q2 Blog Post')).toBeInTheDocument()
      expect(screen.getByText('Product Update')).toBeInTheDocument()
      expect(screen.getAllByText('Pending').length).toBeGreaterThanOrEqual(2)
    })

    const approveButtons = screen.getAllByText('Approve')
    expect(approveButtons.length).toBe(2)

    const rejectButtons = screen.getAllByText('Reject')
    expect(rejectButtons.length).toBe(2)
  })

  it('renders history section with approved entries', async () => {
    const allApprovals = [...pendingApprovals, ...historyApprovals]
    ;(global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ approvals: allApprovals }),
    })

    render(<ApprovalsPage />)

    await waitFor(() => {
      expect(screen.getByText('Old Article')).toBeInTheDocument()
      expect(screen.getByText('Approved')).toBeInTheDocument()
    })
  })

  it('allows approving a pending request', async () => {
    ;(global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ approvals: pendingApprovals }),
    })

    render(<ApprovalsPage />)

    await waitFor(() => {
      expect(screen.getByText('Q2 Blog Post')).toBeInTheDocument()
    })

    const approveButtons = screen.getAllByText('Approve')
    ;(global.fetch as any).mockResolvedValueOnce({ ok: true })

    fireEvent.click(approveButtons[0])

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/approvals/a1/approve', { method: 'POST' })
    })
  })

  it('opens reject dialog when clicking Reject', async () => {
    ;(global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ approvals: pendingApprovals }),
    })

    render(<ApprovalsPage />)

    await waitFor(() => {
      expect(screen.getByText('Q2 Blog Post')).toBeInTheDocument()
    })

    const rejectButtons = screen.getAllByText('Reject')
    fireEvent.click(rejectButtons[0])

    expect(screen.getByText('Reject request')).toBeInTheDocument()
    expect(screen.getByText('Please provide a reason for rejection.')).toBeInTheDocument()
  })
})
