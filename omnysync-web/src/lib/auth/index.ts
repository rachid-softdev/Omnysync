import NextAuth from 'next-auth'
import Google from 'next-auth/providers/google'
import Credentials from 'next-auth/providers/credentials'
import { PrismaAdapter } from '@auth/prisma-adapter'
import { prisma } from '@/lib/prisma'
import { withOAuthEncryption } from './adapter-encryption'
import { sendWelcomeEmail } from '@/lib/email'
import { verifyPassword } from '@/lib/auth/password'

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: withOAuthEncryption(PrismaAdapter(prisma) as unknown as Record<string, unknown>),
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    Credentials({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email as string },
        })

        if (!user || !user.password) {
          // 🔒 Constant-time: always run bcrypt compare to prevent email
          // enumeration via timing attack. The dummy hash will never match.
          await verifyPassword(credentials.password as string, '$2b$10$' + 'x'.repeat(53))
          return null
        }

        const isValid = await verifyPassword(credentials.password as string, user.password)

        if (!isValid) {
          return null
        }

        // Update last login
        await prisma.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() },
        })

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
        }
      },
    }),
  ],
  session: {
    strategy: 'jwt',
    maxAge: 7 * 24 * 60 * 60, // 7 days (was 30 days — S8 security fix)
  },
  pages: {
    signIn: '/auth/signin',
    error: '/auth/error',
    verifyRequest: '/auth/2fa-verify',
  },
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      // Initial sign in — single query for all data
      if (user) {
        const dbUser = await prisma.user.findUnique({
          where: { id: user.id },
          select: {
            role: true,
            passwordChangedAt: true,
            twoFactorAuth: { select: { id: true } },
          },
        })

        if (dbUser) {
          token.role = dbUser.role ?? 'USER'
          token.passwordChangedAt = dbUser.passwordChangedAt?.getTime() ?? 0
          token.has2FA = !!dbUser.twoFactorAuth
          // If user has 2FA enabled, force re-verification on sign-in
          token.twoFactorVerified = dbUser.twoFactorAuth ? false : true
        }
      }

      // On-access validation: single query for password change + account status
      // Without this, a compromised JWT remains valid after password change or session revocation.
      // DB session deletion (in resetPassword) has NO effect on JWT strategy tokens.
      if (trigger !== 'update') {
        const userStatus = await prisma.user.findUnique({
          where: { id: token.id as string },
          select: { passwordChangedAt: true, disabledAt: true, deletedAt: true },
        })

        if (userStatus) {
          // Password was changed after this JWT was issued → invalidate
          if (
            token.passwordChangedAt &&
            userStatus.passwordChangedAt?.getTime() > (token.passwordChangedAt as number)
          ) {
            return { ...token, exp: Math.floor(Date.now() / 1000) - 1 }
          }

          // Account was disabled/deleted after this JWT was issued → invalidate
          // Uses token.iat (seconds since epoch, set by NextAuth on JWT creation)
          if (token.iat) {
            const issuedAt = (token.iat as number) * 1000
            if (
              (userStatus.disabledAt && issuedAt < userStatus.disabledAt.getTime()) ||
              (userStatus.deletedAt && issuedAt < userStatus.deletedAt.getTime())
            ) {
              return { ...token, exp: Math.floor(Date.now() / 1000) - 1 }
            }
          }
        }
      }

      // Update session from 2FA verification
      if (trigger === 'update' && session) {
        if (session.twoFactorVerified === true) {
          token.twoFactorVerified = true
        }
      }

      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string

        // Add 2FA status to session
        session.user.has2FA = token.has2FA as boolean
        session.user.twoFactorVerified = token.twoFactorVerified as boolean
        session.user.role = (token.role as 'USER' | 'ADMIN') ?? 'USER'
      }
      return session
    },
    async signIn({ user, account }) {
      if (!user?.id) return true

      // 🔒 2FA check applies to ALL providers, not just credentials.
      // Previously only credentials provider was checked, allowing Google OAuth
      // users with 2FA enabled to bypass the second factor entirely.
      const twoFactor = await prisma.twoFactorAuth.findUnique({
        where: { userId: user.id },
      })

      if (twoFactor) {
        return '/auth/2fa-verify?continue=true'
      }

      // Auto-create a "Personal" organization on first sign-in for OAuth
      if (account?.provider === 'google') {
        const existingMembership = await prisma.userOrganization.findFirst({
          where: { userId: user.id },
        })

        if (!existingMembership) {
          await prisma.organization.create({
            data: {
              name: 'Personal',
              users: {
                create: {
                  userId: user.id,
                  role: 'OWNER',
                },
              },
            },
          })

          if (user.email) {
            sendWelcomeEmail(user.email, user.name || 'Utilisateur').catch((e) =>
              console.error('Welcome email failed:', e)
            )
          }
        }
      }

      // Update last login
      await prisma.user
        .update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() },
        })
        .catch(() => {})

      return true
    },
  },
})

// Extended types for session
declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      name?: string | null
      email?: string | null
      image?: string | null
      role: 'USER' | 'ADMIN'
      has2FA?: boolean
      twoFactorVerified?: boolean
    }
  }
}
