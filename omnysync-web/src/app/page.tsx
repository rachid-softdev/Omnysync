import Link from 'next/link'
import {
  ArrowRight,
  Check,
  FileText,
  Globe,
  LayoutTemplate,
  RefreshCw,
  ShoppingBag,
  Workflow,
  Zap,
} from 'lucide-react'
import { ProductDemo } from '@/components/product-demo'
import { RouteMap } from '@/components/route-map'
import { getLocaleFromHeaders, getT } from '@/lib/i18n'
import { headers } from 'next/headers'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Omnysync — Your content, everywhere',
  description:
    'Write once, publish everywhere. Omnysync keeps WordPress, Ghost, Webflow and Shopify in sync from a single draft.',
}

const PLATFORMS = [
  { name: 'WordPress', icon: Globe },
  { name: 'Ghost', icon: LayoutTemplate },
  { name: 'Webflow', icon: Workflow },
  { name: 'Shopify', icon: ShoppingBag },
  { name: 'Notion', icon: FileText },
]

export default async function Home() {
  const locale = getLocaleFromHeaders(await headers())
  const t = await getT()

  return (
    <div className="min-h-screen bg-background">
      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden border-b border-border pt-14">
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
                href="#demo"
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
              <span>v2.4</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── Platform strip ──────────────────────────────────────────────── */}
      <section className="border-y border-border bg-muted/40">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-5 px-6 py-8 sm:flex-row sm:justify-between">
          <p className="text-xs font-medium text-muted-foreground">{t('hero_platforms')}</p>
          <ul className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3">
            {PLATFORMS.map((platform) => (
              <li
                key={platform.name}
                className="flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors duration-200 hover:text-foreground"
              >
                <platform.icon className="size-4" aria-hidden="true" />
                {platform.name}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ── Product demo ────────────────────────────────────────────────── */}
      <section id="demo" className="scroll-mt-16 border-b border-border py-20">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
              {t('demo_eyebrow')}
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
              {t('demo_title')}
            </h2>
            <p className="mt-3 text-base leading-relaxed text-muted-foreground">
              {t('demo_subtitle')}
            </p>
          </div>

          <div className="mt-10">
            <ProductDemo
              src={locale === 'fr' ? '/demo-fr.mp4' : '/demo.mp4'}
              poster={locale === 'fr' ? '/demo-poster-fr.webp' : '/demo-poster-en.webp'}
              url="app.omnysync.com/dashboard"
              label={t('demo_video_label')}
              playLabel={t('demo_play')}
              pauseLabel={t('demo_pause')}
              silentLabel={t('demo_silent')}
              fallbackHref={locale === 'fr' ? '/demo-fr.mp4' : '/demo.mp4'}
              fallbackLabel={t('demo_fallback')}
            />
          </div>
        </div>
      </section>

      {/* ── Features ────────────────────────────────────────────────────── */}
      <section id="features" className="scroll-mt-16 py-20">
        <div className="mx-auto max-w-6xl px-6">
          <div className="max-w-2xl">
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              {t('features_title')}
            </h2>
            <p className="mt-2 text-base leading-relaxed text-muted-foreground">
              {t('features_subtitle')}
            </p>
          </div>

          {/* Asymmetric: one dominant card + two stacked supporting cards. */}
          <div className="mt-10 grid gap-4 lg:grid-cols-2">
            <div className="flex flex-col justify-between rounded-xl border border-border bg-card p-7 shadow-sm transition-[transform,box-shadow,border-color] duration-200 ease-out-quart hover:-translate-y-0.5 hover:border-border-strong hover:shadow-md">
              <div>
                <span className="grid size-10 place-items-center rounded-lg bg-primary/10 text-primary">
                  <RefreshCw className="size-5" aria-hidden="true" />
                </span>
                <h3 className="mt-4 text-base font-semibold tracking-tight">
                  {t('feature_two_way_title')}
                </h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                  {t('feature_two_way_desc')}
                </p>
              </div>

              {/* Directional diagram: both directions, so the card earns its space. */}
              <div className="mt-7 space-y-2 rounded-lg border border-border bg-muted/40 p-3">
                <div className="flex items-center gap-2">
                  <span className="rounded-md border border-border bg-background px-2.5 py-1.5 text-[11px] font-medium shadow-2xs">
                    Google Docs
                  </span>
                  <span
                    className="flex-1 border-t border-dashed border-border-strong"
                    aria-hidden="true"
                  />
                  <ArrowRight className="size-3.5 shrink-0 text-primary" aria-hidden="true" />
                  <span
                    className="flex-1 border-t border-dashed border-border-strong"
                    aria-hidden="true"
                  />
                  <span className="rounded-md border border-border bg-background px-2.5 py-1.5 text-[11px] font-medium shadow-2xs">
                    WordPress
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="rounded-md border border-border bg-background px-2.5 py-1.5 text-[11px] font-medium shadow-2xs">
                    WordPress
                  </span>
                  <span
                    className="flex-1 border-t border-dashed border-border-strong"
                    aria-hidden="true"
                  />
                  <ArrowRight
                    className="size-3.5 shrink-0 rotate-180 text-primary"
                    aria-hidden="true"
                  />
                  <span
                    className="flex-1 border-t border-dashed border-border-strong"
                    aria-hidden="true"
                  />
                  <span className="rounded-md border border-border bg-background px-2.5 py-1.5 text-[11px] font-medium shadow-2xs">
                    Google Docs
                  </span>
                </div>
              </div>
            </div>

            <div className="grid gap-4">
              {[
                {
                  icon: Zap,
                  titleKey: 'feature_analytics_title',
                  descKey: 'feature_analytics_desc',
                },
                {
                  icon: Workflow,
                  titleKey: 'feature_scheduling_title',
                  descKey: 'feature_scheduling_desc',
                },
              ].map((feature) => (
                <div
                  key={feature.titleKey}
                  className="rounded-xl border border-border bg-card p-6 shadow-sm transition-[transform,box-shadow,border-color] duration-200 ease-out-quart hover:-translate-y-0.5 hover:border-border-strong hover:shadow-md"
                >
                  <span className="grid size-9 place-items-center rounded-lg bg-muted text-muted-foreground">
                    <feature.icon className="size-4.5" aria-hidden="true" />
                  </span>
                  <h3 className="mt-3.5 text-base font-semibold tracking-tight">
                    {t(feature.titleKey)}
                  </h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                    {t(feature.descKey)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── How it works ────────────────────────────────────────────────── */}
      <section id="how-it-works" className="scroll-mt-16 border-t border-border bg-muted/40 py-20">
        <div className="mx-auto max-w-6xl px-6">
          <div className="max-w-2xl">
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              {t('how_it_works_title')}
            </h2>
            <p className="mt-2 text-base text-muted-foreground">{t('how_it_works_subtitle')}</p>
          </div>

          {/* Numbered rail — one connected flow, not three detached cards. */}
          <ol className="mt-10 grid gap-8 sm:grid-cols-3 sm:gap-0">
            {[
              { titleKey: 'step_1_title', descKey: 'step_1_desc' },
              { titleKey: 'step_2_title', descKey: 'step_2_desc' },
              { titleKey: 'step_3_title', descKey: 'step_3_desc' },
            ].map((step, index) => (
              <li key={step.titleKey} className="group relative sm:pr-8">
                <div className="flex items-center gap-3">
                  <span className="grid size-8 shrink-0 place-items-center rounded-[3px] border border-border bg-card text-[13px] font-semibold text-foreground shadow-2xs transition-colors duration-200 group-hover:border-primary/40 group-hover:text-primary">
                    {index + 1}
                  </span>
                  {index < 2 && (
                    <span className="hidden h-px flex-1 bg-border sm:block" aria-hidden="true" />
                  )}
                </div>
                <h3 className="mt-3.5 text-base font-semibold tracking-tight">
                  {t(step.titleKey)}
                </h3>
                <p className="mt-1.5 max-w-xs text-sm leading-relaxed text-muted-foreground">
                  {t(step.descKey)}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ── Closing CTA ─────────────────────────────────────────────────── */}
      <section className="py-20">
        <div className="mx-auto max-w-6xl px-6">
          <div className="relative overflow-hidden rounded-xl border border-border bg-card px-8 py-12 text-center shadow-sm">
            <div
              aria-hidden="true"
              className="animate-drift pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_50%_100%_at_50%_0%,var(--accent),transparent)] will-change-transform"
            />
            <div className="relative">
              <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                {t('cta_section_title')}
              </h2>
              <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
                {t('cta_section_subtitle')}
              </p>
              <div className="mt-7 flex flex-col items-center justify-center gap-2.5 sm:flex-row">
                <Link
                  href="/auth/signin"
                  className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-[3px] bg-primary px-6 text-sm font-medium text-primary-foreground shadow-xs transition-[background-color,box-shadow,transform] duration-150 hover:bg-primary-hover hover:shadow-sm active:translate-y-px sm:w-auto"
                >
                  {t('cta_final_button')}
                  <ArrowRight className="size-4" aria-hidden="true" />
                </Link>
                <Link
                  href="/pricing"
                  className="inline-flex h-10 w-full items-center justify-center rounded-[3px] border border-border bg-background px-6 text-sm font-medium text-foreground shadow-2xs transition-[background-color,border-color] duration-150 hover:border-border-strong hover:bg-muted active:translate-y-px sm:w-auto"
                >
                  {t('nav_pricing')}
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────────────────── */}
      <footer className="border-t border-border py-10">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 sm:flex-row">
          <div className="flex items-center gap-2">
            <span className="grid size-6 place-items-center rounded-md bg-primary text-[11px] font-bold text-primary-foreground">
              O
            </span>
            <span className="text-sm font-semibold tracking-tight">Omnysync</span>
          </div>
          <nav
            className="flex items-center gap-5 text-sm text-muted-foreground"
            aria-label="Footer"
          >
            <Link href="/pricing" className="transition-colors hover:text-foreground">
              {t('nav_pricing')}
            </Link>
            <Link href="#" className="transition-colors hover:text-foreground">
              {t('footer_privacy')}
            </Link>
            <Link href="#" className="transition-colors hover:text-foreground">
              {t('footer_terms')}
            </Link>
          </nav>
          <p className="text-xs text-muted-foreground">{t('footer_copyright')}</p>
        </div>
      </footer>
    </div>
  )
}
