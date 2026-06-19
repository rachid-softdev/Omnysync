import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ToastProvider, toast, useAsync } from './toast-provider'
import { act } from 'react'

const mockSonnerSuccess = vi.hoisted(() => vi.fn())
const mockSonnerError = vi.hoisted(() => vi.fn())
const mockSonnerWarning = vi.hoisted(() => vi.fn())
const mockSonnerInfo = vi.hoisted(() => vi.fn())
const mockSonnerLoading = vi.hoisted(() => vi.fn(() => 'toast-id'))
const mockSonnerDismiss = vi.hoisted(() => vi.fn())

vi.mock('sonner', () => ({
  Toaster: ({ className }: { className?: string }) => (
    <div data-testid="sonner-toaster" className={className}>
      Sonner Toaster
    </div>
  ),
  toast: {
    success: mockSonnerSuccess,
    error: mockSonnerError,
    warning: mockSonnerWarning,
    info: mockSonnerInfo,
    loading: mockSonnerLoading,
    dismiss: mockSonnerDismiss,
  },
}))

beforeEach(() => {
  vi.clearAllMocks()
})

describe('ToastProvider', () => {
  it('renders Sonner Toaster', () => {
    render(<ToastProvider />)
    expect(screen.getByTestId('sonner-toaster')).toBeInTheDocument()
  })

  it('passes className to toaster', () => {
    render(<ToastProvider />)
    const toaster = screen.getByTestId('sonner-toaster')
    expect(toaster.className).toContain('toaster group')
  })
})

describe('toast object', () => {
  it('toast.success calls sonner toast.success', () => {
    toast.success('Success!')
    expect(mockSonnerSuccess).toHaveBeenCalledWith('Success!', {
      action: undefined,
      description: undefined,
    })
  })

  it('toast.error calls sonner toast.error', () => {
    toast.error('Error!')
    expect(mockSonnerError).toHaveBeenCalledWith('Error!', {
      action: undefined,
      description: undefined,
    })
  })

  it('toast.warning calls sonner toast.warning', () => {
    toast.warning('Warning!')
    expect(mockSonnerWarning).toHaveBeenCalledWith('Warning!', {
      action: undefined,
      description: undefined,
    })
  })

  it('toast.info calls sonner toast.info', () => {
    toast.info('Info!')
    expect(mockSonnerInfo).toHaveBeenCalledWith('Info!', {
      action: undefined,
      description: undefined,
    })
  })

  it('toast.loading calls sonner toast.loading', () => {
    const id = toast.loading('Loading...')
    expect(mockSonnerLoading).toHaveBeenCalledWith('Loading...')
    expect(id).toBe('toast-id')
  })

  it('toast.dismiss calls sonner toast.dismiss', () => {
    toast.dismiss('my-toast')
    expect(mockSonnerDismiss).toHaveBeenCalledWith('my-toast')
  })
})

describe('useAsync', () => {
  it('handles successful async function', async () => {
    const onSuccess = vi.fn()
    const asyncFn = vi.fn().mockResolvedValue('result')

    function TestComponent() {
      const { execute, loading } = useAsync(asyncFn, { onSuccess })
      return (
        <div>
          <button onClick={() => execute()}>Execute</button>
          {loading && <span>Loading...</span>}
        </div>
      )
    }

    render(<TestComponent />)

    await act(async () => {
      screen.getByText('Execute').click()
    })

    expect(onSuccess).toHaveBeenCalledWith('result')
  })

  it('handles error state', async () => {
    const onError = vi.fn()
    const asyncFn = vi.fn().mockRejectedValue(new Error('Test error'))

    function TestComponent() {
      const { execute, error } = useAsync(asyncFn, { onError, showToast: false })
      return (
        <div>
          <button onClick={() => execute().catch(() => {})}>Execute</button>
          {error && <span data-testid="error">{error.message}</span>}
        </div>
      )
    }

    render(<TestComponent />)

    await act(async () => {
      screen.getByText('Execute').click()
    })

    expect(onError).toHaveBeenCalled()
    expect(screen.getByTestId('error')).toHaveTextContent('Test error')
  })
})
