import { describe, it, expect } from 'vitest'
import { z } from 'zod'

// Replicate the actual schema from env.ts to test validation logic
const envSchema = z.object({
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  NEXTAUTH_SECRET: z.string().min(1, 'NEXTAUTH_SECRET is required'),
  NEXTAUTH_URL: z.string().url('NEXTAUTH_URL must be a valid URL'),
  GOOGLE_CLIENT_ID: z.string().min(1, 'GOOGLE_CLIENT_ID is required'),
  GOOGLE_CLIENT_SECRET: z.string().min(1, 'GOOGLE_CLIENT_SECRET is required'),
  OPENAI_API_KEY: z.string().optional(),
  QSTASH_URL: z.string().optional(),
  QSTASH_TOKEN: z.string().optional(),
  QSTASH_CURRENT_SIGNING_KEY: z.string().optional(),
  QSTASH_NEXT_SIGNING_KEY: z.string().optional(),
  ENCRYPTION_KEY: z.string().min(32, 'ENCRYPTION_KEY must be at least 32 characters'),
  ENCRYPTION_SALT: z.string().min(16, 'ENCRYPTION_SALT must be at least 16 characters'),
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  STRIPE_PRICE_PRO_MONTHLY: z.string().optional(),
  STRIPE_PRICE_BUSINESS_MONTHLY: z.string().optional(),
  RESEND_API_KEY: z.string().optional(),
  RESEND_FROM_EMAIL: z.string().optional(),
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
  AWS_REGION: z.string().optional(),
  AWS_S3_BUCKET: z.string().optional(),
})

const validEnv = {
  DATABASE_URL: 'postgresql://localhost:5432/test',
  NEXTAUTH_SECRET: 'test-secret-key',
  NEXTAUTH_URL: 'http://localhost:3000',
  GOOGLE_CLIENT_ID: 'test-client-id',
  GOOGLE_CLIENT_SECRET: 'test-client-secret',
  ENCRYPTION_KEY: 'test-encryption-key-32bytes-minimum',
  ENCRYPTION_SALT: 'test-salt-16-chars-long',
}

