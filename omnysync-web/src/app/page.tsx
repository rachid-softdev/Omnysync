import Link from 'next/link'
import {
  ArrowDown,
  ArrowRight,
  BarChart3,
  BookOpen,
  CalendarClock,
  Check,
  FileText,
  Globe,
  LayoutTemplate,
  Send,
  ShoppingBag,
  Workflow,
} from 'lucide-react'
import { RouteMap } from '@/components/route-map'
import { BrandLockup } from '@/components/signal-mark'
import { getT } from '@/lib/i18n'
import { pageMetadata } from '@/lib/metadata'
import type { Metadata } from 'next'

export function generateMetadata(): Promise<Metadata> {
  return pageMetadata({
    titleKey: 'META_HOME_TITLE',
    descriptionKey: 'META_HOME_DESC',
    path: '/',
    absoluteTitle: true,
  })
}

const PLATFORMS = [
  { name: 'Google Docs', icon: FileText, source: true },
  { name: 'Notion', icon: BookOpen, source: true },
  { name: 'WordPress', icon: Globe, source: false },
  { name: 'Ghost', icon: LayoutTemplate, source: false },
  { name: 'Webflow', icon: Workflow, source: false },
  { name: 'Shopify', icon: ShoppingBag, source: false },
]

const FEATURES = [
  {
    titleKey: 'feature_analytics_title',
    descKey: 'feature_analytics_desc',
    icon: BarChart3,
    visual: 'analytics',
  },
  {
    titleKey: 'feature_scheduling_title',
    descKey: 'feature_scheduling_desc',
    icon: CalendarClock,
    visual: 'schedule',
  },
] as const

const STEPS = [
  { titleKey: 'step_1_title', descKey: 'step_1_desc', metaKey: 'UI_SOURCES', icon: Globe },
  { titleKey: 'step_2_title', descKey: 'step_2_desc', metaKey: 'UI_DOCUMENT', icon: FileText },
  { titleKey: 'step_3_title', descKey: 'step_3_desc', metaKey: 'UI_DESTINATIONS', icon: Send },
] as const

