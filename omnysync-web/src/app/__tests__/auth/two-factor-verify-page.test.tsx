import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import TwoFactorVerifyPage from '../../auth/2fa-verify/page'

const mockPush = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => new URLSearchParams('continue=/dashboard'),
}))

beforeEach(() => {
  vi.clearAllMocks()
  global.fetch = vi.fn()
})

describe('TwoFactorVerifyPage', () => {
  it('renders 2FA verification form', () => {
    render(<TwoFactorVerifyPage />)
    expect(screen.getByText('Two-Factor Authentication')).toBeInTheDocument()
    expect(screen.getByLabelText('6-digit code')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('000000')).toBeInTheDocument()
  })

  it('renders verify button', () => {
    render(<TwoFactorVerifyPage />)
    expect(screen.getByText('Verify')).toBeInTheDocument()
  })

  it('shows error on invalid code', async () => {
    ;(global.fetch as any).mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'Invalid code' }),
    })

    render(<TwoFactorVerifyPage />)
    fireEvent.change(screen.getByPlaceholderText('000000'), { target: { value: '123456' } })
    fireEvent.click(screen.getByText('Verify'))

    await waitFor(() => {
      expect(screen.getByText('Invalid code')).toBeInTheDocument()
    })
  })

  it('redirects on successful verification', async () => {
    ;(global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true }),
    })

    render(<TwoFactorVerifyPage />)
    fireEvent.change(screen.getByPlaceholderText('000000'), { target: { value: '123456' } })
    fireEvent.click(screen.getByText('Verify'))

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/dashboard')
    })
  })

  it('only allows numeric input up to 6 digits', () => {
    render(<TwoFactorVerifyPage />)
    const input = screen.getByPlaceholderText('000000') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'abc123456def' } })
    expect(input.value).toBe('123456')
  })

  it('disables verify button when code is not 6 digits', () => {
    render(<TwoFactorVerifyPage />)
    const button = screen.getByText('Verify') as HTMLButtonElement
    expect(button.disabled).toBe(true)

    fireEvent.change(screen.getByPlaceholderText('000000'), { target: { value: '123' } })
    expect(button.disabled).toBe(true)

    fireEvent.change(screen.getByPlaceholderText('000000'), { target: { value: '123456' } })
    expect(button.disabled).toBe(false)
  })
})
