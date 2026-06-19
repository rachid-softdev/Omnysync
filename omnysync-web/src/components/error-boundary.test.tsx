/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ErrorBoundary, useErrorHandler } from './error-boundary'
import { act } from 'react'

// Suppress console.error from React error boundary logging
vi.spyOn(console, 'error').mockImplementation(() => {})

const ThrowError = ({ message }: { message: string }) => {
  throw new Error(message)
}

describe('ErrorBoundary', () => {
  it('renders children when no error', () => {
    render(
      <ErrorBoundary>
        <div>Normal content</div>
      </ErrorBoundary>
    )
    expect(screen.getByText('Normal content')).toBeInTheDocument()
  })

  it('catches rendering errors and shows fallback UI', () => {
    render(
      <ErrorBoundary>
        <ThrowError message="Test error!" />
      </ErrorBoundary>
    )
    expect(screen.getByText('Une erreur est survenue')).toBeInTheDocument()
  })

  it('shows error message in development', () => {
    const originalEnv = process.env.NODE_ENV
    process.env.NODE_ENV = 'development'

    render(
      <ErrorBoundary>
        <ThrowError message="Test error details" />
      </ErrorBoundary>
    )

    expect(screen.getByText('Test error details')).toBeInTheDocument()
    process.env.NODE_ENV = originalEnv
  })

  it('renders custom fallback when provided', () => {
    render(
      <ErrorBoundary fallback={<div>Custom error UI</div>}>
        <ThrowError message="error" />
      </ErrorBoundary>
    )
    expect(screen.getByText('Custom error UI')).toBeInTheDocument()
  })

  it('resets error state then re-catches persistent errors', () => {
    // When children always throw, clicking Réessayer resets the boundary
    // but the children immediately throw again, re-triggering the fallback
    render(
      <ErrorBoundary>
        <ThrowError message="Temporary error" />
      </ErrorBoundary>
    )

    // Confirm we see the error
    expect(screen.getByText('Une erreur est survenue')).toBeInTheDocument()

    // Click retry - this resets the boundary, but ThrowError always throws
    fireEvent.click(screen.getByText('Réessayer'))

    // Error boundary catches the error again, so fallback is still shown
    // This is correct behavior for a component that always throws
    expect(screen.getByText('Une erreur est survenue')).toBeInTheDocument()
  })
})

describe('useErrorHandler', () => {
  it('returns error state and reset function', () => {
    function TestComponent() {
      const { error, setError, resetError } = useErrorHandler()
      return (
        <div>
          {error && <span data-testid="error">{error.message}</span>}
          <button data-testid="set" onClick={() => setError(new Error('Oops'))}>Set</button>
          <button data-testid="reset" onClick={resetError}>Reset</button>
        </div>
      )
    }

    render(<TestComponent />)
    expect(screen.queryByTestId('error')).not.toBeInTheDocument()

    fireEvent.click(screen.getByTestId('set'))
    expect(screen.getByTestId('error')).toHaveTextContent('Oops')

    fireEvent.click(screen.getByTestId('reset'))
    expect(screen.queryByTestId('error')).not.toBeInTheDocument()
  })
})
