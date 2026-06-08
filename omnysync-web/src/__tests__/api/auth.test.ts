import { describe, it, expect, beforeAll } from 'vitest'
import { NextRequest } from 'next/server'
import type { PrismaClient } from '@prisma/client'

const isIntegration = !!process.env.TEST_DATABASE_URL

describe.skipIf(!isIntegration)('POST /api/auth/register', () => {
  beforeAll(async () => {
    // Clean the test database before running register tests
    // This ensures a known state for the duplicate-email test
    const { PrismaClient } = await import('@prisma/client')
    const prisma: PrismaClient = new PrismaClient()
    const { cleanDatabase } = await import('../helpers/db-helper')
    await cleanDatabase(prisma)
    await prisma.$disconnect()
  })

  it('should register a new user', async () => {
    const { POST } = await import('@/app/api/auth/register/route')
    const request = new NextRequest('http://localhost:3000/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'new@test.com',
        password: 'StrongP@ss1',
        name: 'New User',
      }),
    })
    const response = await POST(request)
    const data = await response.json()
    expect(response.status).toBe(201)
    expect(data.user).toBeDefined()
    expect(data.user.email).toBe('new@test.com')
  })

  it('should reject duplicate email', async () => {
    const { POST } = await import('@/app/api/auth/register/route')

    // First registration
    const first = await POST(
      new NextRequest('http://localhost:3000/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'dup@test.com',
          password: 'StrongP@ss1',
          name: 'Dup',
        }),
      })
    )
    expect(first.status).toBe(201)

    // Duplicate — route returns 400 for existing email
    const second = await POST(
      new NextRequest('http://localhost:3000/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'dup@test.com',
          password: 'StrongP@ss1',
          name: 'Dup',
        }),
      })
    )
    expect(second.status).toBe(400)
  })
})

describe.skipIf(!isIntegration)('POST /api/auth/forgot-password', () => {
  it('should return success (prevents email enumeration)', async () => {
    const { POST } = await import('@/app/api/auth/forgot-password/route')
    const request = new NextRequest('http://localhost:3000/api/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'nonexistent@test.com' }),
    })
    const response = await POST(request)
    const data = await response.json()
    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
  })

  it('should return success for valid email', async () => {
    const { POST } = await import('@/app/api/auth/forgot-password/route')
    const request = new NextRequest('http://localhost:3000/api/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@omnysync.com' }),
    })
    const response = await POST(request)
    const data = await response.json()
    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
  })
})

describe.skipIf(!isIntegration)('POST /api/auth/reset-password', () => {
  it('should reject invalid token', async () => {
    const { POST } = await import('@/app/api/auth/reset-password/route')
    const request = new NextRequest('http://localhost:3000/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: 'invalid-token', password: 'NewP@ssword1' }),
    })
    const response = await POST(request)
    const data = await response.json()
    expect(response.status).toBe(400)
    expect(data.error).toBeDefined()
  })
})
