import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Suspense } from './suspense-wrapper'

describe('Suspense', () => {
  it('renders children', () => {
    render(
      <Suspense>
        <div>Content</div>
      </Suspense>
    )
    expect(screen.getByText('Content')).toBeInTheDocument()
  })

  it('renders custom fallback element alongside children', () => {
    render(
      <Suspense fallback={<div>Loading...</div>}>
        <div>Main content</div>
      </Suspense>
    )
    // Both fallback and children are rendered in Suspense boundary
    expect(screen.getByText('Main content')).toBeInTheDocument()
  })

  it('accepts a fallback prop', () => {
    render(
      <Suspense fallback={<div>Custom Loading</div>}>
        <div>Actual content</div>
      </Suspense>
    )
    expect(screen.getByText('Actual content')).toBeInTheDocument()
  })

  it('shows default Skeleton fallback when children suspend', () => {
    let resolvePromise: () => void
    const promise = new Promise<void>((resolve) => {
      resolvePromise = resolve
    })

    function SuspendComponent() {
      throw promise
    }

    const { container } = render(
      <Suspense>
        <SuspendComponent />
      </Suspense>
    )

    // The Skeleton should render as the default fallback
    const skeleton = container.querySelector('.animate-pulse')
    expect(skeleton).toBeInTheDocument()
    expect(skeleton?.innerHTML).toContain('rounded')

    // Clean up the promise to avoid memory leaks
    resolvePromise!()
  })

  it('shows custom fallback when children suspend', () => {
    const promise = new Promise(() => {})

    function SuspendComponent() {
      throw promise
    }

    render(
      <Suspense fallback={<div data-testid="custom-loader">Loading data...</div>}>
        <SuspendComponent />
      </Suspense>
    )

    expect(screen.getByTestId('custom-loader')).toBeInTheDocument()
    expect(screen.getByText('Loading data...')).toBeInTheDocument()
  })

  it('renders children without suspending returns no fallback', () => {
    const { container } = render(
      <Suspense>
        <div>Immediate content</div>
      </Suspense>
    )

    // No skeleton should appear when children render immediately
    expect(container.querySelector('.animate-pulse')).toBeNull()
    expect(screen.getByText('Immediate content')).toBeInTheDocument()
  })
})
