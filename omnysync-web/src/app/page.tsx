import Link from 'next/link'
import { ArrowRight, Zap, Globe, BarChart3, ArrowUpDown, Shield } from 'lucide-react'
import { ThemeToggle } from '@/components/theme-toggle'
import { t } from '@/lib/i18n'

export default function Home() {
  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="pt-32 pb-32 bg-background">
        {/* Navigation */}
        <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-sm border-b border-border">
          <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
            <Link href="/" className="text-xl font-bold">
              Omnysync
            </Link>
            <div className="hidden md:flex items-center gap-8">
              <Link
                href="#features"
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                {t('nav_features')}
              </Link>
              <Link
                href="#how-it-works"
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                {t('nav_how_it_works')}
              </Link>
            </div>
            <div className="flex items-center gap-4">
              <Link
                href="/auth/signin"
                className="text-sm font-medium text-muted-foreground hover:text-foreground"
              >
                {t('nav_sign_in')}
              </Link>
              <ThemeToggle />
              <Link
                href="/auth/signin"
                className="inline-flex items-center justify-center rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                {t('hero_cta_primary')}
              </Link>
            </div>
          </div>
        </nav>

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
            <span className="text-muted-foreground">Perfectly in sync.</span>
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
          <p className="text-center text-sm text-muted-foreground mb-6">
            Connect with your favorite platforms
          </p>
          <div className="flex items-center justify-center gap-8 flex-wrap opacity-50">
            <div className="flex items-center gap-2">
              <Globe className="w-6 h-6" />
              <span className="font-medium">WordPress</span>
            </div>
            <div className="flex items-center gap-2">
              <Globe className="w-6 h-6" />
              <span className="font-medium">Ghost</span>
            </div>
            <div className="flex items-center gap-2">
              <Globe className="w-6 h-6" />
              <span className="font-medium">Webflow</span>
            </div>
            <div className="flex items-center gap-2">
              <Globe className="w-6 h-6" />
              <span className="font-medium">Shopify</span>
            </div>
            <div className="flex items-center gap-2">
              <Globe className="w-6 h-6" />
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
