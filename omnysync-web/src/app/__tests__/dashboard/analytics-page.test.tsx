/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import AnalyticsPage from '../../(dashboard)/dashboard/analytics/page'

const mockAnalyticsData = {
  totalSyncs: 150,
  successRate: 92,
  avgDuration: 45,
  totalDocuments: 25,
  activeConnectors: 6,
  failedSyncs: 5,
  recentActivity: [
    { id: 'a1', action: 'Document synced', status: 'SUCCESS', createdAt: '2026-06-01T10:00:00Z' },
    { id: 'a2', action: 'Sync failed', status: 'ERROR', createdAt: '2026-06-01T09:00:00Z' },
  ],
  syncByDay: [
    { date: '2026-05-31', count: 10 },
    { date: '2026-06-01', count: 15 },
  ],
  connectorsUsage: [
    { type: 'WORDPRESS', count: 80 },
    { type: 'GHOST', count: 40 },
  ],
}

beforeEach(() => {
  vi.clearAllMocks()
  global.fetch = vi.fn()
})

describe('AnalyticsPage', () => {
  it('shows loading initially', () => {
    ;(global.fetch as any).mockImplementationOnce(() => new Promise(() => {}))
    
    render(<AnalyticsPage />)
    const spinner = document.querySelector('.animate-spin')
    expect(spinner).toBeInTheDocument()
  })

  it('renders analytics data when loaded', async () => {
    ;(global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockAnalyticsData,
    })

    render(<AnalyticsPage />)

    await waitFor(() => {
      expect(screen.getByText('150')).toBeInTheDocument() // total syncs
      expect(screen.getByText('92%')).toBeInTheDocument() // success rate
      expect(screen.getByText('45s')).toBeInTheDocument() // avg duration
      expect(screen.getByText('25')).toBeInTheDocument() // total documents
    })
  })

  it('renders empty state when no data', async () => {
    ;(global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ totalSyncs: 0, totalDocuments: 0, successRate: 0, avgDuration: 0, activeConnectors: 0, failedSyncs: 0, recentActivity: [], syncByDay: [], connectorsUsage: [] }),
    })

    render(<AnalyticsPage />)

    await waitFor(() => {
      expect(screen.getByText('No data available')).toBeInTheDocument()
    })
  })

  it('renders error state on fetch failure', async () => {
    ;(global.fetch as any).mockResolvedValueOnce({
      ok: false,
      json: async () => ({}),
    })

    render(<AnalyticsPage />)

    await waitFor(() => {
      expect(screen.getByText('Error loading analytics data')).toBeInTheDocument()
    })
  })

  it('renders tabs', async () => {
    ;(global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockAnalyticsData,
    })

    render(<AnalyticsPage />)

    await waitFor(() => {
      expect(screen.getByText('Overview')).toBeInTheDocument()
      expect(screen.getByText('Connectors')).toBeInTheDocument()
      expect(screen.getByText('Recent activity')).toBeInTheDocument()
    })
  })
})
