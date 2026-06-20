import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { fetchWithTimeout, fetchWithRetry } from '../http-client'

describe('fetchWithTimeout', () => {
  let originalFetch: typeof global.fetch

  beforeEach(() => {
    originalFetch = global.fetch
    vi.restoreAllMocks()
  })

  afterEach(() => {
    global.fetch = originalFetch
  })

  it('returns data correctly on successful fetch', async () => {
    const mockData = { success: true, message: 'test' }
    const mockResponse = {
      ok: true,
      json: vi.fn().mockResolvedValue(mockData),
    }

    global.fetch = vi.fn().mockResolvedValue(mockResponse)

    const result = await fetchWithTimeout<typeof mockData>(
      'http://example.com/api',
      { method: 'GET' },
      5000
    )

    expect(result).toEqual(mockData)
  })

  it('throws error on non-ok response', async () => {
    const mockResponse = {
      ok: false,
      status: 404,
      text: vi.fn().mockResolvedValue('Not Found'),
    }

    global.fetch = vi.fn().mockResolvedValue(mockResponse)

    await expect(fetchWithTimeout('http://example.com/api')).rejects.toThrow('HTTP 404: Not Found')
  })

  it('throws error on 500 server error', async () => {
    const mockResponse = {
      ok: false,
      status: 500,
      text: vi.fn().mockResolvedValue('Internal Server Error'),
    }

    global.fetch = vi.fn().mockResolvedValue(mockResponse)

    await expect(fetchWithTimeout('http://example.com/api')).rejects.toThrow(
      'HTTP 500: Internal Server Error'
    )
  })

  it('includes Content-Type header by default', async () => {
    const mockData = { test: true }
    const mockResponse = {
      ok: true,
      json: vi.fn().mockResolvedValue(mockData),
    }

    global.fetch = vi.fn().mockResolvedValue(mockResponse)

    await fetchWithTimeout('http://example.com/api')

    expect(global.fetch).toHaveBeenCalledWith(
      'http://example.com/api',
      expect.objectContaining({
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
        }),
      })
    )
  })

  it('merges custom headers with default', async () => {
    const mockData = { test: true }
    const mockResponse = {
      ok: true,
      json: vi.fn().mockResolvedValue(mockData),
    }

    global.fetch = vi.fn().mockResolvedValue(mockResponse)

    await fetchWithTimeout('http://example.com/api', {
      headers: { Authorization: 'Bearer token' },
    })

    expect(global.fetch).toHaveBeenCalledWith(
      'http://example.com/api',
      expect.objectContaining({
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          Authorization: 'Bearer token',
        }),
      })
    )
  })

  it('uses custom method', async () => {
    const mockData = { test: true }
    const mockResponse = {
      ok: true,
      json: vi.fn().mockResolvedValue(mockData),
    }

    global.fetch = vi.fn().mockResolvedValue(mockResponse)

    await fetchWithTimeout('http://example.com/api', { method: 'POST' })

    expect(global.fetch).toHaveBeenCalledWith(
      'http://example.com/api',
      expect.objectContaining({
        method: 'POST',
      })
    )
  })

  it('throws on abort due to timeout', async () => {
    const abortError = new Error('Aborted')
    abortError.name = 'AbortError'

    global.fetch = vi.fn().mockRejectedValue(abortError)

    await expect(fetchWithTimeout('http://example.com/api', {}, 100)).rejects.toThrow('Aborted')
  })

  it('handles invalid URLs', async () => {
    global.fetch = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'))

    await expect(fetchWithTimeout('not-a-valid-url')).rejects.toThrow(TypeError)
  })

  it('handles response JSON parsing errors', async () => {
    const mockResponse = {
      ok: true,
      json: vi.fn().mockRejectedValue(new SyntaxError('Unexpected token in JSON')),
    }
    global.fetch = vi.fn().mockResolvedValue(mockResponse)

    await expect(fetchWithTimeout('http://example.com/api')).rejects.toThrow(SyntaxError)
  })

  it('handles empty response body', async () => {
    const mockResponse = {
      ok: true,
      json: vi.fn().mockRejectedValue(new SyntaxError('Unexpected end of JSON input')),
    }
    global.fetch = vi.fn().mockResolvedValue(mockResponse)

    await expect(fetchWithTimeout('http://example.com/api')).rejects.toThrow(
      'Unexpected end of JSON input'
    )
  })

  it('clears timeout in finally block', async () => {
    const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout')
    const mockResponse = {
      ok: true,
      json: vi.fn().mockResolvedValue({ data: 'test' }),
    }
    global.fetch = vi.fn().mockResolvedValue(mockResponse)

    await fetchWithTimeout('http://example.com/api')

    expect(clearTimeoutSpy).toHaveBeenCalled()
    clearTimeoutSpy.mockRestore()
  })

  it('uses default timeout of 30000 when not specified', async () => {
    const setTimeoutSpy = vi.spyOn(global, 'setTimeout')
    const mockResponse = {
      ok: true,
      json: vi.fn().mockResolvedValue({ data: 'test' }),
    }
    global.fetch = vi.fn().mockResolvedValue(mockResponse)

    await fetchWithTimeout('http://example.com/api')

    expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 30000)
    setTimeoutSpy.mockRestore()
  })

  it('uses no options argument (defaults to empty {})', async () => {
    const mockResponse = {
      ok: true,
      json: vi.fn().mockResolvedValue({ data: 'works' }),
    }
    global.fetch = vi.fn().mockResolvedValue(mockResponse)

    const result = await fetchWithTimeout('http://example.com/api')

    expect(result).toEqual({ data: 'works' })
    expect(global.fetch).toHaveBeenCalledWith(
      'http://example.com/api',
      expect.objectContaining({
        headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
      })
    )
  })

  it('allows custom Content-Type header to override default', async () => {
    const mockResponse = {
      ok: true,
      json: vi.fn().mockResolvedValue({}),
    }
    global.fetch = vi.fn().mockResolvedValue(mockResponse)

    await fetchWithTimeout('http://example.com/api', {
      headers: { 'Content-Type': 'application/xml' },
    })

    expect(global.fetch).toHaveBeenCalledWith(
      'http://example.com/api',
      expect.objectContaining({
        headers: expect.objectContaining({
          'Content-Type': 'application/xml',
        }),
      })
    )
  })

  it('propagates raw error when response.text fails on non-ok response', async () => {
    const mockResponse = {
      ok: false,
      status: 500,
      text: vi.fn().mockRejectedValue(new Error('Cannot read body')),
    }
    global.fetch = vi.fn().mockResolvedValue(mockResponse)

    // The error from .text() propagates directly through the finally block
    await expect(fetchWithTimeout('http://example.com/api')).rejects.toThrow('Cannot read body')
  })

  it('aborts request when signal is externally triggered', async () => {
    const abortError = new DOMException('The user aborted a request.', 'AbortError')
    global.fetch = vi.fn().mockRejectedValue(abortError)

    await expect(fetchWithTimeout('http://example.com/api')).rejects.toThrow(
      'The user aborted a request.'
    )
  })

  it('fires setTimeout callback that aborts the controller on timeout', async () => {
    vi.useFakeTimers()

    // Mock fetch to actually listen to the abort signal
    global.fetch = vi.fn().mockImplementation((_url: string, options: RequestInit) => {
      return new Promise((_resolve, reject) => {
        const signal = (options as { signal?: AbortSignal }).signal
        if (signal?.aborted) {
          reject(new DOMException('The operation was aborted', 'AbortError'))
          return
        }
        signal?.addEventListener('abort', () => {
          reject(new DOMException('The operation was aborted due to timeout', 'AbortError'))
        })
      })
    })

    const fetchPromise = fetchWithTimeout('http://example.com/api', {}, 1000)

    // Before advancing time, fetch should still be pending
    expect(global.fetch).toHaveBeenCalled()

    // Advance timers to trigger the setTimeout callback which aborts the controller
    vi.advanceTimersByTime(1000)

    await expect(fetchPromise).rejects.toThrow('The operation was aborted due to timeout')

    vi.useRealTimers()
  })
})

