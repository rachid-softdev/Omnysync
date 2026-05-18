export async function fetchWithTimeout<T>(
  url: string,
  options: RequestInit = {},
  timeoutMs = 30000
): Promise<T> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    })
    
    if (!response.ok) {
      const error = await response.text()
      throw new Error(`HTTP ${response.status}: ${error}`)
    }
    
    return response.json()
  } finally {
    clearTimeout(timeoutId)
  }
}

export async function fetchWithRetry<T>(
  url: string,
  options: RequestInit = {},
  maxRetries = 3
): Promise<T> {
  let lastError
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fetchWithTimeout<T>(url, options)
    } catch (error) {
      lastError = error
      
      // Don't retry on client errors (4xx)
      if (error instanceof Error && error.message.startsWith('HTTP 4')) {
        throw error
      }
      
      if (i < maxRetries - 1) {
        const delay = Math.pow(2, i) * 1000
        console.log(`Retry ${i + 1}/${maxRetries} after ${delay}ms`)
        await new Promise(r => setTimeout(r, delay))
      }
    }
  }
  
  throw lastError
}