export default async function Home() {
  const t = await getT()

  return (
    <div className="min-h-screen bg-background">
      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden border-b border-border pt-16">
        {/* Blueprint grid, clipped to the hero. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(to_right,var(--border)_1px,transparent_1px),linear-gradient(to_bottom,var(--border)_1px,transparent_1px)] bg-[size:56px_56px] opacity-[0.35] [mask-image:radial-gradient(ellipse_70%_60%_at_45%_0%,black,transparent)]"
        />

        <div className="mx-auto grid max-w-[1200px] items-center gap-12 px-6 pb-16 pt-20 lg:grid-cols-[1.02fr_0.98fr] lg:gap-16 lg:pb-24 lg:pt-28">
          <div>
            <div className="animate-enter-up flex flex-wrap items-center gap-3" aria-hidden="true">
              <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-primary">
                {t('hero_index')}
              </span>
              <span className="hidden h-px w-8 bg-border sm:block" />
              <span className="hidden font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground sm:inline">
                {t('hero_badge')}
              </span>
            </div>

            <h1
              className="animate-enter-up mt-7 text-[clamp(2.75rem,6vw,5.25rem)] font-semibold leading-[0.96] tracking-[-0.04em] text-foreground"
              style={{ animationDelay: '90ms' }}
            >
              {t('hero_headline')}
              <br />
              <span className="text-muted-foreground">{t('hero_tagline')}</span>
            </h1>

            <p
              className="animate-enter-up mt-6 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg"
              style={{ animationDelay: '170ms' }}
            >
              {t('hero_subtitle')}
            </p>

            <div
              className="animate-enter-up mt-8 flex flex-col items-start gap-2.5 sm:flex-row"
              style={{ animationDelay: '250ms' }}
            >
              <Link
                href="/auth/signin"
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-[3px] bg-primary px-6 text-sm font-medium text-primary-foreground shadow-xs transition-[background-color,box-shadow,transform] duration-150 hover:bg-primary-hover hover:shadow-sm active:translate-y-px sm:w-auto"
              >
                {t('hero_cta_primary')}
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
              <Link
                href="#features"
                className="inline-flex h-11 w-full items-center justify-center rounded-[3px] border border-border bg-card px-6 text-sm font-medium text-foreground shadow-2xs transition-[background-color,border-color,box-shadow,transform] duration-150 hover:border-border-strong hover:bg-muted active:translate-y-px sm:w-auto"
              >
                {t('hero_cta_secondary')}
              </Link>
            </div>

            <div
              className="animate-enter-fade mt-8 flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px] text-muted-foreground"
              style={{ animationDelay: '340ms' }}
            >
              <span className="inline-flex items-center gap-1.5">
                <Check className="size-3.5 text-success" aria-hidden="true" />
                {t('hero_no_credit_card')}
              </span>
              <span className="hidden h-3 w-px bg-border sm:block" aria-hidden="true" />
              <span className="font-mono uppercase tracking-[0.12em]">{t('hero_stat')}</span>
            </div>
          </div>

          <div className="animate-enter-scale relative" style={{ animationDelay: '300ms' }}>
            {/* Registration marks: the map reads as an instrument panel, not a screenshot. */}
            <span
              aria-hidden="true"
              className="absolute -left-2.5 -top-2.5 z-10 size-5 border-l border-t border-primary/50"
            />
            <span
              aria-hidden="true"
              className="absolute -bottom-2.5 -right-2.5 z-10 size-5 border-b border-r border-primary/50"
            />
            <RouteMap tone="dark" />
            <div className="mt-3 flex items-center justify-between font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground">
              <span>{t('routing_console')}</span>
              <span>DEMO</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── Connector rail ──────────────────────────────────────────────── */}
      <section className="border-b border-border bg-muted/30" aria-label={t('hero_platforms')}>
        <div className="mx-auto max-w-[1200px] px-6">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border py-3">
            <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground">
              {t('hero_platforms')}
            </p>
            <p className="font-mono text-[9px] uppercase tracking-[0.12em] text-muted-foreground">
              {t('hero_stat')}
            </p>
          </div>
          <ul className="flex overflow-x-auto">
            {PLATFORMS.map((platform) => (
              <li
                key={platform.name}
                className="flex min-w-[158px] flex-1 items-center gap-3 border-r border-border px-4 py-4 last:border-r-0 first:pl-0"
              >
                <span className="grid size-8 shrink-0 place-items-center border border-border bg-background text-muted-foreground">
                  <platform.icon className="size-4" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-medium text-foreground">
                    {platform.name}
                  </p>
                  <p className="mt-0.5 font-mono text-[8px] uppercase tracking-[0.14em] text-muted-foreground">
                    {platform.source ? t('UI_SOURCE') : t('UI_DESTINATION')}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ── Features ────────────────────────────────────────────────────── */}
      <section id="features" className="scroll-mt-16 border-b border-border py-20 sm:py-24">
        <div className="mx-auto max-w-[1200px] px-6">
          <div className="grid gap-10 lg:grid-cols-[0.78fr_1.22fr] lg:gap-16">
            <div className="lg:sticky lg:top-24 lg:self-start">
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-primary">
                {t('features_index')}
              </p>
              <h2 className="mt-3 max-w-sm text-[clamp(2rem,4.2vw,3.25rem)] font-semibold leading-[1.02] tracking-[-0.035em]">
                {t('features_title')}
              </h2>
              <p className="mt-4 max-w-sm text-sm leading-relaxed text-muted-foreground">
                {t('features_subtitle')}
              </p>
              <Link
                href="#how-it-works"
                className="mt-7 inline-flex items-center gap-2 border-b border-border pb-1 text-[13px] font-medium text-foreground transition-colors hover:border-foreground"
              >
                {t('nav_how_it_works')}
                <ArrowDown className="size-3.5" aria-hidden="true" />
              </Link>
            </div>

            <div className="border-t border-border">
              {FEATURES.map((feature, index) => (
                <article
                  key={feature.titleKey}
                  className="group grid gap-4 border-b border-border py-7 sm:grid-cols-[40px_1fr] sm:gap-6"
                >
                  <span className="font-mono text-[10px] tabular-nums text-muted-foreground">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-3">
                      <span className="grid size-7 shrink-0 place-items-center border border-border bg-muted/40 text-muted-foreground transition-colors duration-200 group-hover:border-primary/40 group-hover:text-primary">
                        <feature.icon className="size-3.5" aria-hidden="true" />
                      </span>
                      <h3 className="text-lg font-semibold tracking-tight">
                        {t(feature.titleKey)}
                      </h3>
                    </div>
                    <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
                      {t(feature.descKey)}
                    </p>

                    {feature.visual === 'analytics' && (
                      <div
                        className="mt-5 flex h-16 items-end gap-1 border border-border bg-muted/30 p-2"
                        aria-hidden="true"
                      >
                        {[34, 48, 42, 61, 54, 72, 66, 84, 76, 92, 81, 96].map(
                          (height, barIndex) => (
                            <span
                              key={`${height}-${barIndex}`}
                              className={`flex-1 ${barIndex === 11 ? 'bg-primary' : 'bg-primary/25'}`}
                              style={{ height: `${height}%` }}
                            />
                          )
                        )}
                      </div>
                    )}

                    {feature.visual === 'schedule' && (
                      <div className="mt-5 flex items-center gap-2 border border-border bg-muted/30 p-3 font-mono text-[10px] text-muted-foreground">
                        <span className="inline-flex items-center gap-1.5 border border-border bg-background px-2 py-1.5 text-foreground shadow-2xs">
                          <CalendarClock className="size-3" aria-hidden="true" />
                          09:00
                        </span>
                        <span
                          className="h-px flex-1 border-t border-dashed border-border-strong"
                          aria-hidden="true"
                        />
                        <span className="grid size-5 place-items-center border border-primary/30 bg-primary/10 text-primary">
                          <Check className="size-3" aria-hidden="true" />
                        </span>
                        <span
                          className="h-px flex-1 border-t border-dashed border-border-strong"
                          aria-hidden="true"
                        />
                        <span className="border border-border bg-background px-2 py-1.5 text-primary shadow-2xs">
                          09:02
                        </span>
                      </div>
                    )}
                  </div>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── How it works ────────────────────────────────────────────────── */}
      <section
        id="how-it-works"
        className="relative scroll-mt-16 overflow-hidden border-y border-sidebar-border bg-sidebar py-20 text-sidebar-foreground sm:py-24"
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,var(--sidebar-border)_1px,transparent_1px),linear-gradient(to_bottom,var(--sidebar-border)_1px,transparent_1px)] bg-[size:56px_56px] opacity-[0.16] [mask-image:radial-gradient(ellipse_70%_70%_at_30%_0%,black,transparent)]"
        />

        <div className="relative mx-auto max-w-[1200px] px-6">
          <div className="grid gap-6 border-b border-sidebar-border pb-8 lg:grid-cols-[1fr_auto] lg:items-end lg:gap-16">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-sidebar-primary">
                {t('how_it_works_index')}
              </p>
              <h2 className="mt-3 max-w-2xl text-[clamp(2rem,4.2vw,3.25rem)] font-semibold leading-[1.02] tracking-[-0.035em] text-sidebar-foreground">
                {t('how_it_works_title')}
              </h2>
              <p className="mt-4 max-w-xl text-sm leading-relaxed text-sidebar-foreground/55">
                {t('how_it_works_subtitle')}
              </p>
            </div>
            <p className="font-mono text-[9px] uppercase leading-relaxed tracking-[0.14em] text-sidebar-foreground/35">
              {t('hero_stat')}
            </p>
          </div>

          <ol className="grid lg:grid-cols-3">
            {STEPS.map((step, index) => (
              <li
                key={step.titleKey}
                className="relative border-b border-sidebar-border py-8 last:border-b-0 lg:border-b-0 lg:border-r lg:px-7 lg:first:pl-0 lg:last:border-r-0 lg:last:pr-0"
              >
                <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.14em]">
                  <span className="text-sidebar-primary">{String(index + 1).padStart(2, '0')}</span>
                  <span className="text-sidebar-foreground/35">{t(step.metaKey)}</span>
                </div>
                <span className="mt-6 grid size-10 place-items-center border border-sidebar-border bg-sidebar-accent text-sidebar-primary">
                  <step.icon className="size-4.5" aria-hidden="true" />
                </span>
                <h3 className="mt-5 text-xl font-semibold tracking-tight text-sidebar-foreground">
                  {t(step.titleKey)}
                </h3>
                <p className="mt-2 max-w-xs text-sm leading-relaxed text-sidebar-foreground/55">
                  {t(step.descKey)}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ── Closing CTA ─────────────────────────────────────────────────── */}
      <section className="border-b border-border">
        <div className="mx-auto max-w-[1200px] px-6 py-20 sm:py-24">
          <div className="grid gap-10 lg:grid-cols-[1.3fr_0.7fr] lg:items-end lg:gap-16">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-primary">
                {t('cta_index')}
              </p>
              <h2 className="mt-4 text-[clamp(2.75rem,6.5vw,5.5rem)] font-semibold leading-[0.92] tracking-[-0.05em]">
                {t('cta_section_title')}
                <br />
                <span className="text-muted-foreground">{t('cta_section_subtitle')}</span>
              </h2>
              <p className="mt-5 max-w-lg text-sm leading-relaxed text-muted-foreground">
                {t('cta_section_body')}
              </p>
            </div>

            <div className="border-t border-border pt-5">
              <div className="flex flex-col gap-2.5">
                <Link
                  href="/auth/signin"
                  className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-[3px] bg-primary px-6 text-sm font-medium text-primary-foreground shadow-xs transition-[background-color,box-shadow,transform] duration-150 hover:bg-primary-hover hover:shadow-sm active:translate-y-px"
                >
                  {t('cta_final_button')}
                  <ArrowRight className="size-4" aria-hidden="true" />
                </Link>
                <Link
                  href="/pricing"
                  className="inline-flex h-11 w-full items-center justify-center rounded-[3px] border border-border bg-background px-6 text-sm font-medium text-foreground shadow-2xs transition-[background-color,border-color] duration-150 hover:border-border-strong hover:bg-muted active:translate-y-px"
                >
                  {t('nav_pricing')}
                </Link>
              </div>
              <p className="mt-4 flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.12em] text-muted-foreground">
                <Check className="size-3 text-success" aria-hidden="true" />
                {t('hero_no_credit_card')}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────────────────── */}
      <footer>
        <div className="mx-auto max-w-[1200px] px-6 py-12">
          <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.4fr_0.7fr_0.7fr_0.9fr]">
            <div>
              <BrandLockup />
              <p className="mt-4 max-w-xs text-sm leading-relaxed text-muted-foreground">
                {t('footer_tagline')}
              </p>
              <p className="mt-5 font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground">
                {t('hero_stat')}
              </p>
            </div>

            <nav aria-label={t('footer_product')}>
              <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground">
                {t('footer_product')}
              </p>
              <ul className="mt-3 space-y-2 text-sm">
                <li>
                  <Link
                    href="/#features"
                    className="text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {t('nav_features')}
                  </Link>
                </li>
                <li>
                  <Link
                    href="/#how-it-works"
                    className="text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {t('nav_how_it_works')}
                  </Link>
                </li>
                <li>
                  <Link
                    href="/pricing"
                    className="text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {t('nav_pricing')}
                  </Link>
                </li>
              </ul>
            </nav>

            <nav aria-label={t('footer_account')}>
              <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground">
                {t('footer_account')}
              </p>
              <ul className="mt-3 space-y-2 text-sm">
                <li>
                  <Link
                    href="/auth/signin"
                    className="text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {t('nav_sign_in')}
                  </Link>
                </li>
                <li>
                  <Link
                    href="/auth/signin"
                    className="text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {t('UI_GET_STARTED')}
                  </Link>
                </li>
              </ul>
            </nav>

            <div>
              <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground">
                {t('footer_system')}
              </p>
              <p className="mt-3 font-mono text-[10px] text-muted-foreground">
                {t('routing_console')} / v2.4
              </p>
              <p className="mt-1 font-mono text-[10px] text-muted-foreground">
                {t('footer_surface')}
              </p>
            </div>
          </div>

          <div className="mt-10 flex flex-col gap-3 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-between">
            <p className="font-mono text-[9px] uppercase tracking-[0.1em] text-muted-foreground">
              {t('footer_copyright')}
            </p>
            <nav
              className="flex items-center gap-5 text-xs text-muted-foreground"
              aria-label="Legal"
            >
              <Link href="#" className="transition-colors hover:text-foreground">
                {t('footer_privacy')}
              </Link>
              <Link href="#" className="transition-colors hover:text-foreground">
                {t('footer_terms')}
              </Link>
            </nav>
          </div>
        </div>
      </footer>
    </div>
  )
}
