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
})
