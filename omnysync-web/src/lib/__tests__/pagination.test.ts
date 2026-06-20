/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockPrisma = vi.hoisted(() => ({
  $queryRaw: vi.fn(),
  document: { count: vi.fn() },
}))

vi.mock('@/lib/prisma', () => ({ prisma: mockPrisma }))

import {
  paginationSchema,
  cursorPaginationSchema,
  paginate,
  cursorPaginate,
  createPaginationParams,
  createCursorParams,
  paginatedResponse,
  cursorResponse,
} from '../pagination'

describe('paginationSchema', () => {
  it('returns defaults for empty input', () => {
    const result = paginationSchema.safeParse({})
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.page).toBe(1)
      expect(result.data.limit).toBe(20)
    }
  })

  it('coerces string page to number', () => {
    const result = paginationSchema.safeParse({ page: '3' })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.page).toBe(3)
  })

  it('rejects page 0', () => {
    expect(paginationSchema.safeParse({ page: 0 }).success).toBe(false)
  })

  it('rejects negative page', () => {
    expect(paginationSchema.safeParse({ page: -1 }).success).toBe(false)
  })

  it('rejects page as NaN string', () => {
    expect(paginationSchema.safeParse({ page: 'abc' }).success).toBe(false)
  })

  it('rejects limit of 0', () => {
    expect(paginationSchema.safeParse({ limit: 0 }).success).toBe(false)
  })

  it('rejects negative limit', () => {
    expect(paginationSchema.safeParse({ limit: -5 }).success).toBe(false)
  })

  it('rejects limit exceeding 100', () => {
    expect(paginationSchema.safeParse({ limit: 101 }).success).toBe(false)
  })

  it('accepts limit of 100 (max)', () => {
    expect(paginationSchema.safeParse({ limit: 100 }).success).toBe(true)
  })

  it('coerces string limit to number', () => {
    const result = paginationSchema.safeParse({ limit: '50' })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.limit).toBe(50)
  })
})

describe('cursorPaginationSchema', () => {
  it('returns defaults for empty input', () => {
    const result = cursorPaginationSchema.safeParse({})
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.cursor).toBeUndefined()
      expect(result.data.limit).toBe(20)
    }
  })

  it('accepts cursor value', () => {
    const result = cursorPaginationSchema.safeParse({ cursor: 'abc123', limit: 10 })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.cursor).toBe('abc123')
      expect(result.data.limit).toBe(10)
    }
  })

  it('rejects limit of 0', () => {
    expect(cursorPaginationSchema.safeParse({ limit: 0 }).success).toBe(false)
  })

  it('rejects limit exceeding 100', () => {
    expect(cursorPaginationSchema.safeParse({ limit: 200 }).success).toBe(false)
  })
})

describe('paginate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns paginated results for page 1', async () => {
    const mockData = [{ id: 'doc-1' }, { id: 'doc-2' }]
    mockPrisma.$queryRaw.mockResolvedValue(mockData)
    mockPrisma.document.count.mockResolvedValue(10)

    const result = await paginate<any>({ skip: 0, take: 20, where: { organizationId: 'org-1' } })

    expect(result.data).toEqual(mockData)
    expect(result.pagination).toEqual({
      total: 10,
      page: 1,
      limit: 20,
      totalPages: 1,
      hasNext: false,
      nextCursor: undefined,
      hasPrevious: false,
      previousCursor: undefined,
    })
  })

  it('handles pagination with multiple pages', async () => {
    const mockData = Array.from({ length: 20 }, (_, i) => ({ id: `doc-${i}` }))
    mockPrisma.$queryRaw.mockResolvedValue(mockData)
    mockPrisma.document.count.mockResolvedValue(50)

    const result = await paginate<any>({ skip: 0, take: 20, where: { organizationId: 'org-1' } })

    expect(result.pagination.totalPages).toBe(3)
    expect(result.pagination.hasNext).toBe(true)
    expect(result.pagination.nextCursor).toBe('2')
    expect(result.pagination.hasPrevious).toBe(false)
  })

  it('shows hasPrevious true and previousCursor for page > 1', async () => {
    const mockData = Array.from({ length: 20 }, (_, i) => ({ id: `doc-${i}` }))
    mockPrisma.$queryRaw.mockResolvedValue(mockData)
    mockPrisma.document.count.mockResolvedValue(50)

    const result = await paginate<any>({ skip: 20, take: 20, where: { organizationId: 'org-1' } })

    expect(result.pagination.page).toBe(2)
    expect(result.pagination.hasPrevious).toBe(true)
    expect(result.pagination.previousCursor).toBe('1')
    expect(result.pagination.hasNext).toBe(true)
    expect(result.pagination.nextCursor).toBe('3')
  })

  it('handles last page correctly', async () => {
    const mockData = Array.from({ length: 10 }, (_, i) => ({ id: `doc-${i + 40}` }))
    mockPrisma.$queryRaw.mockResolvedValue(mockData)
    mockPrisma.document.count.mockResolvedValue(50)

    const result = await paginate<any>({ skip: 40, take: 20, where: { organizationId: 'org-1' } })

    expect(result.pagination.page).toBe(3)
    expect(result.pagination.hasNext).toBe(false)
    expect(result.pagination.nextCursor).toBeUndefined()
    expect(result.pagination.hasPrevious).toBe(true)
  })

  it('handles empty results', async () => {
    mockPrisma.$queryRaw.mockResolvedValue([])
    mockPrisma.document.count.mockResolvedValue(0)

    const result = await paginate<any>({ skip: 0, take: 20, where: { organizationId: 'org-1' } })

    expect(result.data).toEqual([])
    expect(result.pagination.total).toBe(0)
    expect(result.pagination.totalPages).toBe(0)
    expect(result.pagination.hasNext).toBe(false)
  })
})

