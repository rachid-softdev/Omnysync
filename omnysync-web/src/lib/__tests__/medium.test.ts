/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi } from 'vitest'

// Mock prisma before imports — medium service is in @omnysync/core
vi.mock('@omnysync/core/prisma', () => ({
  prisma: {
    connector: { findUnique: vi.fn(), create: vi.fn() },
    document: { findUnique: vi.fn(), update: vi.fn() },
  },
}))

// Mock fetchWithRetry
vi.mock('@omnysync/core/http', () => ({
  fetchWithRetry: vi.fn(),
}))

import { testMediumConnection, getMediumUser } from '../services/medium'

describe('medium service', () => {
  describe('testMediumConnection', () => {
    it('returns success when API call succeeds', async () => {
      const { fetchWithRetry } = await import('@omnysync/core/http')
      vi.mocked(fetchWithRetry).mockResolvedValueOnce({
        data: { id: '123', username: 'testuser', name: 'Test', url: '', imageUrl: '' },
      })

      const result = await testMediumConnection('valid-token')
      expect(result.success).toBe(true)
    })

    it('returns failure when API call fails', async () => {
      const { fetchWithRetry } = await import('@omnysync/core/http')
      vi.mocked(fetchWithRetry).mockRejectedValueOnce(new Error('Unauthorized'))

      const result = await testMediumConnection('invalid-token')
      expect(result.success).toBe(false)
      expect(result.error).toBeTruthy()
    })
  })

  describe('getMediumUser', () => {
    it('returns user data on success', async () => {
      const { fetchWithRetry } = await import('@omnysync/core/http')
      const mockUser = {
        id: '123',
        username: 'testuser',
        name: 'Test User',
        url: 'https://medium.com/@testuser',
        imageUrl: 'https://example.com/avatar.jpg',
      }
      vi.mocked(fetchWithRetry).mockResolvedValueOnce({ data: mockUser })

      const user = await getMediumUser('valid-token')
      expect(user.id).toBe('123')
      expect(user.username).toBe('testuser')
    })

    it('throws on failure', async () => {
      const { fetchWithRetry } = await import('@omnysync/core/http')
      vi.mocked(fetchWithRetry).mockRejectedValueOnce(new Error('Network error'))

      await expect(getMediumUser('token')).rejects.toThrow('Failed to fetch Medium user')
    })
  })
})