describe('env validation schema', () => {
  it('throws error when DATABASE_URL is missing', () => {
    const env = { ...validEnv }
    delete (env as any).DATABASE_URL
    const result = envSchema.safeParse(env)
    expect(result.success).toBe(false)
  })

  it('throws error when NEXTAUTH_SECRET is missing', () => {
    const env = { ...validEnv }
    delete (env as any).NEXTAUTH_SECRET
    const result = envSchema.safeParse(env)
    expect(result.success).toBe(false)
  })

  it('throws error when NEXTAUTH_URL is missing', () => {
    const env = { ...validEnv }
    delete (env as any).NEXTAUTH_URL
    const result = envSchema.safeParse(env)
    expect(result.success).toBe(false)
  })

  it('throws error when NEXTAUTH_URL is invalid URL format', () => {
    const env = { ...validEnv, NEXTAUTH_URL: 'not-a-valid-url' }
    const result = envSchema.safeParse(env)
    expect(result.success).toBe(false)
  })

  it('throws error when GOOGLE_CLIENT_ID is missing', () => {
    const env = { ...validEnv }
    delete (env as any).GOOGLE_CLIENT_ID
    const result = envSchema.safeParse(env)
    expect(result.success).toBe(false)
  })

  it('throws error when GOOGLE_CLIENT_SECRET is missing', () => {
    const env = { ...validEnv }
    delete (env as any).GOOGLE_CLIENT_SECRET
    const result = envSchema.safeParse(env)
    expect(result.success).toBe(false)
  })

  it('throws error when ENCRYPTION_KEY is less than 32 characters', () => {
    const env = { ...validEnv, ENCRYPTION_KEY: 'short-key' }
    const result = envSchema.safeParse(env)
    expect(result.success).toBe(false)
  })

  it('throws error when ENCRYPTION_KEY is exactly 31 characters', () => {
    const env = { ...validEnv, ENCRYPTION_KEY: 'a'.repeat(31) }
    const result = envSchema.safeParse(env)
    expect(result.success).toBe(false)
  })

  it('accepts ENCRYPTION_KEY with exactly 32 characters', () => {
    const env = { ...validEnv, ENCRYPTION_KEY: 'a'.repeat(32) }
    const result = envSchema.safeParse(env)
    expect(result.success).toBe(true)
  })

  it('accepts ENCRYPTION_KEY with more than 32 characters', () => {
    const env = { ...validEnv, ENCRYPTION_KEY: 'a'.repeat(64) }
    const result = envSchema.safeParse(env)
    expect(result.success).toBe(true)
  })

  it('throws error when ENCRYPTION_SALT is less than 16 characters', () => {
    const env = { ...validEnv, ENCRYPTION_SALT: 'short' }
    const result = envSchema.safeParse(env)
    expect(result.success).toBe(false)
  })

  it('throws error when ENCRYPTION_SALT is exactly 15 characters', () => {
    const env = { ...validEnv, ENCRYPTION_SALT: 'a'.repeat(15) }
    const result = envSchema.safeParse(env)
    expect(result.success).toBe(false)
  })

  it('accepts ENCRYPTION_SALT with exactly 16 characters', () => {
    const env = { ...validEnv, ENCRYPTION_SALT: 'a'.repeat(16) }
    const result = envSchema.safeParse(env)
    expect(result.success).toBe(true)
  })

  it('accepts ENCRYPTION_SALT with more than 16 characters', () => {
    const env = { ...validEnv, ENCRYPTION_SALT: 'a'.repeat(32) }
    const result = envSchema.safeParse(env)
    expect(result.success).toBe(true)
  })

  it('accepts valid NEXTAUTH_URL with https protocol', () => {
    const env = { ...validEnv, NEXTAUTH_URL: 'https://example.com' }
    const result = envSchema.safeParse(env)
    expect(result.success).toBe(true)
  })

  it('accepts valid NEXTAUTH_URL with port', () => {
    const env = { ...validEnv, NEXTAUTH_URL: 'http://localhost:3000' }
    const result = envSchema.safeParse(env)
    expect(result.success).toBe(true)
  })

  it('allows optional fields to be undefined', () => {
    const env: Record<string, unknown> = { ...validEnv }
    delete env.OPENAI_API_KEY
    delete env.QSTASH_URL
    delete env.QSTASH_TOKEN

    const result = envSchema.safeParse(env)
    expect(result.success).toBe(true)
  })

  it('allows optional STRIPE fields to be undefined', () => {
    const env: Record<string, unknown> = { ...validEnv }
    delete env.STRIPE_SECRET_KEY
    delete env.STRIPE_WEBHOOK_SECRET

    const result = envSchema.safeParse(env)
    expect(result.success).toBe(true)
  })

  it('allows optional RESEND fields to be undefined', () => {
    const env: Record<string, unknown> = { ...validEnv }
    delete env.RESEND_API_KEY
    delete env.RESEND_FROM_EMAIL

    const result = envSchema.safeParse(env)
    expect(result.success).toBe(true)
  })

  it('allows optional AWS fields to be undefined', () => {
    const env: Record<string, unknown> = { ...validEnv }
    delete env.AWS_ACCESS_KEY_ID
    delete env.AWS_SECRET_ACCESS_KEY
    delete env.AWS_REGION
    delete env.AWS_S3_BUCKET

    const result = envSchema.safeParse(env)
    expect(result.success).toBe(true)
  })

  it('accepts trailing slash in NEXTAUTH_URL', () => {
    const env = { ...validEnv, NEXTAUTH_URL: 'http://localhost:3000/' }
    const result = envSchema.safeParse(env)
    expect(result.success).toBe(true)
  })

  it('accepts localhost URLs without protocol (WHATWG URL standard)', () => {
    // Note: "localhost:3000" is actually a valid URL according to WHATWG URL standard
    // It's treated as a valid hostname, so we test that it passes
    const env = { ...validEnv, NEXTAUTH_URL: 'localhost:3000' }
    const result = envSchema.safeParse(env)
    expect(result.success).toBe(true)
  })

  it('provides proper error messages', () => {
    const env = { DATABASE_URL: '' }
    const result = envSchema.safeParse(env)

    expect(result.success).toBe(false)
    if (!result.success) {
      const errorMessages = result.error.issues.map((i) => i.message)
      expect(errorMessages.some((m) => m.includes('DATABASE_URL'))).toBe(true)
    }
  })
})
