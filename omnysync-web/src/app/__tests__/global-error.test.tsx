import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import GlobalError from '../global-error'

describe('GlobalError page', () => {
  it('renders error title', () => {
    const error = new Error('Server error occurred')
    const reset = vi.fn()
    render(<GlobalError error={error} reset={reset} />)
    expect(screen.getByText('Erreur serveur')).toBeInTheDocument()
  })

  it('renders error message', () => {
    const error = new Error('Database connection failed')
    const reset = vi.fn()
    render(<GlobalError error={error} reset={reset} />)
    expect(screen.getByText('Database connection failed')).toBeInTheDocument()
  })

  it('renders error digest when available', () => {
    const error = new Error('Error with digest')
    error.digest = 'abc123'
    const reset = vi.fn()
    render(<GlobalError error={error} reset={reset} />)
    expect(screen.getByText(/ID: abc123/)).toBeInTheDocument()
  })

  it('calls reset on button click', () => {
    const error = new Error('Test error')
    const reset = vi.fn()
    render(<GlobalError error={error} reset={reset} />)
    fireEvent.click(screen.getByText('Réessayer'))
    expect(reset).toHaveBeenCalled()
  })

  it('renders description text', () => {
    const error = new Error('Test')
    const reset = vi.fn()
    render(<GlobalError error={error} reset={reset} />)
    expect(screen.getByText(/erreur inattendue/i)).toBeInTheDocument()
  })
})
