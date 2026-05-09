import NextAuth from "next-auth"
import Google from "next-auth/providers/google"
import { PrismaAdapter } from "@auth/prisma-adapter"
import { prisma } from "@/lib/prisma"
import { sendWelcomeEmail } from "@/lib/email"

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    async session({ session, user }) {
      if (session.user) {
        session.user.id = user.id
      }
      return session
    },
    async signIn({ user }) {
      if (!user.id) return true

      // Auto-create a "Personal" organization on first sign-in
      const existingMembership = await prisma.userOrganization.findFirst({
        where: { userId: user.id },
      })

      if (!existingMembership) {
        await prisma.organization.create({
          data: {
            name: "Personal",
            users: {
              create: {
                userId: user.id,
                role: "OWNER",
              },
            },
          },
        })

        // Send welcome email asynchronously (don't block sign-in)
        if (user.email) {
          sendWelcomeEmail(user.email, user.name || "Utilisateur").catch((e) =>
            console.error("Welcome email failed:", e)
          )
        }
      }

      return true
    },
  },
  pages: {
    signIn: "/auth/signin",
  },
})
