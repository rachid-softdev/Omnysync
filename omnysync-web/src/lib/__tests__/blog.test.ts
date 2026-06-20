import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mocks (vi.hoisted ensures initialization before hoisted vi.mock) ─────────

const mockReadFileSync = vi.hoisted(() => vi.fn())

// Mock fs — blog.ts uses `import fs from 'fs'` so we need `default` export
vi.mock('fs', () => ({
  default: {
    readFileSync: mockReadFileSync,
    existsSync: vi.fn(),
    statSync: vi.fn(),
    writeFileSync: vi.fn(),
    readdirSync: vi.fn(),
    mkdirSync: vi.fn(),
    lstatSync: vi.fn(),
    promises: {},
  },
  readFileSync: mockReadFileSync,
  existsSync: vi.fn(),
  statSync: vi.fn(),
  writeFileSync: vi.fn(),
  readdirSync: vi.fn(),
  mkdirSync: vi.fn(),
  lstatSync: vi.fn(),
  promises: {},
}))

// ── Mock data (defined after mocks to avoid hoisting issues) ─────────────────

const createArticle = (
  overrides: Partial<import('../blog').BlogArticle> = {}
): import('../blog').BlogArticle => ({
  slug: 'test-article',
  locale: 'en',
  title: 'Test Article',
  excerpt: 'Test excerpt',
  content: '<p>Test content</p>',
  tags: ['test'],
  publishedAt: '2026-01-01',
  ...overrides,
})

const mockArticles = [
  createArticle({
    slug: 'first-article',
    title: 'First Article',
    publishedAt: '2026-06-01',
    tags: ['tag1', 'tag2'],
  }),
  createArticle({
    slug: 'second-article',
    title: 'Second Article',
    locale: 'fr',
    publishedAt: '2026-05-15',
    tags: ['tag2'],
  }),
  createArticle({
    slug: 'third-article',
    title: 'Third Article',
    publishedAt: '2026-05-01',
    tags: ['tag1', 'tag3'],
  }),
]

const mockBlogData = { articles: mockArticles }

// ── Imports ──────────────────────────────────────────────────────────────────

import {
  getBlogData,
  getAllArticles,
  getArticlesByLocale,
  getArticleBySlug,
  getAllTags,
} from '../blog'

// ── Suite ────────────────────────────────────────────────────────────────────

describe('blog data access', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockReadFileSync.mockReturnValue(JSON.stringify(mockBlogData))
  })

  describe('getBlogData', () => {
    it('parses blog.json and returns all data', () => {
      const data = getBlogData()
      expect(data.articles).toHaveLength(3)
      expect(data.articles[0].slug).toBe('first-article')
    })

    it('reads the file from the correct path', () => {
      getBlogData()
      expect(mockReadFileSync).toHaveBeenCalledTimes(1)
      const [filePath, encoding] = mockReadFileSync.mock.calls[0]
      expect(filePath).toContain('data')
      expect(filePath).toContain('blog.json')
      expect(encoding).toBe('utf-8')
    })

    it('throws when file does not exist', () => {
      mockReadFileSync.mockImplementation(() => {
        throw new Error('ENOENT: no such file or directory')
      })
      expect(() => getBlogData()).toThrow()
    })

    it('throws when JSON is malformed', () => {
      mockReadFileSync.mockReturnValue('{ invalid json }')
      expect(() => getBlogData()).toThrow()
    })
  })

  describe('getAllArticles', () => {
    it('returns articles sorted by publishedAt descending', () => {
      const articles = getAllArticles()
      expect(articles).toHaveLength(3)
      expect(articles[0].slug).toBe('first-article') // 2026-06-01
      expect(articles[1].slug).toBe('second-article') // 2026-05-15
      expect(articles[2].slug).toBe('third-article') // 2026-05-01
    })

    it('returns empty array when no articles exist', () => {
      mockReadFileSync.mockReturnValue(JSON.stringify({ articles: [] }))
      const articles = getAllArticles()
      expect(articles).toEqual([])
    })

    it('delegates to getBlogData', () => {
      // spy on getBlogData by checking that readFileSync was called
      getAllArticles()
      expect(mockReadFileSync).toHaveBeenCalledTimes(1)
    })
  })

  describe('getArticlesByLocale', () => {
    it('returns only English articles', () => {
      const articles = getArticlesByLocale('en')
      expect(articles).toHaveLength(2)
      expect(articles.every((a) => a.locale === 'en')).toBe(true)
    })

    it('returns only French articles', () => {
      const articles = getArticlesByLocale('fr')
      expect(articles).toHaveLength(1)
      expect(articles.every((a) => a.locale === 'fr')).toBe(true)
    })

    it('returns empty array when no articles match locale', () => {
      // Make data with no French articles
      mockReadFileSync.mockReturnValue(
        JSON.stringify({
          articles: [createArticle({ locale: 'en' })],
        })
      )
      const articles = getArticlesByLocale('fr')
      expect(articles).toEqual([])
    })
  })

  describe('getArticleBySlug', () => {
    it('returns the matching article', () => {
      const article = getArticleBySlug('second-article')
      expect(article).toBeDefined()
      expect(article!.title).toBe('Second Article')
    })

    it('returns undefined when slug does not exist', () => {
      const article = getArticleBySlug('non-existent-slug')
      expect(article).toBeUndefined()
    })

    it('matches partial slugs correctly', () => {
      const article = getArticleBySlug('first')
      expect(article).toBeUndefined() // exact match required
    })
  })

  describe('getAllTags', () => {
    it('returns sorted unique tags from all articles', () => {
      const tags = getAllTags()
      expect(tags).toEqual(['tag1', 'tag2', 'tag3'])
    })

    it('returns empty array when no articles have tags', () => {
      mockReadFileSync.mockReturnValue(
        JSON.stringify({
          articles: [createArticle({ tags: [] }), createArticle({ tags: [] })],
        })
      )
      const tags = getAllTags()
      expect(tags).toEqual([])
    })

    it('returns single tag when all articles share the same tag', () => {
      mockReadFileSync.mockReturnValue(
        JSON.stringify({
          articles: [createArticle({ tags: ['common'] }), createArticle({ tags: ['common'] })],
        })
      )
      const tags = getAllTags()
      expect(tags).toEqual(['common'])
    })
  })
})
