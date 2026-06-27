import Link from 'next/link'
import { ArrowRight, Zap, BarChart3, ArrowUpDown, Shield } from 'lucide-react'
import { t } from '@/lib/i18n'

export default function Home() {
  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="pt-32 pb-32 bg-background">
        {/* Hero Content */}
        <main className="max-w-4xl mx-auto px-6 text-center mt-16">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-secondary text-sm font-medium text-muted-foreground mb-6">
            <Zap className="w-4 h-4" />
            <span>{t('hero_badge')}</span>
          </div>

          {/* Hero Headline */}
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-6">
            {t('hero_headline')}
            <br />
            <span className="text-muted-foreground">{t('hero_tagline')}</span>
          </h1>

          {/* Subtitle */}
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
            {t('hero_subtitle')}
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-4">
            <Link
              href="/auth/signin"
              className="inline-flex items-center justify-center rounded-full bg-primary px-8 py-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              {t('hero_cta_primary')}
              <ArrowRight className="ml-2 w-4 h-4" />
            </Link>
            <Link
              href="#features"
              className="inline-flex items-center justify-center rounded-full border border-input px-8 py-4 text-sm font-medium hover:bg-accent"
            >
              {t('hero_cta_secondary')}
            </Link>
          </div>

          <p className="text-sm text-muted-foreground">{t('hero_no_credit_card')}</p>
        </main>

        {/* Platform Logos */}
        <div className="mt-16 pt-8 border-t border-border">
          <p className="text-center text-sm text-muted-foreground mb-6">{t('hero_platforms')}</p>
          <div className="flex items-center justify-center gap-8 flex-wrap opacity-50">
            <div className="flex items-center gap-2">
              <svg
                className="w-6 h-6"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <circle cx="12" cy="12" r="10" />
                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10A15.3 15.3 0 0 1 12 2z" />
                <path d="M2 12h20" />
              </svg>
              <span className="font-medium">WordPress</span>
            </div>
            <div className="flex items-center gap-2">
              <svg
                className="w-6 h-6"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <rect x="3" y="3" width="18" height="18" rx="4" />
                <circle cx="12" cy="12" r="3" />
                <circle cx="16" cy="8" r="1" fill="currentColor" />
              </svg>
              <span className="font-medium">Ghost</span>
            </div>
            <div className="flex items-center gap-2">
              <svg
                className="w-6 h-6"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M4 3h16a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" />
                <path d="M8 7h8" />
                <path d="M8 11h6" />
                <path d="M8 15h4" />
              </svg>
              <span className="font-medium">Webflow</span>
            </div>
            <div className="flex items-center gap-2">
              <svg
                className="w-6 h-6"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" />
                <path d="M8.5 12.5c.83 0 1.5-.67 1.5-1.5s-.67-1.5-1.5-1.5S7 10.17 7 11s.67 1.5 1.5 1.5z" />
                <path d="M15.5 12.5c.83 0 1.5-.67 1.5-1.5s-.67-1.5-1.5-1.5S14 10.17 14 11s.67 1.5 1.5 1.5z" />
                <path d="M9 16c.5.5 1.5 1 3 1s2.5-.5 3-1" />
              </svg>
              <span className="font-medium">Shopify</span>
            </div>
            <div className="flex items-center gap-2">
              <svg
                className="w-6 h-6"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M4 4h16v16H4z" />
                <path d="M8 8h8" />
                <path d="M8 12h8" />
                <path d="M8 16h8" />
              </svg>
              <span className="font-medium">Notion</span>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-16 bg-background">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">{t('features_title')}</h2>
            <p className="text-muted-foreground max-w-xl mx-auto">{t('features_subtitle')}</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <div className="p-8 rounded-3xl border border-border bg-card">
              <div className="w-12 h-12 rounded-xl bg-accent flex items-center justify-center mb-4">
                <ArrowUpDown className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-semibold mb-2">{t('feature_two_way_title')}</h3>
              <p className="text-sm text-muted-foreground">{t('feature_two_way_desc')}</p>
            </div>

            {/* Feature 2 */}
            <div className="p-8 rounded-3xl border border-border bg-card">
              <div className="w-12 h-12 rounded-xl bg-accent flex items-center justify-center mb-4">
                <BarChart3 className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-semibold mb-2">{t('feature_analytics_title')}</h3>
              <p className="text-sm text-muted-foreground">{t('feature_analytics_desc')}</p>
            </div>

            {/* Feature 3 */}
            <div className="p-8 rounded-3xl border border-border bg-card">
              <div className="w-12 h-12 rounded-xl bg-accent flex items-center justify-center mb-4">
                <Shield className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-semibold mb-2">{t('feature_scheduling_title')}</h3>
              <p className="text-sm text-muted-foreground">{t('feature_scheduling_desc')}</p>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="py-16 bg-secondary">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">{t('how_it_works_title')}</h2>
            <p className="text-muted-foreground max-w-xl mx-auto">{t('how_it_works_subtitle')}</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 text-center">
            <div>
              <div className="w-16 h-16 rounded-full bg-primary text-primary-foreground flex items-center justify-center mx-auto mb-4 text-xl font-bold">
                1
              </div>
              <h3 className="text-xl font-semibold mb-2">{t('step_1_title')}</h3>
              <p className="text-sm text-muted-foreground">{t('step_1_desc')}</p>
            </div>

            <div>
              <div className="w-16 h-16 rounded-full bg-primary text-primary-foreground flex items-center justify-center mx-auto mb-4 text-xl font-bold">
                2
              </div>
              <h3 className="text-xl font-semibold mb-2">{t('step_2_title')}</h3>
              <p className="text-sm text-muted-foreground">{t('step_2_desc')}</p>
            </div>

            <div>
              <div className="w-16 h-16 rounded-full bg-primary text-primary-foreground flex items-center justify-center mx-auto mb-4 text-xl font-bold">
                3
              </div>
              <h3 className="text-xl font-semibold mb-2">{t('step_3_title')}</h3>
              <p className="text-sm text-muted-foreground">{t('step_3_desc')}</p>
            </div>
          </div>

          <div className="text-center mt-12">
            <Link
              href="/auth/signin"
              className="inline-flex items-center justify-center rounded-full bg-primary px-8 py-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              {t('cta_final_button')}
              <ArrowRight className="ml-2 w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 bg-primary text-primary-foreground">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <h2 className="text-4xl font-bold mb-4">{t('cta_section_title')}</h2>
          <p className="text-primary-foreground/80 mb-8">{t('cta_section_subtitle')}</p>
          <Link
            href="/auth/signin"
            className="inline-flex items-center justify-center rounded-full bg-background px-8 py-4 text-sm font-medium text-foreground hover:bg-background/90"
          >
            {t('cta_final_button')}
            <ArrowRight className="ml-2 w-4 h-4" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t border-border">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="text-lg font-bold">Omnysync</div>
          <div className="flex items-center gap-6 text-sm text-muted-foreground">
            <Link href="#" className="hover:text-foreground">
              {t('footer_privacy')}
            </Link>
            <Link href="#" className="hover:text-foreground">
              {t('footer_terms')}
            </Link>
          </div>
          <p className="text-sm text-muted-foreground">{t('footer_copyright')}</p>
        </div>
      </footer>
    </div>
  )
}
