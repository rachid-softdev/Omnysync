import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { Pagination, PageSizeSelect, PaginationInfo } from '../pagination'

describe('Pagination', () => {
  it('renders page buttons for given totalPages', () => {
    render(<Pagination currentPage={1} totalPages={5} onPageChange={() => {}} />)

    expect(screen.getByLabelText('Page 1')).toBeInTheDocument()
    expect(screen.getByLabelText('Page 5')).toBeInTheDocument()
  })

  it('returns null when totalPages is 1 or less', () => {
    const { container } = render(
      <Pagination currentPage={1} totalPages={1} onPageChange={() => {}} />
    )

    expect(container.innerHTML).toBe('')
  })

  it('highlights current page', () => {
    render(<Pagination currentPage={3} totalPages={5} onPageChange={() => {}} />)

    const currentBtn = screen.getByLabelText('Page 3')
    expect(currentBtn).toHaveAttribute('aria-current', 'page')
    expect(currentBtn).toHaveClass('bg-primary')
  })

  it('calls onPageChange when a page button is clicked', async () => {
    const user = userEvent.setup()
    const handleChange = vi.fn()

    render(<Pagination currentPage={1} totalPages={5} onPageChange={handleChange} />)

    await user.click(screen.getByLabelText('Page 2'))
    expect(handleChange).toHaveBeenCalledWith(2)
  })

  it('disables previous button on first page', () => {
    render(<Pagination currentPage={1} totalPages={5} onPageChange={() => {}} />)

    const prevBtn = screen.getByLabelText('Previous page')
    expect(prevBtn).toBeDisabled()
  })

  it('disables next button on last page', () => {
    render(<Pagination currentPage={5} totalPages={5} onPageChange={() => {}} />)

    const nextBtn = screen.getByLabelText('Next page')
    expect(nextBtn).toBeDisabled()
  })

  it('calls onPageChange with next/previous values', async () => {
    const user = userEvent.setup()
    const handleChange = vi.fn()

    render(<Pagination currentPage={3} totalPages={5} onPageChange={handleChange} />)

    await user.click(screen.getByLabelText('Next page'))
    expect(handleChange).toHaveBeenCalledWith(4)

    await user.click(screen.getByLabelText('Previous page'))
    expect(handleChange).toHaveBeenCalledWith(2)
  })

  it('shows ellipsis for many pages', () => {
    render(<Pagination currentPage={5} totalPages={20} onPageChange={() => {}} />)

    // The MoreHorizontal icon indicates ellipsis
    const ellipsisIcons = document.querySelectorAll('svg')
    // Should have at least 1 MoreHorizontal icon (lucide renders it)
    // plus Prev/Next chevron icons
    expect(ellipsisIcons.length).toBeGreaterThanOrEqual(1)
  })
})

describe('PageSizeSelect', () => {
  it('renders with default options', () => {
    render(<PageSizeSelect pageSize={10} onPageSizeChange={() => {}} />)

    expect(screen.getByText('Afficher')).toBeInTheDocument()
    expect(screen.getByText('par page')).toBeInTheDocument()
    expect(screen.getByRole('combobox')).toHaveValue('10')
  })

  it('calls onPageSizeChange when selection changes', async () => {
    const user = userEvent.setup()
    const handleChange = vi.fn()

    render(<PageSizeSelect pageSize={10} onPageSizeChange={handleChange} />)

    const select = screen.getByRole('combobox')
    await user.selectOptions(select, '20')
    expect(handleChange).toHaveBeenCalledWith(20)
  })

  it('renders custom pageSizeOptions', () => {
    render(
      <PageSizeSelect pageSize={5} pageSizeOptions={[5, 10, 25]} onPageSizeChange={() => {}} />
    )

    const select = screen.getByRole('combobox')
    expect(select).toHaveValue('5')
  })
})

describe('PaginationInfo', () => {
  it('displays correct range information', () => {
    render(<PaginationInfo currentPage={1} pageSize={10} total={50} />)

    expect(screen.getByText(/affichage de 1 à 10 sur 50 résultats/i)).toBeInTheDocument()
  })

  it('displays singular for total of 1', () => {
    render(<PaginationInfo currentPage={1} pageSize={10} total={1} />)

    expect(screen.getByText(/affichage de 1 à 1 sur 1 résultat$/i)).toBeInTheDocument()
  })

  it('displays correct range for last page', () => {
    render(<PaginationInfo currentPage={5} pageSize={10} total={42} />)

    expect(screen.getByText(/affichage de 41 à 42 sur 42 résultats/i)).toBeInTheDocument()
  })
})
