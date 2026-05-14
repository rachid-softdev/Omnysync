import { NextResponse } from "next/server"

export function apiError(message: string, status: number = 400, code?: string) {
  return NextResponse.json({ error: message, code }, { status })
}

export function sanitizeError(error: unknown): string {
  // Don't expose internal error messages to clients
  if (error instanceof Error) {
    console.error("Internal error:", error.message, error.stack)
    return "An internal error occurred"
  }
  return "An error occurred"
}