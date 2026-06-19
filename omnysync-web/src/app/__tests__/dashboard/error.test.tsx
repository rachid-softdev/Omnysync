/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ErrorPage from '../../(dashboard)/dashboard/error'

describe('Dashboard Error', () => {
  it('renders error message', () => {
    const error = new Error('Dashboard error')
    const reset = vi.fn()
    render(<ErrorPage error={error} reset={reset} />)
    expect(screen.getByText('Something went wrong!')).toBeInTheDocument()
    expect(screen.getByText(/error occurred/)).toBeInTheDocument()
  })

  it('renders try again button', () => {
    const error = new Error('Test error')
    const reset = vi.fn()
    render(<ErrorPage error={error} reset={reset} />)
    expect(screen.getByText('Try again')).toBeInTheDocument()
  })

  it('calls reset on try again click', () => {
    const error = new Error('Test error')
    const reset = vi.fn()
    render(<ErrorPage error={error} reset={reset} />)
    fireEvent.click(screen.getByText('Try again'))
    expect(reset).toHaveBeenCalled()
  })
})
