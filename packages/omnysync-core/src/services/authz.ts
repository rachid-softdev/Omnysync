import { prisma } from "../prisma";

export class UnauthorizedError extends Error {
  status: number;
  constructor(message = "Unauthorized") {
    super(message);
    this.status = 403;
  }
}

/**
 * Vérifie que l'utilisateur a accès au document via son organisation
 * Lève UnauthorizedError si l'accès est refusé
 */
export async function requireDocumentAccess(
  documentId: string,
  userId: string,
): Promise<void> {
  const document = await prisma.document.findUnique({
    where: { id: documentId },
    select: { organizationId: true },
  });

  if (!document) {
    throw new UnauthorizedError("Access denied");
  }

  const membership = await prisma.userOrganization.findFirst({
    where: {
      userId,
      organizationId: document.organizationId,
    },
  });

  if (!membership) {
    throw new UnauthorizedError("Access denied");
  }
}
