import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { AdminDataTable, type Column } from '@/components/admin/admin-data-table'

// ---------------------------------------------------------------------------
// Types et données mock
// ---------------------------------------------------------------------------

interface TestItem {
  id: string
  name: string
  value: number
}

const columns: Column<TestItem>[] = [
  { key: 'name', header: 'Name', render: (item) => <span>{item.name}</span> },
  { key: 'value', header: 'Value', sortable: true, render: (item) => <span>{item.value}</span> },
]

const data: TestItem[] = [
  { id: '1', name: 'Alpha', value: 100 },
  { id: '2', name: 'Beta', value: 200 },
  { id: '3', name: 'Gamma', value: 300 },
]

const defaultPagination = { page: 1, limit: 10, total: 3, totalPages: 1 }

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AdminDataTable', () => {
  it('affiche les en-têtes de colonnes', () => {
    render(
      <AdminDataTable
        columns={columns}
        data={data}
        pagination={defaultPagination}
        keyExtractor={(item) => item.id}
      />
    )

    expect(screen.getByText('Name')).toBeInTheDocument()
    expect(screen.getByText('Value')).toBeInTheDocument()
  })

  it('affiche les données dans le tableau', () => {
    render(
      <AdminDataTable
        columns={columns}
        data={data}
        pagination={defaultPagination}
        keyExtractor={(item) => item.id}
      />
    )

    expect(screen.getByText('Alpha')).toBeInTheDocument()
    expect(screen.getByText('Beta')).toBeInTheDocument()
    expect(screen.getByText('Gamma')).toBeInTheDocument()
    expect(screen.getByText('100')).toBeInTheDocument()
    expect(screen.getByText('200')).toBeInTheDocument()
    expect(screen.getByText('300')).toBeInTheDocument()
  })

  it('affiche les informations de pagination', () => {
    render(
      <AdminDataTable
        columns={columns}
        data={data}
        pagination={defaultPagination}
        keyExtractor={(item) => item.id}
      />
    )

    expect(screen.getByText('1–3 sur 3')).toBeInTheDocument()
    expect(screen.getByText('Page 1 / 1')).toBeInTheDocument()
  })

  it('affiche la pagination avec un seul élément', () => {
    const singleItemData = [{ id: '1', name: 'Only', value: 1 }]
    render(
      <AdminDataTable
        columns={columns}
        data={singleItemData}
        pagination={{ page: 1, limit: 10, total: 1, totalPages: 1 }}
        keyExtractor={(item) => item.id}
      />
    )

    expect(screen.getByText('1 élément')).toBeInTheDocument()
  })

  it('le clic sur un en-tête triable appelle onSort', () => {
    const handleSort = vi.fn()

    render(
      <AdminDataTable
        columns={columns}
        data={data}
        pagination={defaultPagination}
        onSort={handleSort}
        sortBy="name"
        sortDir="asc"
        keyExtractor={(item) => item.id}
      />
    )

    // "Value" est triable (sortable: true)
    fireEvent.click(screen.getByText('Value'))
    expect(handleSort).toHaveBeenCalledWith('value')
  })

  it("le clic sur un en-tête non triable n'appelle pas onSort", () => {
    const handleSort = vi.fn()

    render(
      <AdminDataTable
        columns={columns}
        data={data}
        pagination={defaultPagination}
        onSort={handleSort}
        keyExtractor={(item) => item.id}
      />
    )

    // "Name" n'est pas triable (sortable: undefined)
    fireEvent.click(screen.getByText('Name'))
    expect(handleSort).not.toHaveBeenCalled()
  })

  it('affiche le loading state avec des skeletons', () => {
    render(
      <AdminDataTable
        columns={columns}
        data={[]}
        pagination={defaultPagination}
        isLoading={true}
        keyExtractor={(item) => item.id}
      />
    )

    const skeletons = document.querySelectorAll('.animate-pulse')
    // skeletonRows = Math.min(limit || 5, 10) = Math.min(10, 10) = 10
    // Chaque ligne a N squelettes (1 par colonne) → 10 * 2 = 20
    expect(skeletons.length).toBe(20)
  })

  it("affiche l'empty state par défaut quand data est vide", () => {
    render(
      <AdminDataTable
        columns={columns}
        data={[]}
        pagination={{ page: 1, limit: 10, total: 0, totalPages: 1 }}
        keyExtractor={(item) => item.id}
      />
    )

    expect(screen.getByText('Aucune donnée')).toBeInTheDocument()
    expect(screen.getByText('Aucun élément à afficher pour le moment.')).toBeInTheDocument()
  })

  it("affiche l'empty state personnalisé quand fourni", () => {
    render(
      <AdminDataTable
        columns={columns}
        data={[]}
        pagination={{ page: 1, limit: 10, total: 0, totalPages: 1 }}
        keyExtractor={(item) => item.id}
        emptyState={<div>Custom empty message</div>}
      />
    )

    expect(screen.getByText('Custom empty message')).toBeInTheDocument()
  })

  it("n'affiche pas la pagination quand total est 0", () => {
    render(
      <AdminDataTable
        columns={columns}
        data={[]}
        pagination={{ page: 1, limit: 10, total: 0, totalPages: 1 }}
        keyExtractor={(item) => item.id}
      />
    )

    expect(screen.queryByText('Page 1 / 1')).not.toBeInTheDocument()
  })

  it('désactive le bouton précédent quand page = 1', () => {
    render(
      <AdminDataTable
        columns={columns}
        data={data}
        pagination={{ page: 1, limit: 10, total: 30, totalPages: 3 }}
        keyExtractor={(item) => item.id}
      />
    )

    const prevButton = screen.getByLabelText('Page précédente')
    expect(prevButton).toBeDisabled()
  })

  it('désactive le bouton suivant quand page = totalPages', () => {
    render(
      <AdminDataTable
        columns={columns}
        data={data}
        pagination={{ page: 3, limit: 10, total: 30, totalPages: 3 }}
        keyExtractor={(item) => item.id}
      />
    )

    const nextButton = screen.getByLabelText('Page suivante')
    expect(nextButton).toBeDisabled()
  })

  it('active les deux boutons quand page > 1 et page < totalPages', () => {
    render(
      <AdminDataTable
        columns={columns}
        data={data}
        pagination={{ page: 2, limit: 10, total: 30, totalPages: 3 }}
        keyExtractor={(item) => item.id}
      />
    )

    const prevButton = screen.getByLabelText('Page précédente')
    const nextButton = screen.getByLabelText('Page suivante')
    expect(prevButton).not.toBeDisabled()
    expect(nextButton).not.toBeDisabled()
  })

  it("n'appelle pas onPageChange pour page précédente si page = 1", () => {
    const handlePageChange = vi.fn()

    render(
      <AdminDataTable
        columns={columns}
        data={data}
        pagination={{ page: 1, limit: 10, total: 30, totalPages: 3 }}
        onPageChange={handlePageChange}
        keyExtractor={(item) => item.id}
      />
    )

    const prevButton = screen.getByLabelText('Page précédente')
    fireEvent.click(prevButton)
    expect(handlePageChange).not.toHaveBeenCalled()
  })

  it("n'appelle pas onPageChange pour page suivante si dernière page", () => {
    const handlePageChange = vi.fn()

    render(
      <AdminDataTable
        columns={columns}
        data={data}
        pagination={{ page: 3, limit: 10, total: 30, totalPages: 3 }}
        onPageChange={handlePageChange}
        keyExtractor={(item) => item.id}
      />
    )

    const nextButton = screen.getByLabelText('Page suivante')
    fireEvent.click(nextButton)
    expect(handlePageChange).not.toHaveBeenCalled()
  })

  it('appelle onPageChange avec page-1 quand on clique sur précédent', () => {
    const handlePageChange = vi.fn()

    render(
      <AdminDataTable
        columns={columns}
        data={data}
        pagination={{ page: 2, limit: 10, total: 30, totalPages: 3 }}
        onPageChange={handlePageChange}
        keyExtractor={(item) => item.id}
      />
    )

    const prevButton = screen.getByLabelText('Page précédente')
    fireEvent.click(prevButton)
    expect(handlePageChange).toHaveBeenCalledWith(1)
  })

  it('appelle onPageChange avec page+1 quand on clique sur suivant', () => {
    const handlePageChange = vi.fn()

    render(
      <AdminDataTable
        columns={columns}
        data={data}
        pagination={{ page: 2, limit: 10, total: 30, totalPages: 3 }}
        onPageChange={handlePageChange}
        keyExtractor={(item) => item.id}
      />
    )

    const nextButton = screen.getByLabelText('Page suivante')
    fireEvent.click(nextButton)
    expect(handlePageChange).toHaveBeenCalledWith(3)
  })

  it("affiche l'icône de tri ascendant quand sortBy correspond et sortDir=asc", () => {
    render(
      <AdminDataTable
        columns={columns}
        data={data}
        pagination={defaultPagination}
        sortBy="value"
        sortDir="asc"
        keyExtractor={(item) => item.id}
      />
    )

    const valueHeader = screen.getByText('Value')
    // L'icône ChevronUp doit être visible
    const chevronUp = valueHeader.closest('th')?.querySelector('.lucide-chevron-up')
    expect(chevronUp).toBeInTheDocument()
  })

  it("affiche l'icône de tri descendant quand sortBy correspond et sortDir=desc", () => {
    render(
      <AdminDataTable
        columns={columns}
        data={data}
        pagination={defaultPagination}
        sortBy="value"
        sortDir="desc"
        keyExtractor={(item) => item.id}
      />
    )

    const valueHeader = screen.getByText('Value')
    const chevronDown = valueHeader.closest('th')?.querySelector('.lucide-chevron-down')
    expect(chevronDown).toBeInTheDocument()
  })

  it("définit aria-sort sur l'en-tête trié", () => {
    const { container } = render(
      <AdminDataTable
        columns={columns}
        data={data}
        pagination={defaultPagination}
        sortBy="value"
        sortDir="asc"
        keyExtractor={(item) => item.id}
      />
    )

    const thElements = container.querySelectorAll('th')
    // Second en-tête (Value) a sortable: true
    const valueTh = thElements[1]
    expect(valueTh.getAttribute('aria-sort')).toBe('ascending')
  })

  it('ne définit pas aria-sort sur un en-tête non trié', () => {
    const { container } = render(
      <AdminDataTable
        columns={columns}
        data={data}
        pagination={defaultPagination}
        sortBy="value"
        sortDir="asc"
        keyExtractor={(item) => item.id}
      />
    )

    const thElements = container.querySelectorAll('th')
    // Premier en-tête (Name) n'est pas triable
    const nameTh = thElements[0]
    expect(nameTh.getAttribute('aria-sort')).toBeNull()
  })

  it('gère keyExtractor avec des nombres', () => {
    render(
      <AdminDataTable
        columns={columns}
        data={data}
        pagination={defaultPagination}
        keyExtractor={(item) => Number(item.id)}
      />
    )

    expect(screen.getByText('Alpha')).toBeInTheDocument()
  })

  it('gère des colonnes avec className personnalisé', () => {
    const columnsWithClass: Column<TestItem>[] = [
      ...columns,
      {
        key: 'actions',
        header: '',
        className: 'text-right',
        render: () => <button>Edit</button>,
      },
    ]

    render(
      <AdminDataTable
        columns={columnsWithClass}
        data={data}
        pagination={defaultPagination}
        keyExtractor={(item) => item.id}
      />
    )

    expect(screen.getAllByText('Edit')).toHaveLength(3)
  })

  it('affiche le bon nombre de lignes squelette avec un limit plus petit', () => {
    render(
      <AdminDataTable
        columns={columns}
        data={[]}
        pagination={{ page: 1, limit: 3, total: 0, totalPages: 1 }}
        isLoading={true}
        keyExtractor={(item) => item.id}
      />
    )

    const skeletons = document.querySelectorAll('.animate-pulse')
    // skeletonRows = Math.min(3, 10) = 3, chaque ligne a 2 colonnes → 6
    expect(skeletons.length).toBe(6)
  })
})
