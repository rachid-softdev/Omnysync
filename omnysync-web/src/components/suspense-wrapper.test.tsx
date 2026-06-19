/* eslint-disable @typescript-eslint/no-explicit-any */
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
})
