/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ConnectorDialog } from './connector-dialog'

const mockOnClose = vi.fn()
const mockOnSuccess = vi.fn()

beforeEach(() => {
  vi.clearAllMocks()
  global.fetch = vi.fn()
})

describe('ConnectorDialog', () => {
  it('renders dialog for WORDPRESS connector', () => {
    render(<ConnectorDialog type="WORDPRESS" open={true} onClose={mockOnClose} onSuccess={mockOnSuccess} />)
    expect(screen.getByText('Connect WordPress')).toBeInTheDocument()
    expect(screen.getByLabelText('Site URL')).toBeInTheDocument()
    expect(screen.getByLabelText('Username')).toBeInTheDocument()
    expect(screen.getByLabelText('Application Password')).toBeInTheDocument()
  })

  it('renders dialog for GHOST connector', () => {
    render(<ConnectorDialog type="GHOST" open={true} onClose={mockOnClose} onSuccess={mockOnSuccess} />)
    expect(screen.getByText('Connect Ghost')).toBeInTheDocument()
    expect(screen.getByLabelText('Admin API Key')).toBeInTheDocument()
  })

  it('returns null for unknown connector type', () => {
    const { container } = render(<ConnectorDialog type="UNKNOWN" open={true} onClose={mockOnClose} onSuccess={mockOnSuccess} />)
    expect(container.innerHTML).toBe('')
  })

  it('shows success state after successful connection', async () => {
    ;(global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({}),
    })

    render(<ConnectorDialog type="WORDPRESS" open={true} onClose={mockOnClose} onSuccess={mockOnSuccess} />)
    
    fireEvent.click(screen.getByText('Connect'))

    await waitFor(() => {
      expect(screen.getByText('Connected successfully!')).toBeInTheDocument()
    })
  })

  it('shows error message on connection failure', async () => {
    ;(global.fetch as any).mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'Invalid credentials' }),
    })

    render(<ConnectorDialog type="WORDPRESS" open={true} onClose={mockOnClose} onSuccess={mockOnSuccess} />)
    
    fireEvent.click(screen.getByText('Connect'))

    await waitFor(() => {
      expect(screen.getByText('Invalid credentials')).toBeInTheDocument()
    })
  })

  it('calls onClose when Cancel is clicked', () => {
    render(<ConnectorDialog type="WORDPRESS" open={true} onClose={mockOnClose} onSuccess={mockOnSuccess} />)
    fireEvent.click(screen.getByText('Cancel'))
    expect(mockOnClose).toHaveBeenCalled()
  })
})
