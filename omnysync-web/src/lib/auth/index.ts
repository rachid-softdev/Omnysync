import NextAuth from 'next-auth'
import Google from 'next-auth/providers/google'
import Credentials from 'next-auth/providers/credentials'
import { PrismaAdapter } from '@auth/prisma-adapter'
import { prisma } from '@/lib/prisma'
import { sendWelcomeEmail } from '@/lib/email'
import { verifyPassword } from '@/lib/auth/password'
import { getTwoFactorStatus } from '@/lib/services/two-factor'

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: PrismaAdapter(prisma),
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
          // User doesn't exist or used OAuth (no password)
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
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  pages: {
    signIn: '/auth/signin',
    error: '/auth/error',
    verifyRequest: '/auth/2fa-verify',
  },
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      // Initial sign in
      if (user) {
        token.id = user.id

        // Check if user has 2FA enabled
        const twoFactor = await prisma.twoFactorAuth.findUnique({
          where: { userId: user.id },
        })

        token.has2FA = !!twoFactor
        token.twoFactorVerified = false
      }

      // Update session from callback
      if (trigger === 'update' && session) {
        token.twoFactorVerified = session.twoFactorVerified
      }

      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string

        // Add 2FA status to session
        session.user.has2FA = token.has2FA as boolean
        session.user.twoFactorVerified = token.twoFactorVerified as boolean
      }
      return session
    },
    async signIn({ user, account }) {
      if (!user?.id) return true

      if (account?.provider === 'credentials') {
        // Check if user has 2FA enabled
        const twoFactor = await prisma.twoFactorAuth.findUnique({
          where: { userId: user.id },
        })

        if (twoFactor) {
          // Store user ID in session for 2FA verification
          // Return special URL to trigger 2FA verification
          return '/auth/2fa-verify?continue=true'
        }
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
      has2FA?: boolean
      twoFactorVerified?: boolean
    }
  }
}
