import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { BatchSyncList } from './batch-sync-list'

vi.mock('@/lib/i18n/useTranslations', async () => {
  const { t } = await import('@/lib/i18n')

  return {
    useTranslations: (locale?: string) => ({
      t: (key: string) => t(key, locale ?? 'fr'),
      loading: false,
      locale: locale ?? 'fr',
    }),
  }
})

const logs = [
  {
    id: 'log-1',
    status: 'SUCCESS',
    action: 'sync_completed',
    message: 'Published to WordPress',
    createdAt: '2026-01-01T10:00:00Z',
    document: { id: 'doc-1', title: 'My Doc' },
  },
]

describe('BatchSyncList', () => {
  it('links each sync log to its document run detail', () => {
    render(<BatchSyncList syncLogs={logs} locale="fr" />)

    const link = screen.getByRole('link', { name: /Voir le détail/i })
    expect(link).toHaveAttribute('href', '/dashboard/sync/doc-1')
  })

  it('localizes the batch clear dialog in French', async () => {
    render(<BatchSyncList syncLogs={logs} locale="fr" />)

    fireEvent.click(screen.getByLabelText('Sélectionner le journal sync_completed'))
    fireEvent.click(screen.getByRole('button', { name: 'Effacer les journaux sélectionnés' }))

    expect(await screen.findByText('Effacer les journaux de synchronisation')).toBeInTheDocument()
    expect(screen.getByText(/Voulez-vous vraiment supprimer 1 journal/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Annuler' })).toBeInTheDocument()
  })
})