describe('fetchWithRetry', () => {
  let originalFetch: typeof global.fetch

  beforeEach(() => {
    originalFetch = global.fetch
    vi.restoreAllMocks()
  })

  afterEach(() => {
    global.fetch = originalFetch
  })

  it('returns data correctly on first attempt', async () => {
    const mockData = { success: true }
    const mockResponse = {
      ok: true,
      json: vi.fn().mockResolvedValue(mockData),
    }

    global.fetch = vi.fn().mockResolvedValue(mockResponse)

    const result = await fetchWithRetry<typeof mockData>('http://example.com/api')

    expect(result).toEqual(mockData)
    expect(global.fetch).toHaveBeenCalledTimes(1)
  })

  it('retries on failure (single retry)', async () => {
    const mockData = { success: true }
    const mockResponse = {
      ok: true,
      json: vi.fn().mockResolvedValue(mockData),
    }

    // First call fails, second succeeds
    global.fetch = vi
      .fn()
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValue(mockResponse)

    const result = await fetchWithRetry('http://example.com/api', {}, 3)

    expect(result).toEqual(mockData)
    expect(global.fetch).toHaveBeenCalledTimes(2)
  }, 10000)

  it('does not retry on 4xx errors', async () => {
    const mockResponse = {
      ok: false,
      status: 400,
      text: vi.fn().mockResolvedValue('Bad Request'),
    }

    global.fetch = vi.fn().mockResolvedValue(mockResponse)

    await expect(fetchWithRetry('http://example.com/api')).rejects.toThrow('HTTP 400: Bad Request')

    expect(global.fetch).toHaveBeenCalledTimes(1)
  })

  it('does not retry on 401 Unauthorized', async () => {
    const mockResponse = {
      ok: false,
      status: 401,
      text: vi.fn().mockResolvedValue('Unauthorized'),
    }

    global.fetch = vi.fn().mockResolvedValue(mockResponse)

    await expect(fetchWithRetry('http://example.com/api')).rejects.toThrow('HTTP 401: Unauthorized')

    expect(global.fetch).toHaveBeenCalledTimes(1)
  })

  it('does not retry on 404 Not Found', async () => {
    const mockResponse = {
      ok: false,
      status: 404,
      text: vi.fn().mockResolvedValue('Not Found'),
    }

    global.fetch = vi.fn().mockResolvedValue(mockResponse)

    await expect(fetchWithRetry('http://example.com/api')).rejects.toThrow('HTTP 404: Not Found')

    expect(global.fetch).toHaveBeenCalledTimes(1)
  })

  it('does retry on 5xx server errors', async () => {
    const mockData = { success: true }
    const mockResponse = {
      ok: true,
      json: vi.fn().mockResolvedValue(mockData),
    }

    const serverErrorResponse = {
      ok: false,
      status: 500,
      text: vi.fn().mockResolvedValue('Internal Server Error'),
    }

    global.fetch = vi
      .fn()
      .mockResolvedValueOnce(serverErrorResponse)
      .mockResolvedValue(mockResponse)

    const result = await fetchWithRetry('http://example.com/api', {}, 3)

    expect(result).toEqual(mockData)
    expect(global.fetch).toHaveBeenCalledTimes(2)
  }, 10000)

  it('throws error after max retries exceeded', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Network error'))

    await expect(fetchWithRetry('http://example.com/api', {}, 3)).rejects.toThrow('Network error')

    expect(global.fetch).toHaveBeenCalledTimes(3)
  }, 10000)

  it('applies custom max retries', async () => {
    const mockData = { success: true }
    const mockResponse = {
      ok: true,
      json: vi.fn().mockResolvedValue(mockData),
    }

    global.fetch = vi
      .fn()
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValue(mockResponse)

    const result = await fetchWithRetry('http://example.com/api', {}, 2)

    expect(result).toEqual(mockData)
    expect(global.fetch).toHaveBeenCalledTimes(2)
  }, 10000)

  it('passes custom headers to fetch', async () => {
    const mockData = { success: true }
    const mockResponse = {
      ok: true,
      json: vi.fn().mockResolvedValue(mockData),
    }

    global.fetch = vi.fn().mockResolvedValue(mockResponse)

    await fetchWithRetry('http://example.com/api', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer token123',
      },
    })

    expect(global.fetch).toHaveBeenCalledWith(
      'http://example.com/api',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer token123',
        }),
      })
    )
  })

  it('does not retry on 403 Forbidden', async () => {
    const mockResponse = {
      ok: false,
      status: 403,
      text: vi.fn().mockResolvedValue('Forbidden'),
    }

    global.fetch = vi.fn().mockResolvedValue(mockResponse)

    await expect(fetchWithRetry('http://example.com/api')).rejects.toThrow('HTTP 403: Forbidden')

    expect(global.fetch).toHaveBeenCalledTimes(1)
  })

  it('does retry on 502 Bad Gateway', async () => {
    const mockData = { success: true }
    const mockResponse = {
      ok: true,
      json: vi.fn().mockResolvedValue(mockData),
    }

    const serverErrorResponse = {
      ok: false,
      status: 502,
      text: vi.fn().mockResolvedValue('Bad Gateway'),
    }

    global.fetch = vi
      .fn()
      .mockResolvedValueOnce(serverErrorResponse)
      .mockResolvedValue(mockResponse)

    const result = await fetchWithRetry('http://example.com/api', {}, 3)

    expect(result).toEqual(mockData)
    expect(global.fetch).toHaveBeenCalledTimes(2)
  }, 10000)

  it('logs retry attempts with exponential backoff', async () => {
    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    global.fetch = vi
      .fn()
      .mockRejectedValueOnce(new Error('Network error'))
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ success: true }),
      })

    await fetchWithRetry('http://example.com/api', {}, 3)

    expect(consoleLogSpy).toHaveBeenCalledTimes(2)
    expect(consoleLogSpy).toHaveBeenNthCalledWith(1, 'Retry 1/3 after 1000ms')
    expect(consoleLogSpy).toHaveBeenNthCalledWith(2, 'Retry 2/3 after 2000ms')

    consoleLogSpy.mockRestore()
  }, 10000)

  it('attempts once with 0 maxRetries', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Network error'))

    await expect(fetchWithRetry('http://example.com/api', {}, 0)).rejects.toThrow(undefined)
    expect(global.fetch).toHaveBeenCalledTimes(0)
  })

  it('attempts once with 1 maxRetry', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Network error'))

    await expect(fetchWithRetry('http://example.com/api', {}, 1)).rejects.toThrow('Network error')
    expect(global.fetch).toHaveBeenCalledTimes(1)
  })

  it('retries on AbortError (not 4xx, so retryable)', async () => {
    const mockData = { success: true }
    const mockResponse = {
      ok: true,
      json: vi.fn().mockResolvedValue(mockData),
    }

    const abortError = new Error('The operation was aborted')
    abortError.name = 'AbortError'

    global.fetch = vi.fn().mockRejectedValueOnce(abortError).mockResolvedValue(mockResponse)

    const result = await fetchWithRetry('http://example.com/api', {}, 3)
    expect(result).toEqual(mockData)
    expect(global.fetch).toHaveBeenCalledTimes(2)
  }, 10000)

  it('retries on 503 Service Unavailable', async () => {
    const mockData = { success: true }
    const mockResponse = {
      ok: true,
      json: vi.fn().mockResolvedValue(mockData),
    }

    const serverErrorResponse = {
      ok: false,
      status: 503,
      text: vi.fn().mockResolvedValue('Service Unavailable'),
    }

    global.fetch = vi
      .fn()
      .mockResolvedValueOnce(serverErrorResponse)
      .mockResolvedValue(mockResponse)

    const result = await fetchWithRetry('http://example.com/api', {}, 3)
    expect(result).toEqual(mockData)
    expect(global.fetch).toHaveBeenCalledTimes(2)
  }, 10000)

  it('does not retry on 429 Too Many Requests (rate limiting)', async () => {
    const mockResponse = {
      ok: false,
      status: 429,
      text: vi.fn().mockResolvedValue('Too Many Requests'),
    }

    global.fetch = vi.fn().mockResolvedValue(mockResponse)

    await expect(fetchWithRetry('http://example.com/api')).rejects.toThrow(
      'HTTP 429: Too Many Requests'
    )

    expect(global.fetch).toHaveBeenCalledTimes(1)
  })

  it('retries on non-Error thrown values', async () => {
    const mockData = { success: true }
    const mockResponse = {
      ok: true,
      json: vi.fn().mockResolvedValue(mockData),
    }

    // Simulate a thrown string (not Error instance)
    global.fetch = vi.fn().mockRejectedValueOnce('string error').mockResolvedValue(mockResponse)

    const result = await fetchWithRetry('http://example.com/api', {}, 3)

    expect(result).toEqual(mockData)
    expect(global.fetch).toHaveBeenCalledTimes(2)
  }, 10000)

  it('throws last error value when non-Error value is thrown and retries exhausted', async () => {
    global.fetch = vi.fn().mockRejectedValue('connection string failure')

    await expect(fetchWithRetry('http://example.com/api', {}, 3)).rejects.toBe(
      'connection string failure'
    )

    expect(global.fetch).toHaveBeenCalledTimes(3)
  }, 10000)

  it('handles negative maxRetries as zero retries', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('fail'))

    await expect(fetchWithRetry('http://example.com/api', {}, -1)).rejects.toThrow(undefined)
    expect(global.fetch).toHaveBeenCalledTimes(0)
  })

  it('retries multiple times with all 5xx before succeeding', async () => {
    const mockData = { success: true }
    const mockResponse = {
      ok: true,
      json: vi.fn().mockResolvedValue(mockData),
    }

    const error500 = {
      ok: false,
      status: 500,
      text: vi.fn().mockResolvedValue('Server Error'),
    }

    global.fetch = vi
      .fn()
      .mockResolvedValueOnce(error500)
      .mockResolvedValueOnce(error500)
      .mockResolvedValue(mockResponse)

    const result = await fetchWithRetry('http://example.com/api', {}, 3)
    expect(result).toEqual(mockData)
    expect(global.fetch).toHaveBeenCalledTimes(3)
  }, 10000)

  it('maintains correct backoff with custom retry count', async () => {
    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    global.fetch = vi
      .fn()
      .mockRejectedValueOnce(new Error('e1'))
      .mockRejectedValueOnce(new Error('e2'))
      .mockRejectedValueOnce(new Error('e3'))
      .mockRejectedValueOnce(new Error('e4'))
      .mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ success: true }),
      })

    await fetchWithRetry('http://example.com/api', {}, 5)

    // Should see retry 1/5 through 4/5
    expect(consoleLogSpy).toHaveBeenCalledTimes(4)
    expect(consoleLogSpy).toHaveBeenNthCalledWith(1, 'Retry 1/5 after 1000ms')
    expect(consoleLogSpy).toHaveBeenNthCalledWith(2, 'Retry 2/5 after 2000ms')
    expect(consoleLogSpy).toHaveBeenNthCalledWith(3, 'Retry 3/5 after 4000ms')
    expect(consoleLogSpy).toHaveBeenNthCalledWith(4, 'Retry 4/5 after 8000ms')

    consoleLogSpy.mockRestore()
  }, 20000)
})
