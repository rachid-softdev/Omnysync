import fs from 'fs'
import path from 'path'
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

interface BlogArticle {
  slug: string
  locale: 'fr' | 'en'
  title: string
  excerpt: string
  content: string
  tags: string[]
  publishedAt: string
}

interface BlogData {
  articles: BlogArticle[]
}

const blogDataPath = path.join(process.cwd(), 'data', 'blog.json')

// Topics for blog posts (content sync, productivity, digital marketing, etc.)
const topicsFr = [
  'automatiser la publication de contenu',
  'meilleures pratiques de synchronisation',
  'gestion multi-plateformes',
  'productivité pour créateurs de contenu',
  'stratégie de contenu digital',
  "marketing d'affiliation",
  'SEO pour les créateurs',
  'outils de productivité',
  'monétisation de contenu',
  'growth hacking pour blogs',
]

const topicsEn = [
  'content automation best practices',
  'multi-platform content management',
  'digital content strategy',
  'productivity tips for creators',
  'content marketing trends',
  'SEO optimization tips',
  'creator economy tools',
  'content monetization strategies',
  'audience growth tactics',
  'cross-platform publishing',
]

function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

function countExistingArticlesByLocale(): { fr: number; en: number } {
  const data = JSON.parse(fs.readFileSync(blogDataPath, 'utf-8')) as BlogData
  const fr = data.articles.filter((a) => a.locale === 'fr').length
  const en = data.articles.filter((a) => a.locale === 'en').length
  return { fr, en }
}

async function generateBlogPost(locale: 'fr' | 'en'): Promise<BlogArticle> {
  const topics = locale === 'fr' ? topicsFr : topicsEn
  const randomTopic = topics[Math.floor(Math.random() * topics.length)]

  const systemPrompt =
    locale === 'fr'
      ? `Tu es un expert en marketing digital et création de contenu. Tu écris des articles de blog engageants, informatifs et optimisés pour le SEO. Les articles doivent être en français, avec un ton professionnel mais accessible.`
      : `You are an expert in digital marketing and content creation. You write engaging, informative, and SEO-optimized blog posts in English with a professional but accessible tone.`

  const userPrompt =
    locale === 'fr'
      ? `Écris un article de blog complet sur le sujet : "${randomTopic}". 
L'article doit être structuré avec des titres (h2, h3), des paragraphes, et des listes quand pertinent.
Longueur : 600-900 mots.
Inclue un titre accrocheur et une meta description de 150-160 caractères.

Réponds STRICTEMENT en JSON avec cette structure:
{
  "title": "titre de l'article",
  "excerpt": "meta description de 150-160 caractères",
  "content": "contenu HTML complet avec balises <h2>, <h3>, <p>, <ul>, <li>",
  "tags": ["tag1", "tag2", "tag3"]
}`
      : `Write a complete blog post about: "${randomTopic}".
The article should be structured with headings (h2, h3), paragraphs, and lists where appropriate.
Length: 600-900 words.
Include a catchy title and a meta description of 150-160 characters.

Respond STRICTLY in JSON with this structure:
{
  "title": "article title",
  "excerpt": "meta description 150-160 characters",
  "content": "complete HTML content with <h2>, <h3>, <p>, <ul>, <li> tags",
  "tags": ["tag1", "tag2", "tag3"]
}`

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: 'blog_post',
        schema: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            excerpt: { type: 'string' },
            content: { type: 'string' },
            tags: { type: 'array', items: { type: 'string' } },
          },
          required: ['title', 'excerpt', 'content', 'tags'],
        },
      },
    },
  })

  const result = JSON.parse(response.choices[0].message.content || '{}')

  const today = new Date().toISOString().split('T')[0]

  return {
    slug: generateSlug(result.title),
    locale,
    title: result.title,
    excerpt: result.excerpt.substring(0, 160),
    content: result.content,
    tags: result.tags?.slice(0, 4) || [randomTopic],
    publishedAt: today,
  }
}

async function main() {
  console.log('🚀 Starting blog post generation...\n')

  if (!process.env.OPENAI_API_KEY) {
    console.error('❌ OPENAI_API_KEY is not set')
    process.exit(1)
  }

  // Determine which locale to use (alternating)
  const counts = countExistingArticlesByLocale()
  const locale: 'fr' | 'en' = counts.fr <= counts.en ? 'fr' : 'en'

  console.log(`📊 Current articles - FR: ${counts.fr}, EN: ${counts.en}`)
  console.log(`✨ Generating new article in ${locale === 'fr' ? 'French' : 'English'}...\n`)

  try {
    const newArticle = await generateBlogPost(locale)

    // Check if slug already exists
    const data = JSON.parse(fs.readFileSync(blogDataPath, 'utf-8')) as BlogData
    const existingSlugs = new Set(data.articles.map((a) => a.slug))

    if (existingSlugs.has(newArticle.slug)) {
      console.log(`⚠️ Slug "${newArticle.slug}" already exists, regenerating...`)
      newArticle.slug = `${newArticle.slug}-${Date.now()}`
    }

    // Add new article
    data.articles.push(newArticle)

    // Save updated data
    fs.writeFileSync(blogDataPath, JSON.stringify(data, null, 2))

    console.log('✅ Blog post generated successfully!\n')
    console.log(`📝 Title: ${newArticle.title}`)
    console.log(`🏷️  Tags: ${newArticle.tags.join(', ')}`)
    console.log(`📅 Published: ${newArticle.publishedAt}`)
    console.log(`🔗 Slug: ${newArticle.slug}`)
  } catch (error) {
    console.error('❌ Error generating blog post:', error)
    process.exit(1)
  }
}

main()
