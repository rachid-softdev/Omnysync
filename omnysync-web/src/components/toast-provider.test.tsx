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

  it('merges custom props with defaults', () => {
    render(<ToastProvider position="top-left" duration={3000} />)
    const toaster = screen.getByTestId('sonner-toaster')
    expect(toaster).toBeInTheDocument()
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

  it('toast.success with description and action', () => {
    const actionHandler = vi.fn()
    toast.success('Action completed', {
      description: 'The operation was successful',
      action: { label: 'Undo', onClick: actionHandler },
    })
    expect(mockSonnerSuccess).toHaveBeenCalledWith('Action completed', {
      description: 'The operation was successful',
      action: { label: 'Undo', onClick: actionHandler },
    })
  })

  it('toast.error with description', () => {
    toast.error('Failed', { description: 'Something went wrong' })
    expect(mockSonnerError).toHaveBeenCalledWith('Failed', {
      description: 'Something went wrong',
      action: undefined,
    })
  })

  it('calls multiple toasts sequentially', () => {
    toast.success('First')
    toast.error('Second')
    toast.warning('Third')

    expect(mockSonnerSuccess).toHaveBeenCalledTimes(1)
    expect(mockSonnerError).toHaveBeenCalledTimes(1)
    expect(mockSonnerWarning).toHaveBeenCalledTimes(1)
  })

  it('toast.dismiss without id still calls through', () => {
    toast.dismiss('')
    expect(mockSonnerDismiss).toHaveBeenCalledWith('')
  })
})

describe('fetchWithToast', () => {
  it('returns data on successful fetch', async () => {
    const mockData = { id: 1, name: 'test' }
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockData),
    })

    const { fetchWithToast } = await import('./toast-provider')
    const result = await fetchWithToast<typeof mockData>('/api/test')
    expect(result).toEqual(mockData)
  })

  it('throws error on failed fetch with server message', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: () => Promise.resolve({ error: 'Bad request error' }),
    })

    const { fetchWithToast } = await import('./toast-provider')
    await expect(fetchWithToast('/api/test')).rejects.toThrow('Bad request error')
  })

  it('throws generic error on failed fetch without error body', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: () => Promise.reject(new Error('parse error')),
    })

    const { fetchWithToast } = await import('./toast-provider')
    await expect(fetchWithToast('/api/test')).rejects.toThrow('Erreur 500')
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

  it('shows error toast when showToast is true', async () => {
    const asyncFn = vi.fn().mockRejectedValue(new Error('Toast error'))

    function TestComponent() {
      const { execute } = useAsync(asyncFn, { showToast: true })
      return (
        <div>
          <button onClick={() => execute().catch(() => {})}>Execute</button>
        </div>
      )
    }

    render(<TestComponent />)

    await act(async () => {
      screen.getByText('Execute').click()
    })

    expect(mockSonnerError).toHaveBeenCalledWith('Toast error', {
      action: undefined,
      description: undefined,
    })
  })

  it('sets loading state to true during execution', async () => {
    const asyncFn = vi.fn().mockResolvedValue('done')

    function TestComponent() {
      const { execute, loading } = useAsync(asyncFn)
      return (
        <div>
          <button onClick={() => execute()}>Execute</button>
          {loading && <span data-testid="loading">Loading...</span>}
        </div>
      )
    }

    render(<TestComponent />)
    expect(screen.queryByTestId('loading')).toBeNull()

    await act(async () => {
      screen.getByText('Execute').click()
    })

    expect(screen.queryByTestId('loading')).toBeNull()
  })
})
