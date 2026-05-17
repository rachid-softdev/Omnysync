/**
 * Route API: Gestion des clés API utilisateur
 * GET /api/api-keys - Liste les clés
 * POST /api/api-keys - Crée une clé
 */
import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { randomBytes, createHash } from "crypto"
import { z } from "zod"

const createApiKeySchema = z.object({
  name: z.string().min(1, "Nom requis").max(100),
  expiresInDays: z.number().optional(),
})

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 })
    }

    const membership = await prisma.userOrganization.findFirst({
      where: { userId: session.user.id },
      select: { organizationId: true },
    })

    if (!membership) {
      return NextResponse.json({ error: "Organisation non trouvée" }, { status: 404 })
    }

    const apiKeys = await prisma.apiKey.findMany({
      where: {
        userId: session.user.id,
        organizationId: membership.organizationId,
      },
      select: {
        id: true,
        name: true,
        prefix: true,
        lastUsedAt: true,
        expiresAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json({ apiKeys })
  } catch (error) {
    console.error("GET api-keys error:", error)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 })
    }

    const body = await request.json()
    const { name, expiresInDays } = createApiKeySchema.parse(body)

    const membership = await prisma.userOrganization.findFirst({
      where: { userId: session.user.id },
      select: { organizationId: true },
    })

    if (!membership) {
      return NextResponse.json({ error: "Organisation non trouvée" }, { status: 404 })
    }

    // Générer une clé API
    const rawKey = randomBytes(32).toString("hex")
    const keyHash = createHash("sha256").update(rawKey).digest("hex")
    const prefix = rawKey.substring(0, 8)

    // Calculer la date d'expiration si spécifiée
    const expiresAt = expiresInDays
      ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
      : null

    const apiKey = await prisma.apiKey.create({
      data: {
        userId: session.user.id,
        organizationId: membership.organizationId,
        name,
        keyHash,
        prefix,
        expiresAt,
      },
      select: {
        id: true,
        name: true,
        prefix: true,
        expiresAt: true,
        createdAt: true,
      },
    })

    // Retourner la clé complète (une seule fois!)
    return NextResponse.json({
      apiKey,
      rawKey, // À afficher une seule fois à l'utilisateur
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 })
    }
    console.error("POST api-keys error:", error)
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 })
  }
}