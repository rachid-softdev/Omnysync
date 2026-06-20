/**
 * Mock stub for resend package (not installed as a dependency)
 * Allows Vite to resolve the dynamic import('resend') in email.ts.
 * Actual mock values are provided by vi.mock('resend', factory) in test files.
 */
export class Resend {
  emails = { send: async () => {} }
}
