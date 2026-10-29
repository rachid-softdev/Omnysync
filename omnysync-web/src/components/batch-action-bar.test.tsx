import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BatchActionBar } from './batch-action-bar'

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

function renderBar(selectedCount: number, isAllSelected = false) {
  return render(
    <BatchActionBar
      selectedCount={selectedCount}
      isAllSelected={isAllSelected}
      onSelectAll={vi.fn()}
      onClearSelection={vi.fn()}
      actions={[]}
      locale="fr"
    />
  )
}

describe('BatchActionBar', () => {
  it('renders localized French labels', () => {
    renderBar(1)

    expect(screen.getByText('1 sélectionné')).toBeInTheDocument()
    expect(screen.getByText('Tout sélectionner')).toBeInTheDocument()
    expect(screen.getByLabelText('Effacer la sélection')).toBeInTheDocument()
  })

  it('uses the plural label for several rows', () => {
    renderBar(2, true)

    expect(screen.getByText('2 sélectionnés')).toBeInTheDocument()
  })
})
