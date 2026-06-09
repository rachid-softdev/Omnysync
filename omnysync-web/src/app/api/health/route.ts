import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const checks: Record<string, { status: string; message?: string; responseTime?: number }> = {}
  let allHealthy = true

  // Check 1: Database
  try {
    const dbStart = Date.now()
    await prisma.$queryRaw`SELECT 1`
    checks.database = {
      status: 'ok',
      responseTime: Date.now() - dbStart,
    }
  } catch {
    checks.database = {
      status: 'error',
      message: 'Database connection failed',
    }
    allHealthy = false
  }

  // Check 2: Environment variables
  // SECURITY: Return healthy/unhealthy only — do NOT leak which vars are missing
  const requiredEnvVars = ['DATABASE_URL', 'NEXTAUTH_SECRET', 'NEXTAUTH_URL', 'OPENAI_API_KEY']
  const missingEnvVars = requiredEnvVars.filter((v) => !process.env[v])

  if (missingEnvVars.length > 0) {
    checks.environment = { status: 'error' }
    allHealthy = false
  } else {
    checks.environment = { status: 'ok' }
  }

  // Check 3: QStash (if configured)
  if (process.env.QSTASH_URL && process.env.QSTASH_TOKEN) {
    checks.qstash = { status: 'ok' }
  } else {
    checks.qstash = { status: 'warning', message: 'External service not configured' }
  }

  // Check 4: Resend (if configured)
  if (process.env.RESEND_API_KEY) {
    checks.resend = { status: 'ok' }
  } else {
    checks.resend = { status: 'warning', message: 'External service not configured' }
  }

  // Check 5: Stripe (if configured)
  if (process.env.STRIPE_SECRET_KEY) {
    checks.stripe = { status: 'ok' }
  } else {
    checks.stripe = { status: 'warning', message: 'External service not configured' }
  }

  return NextResponse.json(
    {
      status: allHealthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '0.1.0',
      checks,
    },
    { status: allHealthy ? 200 : 503 }
  )
}
