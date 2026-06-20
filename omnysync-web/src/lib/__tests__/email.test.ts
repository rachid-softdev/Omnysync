import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock resend so the dynamic import('resend') in email.ts resolves at transform time
const mockResend = vi.hoisted(() => ({
  emails: { send: vi.fn() },
}))
vi.mock('resend', () => ({
  Resend: class {
    emails = mockResend.emails
  },
}))

import { sendEmail, sendWelcomeEmail, sendSyncCompleteEmail } from '../email'

describe('Email Service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset environment
    vi.stubEnv('RESEND_API_KEY', undefined)
    vi.stubEnv('RESEND_FROM_EMAIL', 'test@example.com')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  describe('sendEmail', () => {
    it('should log when RESEND_API_KEY is not set', async () => {
      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      await sendEmail({
        to: 'user@example.com',
        subject: 'Test Subject',
        html: '<p>Test content</p>',
      })

      // Should log a message about sending (either "Would send" or "Resend not available")
      expect(consoleLogSpy).toHaveBeenCalled()
      const logCall = consoleLogSpy.mock.calls[0]![0] as string
      expect(logCall).toContain('user@example.com')
      expect(logCall).toContain('Test Subject')

      consoleLogSpy.mockRestore()
    })

    it('should handle missing required fields gracefully', async () => {
      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      // Empty to should still be handled
      await sendEmail({
        to: '',
        subject: 'Test Subject',
        html: '<p>Test</p>',
      })

      expect(consoleLogSpy).toHaveBeenCalled()

      consoleLogSpy.mockRestore()
    })

    it('should log and not throw when Resend API call fails', async () => {
      vi.stubEnv('RESEND_API_KEY', 're_abc123')
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      mockResend.emails.send.mockRejectedValue(new Error('Resend API error'))

      await sendEmail({
        to: 'user@example.com',
        subject: 'Test Subject',
        html: '<p>Test content</p>',
      })

      // Should log the error, not throw
      expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to send email:', expect.any(Error))
      consoleErrorSpy.mockRestore()
    })

    it('should send email via Resend when API key is configured', async () => {
      vi.stubEnv('RESEND_API_KEY', 're_abc123')
      mockResend.emails.send.mockResolvedValue({ id: 'email-id-123' })

      await sendEmail({
        to: 'user@example.com',
        subject: 'Real Subject',
        html: '<p>Real content</p>',
      })

      expect(mockResend.emails.send).toHaveBeenCalledWith({
        from: 'noreply@omnysync.com', // default FROM_EMAIL (captured at module load time)
        to: 'user@example.com',
        subject: 'Real Subject',
        html: '<p>Real content</p>',
      })
    })
  })

  describe('sendWelcomeEmail', () => {
    it('should log when RESEND_API_KEY is not set', async () => {
      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      await sendWelcomeEmail('newuser@example.com', 'Alice')

      expect(consoleLogSpy).toHaveBeenCalled()
      const logCall = consoleLogSpy.mock.calls[0]![0] as string
      expect(logCall).toContain('newuser@example.com')
      expect(logCall).toContain('Bienvenue')

      consoleLogSpy.mockRestore()
    })

    it('should send welcome email via Resend when configured', async () => {
      vi.stubEnv('RESEND_API_KEY', 're_abc123')
      mockResend.emails.send.mockResolvedValue({ id: 'email-id' })

      await sendWelcomeEmail('alice@example.com', 'Alice')

      expect(mockResend.emails.send).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'alice@example.com',
          subject: 'Bienvenue sur Omnysync !',
          from: 'noreply@omnysync.com', // default FROM_EMAIL (captured at module load time)
        })
      )
      // Verify HTML includes the user's name
      const callArg = mockResend.emails.send.mock.calls[0]![0] as { html: string }
      expect(callArg.html).toContain('Alice')
    })

    it('should not throw when Resend fails (logged instead)', async () => {
      vi.stubEnv('RESEND_API_KEY', 're_abc123')
      mockResend.emails.send.mockRejectedValue(new Error('Network error'))
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      await expect(sendWelcomeEmail('bob@example.com', 'Bob')).resolves.toBeUndefined()
      expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to send email:', expect.any(Error))

      consoleErrorSpy.mockRestore()
    })
  })

  describe('sendSyncCompleteEmail', () => {
    it('should send success email with destination URL', async () => {
      vi.stubEnv('RESEND_API_KEY', 're_abc123')
      mockResend.emails.send.mockResolvedValue({ id: 'email-id' })

      await sendSyncCompleteEmail(
        'user@example.com',
        'My Article',
        true,
        'https://blog.example.com/my-article'
      )

      expect(mockResend.emails.send).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'user@example.com',
          subject: 'Sync réussie: My Article',
        })
      )
      const callArg = mockResend.emails.send.mock.calls[0]![0] as { html: string }
      expect(callArg.html).toContain('réussie')
      expect(callArg.html).toContain('https://blog.example.com/my-article')
    })

    it('should send success email without destination URL', async () => {
      vi.stubEnv('RESEND_API_KEY', 're_abc123')
      mockResend.emails.send.mockResolvedValue({ id: 'email-id' })

      await sendSyncCompleteEmail('user@example.com', 'My Article', true)

      const callArg = mockResend.emails.send.mock.calls[0]![0] as { html: string }
      expect(callArg.html).toContain('réussie')
      // Should NOT include a link since destinationUrl is undefined
      expect(callArg.html).not.toContain('<a href')
    })

    it('should send failure email', async () => {
      vi.stubEnv('RESEND_API_KEY', 're_abc123')
      mockResend.emails.send.mockResolvedValue({ id: 'email-id' })

      await sendSyncCompleteEmail('user@example.com', 'Broken Doc', false)

      expect(mockResend.emails.send).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'user@example.com',
          subject: 'Sync échouée: Broken Doc',
        })
      )
      const callArg = mockResend.emails.send.mock.calls[0]![0] as { html: string }
      expect(callArg.html).toContain('échouée')
      expect(callArg.html).toContain('erreur')
    })

    it('should log when RESEND_API_KEY is not set', async () => {
      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      await sendSyncCompleteEmail('user@example.com', 'Doc', true)

      expect(consoleLogSpy).toHaveBeenCalled()
      const logCall = consoleLogSpy.mock.calls[0]![0] as string
      expect(logCall).toContain('user@example.com')

      consoleLogSpy.mockRestore()
    })
  })
})
