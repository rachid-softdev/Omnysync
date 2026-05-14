import Link from "next/link"
import { notFound } from "next/navigation"
import { getAllArticles, getArticlesByLocale, getArticleBySlug } from "@/lib/blog"

interface Props {
  params: Promise<{ slug?: string }>
  searchParams: Promise<{ locale?: string }>
}

export const dynamic = "force-dynamic"

export async function generateMetadata({ searchParams }: Props) {
  const params = await searchParams
  const locale = params.locale || "fr"
  const title = locale === "fr" ? "Blog - Omnysync" : "Blog - Omnysync"
  const description =
    locale === "fr"
      ? "Découvrez nos articles sur la synchronisation de contenu, le marketing digital et les meilleures pratiques pour votre stratégie de contenu."
      : "Discover our articles on content synchronization, digital marketing, and best practices for your content strategy."

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
    },
  }
}

export default async function BlogPage({ searchParams }: Props) {
  const params = await searchParams
  const currentLocale = (params.locale as "fr" | "en") || "fr"
  const articles = getArticlesByLocale(currentLocale)

  const translations = {
    fr: {
      title: "Blog",
      subtitle: "Actualités et conseils sur la synchronisation de contenu",
      all: "Tous",
      readMore: "Lire la suite",
      noArticles: "Aucun article disponible",
    },
    en: {
      title: "Blog",
      subtitle: "News and tips on content synchronization",
      all: "All",
      readMore: "Read more",
      noArticles: "No articles available",
    },
  }

  const t = translations[currentLocale]

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="pt-32 pb-16 bg-background">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-12">
            <h1 className="text-5xl font-bold mb-4">{t.title}</h1>
            <p className="text-xl text-muted-foreground">{t.subtitle}</p>
          </div>

          {/* Language Filter */}
          <div className="flex justify-center gap-4 mb-12">
            <Link
              href="/blog?locale=fr"
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                currentLocale === "fr"
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-muted-foreground hover:bg-secondary/80"
              }`}
            >
              🇫🇷 Français
            </Link>
            <Link
              href="/blog?locale=en"
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                currentLocale === "en"
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-muted-foreground hover:bg-secondary/80"
              }`}
            >
              🇬🇧 English
            </Link>
          </div>
        </div>
      </section>

      {/* Articles Grid */}
      <section className="py-16 bg-background">
        <div className="max-w-7xl mx-auto px-6">
          {articles.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-muted-foreground">{t.noArticles}</p>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              {articles.map((article) => (
                <article
                  key={article.slug}
                  className="group rounded-3xl border border-border bg-card overflow-hidden hover:shadow-lg transition-all duration-300"
                >
                  {/* Card Content */}
                  <div className="p-6">
                    {/* Tags */}
                    <div className="flex flex-wrap gap-2 mb-4">
                      {article.tags.slice(0, 3).map((tag) => (
                        <span
                          key={tag}
                          className="px-2 py-1 text-xs font-medium rounded-full bg-secondary text-muted-foreground"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>

                    {/* Title */}
                    <h2 className="text-xl font-bold mb-3 group-hover:text-primary transition-colors">
                      <Link href={`/blog/${article.slug}`}>{article.title}</Link>
                    </h2>

                    {/* Excerpt */}
                    <p className="text-sm text-muted-foreground mb-4 line-clamp-3">
                      {article.excerpt}
                    </p>

                    {/* Meta */}
                    <div className="flex items-center justify-between pt-4 border-t border-border">
                      <time className="text-xs text-muted-foreground">
                        {new Date(article.publishedAt).toLocaleDateString(
                          currentLocale === "fr" ? "fr-FR" : "en-GB",
                          {
                            year: "numeric",
                            month: "long",
                            day: "numeric",
                          }
                        )}
                      </time>
                      <Link
                        href={`/blog/${article.slug}`}
                        className="text-sm font-medium text-primary hover:underline"
                      >
                        {t.readMore} →
                      </Link>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 bg-secondary">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <h2 className="text-3xl font-bold mb-4">
            {currentLocale === "fr"
              ? "Prêt à simplifier votre stratégie de contenu ?"
              : "Ready to simplify your content strategy?"}
          </h2>
          <p className="text-muted-foreground mb-8">
            {currentLocale === "fr"
              ? "Commencez gratuitement et synchronisez votre contenu sur toutes vos plateformes."
              : "Start for free and sync your content across all your platforms."}
          </p>
          <Link
            href="/auth/signin"
            className="inline-flex items-center justify-center rounded-full bg-primary px-8 py-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            {currentLocale === "fr" ? "Commencer gratuitement" : "Start for free"}
          </Link>
        </div>
      </section>
    </div>
  )
}