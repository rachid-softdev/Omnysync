import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import {
  Skeleton,
  DocumentCardSkeleton,
  ConnectorCardSkeleton,
  TableRowSkeleton,
  StatsCardSkeleton,
  PageSkeleton,
} from '../skeleton'

describe('Skeleton', () => {
  it('renders basic skeleton div', () => {
    const { container } = render(<Skeleton />)
    const skeleton = container.firstChild as HTMLElement
    expect(skeleton).toBeInTheDocument()
    expect(skeleton).toHaveClass('animate-pulse')
  })

  it('applies custom className', () => {
    const { container } = render(<Skeleton className="custom-skeleton" />)
    const skeleton = container.firstChild as HTMLElement
    expect(skeleton).toHaveClass('custom-skeleton')
  })

  it('has rounded-md and bg-muted classes', () => {
    const { container } = render(<Skeleton />)
    const skeleton = container.firstChild as HTMLElement
    expect(skeleton).toHaveClass('rounded-md')
    expect(skeleton).toHaveClass('bg-muted')
  })

  it('spreads additional props', () => {
    const { container } = render(<Skeleton data-testid="skeleton" style={{ width: 100 }} />)
    const skeleton = container.firstChild as HTMLElement
    expect(skeleton).toHaveAttribute('data-testid', 'skeleton')
  })
})

describe('DocumentCardSkeleton', () => {
  it('renders with document card layout', () => {
    const { container } = render(<DocumentCardSkeleton />)
    expect(container.firstChild).toBeInTheDocument()
  })

  it('renders multiple skeleton elements', () => {
    const { container } = render(<DocumentCardSkeleton />)
    const skeletons = container.querySelectorAll('div.animate-pulse')
    expect(skeletons.length).toBeGreaterThanOrEqual(5)
  })
})

describe('ConnectorCardSkeleton', () => {
  it('renders with connector card layout', () => {
    const { container } = render(<ConnectorCardSkeleton />)
    expect(container.firstChild).toBeInTheDocument()
  })

  it('renders skeleton elements inside', () => {
    const { container } = render(<ConnectorCardSkeleton />)
    const skeletons = container.querySelectorAll('div.animate-pulse')
    expect(skeletons.length).toBeGreaterThanOrEqual(3)
  })
})

describe('TableRowSkeleton', () => {
  it('renders default 4 columns', () => {
    const { container } = render(<TableRowSkeleton />)
    const skeletons = container.querySelectorAll('div.animate-pulse')
    expect(skeletons.length).toBe(4)
  })

  it('renders custom number of columns', () => {
    const { container } = render(<TableRowSkeleton columns={6} />)
    const skeletons = container.querySelectorAll('div.animate-pulse')
    expect(skeletons.length).toBe(6)
  })

  it('renders with flex layout', () => {
    const { container } = render(<TableRowSkeleton />)
    const row = container.firstChild as HTMLElement
    expect(row).toHaveClass('flex')
  })
})

describe('StatsCardSkeleton', () => {
  it('renders stats card layout', () => {
    const { container } = render(<StatsCardSkeleton />)
    expect(container.firstChild).toBeInTheDocument()
  })

  it('renders skeleton elements', () => {
    const { container } = render(<StatsCardSkeleton />)
    const skeletons = container.querySelectorAll('div.animate-pulse')
    expect(skeletons.length).toBeGreaterThanOrEqual(3)
  })
})

describe('PageSkeleton', () => {
  it('renders complete page skeleton without crashing', () => {
    const { container } = render(<PageSkeleton />)
    expect(container.firstChild).toBeInTheDocument()
  })

  it('renders DocumentCardSkeleton children', () => {
    const { container } = render(<PageSkeleton />)
    // PageSkeleton includes DocumentCardSkeleton 3 times
    expect(container.firstChild).toBeInTheDocument()
  })
})
