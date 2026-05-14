import Link from "next/link"
import { notFound } from "next/navigation"
import { getArticleBySlug, getAllArticles, getArticlesByLocale } from "@/lib/blog"

interface Props {
  params: Promise<{ slug: string }>
}

export async function generateStaticParams() {
  const articles = getAllArticles()
  return articles.map((article) => ({ slug: article.slug }))
}

export async function generateMetadata({ params }: Props) {
  const { slug } = await params
  const article = getArticleBySlug(slug)

  if (!article) {
    return {
      title: "Article non trouvé - Omnysync",
    }
  }

  const localeLabel = article.locale === "fr" ? "français" : "english"

  return {
    title: `${article.title} - Omnysync Blog`,
    description: article.excerpt,
    openGraph: {
      title: article.title,
      description: article.excerpt,
      type: "article",
      publishedTime: article.publishedAt,
      authors: ["Omnysync"],
      tags: article.tags,
    },
    twitter: {
      card: "summary_large_image",
      title: article.title,
      description: article.excerpt,
    },
    alternates: {
      languages: {
        fr: `/blog/${article.slug}`,
        en: `/blog/${article.slug}`,
      },
    },
  }
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params
  const article = getArticleBySlug(slug)

  if (!article) {
    notFound()
  }

  // Get related articles (same locale, excluding current)
  const relatedArticles = getArticlesByLocale(article.locale)
    .filter((a) => a.slug !== article.slug)
    .slice(0, 3)

  const translations = {
    fr: {
      backToBlog: "← Retour au blog",
      readMore: "Lire la suite",
      relatedArticles: "Articles liés",
      share: "Partager",
    },
    en: {
      backToBlog: "← Back to blog",
      readMore: "Read more",
      relatedArticles: "Related articles",
      share: "Share",
    },
  }

  const t = translations[article.locale]

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-sm border-b border-border">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="text-xl font-bold">
            Omnysync
          </Link>
          <div className="hidden md:flex items-center gap-8">
            <Link href="/blog" className="text-sm text-muted-foreground hover:text-foreground">
              Blog
            </Link>
          </div>
          <Link
            href="/auth/signin"
            className="inline-flex items-center justify-center rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            {article.locale === "fr" ? "Commencer" : "Get Started"}
          </Link>
        </div>
      </nav>

      {/* Article Header */}
      <section className="pt-32 pb-16 bg-background">
        <div className="max-w-4xl mx-auto px-6">
          <Link
            href={`/blog?locale=${article.locale}`}
            className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-8"
          >
            {t.backToBlog}
          </Link>

          {/* Tags */}
          <div className="flex flex-wrap gap-2 mb-6">
            {article.tags.map((tag) => (
              <span
                key={tag}
                className="px-3 py-1 text-sm font-medium rounded-full bg-secondary text-muted-foreground"
              >
                {tag}
              </span>
            ))}
          </div>

          {/* Title */}
          <h1 className="text-4xl md:text-5xl font-bold mb-6 leading-tight">{article.title}</h1>

          {/* Meta */}
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <time dateTime={article.publishedAt}>
              {new Date(article.publishedAt).toLocaleDateString(
                article.locale === "fr" ? "fr-FR" : "en-GB",
                {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                }
              )}
            </time>
            <span>•</span>
            <span>{article.locale === "fr" ? "5 min de lecture" : "5 min read"}</span>
          </div>
        </div>
      </section>

      {/* Article Content */}
      <section className="py-12 bg-background">
        <div className="max-w-4xl mx-auto px-6">
          <article className="prose prose-lg dark:prose-invert max-w-none">
            <div
              className="blog-content"
              dangerouslySetInnerHTML={{ __html: article.content }}
            />
          </article>

          {/* Share */}
          <div className="mt-12 pt-8 border-t border-border">
            <p className="text-sm text-muted-foreground mb-4">{t.share}</p>
            <div className="flex gap-4">
              <Link
                href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(article.title)}&url=${encodeURIComponent(`https://omnysync.com/blog/${article.slug}`)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                Twitter
              </Link>
              <Link
                href={`https://www.linkedin.com/shareArticle?mini=true&url=${encodeURIComponent(`https://omnysync.com/blog/${article.slug}`)}&title=${encodeURIComponent(article.title)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                LinkedIn
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Related Articles */}
      {relatedArticles.length > 0 && (
        <section className="py-16 bg-secondary">
          <div className="max-w-7xl mx-auto px-6">
            <h2 className="text-2xl font-bold mb-8">{t.relatedArticles}</h2>
            <div className="grid md:grid-cols-3 gap-8">
              {relatedArticles.map((related) => (
                <article
                  key={related.slug}
                  className="group rounded-2xl border border-border bg-card overflow-hidden hover:shadow-lg transition-all"
                >
                  <div className="p-6">
                    <h3 className="text-lg font-semibold mb-2 group-hover:text-primary transition-colors">
                      <Link href={`/blog/${related.slug}`}>{related.title}</Link>
                    </h3>
                    <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                      {related.excerpt}
                    </p>
                    <Link
                      href={`/blog/${related.slug}`}
                      className="text-sm font-medium text-primary hover:underline"
                    >
                      {t.readMore} →
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* CTA Section */}
      <section className="py-16 bg-primary text-primary-foreground">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <h2 className="text-3xl font-bold mb-4">
            {article.locale === "fr"
              ? "Prêt à simplifier votre stratégie de contenu ?"
              : "Ready to simplify your content strategy?"}
          </h2>
          <p className="text-primary-foreground/80 mb-8">
            {article.locale === "fr"
              ? "Commencez gratuitement et synchronisez votre contenu sur toutes vos plateformes."
              : "Start for free and sync your content across all your platforms."}
          </p>
          <Link
            href="/auth/signin"
            className="inline-flex items-center justify-center rounded-full bg-background px-8 py-4 text-sm font-medium text-foreground hover:bg-background/90"
          >
            {article.locale === "fr" ? "Commencer gratuitement" : "Start for free"}
          </Link>
        </div>
      </section>

      {/* Custom Styles for Blog Content */}
      <style jsx global>{`
        .blog-content h2 {
          font-size: 1.75rem;
          font-weight: 700;
          margin-top: 2rem;
          margin-bottom: 1rem;
        }
        .blog-content h3 {
          font-size: 1.25rem;
          font-weight: 600;
          margin-top: 1.5rem;
          margin-bottom: 0.75rem;
        }
        .blog-content p {
          margin-bottom: 1.25rem;
          line-height: 1.75;
        }
        .blog-content ul,
        .blog-content ol {
          margin-bottom: 1.25rem;
          padding-left: 1.5rem;
        }
        .blog-content li {
          margin-bottom: 0.5rem;
          line-height: 1.75;
        }
        .blog-content strong {
          font-weight: 600;
        }
      `}</style>
    </div>
  )
}