import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.redirect(new URL("/auth/signin", req.url))
  }

  const clientId = process.env.GOOGLE_CLIENT_ID!
  const redirectUri = `${process.env.NEXTAUTH_URL}/api/auth/connect/google/callback`
  const scope = encodeURIComponent("https://www.googleapis.com/auth/drive.readonly")
  const state = session.user.id // Pass user ID to verify in callback

  const url = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=${scope}&access_type=offline&prompt=consent&state=${state}`

  return NextResponse.redirect(url)
}
