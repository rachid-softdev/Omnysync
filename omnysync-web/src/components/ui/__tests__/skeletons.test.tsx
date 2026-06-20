import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import {
  TableSkeleton,
  CardSkeleton,
  ListSkeleton,
  FormSkeleton,
  StatsSkeleton,
  PageSkeleton,
  DashboardSkeleton,
} from '../skeletons'

describe('TableSkeleton', () => {
  it('renders default 5 rows and 4 columns', () => {
    const { container } = render(<TableSkeleton />)
    const skeletons = container.querySelectorAll('div.animate-pulse')
    // Header row (4) + 5 data rows (4 each) = 24
    expect(skeletons.length).toBe(24)
  })

  it('renders custom number of rows', () => {
    const { container } = render(<TableSkeleton rows={3} />)
    const skeletons = container.querySelectorAll('div.animate-pulse')
    // Header row (4) + 3 data rows (4 each) = 16
    expect(skeletons.length).toBe(16)
  })

  it('renders custom number of columns', () => {
    const { container } = render(<TableSkeleton columns={3} />)
    const skeletons = container.querySelectorAll('div.animate-pulse')
    // Header row (3) + 5 data rows (3 each) = 18
    expect(skeletons.length).toBe(18)
  })
})

describe('CardSkeleton', () => {
  it('renders card skeleton layout', () => {
    const { container } = render(<CardSkeleton />)
    expect(container.firstChild).toBeInTheDocument()
  })

  it('renders skeleton elements', () => {
    const { container } = render(<CardSkeleton />)
    const skeletons = container.querySelectorAll('div.animate-pulse')
    expect(skeletons.length).toBeGreaterThanOrEqual(5)
  })

  it('has rounded-lg border class', () => {
    const { container } = render(<CardSkeleton />)
    const card = container.firstChild as HTMLElement
    expect(card).toHaveClass('rounded-lg')
    expect(card).toHaveClass('border')
  })
})

describe('ListSkeleton', () => {
  it('renders default 5 items', () => {
    const { container } = render(<ListSkeleton />)
    const skeletons = container.querySelectorAll('div.animate-pulse')
    // 5 items, 3 skeleton elements each
    expect(skeletons.length).toBe(15)
  })

  it('renders custom number of items', () => {
    const { container } = render(<ListSkeleton items={3} />)
    const skeletons = container.querySelectorAll('div.animate-pulse')
    // 3 items, 3 skeleton elements each
    expect(skeletons.length).toBe(9)
  })
})

describe('FormSkeleton', () => {
  it('renders default 3 fields', () => {
    const { container } = render(<FormSkeleton />)
    const skeletons = container.querySelectorAll('div.animate-pulse')
    // 3 fields (2 skeleton each) + submit button (1) = 7
    expect(skeletons.length).toBe(7)
  })

  it('renders custom number of fields', () => {
    const { container } = render(<FormSkeleton fields={5} />)
    const skeletons = container.querySelectorAll('div.animate-pulse')
    // 5 fields (2 each) + submit button (1) = 11
    expect(skeletons.length).toBe(11)
  })

  it('renders submit button skeleton', () => {
    const { container } = render(<FormSkeleton fields={1} />)
    const skeletons = container.querySelectorAll('div.animate-pulse')
    // 1 field (2) + submit button (1) = 3
    expect(skeletons.length).toBe(3)
  })
})

describe('StatsSkeleton', () => {
  it('renders default 4 stats cards', () => {
    const { container } = render(<StatsSkeleton />)
    const skeletons = container.querySelectorAll('div.animate-pulse')
    // 4 cards, 3 skeleton elements each
    expect(skeletons.length).toBe(12)
  })

  it('renders custom count', () => {
    const { container } = render(<StatsSkeleton count={2} />)
    const skeletons = container.querySelectorAll('div.animate-pulse')
    expect(skeletons.length).toBe(6)
  })

  it('renders grid layout', () => {
    const { container } = render(<StatsSkeleton count={3} />)
    const grid = container.firstChild as HTMLElement
    expect(grid).toHaveClass('grid')
  })
})

describe('PageSkeleton', () => {
  it('renders full page skeleton', () => {
    const { container } = render(<PageSkeleton />)
    expect(container.firstChild).toBeInTheDocument()
  })
})

describe('DashboardSkeleton', () => {
  it('renders dashboard layout', () => {
    const { container } = render(<DashboardSkeleton />)
    expect(container.firstChild).toBeInTheDocument()
  })

  it('renders multiple skeleton elements', () => {
    const { container } = render(<DashboardSkeleton />)
    const skeletons = container.querySelectorAll('div.animate-pulse')
    expect(skeletons.length).toBeGreaterThanOrEqual(10)
  })
})
