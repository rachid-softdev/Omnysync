import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  prisma: { $queryRaw: vi.fn() },
}))

import { GET } from '../route'

describe('GET /api/health', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('returns 200 healthy when database is up and env vars are set', async () => {
    const { prisma } = await import('@/lib/prisma')
    vi.mocked(prisma.$queryRaw).mockResolvedValue([{ 1: 1 }])

    vi.stubEnv('DATABASE_URL', 'postgresql://localhost/db')
    vi.stubEnv('NEXTAUTH_SECRET', 'secret')
    vi.stubEnv('NEXTAUTH_URL', 'http://localhost:3000')
    vi.stubEnv('OPENAI_API_KEY', 'sk-test')
    vi.stubEnv('npm_package_version', '1.0.0')

    const response = await GET()
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.status).toBe('healthy')
    expect(data.checks.database.status).toBe('ok')
    expect(data.checks.environment.status).toBe('ok')
    expect(data.version).toBe('1.0.0')
    expect(data.timestamp).toBeDefined()
  })

  it('returns 503 unhealthy when database fails', async () => {
    const { prisma } = await import('@/lib/prisma')
    vi.mocked(prisma.$queryRaw).mockRejectedValue(new Error('DB down'))

    vi.stubEnv('DATABASE_URL', 'postgresql://localhost/db')
    vi.stubEnv('NEXTAUTH_SECRET', 'secret')
    vi.stubEnv('NEXTAUTH_URL', 'http://localhost:3000')
    vi.stubEnv('OPENAI_API_KEY', 'sk-test')

    const response = await GET()
    const data = await response.json()

    expect(response.status).toBe(503)
    expect(data.status).toBe('unhealthy')
    expect(data.checks.database.status).toBe('error')
    expect(data.checks.database.message).toBe('Database connection failed')
  })

  it('returns 503 unhealthy when env vars are missing', async () => {
    const { prisma } = await import('@/lib/prisma')
    vi.mocked(prisma.$queryRaw).mockResolvedValue([{ 1: 1 }])

    vi.stubEnv('DATABASE_URL', 'postgresql://localhost/db')
    vi.stubEnv('NEXTAUTH_SECRET', '')
    vi.stubEnv('NEXTAUTH_URL', 'http://localhost:3000')
    vi.stubEnv('OPENAI_API_KEY', 'sk-test')

    const response = await GET()
    const data = await response.json()

    expect(response.status).toBe(503)
    expect(data.status).toBe('unhealthy')
    expect(data.checks.environment.status).toBe('error')
  })

  it('reports warning for unconfigured external services', async () => {
    const { prisma } = await import('@/lib/prisma')
    vi.mocked(prisma.$queryRaw).mockResolvedValue([{ 1: 1 }])

    vi.stubEnv('DATABASE_URL', 'postgresql://localhost/db')
    vi.stubEnv('NEXTAUTH_SECRET', 'secret')
    vi.stubEnv('NEXTAUTH_URL', 'http://localhost:3000')
    vi.stubEnv('OPENAI_API_KEY', 'sk-test')
    // QSTASH, RESEND, STRIPE not set

    const response = await GET()
    const data = await response.json()

    expect(response.status).toBe(200) // still healthy since only optional services missing
    expect(data.checks.qstash.status).toBe('warning')
    expect(data.checks.resend.status).toBe('warning')
    expect(data.checks.stripe.status).toBe('warning')
  })

  it('reports ok for configured external services', async () => {
    const { prisma } = await import('@/lib/prisma')
    vi.mocked(prisma.$queryRaw).mockResolvedValue([{ 1: 1 }])

    vi.stubEnv('DATABASE_URL', 'postgresql://localhost/db')
    vi.stubEnv('NEXTAUTH_SECRET', 'secret')
    vi.stubEnv('NEXTAUTH_URL', 'http://localhost:3000')
    vi.stubEnv('OPENAI_API_KEY', 'sk-test')
    vi.stubEnv('QSTASH_URL', 'https://qstash.example.com')
    vi.stubEnv('QSTASH_TOKEN', 'qstash-token')
    vi.stubEnv('RESEND_API_KEY', 'resend-key')
    vi.stubEnv('STRIPE_SECRET_KEY', 'stripe-key')

    const response = await GET()
    const data = await response.json()

    expect(data.checks.qstash.status).toBe('ok')
    expect(data.checks.resend.status).toBe('ok')
    expect(data.checks.stripe.status).toBe('ok')
  })
})
