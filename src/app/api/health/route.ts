import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

export async function GET(request: NextRequest) {
  // Optional: check if authenticated for detailed response
  const session = await auth()
  const isAuthenticated = !!session?.user

  const checks: Record<string, { status: string; message?: string; responseTime?: number }> = {}
  let allHealthy = true

  // Check 1: Database
  try {
    const dbStart = Date.now()
    await prisma.$queryRaw`SELECT 1`
    checks.database = {
      status: "ok",
      responseTime: Date.now() - dbStart,
    }
  } catch (error) {
    checks.database = {
      status: "error",
      message: "Database connection failed",
    }
    allHealthy = false
  }

  // Check 2: Environment variables (only show details if authenticated)
  const requiredEnvVars = [
    "DATABASE_URL",
    "NEXTAUTH_SECRET",
    "NEXTAUTH_URL",
  ]

  const missingEnvVars = requiredEnvVars.filter((v) => !process.env[v])

  if (missingEnvVars.length > 0) {
    checks.environment = {
      status: "error",
      message: `Missing required env vars: ${missingEnvVars.join(", ")}`,
    }
    allHealthy = false
  } else {
    checks.environment = { status: "ok" }
  }

  // Only include detailed internal info if authenticated
  if (isAuthenticated) {
    // Check OpenAI
    if (process.env.OPENAI_API_KEY) {
      checks.openai = { status: "ok" }
    } else {
      checks.openai = { status: "warning", message: "OpenAI not configured" }
    }

    // Check QStash
    if (process.env.QSTASH_URL && process.env.QSTASH_TOKEN) {
      checks.qstash = { status: "ok" }
    } else {
      checks.qstash = { status: "warning", message: "QStash not configured" }
    }

    // Check Resend
    if (process.env.RESEND_API_KEY) {
      checks.resend = { status: "ok" }
    } else {
      checks.resend = { status: "warning", message: "Resend not configured" }
    }

    // Check Stripe
    if (process.env.STRIPE_SECRET_KEY) {
      checks.stripe = { status: "ok" }
    } else {
      checks.stripe = { status: "warning", message: "Stripe not configured" }
    }
  }

  // Basic response for unauthenticated requests - only expose minimal info
  if (!isAuthenticated) {
    return NextResponse.json(
      {
        status: allHealthy ? "healthy" : "unhealthy",
        timestamp: new Date().toISOString(),
      },
      { status: allHealthy ? 200 : 503 }
    )
  }

  return NextResponse.json(
    {
      status: allHealthy ? "healthy" : "unhealthy",
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || "0.1.0",
      checks,
    },
    { status: allHealthy ? 200 : 503 }
  )
}