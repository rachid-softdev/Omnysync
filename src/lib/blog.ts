import fs from "fs"
import path from "path"

export interface BlogArticle {
  slug: string
  locale: "fr" | "en"
  title: string
  excerpt: string
  content: string
  tags: string[]
  publishedAt: string
}

export interface BlogData {
  articles: BlogArticle[]
}

const blogDataPath = path.join(process.cwd(), "data", "blog.json")

export function getBlogData(): BlogData {
  const fileContent = fs.readFileSync(blogDataPath, "utf-8")
  return JSON.parse(fileContent)
}

export function getAllArticles(): BlogArticle[] {
  const data = getBlogData()
  return data.articles.sort(
    (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  )
}

export function getArticlesByLocale(locale: "fr" | "en"): BlogArticle[] {
  return getAllArticles().filter((article) => article.locale === locale)
}

export function getArticleBySlug(slug: string): BlogArticle | undefined {
  const data = getBlogData()
  return data.articles.find((article) => article.slug === slug)
}

export function getAllTags(): string[] {
  const articles = getAllArticles()
  const tags = new Set<string>()
  articles.forEach((article) => {
    article.tags.forEach((tag) => tags.add(tag))
  })
  return Array.from(tags).sort()
}