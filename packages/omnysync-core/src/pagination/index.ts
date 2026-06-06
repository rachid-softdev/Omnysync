/**
 * Utilitaires de pagination
 * Omnysync - 2026
 */
import { z } from "zod";

// ============================================================================
// TYPES
// ============================================================================

export interface PaginationParams {
  page?: number;
  limit?: number;
  cursor?: string;
}

export interface CursorPaginationParams {
  cursor?: string;
  limit?: number;
}

export interface PaginationResult<T> {
  data: T[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNext: boolean;
    nextCursor?: string;
    hasPrevious: boolean;
    previousCursor?: string;
  };
}

export interface CursorPaginationResult<T> {
  data: T[];
  nextCursor?: string;
  hasMore: boolean;
}

// ============================================================================
// ZOD SCHEMAS
// ============================================================================

export const paginationSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
});

export const cursorPaginationSchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).default(20),
});

// ============================================================================
// FONCTIONS
// ============================================================================

/**
 * Pagination standard (page-based)
 */
export async function paginate<T>(
  query: {
    skip: number;
    take: number;
    orderBy?: Record<string, "asc" | "desc">;
    where?: Record<string, unknown>;
  },
  countQuery: Record<string, unknown>,
): Promise<PaginationResult<T>> {
  const { prisma } = await import("../prisma");

  const [data, total] = await Promise.all([
    prisma.$queryRaw<
      T[]
    >`SELECT * FROM Document WHERE organizationId = ${query.where?.organizationId} OFFSET ${query.skip} LIMIT ${query.take}`,
    prisma.document.count({ where: query.where as never }),
  ]);

  const page = Math.floor(query.skip / query.take) + 1;
  const totalPages = Math.ceil(total / query.take);

  return {
    data,
    pagination: {
      total,
      page,
      limit: query.take,
      totalPages,
      hasNext: page < totalPages,
      nextCursor: page < totalPages ? String(page + 1) : undefined,
      hasPrevious: page > 1,
      previousCursor: page > 1 ? String(page - 1) : undefined,
    },
  };
}

/**
 * Pagination cursor-based (plus performant pour grandes数据集)
 */
export async function cursorPaginate<T>(
  getItems: (
    limit: number,
    cursor?: string,
  ) => Promise<{ items: T[]; nextCursor?: string }>,
  limit: number = 20,
  cursor?: string,
): Promise<CursorPaginationResult<T>> {
  const result = await getItems(limit + 1, cursor); // Get one extra to check if there's more

  const hasMore = result.items.length > limit;
  const data = hasMore ? result.items.slice(0, -1) : result.items;

  return {
    data,
    nextCursor: hasMore ? result.nextCursor : undefined,
    hasMore,
  };
}

/**
 * Helper pour créer les paramètres de query Prisma
 */
export function createPaginationParams(
  params: PaginationParams,
  defaultLimit: number = 20,
): { skip: number; take: number } {
  const page = params.page || 1;
  const limit = Math.min(params.limit || defaultLimit, 100);

  return {
    skip: (page - 1) * limit,
    take: limit,
  };
}

/**
 * Helper pour créer les paramètres de query pour curseur
 */
export function createCursorParams(
  params: CursorPaginationParams,
  defaultLimit: number = 20,
): { take: number; cursorValue?: Date | string } {
  return {
    take: Math.min(params.limit || defaultLimit, 100),
    cursorValue: params.cursor,
  };
}

// ============================================================================
// RESPONSES
// ============================================================================

/**
 * Formate la réponse de pagination pour une route API
 */
export function paginatedResponse<T>(
  data: T[],
  pagination: PaginationResult<T>["pagination"],
) {
  return {
    data,
    pagination: {
      total: pagination.total,
      page: pagination.page,
      limit: pagination.limit,
      totalPages: pagination.totalPages,
      _links: {
        next: pagination.hasNext ? { page: pagination.page + 1 } : null,
        previous: pagination.hasPrevious ? { page: pagination.page - 1 } : null,
      },
    },
  };
}

/**
 * Formate la réponse cursor-based pour une route API
 */
export function cursorResponse<T>(
  data: T[],
  nextCursor?: string,
  hasMore?: boolean,
) {
  return {
    data,
    nextCursor,
    hasMore,
  };
}

// ============================================================================
// EXAMPLES
// ============================================================================

/**
 * Exemple d'utilisation dans une route API
 *
 * // Dans la route:
 * const { page, limit } = paginationSchema.parse(
 *   Object.fromEntries(new URL(request.url).searchParams)
 * )
 *
 * const { skip, take } = createPaginationParams({ page, limit })
 *
 * const [documents, total] = await Promise.all([
 *   prisma.document.findMany({
 *     where: { organizationId },
 *     skip,
 *     take,
 *     orderBy: { createdAt: 'desc' },
 *   }),
 *   prisma.document.count({ where: { organizationId } }),
 * ])
 *
 * return Response.json(paginatedResponse(documents, {
 *   total,
 *   page,
 *   limit,
 *   totalPages: Math.ceil(total / limit),
 *   hasNext: skip + take < total,
 * }))
 */
