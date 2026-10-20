import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { hashPassword } from '@/lib/auth/password'
import { ensureUserOrg } from '@/lib/auth/org'
import { signIn } from '@/lib/auth'

/**
 * DEV-ONLY endpoint to obtain a real authenticated session cookie.
 *
 * Never active in production (guarded by NODE_ENV). Upserts a known dev user
 * and signs them in via the app's own Credentials provider, producing a valid
 * NextAuth session cookie that can be reused by E2E / Playwright flows.
 *
 * Usage (dev):  POST /api/dev/login  ->  capture the `Set-Cookie` response header.
 */
const DEV_EMAIL = 'dev@local.dev'
const DEV_PASSWORD = 'dev-password-123'

export async function POST() {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not available in production' }, { status: 404 })
  }

  const passwordHash = await hashPassword(DEV_PASSWORD)

  const devUser = await prisma.user.upsert({
    where: { email: DEV_EMAIL },
    update: { password: passwordHash, role: 'ADMIN', disabledAt: null, deletedAt: null },
    create: {
      email: DEV_EMAIL,
      name: 'Dev User',
      password: passwordHash,
      role: 'ADMIN',
    },
  })

  // The dev user must own an organization: every org-scoped API resolves the
  // caller's organization through a membership, and a user without one is
  // rejected (401) by all of them - which would defeat the purpose of this
  // endpoint for E2E flows.
  await ensureUserOrg(devUser.id)

  // next-auth v5 server signature: signIn(provider, credentials, authorizationParams).
  // The credentials object (not the FormData react variant) is required here;
  // `redirect: false` makes the call return the redirect URL instead of redirecting,
  // while the session cookie is still set on the response via cookies().
  const result = await signIn('credentials', {
    email: DEV_EMAIL,
    password: DEV_PASSWORD,
    redirect: false,
  })

  // A rejected sign-in comes back as the error redirect URL (or an error object)
  // rather than a session cookie.
  const failed =
    typeof result === 'string'
      ? /[?&]error=/.test(result)
      : Boolean(result && typeof result === 'object' && result.error)

  if (failed) {
    return NextResponse.json({ error: 'Dev sign-in failed' }, { status: 401 })
  }

  return NextResponse.json({ ok: true, email: DEV_EMAIL })
}