describe('cursorPaginate', () => {
  it('returns items and indicates more results when there are more', async () => {
    const items = Array.from({ length: 21 }, (_, i) => ({ id: `item-${i}` }))
    const getItems = vi.fn().mockResolvedValue({ items, nextCursor: 'cursor-21' })

    const result = await cursorPaginate(getItems, 20)

    expect(result.data).toHaveLength(20)
    expect(result.nextCursor).toBe('cursor-21')
    expect(result.hasMore).toBe(true)
    expect(getItems).toHaveBeenCalledWith(21, undefined)
  })

  it('returns all items when less than limit', async () => {
    const items = Array.from({ length: 5 }, (_, i) => ({ id: `item-${i}` }))
    const getItems = vi.fn().mockResolvedValue({ items })

    const result = await cursorPaginate(getItems, 20, 'cursor-5')

    expect(result.data).toHaveLength(5)
    expect(result.nextCursor).toBeUndefined()
    expect(result.hasMore).toBe(false)
    expect(getItems).toHaveBeenCalledWith(21, 'cursor-5')
  })

  it('returns exactly limit items when no more', async () => {
    const items = Array.from({ length: 20 }, (_, i) => ({ id: `item-${i}` }))
    const getItems = vi.fn().mockResolvedValue({ items })

    const result = await cursorPaginate(getItems, 20)

    expect(result.data).toHaveLength(20)
    expect(result.nextCursor).toBeUndefined()
    expect(result.hasMore).toBe(false)
  })

  it('handles empty result set', async () => {
    const getItems = vi.fn().mockResolvedValue({ items: [] })

    const result = await cursorPaginate(getItems, 20)

    expect(result.data).toEqual([])
    expect(result.nextCursor).toBeUndefined()
    expect(result.hasMore).toBe(false)
  })
})

describe('createPaginationParams', () => {
  it('creates params for page 1', () => {
    const params = createPaginationParams({ page: 1, limit: 20 })
    expect(params).toEqual({ skip: 0, take: 20 })
  })

  it('creates params for page 3', () => {
    const params = createPaginationParams({ page: 3, limit: 10 })
    expect(params).toEqual({ skip: 20, take: 10 })
  })

  it('uses defaults when no params provided', () => {
    const params = createPaginationParams({})
    expect(params).toEqual({ skip: 0, take: 20 })
  })

  it('caps limit at 100', () => {
    const params = createPaginationParams({ page: 1, limit: 500 })
    expect(params.take).toBe(100)
  })

  it('uses default limit when NaN', () => {
    const params = createPaginationParams({ page: 1, limit: NaN })
    expect(params.take).toBe(20)
  })

  it('uses custom default limit', () => {
    const params = createPaginationParams({ page: 1 }, 50)
    expect(params.take).toBe(50)
  })

  it('handles page 0 gracefully (uses 1 because 0 is falsy)', () => {
    const params = createPaginationParams({ page: 0, limit: 20 })
    // page 0 is falsy, so params.page || 1 → 1, skip = 0
    expect(params.skip).toBe(0)
    expect(params.take).toBe(20)
  })
})

describe('createCursorParams', () => {
  it('creates params with cursor', () => {
    const params = createCursorParams({ cursor: 'cursor-abc', limit: 10 })
    expect(params).toEqual({ take: 10, cursorValue: 'cursor-abc' })
  })

  it('creates params without cursor', () => {
    const params = createCursorParams({ limit: 20 })
    expect(params).toEqual({ take: 20, cursorValue: undefined })
  })

  it('caps limit at 100', () => {
    const params = createCursorParams({ limit: 200 })
    expect(params.take).toBe(100)
  })

  it('uses default limit', () => {
    const params = createCursorParams({})
    expect(params.take).toBe(20)
  })
})

describe('paginatedResponse', () => {
  it('formats response with _links', () => {
    const pagination = {
      total: 50,
      page: 2,
      limit: 20,
      totalPages: 3,
      hasNext: true,
      hasPrevious: true,
    }
    const data = [{ id: 'doc-1' }]

    const result = paginatedResponse(data, pagination as any)

    expect(result).toEqual({
      data,
      pagination: {
        total: 50,
        page: 2,
        limit: 20,
        totalPages: 3,
        _links: {
          next: { page: 3 },
          previous: { page: 1 },
        },
      },
    })
  })

  it('sets _links to null when no next/previous', () => {
    const pagination = {
      total: 5,
      page: 1,
      limit: 20,
      totalPages: 1,
      hasNext: false,
      hasPrevious: false,
    }

    const result = paginatedResponse([], pagination as any)

    expect(result.pagination._links.next).toBeNull()
    expect(result.pagination._links.previous).toBeNull()
  })

  it('handles edge case: page > totalPages', () => {
    const pagination = {
      total: 5,
      page: 10,
      limit: 20,
      totalPages: 1,
      hasNext: false,
      hasPrevious: true,
    }

    const result = paginatedResponse([], pagination as any)

    expect(result.pagination._links.previous).toEqual({ page: 9 })
    expect(result.pagination._links.next).toBeNull()
  })
})

describe('cursorResponse', () => {
  it('formats response with cursor', () => {
    const result = cursorResponse([{ id: 'item-1' }], 'next-cursor', true)

    expect(result).toEqual({
      data: [{ id: 'item-1' }],
      nextCursor: 'next-cursor',
      hasMore: true,
    })
  })

  it('formats response without cursor', () => {
    const result = cursorResponse([], undefined, false)

    expect(result).toEqual({
      data: [],
      nextCursor: undefined,
      hasMore: false,
    })
  })
})
